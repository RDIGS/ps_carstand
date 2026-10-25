import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/jwt-payload.interface';
import { VisitsService } from './visits.service';

// Permissões (owner, ou colaborador se o stand o permitir) são verificadas
// no serviço, porque dependem de uma definição do stand e não só do role.
@Controller('visitas')
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('estado') estado?: string) {
    return this.visits.list(user, estado);
  }

  @Post(':id/aprovar')
  aprovar(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.visits.aprovar(user, id);
  }

  @Post(':id/rejeitar')
  rejeitar(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.visits.rejeitar(user, id);
  }
}
