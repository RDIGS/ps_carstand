import { Module } from '@nestjs/common';
import { LegalService } from './legal.service';
import { LegalController } from './legal.controller';
import { LegalAdminController } from './legal-admin.controller';

@Module({
  controllers: [LegalController, LegalAdminController],
  providers: [LegalService],
})
export class LegalModule {}
