import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { LegalService } from './legal.service';
import { UpsertPlatformEntityConfigDto } from './dto/upsert-platform-entity-config.dto';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { Public } from '../common/decorators/public.decorator';

// Painel de super-admin (secção 24.0, mesmo padrão de /admin/stands e
// /admin/app-versions): 1 única linha, editar dispara nova versão dos 3
// documentos legais automaticamente (ver LegalService.upsertConfig).
@Public()
@UseGuards(AdminApiKeyGuard)
@Controller('admin/platform-entity-config')
export class LegalAdminController {
  constructor(private readonly legalService: LegalService) {}

  @Get()
  get() {
    return this.legalService.getConfig();
  }

  @Put()
  upsert(@Body() dto: UpsertPlatformEntityConfigDto) {
    return this.legalService.upsertConfig(dto);
  }
}
