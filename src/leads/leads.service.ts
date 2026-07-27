import { Injectable, NotFoundException } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { JwtPayload } from '../common/types/jwt-payload.interface';

// CRM básico (não separado por role, como a checklist): qualquer membro do
// stand vê e gere todos os leads, não só "os seus" — normalmente é a mesma
// pessoa a atender o telefone independentemente de quem acabar por vender.
@Injectable()
export class LeadsService {
  constructor(private readonly repo: LeadsRepository) {}

  list(user: JwtPayload, estado?: string) {
    return this.repo.list(user.schemaName, estado);
  }

  async findOne(user: JwtPayload, id: string) {
    const lead = await this.repo.findById(user.schemaName, id);
    if (!lead) throw new NotFoundException({ error: 'nao_encontrado', message: 'Lead não encontrado.' });
    return lead;
  }

  create(user: JwtPayload, dto: CreateLeadDto) {
    return this.repo.create(user.schemaName, dto);
  }

  async update(user: JwtPayload, id: string, dto: UpdateLeadDto) {
    await this.findOne(user, id);

    const fields: Record<string, unknown> = {
      nome: dto.nome,
      telefone: dto.telefone,
      email: dto.email,
      origem: dto.origem,
      estado: dto.estado,
      vehicle_id: dto.vehicleId,
      vendedor_id: dto.vendedorId,
      notas: dto.notas,
      proximo_contacto: dto.proximoContacto,
    };
    const definidos = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

    return this.repo.update(user.schemaName, id, definidos);
  }

  async remove(user: JwtPayload, id: string) {
    await this.findOne(user, id);
    await this.repo.remove(user.schemaName, id);
  }
}
