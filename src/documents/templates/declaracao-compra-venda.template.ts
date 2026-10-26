import { Desenho, PessoaDeclaracao, StandDeclaracao, VeiculoDeclaracao, euros, hojePt, seguro } from './declaracao-base';

export interface DeclaracaoCompraVendaData {
  /** Papel do stand na transação: compra ao cliente (entrada em stock) ou vende-lhe. */
  papelStand: 'comprador' | 'vendedor';
  stand: StandDeclaracao;
  outraParte: PessoaDeclaracao;
  veiculo: VeiculoDeclaracao;
  preco: number | null;
}

const X0 = 60;
const X1 = 535;

const TEXTO_DECLARACAO = [
  'O vendedor declara que é o único proprietário do veículo e que este é vendido no estado em que se encontra, sem quaisquer outros defeitos conhecidos que não aqueles transmitidos ao comprador, descritos em anexo a esta declaração, sem encargos, ónus, quaisquer dívidas associadas ou qualquer outro tipo de facto conhecido pelo vendedor que diminua o seu valor ou que implique o comprador em despesas futuras, que não aquelas esperadas normalmente ou imputadas pela lei, tais como impostos e outras obrigações de conhecimento público generalizado.',
  'O comprador compromete-se a efetuar todos os procedimentos necessários relacionados com a transmissão de propriedade dentro do prazo definido por lei, sob pena de indemnização por quaisquer prejuízos que o incumprimento possa trazer ao vendedor.',
  'O vendedor compromete-se a efetuar todos os procedimentos necessários relacionados com a transmissão de propriedade dentro do prazo definido por lei, sob pena de indemnização por quaisquer prejuízos que o incumprimento possa trazer ao comprador.',
  'Esta declaração de venda é emitida e assinada em duplicado, com uma cópia em português e entregue ao vendedor, e uma cópia em português e entregue ao comprador. Deverá estar anexada à mesma uma cópia rasurada e datada do documento de identificação do comprador e do vendedor.',
];

