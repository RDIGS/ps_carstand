import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinanceStatementService } from './finance-statement.service';
import { FinanceRecurringCron } from './finance-recurring.cron';
import { AuditModule } from '../audit/audit.module';
import { OcrModule } from '../ocr/ocr.module';

@Module({
  imports: [AuditModule, OcrModule],
  controllers: [FinanceController],
  providers: [FinanceService, FinanceStatementService, FinanceRecurringCron],
})
export class FinanceModule {}
