import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Rate limiting por stand (secção 21), não por IP: um stand com vários
// vendedores em vários dispositivos partilha o mesmo limite lógico.
@Injectable()
export class StandThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.standId ?? req.ip;
  }
}
