process.env.STRICT_EVIDENCE_MODE = '1';

import { generateEvidence } from './dist/tools/generateEvidence.js';

async function test() {
  try {
    console.log('Testing generateEvidence tool...');
    const result = await generateEvidence({
      query: '如何使用最简洁的程序找到最大的质数',
      context: '编程算法',
      maxChars: 1000
    });
    console.log('Generated evidence:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
}

test();
