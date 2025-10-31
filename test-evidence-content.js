process.env.STRICT_EVIDENCE_MODE = '1';

import { getEvidenceByPointer } from './dist/rag/evidenceStore.js';

async function test() {
  try {
    console.log('Getting full content of generated evidence...');
    const record = await getEvidenceByPointer('ev://generated/gen_b0e7bf48-bed4-4515-8764-fb795e3be02c#p0?v=d9635e56c7ffa10d549abe8b0f289f16b3475dddea01f0c4e3074871807d3a72');
    console.log('Full evidence record:', JSON.stringify(record, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
}

test();
