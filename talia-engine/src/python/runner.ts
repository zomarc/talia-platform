import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultScript = path.resolve(here, '../../python/analyze_stub.py');

export type PythonAnalyzeRequest = {
  task: string;
  payload?: Record<string, unknown>;
};

export type PythonAnalyzeResult = {
  available: boolean;
  interpreter: string | null;
  script: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

const interpreters = ['python3', 'python'];

export async function pythonStatus(scriptPath = defaultScript): Promise<{
  available: boolean;
  interpreter: string | null;
  script: string;
}> {
  const interpreter = await resolveInterpreter();
  return {
    available: Boolean(interpreter) && existsSync(scriptPath),
    interpreter,
    script: scriptPath,
  };
}

export async function runPythonAnalyze(
  request: PythonAnalyzeRequest,
  scriptPath = defaultScript
): Promise<PythonAnalyzeResult> {
  const interpreter = await resolveInterpreter();
  if (!interpreter) {
    return {
      available: false,
      interpreter: null,
      script: scriptPath,
      ok: false,
      error: 'No python3 interpreter on PATH',
    };
  }
  if (!existsSync(scriptPath)) {
    return {
      available: false,
      interpreter,
      script: scriptPath,
      ok: false,
      error: `Python element missing: ${scriptPath}`,
    };
  }

  return new Promise((resolve) => {
    const child = spawn(interpreter, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', (error) => {
      resolve({
        available: true,
        interpreter,
        script: scriptPath,
        ok: false,
        error: error.message,
      });
    });
    child.on('close', (code) => {
      if (code !== 0) {
        resolve({
          available: true,
          interpreter,
          script: scriptPath,
          ok: false,
          error: stderr.trim() || `python exited ${code}`,
        });
        return;
      }
      try {
        resolve({
          available: true,
          interpreter,
          script: scriptPath,
          ok: true,
          result: JSON.parse(stdout || '{}'),
        });
      } catch (error: any) {
        resolve({
          available: true,
          interpreter,
          script: scriptPath,
          ok: false,
          error: error?.message || 'invalid python JSON',
        });
      }
    });
    child.stdin.write(JSON.stringify(request));
    child.stdin.end();
  });
}

async function resolveInterpreter(): Promise<string | null> {
  for (const name of interpreters) {
    const found = await new Promise<boolean>((resolve) => {
      const child = spawn(name, ['--version'], { stdio: 'ignore' });
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    });
    if (found) return name;
  }
  return null;
}
