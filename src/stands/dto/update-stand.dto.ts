import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

// Edição pelo super-admin (secção 12.4) — tudo o que não é o token em si
// (esse tem o seu próprio PATCH /:id/token) nem os campos self-service que o
// próprio owner já pode editar em /stands/me (contacto/redesSociais).
export class UpdateStandDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nome?: string;

  @IsOptional()
  @IsString()
  nif?: string;

  @IsOptional()
  @IsString()
  morada?: string;

  @IsOptional()
  @IsString()
  contacto?: string;

  @IsOptional()
  @IsString()
  redesSociais?: string;

  @IsOptional()
  @IsIn(['mensal', 'anual'])
  plano?: 'mensal' | 'anual';

  @IsOptional()
  precoAcordado?: number;

  @IsOptional()
  @IsString()
  notasPagamento?: string;

  @IsOptional()
  @IsBoolean()
  vendedorPodeAdicionar?: boolean;

  @IsOptional()
  @IsBoolean()
  vendedorPodeEditarPrecoKms?: boolean;

  @IsOptional()
  @IsBoolean()
  vendedorPrecisaAprovacao?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  diasAvisoPrevio?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  diasCarencia?: number;
}
