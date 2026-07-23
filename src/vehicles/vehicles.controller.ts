import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { VehiclesService } from './vehicles.service';
import { DuaExtractionService } from '../ocr/dua-extraction.service';
import { CrawlerService } from '../crawlers/crawler.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ReserveVehicleDto } from './dto/reserve-vehicle.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/types/jwt-payload.interface';

@Controller('vehicles')
@UseGuards(RolesGuard)
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly duaExtraction: DuaExtractionService,
    private readonly crawlerService: CrawlerService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('estado') estado?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.vehiclesService.list(user, estado, Number(page), Number(limit));
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehiclesService.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(user, dto);
  }

  @Post('from-dua')
  // Rate limit dedicado (secção 21): 20 pedidos/hora por stand — cada chamada ao Gemini custa dinheiro.
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'foto_frente', maxCount: 1 }, { name: 'foto_verso', maxCount: 1 }], {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async fromDua(
    @UploadedFiles() files: { foto_frente?: Express.Multer.File[]; foto_verso?: Express.Multer.File[] },
  ) {
    const frente = files.foto_frente?.[0];
    const verso = files.foto_verso?.[0];
    if (!frente || !verso) {
      return { error: 'campos_em_falta', message: 'É necessário enviar foto_frente e foto_verso.' };
    }
    return this.duaExtraction.extract(frente.buffer.toString('base64'), verso.buffer.toString('base64'));
  }

  // :id é gerado no cliente (ecrã de confirmação) e usado como chave — torna
  // este endpoint idempotente em caso de retry numa ligação instável (secção 5/11).
  @Post(':id/confirm')
  confirm(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.vehiclesService.create(user, dto, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(user, id, dto);
  }

  @Patch(':id/approve')
  @Roles('owner')
  approve(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehiclesService.approve(user, id);
  }

  @Patch(':id/reject')
  @Roles('owner')
  reject(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehiclesService.reject(user, id);
  }

  @Patch(':id/reserve')
  reserve(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReserveVehicleDto) {
    return this.vehiclesService.setReservado(user, id, dto.reservado);
  }

  @Post(':id/expenses')
  @Roles('owner')
  addExpense(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateExpenseDto) {
    return this.vehiclesService.addExpense(user, id, dto.categoria, dto.descricao, dto.valor);
  }

  // Só chamado quando o utilizador confirma que as fotos do DUA já estavam
  // cortadas/prontas (secção 23) — caso contrário esta rota nunca é chamada.
  @Post(':id/dua-photos')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'foto_frente', maxCount: 1 }, { name: 'foto_verso', maxCount: 1 }], {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  addDuaPhotos(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: { foto_frente?: Express.Multer.File[]; foto_verso?: Express.Multer.File[] },
  ) {
    const frente = files.foto_frente?.[0];
    const verso = files.foto_verso?.[0];
    if (!frente || !verso) {
      return { error: 'campos_em_falta', message: 'É necessário enviar foto_frente e foto_verso.' };
    }
    return this.vehiclesService.addDuaPhotos(user, id, frente.buffer, verso.buffer);
  }

  // "atualizar=true" ignora a cache e volta a fazer scraping às fontes —
  // limite dedicado para não martelar os sites de terceiros a cada toque.
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Get(':id/market-estimate')
  marketEstimate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('janela') janela?: string,
    @Query('atualizar') atualizar?: string,
  ) {
    return this.crawlerService.getEstimateForVehicle(user, id, {
      janelaAmpliada: janela === 'ampliada',
      forcarAtualizacao: atualizar === 'true',
    });
  }
}
