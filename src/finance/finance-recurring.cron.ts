import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';

// Gera automaticamente o lançamento do mês seguinte para cada despesa geral
// marcada `recorrente = true` (ex.: renda) — pedido do utilizador, 2026-09-07,
// para não ter de repetir despesas fixas todos os meses. Cada cópia sai
// também `recorrente = true`, por isso o mês seguinte encontra-a A ELA (já
// não a original, que deixa de estar "no mês anterior") — cadeia
// auto-sustentada, sem precisar de nenhuma coluna extra a ligar as cópias.
@Injectable()
export class FinanceRecurringCron {
  private readonly logger = new Logger(FinanceRecurringCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleCron(): Promise<void> {
    const agora = new Date();
    await this.gerarLancamentosDoMes(agora.getUTCFullYear(), agora.getUTCMonth() + 1);
  }

  // Separado do @Cron para poder ser testado diretamente (chamar com um
  // ano/mês à escolha) sem esperar pelo dia 1 do mês.
  async gerarLancamentosDoMes(ano: number, mes: number): Promise<void> {
    const inicioMesAtual = new Date(Date.UTC(ano, mes - 1, 1));
    const inicioMesAnterior = new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 10);
    const fimMesAnterior = new Date(Date.UTC(ano, mes - 1, 0)).toISOString().slice(0, 10);
    const dataMesAtual = inicioMesAtual.toISOString().slice(0, 10);

    this.logger.log(`A gerar lançamentos recorrentes de ${dataMesAtual} (a partir de ${inicioMesAnterior}..${fimMesAnterior})...`);

    const stands = await this.prisma.stand.findMany({ select: { schemaName: true } });
    for (const stand of stands) {
      const inseridos = await this.tenant.query(
        stand.schemaName,
        `INSERT INTO finance_entries (tipo, categoria, valor, descricao, data, criado_por, metodo_pagamento, pago_por, recorrente)
         SELECT origem.tipo, origem.categoria, origem.valor, origem.descricao, $3::date, origem.criado_por,
                origem.metodo_pagamento, origem.pago_por, true
         FROM finance_entries origem
         WHERE origem.recorrente = true
           AND origem.data BETWEEN $1 AND $2
           AND NOT EXISTS (
             SELECT 1 FROM finance_entries dup
             WHERE dup.recorrente = true AND dup.data = $3::date
               AND dup.categoria IS NOT DISTINCT FROM origem.categoria
               AND dup.descricao IS NOT DISTINCT FROM origem.descricao
               AND dup.valor = origem.valor
           )
         RETURNING id`,
        [inicioMesAnterior, fimMesAnterior, dataMesAtual],
      );
      if (inseridos.length > 0) {
        this.logger.log(`${stand.schemaName}: ${inseridos.length} lançamento(s) recorrente(s) gerado(s).`);
      }
    }
  }
}
