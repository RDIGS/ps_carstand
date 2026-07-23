import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LegalService } from './legal.service';
import { AcceptLegalDocumentDto } from './dto/accept-legal-document.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/jwt-payload.interface';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  // Ordem importa: rotas literais (`status`) têm de vir ANTES da rota
  // parametrizada (`:tipo`), senão o Express interpreta "status" como um
  // valor de `:tipo` e esta nunca é alcançada.
  @Get('status')
  status(@CurrentUser() user: JwtPayload) {
    return this.legalService.getStatus(user);
  }

  @Post('accept')
  accept(@CurrentUser() user: JwtPayload, @Body() dto: AcceptLegalDocumentDto) {
    return this.legalService.accept(user, dto.tipo);
  }

  // Público de propósito: os Termos/Privacidade têm de poder ser lidos antes
  // de haver sessão (ex.: link no rodapé do ecrã de login/token de stand).
  @Public()
  @Get(':tipo')
  getDocument(@Param('tipo') tipo: string) {
    return this.legalService.getDocumentOrThrow(tipo);
  }
}
