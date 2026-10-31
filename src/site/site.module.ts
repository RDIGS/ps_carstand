import { Module } from '@nestjs/common';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';
import { ManterAcordadoCron } from './manter-acordado.cron';

@Module({
  controllers: [SiteController],
  providers: [SiteService, ManterAcordadoCron],
})
export class SiteModule {}
