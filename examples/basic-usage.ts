import { AzureOpenAICostEstimator } from '../src';

async function main() {
  // Create an estimator instance
  const estimator = new AzureOpenAICostEstimator();

  try {
    // Estimate the cost of a GPT-4 call
    const gpt4Cost = await estimator.estimateCost({
      region: 'eastus',
      model: 'gpt-4',
      promptTokens: 500,
      completionTokens: 1200
    });
    
    console.log(`Estimated GPT-4 cost: $${gpt4Cost.toFixed(4)}`);

    // Estimate the cost of a GPT-3.5 Turbo call
    const gpt35Cost = await estimator.estimateCost({
      region: 'eastus',
      model: 'gpt-3.5-turbo',
      promptTokens: 1000,
      completionTokens: 500
    });
    
    console.log(`Estimated GPT-3.5 Turbo cost: $${gpt35Cost.toFixed(4)}`);

    // Estimate the cost of o-family models
    // Note: These examples will only work when Azure actually offers these models
    // with the corresponding price meters in the region

    // o3 model
    const o3Cost = await estimator.estimateCost({
      region: 'eastus',
      model: 'o3', // also works with 'o-3', 'O3', etc.
      promptTokens: 1000,
      completionTokens: 500
    });
    
    console.log(`Estimated o3 cost: $${o3Cost.toFixed(4)}`);

    // o3-mini model
    const o3MiniCost = await estimator.estimateCost({
      region: 'eastus',
      model: 'o3-mini', // also works with 'o3mini', 'o-3-mini', etc.
      promptTokens: 2000,
      completionTokens: 1000
    });
    
    console.log(`Estimated o3-mini cost: $${o3MiniCost.toFixed(4)}`);

    // Future o-family models will work automatically
    // Example with hypothetical 'o4' model
    try {
      const o4Cost = await estimator.estimateCost({
        region: 'eastus',
        model: 'o4',
        promptTokens: 1000,
        completionTokens: 500
      });
      
      console.log(`Estimated o4 cost: $${o4Cost.toFixed(4)}`);
    } catch (error) {
      console.log('o4 model not yet available in this region');
    }

    // Example with hypothetical 'o1-mini' model
    try {
      const o1MiniCost = await estimator.estimateCost({
        region: 'eastus',
        model: 'o1-mini',
        promptTokens: 2000,
        completionTokens: 1000
      });
      
      console.log(`Estimated o1-mini cost: $${o1MiniCost.toFixed(4)}`);
    } catch (error) {
      console.log('o1-mini model not yet available in this region');
    }

    // Estimate the cost of an embedding model call
    const embeddingCost = await estimator.estimateCost({
      region: 'eastus',
      model: 'text-embedding-ada-002',
      promptTokens: 1500
    });
    
    console.log(`Estimated embedding cost: $${embeddingCost.toFixed(4)}`);

    // Estimate the cost of a DALL-E image generation
    const dallECost = await estimator.estimateCost({
      region: 'eastus',
      model: 'dall-e-3',
      imageCount: 3
    });
    
    console.log(`Estimated DALL-E cost for 3 images: $${dallECost.toFixed(4)}`);
  } catch (error) {
    console.error('Error estimating costs:', error);
  }
}

main().catch(console.error); 