import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { StandsService } from './stands.service';
import { CreateStandDto } from './dto/create-stand.dto';
import { UpdateStandDto } from './dto/update-stand.dto';
import { UpdateStandTokenDto } from './dto/update-stand-token.dto';
import { RegisterStandPaymentDto } from './dto/register-stand-payment.dto';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { Public } from '../common/decorators/public.decorator';

// Painel de super-admin (secção 12.4) — autenticado por chave, não por JWT de stand.
@Public()
@UseGuards(AdminApiKeyGuard)
@Controller('admin/stands')
export class StandsController {
  constructor(private readonly standsService: StandsService) {}

  @Post()
  create(@Body() dto: CreateStandDto) {
    return this.standsService.create(dto);
  }

  @Get()
  list() {
    return this.standsService.list();
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStandDto) {
    return this.standsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.standsService.remove(id);
  }

  @Patch(':id/token')
  updateToken(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStandTokenDto) {
    return this.standsService.updateToken(id, dto);
  }

  @Post(':id/payments')
  registerPayment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RegisterStandPaymentDto) {
    return this.standsService.registerPayment(id, dto);
  }

  @Get(':id/payments')
  listPayments(@Param('id', ParseUUIDPipe) id: string) {
    return this.standsService.listPayments(id);
  }
}
