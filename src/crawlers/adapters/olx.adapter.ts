import { Injectable, Logger } from '@nestjs/common';
import { CrawlerAdapter, CrawlerListagem, CrawlerSearchParams, CrawlerSearchResult } from '../crawler-adapter.interface';
import { ComparavelBase, amostraVisivel, estatisticasDePreco, selecionarComparaveis } from './estimate.util';

// Validado contra o site real (2026-07-17): olx.pt embute o resultado da
// pesquisa em `window.__PRERENDERED_STATE__` — uma string JS que, quando
// desencriptada (é JSON dentro de JSON, "double-encoded"), contém a lista
// de anúncios completa. Mais estável que scraping de HTML renderizado.
//
// title/url/photos confirmados ao vivo (2026-07-17, ao adicionar a amostra
// de anúncios): "title" e "url" já vinham corretos; "photos" é um array
// simples de strings (URLs), não objetos com ".link" como a 1ª tentativa
// assumia — corrigido depois de inspecionar o JSON real de um pedido bem-sucedido.
interface OlxParam {
  key: string;
  value: string;
}

interface OlxAd {
  id: number;
  title?: string;
  url?: string;
  params: OlxParam[];
  price?: { regularPrice?: { value?: number } };
  photos?: string[];
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PAGINAS_A_PERCORRER = 2; // amostra maior reduz o risco de enviesar perto de mudanças de geração do modelo

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function paramValue(ad: OlxAd, key: string): string | undefined {
  return ad.params.find((p) => p.key === key)?.value;
}

/** "205.000 km" → 205000. */
function parseKms(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Number(digits) : undefined;
}

@Injectable()
export class OlxAdapter implements CrawlerAdapter {
  readonly fonte = 'olx';
  private readonly logger = new Logger(OlxAdapter.name);

  async search(params: CrawlerSearchParams): Promise<CrawlerSearchResult> {
    const marcaSlug = slugify(params.marca);
    const modeloSlug = slugify(params.modelo);

    const paginas = await Promise.all(
      Array.from({ length: PAGINAS_A_PERCORRER }, (_, i) => this.fetchPagina(marcaSlug, modeloSlug, i + 1)),
    );

    const vistos = new Set<number>();
    const ads = paginas.flat().filter((ad) => {
      if (vistos.has(ad.id)) return false;
      vistos.add(ad.id);
      return true;
    });

    // A pesquisa "q-{modelo}" já filtra no servidor, mas confirma-se aqui
    // na mesma (evita falsos positivos do motor de busca de texto livre).
    const modeloAlvo = params.modelo.toLowerCase();
    const porModelo = ads.filter((ad) => (paramValue(ad, 'modelo') ?? '').toLowerCase().includes(modeloAlvo));

    const comparaveis: (ComparavelBase & { titulo?: string; url?: string; foto?: string })[] = porModelo.map((ad) => ({
      ano: Number(paramValue(ad, 'year')) || undefined,
      kms: parseKms(paramValue(ad, 'quilometros')),
      preco: ad.price?.regularPrice?.value,
      titulo: ad.title,
      url: ad.url,
      foto: ad.photos?.[0],
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

  private async fetchPagina(marcaSlug: string, modeloSlug: string, pagina: number): Promise<OlxAd[]> {
    const url = `https://www.olx.pt/carros-motos-e-barcos/carros/${marcaSlug}/q-${modeloSlug}/${pagina > 1 ? `?page=${pagina}` : ''}`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) {
      if (pagina > 1) {
        this.logger.warn(`OLX página ${pagina} indisponível (${response.status}) — a continuar só com a 1ª.`);
        return [];
      }
      throw new Error(`OLX respondeu ${response.status} para ${url}`);
    }
    return this.extractAds(await response.text());
  }

  /** window.__PRERENDERED_STATE__ é uma string JS contendo JSON escapado — precisa de 2 JSON.parse seguidos. */
  private extractAds(html: string): OlxAd[] {
    const marker = 'window.__PRERENDERED_STATE__';
    const start = html.indexOf(marker);
    if (start === -1) {
      this.logger.warn('__PRERENDERED_STATE__ não encontrado — a estrutura da página pode ter mudado.');
      return [];
    }

    const eq = html.indexOf('=', start) + 1;
    const end = html.indexOf('window.__', eq);
    if (eq === 0 || end === -1) return [];

    const jsStringLiteral = html.slice(eq, end).trim().replace(/;\s*$/, '');

    try {
      const jsonString = JSON.parse(jsStringLiteral) as string;
      const state = JSON.parse(jsonString);
      const ads = state?.listing?.listing?.ads;
      return Array.isArray(ads) ? (ads as OlxAd[]) : [];
    } catch (err) {
      this.logger.warn(`Falha a interpretar __PRERENDERED_STATE__: ${(err as Error).message}`);
      return [];
    }
  }
}
