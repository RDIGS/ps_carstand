// Cobre formato atual e anteriores a 2020 — 3 blocos de 2, cada um letras OU números (secção 21).
export const MATRICULA_REGEX = /^[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}$/;

export function isValidMatricula(matricula: string): boolean {
  return MATRICULA_REGEX.test(matricula);
}
