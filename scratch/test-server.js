const { spawn } = require('child_process');
const http = require('http');

const nextProc = spawn('npx.cmd', ['next', 'start', '-p', '3009'], {
  cwd: 'd:\\Printess\\printflow',
  shell: true,
  stdio: 'inherit'
});

setTimeout(() => {
  http.get('http://localhost:3009/login', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('HTTP Status:', res.statusCode);
      http.get('http://localhost:3009/_next/static/chunks/1yisn200_eb_8.css', (cssRes) => {
        console.log('CSS HTTP Status:', cssRes.statusCode);
        console.log('CSS Content-Type:', cssRes.headers['content-type']);
        let cssData = '';
        cssRes.on('data', chunk => cssData += chunk);
        cssRes.on('end', () => {
          console.log('CSS Length:', cssData.length);
          nextProc.kill('SIGKILL');
          process.exit(0);
        });
      });
    });
  }).on('error', (err) => {
    console.error('Fetch error:', err.message);
    nextProc.kill('SIGKILL');
    process.exit(1);
  });
}, 4000);
