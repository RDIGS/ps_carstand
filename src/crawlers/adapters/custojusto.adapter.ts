import { Injectable, Logger } from '@nestjs/common';
import { CrawlerAdapter, CrawlerListagem, CrawlerSearchParams, CrawlerSearchResult } from '../crawler-adapter.interface';
import { ComparavelBase, amostraVisivel, estatisticasDePreco, selecionarComparaveis } from './estimate.util';

// Validado contra o site real (2026-07-17): custojusto.pt é outra app
// Next.js (mesma família de tecnologia do StandVirtual), mas embute os
// resultados diretamente em `props.pageProps.listItems` (sem cache urql) —
// e o URL `/portugal/veiculos/carros-usados/{marca}/{modelo}` já filtra
// exatamente ao modelo pedido (confirmado: pesquisa "bmw/320" devolveu só
// BMW 320), por isso não é preciso filtrar por modelo no cliente como no
// StandVirtual/OLX.
//
// Limitação real desta fonte: os resultados de pesquisa NÃO incluem kms (só
// aparece em texto livre na descrição do anúncio, não em campo estruturado)
// — por isso esta fonte nunca consegue usar o tier mais apertado
// (ano±1 & kms±30k) de `selecionarComparaveis`, só o tier por ano.
const BASE_URL = 'https://www.custojusto.pt';
const PAGINAS_A_PERCORRER = 2;

interface ListItem {
  listID: string;
  title: string;
  price: number;
  url: string;
  imageFullURL?: string;
  params?: { regdate?: string };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class CustoJustoAdapter implements CrawlerAdapter {
  readonly fonte = 'custojusto';
  private readonly logger = new Logger(CustoJustoAdapter.name);

  async search(params: CrawlerSearchParams): Promise<CrawlerSearchResult> {
    const marcaSlug = slugify(params.marca);
    const modeloSlug = slugify(params.modelo);

    const paginas = await Promise.all(
      Array.from({ length: PAGINAS_A_PERCORRER }, (_, i) => this.fetchPagina(marcaSlug, modeloSlug, i + 1)),
    );

    const vistos = new Set<string>();
    const items = paginas.flat().filter((item) => {
      if (vistos.has(item.listID)) return false;
      vistos.add(item.listID);
      return true;
    });

    const comparaveis: (ComparavelBase & { titulo?: string; url?: string; foto?: string })[] = items.map((item) => ({
      ano: Number(item.params?.regdate) || undefined,
      preco: item.price,
      titulo: item.title,
      url: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
      foto: item.imageFullURL,
    }));

    // kms nunca vem preenchido nesta fonte (ver comentário acima) — o
    // parâmetro é passado na mesma para uniformidade da assinatura, mas
    // `selecionarComparaveis` cai sempre para o tier "só ano".
    const selecionados = selecionarComparaveis(comparaveis, params.ano, params.kms, params.janelaAmpliada);
    const precos = selecionados.map((c) => c.preco).filter((p): p is number => typeof p === 'number' && p > 0);

    const stats = estatisticasDePreco(precos);
    if (!stats) {
      return { precoMedio: null, precoMin: null, precoMax: null, numAnunciosComparados: 0, amostra: [] };
    }

    const amostra: CrawlerListagem[] = amostraVisivel(selecionados, stats.precoMedio)
      .filter((c) => c.titulo && c.url)
      .map((c) => ({ titulo: c.titulo!, preco: c.preco!, ano: c.ano, url: c.url!, foto: c.foto }));

    return { ...stats, numAnunciosComparados: precos.length, amostra };
  }

  private async fetchPagina(marcaSlug: string, modeloSlug: string, pagina: number): Promise<ListItem[]> {
    const url = `${BASE_URL}/portugal/veiculos/carros-usados/${marcaSlug}/${modeloSlug}${pagina > 1 ? `?o=${pagina}` : ''}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) {
      if (pagina > 1) {
        this.logger.warn(`CustoJusto página ${pagina} indisponível (${response.status}) — a continuar só com a 1ª.`);
        return [];
      }
      throw new Error(`CustoJusto respondeu ${response.status} para ${url}`);
    }
    return this.extractListItems(await response.text());
  }

  private extractListItems(html: string): ListItem[] {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) {
      this.logger.warn('__NEXT_DATA__ não encontrado — a estrutura da página pode ter mudado.');
      return [];
    }
    try {
      const data = JSON.parse(match[1]);
      const listItems = data?.props?.pageProps?.listItems;
      return Array.isArray(listItems) ? (listItems as ListItem[]) : [];
    } catch (err) {
      this.logger.warn(`Falha a interpretar __NEXT_DATA__: ${(err as Error).message}`);
      return [];
    }
  }
}
