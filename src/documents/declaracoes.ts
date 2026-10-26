import { Logger } from '@nestjs/common';
import { Desenho, PessoaDeclaracao, StandDeclaracao, VeiculoDeclaracao } from './templates/declaracao-base';
import { desenharAutorizacaoDadosComprador, desenharCompraVenda } from './templates/declaracao-compra-venda.template';
import { desenharCirculacao } from './templates/declaracao-circulacao.template';
import { desenharCaracteristicas } from './templates/declaracao-caracteristicas.template';

export type TipoDeclaracao = 'compra' | 'venda' | 'circulacao' | 'caracteristicas';

export interface StandRow {
  nome: string;
  denominacaoSocial: string | null;
  nif: string | null;
  morada: string | null;
  localidade: string | null;
  contacto: string | null;
  logoUrl: string | null;
}

export interface DadosDeclaracao {
  tipo: TipoDeclaracao;
  stand: StandRow;
  /** Linha da tabela `vehicles` (colunas snake_case). */
  veiculo: Record<string, any>;
  pessoa: PessoaDeclaracao;
  preco?: number | null;
  pneusDianteiros?: string | null;
  pneusTraseiros?: string | null;
}

const logger = new Logger('Declaracoes');

/** Descarrega o logótipo do stand; sem logótipo (ou se falhar) a declaração sai sem ele. */
async function descarregarLogo(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    logger.warn(`Logótipo do stand não descarregado: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

// Valores guardados como código (ex. "ligeiro_passageiros", "diesel") saem
// por extenso no documento; texto normal (ex. lido do DUA) fica como está.
const POR_EXTENSO: Record<string, string> = {
  diesel: 'Gasóleo',
  gasoleo: 'Gasóleo',
  gasolina: 'Gasolina',
  eletrico: 'Elétrico',
  hibrido: 'Híbrido',
  hibrido_plug_in: 'Híbrido plug-in',
  gpl: 'GPL',
  gnv: 'GNV',
  ligeiro_passageiros: 'Ligeiro de passageiros',
  ligeiro_mercadorias: 'Ligeiro de mercadorias',
  pesado_passageiros: 'Pesado de passageiros',
  pesado_mercadorias: 'Pesado de mercadorias',
  motociclo: 'Motociclo',
  ciclomotor: 'Ciclomotor',
};

export function porExtenso(valor: string | null | undefined): string | null {
  if (!valor) return null;
  if (!/^[a-z0-9_]+$/.test(valor)) return valor;
  const conhecido = POR_EXTENSO[valor];
  if (conhecido) return conhecido;
  const texto = valor.replace(/_/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function numero(valor: unknown): number | null {
  if (valor == null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function veiculoParaDeclaracao(v: Record<string, any>): VeiculoDeclaracao {
  return {
    matricula: v.matricula,
    marca: v.marca,
    modelo: v.modelo,
    versao: v.versao ?? null,
    chassis: v.chassis ?? null,
    kms: numero(v.kms),
    categoria: porExtenso(v.categoria),
    combustivel: porExtenso(v.combustivel),
    cilindrada: numero(v.cilindrada),
    potenciaKw: numero(v.potencia_kw),
    cor: v.cor ?? null,
    numLugares: numero(v.num_lugares),
    // Importados: a 1.ª matrícula é a do país de origem; em Portugal é a data
    // da matrícula portuguesa. Nacionais: as duas coincidem.
    dataPrimeiraMatricula: v.data_primeira_matricula_original ?? v.data_primeira_matricula ?? null,
    dataMatriculaPortugal: v.data_primeira_matricula ?? null,
  };
}

/** Gera o PDF da declaração pedida. */
export async function gerarDeclaracaoPdf(dados: DadosDeclaracao): Promise<Buffer> {
  const s = dados.stand;
  const stand: StandDeclaracao = {
    denominacao: s.denominacaoSocial?.trim() || s.nome,
    nif: s.nif,
    morada: s.morada,
    localidade: s.localidade,
    contacto: s.contacto,
    logo: await descarregarLogo(s.logoUrl),
  };
  const veiculo = veiculoParaDeclaracao(dados.veiculo);
  const d = await Desenho.criar(stand.logo);

  switch (dados.tipo) {
    case 'compra':
    case 'venda':
      await desenharCompraVenda(d, {
        papelStand: dados.tipo === 'compra' ? 'comprador' : 'vendedor',
        stand,
        outraParte: dados.pessoa,
        veiculo,
        preco: dados.preco ?? null,
      });
      if (dados.tipo === 'venda') desenharAutorizacaoDadosComprador(d, stand);
      break;
    case 'circulacao':
      await desenharCirculacao(d, { stand, cliente: dados.pessoa, veiculo });
      break;
    case 'caracteristicas':
      await desenharCaracteristicas(d, {
        stand,
        cliente: dados.pessoa,
        veiculo,
        pneusDianteiros: dados.pneusDianteiros ?? null,
        pneusTraseiros: dados.pneusTraseiros ?? null,
      });
      break;
  }
  return d.guardar();
}
