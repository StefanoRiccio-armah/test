import { Cart } from "@bigcommerce/checkout-sdk";

export function checkMinsan(value: string | null): boolean {
    if (!value) return false;

    // Se nello SKU c'è la parola "minsan", la rimuove
    const cleaned = value.replace(/minsan/i, '').trim();

    return cleaned.startsWith('0') || cleaned.startsWith('8');
}

// Controlla l'intero carrello usando lo SKU
export function hasDeductibleProduct(cart: Cart | undefined): boolean {
    if (!cart) {
        return false;
    }

    return cart.lineItems.physicalItems.some(item => {
        return checkMinsan(item.sku ?? null);
    });
}