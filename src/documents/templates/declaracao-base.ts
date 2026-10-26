import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib';

// Base comum das declarações do veículo (secção nova, 2026-10-26): modelos
// fornecidos pelo utilizador (pasta `declaracoes/`, da Carstech) redesenhados
// de raiz para servirem a qualquer stand — com o logótipo e os dados do
// próprio stand, nunca os da Carstech gravados nos PDFs originais.

export const A4: [number, number] = [595.28, 841.89];
export const PRETO = rgb(0, 0, 0);
export const CINZA = rgb(0.45, 0.45, 0.45);
export const CINZA_CLARO = rgb(0.85, 0.85, 0.85);
export const BRANCO = rgb(1, 1, 1);

export interface StandDeclaracao {
  /** Nome legal (denominação social) — se não estiver definido, o nome do stand. */
  denominacao: string;
  nif: string | null;
  morada: string | null;
  localidade: string | null;
  contacto: string | null;
  /** Bytes do logótipo da conta do stand (JPEG/PNG), ou null. */
  logo: Buffer | null;
}

export interface VeiculoDeclaracao {
  matricula: string;
  marca: string;
  modelo: string;
  versao: string | null;
  chassis: string | null;
  kms: number | null;
  categoria: string | null;
  combustivel: string | null;
  cilindrada: number | null;
  potenciaKw: number | null;
  cor: string | null;
  numLugares: number | null;
  /** Data da 1.ª matrícula (no país de origem, para importados), YYYY-MM-DD. */
  dataPrimeiraMatricula: string | null;
  /** Data da matrícula em Portugal, YYYY-MM-DD. */
  dataMatriculaPortugal: string | null;
}

export interface PessoaDeclaracao {
  nome: string;
  morada?: string | null;
  nif?: string | null;
}

// As fontes standard do pdf-lib só desenham WinAnsi (CP1252): um carácter
// fora disso (ex. um nome com letras de outro alfabeto) rebentava a geração
// inteira. Troca-o por "?" (mesmo padrão do extrato mensal).
const EXTRAS_WINANSI = new Set([0x20ac, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026]);
export function seguro(texto: string | null | undefined): string {
  return Array.from(texto ?? '')
    .map((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return (cp >= 0x20 && cp <= 0xff) || EXTRAS_WINANSI.has(cp) ? ch : '?';
    })
    .join('');
}

/** YYYY-MM-DD (ou ISO) → DD/MM/AAAA. */
export function dataPt(data: string | null | undefined): string {
  if (!data) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : data;
}

export function hojePt(): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
}

