import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStandDto {
  @IsString()
  @MinLength(1)
  nome!: string;

  @IsOptional()
  @IsString()
  nif?: string;

  @IsOptional()
  @IsString()
  morada?: string;

  @IsIn(['mensal', 'anual'])
  plano!: 'mensal' | 'anual';

  @IsOptional()
  precoAcordado?: number;

  // Primeiro owner do stand — conta criada já associada com role 'owner'.
  @IsString()
  @MinLength(1)
  ownerNome!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @MinLength(8)
  ownerPassword!: string;
}
