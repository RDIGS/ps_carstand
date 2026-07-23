import { PlatformEntityConfig } from '@prisma/client';
import { gerarIdentificacaoPsCarstand } from './identificacao.util';

// Secção 24.3 do documento de arquitetura, literal. ⚠️ O mais urgente dos 3
// de rever com um jurista — formaliza o tratamento de dados do CC/Título de
// Residência do comprador em nome do stand (secção 23).
export function renderDpa(config: PlatformEntityConfig | null): string {
  const identificacao = gerarIdentificacaoPsCarstand(config);

  return `ACORDO DE SUBCONTRATAÇÃO DE DADOS PESSOAIS

Entre ${identificacao}
("Subcontratante"/PS CarStand) e o Cliente identificado na subscrição
do Serviço ("Responsável pelo Tratamento"), nos termos do artigo 28.º
do Regulamento (UE) 2016/679 (RGPD).

1. OBJETO E DURAÇÃO
1.1. O presente Acordo regula o tratamento de dados pessoais de
terceiros (nomeadamente compradores de veículos) que o Responsável
pelo Tratamento insere ou digitaliza através da Plataforma PS CarStand,
e cujo armazenamento é efetuado pela infraestrutura da PS CarStand em
nome do Responsável.
1.2. Este Acordo vigora enquanto durar a subscrição do Serviço.

2. NATUREZA, FINALIDADE E DURAÇÃO DO TRATAMENTO
O tratamento consiste no armazenamento e processamento técnico
(incluindo leitura automática por IA) de documentos de identificação
(Cartão de Cidadão ou Título de Residência) e dados de venda de
compradores de veículos, com a finalidade exclusiva de permitir ao
Responsável gerar os documentos de venda através da Plataforma.

3. CATEGORIAS DE TITULARES E DE DADOS
Titulares: compradores de veículos junto do stand do Responsável.
Dados: nome, número de documento de identificação, NIF, morada,
contacto telefónico, imagem do documento de identificação (frente e
verso).

4. OBRIGAÇÕES DA PS CARSTAND (SUBCONTRATANTE)
A PS CarStand compromete-se a:
   a) tratar os dados exclusivamente de acordo com as instruções
      documentadas do Responsável, salvo obrigação legal em contrário;
   b) garantir que as pessoas autorizadas a tratar os dados estão
      sujeitas a dever de confidencialidade;
   c) implementar medidas técnicas e organizativas adequadas,
      incluindo isolamento de dados por stand, encriptação, e controlo
      de acesso baseado em funções;
   d) não subcontratar ulteriormente o tratamento sem autorização geral
      prévia do Responsável, informando-o de subprocessadores
      utilizados (atualmente: Supabase Inc., Google LLC);
   e) assistir o Responsável, na medida do possível, no cumprimento das
      suas obrigações de resposta a pedidos de exercício de direitos
      dos titulares dos dados;
   f) notificar o Responsável sem atraso injustificado após ter
      conhecimento de uma violação de dados pessoais;
   g) apagar ou devolver todos os dados pessoais ao Responsável no
      final da prestação do Serviço, salvo obrigação legal de
      conservação;
   h) disponibilizar ao Responsável a informação necessária para
      demonstrar o cumprimento das obrigações previstas neste Acordo.

5. DIREITO DE AUDITORIA
O Responsável pode solicitar informação razoável sobre as medidas de
segurança implementadas, nos termos a acordar entre as partes.

6. RESPONSABILIDADE
Cada parte é responsável pelos danos causados por incumprimento das
obrigações que lhe incumbem nos termos do RGPD e deste Acordo.`;
}
