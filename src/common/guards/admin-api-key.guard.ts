import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Painel de super-admin (secção 12.4): não faz parte do modelo owner/vendedor
// por stand, por isso não usa JWT — uma chave partilhada só para ti.
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-admin-key'];
    const expected = this.config.get<string>('ADMIN_API_KEY');

    if (!expected || provided !== expected) {
      throw new UnauthorizedException({ error: 'nao_autenticado', message: 'Chave de administração inválida.' });
    }
    return true;
  }
}
