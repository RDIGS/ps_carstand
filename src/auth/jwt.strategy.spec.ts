import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { invalidarMembro } from './membros-ativos.cache';
import { JwtPayload } from '../common/types/jwt-payload.interface';

// Segurança (2026-11): quem é removido/desativado ou muda de papel perde o
// acesso antigo logo, não só quando o JWT expira (até 1 h).

let n = 0;
// Cada teste usa um stand diferente — a cache de membros é partilhada.
const payload = (role: 'owner' | 'vendedor' = 'vendedor'): JwtPayload => ({
  sub: 'pessoa',
  standId: `stand-${++n}`,
  schemaName: 'stand_x',
  role,
  nome: 'X',
});

describe('JwtStrategy — membro ativo e papel atual', () => {
  let prisma: any;
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = { standMember: { findUnique: jest.fn() } };
    const config = { getOrThrow: () => 'segredo-de-teste' };
    strategy = new JwtStrategy(config as any, prisma);
  });

  it('aceita membro ativo com o mesmo papel do token', async () => {
    prisma.standMember.findUnique.mockResolvedValue({ ativo: true, role: 'vendedor', person: { ativo: true } });
    const p = payload();
    await expect(strategy.validate(p)).resolves.toEqual(p);
  });

  it('recusa membro removido do stand', async () => {
    prisma.standMember.findUnique.mockResolvedValue(null);
    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa membro desativado e pessoa desativada', async () => {
    prisma.standMember.findUnique.mockResolvedValueOnce({ ativo: false, role: 'vendedor', person: { ativo: true } });
    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.standMember.findUnique.mockResolvedValueOnce({ ativo: true, role: 'vendedor', person: { ativo: false } });
    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token com papel diferente do atual (ex.: deixou de ser owner)', async () => {
    prisma.standMember.findUnique.mockResolvedValue({ ativo: true, role: 'vendedor', person: { ativo: true } });
    await expect(strategy.validate(payload('owner'))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('usa a cache, e invalidarMembro força nova verificação', async () => {
    prisma.standMember.findUnique.mockResolvedValue({ ativo: true, role: 'vendedor', person: { ativo: true } });
    const p = payload();
    await strategy.validate(p);
    await strategy.validate(p);
    expect(prisma.standMember.findUnique).toHaveBeenCalledTimes(1);

    invalidarMembro(p.sub, p.standId);
    prisma.standMember.findUnique.mockResolvedValue(null);
    await expect(strategy.validate(p)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
