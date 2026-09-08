import { Module } from '@nestjs/common';
import { DuaExtractionService } from './dua-extraction.service';
import { IdentityExtractionService } from './identity-extraction.service';
import { InvoiceExtractionService } from './invoice-extraction.service';

@Module({
  providers: [DuaExtractionService, IdentityExtractionService, InvoiceExtractionService],
  exports: [DuaExtractionService, IdentityExtractionService, InvoiceExtractionService],
})
export class OcrModule {}
