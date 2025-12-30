// packages/rag/src/qdrant/qdrant.client.ts

/**
 * Qdrant client wrapper for RAG operations
 * Simple HTTP client for Qdrant REST API
 */

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'traceforge_demo';

export interface QdrantPoint {
  id: string | number;
  vector?: number[]; // Optional for now (using metadata filtering)
  payload: {
    text: string;
    source?: string;
    [key: string]: any;
  };
}

export interface QdrantSearchResult {
  id: string | number;
  score: number;
  payload: {
    text: string;
    source?: string;
    [key: string]: any;
  };
}

export class QdrantClient {
  private baseUrl: string;
  private collectionName: string;

  constructor(baseUrl: string = QDRANT_URL, collectionName: string = COLLECTION_NAME) {
    this.baseUrl = baseUrl;
    this.collectionName = collectionName;
  }

  /**
   * Check if collection exists
   */
  async collectionExists(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}`);
      return response.ok;
    } catch (err) {
      return false;
    }
  }

  /**
   * Create collection with specified vector size
   */
  async createCollection(vectorSize: number = 384): Promise<void> {
    const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create collection: ${error}`);
    }
  }

  /**
   * Upsert points (documents) into collection
   */
  async upsertPoints(points: QdrantPoint[]): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/collections/${this.collectionName}/points`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: points.map((p) => {
            // Convert string IDs to integers (Qdrant requires integer or UUID)
            const pointId = typeof p.id === 'string' ? parseInt(p.id, 10) : p.id;
            return {
              id: pointId,
              vector: p.vector || Array(384).fill(0), // Dummy vector (384 dimensions)
              payload: p.payload,
            };
          }),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upsert points: ${error}`);
    }
  }

  /**
   * Search using keyword matching in payload.text (simple approach for Phase 1.2)
   * Returns top_k results sorted by relevance
   */
  async searchByKeyword(query: string, topK: number = 5): Promise<QdrantSearchResult[]> {
    // For Phase 1.2, we use scroll with filtering to find documents containing query keywords
    // This is a simple keyword-based approach (no embeddings yet)
    
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    // Scroll all points and filter by keyword match
    const scrollResponse = await fetch(
      `${this.baseUrl}/collections/${this.collectionName}/points/scroll`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: 100, // Get all points (we only have 20 docs)
          with_payload: true,
        }),
      }
    );

    if (!scrollResponse.ok) {
      const error = await scrollResponse.text();
      throw new Error(`Failed to scroll points: ${error}`);
    }

    const scrollData = await scrollResponse.json();
    const allPoints = scrollData.result.points || [];

    // Score points by keyword matches
    const scored: Array<{ point: any; score: number }> = allPoints.map((point: any) => {
      const text = (point.payload?.text || '').toLowerCase();
      let score = 0;

      // Count keyword matches
      for (const word of queryWords) {
        if (text.includes(word)) {
          score += 1;
        }
      }

      // Boost if query appears as phrase
      if (text.includes(queryLower)) {
        score += 2;
      }

      return { point, score };
    });

    // Sort by score (descending) and take top_k
    const topResults = scored
      .filter(item => item.score > 0) // Only return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => ({
        id: typeof item.point.id === 'string' ? parseInt(item.point.id, 10) : item.point.id,
        score: item.score,
        payload: item.point.payload,
      }));

    return topResults;
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/collections/${this.collectionName}`);
    if (!response.ok) {
      throw new Error(`Failed to get collection info: ${response.statusText}`);
    }
    return response.json();
  }
}
