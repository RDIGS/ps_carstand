import { PlatformEntityConfig } from '@prisma/client';
import { gerarIdentificacaoPsCarstand } from './identificacao.util';

// Secção 24.2 do documento de arquitetura, literal. ⚠️ Rascunho de arranque.
export function renderPrivacidade(config: PlatformEntityConfig | null): string {
  const identificacao = gerarIdentificacaoPsCarstand(config);

  return `POLÍTICA DE PRIVACIDADE — PS CARSTAND

Última atualização: [DATA]

1. RESPONSÁVEL PELO TRATAMENTO
${identificacao} é responsável pelo
tratamento dos dados pessoais recolhidos através da aplicação
PS CarStand, no que respeita aos dados dos seus próprios utilizadores
(proprietários e vendedores de stands).

2. DADOS RECOLHIDOS
2.1. Dados de conta: nome, email, palavra-passe (encriptada), stand(s)
associado(s), função (proprietário/vendedor).
2.2. Dados de utilização: registos de atividade (auditoria), preferência
de idioma.
2.3. Não recolhemos dados de pagamento diretamente — os pagamentos de
subscrição são processados por [MÉTODO/ENTIDADE, ex: transferência
bancária/MB Way, geridos manualmente].

3. FINALIDADES DO TRATAMENTO
Os dados acima são tratados para: gestão da conta e autenticação;
prestação do Serviço; comunicações relativas à subscrição (incluindo
avisos de vencimento); cumprimento de obrigações legais.

4. BASE LEGAL
O tratamento tem por base a execução do contrato de subscrição
celebrado com o Cliente (art. 6º, n.º 1, al. b) do RGPD), bem como o
cumprimento de obrigações legais quando aplicável.

5. PRAZO DE CONSERVAÇÃO
Os dados de conta são conservados enquanto a subscrição estiver ativa e
durante o período legal de conservação de documentos comerciais
aplicável após a cessação ([PRAZO, ex: 10 anos] por defeito — a
confirmar com contabilista/jurista).

6. PARTILHA COM TERCEIROS (SUBPROCESSADORES)
Para prestar o Serviço, recorremos aos seguintes subprocessadores:
   - Supabase Inc. (alojamento de base de dados e ficheiros)
   - Google LLC (processamento de imagens via API Gemini, para leitura
     automática de documentos)
Estas entidades processam dados exclusivamente por nossa instrução,
sujeitas a obrigações contratuais de confidencialidade e segurança.

7. TRANSFERÊNCIAS INTERNACIONAIS
Alguns subprocessadores (nomeadamente a Google, no âmbito do
processamento de imagens) podem processar dados fora do Espaço
Económico Europeu. Nesses casos, é assegurada a existência de
salvaguardas adequadas nos termos do RGPD (ex: Cláusulas Contratuais-
Tipo). [A confirmar/detalhar com jurista, consoante a região de
processamento efetivamente usada.]

8. DIREITOS DO TITULAR DOS DADOS
Nos termos do RGPD, tens direito a aceder, retificar, apagar, limitar
o tratamento, opor-te ao tratamento e solicitar a portabilidade dos
teus dados. Podes exercer estes direitos contactando
[EMAIL DE CONTACTO].

9. SEGURANÇA
Implementamos medidas técnicas e organizativas para proteger os dados,
incluindo isolamento de dados por stand, controlo de acesso baseado em
funções, e encriptação em trânsito e em repouso.

10. ALTERAÇÕES
Esta Política pode ser atualizada periodicamente. Alterações
substanciais serão comunicadas com antecedência razoável.

11. CONTACTO
Para questões relacionadas com esta Política, contacta:
[EMAIL DE CONTACTO].`;
}
