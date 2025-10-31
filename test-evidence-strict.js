process.env.STRICT_EVIDENCE_MODE = '1';

import { retrieveEvidence } from './dist/tools/retrieveEvidence.js';

async function test() {
  try {
    console.log('Testing retrieveEvidence in strict mode...');
    const result = await retrieveEvidence({
      query: 'test query',
      topK: 1
    });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('Error (expected in strict mode):', error.message);
  }
}

test();
