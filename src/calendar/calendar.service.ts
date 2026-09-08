import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RespondEventDto } from './dto/respond-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { JwtPayload } from '../common/types/jwt-payload.interface';

interface ParticipanteRow {
  event_id: string;
  person_id: string;
  estado: string;
  respondido_em: string | null;
  nome: string | null;
}

// Calendário de equipa dentro de UM stand — nunca entre stands diferentes
// (isso quebraria o isolamento entre tenants, ver auditoria de segurança
// 2026-09-08). Um evento com 0 convidados funciona como uma tarefa do
// stand por fazer, visível a toda a gente (`concluido` = feito/por fazer).
@Injectable()
export class CalendarService {
  constructor(
    private readonly tenant: TenantService,
    private readonly prisma: PrismaService,
  ) {}

  // `person_id` é um UUID solto (sem FK, mesmo motivo de `pago_por` no
  // Financeiro) — validado aqui contra a equipa atual do stand, mesmo
  // padrão já usado em FinanceService.assertPagoPorValido.
  private async assertParticipantesValidos(standId: string, participantesIds: string[]): Promise<void> {
    if (participantesIds.length === 0) return;
    const membros = await this.prisma.standMember.findMany({
      where: { personId: { in: participantesIds }, standId },
      select: { personId: true },
    });
    if (membros.length !== participantesIds.length) {
      throw new BadRequestException({
        error: 'participante_invalido',
        message: 'Um ou mais convidados não fazem parte da equipa deste stand.',
      });
    }
  }

  private async carregarParticipantes(schemaName: string, eventIds: string[]): Promise<Map<string, ParticipanteRow[]>> {
    if (eventIds.length === 0) return new Map();
    const rows = await this.tenant.query<ParticipanteRow>(
      schemaName,
      `SELECT ep.event_id, ep.person_id, ep.estado, ep.respondido_em, p.nome
       FROM calendar_event_participants ep
       LEFT JOIN public.people p ON p.id = ep.person_id
       WHERE ep.event_id = ANY($1::uuid[])
       ORDER BY p.nome`,
      [eventIds],
    );
    const porEvento = new Map<string, ParticipanteRow[]>();
    for (const row of rows) {
      const lista = porEvento.get(row.event_id) ?? [];
      lista.push(row);
      porEvento.set(row.event_id, lista);
    }
    return porEvento;
  }

