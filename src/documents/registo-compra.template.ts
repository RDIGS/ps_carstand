import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface RegistoCompraData {
  stand: { nome: string; nif?: string | null; morada?: string | null };
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

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
