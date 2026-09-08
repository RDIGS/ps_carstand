import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { CalendarFeedService } from './calendar-feed.service';
import { CalendarFeedController } from './calendar-feed.controller';

@Module({
  controllers: [CalendarController, CalendarFeedController],
  providers: [CalendarService, CalendarFeedService],
})
export class CalendarModule {}
