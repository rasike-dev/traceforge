// packages/rag/src/qdrant/seed.ts
// Script to seed Qdrant with demo documents

import 'dotenv/config';
import { QdrantRagProvider } from './qdrant.provider';
import { DEMO_DOCUMENTS } from './seed-docs';

async function main() {
  console.log('🌱 Seeding Qdrant with demo documents...\n');

  const provider = new QdrantRagProvider(
    process.env.QDRANT_URL || 'http://localhost:6333',
    process.env.QDRANT_COLLECTION || 'traceforge_demo'
  );

  try {
    await provider.initialize(DEMO_DOCUMENTS);
    console.log('\n✅ Seeding complete!');
    console.log(`   - Collection: ${process.env.QDRANT_COLLECTION || 'traceforge_demo'}`);
    console.log(`   - Documents: ${DEMO_DOCUMENTS.length}`);
    console.log(`   - Qdrant URL: ${process.env.QDRANT_URL || 'http://localhost:6333'}`);
  } catch (err) {
    console.error('\n❌ Seeding failed:', err);
    process.exit(1);
  }
}

main();
