import { fetch as undiciFetch, ProxyAgent, type RequestInit as UndiciRequestInit } from 'undici';

// A Generative Language API do Gemini bloqueia pedidos originados na UE
// ("User location is not supported for the API use", 400 FAILED_PRECONDITION)
// — o backend corre no Render em Frankfurt, por isso esta chamada específica
// sai através de um proxy fixo nos EUA (OCR_PROXY_URL). Sem a variável
// definida, comporta-se como um fetch normal (ex.: em dev local, onde não é
// necessário). IMPORTANTE: tem de ser um IP fixo, nunca um gateway rotativo
// — esse pode devolver IPs fora dos EUA, voltando ao mesmo erro.
//
// Usa o fetch do próprio `undici` (não o global do Node) porque só a
// implementação do pacote expõe o tipo `dispatcher` — o fetch global do
// Node também o suporta em runtime, mas os tipos do RequestInit padrão não
// o incluem.
const proxyUrl = process.env.OCR_PROXY_URL;
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

// Sem isto, um Gemini/proxy lento ou pendurado deixa o pedido à espera para
// sempre — nem o backend nem a app têm outro timeout nesta chamada, e o
// utilizador via só um spinner infinito, sem erro nenhum (bug real
// reportado em produção, 2026-07-27). O proxy dos EUA já adiciona ~38s de
// latência normal (ver OCR_PROXY_URL acima); 60s dá margem sem ser tão
// longo que pareça também pendurado.
const GEMINI_TIMEOUT_MS = 60_000;

export async function fetchGemini(url: string, init: UndiciRequestInit): Promise<Response> {
  const response = await undiciFetch(url, {
    ...init,
    ...(dispatcher ? { dispatcher } : {}),
    signal: init.signal ?? AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });
  return response as unknown as Response;
}
