import { UrlsAssinadasInterceptor } from './urls-assinadas.interceptor';
import { StorageService } from './storage.service';

// Segurança (2026-11): a BD guarda `sb:<caminho>`; só se assinam (links de
// 1 h) ficheiros do próprio stand de quem pede, e só em campos de ficheiro.

const USER = { sub: 'p', standId: 'stand-a', schemaName: 'stand_a', role: 'owner', nome: 'x' };

describe('UrlsAssinadasInterceptor', () => {
  let storage: { assinar: jest.Mock };
  let interceptor: UrlsAssinadasInterceptor;
  const converter = (body: unknown, req: object) => (interceptor as any).converter(body, req);

  beforeEach(() => {
    storage = {
      assinar: jest.fn((caminhos: string[]) => Promise.resolve(new Map(caminhos.map((c) => [c, `https://assinado/${c}`])))),
    };
    interceptor = new UrlsAssinadasInterceptor(storage as unknown as StorageService);
  });

  it('assina ficheiros do próprio stand, em qualquer profundidade', async () => {
    const body = { data: [{ foto_capa: 'sb:stand_a/v/1.jpg', docs: { url: 'sb:stand_a/d.pdf' } }], logoUrl: 'sb:stands/stand-a/logo.jpg' };
    await converter(body, { user: USER });
    expect(body.data[0].foto_capa).toBe('https://assinado/stand_a/v/1.jpg');
    expect(body.data[0].docs.url).toBe('https://assinado/stand_a/d.pdf');
    expect(body.logoUrl).toBe('https://assinado/stands/stand-a/logo.jpg');
  });

  it('recusa ficheiros de outro stand (fica null, nunca é assinado)', async () => {
    const body = { url: 'sb:stand_b/segredo.jpg', logoUrl: 'sb:stands/stand-b/logo.jpg' };
    await converter(body, { user: USER });
    expect(body.url).toBeNull();
    expect(body.logoUrl).toBeNull();
    expect(storage.assinar).toHaveBeenCalledWith([]);
  });

  it('recusa caminhos com ".." (sair da pasta do stand)', async () => {
    const body = { url: 'sb:stand_a/../stand_b/x.jpg' };
    await converter(body, { user: USER });
    expect(body.url).toBeNull();
  });

  it('não toca em texto livre que comece por "sb:" fora de campos de ficheiro', async () => {
    const body = { descricao: 'sb:stand_a/x.jpg' };
    await converter(body, { user: USER });
    expect(body.descricao).toBe('sb:stand_a/x.jpg');
  });

  it('pedidos públicos (sem sessão) não assinam nada', async () => {
    const body = { url: 'sb:stand_a/x.jpg' };
    await converter(body, { path: '/site/qualquer' });
    expect(body.url).toBeNull();
  });

  it('URLs antigos (ainda não migrados) passam inalterados', async () => {
    const body = { url: 'https://exemplo/antigo.jpg?token=1' };
    await converter(body, { user: USER });
    expect(body.url).toBe('https://exemplo/antigo.jpg?token=1');
  });
});
