import { mcp_isomaestro_retrieve_evidence } from './dist/index.js';

process.env.STRICT_EVIDENCE_MODE = '1';

async function test() {
  try {
    console.log('Testing retrieve_evidence in strict mode...');
    const result = await mcp_isomaestro_retrieve_evidence({
      query: 'test query',
      topK: 1
    });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('Error (expected in strict mode):', error.message);
  }
}

test();
