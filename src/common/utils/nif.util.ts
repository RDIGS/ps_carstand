// Algoritmo de checksum oficial do NIF português (secção 21).
export function isValidNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false;

  const digits = nif.split('').map(Number);
  const checkDigit = digits[8];

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += digits[i] * (9 - i);
  }

  const remainder = sum % 11;
  const expected = remainder < 2 ? 0 : 11 - remainder;

  return expected === checkDigit;
}
