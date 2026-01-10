const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
console.log(`Updating .env at ${envPath}`);

try {
    let content = fs.readFileSync(envPath, 'utf8');
    
    const updates = {
        'PAYPAL_CLIENT_ID': 'AR85a4m82xZRaD5S5RZu8w69PreIyNDigJIAmY13A6h52wbq3Fo8YGKAHTtdlPwSPW9h0YwipunC5wdz',
        'PAYPAL_SECRET': 'EE2UqASyoLsUzogzI4FfLtlT9XBf1GtpkixVDq9pUczyK2hkHtvz02tolbDaEMOA4SICqk8PGSfX9V4M',
        'VITE_PAYPAL_CLIENT_ID': 'AR85a4m82xZRaD5S5RZu8w69PreIyNDigJIAmY13A6h52wbq3Fo8YGKAHTtdlPwSPW9h0YwipunC5wdz',
        'PAYPAL_MODE': 'live'
    };

    for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*`, 'm');
        if (regex.test(content)) {
            content = content.replace(regex, `${key}=${value}`);
        } else {
            content += `\n${key}=${value}`;
        }
    }

    fs.writeFileSync(envPath, content);
    console.log('✅ .env updated successfully with Live credentials.');

} catch (err) {
    console.error('❌ Error updating .env:', err);
}
