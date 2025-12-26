
import https from 'https';

const data = JSON.stringify({
  entry: [{
    changes: [{
      value: {
        messages: [{
          from: "5511999999999",
          type: "text",
          text: {
            body: "Fly.io test: Spent 77 pounds on cloud hosting"
          },
          timestamp: Date.now() / 1000
        }],
        metadata: {
          phone_number_id: "123456789"
        }
      }
    }]
  }]
});

const options = {
  hostname: 'penny-finance-backend.fly.dev',
  path: '/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log(`Sending test request to https://${options.hostname}${options.path}...`);

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('BODY:', body);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
