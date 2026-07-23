import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/types/jwt-payload.interface';

@Controller('audit')
@UseGuards(RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('owner')
  list(
    @CurrentUser() user: JwtPayload,
    @Query('entidade') entidade?: string,
    @Query('entidade_id') entidadeId?: string,
  ) {
    return this.auditService.list(user.schemaName, { entidade, entidadeId });
  }
}