/** Modelo "Declaração de Compra e Venda de Viatura" (Compradora/Vendedora). */
export async function desenharCompraVenda(d: Desenho, data: DeclaracaoCompraVendaData): Promise<void> {
  const { stand, outraParte: pessoa, veiculo: v } = data;
  const standEComprador = data.papelStand === 'comprador';

  let y = 842 - 35;
  const hLogo = d.desenharLogo(y, 46, 'centro');
  y -= (hLogo || 10) + 28;
  d.centrado('DECLARAÇÃO DE COMPRA E VENDA DE VIATURA', y, 17, true);
  y -= 22;

  // Quadro com a identificação do stand.
  const moradaLinhas = d.quebrar((stand.morada ?? '').toUpperCase(), 9, X1 - X0 - 165);
  const alturaQuadro = 26 + 11 * (1 + moradaLinhas.length);
  d.caixa(X0, y - alturaQuadro, X1 - X0, alturaQuadro);
  d.linha(X0 + 155, y, X0 + 155, y - alturaQuadro);
  d.texto(standEComprador ? 'COMPRADOR' : 'VENDEDOR', X0 + 12, y - alturaQuadro / 2 - 3, 10, true);
  let yq = y - 14;
  d.texto(stand.denominacao.toUpperCase(), X0 + 165, yq, 9, true);
  yq -= 11;
  d.texto(`NIF: ${stand.nif ?? ''}`, X0 + 165, yq, 9);
  for (const l of moradaLinhas) {
    yq -= 11;
    d.texto(l, X0 + 165, yq, 9);
  }
  y -= alturaQuadro + 22;

  // 1. Identificação da outra parte.
  d.texto(`1. IDENTIFICAÇÃO DO ${standEComprador ? 'VENDEDOR' : 'COMPRADOR'}`, X0, y, 11, true);
  y -= 8;
  for (const [rotulo, valor] of [
    ['Nome completo', pessoa.nome],
    ['Morada', pessoa.morada ?? ''],
    ['NIF', pessoa.nif ?? ''],
  ] as const) {
    const linhas = d.quebrar(valor, 9, X1 - X0 - 165);
    const h = Math.max(26, 10 + 11 * linhas.length);
    d.caixa(X0, y - h, X1 - X0, h);
    d.linha(X0 + 155, y, X0 + 155, y - h);
    d.texto(rotulo, X0 + 8, y - h / 2 - 3, 9, true);
    linhas.forEach((l, i) => d.texto(l, X0 + 165, y - 16 - i * 11, 9));
    y -= h;
  }
  y -= 22;

  // 2. Identificação da viatura.
  d.texto('2. IDENTIFICAÇÃO DA VIATURA', X0, y, 11, true);
  y -= 8;
  const colunas = [X0, X0 + 90, X0 + 245, X0 + 340, X1];
  const linha4 = (a: string, b: string, c: string, e: string) => {
    d.caixa(X0, y - 26, X1 - X0, 26);
    for (const cx of colunas.slice(1, 4)) d.linha(cx, y, cx, y - 26);
    d.texto(a, colunas[0] + 8, y - 16, 9, true);
    d.texto(b, colunas[1] + 8, y - 16, 9);
    d.texto(c, colunas[2] + 8, y - 16, 9, true);
    d.texto(e, colunas[3] + 8, y - 16, 9);
    y -= 26;
  };
  linha4('Matrícula', v.matricula, 'Marca', v.marca);
  linha4('Modelo', [v.modelo, v.versao].filter(Boolean).join(' '), 'Quilometragem', v.kms != null ? `${v.kms.toLocaleString('pt-PT')} km` : '');
  d.caixa(X0, y - 26, X1 - X0, 26);
  d.linha(colunas[1], y, colunas[1], y - 26);
  d.texto('VIN', X0 + 8, y - 16, 9, true);
  d.texto(v.chassis ?? '', colunas[1] + 8, y - 16, 9);
  y -= 26 + 22;

  // 3. Valor.
  d.texto('3. VALOR DA TRANSAÇÃO', X0, y, 11, true);
  y -= 8;
  d.caixa(X0, y - 26, X1 - X0, 26);
  d.linha(X0 + 270, y, X0 + 270, y - 26);
  d.texto(standEComprador ? 'Preço de compra da viatura' : 'Preço de venda da viatura', X0 + 8, y - 16, 9, true);
  d.direita(`${euros(data.preco)} €`, X1 - 10, y - 16, 9);
  y -= 26 + 22;

  // 4. Declaração.
  d.texto('4. DECLARAÇÃO', X0, y, 11, true);
  y -= 14;
  for (const p of TEXTO_DECLARACAO) {
    y = d.paragrafo([{ t: p }], X0, y, X1 - X0, 7.6, 9.5);
    y -= 5;
  }
  y -= 18;

  // Local e data (preenchidos).
  d.texto('Local e data:', X0, y, 9);
  d.texto(`${stand.localidade ?? ''}${stand.localidade ? ', ' : ''}${hojePt()}`, X0 + 105, y + 2, 9);
  d.linha(X0 + 100, y - 3, X0 + 330, y - 3);
  y -= 40;

  // Assinaturas: vendedor à esquerda, comprador à direita.
  const centroEsq = X0 + 115;
  const centroDir = X1 - 125;
  const nomeStand = stand.denominacao.toUpperCase();
  const nomePessoa = `Nome: ${seguro(pessoa.nome)}`;
  for (const [centro, titulo, rodape] of [
    [centroEsq, 'O VENDEDOR', standEComprador ? nomePessoa : nomeStand],
    [centroDir, 'O COMPRADOR', standEComprador ? nomeStand : nomePessoa],
  ] as const) {
    d.texto(titulo, centro - d.largo(titulo, 10, true) / 2, y, 10, true);
    d.linha(centro - 105, y - 45, centro + 105, y - 45);
    const linhasRodape = d.quebrar(rodape, 8, 225);
    linhasRodape.forEach((l, i) => d.texto(l, centro - d.largo(l, 8) / 2, y - 57 - i * 9.5, 8));
  }

  // Caixa do número da declaração — fica em branco (decisão do utilizador).
  d.caixa(X1 - 135, 28, 135, 44);
  d.texto('N.º DECLARAÇÃO', X1 - 125, 28 + 29, 9, true);
  d.linha(X1 - 125, 38, X1 - 10, 38, 0.6);
}

/**
 * Secção 24.4: autorização de tratamento dos dados do comprador, numa página
 * própria a seguir à declaração de venda (já existia no antigo "Registo de
 * Compra" e mantém-se — decisão legal anterior a estes modelos).
 */
export function desenharAutorizacaoDadosComprador(d: Desenho, stand: StandDeclaracao): void {
  d.novaPagina();
  let y = 842 - 70;
  d.texto('AUTORIZAÇÃO DE TRATAMENTO DE DADOS PESSOAIS', X0, y, 12, true);
  y -= 34;
  const contacto = stand.contacto?.trim() || '[contacto do stand não configurado]';
  y = d.paragrafo(
    [
      {
        t:
          `O(A) comprador(a) identificado(a) na declaração de compra e venda anexa autoriza ${stand.denominacao}, enquanto ` +
          'responsável pelo tratamento, a recolher e tratar os seus dados pessoais, incluindo a digitalização do Cartão de ' +
          'Cidadão, com a finalidade exclusiva de formalizar o presente contrato de compra e venda de veículo automóvel. Os ' +
          'dados serão conservados pelo prazo legal aplicável à conservação de documentos comerciais e não serão utilizados ' +
          'para outras finalidades sem consentimento adicional. O(A) comprador(a) pode exercer os seus direitos de acesso, ' +
          `retificação e apagamento dos dados junto de ${stand.denominacao}, através de ${contacto}.`,
      },
    ],
    X0,
    y,
    X1 - X0,
    10,
    15,
  );
  y -= 40;
  d.texto('Assinatura do comprador: ______________________________   Data: __ / __ / ____', X0, y, 10);
}
