import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ChecklistRepository } from './checklist.repository';
import { VehiclesService } from '../vehicles/vehicles.service';
import { JwtPayload } from '../common/types/jwt-payload.interface';

@Injectable()
export class ChecklistService {
  constructor(
    private readonly repo: ChecklistRepository,
    private readonly vehiclesService: VehiclesService,
  ) {}

  listTemplates(user: JwtPayload) {
    return this.repo.listTemplates(user.schemaName);
  }

  createTemplate(user: JwtPayload, nome: string, itens: string[]) {
    return this.repo.createTemplate(user.schemaName, nome, itens, user.sub);
  }

  async listVehicleChecklist(user: JwtPayload, vehicleId: string) {
    await this.vehiclesService.findOne(user, vehicleId); // 404 se não existir/visível
    return this.repo.listVehicleChecklist(user.schemaName, vehicleId);
  }

  async applyTemplate(user: JwtPayload, vehicleId: string, templateId: string) {
    await this.vehiclesService.findOne(user, vehicleId);
    const template = await this.repo.findTemplateWithItems(user.schemaName, templateId);
    if (!template) {
      throw new NotFoundException({ error: 'nao_encontrado', message: 'Modelo de checklist não encontrado.' });
    }
    if (template.itens.length === 0) {
      throw new BadRequestException({ error: 'template_vazio', message: 'Este modelo não tem itens.' });
    }
    return this.repo.applyTemplate(user.schemaName, vehicleId, templateId);
  }

  async addAdhocItem(user: JwtPayload, vehicleId: string, descricao: string) {
    await this.vehiclesService.findOne(user, vehicleId);
    return this.repo.addAdhocItem(user.schemaName, vehicleId, descricao);
  }

  async setItemConcluido(user: JwtPayload, itemId: string, concluido: boolean) {
    const updated = await this.repo.setItemConcluido(user.schemaName, itemId, concluido, user.sub);
    if (!updated) {
      throw new NotFoundException({ error: 'nao_encontrado', message: 'Item de checklist não encontrado.' });
    }
    return updated;
  }
}
