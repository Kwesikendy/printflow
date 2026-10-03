const { spawn } = require('child_process');
const path = require('path');

const nextBin = path.resolve(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');
const port = process.env.PORT || '3000';

const child = spawn('node', [nextBin, 'start', '-H', '0.0.0.0', '-p', port], {
  stdio: 'inherit',
  env: process.env,
  cwd: __dirname,
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
