import { Controller, Get, Query } from '@nestjs/common';
import { AppVersionService } from './app-version.service';
import { Public } from '../common/decorators/public.decorator';

// Chamado pela app no arranque, antes de qualquer outro pedido (secção 22) —
// por isso é sempre público, nunca exige JWT nem token de stand.
@Public()
@Controller('app')
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  @Get('version-check')
  versionCheck(@Query('plataforma') plataforma?: string, @Query('versao_atual') versaoAtual?: string) {
    return this.appVersionService.versionCheck(plataforma, versaoAtual);
  }
}
