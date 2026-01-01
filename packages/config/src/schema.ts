/**
 * JSON Schema for TraceForge Configuration
 * Used for validation and IDE autocomplete
 */

export const configSchema = {
  type: 'object',
  required: ['version', 'rag', 'llm', 'evaluation', 'remediation'],
  properties: {
    version: {
      type: 'string',
      description: 'Configuration schema version',
      default: '1.0.0',
    },
    environment: {
      type: 'string',
      enum: ['development', 'staging', 'production'],
      description: 'Environment name',
    },
    rag: {
      type: 'object',
      required: ['provider'],
      properties: {
        provider: {
          type: 'string',
          enum: ['qdrant', 'pinecone', 'weaviate', 'chroma', 'milvus', 'mock'],
          description: 'RAG provider to use',
        },
        topK: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 5,
          description: 'Number of documents to retrieve',
        },
        collection: {
          type: 'string',
          description: 'Collection name (provider-specific)',
        },
        url: {
          type: 'string',
          description: 'Provider URL',
        },
        apiKey: {
          type: 'string',
          description: 'API key (can use env var: ${API_KEY})',
        },
      },
      additionalProperties: true,
    },
    llm: {
      type: 'object',
      required: ['provider'],
      properties: {
        provider: {
          type: 'string',
          enum: ['gemini', 'openai', 'anthropic', 'cohere', 'mistral', 'mock'],
          description: 'LLM provider to use',
        },
        model: {
          type: 'string',
          description: 'Model name (e.g., gpt-4, gemini-2.5-flash)',
        },
        temperature: {
          type: 'number',
          minimum: 0,
          maximum: 2,
          default: 0.7,
          description: 'Temperature for generation',
        },
        maxTokens: {
          type: 'number',
          minimum: 1,
          maximum: 100000,
          description: 'Maximum tokens to generate',
        },
        apiKey: {
          type: 'string',
          description: 'API key (can use env var: ${API_KEY})',
        },
      },
      additionalProperties: true,
    },
    tools: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: {
            type: 'string',
            description: 'Tool name',
          },
          type: {
            type: 'string',
            enum: ['http', 'database', 'filesystem', 'custom'],
            description: 'Tool type',
          },
          enabled: {
            type: 'boolean',
            default: true,
            description: 'Whether tool is enabled',
          },
          timeout: {
            type: 'number',
            minimum: 100,
            default: 5000,
            description: 'Timeout in milliseconds',
          },
          endpoint: {
            type: 'string',
            description: 'HTTP endpoint (for http type)',
          },
          connection: {
            type: 'string',
            description: 'Connection string (for database type)',
          },
        },
        additionalProperties: true,
      },
    },
    evaluation: {
      type: 'object',
      required: ['provider'],
      properties: {
        provider: {
          type: 'string',
          enum: ['basic', 'llm-judge', 'custom'],
          description: 'Evaluator provider',
        },
        qualityThreshold: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.75,
          description: 'Quality threshold for remediation',
        },
        weights: {
          type: 'object',
          properties: {
            faithfulness: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              default: 0.3,
            },
            relevance: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              default: 0.3,
            },
            policyRisk: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              default: 0.2,
            },
            hallucination: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              default: 0.2,
            },
          },
        },
      },
      additionalProperties: true,
    },
    remediation: {
      type: 'object',
      required: ['strategies'],
      properties: {
        strategies: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                type: 'string',
                enum: ['CLARIFICATION', 'SAFE_MODE', 'FALLBACK_TOOL', 'RETRY_LLM'],
                description: 'Remediation strategy type',
              },
              threshold: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description: 'Threshold to trigger this strategy',
              },
              enabled: {
                type: 'boolean',
                default: true,
                description: 'Whether strategy is enabled',
              },
            },
            additionalProperties: true,
          },
        },
      },
    },
    prompt: {
      type: 'object',
      properties: {
        template: {
          type: 'string',
          description: 'Prompt template (supports {{variables}})',
        },
        systemPrompt: {
          type: 'string',
          description: 'System prompt',
        },
        variables: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
      },
    },
    options: {
      type: 'object',
      properties: {
        enableRag: {
          type: 'boolean',
          default: true,
        },
        enableTools: {
          type: 'boolean',
          default: true,
        },
        enableEvaluation: {
          type: 'boolean',
          default: true,
        },
        enableRemediation: {
          type: 'boolean',
          default: true,
        },
        maxRetries: {
          type: 'number',
          minimum: 0,
          default: 3,
        },
        requestTimeout: {
          type: 'number',
          minimum: 1000,
          default: 30000,
        },
      },
    },
    metadata: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Configuration name',
        },
        description: {
          type: 'string',
          description: 'Configuration description',
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        created: {
          type: 'string',
          description: 'ISO 8601 date-time string',
        },
        updated: {
          type: 'string',
          description: 'ISO 8601 date-time string',
        },
      },
    },
  },
};

