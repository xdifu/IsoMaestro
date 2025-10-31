process.env.STRICT_EVIDENCE_MODE = '1';

import { executeFullWorkflow } from './dist/tools/executeFullWorkflow.js';

async function test() {
  try {
    console.log('Testing executeFullWorkflow in strict mode...');
    const result = await executeFullWorkflow({
      context: '测试严格模式',
      goal: '如何找到最大的质数'
    });
    console.log('Success:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('Error (expected in strict mode):', error.message);
  }
}

test();
