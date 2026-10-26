import { BRANCO, CINZA_CLARO, Desenho, PRETO, PessoaDeclaracao, StandDeclaracao, VeiculoDeclaracao, dataPt, hojePt } from './declaracao-base';

export interface DeclaracaoCaracteristicasData {
  stand: StandDeclaracao;
  cliente: PessoaDeclaracao;
  veiculo: VeiculoDeclaracao;
  pneusDianteiros: string | null;
  pneusTraseiros: string | null;
}

const X0 = 60;
const X1 = 535;
const MEIO = 300;

/** Modelo "Declaração de Características da Viatura". */
export async function desenharCaracteristicas(d: Desenho, data: DeclaracaoCaracteristicasData): Promise<void> {
  const { stand, cliente, veiculo: v } = data;

  let y = 842 - 40;
  const hLogo = d.desenharLogo(y, 52, 'centro');
  y -= (hLogo || 40) + 34;
  d.centrado('DECLARAÇÃO DE CARACTERÍSTICAS DA VIATURA', y, 16, true);
  y -= 34;

  const faixa = (titulo: string) => {
    d.caixa(X0, y - 20, X1 - X0, 20, PRETO);
    d.texto(titulo, X0 + 6, y - 14, 9.5, true, BRANCO);
    y -= 20;
  };
  const separador = () => d.linha(X0, y, X1, y, 0.5, CINZA_CLARO, true);
  const campo = (rotulo: string, valor: string, x: number, yy: number) => {
    d.texto(rotulo, x, yy, 9.5, true);
    d.texto(valor, x + d.largo(rotulo, 9.5, true) + 4, yy, 9.5);
  };
  const linhaUma = (rotulo: string, valor: string) => {
    y -= 23;
    campo(rotulo, valor, X0 + 6, y + 8);
    separador();
  };
  const linhaDuas = (r1: string, v1: string, r2: string, v2: string) => {
    y -= 30;
    campo(r1, v1, X0 + 6, y + 12);
    campo(r2, v2, MEIO, y + 12);
    separador();
  };

  faixa('IDENTIFICAÇÃO DO CLIENTE');
  linhaUma('Nome completo:', cliente.nome);
  linhaUma('Contribuinte (NIF):', cliente.nif ?? '');
  y -= 16;

  const dataPrimeira = v.dataPrimeiraMatricula ?? v.dataMatriculaPortugal;
  faixa('IDENTIFICAÇÃO DA VIATURA');
  linhaDuas('Marca:', v.marca, 'Modelo / versão:', [v.modelo, v.versao].filter(Boolean).join(' '));
  linhaDuas('Matrícula:', v.matricula, 'N.º de identificação (VIN):', v.chassis ?? '');
  linhaDuas('Data da 1.ª matrícula:', dataPt(dataPrimeira), 'Data da matrícula em Portugal:', dataPt(v.dataMatriculaPortugal));
  y -= 16;

  faixa('CARACTERÍSTICAS');
  linhaDuas('Cor:', v.cor ?? '', 'N.º de lugares:', v.numLugares != null ? String(v.numLugares) : '');
  linhaDuas('Tipo de veículo:', v.categoria ?? '', 'Combustível:', v.combustivel ?? '');
  linhaDuas(
    'Cilindrada:',
    v.cilindrada != null ? `${v.cilindrada.toLocaleString('pt-PT')} cm³` : '',
    'Potência:',
    v.potenciaKw != null ? `${v.potenciaKw} kW` : '',
  );
  linhaDuas('Pneus dianteiros:', data.pneusDianteiros ?? '', 'Pneus traseiros:', data.pneusTraseiros ?? '');

  y -= 46;
  d.linha(X0, y, X1, y, 0.6);
  y -= 34;
  d.texto('Localidade:', X0 + 6, y, 9.5);
  d.texto(stand.localidade ?? '', X0 + 66, y + 2, 9.5);
  d.linha(X0 + 62, y - 3, X0 + 290, y - 3, 0.6);
  d.texto('Data:', 395, y, 9.5);
  d.texto(hojePt(), 427, y + 2, 9.5);
  d.linha(423, y - 3, X1, y - 3, 0.6);

  y -= 70;
  d.texto('Assinatura:', X0 + 6, y, 9.5);
  d.linha(X0 + 62, y - 3, X0 + 365, y - 3, 0.6);
}
