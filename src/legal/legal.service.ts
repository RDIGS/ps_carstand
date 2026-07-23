import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoDocumentoLegal } from '@prisma/client';
import { UpsertPlatformEntityConfigDto } from './dto/upsert-platform-entity-config.dto';
import { renderTermos } from './templates/termos.template';
import { renderPrivacidade } from './templates/privacidade.template';
import { renderDpa } from './templates/dpa.template';
import { JwtPayload } from '../common/types/jwt-payload.interface';

const TODOS_OS_TIPOS: TipoDocumentoLegal[] = ['termos', 'privacidade', 'dpa'];

// Secção 24: só o owner precisa de aceitar Termos+DPA (relação PS
// CarStand↔dono do stand) — Privacidade aplica-se a qualquer utilizador da
// app, owner ou vendedor.
function tiposObrigatoriosPara(role: string): TipoDocumentoLegal[] {
  return role === 'owner' ? TODOS_OS_TIPOS : ['privacidade'];
}

const RENDERERS: Record<TipoDocumentoLegal, (config: Awaited<ReturnType<LegalService['getConfig']>>) => string> = {
  termos: renderTermos,
  privacidade: renderPrivacidade,
  dpa: renderDpa,
};

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  getConfig() {
    return this.prisma.platformEntityConfig.findFirst();
  }

  async upsertConfig(dto: UpsertPlatformEntityConfigDto) {
    const existing = await this.getConfig();
    const config = existing
      ? await this.prisma.platformEntityConfig.update({ where: { id: existing.id }, data: dto })
      : await this.prisma.platformEntityConfig.create({ data: dto });

    // Secção 24.0, ponto 4: qualquer alteração à identificação conta como
    // alteração aos Termos (e, por extensão, aos outros 2 documentos que
    // também usam {{IDENTIFICACAO_PS_CARSTAND}}) — gera sempre nova versão,
    // mesmo que o resto do texto não tenha mudado.
    for (const tipo of TODOS_OS_TIPOS) {
      await this.publicarNovaVersao(tipo, config);
    }

    return config;
  }

  private async publicarNovaVersao(tipo: TipoDocumentoLegal, config: Awaited<ReturnType<LegalService['getConfig']>>) {
    const ultima = await this.prisma.legalDocument.findFirst({ where: { tipo }, orderBy: { versao: 'desc' } });
    const conteudo = RENDERERS[tipo](config);
    return this.prisma.legalDocument.create({
      data: { tipo, versao: (ultima?.versao ?? 0) + 1, conteudo },
    });
  }

  // Garante que existe pelo menos 1 versão publicada — usado tanto no
  // arranque (antes de qualquer super-admin ter mexido em
  // platform_entity_config) como para servir o texto atual a pedido.
  async getCurrentDocument(tipo: TipoDocumentoLegal) {
    const existing = await this.prisma.legalDocument.findFirst({ where: { tipo }, orderBy: { versao: 'desc' } });
    if (existing) return existing;
    const config = await this.getConfig();
    return this.publicarNovaVersao(tipo, config);
  }

  async getDocumentOrThrow(tipo: string) {
    if (!TODOS_OS_TIPOS.includes(tipo as TipoDocumentoLegal)) {
      throw new NotFoundException({ error: 'nao_encontrado', message: 'Documento legal não encontrado.' });
    }
    return this.getCurrentDocument(tipo as TipoDocumentoLegal);
  }

  // GET /legal/status (secção 24): quais documentos, de entre os
  // obrigatórios para o role deste utilizador, ainda não foram aceites na
  // versão atual — é isto que decide se a app mostra o ecrã de aceitação.
  async getStatus(user: JwtPayload) {
    const tipos = tiposObrigatoriosPara(user.role);
    const pendentes = [];
    for (const tipo of tipos) {
      const atual = await this.getCurrentDocument(tipo);
      const aceite = await this.prisma.legalAcceptance.findUnique({
        where: { personId_legalDocumentId: { personId: user.sub, legalDocumentId: atual.id } },
      });
      if (!aceite) pendentes.push({ tipo: atual.tipo, versao: atual.versao, conteudo: atual.conteudo });
    }
    return { pendentes };
  }

  // Aceitar "termos" aceita também "dpa" na mesma ação (secção 24.3: é um
  // anexo aos Termos, "não precisa de ecrã próprio") — só o owner vê termos,
  // por isso só o owner alguma vez despoleta este bundling.
  async accept(user: JwtPayload, tipo: TipoDocumentoLegal) {
    const tiposAAceitar = tipo === 'termos' ? (['termos', 'dpa'] as TipoDocumentoLegal[]) : [tipo];
    for (const t of tiposAAceitar) {
      const atual = await this.getCurrentDocument(t);
      await this.prisma.legalAcceptance.upsert({
        where: { personId_legalDocumentId: { personId: user.sub, legalDocumentId: atual.id } },
        create: { personId: user.sub, legalDocumentId: atual.id },
        update: {},
      });
    }
    return this.getStatus(user);
  }
}
