# Azure OpenAI Cost Estimator

A lightweight TypeScript utility for estimating the cost of Azure OpenAI API calls. This package fetches pricing data from the Azure Retail Prices API and provides accurate cost estimates for various Azure OpenAI models.

## Features

- Fetches up-to-date pricing data from the official Azure Retail Prices API
- Supports all Azure OpenAI models (GPT-4, GPT-3.5 Turbo, o-family models, Embeddings, DALL-E, etc.)
- Automatically handles current and future o-family models (o1, o3, o3-mini, o4-mini, etc.)
- Caching of pricing data to minimize API requests
- Customizable currency and cache TTL
- Zero dependencies beyond Axios
- Written in TypeScript with full type definitions

## Installation

```bash
npm install azure-openai-cost-estimator
```

## Usage

### Basic Usage

```typescript
import { AzureOpenAICostEstimator } from 'azure-openai-cost-estimator';

// Create an estimator instance
const estimator = new AzureOpenAICostEstimator();

// Estimate the cost of a GPT-4 call
async function example() {
  const costUsd = await estimator.estimateCost({
    region: 'eastus',
    model: 'gpt-4',
    promptTokens: 500,
    completionTokens: 1200
  });
  
  console.log(`Estimated cost: $${costUsd.toFixed(4)}`);
}

example();
```

### With Custom Options

```typescript
import { AzureOpenAICostEstimator } from 'azure-openai-cost-estimator';

// Create an estimator with custom options
const estimator = new AzureOpenAICostEstimator({
  currency: 'EUR',      // Use Euro instead of USD
  cacheTTL: 3600 * 1000 // Cache pricing data for 1 hour (instead of default 24h)
});

// Estimate the cost of an embedding model call
async function example() {
  const cost = await estimator.estimateCost({
    region: 'westeurope',
    model: 'text-embedding-ada-002',
    promptTokens: 1500
  });
  
  console.log(`Estimated cost: €${cost.toFixed(4)}`);
}

example();
```

### Different Model Types

```typescript
import { AzureOpenAICostEstimator } from 'azure-openai-cost-estimator';

const estimator = new AzureOpenAICostEstimator();

// Text completion model (GPT-3.5 Turbo)
async function estimateTextModel() {
  return await estimator.estimateCost({
    region: 'eastus',
    model: 'gpt-3.5-turbo',
    promptTokens: 500,
    completionTokens: 300
  });
}

// O-family models - works with all current and future o-models
async function estimateOFamilyModels() {
  // o3 model
  const o3Cost = await estimator.estimateCost({
    region: 'eastus',
    model: 'o3',  // also works with variant formats like 'o-3', 'O3', etc.
    promptTokens: 1000,
    completionTokens: 500
  });
  
  // o3-mini model
  const o3MiniCost = await estimator.estimateCost({
    region: 'eastus',
    model: 'o3-mini',  // also works with variant formats like 'o3mini', 'o-3-mini', etc.
    promptTokens: 2000,
    completionTokens: 1000
  });
  
  // Any future o-family models will work automatically
  // For example, when available:
  const o4Cost = await estimator.estimateCost({
    region: 'eastus',
    model: 'o4',
    promptTokens: 1000,
    completionTokens: 500
  });
  
  return { o3Cost, o3MiniCost, o4Cost };
}

// Embedding model
async function estimateEmbedding() {
  return await estimator.estimateCost({
    region: 'eastus',
    model: 'text-embedding-ada-002',
    promptTokens: 1000
  });
}

// Image generation model (DALL-E)
async function estimateImageGeneration() {
  return await estimator.estimateCost({
    region: 'eastus',
    model: 'dall-e-3',
    imageCount: 5
  });
}
```

## API Reference

### `AzureOpenAICostEstimator`

The main class for estimating Azure OpenAI costs.

#### Constructor

```typescript
constructor(opts?: EstimatorOptions)
```

Options:

- `currency` (optional): ISO currency code (default: 'USD')
- `cacheTTL` (optional): Cache time-to-live in milliseconds (default: 24 hours)

#### Methods

##### `estimateCost(input: CostInput): Promise<number>`

Estimates the cost of an Azure OpenAI API call based on the provided parameters.

Parameters:

- `input`: A `CostInput` object containing:
  - `region`: Azure region (e.g., 'eastus', 'westeurope')
  - `model`: Model name or family (e.g., 'gpt-4', 'gpt-3.5-turbo', 'text-embedding-ada-002')
  - `promptTokens` (optional): Number of prompt/input tokens
  - `completionTokens` (optional): Number of completion/output tokens
  - `imageCount` (optional): Number of images for image generation models

Returns:

- A Promise that resolves to the estimated cost in the specified currency (default USD)

## License

MIT 