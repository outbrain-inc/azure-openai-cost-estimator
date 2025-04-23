import { AzureOpenAICostEstimator } from '../src';

async function main() {
  // Create an estimator with custom options
  const estimator = new AzureOpenAICostEstimator({
    currency: 'EUR',      // Use Euro instead of USD
    cacheTTL: 3600 * 1000 // Cache pricing data for 1 hour (instead of default 24h)
  });

  try {
    // Estimate the cost of a GPT-4 call in EUR
    const gpt4Cost = await estimator.estimateCost({
      region: 'westeurope', // European region
      model: 'gpt-4-32k',   // Using a model with larger context window
      promptTokens: 5000,
      completionTokens: 1500
    });
    
    console.log(`Estimated GPT-4-32k cost: €${gpt4Cost.toFixed(4)}`);

    // Multiple requests will use cached pricing data (for 1 hour as configured)
    const gpt35Cost = await estimator.estimateCost({
      region: 'westeurope',
      model: 'gpt-3.5-turbo',
      promptTokens: 2000,
      completionTokens: 800
    });
    
    console.log(`Estimated GPT-3.5 Turbo cost: €${gpt35Cost.toFixed(4)}`);
  } catch (error) {
    console.error('Error estimating costs:', error);
  }
}

main().catch(console.error); 