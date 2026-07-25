import { Module } from '@nestjs/common';
import { StandsService } from './stands.service';
import { StandsController } from './stands.controller';
import { StandProfileController } from './stand-profile.controller';
import { StandsTokenLifecycleCron } from './stands-token-lifecycle.cron';

@Module({
  controllers: [StandsController, StandProfileController],
  providers: [StandsService, StandsTokenLifecycleCron],
  exports: [StandsService],
})
export class StandsModule {}
