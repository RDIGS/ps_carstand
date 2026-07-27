import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

// Painel de super-admin (secção 12.4): não faz parte do modelo owner/vendedor
// por stand, por isso não usa JWT — uma chave partilhada só para ti.
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-admin-key'];
    const expected = this.config.get<string>('ADMIN_API_KEY');

    if (!expected || typeof provided !== 'string' || !this.compararEmTempoConstante(provided, expected)) {
      throw new UnauthorizedException({ error: 'nao_autenticado', message: 'Chave de administração inválida.' });
    }
    return true;
  }

  // Comparação normal (`!==`) devolve mais rápido no 1º byte diferente —
  // teoricamente permite adivinhar a chave carácter a carácter medindo o
  // tempo de resposta. timingSafeEqual só funciona com buffers do mesmo
  // tamanho, por isso o comprimento é comparado à parte primeiro (o
  // comprimento da chave não é segredo, só o conteúdo).
  private compararEmTempoConstante(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
