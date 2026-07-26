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

export async function fetchGemini(url: string, init: UndiciRequestInit): Promise<Response> {
  const response = await undiciFetch(url, dispatcher ? { ...init, dispatcher } : init);
  return response as unknown as Response;
}
