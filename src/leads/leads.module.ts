import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsRepository } from './leads.repository';
import { LeadsController } from './leads.controller';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, LeadsRepository],
})
export class LeadsModule {}
