import { Module } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsAdminController } from './suggestions-admin.controller';

@Module({
  controllers: [SuggestionsController, SuggestionsAdminController],
  providers: [SuggestionsService],
})
export class SuggestionsModule {}
