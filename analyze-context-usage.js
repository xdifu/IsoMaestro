#!/usr/bin/env node
/**
 * Analyze includeContext usage across sampling calls.
 * Scans src/agents and reports whether planner/translator set includeContext.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...listFiles(p));
    else if (name.isFile() && /\.(ts|js)$/.test(name.name)) out.push(p);
  }
  return out;
}

function analyze() {
  const files = listFiles(join(process.cwd(), 'src', 'agents'));
  const results = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const hasTrySample = /trySampleMessage\s*\(/.test(text);
    const hasInclude = /includeContext\s*:\s*['\"](thisServer|allServers|none)['\"]/.test(text);
    results.push({ file, hasTrySample, hasInclude });
  }
  const summary = {
    analyzed: results.length,
    withSampling: results.filter(r => r.hasTrySample).length,
    withIncludeContext: results.filter(r => r.hasInclude).length,
    missingInclude: results.filter(r => r.hasTrySample && !r.hasInclude).map(r => r.file),
  };
  console.log(JSON.stringify({ results, summary }, null, 2));
}

analyze();

