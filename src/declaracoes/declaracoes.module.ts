import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { DeclaracoesController } from './declaracoes.controller';
import { DeclaracoesService } from './declaracoes.service';

@Module({
  imports: [AuditModule, DocumentsModule, VehiclesModule],
  controllers: [DeclaracoesController],
  providers: [DeclaracoesService],
})
export class DeclaracoesModule {}
