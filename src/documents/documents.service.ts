import { Injectable } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { generateRegistoCompraPdf, RegistoCompraData } from './registo-compra.template';
import { generateIdentityDocumentPdf, IdentityDocumentData } from './identity-document.template';

@Injectable()
export class DocumentsService {
  constructor(private readonly storage: StorageService) {}

  async generateRegistoCompra(schemaName: string, saleId: string, data: RegistoCompraData): Promise<string> {
    const pdfBuffer = await generateRegistoCompraPdf(data);
    return this.storage.upload(`${schemaName}/sales/${saleId}/registo-compra.pdf`, pdfBuffer, 'application/pdf');
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
