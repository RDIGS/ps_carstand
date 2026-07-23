import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ChecklistService } from './checklist.service';
import { ApplyTemplateDto } from './dto/apply-template.dto';
import { AddChecklistItemDto } from './dto/add-item.dto';
import { UpdateChecklistItemDto } from './dto/update-item.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/jwt-payload.interface';

// Checklist por veículo (secção 25) — operacional (preparação do carro), por
// isso aberto a owner e vendedor, ao contrário da criação de modelos.
@Controller('vehicles/:vehicleId/checklist')
export class VehicleChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Param('vehicleId', ParseUUIDPipe) vehicleId: string) {
    return this.checklistService.listVehicleChecklist(user, vehicleId);
  }

  @Post('apply-template')
  applyTemplate(
    @CurrentUser() user: JwtPayload,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() dto: ApplyTemplateDto,
  ) {
    return this.checklistService.applyTemplate(user, vehicleId, dto.templateId);
  }

  @Post('items')
  addItem(
    @CurrentUser() user: JwtPayload,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() dto: AddChecklistItemDto,
  ) {
    return this.checklistService.addAdhocItem(user, vehicleId, dto.descricao);
  }

  @Patch(':itemId')
  updateItem(
    @CurrentUser() user: JwtPayload,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.checklistService.setItemConcluido(user, itemId, dto.concluido);
  }
}
