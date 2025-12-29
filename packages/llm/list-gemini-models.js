const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');

// Load .env from project root (2 levels up from packages/llm)
// packages/llm -> packages -> root
const envPath = path.resolve(__dirname, '../../.env');
console.log('Loading .env from:', envPath);
console.log('File exists:', fs.existsSync(envPath));

// Try loading with dotenv
const dotenvResult = require('dotenv').config({ path: envPath });
console.log('Dotenv loaded keys:', dotenvResult.parsed ? Object.keys(dotenvResult.parsed).length : 0);

// Also try reading from process.env directly (in case it's already set)
let apiKey = process.env.GEMINI_API_KEY;

// If not found, try reading the file directly as fallback
if (!apiKey) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^GEMINI_API_KEY=(.+)$/m);
    if (match) {
      apiKey = match[1].trim();
      console.log('✅ Loaded API key from file directly');
    }
  } catch (err) {
    // Ignore
  }
}

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found in .env');
  console.error('Tried path:', envPath);
  process.exit(1);
}

console.log('✅ API Key loaded:', apiKey.substring(0, 15) + '...\n');

const genAI = new GoogleGenerativeAI(apiKey);

// Use the fetch API directly to call the models endpoint
// The SDK might not expose listModels, so we'll call the REST API directly
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

fetch(apiUrl)
  .then(res => res.json())
  .then(data => {
    // Handle the response structure
    const modelsList = data.models || [];
    const models = modelsList.filter(m => 
      m.supportedGenerationMethods && 
      m.supportedGenerationMethods.includes('generateContent')
    );
    
    if (models.length === 0) {
      console.log('❌ No models found that support generateContent');
      process.exit(1);
    }
    
    console.log(`✅ Found ${models.length} available model(s) that support generateContent:\n`);
    const modelIds = [];
    models.forEach((m, i) => {
      const modelId = m.name.split('/').pop() || m.name;
      modelIds.push(modelId);
      console.log(`${i + 1}. ${modelId}`);
      console.log(`   Full name: ${m.name}`);
      console.log(`   Display: ${m.displayName || 'N/A'}`);
      console.log(`   Methods: ${m.supportedGenerationMethods?.join(', ') || 'N/A'}`);
      console.log('');
    });
    
    console.log(`💡 Suggested model ID: "${modelIds[0]}"`);
    console.log(`\n📝 Available model IDs for your code:`);
    console.log(`   ${modelIds.map(id => `'${id}'`).join(' | ')}`);
  })
  .catch(err => {
    console.error('❌ Error listing models:', err.message);
    if (err.message.includes('API_KEY_INVALID')) {
      console.error('\n⚠️  Your API key appears to be invalid.');
    }
    process.exit(1);
  });
