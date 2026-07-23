import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehiclesRepository } from './vehicles.repository';
import { OcrModule } from '../ocr/ocr.module';
import { CrawlersModule } from '../crawlers/crawlers.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [OcrModule, CrawlersModule, AuditModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, VehiclesRepository],
  exports: [VehiclesRepository, VehiclesService],
})
export class VehiclesModule {}
