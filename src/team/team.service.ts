import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtPayload } from '../common/types/jwt-payload.interface';
import { hashPassword } from '../common/utils/password.util';

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
}
