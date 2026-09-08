import { Injectable } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { StorageService } from '../storage/storage.service';
import { JwtPayload } from '../common/types/jwt-payload.interface';
import { ExtratoDespesaLinha, ExtratoMensalData, ExtratoVendaLinha, generateExtratoMensalPdf } from './templates/extrato-mensal.template';
import { ExtratoCsvLinha, generateExtratoMensalCsv } from './templates/extrato-mensal.csv';

const MESES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function formatarData(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

interface FinanceEntryRow {
  id: string;
  tipo: 'receita' | 'despesa';
  categoria: string | null;
  descricao: string | null;
  valor: string;
  data: string;
  metodo_pagamento: string | null;
  pago_por_nome: string | null;
  reembolsado: boolean;
  comprovativo_url: string | null;
  fornecedor_nome: string | null;
  fornecedor_nif: string | null;
  valor_iva: string | null;
  taxa_iva: string | null;
}

interface VehicleExpenseRow {
  id: string;
  categoria: string | null;
  descricao: string | null;
  valor: string;
  data: string;
  metodo_pagamento: string | null;
  pago_por_nome: string | null;
  reembolsado: boolean;
  comprovativo_url: string | null;
  fornecedor_nome: string | null;
  fornecedor_nif: string | null;
  valor_iva: string | null;
  taxa_iva: string | null;
  matricula: string;
  marca: string;
  modelo: string;
}

interface SaleRow {
  data_venda: string;
  preco_final: string;
  preco_compra: string;
  comprador_nome: string;
  matricula: string;
  marca: string;
  modelo: string;
  despesas_veiculo: string;
}

@Injectable()
export class FinanceStatementService {
  constructor(
    private readonly tenant: TenantService,
    private readonly storage: StorageService,
  ) {}

  async generate(user: JwtPayload, ano: number, mes: number) {
    const inicio = new Date(Date.UTC(ano, mes - 1, 1)).toISOString().slice(0, 10);
    const fim = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
    const schemaName = user.schemaName;

    const client = await this.tenant.getClient(schemaName);
    let entryRows: FinanceEntryRow[],
      expenseRows: VehicleExpenseRow[],
      saleRows: SaleRow[],
      standRows: { nome: string }[],
      comprasRows: { total: string }[];
    try {
      // people vive na BD central (schema "public") — join cross-schema com
      // nome totalmente qualificado, mesmo padrão já usado em
      // finance.service.ts::summary() (ranking de vendedores).
      // Extrato reflete movimentos de caixa reais deste mês — uma despesa/
      // receita pendente (`pago = false`, ver secção "contas a pagar")
      // ainda não é dinheiro que se moveu, fica de fora até ser paga.
      ({ rows: entryRows } = await client.query(
        `SELECT fe.*, p.nome AS pago_por_nome
         FROM finance_entries fe
         LEFT JOIN public.people p ON p.id = fe.pago_por
         WHERE fe.pago = true AND fe.data BETWEEN $1 AND $2
         ORDER BY fe.data`,
        [inicio, fim],
      ));

      ({ rows: expenseRows } = await client.query(
        `SELECT ve.*, v.matricula, v.marca, v.modelo, p.nome AS pago_por_nome
         FROM vehicle_expenses ve
         JOIN vehicles v ON v.id = ve.vehicle_id
         LEFT JOIN public.people p ON p.id = ve.pago_por
         WHERE ve.pago = true AND ve.data BETWEEN $1 AND $2
         ORDER BY ve.data`,
        [inicio, fim],
      ));

      ({ rows: saleRows } = await client.query(
        `SELECT s.data_venda, s.preco_final, v.preco_compra, s.comprador_nome, v.matricula, v.marca, v.modelo,
                COALESCE((SELECT SUM(valor) FROM vehicle_expenses e WHERE e.vehicle_id = v.id), 0) AS despesas_veiculo
         FROM sales s
         JOIN vehicles v ON v.id = s.vehicle_id
         WHERE s.estado = 'concluida' AND s.data_venda BETWEEN $1 AND $2
         ORDER BY s.data_venda`,
        [inicio, fim],
      ));

      ({ rows: standRows } = await client.query(`SELECT nome FROM public.stands WHERE id = $1`, [user.standId]));

      // Custo dos veículos comprados neste período (entrada em stock) —
      // mesma definição de "compras" já usada no cashflow do dashboard
      // (finance.service.ts::summary()), para os dois números baterem certo.
      ({ rows: comprasRows } = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(preco_compra), 0) AS total FROM vehicles WHERE data_entrada_stock BETWEEN $1 AND $2`,
        [inicio, fim],
      ));
    } finally {
      client.release();
    }

    // Fotos dos comprovativos — descarregadas aqui (não no template, que
    // fica só com a geração do PDF em si) porque cada `comprovativo_url` é
    // um URL assinado do Storage, não um ficheiro local.
    const baixarComprovativo = async (url: string | null): Promise<Buffer | null> => {
      if (!url) return null;
      try {
        const resposta = await fetch(url);
        if (!resposta.ok) return null;
        return Buffer.from(await resposta.arrayBuffer());
      } catch {
        return null;
      }
    };

    const mapEntry = async (row: FinanceEntryRow): Promise<ExtratoDespesaLinha> => ({
      data: formatarData(row.data),
      categoria: row.categoria,
      descricao: row.descricao,
      metodoPagamento: row.metodo_pagamento,
      pagoPorNome: row.pago_por_nome,
      reembolsado: row.reembolsado,
      valor: Number(row.valor),
      fornecedorNome: row.fornecedor_nome,
      fornecedorNif: row.fornecedor_nif,
      valorIva: row.valor_iva != null ? Number(row.valor_iva) : null,
      taxaIva: row.taxa_iva != null ? Number(row.taxa_iva) : null,
      comprovativoJpeg: await baixarComprovativo(row.comprovativo_url),
    });

    const mapExpense = async (row: VehicleExpenseRow): Promise<ExtratoDespesaLinha> => ({
      data: formatarData(row.data),
      categoria: row.categoria,
      descricao: row.descricao,
      metodoPagamento: row.metodo_pagamento,
      pagoPorNome: row.pago_por_nome,
      reembolsado: row.reembolsado,
      valor: Number(row.valor),
      veiculo: `${row.matricula} — ${row.marca} ${row.modelo}`,
      fornecedorNome: row.fornecedor_nome,
      fornecedorNif: row.fornecedor_nif,
      valorIva: row.valor_iva != null ? Number(row.valor_iva) : null,
      taxaIva: row.taxa_iva != null ? Number(row.taxa_iva) : null,
      comprovativoJpeg: await baixarComprovativo(row.comprovativo_url),
    });

    const despesasGerais = await Promise.all(entryRows.filter((r) => r.tipo === 'despesa').map(mapEntry));
    const receitasGerais = entryRows.filter((r) => r.tipo === 'receita');
    const despesasVeiculos = await Promise.all(expenseRows.map(mapExpense));

    const vendas: ExtratoVendaLinha[] = saleRows.map((s) => ({
      data: formatarData(s.data_venda),
      veiculo: `${s.matricula} — ${s.marca} ${s.modelo}`,
      compradorNome: s.comprador_nome,
      precoFinal: Number(s.preco_final),
      margem: Number(s.preco_final) - Number(s.preco_compra) - Number(s.despesas_veiculo),
    }));

    const totalReceitas = receitasGerais.reduce((acc, r) => acc + Number(r.valor), 0);
    const totalDespesasGerais = despesasGerais.reduce((acc, d) => acc + d.valor, 0);
    const totalDespesasVeiculos = despesasVeiculos.reduce((acc, d) => acc + d.valor, 0);
    const totalVendas = vendas.reduce((acc, v) => acc + v.precoFinal, 0);
    const totalCompras = Number(comprasRows[0]?.total ?? 0);
    // Margem = preço de venda − preço de compra − despesas do veículo, já
    // calculada por venda (ver `vendas` acima) — soma-se para o total do
    // mês. Lucro líquido acrescenta as receitas/despesas gerais da empresa
    // por cima dessa margem, para dar o resultado final do mês.
    const totalMargemVendas = vendas.reduce((acc, v) => acc + v.margem, 0);
    const lucroLiquido = totalMargemVendas + totalReceitas - totalDespesasGerais;

    const pdfData: ExtratoMensalData = {
      standNome: standRows[0]?.nome ?? '',
      periodoLabel: `${MESES_PT[mes - 1]} de ${ano}`,
      resumo: {
        totalReceitas,
        totalDespesasGerais,
        totalDespesasVeiculos,
        totalVendas,
        totalCompras,
        totalMargemVendas,
        lucroLiquido,
        // Cashflow = movimento de caixa real do período (à parte da
        // margem/lucro, que casa a venda com o custo do veículo
        // independentemente de quando foi comprado) — mesma fórmula do
        // dashboard principal (finance.service.ts::summary()).
        cashflow: totalReceitas + totalVendas - totalDespesasGerais - totalDespesasVeiculos - totalCompras,
      },
      despesasGerais,
      despesasVeiculos,
      vendas,
    };

    // CSV é um livro-razão único com TODOS os movimentos do mês (ao contrário
    // do PDF, que separa em secções) — bug real corrigido nesta sessão: só
    // incluía despesas, ficando vazio em qualquer mês que só tivesse vendas.
    // `dataIso` guarda a data em bruto (AAAA-MM-DD) só para a ordenação
    // cronológica final; é descartada antes de gerar o ficheiro.
    const csvBruto: (ExtratoCsvLinha & { dataIso: string })[] = [
      ...entryRows.map((r): ExtratoCsvLinha & { dataIso: string } => ({
        dataIso: r.data,
        data: formatarData(r.data),
        origem: r.tipo === 'receita' ? 'receita' : 'despesa_geral',
        veiculo: null,
        categoria: r.categoria,
        descricao: r.descricao,
        contraparte: r.pago_por_nome,
        metodoPagamento: r.metodo_pagamento,
        reembolsado: r.reembolsado,
        valor: Number(r.valor),
        margem: null,
        fornecedorNome: r.fornecedor_nome,
        fornecedorNif: r.fornecedor_nif,
        valorIva: r.valor_iva != null ? Number(r.valor_iva) : null,
        taxaIva: r.taxa_iva != null ? Number(r.taxa_iva) : null,
        comprovativoUrl: r.comprovativo_url,
      })),
      ...expenseRows.map((r): ExtratoCsvLinha & { dataIso: string } => ({
        dataIso: r.data,
        data: formatarData(r.data),
        origem: 'despesa_veiculo',
        veiculo: `${r.matricula} — ${r.marca} ${r.modelo}`,
        categoria: r.categoria,
        descricao: r.descricao,
        contraparte: r.pago_por_nome,
        metodoPagamento: r.metodo_pagamento,
        reembolsado: r.reembolsado,
        valor: Number(r.valor),
        margem: null,
        fornecedorNome: r.fornecedor_nome,
        fornecedorNif: r.fornecedor_nif,
        valorIva: r.valor_iva != null ? Number(r.valor_iva) : null,
        taxaIva: r.taxa_iva != null ? Number(r.taxa_iva) : null,
        comprovativoUrl: r.comprovativo_url,
      })),
      ...vendas.map((v, i): ExtratoCsvLinha & { dataIso: string } => ({
        dataIso: saleRows[i].data_venda,
        data: v.data,
        origem: 'venda',
        veiculo: v.veiculo,
        categoria: null,
        descricao: null,
        contraparte: v.compradorNome,
        metodoPagamento: null,
        reembolsado: null,
        valor: v.precoFinal,
        margem: v.margem,
        comprovativoUrl: null,
      })),
    ].sort((a, b) => a.dataIso.localeCompare(b.dataIso));
    const csvLinhas: ExtratoCsvLinha[] = csvBruto.map(({ dataIso: _dataIso, ...resto }) => resto);

    const pdfBuffer = await generateExtratoMensalPdf(pdfData);
    const csvBuffer = generateExtratoMensalCsv(csvLinhas);

    const periodo = `${ano}-${String(mes).padStart(2, '0')}`;
    const [pdfUrl, csvUrl] = await Promise.all([
      this.storage.upload(`${schemaName}/finance/statements/${periodo}.pdf`, pdfBuffer, 'application/pdf'),
      this.storage.upload(`${schemaName}/finance/statements/${periodo}.csv`, csvBuffer, 'text/csv'),
    ]);

    return { pdfUrl, csvUrl };
  }
}
