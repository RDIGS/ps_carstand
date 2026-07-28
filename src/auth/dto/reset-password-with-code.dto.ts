import { IsEmail, IsString, MinLength } from 'class-validator';

export class ResetPasswordWithCodeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(8)
  novaPassword!: string;
}
