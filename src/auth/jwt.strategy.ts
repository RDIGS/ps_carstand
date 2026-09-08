import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../common/types/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
      // Reforço explícito (o `jsonwebtoken` já recusa `alg: none`/confusão
      // RS-HS por omissão com uma secret HMAC simples, mas fixar aqui não
      // deixa isso implícito/dependente da versão da biblioteca).
      algorithms: ['HS256'],
    });
  }

  // O que aqui é devolvido fica disponível em `request.user`.
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return payload;
  }
}
