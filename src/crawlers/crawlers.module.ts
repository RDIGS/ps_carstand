import { Module } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { StandVirtualAdapter } from './adapters/standvirtual.adapter';
import { OlxAdapter } from './adapters/olx.adapter';
import { CustoJustoAdapter } from './adapters/custojusto.adapter';

@Module({
  providers: [CrawlerService, StandVirtualAdapter, OlxAdapter, CustoJustoAdapter],
  exports: [CrawlerService],
})
export class CrawlersModule {}
