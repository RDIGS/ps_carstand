import { IsIn } from 'class-validator';

export class UpdateIdiomaDto {
  @IsIn(['pt', 'en'])
  idioma!: 'pt' | 'en';
}
