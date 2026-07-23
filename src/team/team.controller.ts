import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { TeamService } from './team.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/types/jwt-payload.interface';

@Controller('team')
@UseGuards(RolesGuard)
@Roles('owner')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.teamService.list(user.standId);
  }

  @Post('invite')
  invite(@CurrentUser() user: JwtPayload, @Body() dto: InviteMemberDto) {
    return this.teamService.invite(user, dto);
  }

  @Patch(':memberId')
  update(@CurrentUser() user: JwtPayload, @Param('memberId', ParseUUIDPipe) memberId: string, @Body() dto: UpdateMemberDto) {
    return this.teamService.update(user, memberId, dto);
  }

  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.teamService.remove(user, memberId);
  }
}
