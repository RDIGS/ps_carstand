import { PlatformEntityConfig } from '@prisma/client';
import { gerarIdentificacaoPsCarstand } from './identificacao.util';

// Secção 24.1 do documento de arquitetura, literal. ⚠️ Rascunho de arranque,
// não substitui revisão por advogado licenciado em Portugal. Os campos
// [ENTRE PARÊNTESIS] (prazos, foro) continuam por decidir — deixados tal
// qual no texto de propósito, não inventados aqui.
export function renderTermos(config: PlatformEntityConfig | null): string {
  const identificacao = gerarIdentificacaoPsCarstand(config);

  return `TERMOS DE SERVIÇO — PS CARSTAND

Última atualização: [DATA]

1. IDENTIFICAÇÃO DAS PARTES
Estes Termos de Serviço ("Termos") regulam a utilização da plataforma
PS CarStand ("Plataforma", "Serviço"), disponibilizada por
${identificacao} ("PS CarStand", "nós"),
pelo cliente que subscreve o Serviço ("Cliente", "Stand", "tu"), na
qualidade de titular ou representante legal do stand automóvel
identificado no momento da subscrição.

2. OBJETO
2.1. A PS CarStand disponibiliza ao Cliente uma aplicação de gestão de
stands automóvel, incluindo gestão de veículos, processamento de
documentos (DUA, Cartão de Cidadão), geração de documentos de venda,
gestão de equipa e ferramentas de análise financeira, conforme descrito
na documentação do Serviço.
2.2. O Serviço é disponibilizado por subscrição, mediante o pagamento
de uma mensalidade ou anuidade acordada no momento da contratação.

3. CONTA, TOKEN DE ACESSO E UTILIZADORES
3.1. O acesso ao Serviço é feito através de um token de stand, associado
exclusivamente ao Cliente, e de contas individuais para cada
utilizador (proprietário e vendedores) que o Cliente autorizar.
3.2. O Cliente é responsável por manter a confidencialidade das
credenciais de acesso da sua equipa e por toda a atividade realizada
através das contas dos seus utilizadores.
3.3. O Cliente compromete-se a notificar a PS CarStand imediatamente em
caso de suspeita de acesso não autorizado.

4. SUBSCRIÇÃO, PAGAMENTO E RENOVAÇÃO
4.1. O plano subscrito (mensal ou anual), o valor e a forma de
pagamento são acordados no momento da contratação.
4.2. Em caso de atraso no pagamento, o Serviço mantém-se ativo durante
um período de carência de 5 (cinco) dias após a data de vencimento,
findo o qual o acesso é suspenso até regularização, sem prejuízo dos
valores em dívida.
4.3. A suspensão do Serviço por falta de pagamento não implica o
apagamento dos dados do Cliente, que permanecem acessíveis após a
regularização da subscrição.

5. OBRIGAÇÕES DO CLIENTE
5.1. O Cliente compromete-se a:
   a) utilizar o Serviço de forma lícita e em conformidade com a
      legislação aplicável, incluindo em matéria de proteção de dados
      pessoais;
   b) garantir que possui base legal adequada para o tratamento de
      dados pessoais de terceiros (nomeadamente compradores de
      viaturas) que insira ou digitalize através da Plataforma;
   c) não utilizar o Serviço para fins fraudulentos ou ilícitos.
5.2. O Cliente é o único responsável pela exatidão dos dados inseridos
na Plataforma, incluindo dados de veículos, preços e informação de
compradores.

6. OBRIGAÇÕES DA PS CARSTAND
6.1. A PS CarStand compromete-se a disponibilizar o Serviço com um
nível de disponibilidade razoável, podendo realizar manutenções
programadas mediante aviso prévio quando possível.
6.2. A PS CarStand implementa medidas técnicas e organizativas
adequadas para proteger os dados armazenados na Plataforma, conforme
detalhado no Acordo de Subcontratação de Dados.

7. PROPRIEDADE INTELECTUAL
7.1. A Plataforma, o seu código, design e marca são propriedade
exclusiva da PS CarStand. O Cliente não adquire qualquer direito sobre
estes, para além do direito de uso do Serviço nos termos deste
contrato.
7.2. Os dados inseridos pelo Cliente (veículos, vendas, documentos)
permanecem propriedade do Cliente.

8. PROTEÇÃO DE DADOS
O tratamento de dados pessoais no âmbito do Serviço rege-se pela
Política de Privacidade e, quanto aos dados de terceiros tratados pela
PS CarStand em nome do Cliente, pelo Acordo de Subcontratação de
Dados, que fazem parte integrante destes Termos.

9. SUSPENSÃO E CESSAÇÃO
9.1. Qualquer das partes pode cessar o contrato mediante aviso prévio
de [PRAZO, ex: 30 dias].
9.2. A PS CarStand pode suspender o acesso do Cliente em caso de
incumprimento grave destes Termos, incluindo utilização ilícita do
Serviço.
9.3. Após a cessação do contrato, os dados do Cliente são
disponibilizados para exportação durante um período de [PRAZO, ex: 30
dias], findo o qual poderão ser eliminados.

10. LIMITAÇÃO DE RESPONSABILIDADE
10.1. A PS CarStand não se responsabiliza por danos indiretos,
lucros cessantes, ou perdas resultantes de indisponibilidade do
Serviço, exceto em casos de dolo ou negligência grave.
10.2. A responsabilidade total da PS CarStand perante o Cliente,
qualquer que seja a causa, está limitada ao valor pago pelo Cliente
nos [PERÍODO, ex: 12 meses] anteriores ao facto que originou o dano.

11. ALTERAÇÕES AOS TERMOS
A PS CarStand pode alterar estes Termos, notificando o Cliente com
uma antecedência mínima de [PRAZO, ex: 30 dias] relativamente a
alterações substanciais.

12. LEI APLICÁVEL E FORO
Estes Termos regem-se pela lei portuguesa. Para a resolução de
qualquer litígio emergente deste contrato, é competente o foro da
comarca de [LOCALIDADE], com expressa renúncia a qualquer outro.`;
}
