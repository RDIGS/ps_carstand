import { randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0/I/1, evita confusão ao digitar

function randomBlock(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

// Código curto para o dono repor a password sem link/email (secção 29):
// gerado pelo super-admin, partilhado por fora da app, introduzido pelo
// dono no ecrã de login. Mesmo alfabeto do token de stand (stand-token.util.ts).
export function generatePasswordResetCode(): string {
  return `${randomBlock(4)}-${randomBlock(4)}`;
}
