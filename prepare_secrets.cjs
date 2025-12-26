
const fs = require('fs');
const path = 'c:\\Users\\monte\\Downloads\\penny-wendell-firebase-adminsdk-fbsvc-36573af991.json';

try {
  const content = fs.readFileSync(path, 'utf8');
  const minified = JSON.stringify(JSON.parse(content));
  console.log(minified);
} catch (err) {
  console.error(err);
}
