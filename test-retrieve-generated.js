process.env.STRICT_EVIDENCE_MODE = '1';

import { retrieveEvidence } from './dist/tools/retrieveEvidence.js';

async function test() {
  try {
    console.log('Retrieving generated evidence...');
    const result = await retrieveEvidence({
      query: '如何找到最大的质数',
      topK: 5
    });
    console.log('Generated evidence:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
}

test();
