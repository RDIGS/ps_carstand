import { IsBoolean } from 'class-validator';

export class ReserveVehicleDto {
  @IsBoolean()
  reservado!: boolean;
}
