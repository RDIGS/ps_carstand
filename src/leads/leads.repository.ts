import { Injectable } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsRepository {
  constructor(private readonly tenant: TenantService) {}

  async list(schemaName: string, estado?: string) {
    if (estado) {
      return this.tenant.query(
        schemaName,
        `SELECT * FROM leads WHERE estado = $1 ORDER BY proximo_contacto ASC NULLS LAST, criado_em DESC`,
        [estado],
      );
    }
    return this.tenant.query(
      schemaName,
      `SELECT * FROM leads ORDER BY proximo_contacto ASC NULLS LAST, criado_em DESC`,
    );
  }

  async findById(schemaName: string, id: string) {
    const rows = await this.tenant.query(schemaName, `SELECT * FROM leads WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async create(schemaName: string, dto: CreateLeadDto) {
    const rows = await this.tenant.query(
      schemaName,
      `INSERT INTO leads (vehicle_id, nome, telefone, email, origem, notas, proximo_contacto)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        dto.vehicleId ?? null,
        dto.nome,
        dto.telefone ?? null,
        dto.email ?? null,
        dto.origem ?? null,
        dto.notas ?? null,
        dto.proximoContacto ?? null,
      ],
    );
    return rows[0];
  }

  async update(schemaName: string, id: string, fields: Record<string, unknown>) {
    const columns = Object.keys(fields);
    if (columns.length === 0) return this.findById(schemaName, id);

    const setClauses = columns.map((col, i) => `${col} = $${i + 2}`);
    setClauses.push('atualizado_em = now()');

    const rows = await this.tenant.query(
      schemaName,
      `UPDATE leads SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...columns.map((c) => fields[c])],
    );
    return rows[0] ?? null;
  }

  async remove(schemaName: string, id: string) {
    await this.tenant.query(schemaName, `DELETE FROM leads WHERE id = $1`, [id]);
  }
}
