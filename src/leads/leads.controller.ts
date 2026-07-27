import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/jwt-payload.interface';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('estado') estado?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.leadsService.list(user, estado, Number(page), Number(limit));
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.remove(user, id);
  }
}
