// packages/rag/src/qdrant/qdrant.provider.ts

/**
 * Qdrant RAG provider
 * Implements real RAG retrieval using Qdrant vector database
 */

import { QdrantClient } from './qdrant.client';

export interface RagRetrievalInput {
  query: string;
  topK?: number;
}

export interface RagRetrievalOutput {
  context: string;
  docs: number;
  sources?: string[];
}

export class QdrantRagProvider {
  private client: QdrantClient;
  private defaultTopK: number;

  constructor(baseUrl?: string, collectionName?: string, defaultTopK: number = 5) {
    this.client = new QdrantClient(baseUrl, collectionName);
    this.defaultTopK = defaultTopK;
  }

  /**
   * Retrieve relevant documents for a query
   */
  async retrieve(input: RagRetrievalInput): Promise<RagRetrievalOutput> {
    const topK = input.topK || this.defaultTopK;

    try {
      // Check if collection exists
      const exists = await this.client.collectionExists();
      if (!exists) {
        console.warn('[QdrantRagProvider] Collection does not exist, returning empty results');
        return {
          context: '',
          docs: 0,
          sources: [],
        };
      }

      // Search for relevant documents
      const results = await this.client.searchByKeyword(input.query, topK);

      if (results.length === 0) {
        return {
          context: '',
          docs: 0,
          sources: [],
        };
      }

      // Combine document texts into context
      const context = results
        .map((r) => r.payload.text)
        .join('\n\n');

      const sources = results
        .map((r) => r.payload.source)
        .filter((s): s is string => !!s);

      return {
        context,
        docs: results.length,
        sources: sources.length > 0 ? sources : undefined,
      };
    } catch (err) {
      console.error('[QdrantRagProvider] Retrieval error:', err);
      // Return empty results on error (don't fail the request)
      return {
        context: '',
        docs: 0,
        sources: [],
      };
    }
  }

  /**
   * Initialize collection and seed with demo documents
   * Call this once during setup
   */
  async initialize(seedDocuments?: Array<{ id: string; text: string; source?: string }>): Promise<void> {
    try {
      const exists = await this.client.collectionExists();
      if (!exists) {
        console.log('[QdrantRagProvider] Creating collection...');
        await this.client.createCollection(384);
      }

      if (seedDocuments && seedDocuments.length > 0) {
        console.log(`[QdrantRagProvider] Seeding ${seedDocuments.length} documents...`);
        await this.client.upsertPoints(
          seedDocuments.map((doc) => ({
            id: doc.id,
            payload: {
              text: doc.text,
              source: doc.source,
            },
          }))
        );
        console.log('[QdrantRagProvider] Seeding complete');
      }
    } catch (err) {
      console.error('[QdrantRagProvider] Initialization error:', err);
      throw err;
    }
  }
}
