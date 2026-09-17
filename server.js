const { spawn } = require('child_process');
const path = require('path');

const nextBin = path.resolve(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');
const port = process.env.PORT || '3000';

const child = spawn(process.execPath, [nextBin, 'start', '-p', port], {
  stdio: 'inherit',
  env: process.env,
  cwd: __dirname,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
