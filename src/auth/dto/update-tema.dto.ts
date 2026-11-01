import { IsIn } from 'class-validator';

export const TEMAS = ['editorial', 'luxo', 'minimal'] as const;

export class UpdateTemaDto {
  @IsIn(TEMAS)
  tema!: (typeof TEMAS)[number];
}
