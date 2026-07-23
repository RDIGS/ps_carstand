import { Injectable } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

export interface VehicleListFilters {
  estados: string[];
  page: number;
  limit: number;
}

@Injectable()
export class VehiclesRepository {
  constructor(private readonly tenant: TenantService) {}

  async findMany(schemaName: string, filters: VehicleListFilters) {
    const offset = (filters.page - 1) * filters.limit;
    const rows = await this.tenant.query(
      schemaName,
      `SELECT v.*,
              (SELECT url FROM vehicle_photos p WHERE p.vehicle_id = v.id AND p.tipo = 'foto_viatura' ORDER BY p.criado_em ASC LIMIT 1) AS foto_capa,
              COALESCE((COALESCE(s.data_venda, CURRENT_DATE) - v.data_entrada_stock), 0)::int AS dias_em_stock,
              (SELECT COUNT(*) FROM vehicle_checklist_items c WHERE c.vehicle_id = v.id)::int AS checklist_total,
              (SELECT COUNT(*) FROM vehicle_checklist_items c WHERE c.vehicle_id = v.id AND c.concluido)::int AS checklist_concluidos
       FROM vehicles v
       LEFT JOIN sales s ON s.vehicle_id = v.id AND s.estado = 'concluida'
       WHERE v.estado = ANY($1)
       ORDER BY v.criado_em DESC
       LIMIT $2 OFFSET $3`,
      [filters.estados, filters.limit, offset],
    );

    const [{ count }] = await this.tenant.query<{ count: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS count FROM vehicles WHERE estado = ANY($1)`,
      [filters.estados],
    );

    return { rows, totalItems: Number(count) };
  }

  async findById(schemaName: string, id: string) {
    const rows = await this.tenant.query(schemaName, `SELECT * FROM vehicles WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async insert(schemaName: string, id: string | null, dto: CreateVehicleDto, criadoPor: string, estado: string) {
    const rows = await this.tenant.query(
      schemaName,
      `INSERT INTO vehicles (
         id, matricula, marca, modelo, versao, data_primeira_matricula, chassis, categoria,
         combustivel, cilindrada, potencia_kw, peso_tara, peso_bruto, cor, num_lugares, kms,
         preco_compra, preco_venda_recomendado, estado, origem, importado, matricula_anterior,
         pais_origem_anterior, data_primeira_matricula_original, possivel_importado, criado_por
       ) VALUES (
         COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14, $15, $16,
         $17, $18, $19, $20, $21, $22,
         $23, $24, $25, $26
       )
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [
        id,
        dto.matricula,
        dto.marca,
        dto.modelo,
        dto.versao ?? null,
        dto.dataPrimeiraMatricula ?? null,
        dto.chassis ?? null,
        dto.categoria ?? null,
        dto.combustivel ?? null,
        dto.cilindrada ?? null,
        dto.potenciaKw ?? null,
        dto.pesoTara ?? null,
        dto.pesoBruto ?? null,
        dto.cor ?? null,
        dto.numLugares ?? null,
        dto.kms,
        dto.precoCompra ?? null,
        dto.precoVendaRecomendado ?? null,
        estado,
        dto.origem,
        dto.importado ?? false,
        dto.matriculaAnterior ?? null,
        dto.paisOrigemAnterior ?? null,
        dto.dataPrimeiraMatriculaOriginal ?? null,
        dto.possivelImportado ?? false,
        criadoPor,
      ],
    );
    return rows[0] ?? null;
  }

  async update(schemaName: string, id: string, fields: Record<string, unknown>) {
    const columns = Object.keys(fields);
    if (columns.length === 0) return this.findById(schemaName, id);

    const setClauses = columns.map((col, i) => `${col} = $${i + 2}`);
    setClauses.push('atualizado_em = now()');

    const rows = await this.tenant.query(
      schemaName,
      `UPDATE vehicles SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...columns.map((c) => fields[c])],
    );
    return rows[0] ?? null;
  }

  async setEstado(schemaName: string, id: string, estado: string, aprovadoPor?: string) {
    const rows = await this.tenant.query(
      schemaName,
      `UPDATE vehicles SET estado = $2, aprovado_por = COALESCE($3, aprovado_por), atualizado_em = now()
       WHERE id = $1 RETURNING *`,
      [id, estado, aprovadoPor ?? null],
    );
    return rows[0] ?? null;
  }

  async addExpense(schemaName: string, vehicleId: string, categoria: string, descricao: string | null, valor: number, criadoPor: string) {
    const rows = await this.tenant.query(
      schemaName,
      `INSERT INTO vehicle_expenses (vehicle_id, categoria, descricao, valor, criado_por)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [vehicleId, categoria, descricao, valor, criadoPor],
    );
    return rows[0];
  }

  async addPhoto(schemaName: string, vehicleId: string, url: string, tipo: string) {
    const rows = await this.tenant.query(
      schemaName,
      `INSERT INTO vehicle_photos (vehicle_id, url, tipo) VALUES ($1, $2, $3) RETURNING *`,
      [vehicleId, url, tipo],
    );
    return rows[0];
  }
}