  async create(user: JwtPayload, dto: CreateEventDto) {
    const participantes = [...new Set(dto.participantesIds ?? [])];
    await this.assertParticipantesValidos(user.standId, participantes);

    const [event] = await this.tenant.query<{ id: string }>(
      user.schemaName,
      `INSERT INTO calendar_events (titulo, descricao, data_hora_inicio, data_hora_fim, vehicle_id, lead_id, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        dto.titulo,
        dto.descricao ?? null,
        dto.dataHoraInicio,
        dto.dataHoraFim ?? null,
        dto.veiculoId ?? null,
        dto.leadId ?? null,
        user.sub,
      ],
    );

    for (const personId of participantes) {
      await this.tenant.query(
        user.schemaName,
        `INSERT INTO calendar_event_participants (event_id, person_id) VALUES ($1, $2)`,
        [event.id, personId],
      );
    }

    return this.findOne(user, event.id);
  }

  async list(user: JwtPayload, query: ListEventsQueryDto) {
    const escopo = query.escopo ?? 'stand';
    const params: unknown[] = [query.inicio, query.fim];
    let where = `e.data_hora_inicio BETWEEN $1 AND $2`;
    if (escopo === 'meu') {
      params.push(user.sub);
      where += ` AND (e.criado_por = $3 OR EXISTS (
        SELECT 1 FROM calendar_event_participants ep WHERE ep.event_id = e.id AND ep.person_id = $3
      ))`;
    }

    const eventos = await this.tenant.query(
      user.schemaName,
      `SELECT e.*, v.matricula, v.marca, v.modelo, l.nome AS lead_nome, p.nome AS criado_por_nome
       FROM calendar_events e
       LEFT JOIN vehicles v ON v.id = e.vehicle_id
       LEFT JOIN leads l ON l.id = e.lead_id
       LEFT JOIN public.people p ON p.id = e.criado_por
       WHERE ${where}
       ORDER BY e.data_hora_inicio`,
      params,
    );

    const porEvento = await this.carregarParticipantes(
      user.schemaName,
      eventos.map((e) => e.id),
    );
    return eventos.map((e) => ({ ...e, participantes: porEvento.get(e.id) ?? [] }));
  }

  async findOne(user: JwtPayload, id: string) {
    const [event] = await this.tenant.query(
      user.schemaName,
      `SELECT e.*, v.matricula, v.marca, v.modelo, l.nome AS lead_nome, p.nome AS criado_por_nome
       FROM calendar_events e
       LEFT JOIN vehicles v ON v.id = e.vehicle_id
       LEFT JOIN leads l ON l.id = e.lead_id
       LEFT JOIN public.people p ON p.id = e.criado_por
       WHERE e.id = $1`,
      [id],
    );
    if (!event) throw new NotFoundException({ error: 'nao_encontrado', message: 'Evento não encontrado.' });

    const porEvento = await this.carregarParticipantes(user.schemaName, [id]);
    return { ...event, participantes: porEvento.get(id) ?? [] };
  }

  async update(user: JwtPayload, id: string, dto: UpdateEventDto) {
    const existing = await this.findOne(user, id);
    const souAutor = existing.criado_por === user.sub;
    if (!souAutor && user.role !== 'owner') {
      throw new ForbiddenException({
        error: 'sem_permissao',
        message: 'Só quem criou o evento (ou o owner) pode editá-lo.',
      });
    }

    if (dto.participantesIds !== undefined) {
      const participantes = [...new Set(dto.participantesIds)];
      await this.assertParticipantesValidos(user.standId, participantes);
      // Substitui a lista mas mantém a resposta de quem continua convidado
      // — `ON CONFLICT DO NOTHING` não reabre "pendente" para quem já
      // tinha respondido e continua na lista nova.
      await this.tenant.query(
        user.schemaName,
        `DELETE FROM calendar_event_participants WHERE event_id = $1 AND NOT (person_id = ANY($2::uuid[]))`,
        [id, participantes],
      );
      for (const personId of participantes) {
        await this.tenant.query(
          user.schemaName,
          `INSERT INTO calendar_event_participants (event_id, person_id) VALUES ($1, $2)
           ON CONFLICT (event_id, person_id) DO NOTHING`,
          [id, personId],
        );
      }
    }

    const fields: Record<string, unknown> = {
      titulo: dto.titulo,
      descricao: dto.descricao,
      data_hora_inicio: dto.dataHoraInicio,
      data_hora_fim: dto.dataHoraFim,
      vehicle_id: dto.veiculoId,
      lead_id: dto.leadId,
      concluido: dto.concluido,
    };
    const colunas = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (colunas.length > 0) {
      const setClauses = colunas.map(([col], i) => `${col} = $${i + 2}`);
      await this.tenant.query(
        user.schemaName,
        `UPDATE calendar_events SET ${setClauses.join(', ')}, atualizado_em = now() WHERE id = $1`,
        [id, ...colunas.map(([, v]) => v)],
      );
    }

    return this.findOne(user, id);
  }

  // Marcar uma tarefa/evento como feito é mais leve que editar o resto —
  // qualquer membro da equipa pode fazê-lo (não só quem criou), porque uma
  // tarefa do stand não alocada a ninguém é responsabilidade de todos.
  async toggleConcluido(user: JwtPayload, id: string, concluido: boolean) {
    await this.findOne(user, id);
    await this.tenant.query(
      user.schemaName,
      `UPDATE calendar_events SET concluido = $2, atualizado_em = now() WHERE id = $1`,
      [id, concluido],
    );
    return this.findOne(user, id);
  }

  async responder(user: JwtPayload, id: string, dto: RespondEventDto) {
    await this.findOne(user, id);
    const rows = await this.tenant.query(
      user.schemaName,
      `UPDATE calendar_event_participants SET estado = $3, respondido_em = now()
       WHERE event_id = $1 AND person_id = $2 RETURNING *`,
      [id, user.sub, dto.estado],
    );
    if (rows.length === 0) {
      throw new NotFoundException({ error: 'nao_convidado', message: 'Não foste convidado para este evento.' });
    }
    return this.findOne(user, id);
  }

  async remove(user: JwtPayload, id: string) {
    const existing = await this.findOne(user, id);
    const souAutor = existing.criado_por === user.sub;
    if (!souAutor && user.role !== 'owner') {
      throw new ForbiddenException({
        error: 'sem_permissao',
        message: 'Só quem criou o evento (ou o owner) pode apagá-lo.',
      });
    }
    await this.tenant.query(user.schemaName, `DELETE FROM calendar_events WHERE id = $1`, [id]);
  }
}
