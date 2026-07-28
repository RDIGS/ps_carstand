import { IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Matches, Min, MinLength } from 'class-validator';

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
  @Matches(/^\d{4}-\d{3}$/, { message: 'Código postal deve ter o formato ####-###.' })
  compradorCp?: string;

  @IsOptional()
  @IsString()
  compradorTelefone?: string;

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
  @Min(0)
  comissaoVendedor?: number;

  // Q4 do DUA_Final (vendedor legal) — por omissão é o stand; só as
  // restantes fazem sentido preencher quando isto é `false`.
  @IsOptional()
  transmitenteEStand?: boolean;

  @IsOptional()
  @IsString()
  transmitenteNome?: string;

  @IsOptional()
  @IsString()
  transmitenteNif?: string;

  @IsOptional()
  @IsString()
  transmitenteMorada?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{3}$/, { message: 'Código postal deve ter o formato ####-###.' })
  transmitenteCp?: string;

  @IsOptional()
  @IsIn(['bi', 'cc', 'titulo_residencia', 'outro'])
  transmitenteIdentificacaoTipo?: string;

  @IsOptional()
  @IsString()
  transmitenteIdentificacaoNumero?: string;
}
