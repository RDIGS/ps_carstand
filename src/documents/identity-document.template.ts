import { PDFDocument, StandardFonts } from 'pdf-lib';

export interface IdentityDocumentData {
  tipoDocumento: string; // 'cc' | 'titulo_residencia' | 'bi' | 'outro'
  compradorNome: string;
  frenteJpeg: Buffer;
  versoJpeg: Buffer;
}

const MARGEM = 40;
const A4: [number, number] = [595.28, 841.89];

// Combina as 2 fotos (já cortadas/prontas — confirmado pelo utilizador antes
// de chegar aqui, ver secção 23) num único PDF arquivado com a venda. Não
// tenta ler nem validar o conteúdo — isso já foi feito pelo OCR antes desta
// função ser chamada.
export async function generateIdentityDocumentPdf(data: IdentityDocumentData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  for (const [label, jpeg] of [
    ['Frente', data.frenteJpeg],
    ['Verso', data.versoJpeg],
  ] as const) {
    const page = pdf.addPage(A4);
    const [pageWidth, pageHeight] = A4;

    page.drawText(`${data.compradorNome} — ${data.tipoDocumento} (${label})`, {
      x: MARGEM,
      y: pageHeight - MARGEM,
      size: 11,
      font,
    });

    const image = await pdf.embedJpg(jpeg);
    const maxWidth = pageWidth - MARGEM * 2;
    const maxHeight = pageHeight - MARGEM * 2 - 40;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;

    page.drawImage(image, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2 - 20,
      width,
      height,
    });
  }

  return Buffer.from(await pdf.save());
}
