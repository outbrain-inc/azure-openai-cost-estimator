import axios from 'axios';
import { AzureOpenAICostEstimator, CostInput } from '../AzureOpenAICostEstimator';

// Mock axios to avoid real API calls during tests
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AzureOpenAICostEstimator', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock response from Azure Retail Prices API
    mockedAxios.get.mockResolvedValue({
      data: {
        Items: [
          {
            meterName: 'GPT-4 Prompt Tokens',
            skuName: 'GPT-4',
            unitPrice: 0.03, // $0.03 per 1000 tokens
          },
          {
            meterName: 'GPT-4 Completion Tokens',
            skuName: 'GPT-4',
            unitPrice: 0.06, // $0.06 per 1000 tokens
          },
          {
            meterName: 'GPT-35-Turbo Prompt Tokens',
            skuName: 'GPT-35-Turbo',
            unitPrice: 0.0015, // $0.0015 per 1000 tokens
          },
          {
            meterName: 'GPT-35-Turbo Completion Tokens',
            skuName: 'GPT-35-Turbo',
            unitPrice: 0.002, // $0.002 per 1000 tokens
          },
          {
            meterName: 'Text embedding ada',
            skuName: 'Text Embedding',
            unitPrice: 0.0001, // $0.0001 per 1000 tokens
          },
          {
            meterName: 'DALL-E Image',
            skuName: 'DALL-E',
            unitPrice: 20, // $0.20 per image (reported as 20 per 100)
          },
          {
            meterName: 'O3 Prompt Tokens',
            skuName: 'O3',
            unitPrice: 0.015, // $0.015 per 1000 tokens
          },
          {
            meterName: 'O3 Completion Tokens',
            skuName: 'O3',
            unitPrice: 0.030, // $0.030 per 1000 tokens
          },
          {
            meterName: 'O3-Mini Prompt Tokens',
            skuName: 'O3-Mini',
            unitPrice: 0.0015, // $0.0015 per 1000 tokens
          },
          {
            meterName: 'O3-Mini Completion Tokens',
            skuName: 'O3-Mini',
            unitPrice: 0.0020, // $0.0020 per 1000 tokens
          }
        ],
        NextPageLink: null
      }
    });
  });

  it('should estimate GPT-4 costs correctly', async () => {
    const estimator = new AzureOpenAICostEstimator();
    const input: CostInput = {
      region: 'eastus',
      model: 'gpt-4',
      promptTokens: 500,
      completionTokens: 200
    };

    const cost = await estimator.estimateCost(input);
    
    // Expected cost calculation:
    // Prompt: 500 / 1000 * 0.03 = 0.015
    // Completion: 200 / 1000 * 0.06 = 0.012
    // Total: 0.015 + 0.012 = 0.027
    expect(cost).toBeCloseTo(0.027, 6);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('should estimate GPT-3.5 Turbo costs correctly', async () => {
    // Mock the response specifically for this test
    mockedAxios.get.mockImplementationOnce(() => {
      return Promise.resolve({
        data: {
          Items: [
            {
              meterName: 'GPT-35-Turbo Prompt Tokens',
              skuName: 'Standard', 
              unitPrice: 0.0015,
            },
            {
              meterName: 'GPT-35-Turbo Completion Tokens',
              skuName: 'Standard',
              unitPrice: 0.002,
            }
          ],
          NextPageLink: null
        }
      });
    });

    const estimator = new AzureOpenAICostEstimator();
    const input: CostInput = {
      region: 'eastus',
      model: 'gpt-35-turbo',  
      promptTokens: 1000,
      completionTokens: 500
    };

    const cost = await estimator.estimateCost(input);
    
    // Expected cost calculation:
    // Prompt: 1000 / 1000 * 0.0015 = 0.0015
    // Completion: 500 / 1000 * 0.002 = 0.001
    // Total: 0.0015 + 0.001 = 0.0025
    expect(cost).toBeCloseTo(0.0025, 6);
  });

  it('should estimate embedding model costs correctly', async () => {
    const estimator = new AzureOpenAICostEstimator();
    const input: CostInput = {
      region: 'eastus',
      model: 'text-embedding-ada',
      promptTokens: 1000
    };

    const cost = await estimator.estimateCost(input);
    
    // Expected cost calculation:
    // 1000 / 1000 * 0.0001 = 0.0001
    expect(cost).toBeCloseTo(0.0001, 6);
  });

  it('should estimate DALL-E costs correctly', async () => {
    const estimator = new AzureOpenAICostEstimator();
    const input: CostInput = {
      region: 'eastus',
      model: 'dall-e',
      imageCount: 5
    };

    const cost = await estimator.estimateCost(input);
    
    // Expected cost calculation:
    // 5 * 0.20 = 1.00
    expect(cost).toBeCloseTo(1.0, 6);
  });

  it('should use currency specified in options', async () => {
    const estimator = new AzureOpenAICostEstimator({ currency: 'EUR' });
    const input: CostInput = {
      region: 'westeurope',
      model: 'gpt-4',
      promptTokens: 100,
      completionTokens: 100
    };

    await estimator.estimateCost(input);
    
    // Check that API request includes the specified currency
    const url = mockedAxios.get.mock.calls[0][0];
    expect(url).toContain("currencyCode%20eq%20'EUR'");
  });

  it('should throw error for unknown model', async () => {
    const estimator = new AzureOpenAICostEstimator();
    const input: CostInput = {
      region: 'eastus',
      model: 'non-existent-model',
      promptTokens: 100
    };

    await expect(estimator.estimateCost(input)).rejects.toThrow(
      'Pricing for model "non-existent-model" not found in region "eastus"'
    );
  });

  it('should estimate O3 costs correctly', async () => {
    const estimator = new AzureOpenAICostEstimator();
    const input: CostInput = {
      region: 'eastus',
      model: 'o3',
      promptTokens: 1000,
      completionTokens: 500
    };

    const cost = await estimator.estimateCost(input);
    
    // Expected cost calculation:
    // Prompt: 1000 / 1000 * 0.015 = 0.015
    // Completion: 500 / 1000 * 0.030 = 0.015
    // Total: 0.015 + 0.015 = 0.030
    expect(cost).toBeCloseTo(0.030, 6);
  });

  it('should estimate O3-Mini costs correctly', async () => {
    const estimator = new AzureOpenAICostEstimator();
    const input: CostInput = {
      region: 'eastus',
      model: 'o3-mini',
      promptTokens: 2000,
      completionTokens: 1000
    };

    const cost = await estimator.estimateCost(input);
    
    // Expected cost calculation:
    // Prompt: 2000 / 1000 * 0.0015 = 0.003
    // Completion: 1000 / 1000 * 0.0020 = 0.002
    // Total: 0.003 + 0.002 = 0.005
    expect(cost).toBeCloseTo(0.005, 6);
  });

  it('should handle different O3 model naming formats', async () => {
    const estimator = new AzureOpenAICostEstimator();
    
    // These should all be canonicalized to 'o3'
    const models = ['o3', 'O3', 'o-3', 'OpenAI-O3'];
    
    for (const modelName of models) {
      const input: CostInput = {
        region: 'eastus',
        model: modelName,
        promptTokens: 1000,
        completionTokens: 500
      };
      
      const cost = await estimator.estimateCost(input);
      expect(cost).toBeCloseTo(0.030, 6);
    }
  });

  it('should support various o-family models', async () => {
    // Mock pricing API for various o-family models
    mockedAxios.get.mockImplementationOnce(() => {
      return Promise.resolve({
        data: {
          Items: [
            {
              meterName: 'O1 Prompt Tokens',
              skuName: 'Standard',
              unitPrice: 0.01, // Example price
            },
            {
              meterName: 'O1 Completion Tokens',
              skuName: 'Standard',
              unitPrice: 0.02, // Example price
            },
            {
              meterName: 'O4-Mini Prompt Tokens',
              skuName: 'Standard',
              unitPrice: 0.003, // Example price
            },
            {
              meterName: 'O4-Mini Completion Tokens',
              skuName: 'Standard',
              unitPrice: 0.006, // Example price
            }
          ],
          NextPageLink: null
        }
      });
    });

    const estimator = new AzureOpenAICostEstimator();
    
    // Test "o1" model
    const o1Input: CostInput = {
      region: 'eastus',
      model: 'o1',
      promptTokens: 500,
      completionTokens: 200
    };
    
    const o1Cost = await estimator.estimateCost(o1Input);
    // Prompt: 500 / 1000 * 0.01 = 0.005
    // Completion: 200 / 1000 * 0.02 = 0.004
    // Total: 0.005 + 0.004 = 0.009
    expect(o1Cost).toBeCloseTo(0.009, 6);
    
    // Test "o4-mini" model
    const o4MiniInput: CostInput = {
      region: 'eastus',
      model: 'o4-mini',
      promptTokens: 1000,
      completionTokens: 500
    };
    
    const o4MiniCost = await estimator.estimateCost(o4MiniInput);
    // Prompt: 1000 / 1000 * 0.003 = 0.003
    // Completion: 500 / 1000 * 0.006 = 0.003
    // Total: 0.003 + 0.003 = 0.006
    expect(o4MiniCost).toBeCloseTo(0.006, 6);
  });

  it('should handle o3 model with different naming formats', async () => {
    // Setup mock for O3 model
    mockedAxios.get.mockImplementation(() => {
      return Promise.resolve({
        data: {
          Items: [
            {
              meterName: 'O3 Prompt Tokens',
              skuName: 'Standard',
              unitPrice: 0.015,
            },
            {
              meterName: 'O3 Completion Tokens',
              skuName: 'Standard',
              unitPrice: 0.030,
            }
          ],
          NextPageLink: null
        }
      });
    });

    const estimator = new AzureOpenAICostEstimator();
    
    // Test various o3 naming formats
    const o3Variants = [
      'o3', 
      'O3', 
      'o-3', 
      'o 3',
      'OpenAI-o3', 
      'openai.o3'
    ];
    
    for (const modelName of o3Variants) {
      const input: CostInput = {
        region: 'eastus',
        model: modelName,
        promptTokens: 1000,
        completionTokens: 500
      };
      
      const cost = await estimator.estimateCost(input);
      expect(cost).toBeCloseTo(0.030, 6);
    }
  });

  it('should handle o3-mini model with different naming formats', async () => {
    // Setup mock for O3-Mini model
    mockedAxios.get.mockImplementation(() => {
      return Promise.resolve({
        data: {
          Items: [
            {
              meterName: 'O3-Mini Prompt Tokens',
              skuName: 'Standard',
              unitPrice: 0.0015,
            },
            {
              meterName: 'O3-Mini Completion Tokens',
              skuName: 'Standard',
              unitPrice: 0.0020,
            }
          ],
          NextPageLink: null
        }
      });
    });

    const estimator = new AzureOpenAICostEstimator();
    
    // Test various o3-mini naming formats
    const o3MiniVariants = [
      'o3-mini',
      'O3-MINI',
      'o3mini',
      'o-3-mini',
      'o-3mini',
      'o 3 mini',
      'OpenAI-o3-mini'
    ];
    
    for (const modelName of o3MiniVariants) {
      const input: CostInput = {
        region: 'eastus',
        model: modelName,
        promptTokens: 2000,
        completionTokens: 1000
      };
      
      const cost = await estimator.estimateCost(input);
      expect(cost).toBeCloseTo(0.005, 6);
    }
  });
}); 