process.env.STRICT_EVIDENCE_MODE = '1';

import { retrieveEvidence } from './dist/tools/retrieveEvidence.js';

async function test() {
  try {
    console.log('Testing retrieveEvidence with real evidence...');
    const result = await retrieveEvidence({
      query: '质数 算法',
      topK: 3
    });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
}

test();
