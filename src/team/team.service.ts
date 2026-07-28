import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtPayload } from '../common/types/jwt-payload.interface';
import { hashPassword } from '../common/utils/password.util';
import { hashToken } from '../common/utils/token-hash.util';
import { generatePasswordResetCode } from '../common/utils/reset-code.util';

const RESET_CODE_VALIDADE_MS = 60 * 60 * 1000; // 1h — código de uso único, ver secção 29

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(standId: string) {
    return this.prisma.standMember.findMany({
      where: { standId },
      include: { person: { select: { id: true, nome: true, email: true, ativo: true } } },
      orderBy: { criadoEm: 'asc' },
    });
  }

  async invite(user: JwtPayload, dto: InviteMemberDto) {
    let person = await this.prisma.person.findUnique({ where: { email: dto.email } });
    let tempPassword: string | undefined;

    if (!person) {
      // Pessoa nova na plataforma: gera password temporária para o owner
      // partilhar por fora da app (secção 3.2 — ainda não há envio de email).
      tempPassword = randomBytes(6).toString('base64url');
      person = await this.prisma.person.create({
        data: { nome: dto.nome, email: dto.email, passwordHash: await hashPassword(tempPassword) },
      });
    }

    const existingMembership = await this.prisma.standMember.findUnique({
      where: { standId_personId: { standId: user.standId, personId: person.id } },
    });
    if (existingMembership) {
      throw new BadRequestException({ error: 'membro_ja_existe', message: 'Esta pessoa já faz parte da equipa.' });
    }

    const membership = await this.prisma.standMember.create({
      data: { standId: user.standId, personId: person.id, role: dto.role },
    });

    await this.audit.log(user.schemaName, {
      entidade: 'stand_member',
      entidadeId: membership.id,
      acao: 'convidado',
      valorNovo: { personId: person.id, email: person.email, role: dto.role },
      feitoPor: user.sub,
    });

    return { membership, tempPassword };
  }

  async update(user: JwtPayload, memberId: string, dto: UpdateMemberDto) {
    const membership = await this.prisma.standMember.findFirst({ where: { id: memberId, standId: user.standId } });
    if (!membership) throw new NotFoundException({ error: 'nao_encontrado', message: 'Membro não encontrado.' });

    const updated = await this.prisma.standMember.update({
      where: { id: memberId },
      data: { role: dto.role, ativo: dto.ativo },
    });

    await this.audit.log(user.schemaName, {
      entidade: 'stand_member',
      entidadeId: memberId,
      acao: 'atualizado',
      valorAnterior: membership,
      valorNovo: updated,
      feitoPor: user.sub,
    });
    return updated;
  }

  // Sem envio de email (mesmo motivo do invite): o owner define uma password
  // temporária nova para um vendedor que se esqueceu da sua e partilha-a por
  // fora da app. Não cobre o caso do próprio owner se esquecer — nesse
  // caso a app só mostra um contacto de suporte (ver login_screen.dart).
  // Restrito a 'vendedor' de propósito: um owner não devia conseguir tirar
  // o acesso a outro owner só resetando-lhe a password.
  async resetPassword(user: JwtPayload, memberId: string) {
    const membership = await this.prisma.standMember.findFirst({ where: { id: memberId, standId: user.standId } });
    if (!membership) throw new NotFoundException({ error: 'nao_encontrado', message: 'Membro não encontrado.' });
    if (membership.role !== 'vendedor') {
      throw new BadRequestException({
        error: 'so_vendedor',
        message: 'Só é possível repor a password de um vendedor. Para um owner, contacta o suporte.',
      });
    }

    const tempPassword = randomBytes(6).toString('base64url');
    await this.prisma.person.update({
      where: { id: membership.personId },
      data: { passwordHash: await hashPassword(tempPassword) },
    });
    // Força logout em todos os dispositivos — mesma lógica usada quando se
    // deteta roubo de refresh token (secção 21, auth.service.ts).
    await this.prisma.refreshToken.updateMany({
      where: { personId: membership.personId, revogado: false },
      data: { revogado: true },
    });

    await this.audit.log(user.schemaName, {
      entidade: 'stand_member',
      entidadeId: memberId,
      acao: 'password_reposta',
      feitoPor: user.sub,
    });

    return { tempPassword };
  }

  async remove(user: JwtPayload, memberId: string) {
    const membership = await this.prisma.standMember.findFirst({ where: { id: memberId, standId: user.standId } });
    if (!membership) throw new NotFoundException({ error: 'nao_encontrado', message: 'Membro não encontrado.' });

    await this.prisma.standMember.delete({ where: { id: memberId } });

    await this.audit.log(user.schemaName, {
      entidade: 'stand_member',
      entidadeId: memberId,
      acao: 'removido',
      valorAnterior: membership,
      feitoPor: user.sub,
    });
  }

  // Variantes usadas pelo painel de super-admin (AdminApiKeyGuard, sem
  // pessoa autenticada) — mesma lógica de negócio, mas parametrizadas por
  // standId em vez de um JwtPayload, e sem entrada no audit log do stand
  // (não há aqui nenhum "membro" que tenha feito a ação; é o dono da
  // plataforma a atuar de fora).
  async inviteByStandId(standId: string, dto: InviteMemberDto) {
    let person = await this.prisma.person.findUnique({ where: { email: dto.email } });
    let tempPassword: string | undefined;

    if (!person) {
      tempPassword = randomBytes(6).toString('base64url');
      person = await this.prisma.person.create({
        data: { nome: dto.nome, email: dto.email, passwordHash: await hashPassword(tempPassword) },
      });
    }

    const existingMembership = await this.prisma.standMember.findUnique({
      where: { standId_personId: { standId, personId: person.id } },
    });
    if (existingMembership) {
      throw new BadRequestException({ error: 'membro_ja_existe', message: 'Esta pessoa já faz parte da equipa.' });
    }

    const membership = await this.prisma.standMember.create({ data: { standId, personId: person.id, role: dto.role } });
    return { membership, tempPassword };
  }

  async updateByStandId(standId: string, memberId: string, dto: UpdateMemberDto) {
    const membership = await this.prisma.standMember.findFirst({ where: { id: memberId, standId } });
    if (!membership) throw new NotFoundException({ error: 'nao_encontrado', message: 'Membro não encontrado.' });
    return this.prisma.standMember.update({ where: { id: memberId }, data: { role: dto.role, ativo: dto.ativo } });
  }

  async removeByStandId(standId: string, memberId: string) {
    const membership = await this.prisma.standMember.findFirst({ where: { id: memberId, standId } });
    if (!membership) throw new NotFoundException({ error: 'nao_encontrado', message: 'Membro não encontrado.' });
    await this.prisma.standMember.delete({ where: { id: memberId } });
  }

  // Só o super-admin (painel de plataforma) gera isto — resolve o caso do
  // owner esquecer a password sem ninguém acima dele dentro da app (secção
  // 29). Funciona para qualquer role, não só owner: é sempre mais direto que
  // pedir ao super-admin para reinventar o fluxo de vendedor caso o único
  // owner de um stand também esteja bloqueado.
  async generateResetCode(standId: string, memberId: string) {
    const membership = await this.prisma.standMember.findFirst({ where: { id: memberId, standId } });
    if (!membership) throw new NotFoundException({ error: 'nao_encontrado', message: 'Membro não encontrado.' });

    const code = generatePasswordResetCode();
    const expiraEm = new Date(Date.now() + RESET_CODE_VALIDADE_MS);
    await this.prisma.passwordResetCode.create({
      data: { personId: membership.personId, codeHash: hashToken(code), expiraEm },
    });

    return { code, expiraEm };
  }
}
