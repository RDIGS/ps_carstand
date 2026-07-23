import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsIn(['owner', 'vendedor'])
  role?: 'owner' | 'vendedor';

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
