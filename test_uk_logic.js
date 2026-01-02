function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

function getPreviousWeekRange(now) {
    const start = new Date(now);
    start.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1) - 7); // Previous Monday
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Previous Sunday
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
}

function getCurrentWeekToNowRange(now) {
    const start = new Date(now);
    start.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)); // Current Monday
    start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: now.toISOString() };
}

// Test Cases
const monday = new Date('2026-01-05T09:00:00Z'); // A Monday
console.log('--- TEST: Monday Jan 5th 2026 ---');
console.log('Week Number:', getWeekNumber(monday));
console.log('Prev Week Range:', getPreviousWeekRange(monday));
console.log('Current Week Range:', getCurrentWeekToNowRange(monday));

const sunday = new Date('2026-01-11T21:00:00Z'); // A Sunday
console.log('\n--- TEST: Sunday Jan 11th 2026 ---');
console.log('Week Number:', getWeekNumber(sunday));
console.log('Prev Week Range:', getPreviousWeekRange(sunday));
console.log('Current Week Range:', getCurrentWeekToNowRange(sunday));

// Hourly Calculation Logic
const hourlyRate = 15;
const weeklyHours = 40;
const weeklyIncome = hourlyRate * weeklyHours;
const monthlyIncome = weeklyIncome * 4.33;
console.log('\n--- TEST: Hourly Worker Calculation ---');
console.log('Rate: £15, Hours: 40');
console.log('Weekly Est:', weeklyIncome);
console.log('Monthly Est:', monthlyIncome);

// Payday Logic
function calculateNextPayDate(lastPay, frequency) {
    const date = new Date(lastPay);
    switch (frequency) {
        case 'weekly':
            date.setDate(date.getDate() + 7);
            break;
        case 'biweekly':
            date.setDate(date.getDate() + 14);
            break;
        case 'four_weekly':
            date.setDate(date.getDate() + 28);
            break;
        case 'monthly':
        default:
            date.setMonth(date.getMonth() + 1);
            break;
    }
    return date;
}

const lastPay = new Date('2026-01-02');
console.log('\n--- TEST: Payday Intelligence ---');
console.log('Last Pay: 2026-01-02');
console.log('Next Weekly:', calculateNextPayDate(lastPay, 'weekly').toISOString().split('T')[0]);
console.log('Next Biweekly:', calculateNextPayDate(lastPay, 'biweekly').toISOString().split('T')[0]);
console.log('Next Monthly:', calculateNextPayDate(lastPay, 'monthly').toISOString().split('T')[0]);
