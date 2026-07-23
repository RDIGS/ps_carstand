import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AppVersionService } from './app-version.service';
import { UpsertAppVersionDto } from './dto/upsert-app-version.dto';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { Public } from '../common/decorators/public.decorator';

// Painel de super-admin (secção 22, mesmo padrão de /admin/stands): define a
// versão mínima obrigatória e a recomendada por plataforma.
@Public()
@UseGuards(AdminApiKeyGuard)
@Controller('admin/app-versions')
export class AppVersionAdminController {
  constructor(private readonly appVersionService: AppVersionService) {}

  @Get()
  list() {
    return this.appVersionService.list();
  }

  @Put(':plataforma')
  upsert(@Param('plataforma') plataforma: string, @Body() dto: UpsertAppVersionDto) {
    return this.appVersionService.upsert(plataforma, dto);
  }
}
