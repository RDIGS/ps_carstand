// Sem biblioteca (não há nenhum precedente de CSV/Excel no backend) — é uma
// exportação em bruto, linha a linha, de TODOS os movimentos do mês
// (receitas gerais, despesas gerais, despesas de veículo e vendas), para o
// contabilista importar em Excel; o PDF é que fica com o resumo/formatação
// (ver extrato-mensal.template.ts). Interface própria, não a mesma do PDF —
// vendas/receitas não têm os mesmos campos que uma despesa (comprador e
// margem em vez de método de pagamento/reembolso).
export interface ExtratoCsvLinha {
  data: string; // já formatada DD/MM/AAAA
  origem: 'receita' | 'despesa_geral' | 'despesa_veiculo' | 'venda';
  veiculo?: string | null;
  categoria?: string | null;
  descricao?: string | null;
  contraparte?: string | null; // pago_por (despesas/receitas) ou comprador (venda)
  metodoPagamento?: string | null;
  reembolsado?: boolean | null;
  valor: number;
  margem?: number | null; // só vendas
  fornecedorNome?: string | null; // só despesas
  fornecedorNif?: string | null;
  valorIva?: number | null;
  taxaIva?: number | null;
  comprovativoUrl?: string | null;
}

const CABECALHO = [
  'data',
  'origem',
  'veiculo',
  'categoria',
  'descricao',
  'contraparte',
  'metodo_pagamento',
  'reembolsado',
  'valor',
  'margem',
  'fornecedor_nome',
  'fornecedor_nif',
  'valor_iva',
  'taxa_iva',
  'comprovativo_url',
];

// Mitigação padrão de "CSV/Formula Injection" (OWASP): um valor de texto
// livre (descrição, fornecedor, contraparte...) que comece por =/+/-/@ ou
// tab é interpretado como fórmula pelo Excel/Sheets ao abrir o ficheiro —
// grave neste caso porque `fornecedorNome` pode vir pré-preenchido sem
// revisão a partir da leitura automática de uma fatura fotografada
// (POST /finance/extract-invoice), um canal que um atacante podia moldar.
// Prefixar com uma plica neutraliza a fórmula sem alterar o texto visível.
const PREFIXO_FORMULA = /^[=+\-@\t\r]/;
function escapar(valor: string): string {
  const segura = PREFIXO_FORMULA.test(valor) ? `'${valor}` : valor;
  if (segura.includes(',') || segura.includes('"') || segura.includes('\n')) {
    return `"${segura.replace(/"/g, '""')}"`;
  }
  return segura;
}

export function generateExtratoMensalCsv(linhas: ExtratoCsvLinha[]): Buffer {
  const corpo = linhas.map((l) =>
    [
      l.data,
      l.origem,
      l.veiculo ?? '',
      l.categoria ?? '',
      l.descricao ?? '',
      l.contraparte ?? '',
      l.metodoPagamento ?? '',
      l.reembolsado == null ? '' : l.reembolsado ? 'sim' : 'nao',
      l.valor.toFixed(2),
      l.margem != null ? l.margem.toFixed(2) : '',
      l.fornecedorNome ?? '',
      l.fornecedorNif ?? '',
      l.valorIva != null ? l.valorIva.toFixed(2) : '',
      l.taxaIva != null ? l.taxaIva.toFixed(2) : '',
      l.comprovativoUrl ?? '',
    ]
      .map((campo) => escapar(String(campo)))
      .join(','),
  );
  // BOM UTF-8 no início — sem isto o Excel abre acentos portugueses
  // corrompidos ao interpretar o ficheiro como Windows-1252 por omissão.
  return Buffer.from('﻿' + [CABECALHO.join(','), ...corpo].join('\n'), 'utf-8');
}
