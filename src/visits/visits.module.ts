import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';

@Module({
  imports: [AuditModule],
  controllers: [VisitsController],
  providers: [VisitsService],
})
export class VisitsModule {}
