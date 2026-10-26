import { CINZA, Desenho, PessoaDeclaracao, StandDeclaracao, VeiculoDeclaracao, dataPt, hojePt } from './declaracao-base';

export interface DeclaracaoCirculacaoData {
  stand: StandDeclaracao;
  cliente: PessoaDeclaracao;
  veiculo: VeiculoDeclaracao;
}

const X0 = 60;
const X1 = 535;

/** Modelo "Declaração Circulação". */
export async function desenharCirculacao(d: Desenho, data: DeclaracaoCirculacaoData): Promise<void> {
  const { stand, cliente, veiculo: v } = data;

  let y = 842 - 45;
  const hLogo = d.desenharLogo(y, 56, 'direita');
  y -= (hLogo || 20) + 34;
  d.texto('Declaração Circulação', X0, y, 20, true);
  y -= 14;
  d.linha(X0, y, X1, y, 0.6, CINZA);
  y -= 26;

  y = d.paragrafo(
    [
      { t: stand.denominacao, b: true },
      {
        t:
          `, NIF ${stand.nif ?? '___________'}, com sede na ${stand.morada ?? '___________'}, declara, para os devidos ` +
          'efeitos e em especial PARA FAZER FÉ PERANTE AS AUTORIDADES DE TRÂNSITO E ADUANEIRAS, que foi intermediária ' +
          'na aquisição da viatura abaixo descrita, tendo começado esta a circular NESTA DATA, sob a responsabilidade ' +
          'do nosso cliente:',
      },
    ],
    X0,
    y,
    X1 - X0,
    9.5,
    13,
  );
  y -= 12;

  for (const [rotulo, valor] of [
    ['Nome:', cliente.nome],
    ['Morada:', cliente.morada ?? ''],
    ['Contribuinte:', cliente.nif ?? ''],
  ] as const) {
    d.texto(rotulo, X0, y, 9.5);
    y = d.paragrafo([{ t: valor }], X0 + 72, y, X1 - X0 - 72, 9.5, 13) - 9;
  }
  y -= 10;

  d.centrado('CARACTERÍSTICAS DA VIATURA', y, 11, true);
  y -= 30;

  const dataRef = v.dataPrimeiraMatricula ?? v.dataMatriculaPortugal;
  const xi = X0 + 85;
  for (const [rotulo, valor] of [
    ['Matrícula:', v.matricula],
    ['Marca/Modelo:', [v.marca, v.modelo, v.versao].filter(Boolean).join(' ')],
    ['Data da 1.ª Matrícula:', dataPt(dataRef)],
    // Não há "ano de construção" guardado — o ano da 1.ª matrícula é a melhor aproximação.
    ['Ano de Construção:', dataRef ? dataRef.slice(0, 4) : ''],
    ['N.º Chassi:', v.chassis ?? ''],
    ['Cilindrada:', v.cilindrada != null ? `${v.cilindrada.toLocaleString('pt-PT')} cm³` : ''],
    ['Combustível:', v.combustivel ?? ''],
    ['Lotação:', v.numLugares != null ? String(v.numLugares) : ''],
    ['Cor:', v.cor ?? ''],
  ] as const) {
    d.texto(rotulo, xi, y, 9.5);
    d.texto(valor, xi + 118, y, 9.5);
    y -= 22;
  }
  y -= 10;

  y = d.paragrafo(
    [
      {
        t:
          'Mais declaramos que o referido cliente não se faz acompanhar dos respetivos documentos, por os mesmos se ' +
          'encontrarem em processo de regularização junto das Repartições Oficiais (CONSERVATÓRIA DO REGISTO DE ' +
          'AUTOMÓVEIS E NOTARIADO).',
      },
    ],
    X0,
    y,
    X1 - X0,
    9.5,
    13,
  );
  y -= 20;
  d.texto('Nota: Esta declaração é válida por 60 dias úteis.', X0, y, 9.5);
  y -= 26;
  d.direita('Pelo Gerente', X1 - 30, y, 9.5);

  // Local e data, por cima da linha de assinatura.
  const yLocal = 112;
  d.texto(stand.localidade ?? '', X0, yLocal, 9.5);
  const xLinha = X0 + Math.max(55, d.largo(stand.localidade ?? '', 9.5) + 12);
  d.texto(hojePt(), xLinha + 6, yLocal + 3, 9.5);
  d.linha(xLinha, yLocal - 3, xLinha + 165, yLocal - 3);

  // Rodapé com a morada e o telefone do stand.
  d.texto(stand.morada ?? '', X0, 80, 9);
  if (stand.contacto) d.direita(`Tel: ${stand.contacto}`, X1, 80, 9);
}
