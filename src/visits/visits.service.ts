import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../common/types/jwt-payload.interface';

const ESTADOS = ['pendente', 'aprovado', 'rejeitado'];

// Duração assumida da visita no calendário — a hora de fim pode ser
// ajustada depois no próprio evento.
const DURACAO_VISITA_MIN = 60;

/**
 * Pedidos de visita vindos do site público (secção nova, 2026-10-25). Só o
 * owner aprova/rejeita, a não ser que o stand tenha ligado
 * `vendedorPodeAprovarVisitas` — verificado aqui no backend (§31: nunca
 * confiar só em esconder botões na app).
 */
@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
  ) {}

  private async assertPodeGerir(user: JwtPayload): Promise<void> {
    if (user.role === 'owner') return;
    const stand = await this.prisma.stand.findUniqueOrThrow({ where: { id: user.standId } });
    if (!stand.vendedorPodeAprovarVisitas) {
      throw new ForbiddenException({ error: 'sem_permissao', message: 'Só o owner pode gerir pedidos de visita.' });
    }
  }

  async list(user: JwtPayload, estado?: string) {
    await this.assertPodeGerir(user);
    const filtro = estado && ESTADOS.includes(estado) ? estado : null;
    return this.tenant.query(
      user.schemaName,
      `SELECT r.*, v.marca, v.modelo, v.matricula
       FROM visit_requests r
       LEFT JOIN vehicles v ON v.id = r.vehicle_id
       WHERE ($1::text IS NULL OR r.estado = $1)
       ORDER BY (r.estado = 'pendente') DESC, r.data_hora ASC
       LIMIT 200`,
      [filtro],
    );
  }

  async aprovar(user: JwtPayload, id: string) {
    await this.assertPodeGerir(user);
    const client = await this.tenant.getClient(user.schemaName);
    try {
      await client.query('BEGIN');
      // Só passa se ainda estiver pendente — dois colegas a aprovar ao mesmo
      // tempo não criam a lead/evento duas vezes.
      const { rows } = await client.query(
        `UPDATE visit_requests SET estado = 'aprovado', respondido_por = $2, respondido_em = now()
         WHERE id = $1 AND estado = 'pendente' RETURNING *`,
        [id, user.sub],
      );
      const pedido = rows[0];
      if (!pedido) {
        await client.query('ROLLBACK');
        return this.erroNaoPendente(user.schemaName, id);
      }

      const { rows: veiculos } = pedido.vehicle_id
        ? await client.query(`SELECT marca, modelo FROM vehicles WHERE id = $1`, [pedido.vehicle_id])
        : { rows: [] as { marca: string; modelo: string }[] };
      const viatura = veiculos[0] ? `${veiculos[0].marca} ${veiculos[0].modelo}` : null;

      const {
        rows: [lead],
      } = await client.query(
        `INSERT INTO leads (vehicle_id, nome, telefone, email, origem, estado, notas, vendedor_id, proximo_contacto)
         VALUES ($1, $2, $3, $4, 'site', 'agendado', $5, $6, ($7::timestamptz AT TIME ZONE 'Europe/Lisbon')::date)
         RETURNING id`,
        [pedido.vehicle_id, pedido.nome, pedido.telefone, pedido.email, pedido.mensagem, user.sub, pedido.data_hora],
      );

      const descricao = [
        pedido.telefone && `Telefone: ${pedido.telefone}`,
        pedido.email && `Email: ${pedido.email}`,
        pedido.mensagem && `Mensagem: ${pedido.mensagem}`,
        'Pedido feito no site do stand.',
      ]
        .filter(Boolean)
        .join('\n');
      const {
        rows: [evento],
      } = await client.query(
        `INSERT INTO calendar_events (titulo, descricao, data_hora_inicio, data_hora_fim, vehicle_id, lead_id, criado_por)
         VALUES ($1, $2, $3, $3::timestamptz + make_interval(mins => $4), $5, $6, $7)
         RETURNING id`,
        [
          `Visita: ${pedido.nome}${viatura ? ` — ${viatura}` : ''}`,
          descricao,
          pedido.data_hora,
          DURACAO_VISITA_MIN,
          pedido.vehicle_id,
          lead.id,
          user.sub,
        ],
      );

      const {
        rows: [atualizado],
      } = await client.query(
        `UPDATE visit_requests SET lead_id = $2, calendar_event_id = $3 WHERE id = $1 RETURNING *`,
        [id, lead.id, evento.id],
      );
      await client.query('COMMIT');

      await this.audit.log(user.schemaName, {
        entidade: 'visit_request',
        entidadeId: id,
        acao: 'aprovado',
        valorNovo: { lead_id: lead.id, calendar_event_id: evento.id },
        feitoPor: user.sub,
      });
      return atualizado;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async rejeitar(user: JwtPayload, id: string) {
    await this.assertPodeGerir(user);
    const [pedido] = await this.tenant.query(
      user.schemaName,
      `UPDATE visit_requests SET estado = 'rejeitado', respondido_por = $2, respondido_em = now()
       WHERE id = $1 AND estado = 'pendente' RETURNING *`,
      [id, user.sub],
    );
    if (!pedido) return this.erroNaoPendente(user.schemaName, id);
    await this.audit.log(user.schemaName, {
      entidade: 'visit_request',
      entidadeId: id,
      acao: 'rejeitado',
      feitoPor: user.sub,
    });
    return pedido;
  }

  private async erroNaoPendente(schemaName: string, id: string): Promise<never> {
    const [existe] = await this.tenant.query(schemaName, `SELECT estado FROM visit_requests WHERE id = $1`, [id]);
    if (!existe) throw new NotFoundException({ error: 'nao_encontrado', message: 'Pedido de visita não encontrado.' });
    throw new ConflictException({ error: 'ja_respondido', message: 'Este pedido já foi respondido.' });
  }
}
