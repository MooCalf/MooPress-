const { spawn } = require('node:child_process');

async function run() {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 5174, strictPort: true, watch: null }, clearScreen: false });
  await server.listen();
  const env = { ...process.env, MOOPRESS_TEST_URL: 'http://127.0.0.1:5174' };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), ['scripts/test-editor.cjs'], { stdio: 'inherit', env, windowsHide: true });
  child.on('close', async (code) => { await server.close(); process.exitCode = code ?? 1; });
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
