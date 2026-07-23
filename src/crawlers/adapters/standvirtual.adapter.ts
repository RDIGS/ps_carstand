import { Injectable, Logger } from '@nestjs/common';
import { CrawlerAdapter, CrawlerListagem, CrawlerSearchParams, CrawlerSearchResult } from '../crawler-adapter.interface';
import { ComparavelBase, amostraVisivel, estatisticasDePreco, selecionarComparaveis } from './estimate.util';

// Validado contra o site real (2026-07-17): standvirtual.com é uma app
// Next.js que embute o resultado da pesquisa (GraphQL, via urql) em
// <script id="__NEXT_DATA__">. Ler esse JSON é muito mais estável do que
// depender de seletores CSS da página renderizada, que mudam com qualquer
// redesign visual sem alterar a estrutura de dados por baixo.
//
// title/url/thumbnail confirmados no mesmo payload (re-verificado 2026-07-17
// ao adicionar a amostra de anúncios visível na app — nó real inclui
// "title", "url" absoluto e "thumbnail.x1"/"x2").
interface AdvertParameter {
  key: string;
  displayValue: string;
}

interface AdvertNode {
  id: string;
  title?: string;
  url?: string;
  parameters: AdvertParameter[];
  price?: { amount?: { units?: number } };
  thumbnail?: { x1?: string };
}

interface AdvertEdge {
  node: AdvertNode;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PAGINAS_A_PERCORRER = 2; // amostra maior reduz o risco de enviesar perto de mudanças de geração do modelo

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parameterValue(node: AdvertNode, key: string): string | undefined {
  return node.parameters.find((p) => p.key === key)?.displayValue;
}

/** "230000 km" → 230000. */
function parseKms(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Number(digits) : undefined;
}

@Injectable()
export class StandVirtualAdapter implements CrawlerAdapter {
  readonly fonte = 'standvirtual';
  private readonly logger = new Logger(StandVirtualAdapter.name);

  async search(params: CrawlerSearchParams): Promise<CrawlerSearchResult> {
    const marcaSlug = slugify(params.marca);
    const paginas = await Promise.all(
      Array.from({ length: PAGINAS_A_PERCORRER }, (_, i) => this.fetchPagina(marcaSlug, i + 1)),
    );

    const vistos = new Set<string>();
    const edges = paginas.flat().filter((e) => {
      if (vistos.has(e.node.id)) return false;
      vistos.add(e.node.id);
      return true;
    });

    const modeloAlvo = params.modelo.toLowerCase();
    const porModelo = edges.filter((e) => (parameterValue(e.node, 'model') ?? '').toLowerCase().includes(modeloAlvo));

    const comparaveis: (ComparavelBase & { titulo?: string; url?: string; foto?: string })[] = porModelo.map((edge) => ({
      ano: Number(parameterValue(edge.node, 'first_registration_year')) || undefined,
      kms: parseKms(parameterValue(edge.node, 'mileage')),
      preco: edge.node.price?.amount?.units,
      titulo: edge.node.title,
      url: edge.node.url,
      foto: edge.node.thumbnail?.x1,
    }));

    const selecionados = selecionarComparaveis(comparaveis, params.ano, params.kms, params.janelaAmpliada);
    const precos = selecionados.map((c) => c.preco).filter((p): p is number => typeof p === 'number' && p > 0);

    const stats = estatisticasDePreco(precos);
    if (!stats) {
      return { precoMedio: null, precoMin: null, precoMax: null, numAnunciosComparados: 0, amostra: [] };
    }

    const amostra: CrawlerListagem[] = amostraVisivel(selecionados, stats.precoMedio)
      .filter((c) => c.titulo && c.url)
      .map((c) => ({ titulo: c.titulo!, preco: c.preco!, ano: c.ano, kms: c.kms, url: c.url!, foto: c.foto }));

    return { ...stats, numAnunciosComparados: precos.length, amostra };
  }

  private async fetchPagina(marcaSlug: string, pagina: number): Promise<AdvertEdge[]> {
    const url = `https://www.standvirtual.com/carros/${marcaSlug}${pagina > 1 ? `?page=${pagina}` : ''}`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) {
      if (pagina > 1) {
        this.logger.warn(`StandVirtual página ${pagina} indisponível (${response.status}) — a continuar só com a 1ª.`);
        return [];
      }
      throw new Error(`StandVirtual respondeu ${response.status} para ${url}`);
    }
    return this.extractEdges(await response.text());
  }

  /** Localiza, dentro do __NEXT_DATA__, a entrada de cache do urql que contém "advertSearch". */
  private extractEdges(html: string): AdvertEdge[] {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) {
      this.logger.warn('__NEXT_DATA__ não encontrado — a estrutura da página pode ter mudado.');
      return [];
    }

    try {
      const data = JSON.parse(match[1]);
      const urqlState = data?.props?.pageProps?.urqlState as Record<string, { data?: string }> | undefined;
      if (!urqlState) return [];

      for (const entry of Object.values(urqlState)) {
        if (!entry.data || !entry.data.includes('advertSearch')) continue;
        const parsed = JSON.parse(entry.data);
        const edges = parsed?.advertSearch?.edges;
        if (Array.isArray(edges)) return edges as AdvertEdge[];
      }
      return [];
    } catch (err) {
      this.logger.warn(`Falha a interpretar __NEXT_DATA__: ${(err as Error).message}`);
      return [];
    }
  }
}
