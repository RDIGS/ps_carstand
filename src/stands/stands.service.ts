import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { CreateStandDto } from './dto/create-stand.dto';
import { UpdateStandTokenDto } from './dto/update-stand-token.dto';
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

  async updateToken(standId: string, dto: UpdateStandTokenDto) {
    return this.prisma.stand.update({
      where: { id: standId },
      data: {
        tokenValidoAte: dto.tokenValidoAte ? new Date(dto.tokenValidoAte) : undefined,
        tokenEstado: dto.tokenEstado,
      },
    });
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
