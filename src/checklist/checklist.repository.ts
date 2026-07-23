import { Injectable } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class ChecklistRepository {
  constructor(private readonly tenant: TenantService) {}

  async listTemplates(schemaName: string) {
    return this.tenant.query(schemaName, `SELECT * FROM checklist_templates ORDER BY criado_em DESC`);
  }

  async findTemplateWithItems(schemaName: string, templateId: string) {
    const templates = await this.tenant.query<{ id: string; nome: string }>(
      schemaName,
      `SELECT * FROM checklist_templates WHERE id = $1`,
      [templateId],
    );
    if (!templates[0]) return null;
    const itens = await this.tenant.query(
      schemaName,
      `SELECT * FROM checklist_template_items WHERE checklist_template_id = $1 ORDER BY ordem`,
      [templateId],
    );
    return { ...templates[0], itens };
  }

  async createTemplate(schemaName: string, nome: string, itens: string[], criadoPor: string) {
    const client = await this.tenant.getClient(schemaName);
    try {
      await client.query('BEGIN');
      const templateResult = await client.query(
        `INSERT INTO checklist_templates (nome, criado_por) VALUES ($1, $2) RETURNING *`,
        [nome, criadoPor],
      );
      const template = templateResult.rows[0];

      const itemRows: unknown[] = [];
      for (const [index, descricao] of itens.entries()) {
        const itemResult = await client.query(
          `INSERT INTO checklist_template_items (checklist_template_id, descricao, ordem) VALUES ($1, $2, $3) RETURNING *`,
          [template.id, descricao, index],
        );
        itemRows.push(itemResult.rows[0]);
      }

      await client.query('COMMIT');
      return { ...template, itens: itemRows };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listVehicleChecklist(schemaName: string, vehicleId: string) {
    return this.tenant.query(
      schemaName,
      `SELECT * FROM vehicle_checklist_items WHERE vehicle_id = $1 ORDER BY ordem`,
      [vehicleId],
    );
  }

  // Cópia dos itens do template para o veículo (secção 25) — nunca uma
  // referência viva, editar o template depois não afeta veículos já aplicados.
  async applyTemplate(schemaName: string, vehicleId: string, templateId: string) {
    const templateItems = await this.tenant.query<{ descricao: string; ordem: number }>(
      schemaName,
      `SELECT descricao, ordem FROM checklist_template_items WHERE checklist_template_id = $1 ORDER BY ordem`,
      [templateId],
    );

    const client = await this.tenant.getClient(schemaName);
    try {
      await client.query('BEGIN');
      const inserted: unknown[] = [];
      for (const item of templateItems) {
        const result = await client.query(
          `INSERT INTO vehicle_checklist_items (vehicle_id, descricao, ordem, origem_template_id)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [vehicleId, item.descricao, item.ordem, templateId],
        );
        inserted.push(result.rows[0]);
      }
      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async addAdhocItem(schemaName: string, vehicleId: string, descricao: string) {
    const [{ max }] = await this.tenant.query<{ max: number | null }>(
      schemaName,
      `SELECT MAX(ordem) as max FROM vehicle_checklist_items WHERE vehicle_id = $1`,
      [vehicleId],
    );
    const rows = await this.tenant.query(
      schemaName,
      `INSERT INTO vehicle_checklist_items (vehicle_id, descricao, ordem) VALUES ($1, $2, $3) RETURNING *`,
      [vehicleId, descricao, (max ?? -1) + 1],
    );
    return rows[0];
  }

  async setItemConcluido(schemaName: string, itemId: string, concluido: boolean, concluidoPor: string) {
    const rows = await this.tenant.query(
      schemaName,
      `UPDATE vehicle_checklist_items
       SET concluido = $2, concluido_por = CASE WHEN $2 THEN $3::uuid ELSE NULL END,
           concluido_em = CASE WHEN $2 THEN now() ELSE NULL END
       WHERE id = $1 RETURNING *`,
      [itemId, concluido, concluidoPor],
    );
    return rows[0] ?? null;
  }
}
