import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));

const configuredAppPath = process.argv[2];
const appPath = configuredAppPath
  ? path.resolve(process.cwd(), configuredAppPath)
  : path.join(
      projectRoot,
      'release',
      `studio-${packageJson.version}`,
      'mac-arm64',
      'Film-one Studio.app',
    );

const ffmpegVersion = packageJson.dependencies?.['ffmpeg-static'];
if (typeof ffmpegVersion !== 'string' || ffmpegVersion.length === 0) {
  throw new Error('ffmpeg-static must be declared in dependencies for packaged runtime use.');
}

const resourcesPath = path.join(appPath, 'Contents', 'Resources');
const unpackedModulePath = path.join(
  resourcesPath,
  'app.asar.unpacked',
  'node_modules',
  'ffmpeg-static',
);
const codexMarketplacePath = path.join(resourcesPath, 'codex-marketplace');
const codexPluginPath = path.join(codexMarketplacePath, 'plugins', 'film-one');
const unpackedBetterSqlitePath = path.join(
  resourcesPath,
  'app.asar.unpacked',
  'node_modules',
  'better-sqlite3',
);
const studioExecutablePath = path.join(appPath, 'Contents', 'MacOS', 'Film-one Studio');

await access(path.join(resourcesPath, 'app.asar'), constants.R_OK);
await access(path.join(unpackedModulePath, 'index.js'), constants.R_OK);
await access(path.join(unpackedModulePath, 'package.json'), constants.R_OK);
await access(path.join(unpackedModulePath, 'ffmpeg'), constants.R_OK | constants.X_OK);
await access(
  path.join(codexMarketplacePath, '.agents', 'plugins', 'marketplace.json'),
  constants.R_OK,
);
await access(path.join(codexPluginPath, '.codex-plugin', 'plugin.json'), constants.R_OK);
await access(path.join(codexPluginPath, '.mcp.json'), constants.R_OK);
await access(path.join(codexPluginPath, 'scripts', 'film-one-mcp.mjs'), constants.R_OK);
await access(path.join(codexPluginPath, 'skills', 'film-one-media', 'SKILL.md'), constants.R_OK);
await access(
  path.join(codexPluginPath, 'skills', 'film-one-production', 'SKILL.md'),
  constants.R_OK,
);
await access(path.join(unpackedBetterSqlitePath, 'package.json'), constants.R_OK);
await execFileAsync(
  studioExecutablePath,
  ['-e', `new (require(${JSON.stringify(unpackedBetterSqlitePath)}))(':memory:').close();`],
  {
    timeout: 10_000,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_PATH: path.join(resourcesPath, 'app.asar', 'node_modules'),
    },
  },
);

console.log(`[package:studio] verified packaged ffmpeg-static at ${unpackedModulePath}`);
console.log(`[package:studio] verified packaged Codex plugin at ${codexPluginPath}`);
console.log('[package:studio] verified packaged Electron can load better-sqlite3');

// Check the assistant's actual distributed dependencies, not only build-time imports.
const workerPath = path.join(resourcesPath, 'app.asar', 'scripts', 'assistant', 'worker.mjs');
await execFileAsync(studioExecutablePath, ['-e', `
  const fs = require('node:fs');
  const { createServer } = require('node:http');
  const { fork } = require('node:child_process');
  const workerPath = ${JSON.stringify(workerPath)};
  fs.accessSync(workerPath);
  let worker;
  const timer = setTimeout(() => { worker?.kill(); process.exit(1); }, 12000);
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const names = parsed.tools.map(tool => tool.function.name);
        if (parsed.model !== 'deepseek-flash' || names.length !== 18 || !names.includes('read_media_review')) throw new Error('Missing packaged tools');
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Local package verification complete' } }));
        clearTimeout(timer); worker.kill(); server.close();
      } catch { worker?.kill(); process.exit(1); }
    });
  });
  server.listen(0, '127.0.0.1', () => {
    worker = fork(workerPath, [], { execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    worker.on('error', () => process.exit(1));
    worker.send({ type: 'start', endpoint: 'http://127.0.0.1:' + server.address().port + '/chat/completions', protocol: 'chat', model: 'deepseek-flash', vision: true, key: 'package-fixture', systemPrompt: 'Local package check.', prompt: 'List tools.' });
  });
`], {
  timeout: 15000,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_PATH: path.join(resourcesPath, 'app.asar', 'node_modules') },
});
console.log('[package:studio] verified actual packaged assistant worker with 18 tools (local fixture only)');
