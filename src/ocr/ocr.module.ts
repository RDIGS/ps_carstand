import { Module } from '@nestjs/common';
import { DuaExtractionService } from './dua-extraction.service';
import { IdentityExtractionService } from './identity-extraction.service';

@Module({
  providers: [DuaExtractionService, IdentityExtractionService],
  exports: [DuaExtractionService, IdentityExtractionService],
})
export class OcrModule {}
