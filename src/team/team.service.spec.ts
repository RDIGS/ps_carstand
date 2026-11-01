import { NotFoundException } from '@nestjs/common';
import { TeamService } from './team.service';
import { JwtPayload } from '../common/types/jwt-payload.interface';

// Equipa: desativar/remover alguém tem de cortar o acesso já, e um owner só
// mexe nos membros do próprio stand.

const OWNER: JwtPayload = { sub: 'owner', standId: 'stand-1', schemaName: 'stand_x', role: 'owner', nome: 'Dono' };
const MEMBRO = { id: 'm-1', personId: 'p-vend', standId: 'stand-1', role: 'vendedor', ativo: true };

describe('TeamService', () => {
  let prisma: any;
  let service: TeamService;

  beforeEach(() => {
    prisma = {
      standMember: {
        findFirst: jest.fn().mockResolvedValue(MEMBRO),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...MEMBRO, ...data })),
        delete: jest.fn().mockResolvedValue(MEMBRO),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({}) },
    };
    service = new TeamService(prisma, { log: jest.fn() } as any);
  });

  it('procura o membro só dentro do stand de quem pede', async () => {
    prisma.standMember.findFirst.mockResolvedValue(null);
    await expect(service.update(OWNER, 'm-de-outro-stand', { ativo: false } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.standMember.findFirst).toHaveBeenCalledWith({ where: { id: 'm-de-outro-stand', standId: 'stand-1' } });
    expect(prisma.standMember.update).not.toHaveBeenCalled();
  });

  it('desativar revoga as sessões abertas da pessoa neste stand', async () => {
    await service.update(OWNER, 'm-1', { ativo: false } as any);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { personId: 'p-vend', standId: 'stand-1', revogado: false },
      data: { revogado: true },
    });
  });

  it('mudar só o papel não termina as sessões (o papel novo chega na renovação)', async () => {
    await service.update(OWNER, 'm-1', { role: 'owner' } as any);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('remover revoga as sessões abertas da pessoa neste stand', async () => {
    await service.remove(OWNER, 'm-1');
    expect(prisma.standMember.delete).toHaveBeenCalledWith({ where: { id: 'm-1' } });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { personId: 'p-vend', standId: 'stand-1', revogado: false },
      data: { revogado: true },
    });
  });
});
