
const { spawn } = require('child_process');
const fs = require('fs');

const serviceAccountPath = 'c:\\Users\\monte\\Downloads\\penny-wendell-firebase-adminsdk-fbsvc-36573af991.json';
const geminiKey = process.env.GEMINI_API_KEY;
const projectId = 'penny-wendell';

try {
  const content = fs.readFileSync(serviceAccountPath, 'utf8');
  // Minify JSON
  const minified = JSON.stringify(JSON.parse(content));

  console.log('Setting secrets via flyctl...');

  const args = [
    'secrets',
    'set',
    `GEMINI_API_KEY=${geminiKey}`,
    `FIREBASE_PROJECT_ID=${projectId}`,
    `FIREBASE_SERVICE_ACCOUNT=${minified}`
  ];

  const child = spawn('fly', args, { stdio: 'inherit', shell: true });

  child.on('close', (code) => {
    console.log(`fly secrets set exited with code ${code}`);
  });

} catch (err) {
  console.error(err);
}
