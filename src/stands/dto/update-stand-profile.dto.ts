import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStandProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contacto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  redesSociais?: string;
}
