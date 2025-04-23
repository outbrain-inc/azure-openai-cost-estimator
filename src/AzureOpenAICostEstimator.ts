/*
 * AzureOpenAICostEstimator.ts
 * -------------------------------------------
 * A lightweight TypeScript helper that fetches Azure OpenAI pricing data once a day
 * (via the public Azure Retail Prices API) and estimates the cost of a single
 * Azure OpenAI Service call.
 *
 * The implementation purposely avoids any NestJS‑specific decorators so that it can
 * be published as a plain TypeScript / Node library. Axios is used for HTTP calls.
 *
 * Usage:
 *   const estimator = new AzureOpenAICostEstimator();
 *   const costUsd = await estimator.estimateCost({
 *     region: 'eastus',
 *     model: 'gpt-4',
 *     promptTokens: 500,
 *     completionTokens: 1200
 *   });
 *   console.log(`Estimated cost: $${costUsd.toFixed(4)}`);
 */

import axios from 'axios';

// ---------------------------------------------------------------------------
// Public API Types
// ---------------------------------------------------------------------------

/**
 * Optional configuration when instantiating the estimator.
 */
export interface EstimatorOptions {
  /**
   * Desired billing currency (defaults to "USD").
   * Azure Retail Prices API supports many ISO currency codes.
   */
  currency?: string;

  /**
   * Cache Time‑To‑Live in **milliseconds** (defaults to 24 h).
   */
  cacheTTL?: number;
}

/**
 * Parameters for a single Azure OpenAI API call whose cost you want to estimate.
 */
export interface CostInput {
  /** Azure region short‑name, e.g. "eastus", "westeurope"… */
  region: string;

  /**
   * The deployed model's name or family (e.g. "gpt‑4", "gpt‑4‑32k", "gpt‑4o",
   * "gpt‑3.5‑turbo", "text‑embedding‑ada‑002", "dall‑e‑3").
   */
  model: string;

  /** Number of prompt / input tokens (text models & embeddings). */
  promptTokens?: number;

  /** Number of completion / output tokens (text models). */
  completionTokens?: number;

  /** For image‑generation models (DALL·E, etc.) – number of images requested. */
  imageCount?: number;
}

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

type PriceMeters = {
  /** price per 1 000 *input* tokens (USD) – undefined if N/A for the model */
  inputUsd?: number;
  /** price per 1 000 *output* tokens (USD) – undefined if N/A for the model */
  outputUsd?: number;
  /** price per single image (USD) – used for DALL·E, etc. */
  imageUsd?: number;
};

interface CachedRegionPricing {
  fetchedAt: number; // epoch ms
  meters: Record<string, PriceMeters>; // key = canonical model id
}

interface AzurePriceApiResponse {
  Items: Array<{
    meterName?: string;
    skuName?: string;
    unitPrice?: number;
    [key: string]: any;
  }>;
  NextPageLink?: string | null;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Main Class
// ---------------------------------------------------------------------------

export class AzureOpenAICostEstimator {
  private readonly currency: string;
  private readonly cacheTTL: number;
  private readonly cache: Map<string, CachedRegionPricing>; // key = region

  constructor(opts: EstimatorOptions = {}) {
    this.currency = opts.currency ?? 'USD';
    this.cacheTTL = opts.cacheTTL ?? 24 * 60 * 60 * 1000; // default 24 h
    this.cache = new Map();
  }

  /**
   * Estimate the cost **in USD** of a single Azure OpenAI Service request.
   */
  async estimateCost(input: CostInput): Promise<number> {
    const region = input.region.toLowerCase();
    await this.ensurePricing(region);

    const pricing = this.cache.get(region)!;
    const modelId = this.canonicalModelId(input.model);
    const meters = pricing.meters[modelId];

    if (!meters) {
      throw new Error(
        `Pricing for model "${input.model}" not found in region "${region}".`
      );
    }

    // Text models (GPT families)
    if (meters.inputUsd !== undefined) {
      const inTok = input.promptTokens ?? 0;
      const outTok = input.completionTokens ?? 0;
      const costIn = (inTok / 1000) * (meters.inputUsd ?? 0);
      const costOut = (outTok / 1000) * (meters.outputUsd ?? 0);
      return +(costIn + costOut).toFixed(6);
    }

    // Embedding models – only prompt tokens are billed
    if (meters.outputUsd === undefined && meters.imageUsd === undefined) {
      const inTok = input.promptTokens ?? 0;
      return +((inTok / 1000) * (meters.inputUsd ?? 0)).toFixed(6);
    }

    // Vision / Image models – billed per image
    if (meters.imageUsd !== undefined) {
      const count = input.imageCount ?? 1;
      return +(count * meters.imageUsd).toFixed(6);
    }

    throw new Error('Unable to determine cost – unsupported input combination.');
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /** Ensure we have fresh (≤ cacheTTL) pricing for the region. */
  private async ensurePricing(region: string): Promise<void> {
    const cached = this.cache.get(region);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTTL) return;

    const meters = await this.fetchPricing(region);
    this.cache.set(region, { fetchedAt: Date.now(), meters });
  }

