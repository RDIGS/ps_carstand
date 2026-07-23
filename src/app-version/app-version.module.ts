import { Module } from '@nestjs/common';
import { AppVersionService } from './app-version.service';
import { AppVersionController } from './app-version.controller';
import { AppVersionAdminController } from './app-version-admin.controller';

@Module({
  controllers: [AppVersionController, AppVersionAdminController],
  providers: [AppVersionService],
})
export class AppVersionModule {}
