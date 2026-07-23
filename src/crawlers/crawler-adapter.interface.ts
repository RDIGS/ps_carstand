export interface CrawlerSearchParams {
  marca: string;
  modelo: string;
  ano?: number;
  kms?: number;
  // Ignora o tier "preciso" (ano±1 & kms±30k) e usa logo ano±2 — dá ao
  // utilizador uma amostra maior quando suspeita de mudança de geração do
  // modelo a fazer a janela apertada enviesar o resultado (ver estimate.util.ts).
  janelaAmpliada?: boolean;
}

// Anúncio real usado no cálculo — devolvido só numa pesquisa fresca (não
// persistido em `market_estimates`, ver crawler.service.ts), para o
// utilizador poder confirmar a estimativa sem sair da app.
export interface CrawlerListagem {
  titulo: string;
  preco: number;
  ano?: number;
  kms?: number;
  url: string;
  foto?: string;
}

export interface CrawlerSearchResult {
  precoMedio: number | null;
  precoMin: number | null;
  precoMax: number | null;
  numAnunciosComparados: number;
  amostra: CrawlerListagem[];
}

// Cada fonte (OLX, StandVirtual, ...) implementa este contrato como um
// adaptador independente (secção 6.6) — se um site mudar a estrutura e um
// adaptador falhar, os outros continuam a funcionar.
export interface CrawlerAdapter {
  readonly fonte: string;
  search(params: CrawlerSearchParams): Promise<CrawlerSearchResult>;
}
