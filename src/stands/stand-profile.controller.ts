import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { StandsService } from './stands.service';
import { UpdateStandProfileDto } from './dto/update-stand-profile.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/types/jwt-payload.interface';

// Perfil público da loja (contacto/redes sociais, usado no gerador de banner
// de venda) — self-service pelo próprio owner, distinto do StandsController
// (esse é o painel de super-admin, autenticado por chave, não por JWT).
@Controller('stands/me')
@UseGuards(RolesGuard)
export class StandProfileController {
  constructor(private readonly standsService: StandsService) {}

  // Leitura: owner e vendedor (o vendedor também gera banners e precisa do
  // contacto/@handle já guardados, só não pode editá-los).
  @Get()
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.standsService.getProfile(user.standId);
  }

  @Patch()
  @Roles('owner')
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateStandProfileDto) {
    return this.standsService.updateProfile(user.standId, dto);
  }
}
