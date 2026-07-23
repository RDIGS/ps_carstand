import { Injectable } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';

export interface AuditEntry {
  entidade: string;
  entidadeId: string;
  acao: string;
  valorAnterior?: unknown;
  valorNovo?: unknown;
  feitoPor: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly tenant: TenantService) {}

  async log(schemaName: string, entry: AuditEntry): Promise<void> {
    await this.tenant.query(
      schemaName,
      `INSERT INTO audit_log (entidade, entidade_id, acao, valor_anterior, valor_novo, feito_por)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.entidade,
        entry.entidadeId,
        entry.acao,
        entry.valorAnterior ? JSON.stringify(entry.valorAnterior) : null,
        entry.valorNovo ? JSON.stringify(entry.valorNovo) : null,
        entry.feitoPor,
      ],
    );
  }

  list(schemaName: string, filters: { entidade?: string; entidadeId?: string }) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.entidade) {
      params.push(filters.entidade);
      conditions.push(`a.entidade = $${params.length}`);
    }
    if (filters.entidadeId) {
      params.push(filters.entidadeId);
      conditions.push(`a.entidade_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    // people vive na DB Central (schema "public"), não no schema do tenant —
    // join cross-schema com nome totalmente qualificado (mesmo padrão do
    // ranking de vendedores em finance.service.ts), para o ecrã de
    // auditoria mostrar quem fez a alteração em vez de só um UUID.
    return this.tenant.query(
      schemaName,
      `SELECT a.*, p.nome AS feito_por_nome
       FROM audit_log a
       LEFT JOIN public.people p ON p.id = a.feito_por
       ${where}
       ORDER BY a.criado_em DESC LIMIT 200`,
      params,
    );
  }
}
