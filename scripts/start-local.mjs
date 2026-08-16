import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const projectRoot = process.cwd();

function killIfRunning(pattern) {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-lc', `pkill -f "${pattern}" || true`], {
      stdio: 'inherit',
      cwd: projectRoot,
    });
    child.on('exit', () => resolve());
  });
}

async function waitForWorker(url, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry until ready
    }
    await delay(1000);
  }
  throw new Error('Worker did not become ready in time');
}

async function main() {
  await killIfRunning('vite --host 0.0.0.0');
  await killIfRunning('wrangler dev worker/src/index.ts');

  const worker = spawn('npm', ['run', 'worker:dev'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env },
  });

  try {
    await waitForWorker('http://127.0.0.1:8788/api/health');
    const frontend = spawn('npm', ['run', 'start:frontend'], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env },
    });

    frontend.on('exit', (code) => {
      process.exit(code ?? 0);
    });

    const shutdown = () => {
      worker.kill('SIGINT');
      frontend.kill('SIGINT');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await new Promise(() => {});
  } catch (error) {
    worker.kill('SIGINT');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
