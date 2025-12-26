
import https from 'https';

const hostname = 'penny-finance-backend.fly.dev';

function testGetVerification() {
  const path = '/webhook?hub.mode=subscribe&hub.verify_token=penny123&hub.challenge=CHALLENGE_ACCEPTED';
  const options = {
    hostname,
    path,
    method: 'GET',
  };

  console.log(`📡 Testing GET Verification: https://${hostname}${path}`);
  
  const req = https.request(options, (res) => {
    console.log(`GET STATUS: ${res.statusCode}`);
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log(`GET BODY: ${body}`));
  });
  
  req.on('error', e => console.error(e));
  req.end();
}

function testPostMessage() {
  const data = JSON.stringify({
    entry: [{ changes: [{ value: { messages: [{ 
      from: "5511999999999", 
      type: "text", 
      text: { body: "Fly.io formatting check: Spent 100 reais on fixing bugs" }
    }] } }] }]
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

  console.log(`\n📨 Testing POST Message...`);

  const req = https.request(options, (res) => {
    console.log(`POST STATUS: ${res.statusCode}`);
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log(`POST BODY: ${body}`));
  });

  req.on('error', e => console.error(e));
  req.write(data);
  req.end();
}

testGetVerification();
// Wait a bit before POST to avoid clutter
setTimeout(testPostMessage, 2000);
