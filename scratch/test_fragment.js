const https = require('https');

function callFragmentApi(endpoint, body) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.FRAGMENT_API_KEY || 'b66c0e21a8b6a2d76c9861550e7c0349c1ece0b2';
    const payload = JSON.stringify(body);

    const options = {
      hostname: 'fragment-api.uz',
      port: 443,
      path: `/api/v1/${endpoint.replace(/^\//, '')}`,
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Fragment API timeout' });
    });
    req.write(payload);
    req.end();
  });
}

async function test() {
  console.log('Testing Fragment API...');
  const res = await callFragmentApi('stars/buy', { username: 'cofeature', amount: 50 });
  console.log('Fragment API result:', res);
}

test();
