/**
 * Validazioni per il Codice Fiscale italiano
 */

/**
 * Regex per Codice Fiscale italiano
 * Formato: 6 lettere + 2 cifre + 1 lettera + 2 cifre + 1 lettera + 3 cifre + 1 lettera
 * Totale: 16 caratteri
 * Esempio: RSSMRA90A01H501U
 */
const CODICE_FISCALE_REGEX = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i;

/**
 * Regex alternativa per P.IVA italiana (11 cifre)
 * Formato: 11 cifre
 * Esempio: 12345678901
 */
const PARTITA_IVA_REGEX = /^[0-9]{11}$/;

/**
 * Controlla se il codice fiscale è valido
 * @param codiceFiscale - Stringa da validare
 * @returns true se valido, false altrimenti
 */
export function isCodiceFiscaleValid(codiceFiscale: string): boolean {
    if (!codiceFiscale) return false;
    
    const cleaned = codiceFiscale.trim().toUpperCase();
    return CODICE_FISCALE_REGEX.test(cleaned);
}

/**
 * Controlla se la P.IVA è valida (formato base)
 * @param partitaIva - Stringa da validare
 * @returns true se valido, false altrimenti
 */
export function isPartitaIvaValid(partitaIva: string): boolean {
    if (!partitaIva) return false;
    
    const cleaned = partitaIva.trim();
    return PARTITA_IVA_REGEX.test(cleaned);
}

/**
 * Normalizza il Codice Fiscale (uppercase, trim)
 * @param codiceFiscale - Stringa da normalizzare
 * @returns Codice Fiscale normalizzato
 */
export function normalizeCodiceFiscale(codiceFiscale: string): string {
    return codiceFiscale.trim().toUpperCase();
}

/**
 * Messaggio di errore per validazione Codice Fiscale
 */
export const CODICE_FISCALE_ERROR = 'Codice Fiscale non valido. Formato: RSSMRA90A01H501U (16 caratteri)';

/**
 * Messaggio di errore per validazione P.IVA
 */
export const PARTITA_IVA_ERROR = 'Partita IVA non valida. Deve contenere 11 cifre.';
