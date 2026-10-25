import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SiteService } from './site.service';
import { paginaFicha, paginaLista, paginaMarcar, paginaNaoEncontrada, paginaObrigado } from './site-html';

// Site público do stand (secção nova, 2026-10-25). O visitante vê estas
// páginas em `ps-carstand-app.onrender.com/:slug` — uma regra de rewrite do
// Static Site no Render encaminha para `/site/:slug` aqui. Os links dentro
// das páginas apontam sempre para SITE_PUBLIC_BASE_URL, para continuarem no
// domínio da app.
@Public()
@Controller()
export class SiteController {
  constructor(
    private readonly site: SiteService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get base(): string {
    return this.config.get<string>('SITE_PUBLIC_BASE_URL', 'https://ps-carstand-app.onrender.com').replace(/\/$/, '');
  }

  private html(res: Response, status: number, corpo: string, cache = false) {
    res
      .status(status)
      .type('html')
      .set('Cache-Control', cache ? 'public, max-age=60' : 'no-store')
      .send(corpo);
  }

  // Usado pelo pedido periódico que mantém o Render e o Supabase acordados
  // (faz uma query real). `ip` é o endereço do próprio pedido tal como o
  // backend o vê — serve para confirmar a configuração de `trust proxy`.
  // `site/_diag` é o mesmo, mas acessível pelo domínio da app (passa pela
  // regra de rewrite) — `_` nunca é um slug válido, por isso não colide.
  // Só devolve dados do próprio pedido (IP e cadeia de proxies de quem chama).
  @Get(['health', 'site/_diag'])
  async health(@Req() req: Request) {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, ip: req.ip };
  }

  @Get('site/:slug')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async lista(@Param('slug') slug: string, @Res() res: Response) {
    const stand = await this.site.resolverStand(slug);
    if (!stand) return this.html(res, 404, paginaNaoEncontrada());
    const veiculos = await this.site.listarVeiculos(stand.schemaName);
    this.html(res, 200, paginaLista(this.base, stand, veiculos), true);
  }

  @Get('site/:slug/v/:vehicleId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async ficha(@Param('slug') slug: string, @Param('vehicleId') vehicleId: string, @Res() res: Response) {
    const stand = await this.site.resolverStand(slug);
    const resultado = stand ? await this.site.obterVeiculo(stand.schemaName, vehicleId) : null;
    if (!stand || !resultado) return this.html(res, 404, paginaNaoEncontrada());
    this.html(res, 200, paginaFicha(this.base, stand, resultado.veiculo, resultado.fotos), true);
  }

  @Get('site/:slug/marcar')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async formulario(@Param('slug') slug: string, @Query('v') vehicleId: string | undefined, @Res() res: Response) {
    const stand = await this.site.resolverStand(slug);
    if (!stand) return this.html(res, 404, paginaNaoEncontrada());
    const veiculos = await this.site.listarVeiculos(stand.schemaName);
    this.html(res, 200, paginaMarcar(this.base, stand, veiculos, { vehicleId }, [], this.site.limitesData()));
  }

  // Corpo é um objeto simples (não um DTO) de propósito: os erros voltam ao
  // visitante dentro do próprio formulário, não como JSON de erro.
  @Post('site/:slug/marcar')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  async marcar(@Param('slug') slug: string, @Body() body: Record<string, unknown>, @Res() res: Response) {
    const stand = await this.site.resolverStand(slug);
    if (!stand) return this.html(res, 404, paginaNaoEncontrada());
    const campos = this.site.lerCampos(body ?? {});
    const erros = await this.site.criarPedido(stand.schemaName, campos);
    if (erros.length) {
      const veiculos = await this.site.listarVeiculos(stand.schemaName);
      return this.html(res, 400, paginaMarcar(this.base, stand, veiculos, campos, erros, this.site.limitesData()));
    }
    res.redirect(303, `${this.base}/${encodeURIComponent(stand.slug)}/obrigado`);
  }

  @Get('site/:slug/obrigado')
  async obrigado(@Param('slug') slug: string, @Res() res: Response) {
    const stand = await this.site.resolverStand(slug);
    if (!stand) return this.html(res, 404, paginaNaoEncontrada());
    this.html(res, 200, paginaObrigado(this.base, stand));
  }
}
