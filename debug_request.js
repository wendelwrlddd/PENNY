
import https from 'https';

const data = JSON.stringify({
  entry: [{
    changes: [{
      value: {
        messages: [{
          from: "5511999999999",
          type: "text",
          text: {
            body: "Spent 15 pounds on pizza"
          }
        }]
      }
    }]
  }]
});

const options = {
  hostname: 'penny-finances.vercel.app',
  path: '/api/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
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
