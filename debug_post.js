
import https from 'https';

const hostname = 'penny-finance-backend.fly.dev';

const data = JSON.stringify({
  entry: [{ changes: [{ value: { messages: [{ 
    from: "5511999999999", 
    type: "text", 
    text: { body: "Debug: Spent 25 reais on lunch" },
    timestamp: Date.now() / 1000
  }], 
  metadata: { phone_number_id: "12345" } 
  } }] }]
});

const options = {
  hostname,
  path: '/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log(`📨 Sending Debug POST to https://${hostname}/webhook`);

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(`BODY: ${body}`));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
