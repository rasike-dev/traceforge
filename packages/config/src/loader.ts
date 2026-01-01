/**
 * Configuration Loader
 * Loads and validates TraceForge configuration from YAML or JSON files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import Ajv from 'ajv';
import { configSchema } from './schema';
import type { TraceForgeConfig, ConfigValidationResult } from './types';

const ajv = new Ajv({ 
  allErrors: true, 
  verbose: true,
  strict: false, // Allow unknown formats
});
const validate = ajv.compile(configSchema);

/**
 * Resolve environment variables in config values
 * Supports ${VAR_NAME} syntax
 */
function resolveEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    // Match ${VAR_NAME} pattern
    return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const value = process.env[varName.trim()];
      if (value === undefined) {
        console.warn(`[Config] Environment variable ${varName} not found, keeping placeholder`);
        return match;
      }
      return value;
    });
  }
  
  if (Array.isArray(obj)) {
    return obj.map(resolveEnvVars);
  }
  
  if (obj && typeof obj === 'object') {
    const resolved: any = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveEnvVars(value);
    }
    return resolved;
  }
  
  return obj;
}

/**
 * Load configuration from file
 */
export function loadConfig(filePath: string): TraceForgeConfig {
  const fullPath = path.resolve(filePath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Configuration file not found: ${fullPath}`);
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const ext = path.extname(fullPath).toLowerCase();
  
  let config: any;
  
  if (ext === '.yaml' || ext === '.yml') {
    config = yaml.load(content);
  } else if (ext === '.json') {
    config = JSON.parse(content);
  } else {
    throw new Error(`Unsupported configuration file format: ${ext}. Use .yaml, .yml, or .json`);
  }
  
  // Resolve environment variables
  config = resolveEnvVars(config);
  
  // Validate
  const validation = validateConfig(config);
  if (!validation.valid) {
    const errors = validation.errors?.map(e => `${e.path}: ${e.message}`).join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }
  
  return config as TraceForgeConfig;
}

/**
 * Validate configuration
 */
export function validateConfig(config: any): ConfigValidationResult {
  const valid = validate(config);
  
  if (valid) {
    return { valid: true };
  }
  
  const errors = (validate.errors || []).map(err => ({
    path: err.instancePath || err.schemaPath || 'root',
    message: err.message || 'Validation error',
  }));
  
  // Additional custom validations
  const warnings: Array<{ path: string; message: string }> = [];
  
  // Check evaluation weights sum to ~1.0
  if (config.evaluation?.weights) {
    const weights = config.evaluation.weights;
    const sum = (weights.faithfulness || 0) + 
                (weights.relevance || 0) + 
                (weights.policyRisk || 0) + 
                (weights.hallucination || 0);
    if (Math.abs(sum - 1.0) > 0.1) {
      warnings.push({
        path: 'evaluation.weights',
        message: `Evaluation weights sum to ${sum.toFixed(2)}, should be close to 1.0`,
      });
    }
  }
  
  // Check remediation strategies have thresholds
  if (config.remediation?.strategies) {
    config.remediation.strategies.forEach((strategy: any, index: number) => {
      if (!strategy.threshold && strategy.type !== 'CLARIFICATION') {
        warnings.push({
          path: `remediation.strategies[${index}].threshold`,
          message: `Strategy ${strategy.type} should have a threshold`,
        });
      }
    });
  }
  
  return {
    valid: false,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Save configuration to file
 */
export function saveConfig(config: TraceForgeConfig, filePath: string, format: 'yaml' | 'json' = 'yaml'): void {
  const fullPath = path.resolve(filePath);
  const dir = path.dirname(fullPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Add metadata
  const configWithMetadata = {
    ...config,
    metadata: {
      ...config.metadata,
      updated: new Date().toISOString(),
    },
  };
  
  let content: string;
  if (format === 'yaml') {
    content = yaml.dump(configWithMetadata, {
      indent: 2,
      lineWidth: 120,
    });
  } else {
    content = JSON.stringify(configWithMetadata, null, 2);
  }
  
  fs.writeFileSync(fullPath, content, 'utf-8');
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): TraceForgeConfig {
  return {
    version: '1.0.0',
    environment: 'development',
    rag: {
      provider: 'qdrant',
      topK: 5,
      collection: 'traceforge_demo',
      url: 'http://localhost:6333',
    },
    llm: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      temperature: 0.7,
    },
    tools: [
      {
        name: 'weather.mock',
        type: 'custom',
        enabled: true,
        timeout: 5000,
      },
    ],
    evaluation: {
      provider: 'basic',
      qualityThreshold: 0.75,
      weights: {
        faithfulness: 0.3,
        relevance: 0.3,
        policyRisk: 0.2,
        hallucination: 0.2,
      },
    },
    remediation: {
      strategies: [
        {
          type: 'CLARIFICATION',
          threshold: 0.75,
          enabled: true,
        },
      ],
    },
    options: {
      enableRag: true,
      enableTools: true,
      enableEvaluation: true,
      enableRemediation: true,
      maxRetries: 3,
      requestTimeout: 30000,
    },
    metadata: {
      name: 'Default Configuration',
      description: 'Default TraceForge configuration',
      created: new Date().toISOString(),
    },
  };
}

