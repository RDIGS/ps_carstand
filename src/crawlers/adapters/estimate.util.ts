// Partilhado entre adaptadores (secção 6.6 — cada adaptador é independente,
// mas a lógica de "que anúncios contam como comparáveis" e "como resumir o
// preço" é a mesma em todos, por isso vive aqui em vez de duplicada.
//
// Descoberto ao testar contra dados reais (2026-07-17): uma janela de ano
// demasiado larga (±2) pode, com amostras pequenas de 1 página, atravessar
// uma mudança de geração do modelo (ex.: BMW Série 3 F30→G20 em 2019) e
// enviesar a média para cima ou para baixo sem aviso. A resposta não é só
// apertar a janela — é também aumentar a amostra (múltiplas páginas) e usar
// estatística mais resistente a outliers (mediana, e min/max aparados).
export interface ComparavelBase {
  ano?: number;
  kms?: number;
  preco?: number;
}

const MIN_AMOSTRA_TIER = 5;

/**
 * Escolhe o subconjunto mais preciso que ainda tenha amostra suficiente —
 * ano+kms, depois só ano, depois tudo. `janelaAmpliada` salta o tier mais
 * apertado (ano±1 & kms±30k) e vai logo a ano±2 — usado quando o utilizador
 * pede explicitamente uma amostra maior (secção 6, risco de mudança de
 * geração do modelo).
 */
export function selecionarComparaveis<T extends ComparavelBase>(
  candidatos: T[],
  anoAlvo?: number,
  kmsAlvo?: number,
  janelaAmpliada = false,
): T[] {
  if (anoAlvo && kmsAlvo && !janelaAmpliada) {
    const maisPrecisos = candidatos.filter(
      (c) => c.ano !== undefined && Math.abs(c.ano - anoAlvo) <= 1 && c.kms !== undefined && Math.abs(c.kms - kmsAlvo) <= 30_000,
    );
    if (maisPrecisos.length >= MIN_AMOSTRA_TIER) return maisPrecisos;
  }
  if (anoAlvo) {
    const porAno = candidatos.filter((c) => c.ano !== undefined && Math.abs(c.ano - anoAlvo) <= 2);
    if (porAno.length >= MIN_AMOSTRA_TIER) return porAno;
  }
  return candidatos;
}

const TAMANHO_AMOSTRA_VISIVEL = 5;

/**
 * Seleciona uma amostra pequena e representativa dos comparáveis (mais
 * próximos da mediana primeiro) para mostrar ao utilizador na app — nunca os
 * 30-50 anúncios todos, só o suficiente para ele confirmar a estimativa de
 * relance.
 */
export function amostraVisivel<T extends ComparavelBase>(candidatos: T[], mediana: number): T[] {
  return [...candidatos]
    .filter((c): c is T & { preco: number } => typeof c.preco === 'number' && c.preco > 0)
    .sort((a, b) => Math.abs(a.preco - mediana) - Math.abs(b.preco - mediana))
    .slice(0, TAMANHO_AMOSTRA_VISIVEL);
}

export interface EstatisticasPreco {
  precoMedio: number;
  precoMin: number;
  precoMax: number;
}

/**
 * Mediana em vez de média (resiste melhor a 1-2 anúncios muito fora da
 * curva); min/max aparados aos percentis 10/90 quando há amostra para isso
 * (>=8), para o "min"/"max" mostrados não seja só o outlier mais extremo.
 */
export function estatisticasDePreco(precos: number[]): EstatisticasPreco | null {
  if (precos.length === 0) return null;
  const ordenados = [...precos].sort((a, b) => a - b);
  const n = ordenados.length;

  const meio = Math.floor(n / 2);
  const mediana = n % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];

  let aparados = ordenados;
  if (n >= 8) {
    const corte = Math.floor(n * 0.1);
    aparados = ordenados.slice(corte, n - corte);
  }

  return {
    precoMedio: Math.round(mediana),
    precoMin: aparados[0],
    precoMax: aparados[aparados.length - 1],
  };
}
