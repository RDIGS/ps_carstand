import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/types/jwt-payload.interface';

@Controller('finance')
@UseGuards(RolesGuard)
@Roles('owner')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  summary(@CurrentUser() user: JwtPayload, @Query('periodo') periodo?: string) {
    return this.financeService.summary(user, periodo);
  }

  @Post('entries')
  createEntry(@CurrentUser() user: JwtPayload, @Body() dto: CreateFinanceEntryDto) {
    return this.financeService.createEntry(user, dto);
  }
}
