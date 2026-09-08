import { PDFDocument, PDFFont, PDFImage, StandardFonts, rgb } from 'pdf-lib';

export interface ExtratoDespesaLinha {
  data: string; // já formatada DD/MM/AAAA
  categoria: string | null;
  descricao: string | null;
  metodoPagamento: string | null;
  pagoPorNome: string | null;
  reembolsado: boolean;
  valor: number;
  veiculo?: string | null; // só despesas de veículo: "MATRÍCULA — MARCA MODELO"
  fornecedorNome?: string | null;
  fornecedorNif?: string | null;
  valorIva?: number | null;
  taxaIva?: number | null;
  comprovativoJpeg?: Buffer | null;
}

export interface ExtratoVendaLinha {
  data: string;
  veiculo: string;
  compradorNome: string;
  precoFinal: number;
  margem: number;
}

export interface ExtratoMensalData {
  standNome: string;
  periodoLabel: string; // ex.: "Setembro de 2026"
  resumo: {
    totalReceitas: number;
    totalDespesasGerais: number;
    totalDespesasVeiculos: number;
    totalVendas: number;
    totalCompras: number;
    totalMargemVendas: number;
    lucroLiquido: number;
    cashflow: number;
  };
  despesasGerais: ExtratoDespesaLinha[];
  despesasVeiculos: ExtratoDespesaLinha[];
  vendas: ExtratoVendaLinha[];
}

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 50;
const LINE_HEIGHT = 15;
const CINZENTO = rgb(0.45, 0.45, 0.45);
const AZUL_SECAO = rgb(0.11, 0.25, 0.45);
const PRETO = rgb(0.12, 0.14, 0.19);

const euros = (v: number) => `${v.toFixed(2)} €`;

// As fontes "standard" do pdf-lib só sabem desenhar WinAnsi (CP1252) — um
// caráter fora disso (emoji, ou um Unicode replacement character vindo de
// texto mal codificado nalgum sítio) faz `page.drawText` rebentar e falhar
// o extrato inteiro. Troca por "?" em vez de deixar 1 caráter estranho numa
// descrição impedir todo o relatório de ser gerado. Inclui os "extras" do
// CP1252 fora do bloco Latin-1 que este template usa (travessão, marcador
// de lista) — sem isto seriam trocados por "?" também.
const EXTRAS_WINANSI = new Set([0x20ac, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026]);
function textoSeguro(texto: string): string {
  return Array.from(texto)
    .map((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return (cp >= 0x20 && cp <= 0xff) || EXTRAS_WINANSI.has(cp) ? ch : '?';
    })
    .join('');
}

