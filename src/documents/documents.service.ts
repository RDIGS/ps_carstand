import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { StorageService } from '../storage/storage.service';
import { generateDuaFinalPdf, DuaFinalData } from './templates/dua-final.template';
import { generateIdentityDocumentPdf, IdentityDocumentData } from './identity-document.template';
import { DadosDeclaracao, gerarDeclaracaoPdf } from './declaracoes';

@Injectable()
export class DocumentsService {
  constructor(private readonly storage: StorageService) {}

  /**
   * Declarações do veículo (compra, venda, circulação, características) —
   * cada emissão tem o seu ficheiro (nunca substitui uma anterior).
   */
  async gerarDeclaracao(schemaName: string, vehicleId: string, dados: DadosDeclaracao): Promise<string> {
    const pdfBuffer = await gerarDeclaracaoPdf(dados);
    return this.storage.upload(
      `${schemaName}/vehicles/${vehicleId}/declaracoes/${dados.tipo}-${randomUUID()}.pdf`,
      pdfBuffer,
      'application/pdf',
    );
  }

  async generateDuaFinal(schemaName: string, saleId: string, data: DuaFinalData): Promise<string> {
    const pdfBuffer = await generateDuaFinalPdf(data);
    return this.storage.upload(`${schemaName}/sales/${saleId}/dua-final.pdf`, pdfBuffer, 'application/pdf');
  }

  async generateIdentityDocument(schemaName: string, saleId: string, data: IdentityDocumentData): Promise<string> {
    const pdfBuffer = await generateIdentityDocumentPdf(data);
    return this.storage.upload(
      `${schemaName}/sales/${saleId}/identificacao-comprador.pdf`,
      pdfBuffer,
      'application/pdf',
    );
  }
}