  /**
   * Downloads the Azure OpenAI retail price list for a region and normalises it
   * into a { modelId → PriceMeters } map.
   */
  private async fetchPricing(region: string): Promise<Record<string, PriceMeters>> {
    const endpoint = `https://prices.azure.com/api/retail/prices`;

    // filter: serviceName eq 'Azure OpenAI Service' and armRegionName eq 'eastus'
    const filter = encodeURIComponent(
      `serviceName eq 'Azure OpenAI Service' and armRegionName eq '${region}' and currencyCode eq '${this.currency}'`
    );

    const allItems: any[] = [];
    let next: string | null = `${endpoint}?$filter=${filter}`;

    // Handle API paging – follow nextPageLink until exhausted
    while (next) {
      const response = await axios.get<AzurePriceApiResponse>(next);
      const data: AzurePriceApiResponse = response.data;
      allItems.push(...data.Items);
      next = data.NextPageLink ?? null;
    }

    // Build model → meter map
    const meters: Record<string, PriceMeters> = {};

    for (const item of allItems) {
      const meterName: string = item.meterName ?? '';
      const skuName: string = item.skuName ?? '';
      const pricePerUnit: number = item.unitPrice ?? 0;

      const modelKey = this.extractModelKey(meterName, skuName);
      if (!modelKey) continue; // skip unrecognized meters (training, RI, etc.)

      // Initialise if first encounter
      if (!meters[modelKey]) {
        meters[modelKey] = {};
      }

      if (/image/i.test(meterName)) {
        meters[modelKey].imageUsd = pricePerUnit / 100; // API gives per 100 images
      } else if (/input/i.test(meterName) || /prompt/i.test(meterName)) {
        meters[modelKey].inputUsd = pricePerUnit;
      } else if (/output/i.test(meterName) || /completion/i.test(meterName)) {
        meters[modelKey].outputUsd = pricePerUnit;
      } else if (/embedding/i.test(meterName)) {
        meters[modelKey].inputUsd = pricePerUnit; // embeddings use input only
      }
    }

    return meters;
  }

  /**
   * Given Azure's meterName/skuName, heuristically determine the canonical model id.
   * We normalise to lower‑case, strip spaces, replace underscores with hyphens.
   */
  private extractModelKey(meterName: string, skuName: string): string | null {
    const src = `${meterName} ${skuName}`.toLowerCase();

    // Handle "o" family models (o1, o3, o3-mini, o4-mini, etc.)
    const oFamilyMatch = src.match(/\bo[- ]?([0-9]+)(?:[- ]mini)?/i);
    if (oFamilyMatch) {
      const version = oFamilyMatch[1];
      const isMini = src.includes('mini');
      return `o${version}${isMini ? '-mini' : ''}`;
    }

    // GPT‑4 / GPT‑4o / GPT‑4 turbo / GPT‑3.5 Turbo / GPT‑35-Turbo / GPT‑3.5 Turbo 16k
    if (src.includes('gpt-35') || src.includes('gpt35')) {
      return 'gpt-35-turbo';
    }
    
    const gptMatch = src.match(/gpt[- ]?([34](?:\.5)?)(?:[ -]turbo)?(?:.*?)(32k|16k|8k|1106|0125|o)?/);
    if (gptMatch) {
      const ver = gptMatch[1].replace('.', '');
      const ctx = gptMatch[2] ? `-${gptMatch[2]}` : '';
      return `gpt-${ver}${ctx}`;
    }

    // Embedding models – e.g. "text-embedding-ada-002"
    const embedMatch = src.match(/embedding.*(ada|babbage|curie|davinci|gecko)/);
    if (embedMatch) {
      return `text-embedding-${embedMatch[1]}`;
    }

    // DALL‑E meters often have "dall-e" in name
    if (src.includes('dall-e')) return 'dall-e';

    return null; // unrecognised / skip
  }

  /** Canonicalises user‑supplied model string to our internal key mapping. */
  private canonicalModelId(model: string): string {
    const modelLower = model.toLowerCase();
    
    // Handle o-family models with regex for current and future models (o1, o3, o3-mini, o4-mini, etc.)
    const oFamilyMatch = modelLower.match(/\bo[- ]?([0-9]+)(?:[- ]mini)?/i);
    if (oFamilyMatch) {
      const version = oFamilyMatch[1];
      const isMini = modelLower.includes('mini');
      return `o${version}${isMini ? '-mini' : ''}`;
    }

    // Special handling for GPT-35 vs GPT-3.5 naming variations
    if (modelLower.includes('gpt-3.5') || 
        modelLower.includes('gpt3.5')) {
      return 'gpt-35-turbo';
    }
    
    return model
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-\$/g, '');
  }
} 