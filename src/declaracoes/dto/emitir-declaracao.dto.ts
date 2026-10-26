import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Dados do cliente (lidos do CC ou escritos à mão na app) e, na de características, os pneus. */
export class EmitirDeclaracaoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  morada?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nif?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  pneusDianteiros?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  pneusTraseiros?: string;
}
