import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { comparePassword, hashPassword } from '../common/utils/password.util';
import { generateOpaqueToken, hashToken } from '../common/utils/token-hash.util';
import { JwtPayload } from '../common/types/jwt-payload.interface';
import { Stand, TokenEstado } from '@prisma/client';

const BLOCKED_TOKEN_ESTADOS: TokenEstado[] = ['expirado', 'suspenso', 'pendente'];

export interface LoginResult {
  jwt: string;
  expiresIn: number;
  refreshToken: string;
  user: { id: string; nome: string; role: string; idioma: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateToken(token: string) {
    const stand = await this.prisma.stand.findUnique({ where: { token } });
    if (!stand) {
      throw new UnauthorizedException({
        error: 'token_invalido',
        message: 'Token não encontrado ou revogado.',
      });
    }

    this.assertStandAccessible(stand);

    return {
      stand_id: stand.id,
      stand_nome: stand.nome,
      token_estado: stand.tokenEstado,
    };
  }

  async login(email: string, password: string, standId: string): Promise<LoginResult> {
    const person = await this.prisma.person.findUnique({ where: { email } });
    if (!person || !person.ativo || !(await comparePassword(password, person.passwordHash))) {
      throw new UnauthorizedException({ error: 'credenciais_invalidas', message: 'Email ou password inválidos.' });
    }

    const membership = await this.prisma.standMember.findUnique({
      where: { standId_personId: { standId, personId: person.id } },
    });
    if (!membership || !membership.ativo) {
      throw new UnauthorizedException({
        error: 'credenciais_invalidas',
        message: 'Esta conta não tem acesso a este stand.',
      });
    }

    const stand = await this.prisma.stand.findUniqueOrThrow({ where: { id: standId } });
    this.assertStandAccessible(stand);

    const payload: JwtPayload = {
      sub: person.id,
      standId: stand.id,
      schemaName: stand.schemaName,
      role: membership.role,
      nome: person.nome,
    };

    const jwt = await this.signAccessToken(payload);
    const refreshToken = await this.issueRefreshToken(person.id, stand.id);

    return {
      jwt,
      expiresIn: Number(this.config.get('JWT_EXPIRES_IN', 3600)),
      refreshToken,
      user: { id: person.id, nome: person.nome, role: membership.role, idioma: person.idioma },
    };
  }

  async refresh(rawRefreshToken: string): Promise<LoginResult> {
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing || existing.expiraEm < new Date()) {
      throw new UnauthorizedException({ error: 'sessao_invalida', message: 'Sessão expirada, inicia sessão novamente.' });
    }

    if (existing.revogado || existing.usadoEm) {
      // Reapresentação de um refresh token já consumido/revogado — sinal de
      // roubo de token (secção 21): revoga TODAS as sessões da pessoa.
      await this.prisma.refreshToken.updateMany({
        where: { personId: existing.personId, revogado: false },
        data: { revogado: true },
      });
      throw new UnauthorizedException({
        error: 'sessao_comprometida',
        message: 'Sessão inválida — inicia sessão novamente em todos os dispositivos.',
      });
    }

    const [person, membership, stand] = await Promise.all([
      this.prisma.person.findUniqueOrThrow({ where: { id: existing.personId } }),
      this.prisma.standMember.findUniqueOrThrow({
        where: { standId_personId: { standId: existing.standId, personId: existing.personId } },
      }),
      this.prisma.stand.findUniqueOrThrow({ where: { id: existing.standId } }),
    ]);
    this.assertStandAccessible(stand);

    const newRawToken = generateOpaqueToken();
    const newTokenHash = hashToken(newRawToken);
    const expiraEm = this.refreshExpiryDate();

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { usadoEm: new Date(), revogado: true, substituidoPor: newTokenHash },
      }),
      this.prisma.refreshToken.create({
        data: {
          personId: person.id,
          standId: stand.id,
          tokenHash: newTokenHash,
          expiraEm,
        },
      }),
    ]);

    const payload: JwtPayload = {
      sub: person.id,
      standId: stand.id,
      schemaName: stand.schemaName,
      role: membership.role,
      nome: person.nome,
    };

    return {
      jwt: await this.signAccessToken(payload),
      expiresIn: Number(this.config.get('JWT_EXPIRES_IN', 3600)),
      refreshToken: newRawToken,
      user: { id: person.id, nome: person.nome, role: membership.role, idioma: person.idioma },
    };
  }

  // Preferência de idioma vive em people.idioma, não no dispositivo (secção
  // 18) — assim mantém-se ao mudar de telemóvel/computador.
  async updateIdioma(personId: string, idioma: 'pt' | 'en'): Promise<{ idioma: string }> {
    const person = await this.prisma.person.update({ where: { id: personId }, data: { idioma } });
    return { idioma: person.idioma };
  }

  // Estado da subscrição para o aviso persistente no app (secção 3.4, O14) —
  // contagens calculadas sempre contra a data do servidor, nunca a do
  // dispositivo do cliente.
  async subscriptionStatus(standId: string) {
    const stand = await this.prisma.stand.findUniqueOrThrow({ where: { id: standId } });

    let diasParaExpirar: number | null = null;
    let diasCarenciaRestantes: number | null = null;

    if (stand.tokenValidoAte) {
      const hoje = new Date();
      hoje.setUTCHours(0, 0, 0, 0);
      const validoAte = new Date(stand.tokenValidoAte);
      validoAte.setUTCHours(0, 0, 0, 0);
      const umDia = 24 * 60 * 60 * 1000;

      if (stand.tokenEstado === 'ativo') {
        diasParaExpirar = Math.round((validoAte.getTime() - hoje.getTime()) / umDia);
      } else if (stand.tokenEstado === 'em_carencia') {
        const limiteCarencia = new Date(validoAte);
        limiteCarencia.setDate(limiteCarencia.getDate() + stand.diasCarencia);
        diasCarenciaRestantes = Math.round((limiteCarencia.getTime() - hoje.getTime()) / umDia);
      }
    }

    return {
      token_estado: stand.tokenEstado,
      token_valido_ate: stand.tokenValidoAte,
      dias_aviso_previo: stand.diasAvisoPrevio,
      dias_carencia: stand.diasCarencia,
      dias_para_expirar: diasParaExpirar,
      dias_carencia_restantes: diasCarenciaRestantes,
    };
  }

  // Secção 29: código curto gerado pelo super-admin (TeamService.generateResetCode),
  // partilhado por fora da app — resolve o caso do owner esquecer a password
  // sem ninguém acima dele dentro da app. Mensagem de erro genérica em todos
  // os casos de falha (email inexistente incluído) para não revelar quais
  // emails existem na plataforma.
  async resetPasswordWithCode(email: string, code: string, novaPassword: string): Promise<void> {
    const erroGenerico = new UnauthorizedException({ error: 'codigo_invalido', message: 'Código inválido ou expirado.' });

    const person = await this.prisma.person.findUnique({ where: { email } });
    if (!person) throw erroGenerico;

    const codeHash = hashToken(code.trim().toUpperCase().replace(/\s+/g, ''));
    const resetCode = await this.prisma.passwordResetCode.findUnique({ where: { codeHash } });
    if (!resetCode || resetCode.personId !== person.id || resetCode.usadoEm || resetCode.expiraEm < new Date()) {
      throw erroGenerico;
    }

    await this.prisma.$transaction([
      this.prisma.person.update({ where: { id: person.id }, data: { passwordHash: await hashPassword(novaPassword) } }),
      this.prisma.passwordResetCode.update({ where: { id: resetCode.id }, data: { usadoEm: new Date() } }),
      // Força logout em todos os dispositivos — mesma lógica da deteção de
      // roubo de refresh token (secção 21) e do reset de vendedor.
      this.prisma.refreshToken.updateMany({ where: { personId: person.id, revogado: false }, data: { revogado: true } }),
    ]);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revogado: true },
    });
  }

  private assertStandAccessible(stand: Stand): void {
    if (BLOCKED_TOKEN_ESTADOS.includes(stand.tokenEstado)) {
      throw new ForbiddenException({
        error: 'token_expirado',
        message: 'Subscrição expirada ou por ativar. Contacta o suporte da PS CarStand.',
        token_estado: stand.tokenEstado,
      });
    }
  }

  private signAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: Number(this.config.get('JWT_EXPIRES_IN', 3600)),
    });
  }

  private async issueRefreshToken(personId: string, standId: string): Promise<string> {
    const raw = generateOpaqueToken();
    await this.prisma.refreshToken.create({
      data: {
        personId,
        standId,
        tokenHash: hashToken(raw),
        expiraEm: this.refreshExpiryDate(),
      },
    });
    return raw;
  }

  private refreshExpiryDate(): Date {
    const seconds = Number(this.config.get('REFRESH_TOKEN_EXPIRES_IN', 2592000));
    return new Date(Date.now() + seconds * 1000);
  }
}
