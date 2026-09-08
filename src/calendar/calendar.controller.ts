import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RespondEventDto } from './dto/respond-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { ToggleConcluidoDto } from './dto/toggle-concluido.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/jwt-payload.interface';

@Controller('calendar/events')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListEventsQueryDto) {
    return this.calendarService.list(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.calendarService.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateEventDto) {
    return this.calendarService.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventDto) {
    return this.calendarService.update(user, id, dto);
  }

  @Patch(':id/concluido')
  toggleConcluido(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleConcluidoDto,
  ) {
    return this.calendarService.toggleConcluido(user, id, dto.concluido);
  }

  // Só o próprio convidado pode responder (verificado no serviço via
  // `person_id = user.sub` na query) — não é preciso repetir aqui.
  @Post(':id/responder')
  responder(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondEventDto) {
    return this.calendarService.responder(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.calendarService.remove(user, id);
  }
}
