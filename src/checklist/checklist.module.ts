import { Module } from '@nestjs/common';
import { ChecklistService } from './checklist.service';
import { ChecklistRepository } from './checklist.repository';
import { ChecklistTemplatesController } from './checklist-templates.controller';
import { VehicleChecklistController } from './vehicle-checklist.controller';
import { VehiclesModule } from '../vehicles/vehicles.module';

@Module({
  imports: [VehiclesModule],
  controllers: [ChecklistTemplatesController, VehicleChecklistController],
  providers: [ChecklistService, ChecklistRepository],
})
export class ChecklistModule {}
