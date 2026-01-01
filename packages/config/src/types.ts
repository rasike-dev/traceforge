/**
 * TraceForge Configuration Types
 * 
 * This defines the structure of the TraceForge configuration file.
 * Supports YAML and JSON formats.
 */

export type RagProvider = 'qdrant' | 'pinecone' | 'weaviate' | 'chroma' | 'milvus' | 'mock';
export type LlmProvider = 'gemini' | 'openai' | 'anthropic' | 'cohere' | 'mistral' | 'mock';
export type EvaluatorProvider = 'basic' | 'llm-judge' | 'custom';
export type RemediationStrategy = 'CLARIFICATION' | 'SAFE_MODE' | 'FALLBACK_TOOL' | 'RETRY_LLM';

export interface RagConfig {
  provider: RagProvider;
  topK?: number;
  collection?: string;
  url?: string;
  apiKey?: string;
  // Provider-specific config
  [key: string]: any;
}

export interface LlmConfig {
  provider: LlmProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  // Provider-specific config
  [key: string]: any;
}

export interface ToolConfig {
  name: string;
  type: 'http' | 'database' | 'filesystem' | 'custom';
  enabled?: boolean;
  timeout?: number;
  // Tool-specific config
  endpoint?: string;
  connection?: string;
  [key: string]: any;
}

export interface EvaluationConfig {
  provider: EvaluatorProvider;
  qualityThreshold?: number;
  weights?: {
    faithfulness?: number;
    relevance?: number;
    policyRisk?: number;
    hallucination?: number;
  };
  // Provider-specific config
  [key: string]: any;
}

export interface RemediationConfig {
  strategies: Array<{
    type: RemediationStrategy;
    threshold?: number;
    enabled?: boolean;
    // Strategy-specific config
    [key: string]: any;
  }>;
}

export interface PromptConfig {
  template?: string;
  systemPrompt?: string;
  variables?: Record<string, string>;
}

export interface TraceForgeConfig {
  version: string;
  environment?: 'development' | 'staging' | 'production';
  
  rag: RagConfig;
  llm: LlmConfig;
  tools?: ToolConfig[];
  evaluation: EvaluationConfig;
  remediation: RemediationConfig;
  prompt?: PromptConfig;
  
  // Advanced options
  options?: {
    enableRag?: boolean;
    enableTools?: boolean;
    enableEvaluation?: boolean;
    enableRemediation?: boolean;
    maxRetries?: number;
    requestTimeout?: number;
  };
  
  // Metadata
  metadata?: {
    name?: string;
    description?: string;
    tags?: string[];
    created?: string;
    updated?: string;
  };
}

export interface ConfigValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
  }>;
  warnings?: Array<{
    path: string;
    message: string;
  }>;
}

