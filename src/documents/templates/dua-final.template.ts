import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'fs';
import { join } from 'path';

// Preenche o Modelo 1 RA real do IRN ("Requerimento de Registo Automóvel",
// fornecido pelo utilizador) em vez de desenhar um layout próprio — ao
// contrário do Registo de Compra (registo-compra.template.ts), este É o
// documento a entregar na Conservatória do Registo Automóvel.
const TEMPLATE_PATH = join(__dirname, 'dua-final-modelo1ra.pdf');

export interface DuaFinalPessoa {
  nome: string;
  nif?: string | null;
  morada?: string | null;
  cp?: string | null; // formato ####-###
  identificacaoTipo?: string | null; // bi | cc | titulo_residencia | outro
  identificacaoNumero?: string | null;
}

export interface DuaFinalData {
  vehicle: { matricula: string; marca: string; chassis?: string | null };
  comprador: DuaFinalPessoa;
  transmitente: DuaFinalPessoa;
  dataVenda: Date;
}

function splitCodigoPostal(cp?: string | null): [string, string] {
  if (!cp) return ['', ''];
  const [parte1, parte2] = cp.split('-');
  return [parte1 ?? '', parte2 ?? ''];
}

// "bcc" só tem 3 opções (bi/cc/cp="cédula profissional") — título de
// residência e "outro" não têm rádio próprio no formulário oficial, ficam
// só no campo de texto livre "Outro".
function radioIdentificacao(tipo?: string | null): 'bi' | 'cc' | null {
  if (tipo === 'bi') return 'bi';
  if (tipo === 'cc') return 'cc';
  return null;
}

function labelOutroDocumento(tipo?: string | null): string {
  if (tipo === 'titulo_residencia') return 'Título de Residência';
  if (tipo === 'outro') return 'Outro documento';
  return '';
}

// Vários campos do template oficial têm `MaxLen` curto (ex.: nº de
// identificação a 12 caracteres, mas um CC formatado "12345678 9 ZZ0" tem
// 14) — truncar em vez de deixar isto abaixo a geração do PDF todo.
function setText(form: import('pdf-lib').PDFForm, name: string, value?: string | null): void {
  if (!value) return;
  const field = form.getTextField(name);
  const maxLength = field.getMaxLength();
  field.setText(maxLength != null ? value.slice(0, maxLength) : value);
}

function preencherPessoa(
  form: import('pdf-lib').PDFForm,
  pessoa: DuaFinalPessoa,
  campos: {
    nome: string;
    nif?: string;
    morada: string;
    cp1: string;
    cp2: string;
    localidade: string;
    identificacaoNumero: string;
    outro: string;
    radio: string;
  },
): void {
  setText(form, campos.nome, pessoa.nome);
  if (campos.nif) setText(form, campos.nif, pessoa.nif);
  setText(form, campos.morada, pessoa.morada);
  const [cp1, cp2] = splitCodigoPostal(pessoa.cp);
  setText(form, campos.cp1, cp1);
  setText(form, campos.cp2, cp2);
  setText(form, campos.identificacaoNumero, pessoa.identificacaoNumero);
  const radioValue = radioIdentificacao(pessoa.identificacaoTipo);
  if (radioValue) {
    try {
      form.getRadioGroup(campos.radio).select(radioValue);
    } catch {
      // Campo "menor"/radio pode não aceitar o valor em builds futuros do
      // template — nunca deixar isto abaixo a geração do documento todo.
    }
  } else {
    setText(form, campos.outro, labelOutroDocumento(pessoa.identificacaoTipo));
  }
}

export async function generateDuaFinalPdf(data: DuaFinalData): Promise<Buffer> {
  const templateBytes = readFileSync(TEMPLATE_PATH);
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();

  // Q1 — Veículo.
  setText(form, 'Matricula Q1', data.vehicle.matricula);
  setText(form, 'Marca Q1', data.vehicle.marca);
  setText(form, 'Quadro N Q1', data.vehicle.chassis);

  // Q2 — "Declaração para registo de propriedade" (contrato verbal de
  // compra e venda) é o ato correto para uma venda normal de usados.
  try {
    form.getRadioGroup('Registo Propriedade(1).p0').select('Declaracao');
  } catch {
    /* nunca bloquear a geração do PDF por causa de um radio */
  }

  // Q3 — Sujeito Ativo (comprador).
  preencherPessoa(form, data.comprador, {
    nome: 'Nome - firma Q3',
    nif: 'NIFNIPC 1 Q3',
    morada: 'ResidênciaSede Q3',
    cp1: 'cod postal 1Q3',
    cp2: 'cod postal 2Q3',
    localidade: 'Localidade Q3',
    identificacaoNumero: 'N identificacao 1 Q3',
    outro: 'Outro Q3',
    radio: 'Q3 bcc',
  });

  // Q4 — Sujeito Passivo (vendedor/transmitente) — o stand ou um terceiro,
  // consoante o que foi escolhido na venda (ver CreateSaleDto).
  preencherPessoa(form, data.transmitente, {
    nome: 'Nome - firma Q4',
    nif: 'NIFNIPC Q4',
    morada: 'ResidênciaSede Q4',
    cp1: 'cod postal 1 Q4',
    cp2: 'cod postal2 Q4',
    localidade: 'Localidade Q4',
    identificacaoNumero: 'N identificacao 1 Q4',
    outro: 'Outro Q4',
    radio: 'Q4 bcc',
  });

  // Q7 — Declaração do vendedor + data do contrato.
  const dia = String(data.dataVenda.getDate()).padStart(2, '0');
  const mes = String(data.dataVenda.getMonth() + 1).padStart(2, '0');
  const ano = String(data.dataVenda.getFullYear());
  setText(form, 'data dia Q7', dia);
  setText(form, 'data mes Q7', mes);
  setText(form, 'data ano Q7', ano);
  try {
    form.getRadioGroup('Q7 1').select('1');
  } catch {
    /* nunca bloquear a geração do PDF por causa de um radio */
  }

  // Q9 — Assinaturas: só o nº de identificação (o resto — assinatura,
  // entidade emissora, validade — exige preenchimento manual/assinatura
  // física, não são dados que a app tenha).
  setText(form, 'N Identificacao 1 Q9', data.comprador.identificacaoNumero);
  setText(form, 'N Identificacao 2 Q9', data.transmitente.identificacaoNumero);

  // "Achatar" o formulário — o que falta (Q8, assinaturas, moradas
  // completas) é para preencher/assinar à mão numa impressão, não faz
  // sentido continuar interativo/editável no PDF final.
  form.flatten();

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
