
const { spawn } = require('child_process');
const fs = require('fs');

const serviceAccountPath = 'c:\\Users\\monte\\Downloads\\penny-wendell-firebase-adminsdk-fbsvc-36573af991.json';
const geminiKey = 'AIzaSyDX5LNxo8d1kLeQFIeviCCt1lX8IVSu4s8';
const projectId = 'penny-wendell';

try {
  const content = fs.readFileSync(serviceAccountPath, 'utf8');
  const minified = JSON.stringify(JSON.parse(content));

  const secretPayload = `GEMINI_API_KEY=${geminiKey}\nFIREBASE_PROJECT_ID=${projectId}\nFIREBASE_SERVICE_ACCOUNT=${minified}`;

  console.log('Piping secrets to fly secrets import...');

  // spawn without shell: true to avoid quoting hell, but we are piping to stdin anyway
  const child = spawn('fly', ['secrets', 'import'], { 
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true // Need shell to find 'fly' in path usually on windows, but correct usage is stdin
  });

  child.stdin.write(secretPayload);
  child.stdin.end();

  child.on('close', (code) => {
    console.log(`fly secrets import exited with code ${code}`);
  });

} catch (err) {
  console.error(err);
}