export function euros(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '';
  return valor.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export class Desenho {
  page: PDFPage;
  private constructor(
    readonly pdf: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
    readonly logo: PDFImage | null,
  ) {
    this.page = pdf.addPage(A4);
  }

  static async criar(logoBytes: Buffer | null): Promise<Desenho> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let logo: PDFImage | null = null;
    if (logoBytes) {
      try {
        const ePng = logoBytes[0] === 0x89 && logoBytes[1] === 0x50 && logoBytes[2] === 0x4e && logoBytes[3] === 0x47;
        logo = ePng ? await pdf.embedPng(logoBytes) : await pdf.embedJpg(logoBytes);
      } catch {
        logo = null; // WebP ou ficheiro estragado: a declaração sai sem logótipo, não falha.
      }
    }
    return new Desenho(pdf, font, bold, logo);
  }

  /** Passa a desenhar numa página nova (A4). */
  novaPagina(): void {
    this.page = this.pdf.addPage(A4);
  }

  get largura(): number {
    return this.page.getWidth();
  }

  /** Desenha o logótipo com o topo em `yTopo`; devolve a altura usada (0 se não houver). */
  desenharLogo(yTopo: number, alturaMax: number, alinhamento: 'centro' | 'direita', margem = 60): number {
    if (!this.logo) return 0;
    const escala = Math.min(alturaMax / this.logo.height, 160 / this.logo.width);
    const w = this.logo.width * escala;
    const h = this.logo.height * escala;
    const x = alinhamento === 'centro' ? (this.largura - w) / 2 : this.largura - margem - w;
    this.page.drawImage(this.logo, { x, y: yTopo - h, width: w, height: h });
    return h;
  }

  texto(t: string, x: number, y: number, size = 10, negrito = false, cor = PRETO) {
    this.page.drawText(seguro(t), { x, y, size, font: negrito ? this.bold : this.font, color: cor });
  }

  centrado(t: string, y: number, size: number, negrito = false) {
    const f = negrito ? this.bold : this.font;
    const w = f.widthOfTextAtSize(seguro(t), size);
    this.texto(t, (this.largura - w) / 2, y, size, negrito);
  }

  direita(t: string, xDireita: number, y: number, size = 10, negrito = false) {
    const f = negrito ? this.bold : this.font;
    this.texto(t, xDireita - f.widthOfTextAtSize(seguro(t), size), y, size, negrito);
  }

  largo(t: string, size: number, negrito = false): number {
    return (negrito ? this.bold : this.font).widthOfTextAtSize(seguro(t), size);
  }

  linha(x1: number, y1: number, x2: number, y2: number, espessura = 0.8, cor = PRETO, tracejado = false) {
    this.page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: espessura,
      color: cor,
      dashArray: tracejado ? [2, 2] : undefined,
    });
  }

  caixa(x: number, y: number, w: number, h: number, preenchimento?: ReturnType<typeof rgb>) {
    this.page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      borderColor: preenchimento ? undefined : PRETO,
      borderWidth: preenchimento ? 0 : 0.8,
      color: preenchimento,
    });
  }

  /**
   * Parágrafo com quebra de linha automática e partes a negrito. Devolve o
   * `y` da linha seguinte.
   */
  paragrafo(partes: { t: string; b?: boolean }[], x: number, y: number, largura: number, size: number, entrelinha: number): number {
    // `colado`: a palavra segue a anterior sem espaço (ex. a vírgula logo a
    // seguir a um nome a negrito noutra parte).
    const palavras: { t: string; b: boolean; colado: boolean }[] = [];
    for (const p of partes) {
      const texto = seguro(p.t);
      texto.split(' ').forEach((w, i) => {
        if (w === '') return;
        palavras.push({ t: w, b: !!p.b, colado: i === 0 && palavras.length > 0 && !texto.startsWith(' ') });
      });
    }
    const fonte = (b: boolean) => (b ? this.bold : this.font);
    const espaco = this.font.widthOfTextAtSize(' ', size);
    let linha: typeof palavras = [];
    let larguraLinha = 0;
    // Desenha cada linha em blocos de texto com espaços verdadeiros (um bloco
    // por mudança de fonte), para o texto copiado do PDF não sair colado.
    const desenharLinha = () => {
      let cx = x;
      let bloco = '';
      let blocoNegrito = linha[0]?.b ?? false;
      const fechar = () => {
        if (!bloco) return;
        this.page.drawText(bloco, { x: cx, y, size, font: fonte(blocoNegrito), color: PRETO });
        cx += fonte(blocoNegrito).widthOfTextAtSize(bloco, size);
        bloco = '';
      };
      linha.forEach((w, i) => {
        const separador = i === 0 || w.colado ? '' : ' ';
        if (w.b !== blocoNegrito) {
          fechar();
          if (separador) cx += espaco;
          blocoNegrito = w.b;
          bloco = w.t;
        } else {
          bloco += separador + w.t;
        }
      });
      fechar();
      y -= entrelinha;
    };
    for (const w of palavras) {
      const lw = fonte(w.b).widthOfTextAtSize(w.t, size);
      const sep = linha.length && !w.colado ? espaco : 0;
      if (linha.length && larguraLinha + sep + lw > largura) {
        desenharLinha();
        linha = [];
        larguraLinha = 0;
        w.colado = false;
      }
      larguraLinha += (linha.length && !w.colado ? espaco : 0) + lw;
      linha.push(w);
    }
    if (linha.length) desenharLinha();
    return y;
  }

  /** Quebra um texto em linhas que caibam em `largura` (para células de tabela). */
  quebrar(t: string, size: number, largura: number, negrito = false): string[] {
    const f = negrito ? this.bold : this.font;
    const linhas: string[] = [];
    let atual = '';
    for (const palavra of seguro(t).split(' ')) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (f.widthOfTextAtSize(tentativa, size) > largura && atual) {
        linhas.push(atual);
        atual = palavra;
      } else {
        atual = tentativa;
      }
    }
    if (atual) linhas.push(atual);
    return linhas;
  }

  async guardar(): Promise<Buffer> {
    return Buffer.from(await this.pdf.save());
  }
}
