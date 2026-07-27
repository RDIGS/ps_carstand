import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface RegistoCompraData {
  stand: { nome: string; nif?: string | null; morada?: string | null; contacto?: string | null };
  vehicle: {
    matricula: string;
    marca: string;
    modelo: string;
    versao?: string | null;
    chassis?: string | null;
    categoria?: string | null;
  };
  sale: {
    compradorNome: string;
    compradorNif: string;
    compradorMorada?: string | null;
    compradorCp?: string | null;
    compradorTelefone?: string | null;
    compradorIdentificacaoTipo?: string | null;
    compradorIdentificacaoNumero?: string | null;
    precoFinal: number;
    dataVenda: string;
  };
}

const MARGEM = 50;

// Layout próprio (não é o formulário oficial escaneado do IRN — esse asset
// não está disponível neste repositório). Os campos correspondem 1:1 ao
// Modelo 1 RA (secção 7): Q1 identificação do veículo, Q3/Q4 comprador,
// Q7 preço, Q9 data. Quando tiveres o template oficial, troca esta função
// por uma que desenha texto por cima do PDF escaneado nas coordenadas certas.
export async function generateRegistoCompraPdf(data: RegistoCompraData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = page.getHeight() - MARGEM;
  const lineHeight = 20;

  const drawTitle = (text: string) => {
    page.drawText(text, { x: MARGEM, y, size: 16, font: bold, color: rgb(0.12, 0.14, 0.19) });
    y -= lineHeight * 1.5;
  };

  const drawSectionHeader = (text: string) => {
    y -= 8;
    page.drawText(text, { x: MARGEM, y, size: 11, font: bold, color: rgb(0.11, 0.25, 0.45) });
    y -= lineHeight;
  };

  const drawField = (label: string, value: string) => {
    page.drawText(`${label}:`, { x: MARGEM, y, size: 10, font: bold });
    page.drawText(value || '-', { x: MARGEM + 160, y, size: 10, font });
    y -= lineHeight;
  };

  drawTitle('Registo de Compra do Automóvel');
  page.drawText(`Modelo 1 RA — ${data.stand.nome}`, { x: MARGEM, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  y -= lineHeight * 1.5;

  drawSectionHeader('Identificação do Stand (vendedor)');
  drawField('Nome', data.stand.nome);
  drawField('NIF', data.stand.nif ?? '-');
  drawField('Morada', data.stand.morada ?? '-');

  drawSectionHeader('Q1 — Identificação do Veículo');
  drawField('Matrícula', data.vehicle.matricula);
  drawField('Marca', data.vehicle.marca);
  drawField('Modelo', data.vehicle.modelo);
  drawField('Versão', data.vehicle.versao ?? '-');
  drawField('Nº de chassis', data.vehicle.chassis ?? '-');
  drawField('Categoria', data.vehicle.categoria ?? '-');

  drawSectionHeader('Q3/Q4 — Identificação do Comprador');
  drawField('Nome', data.sale.compradorNome);
  drawField('NIF', data.sale.compradorNif);
  drawField('Morada', data.sale.compradorMorada ?? '-');
  drawField('Código Postal', data.sale.compradorCp ?? '-');
  drawField('Telefone', data.sale.compradorTelefone ?? '-');
  drawField(
    'Documento de identificação',
    `${data.sale.compradorIdentificacaoTipo ?? '-'} ${data.sale.compradorIdentificacaoNumero ?? ''}`.trim(),
  );

  drawSectionHeader('Q7/Q9 — Condições da Venda');
  drawField('Preço final', `${data.sale.precoFinal.toFixed(2)} €`);
  drawField('Data da venda', data.sale.dataVenda);

  y -= lineHeight * 2;
  page.drawText('Assinatura do vendedor: ______________________________', { x: MARGEM, y, size: 10, font });
  y -= lineHeight * 2;
  page.drawText('Assinatura do comprador: ______________________________', { x: MARGEM, y, size: 10, font });

  // Secção 24.4: cláusula de autorização de tratamento de dados do
  // comprador, numa página própria — o corpo do texto varia com o
  // comprimento do nome/contacto do stand, por isso não dá para prever de
  // antemão se cabe no que sobra da página 1.
  const clausulaPage = pdf.addPage([595.28, 841.89]);
  let clausulaY = clausulaPage.getHeight() - MARGEM;
  const maxWidth = clausulaPage.getWidth() - MARGEM * 2;

  clausulaPage.drawText('AUTORIZAÇÃO DE TRATAMENTO DE DADOS PESSOAIS', {
    x: MARGEM,
    y: clausulaY,
    size: 12,
    font: bold,
    color: rgb(0.12, 0.14, 0.19),
  });
  clausulaY -= lineHeight * 2;

  const contacto = data.stand.contacto?.trim() || '[contacto do stand não configurado]';
  const paragrafo =
    `O(A) comprador(a) identificado(a) no presente documento autoriza ${data.stand.nome}, enquanto ` +
    `responsável pelo tratamento, a recolher e tratar os seus dados pessoais, incluindo a digitalização ` +
    `do Cartão de Cidadão, com a finalidade exclusiva de formalizar o presente contrato de compra e venda ` +
    `de veículo automóvel. Os dados serão conservados pelo prazo legal aplicável à conservação de ` +
    `documentos comerciais e não serão utilizados para outras finalidades sem consentimento adicional. ` +
    `O(A) comprador(a) pode exercer os seus direitos de acesso, retificação e apagamento dos dados junto ` +
    `de ${data.stand.nome}, através de ${contacto}.`;

  for (const linha of wrapText(paragrafo, font, 10, maxWidth)) {
    clausulaPage.drawText(linha, { x: MARGEM, y: clausulaY, size: 10, font });
    clausulaY -= lineHeight;
  }

  clausulaY -= lineHeight * 2;
  clausulaPage.drawText('Assinatura do comprador: ______________________________  Data: __ / __ / ____', {
    x: MARGEM,
    y: clausulaY,
    size: 10,
    font,
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

function wrapText(text: string, font: Awaited<ReturnType<PDFDocument['embedFont']>>, size: number, maxWidth: number): string[] {
  const linhas: string[] = [];
  let linhaAtual = '';
  for (const palavra of text.split(' ')) {
    const tentativa = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
    if (font.widthOfTextAtSize(tentativa, size) > maxWidth && linhaAtual) {
      linhas.push(linhaAtual);
      linhaAtual = palavra;
    } else {
      linhaAtual = tentativa;
    }
  }
  if (linhaAtual) linhas.push(linhaAtual);
  return linhas;
}
