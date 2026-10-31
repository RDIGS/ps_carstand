import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

// O Render (plano free) adormece o serviço ao fim de 15 min sem pedidos de
// fora. O ping agendado no GitHub (.github/workflows/manter-acordado.yml)
// devia evitá-lo, mas na prática o GitHub só o corre de ~6 em ~6 horas.
// Por isso o próprio servidor pede o seu /health pelo endereço público de
// 10 em 10 min: o pedido entra pela rede do Render como qualquer outro e
// conta como atividade. Enquanto está acordado mantém-se acordado; se
// adormecer (deploy, reinício), o GitHub ou o primeiro utilizador acordam-no.
// `RENDER_EXTERNAL_URL` é definida pelo próprio Render — localmente não
// existe e o ping não corre.
@Injectable()
export class ManterAcordadoCron {
  private readonly logger = new Logger(ManterAcordadoCron.name);
  private readonly url = process.env.RENDER_EXTERNAL_URL ? `${process.env.RENDER_EXTERNAL_URL}/health` : null;

  @Cron('*/10 * * * *')
  async ping(): Promise<void> {
    if (!this.url) return;
    try {
      const res = await fetch(this.url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) this.logger.warn(`Ping a ${this.url} devolveu ${res.status}`);
    } catch (e) {
      this.logger.warn(`Ping a ${this.url} falhou: ${(e as Error).message}`);
    }
  }
}
