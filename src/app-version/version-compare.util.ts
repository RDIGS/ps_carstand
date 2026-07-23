// Comparação de versão da app (secção 22): só X.Y (major.minor) decide
// bloqueio obrigatório, Z (patch) nunca entra na decisão.
export function parseMajorMinor(versao: string): [number, number] | null {
  const match = versao.trim().match(/^(\d+)\.(\d+)(?:\.\d+)?$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

/** true se `atual` for estritamente inferior a `minima` em (major, minor). */
export function isBelowMinimum(atual: string, minima: string): boolean {
  const atualParsed = parseMajorMinor(atual);
  const minimaParsed = parseMajorMinor(minima);
  if (!atualParsed || !minimaParsed) return false;

  const [majorAtual, minorAtual] = atualParsed;
  const [majorMinimo, minorMinimo] = minimaParsed;

  if (majorAtual !== majorMinimo) return majorAtual < majorMinimo;
  return minorAtual < minorMinimo;
}
