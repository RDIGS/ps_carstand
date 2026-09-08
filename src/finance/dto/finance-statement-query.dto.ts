import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FinanceStatementQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  ano!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;
}
