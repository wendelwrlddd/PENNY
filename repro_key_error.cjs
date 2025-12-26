
const admin = require('firebase-admin');
const fs = require('fs');

const path = 'c:\\Users\\monte\\Downloads\\penny-wendell-firebase-adminsdk-fbsvc-36573af991.json';
const content = fs.readFileSync(path, 'utf8');

// Mimic what I sent to Fly: JSON.stringify(JSON.parse(content))
const jsonString = JSON.stringify(JSON.parse(content));

// Simulate Env Var
process.env.FIREBASE_SERVICE_ACCOUNT = jsonString;

console.log('--- START REPRO ---');
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log('JSON Parsed.');
  
  if (serviceAccount.private_key) {
      console.log('Key length:', serviceAccount.private_key.length);
      console.log('Key includes \\n (literal):', serviceAccount.private_key.includes('\\n'));
      console.log('Key includes \\n (control):', serviceAccount.private_key.includes('\n'));
      
      // Simulate my code fix
      if (serviceAccount.private_key.includes('\\n')) {
          console.log('Fixing literal n');
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      
      console.log('Final Key Last 20:', JSON.stringify(serviceAccount.private_key.slice(-20)));
  }

  admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Success! Initialized.');
} catch (e) {
  console.error('❌ Failed:', e.message);
  // console.error(e);
}