// Segue o mesmo padrão de `registo-compra.template.ts` (cursor `y` manual,
// nova página quando o conteúdo não cabe) mas com paginação genérica — aqui
// o número de despesas/vendas é imprevisível (varia todos os meses), ao
// contrário dos templates de venda que têm sempre a mesma forma.
export async function generateExtratoMensalPdf(data: ExtratoMensalData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage(A4);
  let y = page.getHeight() - MARGEM;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGEM) {
      page = pdf.addPage(A4);
      y = page.getHeight() - MARGEM;
    }
  };

  const drawTitle = (text: string) => {
    ensureSpace(LINE_HEIGHT * 1.5);
    page.drawText(textoSeguro(text), { x: MARGEM, y, size: 16, font: bold, color: PRETO });
    y -= LINE_HEIGHT * 1.5;
  };

  const drawSectionHeader = (text: string) => {
    ensureSpace(LINE_HEIGHT * 2.5);
    y -= 10;
    page.drawText(textoSeguro(text), { x: MARGEM, y, size: 12, font: bold, color: AZUL_SECAO });
    y -= LINE_HEIGHT * 1.3;
  };

  const drawKeyValue = (label: string, value: string) => {
    ensureSpace(LINE_HEIGHT);
    const labelTexto = textoSeguro(`${label}:`);
    page.drawText(labelTexto, { x: MARGEM, y, size: 10, font: bold });
    // Coluna do valor desloca-se para a direita do rótulo quando este é
    // comprido — evita sobrepor texto e número (bug real visto num rótulo
    // longo, "Margem de vendas (...)").
    const xValor = MARGEM + Math.max(190, bold.widthOfTextAtSize(labelTexto, 10) + 15);
    page.drawText(textoSeguro(value), { x: xValor, y, size: 10, font });
    y -= LINE_HEIGHT;
  };

  drawTitle('Extrato Financeiro Mensal');
  ensureSpace(LINE_HEIGHT * 1.5);
  page.drawText(textoSeguro(`${data.standNome} — ${data.periodoLabel}`), { x: MARGEM, y, size: 11, font, color: CINZENTO });
  y -= LINE_HEIGHT * 2;

  drawSectionHeader('Resumo do mês');
  drawKeyValue('Receitas gerais', euros(data.resumo.totalReceitas));
  drawKeyValue('Vendas de veículos', euros(data.resumo.totalVendas));
  drawKeyValue('Custo dos veículos comprados', euros(data.resumo.totalCompras));
  drawKeyValue('Despesas gerais', euros(data.resumo.totalDespesasGerais));
  drawKeyValue('Despesas de veículos', euros(data.resumo.totalDespesasVeiculos));
  drawKeyValue('Margem de vendas (preço venda - custo - despesas)', euros(data.resumo.totalMargemVendas));
  ensureSpace(LINE_HEIGHT * 1.4);
  page.drawText(textoSeguro('Lucro líquido do mês:'), { x: MARGEM, y, size: 12, font: bold, color: AZUL_SECAO });
  page.drawText(textoSeguro(euros(data.resumo.lucroLiquido)), {
    x: MARGEM + 190,
    y,
    size: 12,
    font: bold,
    color: AZUL_SECAO,
  });
  y -= LINE_HEIGHT * 1.4;
  drawKeyValue('Cashflow do mês (caixa)', euros(data.resumo.cashflow));

  // Tenta embutir uma imagem uma única vez (reaproveitada depois na
  // miniatura do cartão e no anexo em tamanho grande) — o upload de
  // comprovativos aceita JPEG/PNG/WebP (mesma validação de qualquer foto na
  // app, ver `assertIsImageBuffer`), mas o pdf-lib só sabe embutir JPEG e
  // PNG; os magic bytes decidem qual dos dois usar. WebP (ou outro formato
  // não suportado) cai no catch e fica sem imagem em vez de rebentar o
  // extrato inteiro.
  const embedImagem = async (buf: Buffer): Promise<PDFImage | null> => {
    try {
      const ePng = buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      return ePng ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
    } catch {
      return null;
    }
  };

  // Cada comprovativo com imagem entra também no anexo do fim do PDF (em
  // tamanho legível) — pedido do utilizador para o extrato servir mesmo de
  // suporte contabilístico, não só de lista de números com uma miniatura
  // pequena demais para ler detalhe.
  const anexos: { numero: number; titulo: string; subtitulo: string; imagem: PDFImage }[] = [];

  // Cada despesa é um pequeno "cartão" (data/categoria/valor, veículo se
  // aplicável, descrição, método/pago-por/reembolsado) com a miniatura do
  // comprovativo à esquerda quando existe.
  const drawDespesaCard = async (despesa: ExtratoDespesaLinha, origemLabel: string) => {
    const imagem = despesa.comprovativoJpeg ? await embedImagem(despesa.comprovativoJpeg) : null;
    const numeroAnexo = imagem ? anexos.length + 1 : null;
    const thumb = 42;
    const textX = MARGEM + (imagem ? thumb + 10 : 0);

    const linhas: { texto: string; size: number; font: PDFFont; cor: typeof PRETO }[] = [
      {
        texto: `${despesa.data}   ·   ${categoriaLabel(despesa.categoria)}   ·   ${euros(despesa.valor)}`,
        size: 10,
        font: bold,
        cor: PRETO,
      },
    ];
    if (despesa.veiculo) linhas.push({ texto: despesa.veiculo, size: 9, font, cor: CINZENTO });
    if (despesa.descricao) linhas.push({ texto: despesa.descricao, size: 9, font, cor: PRETO });
    // Dados fiscais do fornecedor — o que a contabilista precisa mesmo para
    // lançar a despesa e deduzir IVA, não só o valor total.
    const fiscal: string[] = [];
    if (despesa.fornecedorNome) fiscal.push(`Fornecedor: ${despesa.fornecedorNome}`);
    if (despesa.fornecedorNif) fiscal.push(`NIF: ${despesa.fornecedorNif}`);
    if (despesa.valorIva != null) {
      fiscal.push(`IVA: ${euros(despesa.valorIva)}${despesa.taxaIva != null ? ` (${despesa.taxaIva}%)` : ''}`);
    }
    if (fiscal.length) linhas.push({ texto: fiscal.join('   ·   '), size: 9, font, cor: PRETO });
    const detalhes: string[] = [];
    if (despesa.metodoPagamento) detalhes.push(metodoLabel(despesa.metodoPagamento));
    if (despesa.pagoPorNome) detalhes.push(`Pago por ${despesa.pagoPorNome}${despesa.reembolsado ? ' (reembolsado)' : ' (por reembolsar)'}`);
    if (numeroAnexo) detalhes.push(`Comprovativo nº ${numeroAnexo}`);
    if (detalhes.length) linhas.push({ texto: detalhes.join('   ·   '), size: 9, font, cor: CINZENTO });

    const alturaCard = Math.max(linhas.length * LINE_HEIGHT, imagem ? thumb : 0) + 10;
    ensureSpace(alturaCard);

    const yInicioCard = y;
    if (imagem) {
      const escala = Math.min(thumb / imagem.width, thumb / imagem.height, 1);
      page.drawImage(imagem, {
        x: MARGEM,
        y: yInicioCard - thumb,
        width: imagem.width * escala,
        height: imagem.height * escala,
      });
    }

    for (const linha of linhas) {
      page.drawText(textoSeguro(linha.texto), { x: textX, y, size: linha.size, font: linha.font, color: linha.cor });
      y -= LINE_HEIGHT;
    }
    y = Math.min(y, yInicioCard - thumb) - 10;

    if (imagem && numeroAnexo) {
      anexos.push({
        numero: numeroAnexo,
        titulo: origemLabel,
        subtitulo: `${despesa.data}   ·   ${categoriaLabel(despesa.categoria)}   ·   ${euros(despesa.valor)}${despesa.veiculo ? '   ·   ' + despesa.veiculo : ''}`,
        imagem,
      });
    }
  };

  drawSectionHeader(`Despesas gerais (${data.despesasGerais.length})`);
  if (data.despesasGerais.length === 0) {
    ensureSpace(LINE_HEIGHT);
    page.drawText('Sem despesas gerais neste período.', { x: MARGEM, y, size: 10, font, color: CINZENTO });
    y -= LINE_HEIGHT;
  }
  for (const despesa of data.despesasGerais) {
    await drawDespesaCard(despesa, 'Despesa geral');
  }

  drawSectionHeader(`Despesas de veículos (${data.despesasVeiculos.length})`);
  if (data.despesasVeiculos.length === 0) {
    ensureSpace(LINE_HEIGHT);
    page.drawText('Sem despesas de veículos neste período.', { x: MARGEM, y, size: 10, font, color: CINZENTO });
    y -= LINE_HEIGHT;
  }
  for (const despesa of data.despesasVeiculos) {
    await drawDespesaCard(despesa, 'Despesa de veículo');
  }

  drawSectionHeader(`Vendas (${data.vendas.length})`);
  if (data.vendas.length === 0) {
    ensureSpace(LINE_HEIGHT);
    page.drawText('Sem vendas concluídas neste período.', { x: MARGEM, y, size: 10, font, color: CINZENTO });
    y -= LINE_HEIGHT;
  }
  for (const venda of data.vendas) {
    ensureSpace(LINE_HEIGHT * 2 + 8);
    page.drawText(textoSeguro(`${venda.data}   ·   ${venda.veiculo}   ·   ${euros(venda.precoFinal)}`), {
      x: MARGEM,
      y,
      size: 10,
      font: bold,
      color: PRETO,
    });
    y -= LINE_HEIGHT;
    page.drawText(textoSeguro(`Comprador: ${venda.compradorNome}   ·   Margem: ${euros(venda.margem)}`), {
      x: MARGEM,
      y,
      size: 9,
      font,
      color: CINZENTO,
    });
    y -= LINE_HEIGHT + 6;
  }

  // Anexo final: cada comprovativo em tamanho legível (ao contrário da
  // miniatura de 42px do cartão acima), numerado para bater certo com a
  // referência "Comprovativo nº X" deixada junto de cada despesa.
  if (anexos.length > 0) {
    drawSectionHeader(`Anexo — Comprovativos (${anexos.length})`);
    const larguraMax = page.getWidth() - MARGEM * 2;
    const alturaMax = 320;
    for (const anexo of anexos) {
      const escala = Math.min(larguraMax / anexo.imagem.width, alturaMax / anexo.imagem.height, 1);
      const largura = anexo.imagem.width * escala;
      const altura = anexo.imagem.height * escala;

      ensureSpace(altura + LINE_HEIGHT * 2 + 14);
      page.drawText(textoSeguro(`Comprovativo nº ${anexo.numero} — ${anexo.titulo}`), {
        x: MARGEM,
        y,
        size: 10,
        font: bold,
        color: PRETO,
      });
      y -= LINE_HEIGHT;
      page.drawText(textoSeguro(anexo.subtitulo), { x: MARGEM, y, size: 9, font, color: CINZENTO });
      y -= LINE_HEIGHT + 6;
      page.drawImage(anexo.imagem, { x: MARGEM, y: y - altura, width: largura, height: altura });
      y -= altura + 16;
    }
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

function categoriaLabel(categoria: string | null): string {
  return categoria ? categoria.replace(/_/g, ' ') : 'sem categoria';
}

function metodoLabel(metodo: string): string {
  const labels: Record<string, string> = {
    numerario: 'Numerário',
    transferencia: 'Transferência',
    multibanco: 'Multibanco',
    cartao: 'Cartão',
    cheque: 'Cheque',
    outro: 'Outro método',
  };
  return labels[metodo] ?? metodo;
}
