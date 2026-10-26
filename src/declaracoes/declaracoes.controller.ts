import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/jwt-payload.interface';
import { DeclaracoesService } from './declaracoes.service';
import { EmitirDeclaracaoDto } from './dto/emitir-declaracao.dto';

@Controller('vehicles/:id/declaracoes')
export class DeclaracoesController {
  constructor(private readonly declaracoes: DeclaracoesService) {}

  @Get()
  listar(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.declaracoes.listar(user, id);
  }

  // Cada emissão gera e guarda um PDF — limite próprio contra repetições em massa.
  @Post(':tipo')
  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  emitir(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tipo') tipo: string,
    @Body() dto: EmitirDeclaracaoDto,
  ) {
    return this.declaracoes.emitir(user, id, tipo, dto);
  }
}
