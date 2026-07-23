import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { DocumentsModule } from '../documents/documents.module';
import { AuditModule } from '../audit/audit.module';
import { OcrModule } from '../ocr/ocr.module';

@Module({
  imports: [VehiclesModule, DocumentsModule, AuditModule, OcrModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
