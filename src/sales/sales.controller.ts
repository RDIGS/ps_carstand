import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/types/jwt-payload.interface';

const FOTOS_INTERCEPTOR = FileFieldsInterceptor(
  [
    { name: 'foto_frente', maxCount: 1 },
    { name: 'foto_verso', maxCount: 1 },
  ],
  { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } },
);

@Controller('sales')
@UseGuards(RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user, dto);
  }

  // Transitório, nunca grava (secção 23) — pré-preenche o formulário de
  // venda a partir de CC ou Título de Residência. Mesmo limite do DUA:
  // cada chamada ao Gemini custa dinheiro.
  @Post('extract-identity')
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @UseInterceptors(FOTOS_INTERCEPTOR)
  async extractIdentity(
    @UploadedFiles() files: { foto_frente?: Express.Multer.File[]; foto_verso?: Express.Multer.File[] },
  ) {
    const frente = files.foto_frente?.[0];
    const verso = files.foto_verso?.[0];
    if (!frente || !verso) {
      return { error: 'campos_em_falta', message: 'É necessário enviar foto_frente e foto_verso.' };
    }
    return this.salesService.extractIdentity(frente.buffer.toString('base64'), verso.buffer.toString('base64'));
  }

  // Só chamado quando o utilizador confirma que as fotos já estavam
  // cortadas/prontas (secção 23) — caso contrário esta rota nunca é chamada
  // e nenhuma imagem chega a ser guardada.
  @Post(':id/identity-documents')
  @UseInterceptors(FOTOS_INTERCEPTOR)
  attachIdentityDocuments(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('tipoDocumento') tipoDocumento: string,
    @UploadedFiles() files: { foto_frente?: Express.Multer.File[]; foto_verso?: Express.Multer.File[] },
  ) {
    const frente = files.foto_frente?.[0];
    const verso = files.foto_verso?.[0];
    if (!frente || !verso) {
      return { error: 'campos_em_falta', message: 'É necessário enviar foto_frente e foto_verso.' };
    }
    return this.salesService.attachIdentityDocuments(user, id, tipoDocumento, frente.buffer, verso.buffer);
  }

  @Post(':id/revert')
  @Roles('owner')
  revert(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.revert(user, id);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('vendedor_id') vendedorId?: string) {
    return this.salesService.list(user, vendedorId);
  }
}
