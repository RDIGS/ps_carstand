import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/types/jwt-payload.interface';

// Sem @Roles: owner e vendedor podem ambos enviar sugestões.
@Controller('suggestions')
@UseGuards(RolesGuard)
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSuggestionDto) {
    return this.suggestionsService.create(user, dto.texto);
  }
}
