import { Controller, Get, UseGuards } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { Public } from '../common/decorators/public.decorator';

// Painel de super-admin (mesmo padrão de /admin/stands e
// /admin/platform-entity-config): leitura de todas as sugestões.
@Public()
@UseGuards(AdminApiKeyGuard)
@Controller('admin/suggestions')
export class SuggestionsAdminController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Get()
  list() {
    return this.suggestionsService.list();
  }
}
