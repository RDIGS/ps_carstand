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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { FinanceService } from './finance.service';
import { FinanceStatementService } from './finance-statement.service';
import { InvoiceExtractionService } from '../ocr/invoice-extraction.service';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto';
import { UpdateFinanceEntryDto } from './dto/update-finance-entry.dto';
import { FinanceSummaryQueryDto } from './dto/finance-summary-query.dto';
import { FinanceEntriesQueryDto } from './dto/finance-entries-query.dto';
import { FinanceStatementQueryDto } from './dto/finance-statement-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/types/jwt-payload.interface';
import { assertIsImageBuffer } from '../common/utils/image-signature.util';

@Controller('finance')
@UseGuards(RolesGuard)
@Roles('owner')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly statementService: FinanceStatementService,
    private readonly invoiceExtraction: InvoiceExtractionService,
  ) {}

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

  // Contas a pagar/receber — secção nova, 2026-09-08.
  @Get('contas-pendentes')
  contasPendentes(@CurrentUser() user: JwtPayload) {
    return this.financeService.contasPendentes(user);
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

  // Transitório, nunca grava (mesmo padrão de extract-identity em
  // SalesController) — lê a foto da fatura/recibo via Gemini e devolve os
  // campos para pré-preencher o formulário (despesa geral ou de veículo,
  // os campos são os mesmos para os dois). Cada chamada custa dinheiro.
  @Post('extract-invoice')
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @UseInterceptors(FileInterceptor('foto', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  async extractInvoice(@UploadedFile() foto?: Express.Multer.File) {
    if (!foto) {
      return { error: 'campos_em_falta', message: 'É necessário enviar uma imagem.' };
    }
    assertIsImageBuffer(foto.buffer);
    return this.invoiceExtraction.extract(foto.buffer.toString('base64'));
  }

  // Comprovativo/fatura do lançamento — mesmo padrão do upload de fotos de
  // veículo (VehiclesController).
  @Post('entries/:id/comprovativo')
  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @UseInterceptors(FileInterceptor('foto', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  uploadComprovativo(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    if (!foto) {
      return { error: 'campos_em_falta', message: 'É necessário enviar uma imagem.' };
    }
    assertIsImageBuffer(foto.buffer);
    return this.financeService.uploadComprovativo(user, id, foto.buffer);
  }

  @Delete('entries/:id/comprovativo')
  removeComprovativo(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.financeService.removeComprovativo(user, id);
  }

  // Extrato mensal (PDF + CSV) — secção nova, 2026-09-07.
  @Get('statement')
  statement(@CurrentUser() user: JwtPayload, @Query() query: FinanceStatementQueryDto) {
    return this.statementService.generate(user, query.ano, query.mes);
  }
}
