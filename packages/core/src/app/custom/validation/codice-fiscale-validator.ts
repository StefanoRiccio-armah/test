import CodiceFiscale from "codice-fiscale-js";

const CODICE_FISCALE_REGEX = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;

export const CODICE_FISCALE_ERROR =
  "Codice Fiscale non valido. Formato: RSSMRA90A01H501U (16 caratteri)";

export const PARTITA_IVA_ERROR = "Partita IVA non valida. Deve contenere 11 cifre.";

 export const errorMessages = {
            it: {
                INVOICE_REQUIRED_MESSAGE: 'Inserire la Partita IVA o il Codice Fiscale.',
                CF_ERROR: 'Il Codice Fiscale non è valido',
                PIVA_ERROR: 'La Partita IVA non è valida',
            },
            en: {
                INVOICE_REQUIRED_MESSAGE: 'Please enter your VAT number or Fiscal Code.',
                CF_ERROR: 'The Fiscal Code is not valid',
                PIVA_ERROR: 'The VAT number is not valid',
            },
        };

/**
 * Controlla se il Codice Fiscale è valido
 * Include:
 * - Controllo formato (16 caratteri alfanumerici)
 * - Verifica carattere di controllo e validità complessiva
 *
 * @param codiceFiscale - Stringa da validare
 * @returns true se valido, false altrimenti
 */
export function isCodiceFiscaleValid(codiceFiscale?: string): boolean {
  if (!codiceFiscale || codiceFiscale.trim() === "") {
    return true; // Yup .required() gestisce il vuoto
  }

  const cleaned = codiceFiscale.trim().toUpperCase();

  // 1. Controllo formato base
  if (!CODICE_FISCALE_REGEX.test(cleaned)) {
    return false;
  }

  try {
    // 2. Verifica carattere di controllo e validità complessiva
    return CodiceFiscale.check(cleaned);
  } catch {
    return false;
  }
}

/**
 * Controlla se la Partita IVA è valida
 * Include:
 * - Controllo formato (11 cifre)
 * - Verifica algoritmo checksum (Luhn modificato)
 *
 * @param partitaIva - Stringa da validare
 * @returns true se valido, false altrimenti
 */
const PARTITA_IVA_REGEX = /^(IT|it)?[0-9]{11}$/;

/**
 * Controlla se la Partita IVA è valida
 * Include:
 * - Controllo formato (11 cifre, con "IT" opzionale)
 * - Verifica algoritmo checksum (Luhn modificato)
 *
 * @param partitaIva - Stringa da validare
 * @returns true se valido, false altrimenti
 */
export function isPartitaIvaValid(partitaIva?: string): boolean {
  if (!partitaIva || partitaIva.trim() === "") {
    return true; // Yup .required() gestisce il vuoto
  }

  const trimmed = partitaIva.trim();

  // 1. Controllo formato base con la nuova regex
  if (!PARTITA_IVA_REGEX.test(trimmed)) {
    return false;
  }

  // Rimuove il prefisso "IT" se presente per il calcolo del checksum
  const cleaned = trimmed.replace(/^(IT|it)/, '');

  // 2. Algoritmo di checksum per P.IVA italiana (invariato)
  let sum = 0;

  for (let i = 0; i < 11; i++) {
    let digit = parseInt(cleaned[i], 10);

    if (i % 2 === 0) {
      // Posizioni pari (0,2,4,6,8,10): somma diretta
      sum += digit;
    } else {
      // Posizioni dispari (1,3,5,7,9): moltiplica per 2 e somma le cifre
      let doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }

  // La P.IVA è valida se la somma è divisibile per 10
  return sum % 10 === 0;
}

/**
 * Normalizza il Codice Fiscale (uppercase, trim)
 *
 * @param codiceFiscale - Stringa da normalizzare
 * @returns Codice Fiscale normalizzato
 */
export function normalizeCodiceFiscale(codiceFiscale: string): string {
  return codiceFiscale.trim().toUpperCase();
}

/**
 * Estrae informazioni dal Codice Fiscale (se valido)
 *
 * @param codiceFiscale - Codice Fiscale da analizzare
 * @returns Oggetto con dati estratti o null se non valido
 */
export function parseCodiceFiscale(codiceFiscale: string): {
  nome: string;
  cognome: string;
  sesso: "M" | "F";
  annoNascita: number;
  meseNascita: number;
  giornoNascita: number;
  luogoNascita: string;
} | null {
  if (!isCodiceFiscaleValid(codiceFiscale)) {
    return null;
  }

  try {
    const cf = new CodiceFiscale(codiceFiscale.trim().toUpperCase());
    return {
      nome: cf.name,
      cognome: cf.surname,
      sesso: cf.gender,
      annoNascita: cf.birthday.getFullYear(),
      meseNascita: cf.birthday.getMonth() + 1,
      giornoNascita: cf.birthday.getDate(),
      luogoNascita: cf.birthplace.nome,
    };
  } catch {
    return null;
  }
}

export function isCodiceFiscaleOrPartitaIvaValid(value?: string): boolean {
    if (!value || value.trim() === '') {
        // Lascia che la regola .required() di Yup gestisca i campi vuoti.
        return true;
    }

    return isCodiceFiscaleValid(value) || isPartitaIvaValid(value);
}
