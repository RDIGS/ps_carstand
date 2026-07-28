import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { CreateStandDto } from './dto/create-stand.dto';
import { UpdateStandTokenDto } from './dto/update-stand-token.dto';
import { UpdateStandProfileDto } from './dto/update-stand-profile.dto';
import { RegisterStandPaymentDto } from './dto/register-stand-payment.dto';
import { generateStandToken } from './stand-token.util';
import { hashPassword } from '../common/utils/password.util';

@Injectable()
export class StandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  async create(dto: CreateStandDto) {
    const schemaName = `stand_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const diasAvisoPrevio = dto.plano === 'anual' ? 15 : 5;

    const stand = await this.prisma.stand.create({
      data: {
        nome: dto.nome,
        nif: dto.nif,
        morada: dto.morada,
        schemaName,
        token: generateStandToken(),
        tokenEstado: 'pendente',
        plano: dto.plano,
        precoAcordado: dto.precoAcordado,
        diasAvisoPrevio,
      },
    });

    await this.tenant.provisionSchema(schemaName);

    const passwordHash = await hashPassword(dto.ownerPassword);
    const owner = await this.prisma.person.upsert({
      where: { email: dto.ownerEmail },
      create: { nome: dto.ownerNome, email: dto.ownerEmail, passwordHash },
      update: {},
    });

    await this.prisma.standMember.create({
      data: { standId: stand.id, personId: owner.id, role: 'owner' },
    });

    return stand;
  }

  list() {
    return this.prisma.stand.findMany({ orderBy: { criadoEm: 'desc' } });
  }

  getProfile(standId: string) {
    return this.prisma.stand.findUniqueOrThrow({
      where: { id: standId },
      select: { id: true, nome: true, contacto: true, redesSociais: true },
    });
  }

  updateProfile(standId: string, dto: UpdateStandProfileDto) {
    return this.prisma.stand.update({
      where: { id: standId },
      data: {
        contacto: dto.contacto,
        redesSociais: dto.redesSociais,
      },
      select: { id: true, nome: true, contacto: true, redesSociais: true },
    });
  }

  async updateToken(standId: string, dto: UpdateStandTokenDto) {
    return this.prisma.stand.update({
      where: { id: standId },
      data: {
        tokenValidoAte: dto.tokenValidoAte ? new Date(dto.tokenValidoAte) : undefined,
        tokenEstado: dto.tokenEstado,
      },
    });
  }

  // Histórico de pagamentos da subscrição (pedido do utilizador, 2026-07-27,
  // fora da arquitetura v1.0 original) — registar um pagamento estende
  // automaticamente a validade do token e reativa-o, para não depender de
  // 2 ações manuais separadas sempre que um stand paga.
  async registerPayment(standId: string, dto: RegisterStandPaymentDto) {
    const stand = await this.prisma.stand.findUniqueOrThrow({ where: { id: standId } });

    const dataPagamento = dto.data ? new Date(dto.data) : new Date();
    const payment = await this.prisma.standPayment.create({
      data: { standId, valor: dto.valor, data: dataPagamento, notas: dto.notas },
    });

    // A extensão parte da validade atual se ainda não tiver passado (paga
    // adiantado, soma-se ao que já tinha), ou de hoje se já tiver expirado
    // (nunca "recupera" tempo que já passou em carência/expirado).
    const hoje = new Date();
    const baseValidade = stand.tokenValidoAte && stand.tokenValidoAte > hoje ? stand.tokenValidoAte : hoje;
    const novaValidade = new Date(baseValidade);
    novaValidade.setMonth(novaValidade.getMonth() + (stand.plano === 'anual' ? 12 : 1));

    const standAtualizado = await this.prisma.stand.update({
      where: { id: standId },
      data: { tokenValidoAte: novaValidade, tokenEstado: 'ativo' },
    });

    return { payment, stand: standAtualizado };
  }

  listPayments(standId: string) {
    return this.prisma.standPayment.findMany({ where: { standId }, orderBy: { data: 'desc' } });
  }

  /**
   * Job diário (ver StandsCronService): aplica automaticamente as transições
   * ativo -> em_carencia -> expirado descritas na secção 3.4.
   */
  async applyTokenLifecycleTransitions(): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const expirando = await this.prisma.stand.findMany({
      where: { tokenEstado: 'ativo', tokenValidoAte: { lt: today } },
    });
    for (const stand of expirando) {
      await this.prisma.stand.update({ where: { id: stand.id }, data: { tokenEstado: 'em_carencia' } });
    }

    const emCarencia = await this.prisma.stand.findMany({ where: { tokenEstado: 'em_carencia' } });
    for (const stand of emCarencia) {
      if (!stand.tokenValidoAte) continue;
      const limiteCarencia = new Date(stand.tokenValidoAte);
      limiteCarencia.setDate(limiteCarencia.getDate() + stand.diasCarencia);
      if (today > limiteCarencia) {
        await this.prisma.stand.update({ where: { id: stand.id }, data: { tokenEstado: 'expirado' } });
      }
    }
  }
}
