import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { TeamService } from './team.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { Public } from '../common/decorators/public.decorator';

// Painel de super-admin: gerir a equipa de qualquer stand sem precisar de
// entrar como o respetivo owner (mesmo padrão de /admin/stands).
@Public()
@UseGuards(AdminApiKeyGuard)
@Controller('admin/stands/:standId/members')
export class TeamAdminController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  list(@Param('standId', ParseUUIDPipe) standId: string) {
    return this.teamService.list(standId);
  }

  @Post()
  invite(@Param('standId', ParseUUIDPipe) standId: string, @Body() dto: InviteMemberDto) {
    return this.teamService.inviteByStandId(standId, dto);
  }

  @Patch(':memberId')
  update(
    @Param('standId', ParseUUIDPipe) standId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.teamService.updateByStandId(standId, memberId, dto);
  }

  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('standId', ParseUUIDPipe) standId: string, @Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.teamService.removeByStandId(standId, memberId);
  }

  // Gera o código curto que o dono usa em "Esqueceste-te da password?" no
  // ecrã de login (secção 29) — resolve o caso de um owner ficar bloqueado
  // sem ninguém acima dele dentro da app.
  @Post(':memberId/reset-password-code')
  @HttpCode(HttpStatus.OK)
  generateResetCode(@Param('standId', ParseUUIDPipe) standId: string, @Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.teamService.generateResetCode(standId, memberId);
  }
}
