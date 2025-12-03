import { Cart } from "@bigcommerce/checkout-sdk";

export function checkMinsan(minsan: string | null): boolean {
    if (!minsan) return false;
    // Rimuove la parola "minsan" e spazi, se presenti
    const value = minsan.replace(/minsan/i, '').trim();
    return value.startsWith('0') || value.startsWith('8');
}

// Nuova funzione che ispeziona l'intero carrello
export function hasDeductibleProduct(cart: Cart | undefined): boolean {
    if (!cart) {
        return false;
    }

    // Itera su tutti gli articoli fisici nel carrello
    return cart.lineItems.physicalItems.some(item => {
        // Controlla se l'articolo ha delle opzioni
        if (!item.options || item.options.length === 0) {
            return false;
        }

        // Cerca l'opzione che si chiama 'MINSAN' (o come si chiama nel tuo store)
        const minsanOption = item.options.find(option => option.name.toLowerCase() === 'minsan');
        
        if (minsanOption) {
            return checkMinsan(minsanOption.value.toString());
        }

        return false;
    });
}