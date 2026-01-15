
export function formatCurrency(amount, currency = 'BRL') {
    if (currency === 'GBP') {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}

export function getCurrencySymbol(isBrazil = true) {
    return isBrazil ? 'R$' : '£';
}
