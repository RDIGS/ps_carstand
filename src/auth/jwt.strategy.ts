import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../common/types/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { guardarMembroEmCache, lerMembroEmCache } from './membros-ativos.cache';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      // Reforço explícito (o `jsonwebtoken` já recusa `alg: none`/confusão
      // RS-HS por omissão com uma secret HMAC simples, mas fixar aqui não
      // deixa isso implícito/dependente da versão da biblioteca).
      algorithms: ['HS256'],
    });
  }

  // O que aqui é devolvido fica disponível em `request.user`. Confirma que a
  // pessoa ainda é membro ativo com o mesmo papel do token (ver
  // membros-ativos.cache.ts); se não, 401 — a app tenta renovar a sessão e o
  // refresh já devolve o papel novo, ou recusa se o membro saiu.
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    let estado = lerMembroEmCache(payload.standId, payload.sub);
    if (!estado) {
      const membro = await this.prisma.standMember.findUnique({
        where: { standId_personId: { standId: payload.standId, personId: payload.sub } },
        select: { ativo: true, role: true, person: { select: { ativo: true } } },
      });
      guardarMembroEmCache(payload.standId, payload.sub, !!membro?.ativo && !!membro.person.ativo, membro?.role ?? null);
      estado = lerMembroEmCache(payload.standId, payload.sub)!;
    }
    if (!estado.ativo || estado.role !== payload.role) {
      throw new UnauthorizedException({ error: 'sessao_invalida', message: 'Sessão expirada, inicia sessão novamente.' });
    }
    return payload;
  }
}
