const http = require('http');

function testUrl(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          url,
          statusCode: res.statusCode,
          headers: res.headers,
          dataLength: data.length,
          preview: data.substring(0, 200)
        });
      });
    }).on('error', (err) => {
      resolve({ url, error: err.message });
    });
  });
}

async function run() {
  console.log('Testing endpoints on running server:');
  const r1 = await testUrl('http://localhost:3000/login');
  console.log('Login:', r1.statusCode, `(${r1.dataLength} bytes)`);

  const r2 = await testUrl('http://localhost:3000/print/customer-statement?customer=Collins%20Bale');
  console.log('Customer Statement Print Route:', r2.statusCode, `(${r2.dataLength} bytes)`);
}

run();
