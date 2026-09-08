import { BadRequestException, Controller, Get, Header, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { CalendarFeedService } from './calendar-feed.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtPayload } from '../common/types/jwt-payload.interface';

// Base absoluta construída a partir do próprio pedido (sem env var nova) —
// Render está sempre atrás de TLS, por isso só localhost fica em http.
function baseUrl(req: Request): string {
  const host = req.get('host') ?? 'localhost:3000';
  const proto = host.includes('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

@Controller('calendar')
export class CalendarFeedController {
  constructor(private readonly feedService: CalendarFeedService) {}

  @Get('feed-links')
  async feedLinks(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    const { meuToken, standToken } = await this.feedService.getFeedTokens(user);
    const base = baseUrl(req);
    return {
      meuUrl: `${base}/calendar/feed.ics?token=${meuToken}`,
      standUrl: `${base}/calendar/feed.ics?token=${standToken}`,
    };
  }

  // Público de propósito (ver Public()) — Google Calendar/iOS/Outlook fazem
  // polling a este URL sozinhos, sem cabeçalhos de autenticação; o token de
  // 32 bytes na query string é a única credencial (mesmo modelo do "link
  // secreto" do próprio Google Calendar).
  @Public()
  @Get('feed.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  async feedIcs(@Query('token') token: string) {
    if (!token) throw new BadRequestException({ error: 'token_em_falta', message: 'Token em falta.' });
    return this.feedService.getIcsFeed(token);
  }

  @Post('import')
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  async import(@CurrentUser() user: JwtPayload, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({ error: 'campos_em_falta', message: 'É necessário enviar um ficheiro .ics.' });
    }
    return this.feedService.importIcs(user, file.buffer);
  }
}
