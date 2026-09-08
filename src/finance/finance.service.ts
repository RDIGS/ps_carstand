import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto';
import { UpdateFinanceEntryDto } from './dto/update-finance-entry.dto';
import { FinanceSummaryQueryDto } from './dto/finance-summary-query.dto';
import { FinanceEntriesQueryDto } from './dto/finance-entries-query.dto';
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

// dataInicio/dataFim (intervalo livre) têm sempre prioridade sobre periodo
// (mês de calendário) — periodo fica só para compatibilidade com quem ainda
// não usa o seletor de datas novo.
function resolveRange(query: { periodo?: string; dataInicio?: string; dataFim?: string }): {
  inicio: string;
  fim: string;
} {
  if (query.dataInicio && query.dataFim) {
    return { inicio: query.dataInicio, fim: query.dataFim };
  }
  return monthRange(query.periodo);
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  // `pago_por` é um UUID solto (sem FK, ver tenant-schema.sql) — sem isto
  // aceitava qualquer UUID de `public.people`, mesmo de alguém sem ligação
  // nenhuma a este stand, e mostrava o nome dessa pessoa no extrato/detalhe
  // (achado de baixa gravidade da auditoria de segurança, corrigido a
  // pedido do utilizador). Mesma verificação que `TeamService` já faz para
  // outras operações sobre membros da equipa.
  private async assertPagoPorValido(standId: string, pagoPor?: string | null): Promise<void> {
    if (!pagoPor) return;
    const membro = await this.prisma.standMember.findFirst({ where: { personId: pagoPor, standId } });
    if (!membro) {
      throw new BadRequestException({
        error: 'pago_por_invalido',
        message: 'A pessoa selecionada não faz parte da equipa deste stand.',
      });
    }
  }

  async createEntry(user: JwtPayload, dto: CreateFinanceEntryDto) {
    await this.assertPagoPorValido(user.standId, dto.pagoPor);
    const [entry] = await this.tenant.query(
      user.schemaName,
      `INSERT INTO finance_entries
         (tipo, categoria, valor, descricao, data, criado_por, metodo_pagamento, pago_por, recorrente, fornecedor_nome, fornecedor_nif, valor_iva, taxa_iva, pago, data_vencimento)
       VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7, $8, COALESCE($9, false), $10, $11, $12, $13, COALESCE($14, true), $15) RETURNING *`,
      [
        dto.tipo,
        dto.categoria ?? null,
        dto.valor,
        dto.descricao ?? null,
        dto.data ?? null,
        user.sub,
        dto.metodoPagamento ?? null,
        dto.pagoPor ?? null,
        dto.recorrente ?? null,
        dto.fornecedorNome ?? null,
        dto.fornecedorNif ?? null,
        dto.valorIva ?? null,
        dto.taxaIva ?? null,
        dto.pago ?? null,
        dto.dataVencimento ?? null,
      ],
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

  async listEntries(user: JwtPayload, query: FinanceEntriesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;

    const params = [query.dataInicio ?? null, query.dataFim ?? null, query.tipo ?? null, query.categoria ?? null];
    const where = `
      ($1::date IS NULL OR fe.data >= $1) AND
      ($2::date IS NULL OR fe.data <= $2) AND
      ($3::text IS NULL OR fe.tipo = $3) AND
      ($4::text IS NULL OR fe.categoria = $4)
    `;

    const [rows, countRows] = await Promise.all([
      this.tenant.query(
        user.schemaName,
        // people vive na BD central — join cross-schema, mesmo padrão de
        // finance-statement.service.ts (nome de quem pagou, para o ecrã de
        // detalhe do lançamento não precisar de pedidos extra).
        `SELECT fe.*, p.nome AS pago_por_nome
         FROM finance_entries fe
         LEFT JOIN public.people p ON p.id = fe.pago_por
         WHERE ${where} ORDER BY fe.data DESC, fe.criado_em DESC LIMIT $5 OFFSET $6`,
        [...params, limit, offset],
      ),
      this.tenant.query<{ total: string }>(
        user.schemaName,
        `SELECT COUNT(*) AS total FROM finance_entries fe WHERE ${where}`,
        params,
      ),
    ]);

    return { entries: rows, total: Number(countRows[0].total), page, limit };
  }

  async updateEntry(user: JwtPayload, id: string, dto: UpdateFinanceEntryDto) {
    const [existing] = await this.tenant.query(user.schemaName, `SELECT * FROM finance_entries WHERE id = $1`, [id]);
    if (!existing) throw new NotFoundException({ error: 'nao_encontrado', message: 'Lançamento não encontrado.' });
    await this.assertPagoPorValido(user.standId, dto.pagoPor);

    const fields: Record<string, unknown> = {
      tipo: dto.tipo,
      categoria: dto.categoria,
      valor: dto.valor,
      descricao: dto.descricao,
      data: dto.data,
      metodo_pagamento: dto.metodoPagamento,
      pago_por: dto.pagoPor,
      recorrente: dto.recorrente,
      reembolsado: dto.reembolsado,
      fornecedor_nome: dto.fornecedorNome,
      fornecedor_nif: dto.fornecedorNif,
      valor_iva: dto.valorIva,
      taxa_iva: dto.taxaIva,
      pago: dto.pago,
      data_vencimento: dto.dataVencimento,
    };
    const columns = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (columns.length === 0) return existing;

    const setClauses = columns.map(([col], i) => `${col} = $${i + 2}`);
    const [updated] = await this.tenant.query(
      user.schemaName,
      `UPDATE finance_entries SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...columns.map(([, v]) => v)],
    );

    await this.audit.log(user.schemaName, {
      entidade: 'finance_entry',
      entidadeId: id,
      acao: 'atualizado',
      valorAnterior: existing,
      valorNovo: updated,
      feitoPor: user.sub,
    });
    return updated;
  }

  async removeEntry(user: JwtPayload, id: string) {
    const [existing] = await this.tenant.query(user.schemaName, `SELECT * FROM finance_entries WHERE id = $1`, [id]);
    if (!existing) throw new NotFoundException({ error: 'nao_encontrado', message: 'Lançamento não encontrado.' });

    await this.tenant.query(user.schemaName, `DELETE FROM finance_entries WHERE id = $1`, [id]);
    await this.audit.log(user.schemaName, {
      entidade: 'finance_entry',
      entidadeId: id,
      acao: 'removido',
      valorAnterior: existing,
      feitoPor: user.sub,
    });
  }

  async uploadComprovativo(user: JwtPayload, id: string, foto: Buffer) {
    const [existing] = await this.tenant.query(user.schemaName, `SELECT * FROM finance_entries WHERE id = $1`, [id]);
    if (!existing) throw new NotFoundException({ error: 'nao_encontrado', message: 'Lançamento não encontrado.' });

    const url = await this.storage.upload(`${user.schemaName}/finance/${id}/comprovativo.jpg`, foto, 'image/jpeg');
    const [updated] = await this.tenant.query(
      user.schemaName,
      `UPDATE finance_entries SET comprovativo_url = $2 WHERE id = $1 RETURNING *`,
      [id, url],
    );
    return updated;
  }

  async removeComprovativo(user: JwtPayload, id: string) {
    const [existing] = await this.tenant.query(user.schemaName, `SELECT * FROM finance_entries WHERE id = $1`, [id]);
    if (!existing) throw new NotFoundException({ error: 'nao_encontrado', message: 'Lançamento não encontrado.' });

    const [updated] = await this.tenant.query(
      user.schemaName,
      `UPDATE finance_entries SET comprovativo_url = NULL WHERE id = $1 RETURNING *`,
      [id],
    );
    return updated;
  }

  // Contas a pagar/receber (secção nova, 2026-09-08) — tudo o que ainda não
  // foi pago/recebido (`pago = false`), venha de um lançamento geral
  // (receita ou despesa) ou de uma despesa de veículo. `atrasado` é
  // calculado aqui (não em SQL) para usar sempre "hoje" na perspetiva do
  // servidor, mesmo padrão de outras contagens do dashboard.
  async contasPendentes(user: JwtPayload) {
    const rows = await this.tenant.query<{
      id: string;
      origem: 'geral' | 'veiculo';
      tipo: 'receita' | 'despesa';
      categoria: string | null;
      descricao: string | null;
      veiculo: string | null;
      veiculo_id: string | null;
      valor: string;
      data_vencimento: string | null;
    }>(
      user.schemaName,
      `SELECT fe.id, 'geral' AS origem, fe.tipo, fe.categoria, fe.descricao, NULL AS veiculo, NULL::uuid AS veiculo_id, fe.valor, fe.data_vencimento
       FROM finance_entries fe
       WHERE fe.pago = false
       UNION ALL
       SELECT ve.id, 'veiculo' AS origem, 'despesa' AS tipo, ve.categoria, ve.descricao,
              v.matricula || ' — ' || v.marca || ' ' || v.modelo AS veiculo, v.id AS veiculo_id, ve.valor, ve.data_vencimento
       FROM vehicle_expenses ve
       JOIN vehicles v ON v.id = ve.vehicle_id
       WHERE ve.pago = false
       ORDER BY data_vencimento NULLS LAST`,
    );

    const hoje = new Date().toISOString().slice(0, 10);
    const itens = rows.map((r) => ({
      id: r.id,
      origem: r.origem,
      tipo: r.tipo,
      categoria: r.categoria,
      descricao: r.descricao,
      veiculo: r.veiculo,
      veiculoId: r.veiculo_id,
      valor: Number(r.valor),
      dataVencimento: r.data_vencimento,
      atrasado: r.data_vencimento != null && r.data_vencimento < hoje,
    }));

    const emSeteDias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const somaSe = (filtro: (i: (typeof itens)[number]) => boolean) =>
      itens.filter(filtro).reduce((acc, i) => acc + i.valor, 0);

    return {
      itens,
      resumo: {
        totalPendente: somaSe(() => true),
        totalEmAtraso: somaSe((i) => i.atrasado),
        totalAVencerEm7Dias: somaSe((i) => !i.atrasado && i.dataVencimento != null && i.dataVencimento <= emSeteDias),
      },
    };
  }

  // KPIs da secção 12.5 — "onde ganho dinheiro". vendedorId/marca/modelo
  // filtram as 5 tabelas itemizáveis; o cashflow fica sempre ao nível do
  // stand todo (despesas gerais não são atribuíveis a 1 vendedor/modelo).
  async summary(user: JwtPayload, query: FinanceSummaryQueryDto) {
    const { inicio, fim } = resolveRange(query);
    const schemaName = user.schemaName;
    const vendedorId = query.vendedorId ?? null;
    const marca = query.marca ?? null;
    const modelo = query.modelo ?? null;
    // $1 inicio, $2 fim, $3 vendedorId, $4 marca, $5 modelo — passthrough
    // NULL em todas as queries itemizáveis, para não ter de montar SQL
    // dinamicamente por combinação de filtros.
    const filtroParams = [inicio, fim, vendedorId, marca, modelo];
    const filtroVendedorMarcaModelo = `
      AND ($3::uuid IS NULL OR s.vendedor_id = $3)
      AND ($4::text IS NULL OR v.marca ILIKE $4)
      AND ($5::text IS NULL OR v.modelo ILIKE $5)
    `;

    // Corre as 8 queries sequencialmente numa única ligação em vez de
    // Promise.all (uma ligação por query em paralelo) — o pooler do Supabase
    // está limitado a 15 ligações no total, partilhadas com tudo o resto
    // (produção, sessões locais, cron de backup); 8 ligações simultâneas só
    // para este endpoint era o suficiente para esgotar o pool sozinho e
    // devolver EMAXCONNSESSION mesmo sem grande concorrência real. Perde-se
    // algum paralelismo, mas o schema de tenant é pequeno — o custo real é
    // baixo.
    const client = await this.tenant.getClient(schemaName);
    let margemPorVeiculo,
      margemPorMarcaModelo,
      rankingVendedores,
      cashflowRows,
      desvioRows,
      mercadoRows,
      despesasGeraisPorCategoria,
      despesasVeiculosPorCategoria;
    try {
      ({ rows: margemPorVeiculo } = await client.query(
        `SELECT v.id, v.matricula, v.marca, v.modelo,
                s.preco_final, v.preco_compra,
                COALESCE((SELECT SUM(valor) FROM vehicle_expenses e WHERE e.vehicle_id = v.id), 0) AS despesas,
                (s.preco_final - v.preco_compra - COALESCE((SELECT SUM(valor) FROM vehicle_expenses e WHERE e.vehicle_id = v.id), 0)) AS margem_real,
                (s.data_venda - v.data_entrada_stock) AS dias_em_stock
         FROM sales s
         JOIN vehicles v ON v.id = s.vehicle_id
         WHERE s.estado = 'concluida' AND s.data_venda BETWEEN $1 AND $2
         ${filtroVendedorMarcaModelo}
         ORDER BY s.data_venda DESC`,
        filtroParams,
      ));

      ({ rows: margemPorMarcaModelo } = await client.query(
        `SELECT v.marca, v.modelo,
                AVG(s.preco_final - v.preco_compra - COALESCE((SELECT SUM(valor) FROM vehicle_expenses e WHERE e.vehicle_id = v.id), 0)) AS margem_media,
                COUNT(*) AS num_vendas
         FROM sales s
         JOIN vehicles v ON v.id = s.vehicle_id
         WHERE s.estado = 'concluida' AND s.data_venda BETWEEN $1 AND $2
         ${filtroVendedorMarcaModelo}
         GROUP BY v.marca, v.modelo
         ORDER BY margem_media DESC`,
        filtroParams,
      ));

      // people vive na DB Central (schema "public"), não no schema do
      // tenant — join cross-schema com nome totalmente qualificado, que
      // ignora o search_path definido pelo TenantService (testado contra
      // o Postgres real).
      ({ rows: rankingVendedores } = await client.query(
        `SELECT s.vendedor_id, p.nome AS vendedor_nome,
                COUNT(*) AS num_vendas, SUM(s.preco_final) AS valor_total, SUM(COALESCE(s.comissao_vendedor, 0)) AS comissao_total
         FROM sales s
         JOIN vehicles v ON v.id = s.vehicle_id
         LEFT JOIN public.people p ON p.id = s.vendedor_id
         WHERE s.estado = 'concluida' AND s.data_venda BETWEEN $1 AND $2
         ${filtroVendedorMarcaModelo}
         GROUP BY s.vendedor_id, p.nome
         ORDER BY valor_total DESC`,
        filtroParams,
      ));

      // Cashflow (corrigido 2026-07-27): usa sempre a data REAL do
      // movimento (data do lançamento / data de entrada em stock / data
      // da despesa), nunca a data da venda — antes disto, comprar um
      // carro em janeiro e vendê-lo em março aparecia como despesa de
      // março, desalinhando o KPI sempre que o carro fica em stock mais
      // de um mês (caso normal do negócio). Nunca filtrado por
      // vendedor/marca/modelo — é sempre o cashflow do stand todo.
      ({ rows: cashflowRows } = await client.query<{
        receitas: string;
        despesas_gerais: string;
        vendas: string;
        despesas_veiculos: string;
        compras: string;
      }>(
        `SELECT
           COALESCE((SELECT SUM(valor) FROM finance_entries WHERE tipo = 'receita' AND pago = true AND data BETWEEN $1 AND $2), 0) AS receitas,
           COALESCE((SELECT SUM(valor) FROM finance_entries WHERE tipo = 'despesa' AND pago = true AND data BETWEEN $1 AND $2), 0) AS despesas_gerais,
           COALESCE((SELECT SUM(preco_final) FROM sales WHERE estado = 'concluida' AND data_venda BETWEEN $1 AND $2), 0) AS vendas,
           COALESCE((SELECT SUM(valor) FROM vehicle_expenses WHERE pago = true AND data BETWEEN $1 AND $2), 0) AS despesas_veiculos,
           COALESCE((SELECT SUM(preco_compra) FROM vehicles WHERE data_entrada_stock BETWEEN $1 AND $2), 0) AS compras`,
        [inicio, fim],
      ));

      ({ rows: desvioRows } = await client.query<{ desvio_medio: string }>(
        `SELECT AVG(preco_final - v.preco_venda_recomendado) AS desvio_medio
         FROM sales s JOIN vehicles v ON v.id = s.vehicle_id
         WHERE s.estado = 'concluida' AND s.data_venda BETWEEN $1 AND $2
         ${filtroVendedorMarcaModelo}`,
        filtroParams,
      ));

      ({ rows: mercadoRows } = await client.query<{ diferenca_media: string }>(
        `SELECT AVG(s.preco_final - m.preco_medio) AS diferenca_media
         FROM sales s
         JOIN vehicles v ON v.id = s.vehicle_id
         JOIN LATERAL (
           SELECT AVG(preco_medio) AS preco_medio FROM market_estimates me
           WHERE me.vehicle_id = v.id AND me.consultado_em <= s.data_venda + INTERVAL '1 day'
         ) m ON true
         WHERE s.estado = 'concluida' AND s.data_venda BETWEEN $1 AND $2 AND m.preco_medio IS NOT NULL
         ${filtroVendedorMarcaModelo}`,
        filtroParams,
      ));

      // Despesas GERAIS da empresa (renda, salários, marketing, ...) —
      // nada a ver com veículos. Pedido explícito do utilizador: os dois
      // tipos de despesa (gerais vs. por veículo) têm de ficar sempre
      // visíveis em separado, nunca só somados escondidos no cashflow.
      ({ rows: despesasGeraisPorCategoria } = await client.query<{ categoria: string | null; total: string }>(
        `SELECT categoria, SUM(valor) AS total
         FROM finance_entries
         WHERE tipo = 'despesa' AND pago = true AND data BETWEEN $1 AND $2
         GROUP BY categoria
         ORDER BY total DESC`,
        [inicio, fim],
      ));

      // Despesas POR VEÍCULO (reparação, transporte, legalização, limpeza)
      // — estas sim respeitam marca/modelo (não vendedor, despesa não é
      // atribuível a quem vendeu o carro).
      ({ rows: despesasVeiculosPorCategoria } = await client.query<{ categoria: string | null; total: string }>(
        `SELECT e.categoria, SUM(e.valor) AS total
         FROM vehicle_expenses e
         JOIN vehicles v ON v.id = e.vehicle_id
         WHERE e.pago = true AND e.data BETWEEN $1 AND $2
         -- $3 (vendedorId) não se aplica aqui de propósito (despesa não é
         -- atribuível a quem vendeu o carro) — a referência a ::uuid serve
         -- só para o Postgres conseguir inferir o tipo do parâmetro.
         AND ($3::uuid IS NULL OR TRUE)
         AND ($4::text IS NULL OR v.marca ILIKE $4)
         AND ($5::text IS NULL OR v.modelo ILIKE $5)
         GROUP BY e.categoria
         ORDER BY total DESC`,
        filtroParams,
      ));
    } finally {
      client.release();
    }

    const cf = cashflowRows[0];
    const cashflow =
      Number(cf.receitas) + Number(cf.vendas) - Number(cf.despesas_gerais) - Number(cf.despesas_veiculos) - Number(cf.compras);

    return {
      periodo: { inicio, fim },
      filtros: { vendedorId, marca, modelo },
      despesas_gerais_por_categoria: despesasGeraisPorCategoria.map((r) => ({ categoria: r.categoria, total: Number(r.total) })),
      despesas_veiculos_por_categoria: despesasVeiculosPorCategoria.map((r) => ({ categoria: r.categoria, total: Number(r.total) })),
      margem_por_veiculo: margemPorVeiculo,
      margem_por_marca_modelo: margemPorMarcaModelo,
      ranking_vendedores: rankingVendedores,
      desvio_preco_recomendado_medio: desvioRows[0]?.desvio_medio ? Number(desvioRows[0].desvio_medio) : null,
      comparacao_mercado_media: mercadoRows[0]?.diferenca_media ? Number(mercadoRows[0].diferenca_media) : null,
      cashflow_do_mes: cashflow,
    };
  }

  // Série mensal (mesma lógica corrigida de datas do summary) para o
  // gráfico de tendência — sem isto só era possível ver 1 mês de cada vez,
  // nunca perceber se o negócio está a melhorar ou a piorar ao longo do
  // tempo.
  async evolution(user: JwtPayload, meses = 12) {
    const numMeses = Math.min(Math.max(meses, 1), 36);
    const now = new Date();
    const inicioSerie = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (numMeses - 1), 1))
      .toISOString()
      .slice(0, 10);

    const rows = await this.tenant.query<{
      periodo: string;
      receitas: string;
      despesas_gerais: string;
      vendas: string;
      despesas_veiculos: string;
      compras: string;
      num_vendas: string;
    }>(
      user.schemaName,
      `WITH meses AS (
         SELECT date_trunc('month', $1::date) + (n || ' month')::interval AS mes
         FROM generate_series(0, $2::int - 1) AS n
       )
       SELECT
         to_char(mes, 'YYYY-MM') AS periodo,
         COALESCE((SELECT SUM(valor) FROM finance_entries WHERE tipo = 'receita' AND pago = true AND date_trunc('month', data) = mes), 0) AS receitas,
         COALESCE((SELECT SUM(valor) FROM finance_entries WHERE tipo = 'despesa' AND pago = true AND date_trunc('month', data) = mes), 0) AS despesas_gerais,
         COALESCE((SELECT SUM(preco_final) FROM sales WHERE estado = 'concluida' AND date_trunc('month', data_venda) = mes), 0) AS vendas,
         COALESCE((SELECT SUM(valor) FROM vehicle_expenses WHERE pago = true AND date_trunc('month', data) = mes), 0) AS despesas_veiculos,
         COALESCE((SELECT SUM(preco_compra) FROM vehicles WHERE date_trunc('month', data_entrada_stock) = mes), 0) AS compras,
         COALESCE((SELECT COUNT(*) FROM sales WHERE estado = 'concluida' AND date_trunc('month', data_venda) = mes), 0) AS num_vendas
       FROM meses
       ORDER BY mes`,
      [inicioSerie, numMeses],
    );

    return rows.map((r) => {
      const cashflow =
        Number(r.receitas) + Number(r.vendas) - Number(r.despesas_gerais) - Number(r.despesas_veiculos) - Number(r.compras);
      return {
        periodo: r.periodo,
        vendas: Number(r.vendas),
        num_vendas: Number(r.num_vendas),
        cashflow,
      };
    });
  }

  // Margem projetada do que ainda está em stock (disponível/reservado) —
  // antes só se via margem de veículos já vendidos, nunca uma estimativa do
  // que falta ganhar com o que já está parado no stand.
  async stockPotencial(user: JwtPayload) {
    const rows = await this.tenant.query<{
      id: string;
      matricula: string;
      marca: string;
      modelo: string;
      preco_compra: string | null;
      preco_venda_recomendado: string | null;
      despesas: string;
      margem_potencial: string;
      dias_em_stock: number;
    }>(
      user.schemaName,
      `SELECT v.id, v.matricula, v.marca, v.modelo, v.preco_compra, v.preco_venda_recomendado,
              COALESCE((SELECT SUM(valor) FROM vehicle_expenses e WHERE e.vehicle_id = v.id), 0) AS despesas,
              (COALESCE(v.preco_venda_recomendado, 0) - COALESCE(v.preco_compra, 0) -
               COALESCE((SELECT SUM(valor) FROM vehicle_expenses e WHERE e.vehicle_id = v.id), 0)) AS margem_potencial,
              (CURRENT_DATE - v.data_entrada_stock) AS dias_em_stock
       FROM vehicles v
       WHERE v.estado IN ('disponivel', 'reservado')
       ORDER BY margem_potencial DESC NULLS LAST`,
    );

    const totalMargemPotencial = rows.reduce((acc, r) => acc + Number(r.margem_potencial), 0);
    return { veiculos: rows, total_margem_potencial: totalMargemPotencial };
  }
}
