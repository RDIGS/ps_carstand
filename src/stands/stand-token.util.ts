import { randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0/I/1, evita confusão ao digitar

function randomBlock(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

// Formato "PSCS-8F2A-91KX" (exemplo da secção 13).
export function generateStandToken(): string {
  return `PSCS-${randomBlock(4)}-${randomBlock(4)}`;
}
