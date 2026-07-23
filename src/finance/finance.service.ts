import { Injectable } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { AuditService } from '../audit/audit.service';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto';
import { JwtPayload } from '../common/types/jwt-payload.interface';

function monthRange(periodo?: string): { inicio: string; fim: string } {
  const [anoStr, mesStr] = (periodo ?? '').split('-');
  const now = new Date();
  const ano = anoStr ? Number(anoStr) : now.getUTCFullYear();
  const mes = mesStr ? Number(mesStr) - 1 : now.getUTCMonth();

  const inicio = new Date(Date.UTC(ano, mes, 1));
  const fim = new Date(Date.UTC(ano, mes + 1, 0));
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
  ) {}

  async createEntry(user: JwtPayload, dto: CreateFinanceEntryDto) {
    const [entry] = await this.tenant.query(
      user.schemaName,
      `INSERT INTO finance_entries (tipo, categoria, valor, descricao, criado_por)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [dto.tipo, dto.categoria ?? null, dto.valor, dto.descricao ?? null, user.sub],
    );
    await this.audit.log(user.schemaName, {
      entidade: 'finance_entry',
      entidadeId: entry.id,
      acao: 'criado',
      valorNovo: entry,
      feitoPor: user.sub,
    });
    return entry;
  }

  // KPIs da secção 12.5 — "onde ganho dinheiro".
  async summary(user: JwtPayload, periodo?: string) {
    const { inicio, fim } = monthRange(periodo);
    const schemaName = user.schemaName;

    const [margemPorVeiculo, margemPorMarcaModelo, rankingVendedores, cashflowRows, desvioRows, mercadoRows] =
      await Promise.all([
        this.tenant.query(
          schemaName,
          `SELECT v.id, v.matricula, v.marca, v.modelo,
                  s.preco_final, v.preco_compra,
                  COALESCE((SELECT SUM(valor) FROM vehicle_expenses e WHERE e.vehicle_id = v.id), 0) AS despesas,
                  (s.preco_final - v.preco_compra - COALESCE((SELECT SUM(valor) FROM vehicle_expenses e WHERE e.vehicle_id = v.id), 0)) AS margem_real,
                  (s.data_venda - v.data_entrada_stock) AS dias_em_stock
           FROM sales s
           JOIN vehicles v ON v.id = s.vehicle_id
           WHERE s.estado = 'concluida' AND s.data_venda BETWEEN $1 AND $2
           ORDER BY s.data_venda DESC`,
          [inicio, fim],
        ),
        this.tenant.query(
          schemaName,
          `SELECT v.marca, v.modelo,
                  AVG(s.preco_final - v.preco_compra - COALESCE((SELECT SUM(valor) FROM vehicle_expenses e WHERE e.vehicle_id = v.id), 0)) AS margem_media,
                  COUNT(*) AS num_vendas
           FROM sales s
           JOIN vehicles v ON v.id = s.vehicle_id
           WHERE s.estado = 'concluida' AND s.data_venda BETWEEN $1 AND $2
           GROUP BY v.marca, v.modelo
           ORDER BY margem_media DESC`,
          [inicio, fim],
        ),
        // people vive na DB Central (schema "public"), não no schema do
        // tenant — join cross-schema com nome totalmente qualificado, que
        // ignora o search_path definido pelo TenantService (testado contra
        // o Postgres real).
        this.tenant.query(
          schemaName,
          `SELECT s.vendedor_id, p.nome AS vendedor_nome,
                  COUNT(*) AS num_vendas, SUM(s.preco_final) AS valor_total, SUM(COALESCE(s.comissao_vendedor, 0)) AS comissao_total
           FROM sales s
           LEFT JOIN public.people p ON p.id = s.vendedor_id
           WHERE s.estado = 'concluida' AND s.data_venda BETWEEN $1 AND $2
           GROUP BY s.vendedor_id, p.nome
           ORDER BY valor_total DESC`,
          [inicio, fim],
        ),
        this.tenant.query<{ receitas: string; despesas_gerais: string; vendas: string; despesas_veiculos: string; compras: string }>(
          schemaName,
          `SELECT
             COALESCE((SELECT SUM(valor) FROM finance_entries WHERE tipo = 'receita' AND data BETWEEN $1 AND $2), 0) AS receitas,
             COALESCE((SELECT SUM(valor) FROM finance_entries WHERE tipo = 'despesa' AND data BETWEEN $1 AND $2), 0) AS despesas_gerais,
             COALESCE((SELECT SUM(preco_final) FROM sales WHERE estado = 'concluida' AND data_venda BETWEEN $1 AND $2), 0) AS vendas,
             COALESCE((SELECT SUM(e.valor) FROM vehicle_expenses e JOIN sales s ON s.vehicle_id = e.vehicle_id WHERE s.estado = 'concluida' AND s.data_venda BETWEEN $1 AND $2), 0) AS despesas_veiculos,
             COALESCE((SELECT SUM(v.preco_compra) FROM sales s JOIN vehicles v ON v.id = s.vehicle_id WHERE s.estado = 'concluida' AND s.data_venda BETWEEN $1 AND $2), 0) AS compras`,
          [inicio, fim],
        ),
        this.tenant.query<{ desvio_medio: string }>(
          schemaName,
          `SELECT AVG(preco_final - v.preco_venda_recomendado) AS desvio_medio
           FROM sales s JOIN vehicles v ON v.id = s.vehicle_id
           WHERE s.estado = 'concluida' AND s.data_venda BETWEEN $1 AND $2`,
          [inicio, fim],
        ),
        this.tenant.query<{ diferenca_media: string }>(
          schemaName,
          `SELECT AVG(s.preco_final - m.preco_medio) AS diferenca_media
           FROM sales s
           JOIN vehicles v ON v.id = s.vehicle_id
           JOIN LATERAL (
             SELECT AVG(preco_medio) AS preco_medio FROM market_estimates me
             WHERE me.vehicle_id = v.id AND me.consultado_em <= s.data_venda + INTERVAL '1 day'
           ) m ON true
           WHERE s.estado = 'concluida' AND s.data_venda BETWEEN $1 AND $2 AND m.preco_medio IS NOT NULL`,
          [inicio, fim],
        ),
      ]);

    const cf = cashflowRows[0];
    const cashflow =
      Number(cf.receitas) + Number(cf.vendas) - Number(cf.despesas_gerais) - Number(cf.despesas_veiculos) - Number(cf.compras);

    return {
      periodo: { inicio, fim },
      margem_por_veiculo: margemPorVeiculo,
      margem_por_marca_modelo: margemPorMarcaModelo,
      ranking_vendedores: rankingVendedores,
      desvio_preco_recomendado_medio: desvioRows[0]?.desvio_medio ? Number(desvioRows[0].desvio_medio) : null,
      comparacao_mercado_media: mercadoRows[0]?.diferenca_media ? Number(mercadoRows[0].diferenca_media) : null,
      cashflow_do_mes: cashflow,
    };
  }
}
