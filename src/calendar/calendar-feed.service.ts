import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { createEvents, type DateArray, type EventAttributes } from 'ics';
import * as ical from 'node-ical';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { JwtPayload } from '../common/types/jwt-payload.interface';

interface FeedRow {
  id: string;
  titulo: string;
  descricao: string | null;
  data_hora_inicio: Date;
  data_hora_fim: Date | null;
}

function generateFeedToken(): string {
  return randomBytes(24).toString('base64url');
}

function toDateArray(d: Date): DateArray {
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()];
}

// `summary`/`description` do node-ical vêm ou como string direta ou como
// `{ val, params }` quando o VEVENT tinha parâmetros (ex. LANGUAGE) — nunca
// assumir string diretamente.
function textValue(v: string | { val: string } | undefined): string | undefined {
  if (v == null) return undefined;
  return typeof v === 'string' ? v : v.val;
}

// Import/exportação de calendário (secção calendário, 2026-09-08) — dois
// fluxos independentes e deliberadamente simples: um link .ics subscritível
// (Google/iOS/Outlook fazem polling sozinhos, sem OAuth nem infraestrutura
// nova) e um upload manual de um ficheiro .ics avulso. Sincronização
// bidirecional a sério (CalDAV/Google Calendar API) fica de fora — muito
// mais infraestrutura e manutenção do que o pedido justifica por agora.
@Injectable()
export class CalendarFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  // Token gerado só quando pedido pela primeira vez (nunca ao criar a conta
  // ou o stand) — assim nunca existe um link válido por aí sem ninguém saber
  // que existe.
  async getFeedTokens(user: JwtPayload): Promise<{ meuToken: string; standToken: string }> {
    const membro = await this.prisma.standMember.findUnique({
      where: { standId_personId: { standId: user.standId, personId: user.sub } },
    });
    if (!membro) {
      throw new NotFoundException({ error: 'nao_encontrado', message: 'Membro não encontrado.' });
    }

    let meuToken = membro.calendarFeedToken;
    if (!meuToken) {
      meuToken = generateFeedToken();
      await this.prisma.standMember.update({ where: { id: membro.id }, data: { calendarFeedToken: meuToken } });
    }

    const stand = await this.prisma.stand.findUniqueOrThrow({ where: { id: user.standId } });
    let standToken = stand.calendarFeedToken;
    if (!standToken) {
      standToken = generateFeedToken();
      await this.prisma.stand.update({ where: { id: stand.id }, data: { calendarFeedToken: standToken } });
    }

    return { meuToken, standToken };
  }

  private async resolveToken(token: string): Promise<{ schemaName: string; personId?: string }> {
    const stand = await this.prisma.stand.findUnique({ where: { calendarFeedToken: token } });
    if (stand) return { schemaName: stand.schemaName };

    const membro = await this.prisma.standMember.findUnique({
      where: { calendarFeedToken: token },
      include: { stand: true },
    });
    if (membro) return { schemaName: membro.stand.schemaName, personId: membro.personId };

    throw new NotFoundException({ error: 'token_invalido', message: 'Link de calendário inválido.' });
  }

  // Sem janela de datas — isto é um feed subscrito por apps externas, que só
  // voltam a pedir de vez em quando (não é uma sessão interativa a paginar);
  // manda-se sempre tudo o que existir.
  async getIcsFeed(token: string): Promise<string> {
    const { schemaName, personId } = await this.resolveToken(token);

    const params: unknown[] = [];
    let where = '1=1';
    if (personId) {
      params.push(personId);
      where = `(e.criado_por = $1 OR EXISTS (
        SELECT 1 FROM calendar_event_participants ep WHERE ep.event_id = e.id AND ep.person_id = $1
      ))`;
    }

    const eventos = await this.tenant.query<FeedRow>(
      schemaName,
      `SELECT e.id, e.titulo, e.descricao, e.data_hora_inicio, e.data_hora_fim
       FROM calendar_events e
       WHERE ${where}
       ORDER BY e.data_hora_inicio`,
      params,
    );

    const eventAttributes: EventAttributes[] = eventos.map((e) => {
      const inicio = new Date(e.data_hora_inicio);
      const fim = e.data_hora_fim ? new Date(e.data_hora_fim) : null;
      return {
        uid: `${e.id}@pscarstand.pt`,
        title: e.titulo,
        description: e.descricao ?? undefined,
        start: toDateArray(inicio),
        startInputType: 'utc',
        startOutputType: 'utc',
        endOutputType: 'utc',
        // Tarefas sem hora de fim (secção calendário) ficam com 30min por
        // omissão — `ics` exige `end` ou `duration`, não dá para omitir os dois.
        ...(fim ? { end: toDateArray(fim), endInputType: 'utc' as const } : { duration: { minutes: 30 } }),
      };
    });

    const { error, value } = createEvents(eventAttributes, {
      productId: '-//PS CarStand//Calendário//PT',
      calName: 'PS CarStand',
    });
    if (error) throw new BadRequestException({ error: 'erro_gerar_ics', message: error.message });
    return value ?? '';
  }

  // Ação pontual/manual (sem janela de datas) — o utilizador já escolheu um
  // ficheiro .ics específico do lado de fora, não faz sentido filtrar aqui.
  async importIcs(user: JwtPayload, buffer: Buffer): Promise<{ importados: number; total: number }> {
    let parsed: ical.CalendarResponse;
    try {
      parsed = await ical.async.parseICS(buffer.toString('utf8'));
    } catch {
      throw new BadRequestException({
        error: 'ficheiro_invalido',
        message: 'Não foi possível ler este ficheiro .ics.',
      });
    }

    const vevents = Object.values(parsed).filter((c): c is ical.VEvent => c?.type === 'VEVENT');
    let importados = 0;
    for (const v of vevents) {
      const titulo = textValue(v.summary);
      if (!v.uid || !v.start || !titulo) continue;
      const rows = await this.tenant.query<{ id: string }>(
        user.schemaName,
        `INSERT INTO calendar_events (titulo, descricao, data_hora_inicio, data_hora_fim, criado_por, external_uid)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (external_uid) DO NOTHING RETURNING id`,
        [titulo, textValue(v.description) ?? null, v.start, v.end ?? null, user.sub, v.uid],
      );
      if (rows.length > 0) importados++;
    }

    return { importados, total: vevents.length };
  }
}
