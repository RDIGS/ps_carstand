import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';
import { FINANCE_CATEGORIAS } from '../finance-categorias';
import { METODOS_PAGAMENTO } from '../../common/constants/metodos-pagamento';

export class UpdateFinanceEntryDto {
  @IsOptional()
  @IsIn(['receita', 'despesa'])
  tipo?: 'receita' | 'despesa';

  // `null` explícito = limpar a categoria (o frontend manda sempre este
  // campo no formulário de edição, mesmo quando o utilizador escolhe "sem
  // categoria") — `@IsOptional()` ignora tanto `undefined` como `null`.
  @IsOptional()
  @IsIn(FINANCE_CATEGORIAS)
  categoria?: string | null;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  valor?: number;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  data?: string;

  // Mesma razão de `categoria` — `null` explícito limpa o campo.
  @IsOptional()
  @IsIn(METODOS_PAGAMENTO)
  metodoPagamento?: string | null;

  @IsOptional()
  @IsUUID()
  pagoPor?: string | null;

  @IsOptional()
  @IsBoolean()
  recorrente?: boolean;

  @IsOptional()
  @IsBoolean()
  reembolsado?: boolean;

  // Mesma razão de `categoria`/`metodoPagamento` — `null` explícito limpa o campo.
  @IsOptional()
  @IsString()
  fornecedorNome?: string | null;

  @IsOptional()
  @IsString()
  fornecedorNif?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorIva?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxaIva?: number | null;

  @IsOptional()
  @IsBoolean()
  pago?: boolean;

  // `null` explícito = limpar a data de vencimento (ex.: ao marcar como
  // pago já não faz sentido continuar a mostrar "vence em X").
  @IsOptional()
  @IsDateString()
  dataVencimento?: string | null;
}
