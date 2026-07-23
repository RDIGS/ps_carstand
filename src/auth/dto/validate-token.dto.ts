import { IsString, MinLength } from 'class-validator';

export class ValidateTokenDto {
  @IsString()
  @MinLength(1)
  token!: string;
}
