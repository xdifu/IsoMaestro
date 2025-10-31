process.env.STRICT_EVIDENCE_MODE = '1';

import { renderWithPointers } from './dist/tools/renderWithPointers.js';

async function test() {
  try {
    console.log('Testing pointer validation...');
    const draft = `### 质数程序
埃拉托斯特尼筛法用于高效寻找质数 [ref:ev://programming/prime_algorithm#p0?v=prime_sieve_v1]
使用Python实现质数查找程序 [ref:ev://programming/python_primes#p0?v=python_primes_v1]`;
    
    const result = await renderWithPointers({ draft });
    console.log('Validation result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
}

test();
