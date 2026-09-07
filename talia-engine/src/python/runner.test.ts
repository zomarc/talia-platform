import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pythonStatus, runPythonAnalyze } from './runner.ts';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../python/analyze_stub.py');

describe('python element runner', () => {
  it('reports stub availability without inventing Findings', async () => {
    const status = await pythonStatus(script);
    if (!status.available) {
      assert.equal(status.available, false);
      return;
    }
    const result = await runPythonAnalyze({ task: 'ping' }, script);
    assert.equal(result.ok, true);
    assert.equal((result.result as any)?.tool, 'analyze_stub');
    assert.equal((result.result as any)?.score, undefined);
  });
});
