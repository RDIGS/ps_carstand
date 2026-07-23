import { IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateSaleDto {
  @IsUUID()
  vehicleId!: string;

  @IsString()
  @MinLength(1)
  compradorNome!: string;

  @IsString()
  compradorNif!: string;

  @IsOptional()
  @IsString()
  compradorMorada?: string;

  @IsOptional()
  @IsString()
  compradorCp?: string;

  @IsOptional()
  @IsIn(['bi', 'cc', 'titulo_residencia', 'outro'])
  compradorIdentificacaoTipo?: string;

  @IsOptional()
  @IsString()
  compradorIdentificacaoNumero?: string;

  @IsNumber()
  @IsPositive()
  precoFinal!: number;

  @IsOptional()
  @IsNumber()
  comissaoVendedor?: number;
}
