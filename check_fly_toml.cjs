const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
    console.log(`\nChecking: ${filePath}`);
    try {
        const buffer = fs.readFileSync(filePath);
        console.log(`Size: ${buffer.length} bytes`);
        
        // Check for BOM
        if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
            console.log('Found UTF-8 BOM');
        } else if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
            console.log('Found UTF-16 LE BOM');
        } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
            console.log('Found UTF-16 BE BOM');
        }

        let hasControl = false;
        for (let i = 0; i < buffer.length; i++) {
            const charCode = buffer[i];
            // Control characters except for \n (10), \r (13), \t (9)
            if (charCode < 32 && charCode !== 10 && charCode !== 13 && charCode !== 9) {
                console.log(`Found control character: 0x${charCode.toString(16)} at index ${i}`);
                hasControl = true;
            }
            // Check for high bits/invalid UTF-8 after ASCII range
            if (charCode > 127) {
                // Not necessarily an error for UTF-8, but good to know
                // console.log(`Found non-ASCII character: 0x${charCode.toString(16)} at index ${i}`);
            }
        }
        
        if (!hasControl) {
            console.log('No control characters found (other than whitespace).');
        }
    } catch (err) {
        console.error(`Error reading file: ${err.message}`);
    }
}

checkFile('fly.toml');
checkFile('evolution-fly/fly.toml');
const globalConfig = path.join(process.env.USERPROFILE, '.fly', 'config.yml');
checkFile(globalConfig);
