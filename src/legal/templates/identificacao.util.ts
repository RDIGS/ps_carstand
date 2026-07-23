import { PlatformEntityConfig } from '@prisma/client';

// Secção 24.0: gera o bloco de texto que substitui {{IDENTIFICACAO_PS_CARSTAND}}
// nos 3 documentos. Sem config ainda definida (super-admin não a preencheu),
// devolve um placeholder claramente identificável em vez de rebentar — os
// documentos continuam a poder ser gerados/lidos, só que com esta nota.
export function gerarIdentificacaoPsCarstand(config: PlatformEntityConfig | null): string {
  if (!config) {
    return '[IDENTIFICAÇÃO DA PS CARSTAND POR CONFIGURAR — platform_entity_config ainda não foi preenchida]';
  }

  if (config.tipoEntidade === 'singular') {
    return `${config.nome}, titular do NIF ${config.identificadorFiscal}${
      config.cae ? `, com atividade aberta sob o CAE ${config.cae}` : ''
    }, com domicílio fiscal em ${config.morada}`;
  }

  return `${config.nome}, pessoa coletiva com o NIPC ${config.identificadorFiscal}, com sede em ${config.morada}`;
}
