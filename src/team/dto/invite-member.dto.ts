import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class InviteMemberDto {
  @IsString()
  @MinLength(1)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsIn(['owner', 'vendedor'])
  role!: 'owner' | 'vendedor';
}
