import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// Campos que o vendedor pode editar quando `vendedor_pode_editar_preco_kms = true`.
export const CAMPOS_EDITAVEIS_POR_VENDEDOR = ['precoCompra', 'precoVendaRecomendado', 'kms'] as const;

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  versao?: string;

  @IsOptional()
  @IsString()
  cor?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  kms?: number;

  @IsOptional()
  @IsNumber()
  precoCompra?: number;

  @IsOptional()
  @IsNumber()
  precoVendaRecomendado?: number;
}
