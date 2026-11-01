import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { hashPassword } from '../common/utils/password.util';
import { hashToken } from '../common/utils/token-hash.util';

// Login e renovação de sessão: as regras que protegem as contas.

const STAND = { id: 'stand-1', nome: 'Stand', schemaName: 'stand_x', tokenEstado: 'ativo' };

describe('AuthService', () => {
  let prisma: any;
  let jwt: any;
  let service: AuthService;
  let hashCerto: string;

  beforeAll(async () => {
    hashCerto = await hashPassword('password-certa');
  });

  const pessoa = (extra: object = {}) => ({
    id: 'p-1',
    nome: 'Ana',
    email: 'ana@x.pt',
    ativo: true,
    passwordHash: hashCerto,
    idioma: 'pt',
    tema: 'luxo',
    ...extra,
  });

  beforeEach(() => {
    prisma = {
      person: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
      standMember: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
      stand: { findUniqueOrThrow: jest.fn().mockResolvedValue(STAND) },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('jwt-assinado') };
    const config = { get: (k: string, d?: unknown) => (k === 'JWT_SECRET' ? 'segredo' : d) };
    service = new AuthService(prisma, jwt, config as any);
  });

  describe('login', () => {
    const membroAtivo = { ativo: true, role: 'vendedor' };

    it('password errada → erro genérico (não diz se o email existe)', async () => {
      prisma.person.findUnique.mockResolvedValue(pessoa());
      const erro = await service.login('ana@x.pt', 'errada', 'stand-1').catch((e) => e);
      expect(erro).toBeInstanceOf(UnauthorizedException);
      expect(erro.getResponse().error).toBe('credenciais_invalidas');
    });

    it('email inexistente → o mesmo erro genérico', async () => {
      prisma.person.findUnique.mockResolvedValue(null);
      const erro = await service.login('ninguem@x.pt', 'x', 'stand-1').catch((e) => e);
      expect(erro.getResponse().error).toBe('credenciais_invalidas');
    });

    it('pessoa desativada não entra, mesmo com a password certa', async () => {
      prisma.person.findUnique.mockResolvedValue(pessoa({ ativo: false }));
      await expect(service.login('ana@x.pt', 'password-certa', 'stand-1')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('quem não é membro (ou está desativado) deste stand não entra', async () => {
      prisma.person.findUnique.mockResolvedValue(pessoa());
      prisma.standMember.findUnique.mockResolvedValueOnce(null);
      await expect(service.login('ana@x.pt', 'password-certa', 'stand-1')).rejects.toBeInstanceOf(UnauthorizedException);
      prisma.standMember.findUnique.mockResolvedValueOnce({ ...membroAtivo, ativo: false });
      await expect(service.login('ana@x.pt', 'password-certa', 'stand-1')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('stand com subscrição expirada/suspensa/pendente → bloqueado', async () => {
      prisma.person.findUnique.mockResolvedValue(pessoa());
      prisma.standMember.findUnique.mockResolvedValue(membroAtivo);
      for (const tokenEstado of ['expirado', 'suspenso', 'pendente']) {
        prisma.stand.findUniqueOrThrow.mockResolvedValueOnce({ ...STAND, tokenEstado });
        await expect(service.login('ana@x.pt', 'password-certa', 'stand-1')).rejects.toBeInstanceOf(ForbiddenException);
      }
    });

    it('login certo devolve sessão, idioma e tema, e guarda só o hash do refresh token', async () => {
      prisma.person.findUnique.mockResolvedValue(pessoa());
      prisma.standMember.findUnique.mockResolvedValue(membroAtivo);
      const r = await service.login('ana@x.pt', 'password-certa', 'stand-1');
      expect(r.jwt).toBe('jwt-assinado');
      expect(r.user).toMatchObject({ id: 'p-1', role: 'vendedor', idioma: 'pt', tema: 'luxo' });
      const guardado = prisma.refreshToken.create.mock.calls[0][0].data;
      expect(guardado.tokenHash).toBe(hashToken(r.refreshToken));
      expect(guardado.tokenHash).not.toBe(r.refreshToken);
    });
  });

  describe('refresh', () => {
    const tokenGuardado = (extra: object = {}) => ({
      id: 'rt-1',
      personId: 'p-1',
      standId: 'stand-1',
      expiraEm: new Date(Date.now() + 60_000),
      revogado: false,
      usadoEm: null,
      ...extra,
    });

    beforeEach(() => {
      prisma.person.findUniqueOrThrow.mockResolvedValue(pessoa());
      prisma.standMember.findUniqueOrThrow.mockResolvedValue({ ativo: true, role: 'owner' });
    });

    it('roda o token: o antigo fica usado e o novo é diferente', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(tokenGuardado());
      const r = await service.refresh('token-antigo');
      expect(r.refreshToken).not.toBe('token-antigo');
      expect(prisma.refreshToken.update.mock.calls[0][0].data).toMatchObject({ revogado: true });
    });

    it('reutilizar um token já usado (sinal de roubo) revoga TODAS as sessões da pessoa', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(tokenGuardado({ usadoEm: new Date(), revogado: true }));
      const erro = await service.refresh('token-roubado').catch((e) => e);
      expect(erro.getResponse().error).toBe('sessao_comprometida');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { personId: 'p-1', revogado: false },
        data: { revogado: true },
      });
    });

    it('token expirado ou inexistente → sessão inválida', async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce(tokenGuardado({ expiraEm: new Date(Date.now() - 1000) }));
      await expect(service.refresh('x')).rejects.toBeInstanceOf(UnauthorizedException);
      prisma.refreshToken.findUnique.mockResolvedValueOnce(null);
      await expect(service.refresh('x')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('membro desativado entretanto já não renova a sessão', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(tokenGuardado());
      prisma.standMember.findUniqueOrThrow.mockResolvedValue({ ativo: false, role: 'owner' });
      await expect(service.refresh('x')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('a renovação devolve o papel ATUAL (não o do token antigo)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(tokenGuardado());
      prisma.standMember.findUniqueOrThrow.mockResolvedValue({ ativo: true, role: 'vendedor' });
      const r = await service.refresh('x');
      expect(r.user.role).toBe('vendedor');
      expect(jwt.signAsync.mock.calls[0][0].role).toBe('vendedor');
    });
  });
});
