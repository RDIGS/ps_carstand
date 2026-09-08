import { IsIn } from 'class-validator';

export class RespondEventDto {
  @IsIn(['aceite', 'recusado'])
  estado!: 'aceite' | 'recusado';
}
