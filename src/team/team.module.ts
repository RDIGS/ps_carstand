import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { TeamAdminController } from './team-admin.controller';
import { TeamService } from './team.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [TeamController, TeamAdminController],
  providers: [TeamService],
})
export class TeamModule {}
