import { numeroWhatsapp, paginaFicha, paginaLista, paginaMarcar, StandPublico, VeiculoPublico } from './site-html';

// O site é público e o HTML é montado no servidor: tudo o que vem da BD ou do
// visitante tem de sair escapado (nunca vira código na página).

const BASE = 'https://app.exemplo';
const STAND: StandPublico = {
  nome: 'Stand <script>alert(1)</script>',
  slug: 'stand',
  contacto: '912 345 678',
  morada: 'Rua "A" & B',
  redesSociais: '@stand',
  logoUrl: null,
};
const carro = (extra: Partial<VeiculoPublico> = {}): VeiculoPublico => ({
  id: 'v-1',
  marca: 'BMW',
  modelo: '<img src=x onerror=alert(1)>',
  versao: 'VER AB',
  kms: 320000,
  ano: 2008,
  combustivel: 'GASOLEO',
  potencia_kw: 130,
  cilindrada: 1995,
  cor: 'CINZENTO E OUTRAS',
  num_lugares: 5,
  categoria: 'ligeiro_passageiros',
  preco: '7990.00',
  estado: 'disponivel',
  foto_capa: `${BASE}/stand/foto/f-1`,
  ...extra,
});

describe('site-html', () => {
  it('escapa o que vem da BD (nome do stand, modelo, morada)', () => {
    const html = paginaLista(BASE, STAND, [carro()]) + paginaFicha(BASE, STAND, carro(), []);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Rua &quot;A&quot; &amp; B');
  });

  it('escapa o que o visitante escreveu no formulário', () => {
    const html = paginaMarcar(BASE, STAND, [], { nome: '"><script>x</script>', mensagem: '</textarea><b>' }, [], {
      dataMin: '2026-01-01',
      dataMax: '2026-03-01',
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).not.toContain('</textarea><b>');
  });

  it('nunca mostra matrícula, chassis ou links do Storage', () => {
    const html = paginaLista(BASE, STAND, [carro()]) + paginaFicha(BASE, STAND, carro(), [`${BASE}/stand/foto/f-1`]);
    expect(html).not.toMatch(/supabase|storage\/v1|sb:/i);
  });

  it('escreve os códigos por extenso e suaviza texto em maiúsculas', () => {
    const html = paginaFicha(BASE, STAND, carro(), []);
    expect(html).toContain('Gasóleo');
    expect(html).not.toContain('GASOLEO');
    expect(html).toContain('Cinzento e outras');
    expect(html).toContain('Ligeiro de passageiros');
  });

  it('no cartão o ano não aparece repetido', () => {
    const html = paginaLista(BASE, STAND, [carro()]);
    const cartao = html.slice(html.indexOf('class="carro"'));
    expect(cartao.match(/2008/g)?.length).toBe(1);
  });

  it('reservados aparecem marcados; preço em falta diz "sob consulta"', () => {
    const html = paginaLista(BASE, STAND, [carro({ estado: 'reservado', preco: null })]);
    expect(html).toContain('Reservado');
    expect(html).toContain('Preço sob consulta');
  });

  it('sem viaturas mostra a mensagem de vazio e não parte', () => {
    expect(paginaLista(BASE, STAND, [])).toContain('não há viaturas disponíveis');
  });

  it('letras servidas pelo próprio site (nunca pela Google)', () => {
    const html = paginaLista(BASE, STAND, []);
    expect(html).toContain(`${BASE}/_fontes/Manrope-Regular.woff2`);
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });

  it('na ficha o preço e os botões vêm antes da ficha técnica (telemóvel)', () => {
    const html = paginaFicha(BASE, STAND, carro(), []);
    expect(html.indexOf('class="painel"')).toBeLessThan(html.indexOf('class="specs"'));
    expect(html.indexOf('class="g"')).toBeLessThan(html.indexOf('class="painel"'));
  });

  describe('numeroWhatsapp', () => {
    it('acrescenta 351 aos números portugueses de 9 dígitos', () => {
      expect(numeroWhatsapp('912 345 678')).toBe('351912345678');
      expect(numeroWhatsapp('219 000 000')).toBe('351219000000');
    });
    it('mantém números já internacionais', () => {
      expect(numeroWhatsapp('+351 912 345 678')).toBe('351912345678');
      expect(numeroWhatsapp('+44 7700 900123')).toBe('447700900123');
    });
    it('sem número válido não há botão', () => {
      expect(numeroWhatsapp(null)).toBeNull();
      expect(numeroWhatsapp('ligue-nos')).toBeNull();
    });
  });
});
