import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto';
import { UpdateFinanceEntryDto } from './dto/update-finance-entry.dto';
import { FinanceSummaryQueryDto } from './dto/finance-summary-query.dto';
import { FinanceEntriesQueryDto } from './dto/finance-entries-query.dto';
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
  summary(@CurrentUser() user: JwtPayload, @Query() query: FinanceSummaryQueryDto) {
    return this.financeService.summary(user, query);
  }

  @Get('evolution')
  evolution(@CurrentUser() user: JwtPayload, @Query('meses') meses?: string) {
    return this.financeService.evolution(user, meses ? Number(meses) : undefined);
  }

  @Get('stock-potencial')
  stockPotencial(@CurrentUser() user: JwtPayload) {
    return this.financeService.stockPotencial(user);
  }

  @Get('entries')
  listEntries(@CurrentUser() user: JwtPayload, @Query() query: FinanceEntriesQueryDto) {
    return this.financeService.listEntries(user, query);
  }

  @Post('entries')
  createEntry(@CurrentUser() user: JwtPayload, @Body() dto: CreateFinanceEntryDto) {
    return this.financeService.createEntry(user, dto);
  }

  @Patch('entries/:id')
  updateEntry(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinanceEntryDto,
  ) {
    return this.financeService.updateEntry(user, id, dto);
  }

  @Delete('entries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEntry(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.financeService.removeEntry(user, id);
  }
}
