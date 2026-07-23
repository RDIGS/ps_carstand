import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StandsService } from './stands.service';

@Injectable()
export class StandsTokenLifecycleCron {
  private readonly logger = new Logger(StandsTokenLifecycleCron.name);

  constructor(private readonly standsService: StandsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleCron(): Promise<void> {
    this.logger.log('A aplicar transições de estado de subscrição (ativo → em_carencia → expirado)...');
    await this.standsService.applyTokenLifecycleTransitions();
  }
}
