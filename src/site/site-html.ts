// Páginas HTML do site público do stand (secção nova, 2026-10-25; redesenho
// "editorial" 2026-11). Geradas no servidor (leves e legíveis por motores de
// busca) com template literals — TUDO o que vem da BD ou do visitante passa
// por `esc()` antes de entrar no HTML. Nenhuma página usa JavaScript.
//
// Estilo igual ao tema "Claro editorial" da app: marfim, tinta quase preta,
// títulos em Playfair Display, texto em Manrope (servidas pelo próprio site —
// /_fontes/, nunca da Google), fotos grandes, linhas finas em vez de caixas.

import { porExtenso } from '../documents/declaracoes';

export interface StandPublico {
  nome: string;
  slug: string;
  contacto: string | null;
  morada: string | null;
  redesSociais: string | null;
  logoUrl: string | null;
}

export interface VeiculoPublico {
  id: string;
  marca: string;
  modelo: string;
  versao: string | null;
  kms: number;
  ano: number | null;
  combustivel: string | null;
  potencia_kw: number | null;
  cilindrada: number | null;
  cor: string | null;
  num_lugares: number | null;
  categoria: string | null;
  preco: string | null;
  estado: string;
  foto_capa: string | null;
}

export interface CamposMarcacao {
  nome?: string;
  telefone?: string;
  email?: string;
  data?: string;
  hora?: string;
  mensagem?: string;
  vehicleId?: string;
}

export function esc(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const fmtNumero = (n: number) => n.toLocaleString('pt-PT');

function fmtPreco(preco: string | null): string {
  if (preco == null) return 'Preço sob consulta';
  const n = Number(preco);
  return Number.isFinite(n) ? `${fmtNumero(Math.round(n))} €` : 'Preço sob consulta';
}

function titulo(v: VeiculoPublico): string {
  return `${v.marca} ${v.modelo}`;
}

/** "GASOLEO", "diesel", "Gasolina" → "Gasóleo"/"Gasolina" (os dados vêm de várias fontes). */
function rotulo(valor: string | null): string | null {
  if (!valor) return null;
  return porExtenso(valor.trim().toLowerCase().replace(/\s+/g, '_'));
}

/** "CINZENTO E OUTRAS" → "Cinzento e outras"; texto normal fica como está. */
function suavizar(texto: string | null): string | null {
  if (!texto || texto.length < 4 || texto !== texto.toUpperCase() || !/[A-Z]/.test(texto)) return texto;
  const t = texto.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function resumo(v: VeiculoPublico): string {
  return [v.ano, `${fmtNumero(v.kms)} km`, rotulo(v.combustivel)].filter(Boolean).map(esc).join(' · ');
}

// Só números (e um "+" inicial) para links tel: — o resto do contacto pode
// ter texto livre.
function soDigitos(contacto: string | null): string | null {
  if (!contacto) return null;
  const d = contacto.replace(/[^\d+]/g, '');
  return d.replace(/\D/g, '').length >= 9 ? d : null;
}

/** Número para wa.me: só dígitos, com o 351 nos números portugueses de 9 dígitos. */
export function numeroWhatsapp(contacto: string | null): string | null {
  const d = soDigitos(contacto)?.replace(/\D/g, '') ?? null;
  if (!d) return null;
  return d.length === 9 && /^[29]/.test(d) ? `351${d}` : d;
}

function css(base: string): string {
  const f = (nome: string) => `${base}/_fontes/${nome}.woff2`;
  return `
@font-face{font-family:"Playfair Display";font-weight:500;font-display:swap;src:url(${f('PlayfairDisplay-Medium')}) format("woff2")}
@font-face{font-family:Manrope;font-weight:400;font-display:swap;src:url(${f('Manrope-Regular')}) format("woff2")}
@font-face{font-family:Manrope;font-weight:600;font-display:swap;src:url(${f('Manrope-SemiBold')}) format("woff2")}
@font-face{font-family:Manrope;font-weight:700;font-display:swap;src:url(${f('Manrope-Bold')}) format("woff2")}
:root{--bg:#f6f3ee;--tinta:#1c1b19;--suave:#6e6a63;--fraco:#a39e95;--linha:#e2ddd4;--verde:#2e5a47;--ouro:#9c7a3c;--serif:"Playfair Display",Georgia,serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;font-family:Manrope,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--tinta);background:var(--bg);line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:inherit}img{display:block;max-width:100%}
h1,h2,h3,.preco{font-variant-numeric:lining-nums;font-feature-settings:"lnum"}
.wrap{max-width:1200px;margin:0 auto;padding:0 24px}
.kicker{font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--suave)}
.serif{font-family:var(--serif);font-weight:500;font-feature-settings:"lnum"}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--tinta);color:#fff;text-decoration:none;padding:13px 22px;border-radius:3px;font-weight:700;font-size:.92rem;letter-spacing:.02em;border:1px solid var(--tinta);cursor:pointer;font-family:inherit}
.btn.claro{background:transparent;color:var(--tinta)}.btn.inv{background:#fff;color:var(--tinta);border-color:#fff}.btn.inv.claro{background:transparent;color:#fff;border-color:rgba(255,255,255,.6)}
.btn:hover{opacity:.88}
/* topo */
.topo{position:sticky;top:0;z-index:5;background:rgba(246,243,238,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--linha)}
.topo .wrap{display:flex;align-items:center;gap:16px;height:68px}
.marca{display:flex;align-items:center;gap:12px;text-decoration:none;min-width:0}
.marca img{height:38px;width:38px;object-fit:contain}
.marca span{font-family:var(--serif);font-size:1.35rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.topo nav{margin-left:auto;display:flex;align-items:center;gap:22px;font-size:.9rem;font-weight:600}
.topo nav a{text-decoration:none}.topo nav .tel{color:var(--suave)}
/* capa */
.capa{position:relative;min-height:min(78vh,720px);display:flex;align-items:flex-end;color:#fff;background:#1c1b19;overflow:hidden}
.capa img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.78}
.capa:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 30%,rgba(0,0,0,.72))}
.capa .wrap{position:relative;z-index:1;padding-bottom:64px;width:100%}
.capa .kicker{color:rgba(255,255,255,.75)}
.capa h1{font-family:var(--serif);font-weight:500;font-size:clamp(2.6rem,7vw,5.2rem);line-height:1.02;margin:.25em 0 .2em;max-width:16ch}
.capa p{font-size:1.1rem;color:rgba(255,255,255,.85);margin:0 0 28px;max-width:46ch}
.capa .acoes{display:flex;flex-wrap:wrap;gap:12px}
.capa.sem-foto{min-height:auto;background:var(--bg);color:var(--tinta);border-bottom:1px solid var(--linha)}
.capa.sem-foto:after{display:none}.capa.sem-foto .wrap{padding:88px 24px 64px}.capa.sem-foto .kicker{color:var(--suave)}.capa.sem-foto p{color:var(--suave)}
/* secções */
section{padding:72px 0}
.cab{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:36px;padding-bottom:20px;border-bottom:1px solid var(--linha)}
.cab h2{font-family:var(--serif);font-weight:500;font-size:clamp(1.9rem,3.6vw,2.8rem);margin:.2em 0 0;line-height:1.1}
.cab .total{color:var(--suave);font-size:.95rem}
.grelha{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:48px 32px}
.carro{text-decoration:none;display:block}
.carro .foto{aspect-ratio:3/2;background:#ebe7e0;overflow:hidden;border-radius:2px}
.carro .foto img{width:100%;height:100%;object-fit:cover;transition:transform .6s ease}
.carro:hover .foto img{transform:scale(1.035)}
.carro .linha1{display:flex;align-items:center;gap:8px;margin-top:16px}
.ponto{width:6px;height:6px;border-radius:50%;background:var(--verde);display:inline-block}.ponto.res{background:var(--ouro)}
.carro .nome{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin-top:6px}
.carro h3{font-family:var(--serif);font-weight:500;font-size:1.5rem;margin:0;line-height:1.2}
.carro .preco{font-weight:700;font-size:1.05rem;white-space:nowrap;font-variant-numeric:tabular-nums}
.carro .det{color:var(--suave);font-size:.9rem;margin-top:4px}
.vazio{padding:56px 0;text-align:center;color:var(--suave);border-top:1px solid var(--linha);border-bottom:1px solid var(--linha)}
/* contacto */
.contacto{background:var(--tinta);color:#f6f3ee}
.contacto .wrap{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:48px;align-items:end}
.contacto h2{font-family:var(--serif);font-weight:500;font-size:clamp(2rem,4vw,3.2rem);margin:.2em 0 0;line-height:1.08}
.contacto .kicker{color:rgba(246,243,238,.6)}
.contacto dl{margin:0;display:grid;gap:18px}.contacto dt{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(246,243,238,.55);font-weight:700}
.contacto dd{margin:4px 0 0;font-size:1.05rem}.contacto a{text-decoration:none}
.contacto .acoes{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
footer{padding:28px 0;color:var(--fraco);font-size:.82rem}footer .wrap{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
/* ficha */
.voltar{display:inline-block;margin:28px 0 22px;color:var(--suave);text-decoration:none;font-size:.9rem;font-weight:600}
.ficha{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);grid-template-areas:"g p" "s p";column-gap:56px;align-items:start;padding-bottom:72px}
.ficha>.g{grid-area:g}.ficha>.painel{grid-area:p}.ficha>.specs{grid-area:s}
.galeria{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.galeria a{display:block;aspect-ratio:3/2;overflow:hidden;background:#ebe7e0;border-radius:2px}
.galeria a:first-child{grid-column:1/-1}
.galeria img{width:100%;height:100%;object-fit:cover}
.painel{position:sticky;top:96px}
.painel h1{font-family:var(--serif);font-weight:500;font-size:clamp(2rem,3.4vw,2.9rem);line-height:1.08;margin:.3em 0 .15em}
.painel .versao{color:var(--suave);font-size:1.05rem}
.painel .preco{font-family:var(--serif);font-size:2.3rem;margin:26px 0 4px;font-feature-settings:"lnum"}
.factos{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--linha);border-bottom:1px solid var(--linha);margin:22px 0}
.factos div{padding:14px 10px 14px 0}.factos div+div{padding-left:14px;border-left:1px solid var(--linha)}
.factos b{display:block;font-size:1rem;font-variant-numeric:tabular-nums}.factos span{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--suave);font-weight:700}
.painel .acoes{display:grid;gap:10px}
.specs{margin-top:56px}.specs h2{font-family:var(--serif);font-weight:500;font-size:1.7rem;margin:0 0 12px}
.specs dl{display:grid;grid-template-columns:1fr 1fr;column-gap:40px;margin:0}
.specs dl div{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--linha)}
.specs dt{color:var(--suave)}.specs dd{margin:0;font-weight:600;text-align:right}
/* formulários */
.folha{max-width:640px;margin:0 auto;padding:16px 0 88px}
.folha h1{font-family:var(--serif);font-weight:500;font-size:clamp(2rem,4vw,2.8rem);margin:.3em 0 .2em;line-height:1.1}
.folha .intro{color:var(--suave);margin:0 0 28px}
form label{display:block;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--suave);margin:20px 0 7px}
input,textarea,select{width:100%;padding:13px 14px;border:1px solid var(--linha);border-radius:3px;font:inherit;background:#fff;color:var(--tinta)}
input:focus,textarea:focus,select:focus{outline:none;border-color:var(--tinta)}
.lado{display:grid;grid-template-columns:1fr 1fr;gap:16px}.ajuda{color:var(--fraco);font-size:.85rem;margin-top:6px}
.erros{border-left:2px solid #a4473a;background:#f4e3df;color:#7e3329;padding:12px 16px;margin-bottom:8px}
.consent{display:flex!important;gap:12px;align-items:flex-start;text-transform:none!important;letter-spacing:0!important;font-weight:400!important;font-size:.92rem!important;color:var(--tinta)!important;margin-top:24px!important}
.consent input{width:auto;margin-top:5px}
.armadilha{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
@media(max-width:860px){
 .topo nav .tel,.topo nav .lnk{display:none}
 .ficha{grid-template-columns:1fr;grid-template-areas:"g" "p" "s"}.painel{position:static;margin-top:28px}.specs{margin-top:44px!important}
 .contacto .wrap{grid-template-columns:1fr;gap:32px}
 .specs dl{grid-template-columns:1fr}.lado{grid-template-columns:1fr}
 .galeria{grid-template-columns:repeat(3,1fr)}
 section{padding:52px 0}.capa .wrap{padding-bottom:44px}
}
@media(max-width:520px){.wrap{padding:0 18px}.factos{grid-template-columns:1fr 1fr}.factos div:nth-child(3){padding-left:0;border-left:0}.factos div:nth-child(n+3){border-top:1px solid var(--linha)}}
`;
}

function topo(base: string, stand: StandPublico): string {
  const tel = soDigitos(stand.contacto);
  const inicio = `${esc(base)}/${esc(stand.slug)}`;
  return `<header class="topo"><div class="wrap">
<a class="marca" href="${inicio}">${stand.logoUrl ? `<img src="${esc(stand.logoUrl)}" alt="">` : ''}<span>${esc(stand.nome)}</span></a>
<nav><a class="lnk" href="${inicio}#stock">Viaturas</a>${tel ? `<a class="tel" href="tel:${esc(tel)}">${esc(stand.contacto)}</a>` : ''}
<a class="btn claro" href="${inicio}/marcar">Marcar visita</a></nav>
</div></header>`;
}

function rodape(stand: StandPublico): string {
  return `<footer><div class="wrap"><span>© ${new Date().getFullYear()} ${esc(stand.nome)}</span><span>Site criado com PS CarStand</span></div></footer>`;
}

function layout(opts: {
  base: string;
  stand: StandPublico;
  tituloPagina: string;
  descricao: string;
  imagem?: string | null;
  corpo: string;
}): string {
  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.tituloPagina)}</title>
<meta name="description" content="${esc(opts.descricao)}">
<meta property="og:title" content="${esc(opts.tituloPagina)}">
<meta property="og:description" content="${esc(opts.descricao)}">
${opts.imagem ? `<meta property="og:image" content="${esc(opts.imagem)}">` : ''}
<meta name="theme-color" content="#f6f3ee">
<style>${css(opts.base)}</style>
</head>
<body>
${topo(opts.base, opts.stand)}
<main>${opts.corpo}</main>
${rodape(opts.stand)}
</body>
</html>`;
}

/**
 * Marcar visita / WhatsApp / Ligar. `invertido`: sobre fundo escuro.
 * `marcarSecundario`: quando já há outro botão principal ao lado.
 */
function botoesContacto(
  base: string,
  stand: StandPublico,
  opts: { invertido?: boolean; marcarSecundario?: boolean; vehicleId?: string } = {},
): string {
  const { invertido = false, marcarSecundario = false, vehicleId } = opts;
  const tel = soDigitos(stand.contacto);
  const wa = numeroWhatsapp(stand.contacto);
  const sec = invertido ? 'btn inv claro' : 'btn claro';
  const cls = marcarSecundario ? sec : invertido ? 'btn inv' : 'btn';
  const marcar = `${esc(base)}/${esc(stand.slug)}/marcar${vehicleId ? `?v=${esc(vehicleId)}` : ''}`;
  return [
    `<a class="${cls}" href="${marcar}">Marcar visita</a>`,
    wa ? `<a class="${sec}" href="https://wa.me/${esc(wa)}" rel="noopener">WhatsApp</a>` : '',
    tel ? `<a class="${sec}" href="tel:${esc(tel)}">Ligar</a>` : '',
  ].join('');
}

export function paginaLista(base: string, stand: StandPublico, veiculos: VeiculoPublico[]): string {
  const destaque = veiculos.find((v) => v.foto_capa && v.estado === 'disponivel') ?? veiculos.find((v) => v.foto_capa);
  const disponiveis = veiculos.filter((v) => v.estado === 'disponivel').length;
  const capa = `<div class="capa${destaque ? '' : ' sem-foto'}">
${destaque ? `<img src="${esc(destaque.foto_capa)}" alt="${esc(titulo(destaque))}" fetchpriority="high">` : ''}
<div class="wrap">
<div class="kicker">Stand automóvel${stand.morada ? ` · ${esc(stand.morada)}` : ''}</div>
<h1>${esc(stand.nome)}</h1>
<p>${disponiveis ? `${disponiveis} ${disponiveis === 1 ? 'viatura disponível' : 'viaturas disponíveis'}, prontas a visitar.` : 'Novas viaturas em breve.'}</p>
<div class="acoes">${veiculos.length ? `<a class="${destaque ? 'btn inv' : 'btn'}" href="#stock">Ver viaturas</a>` : ''}${botoesContacto(base, stand, { invertido: !!destaque, marcarSecundario: veiculos.length > 0 })}</div>
</div></div>`;

  const cartoes = veiculos
    .map((v) => {
      const reservado = v.estado === 'reservado';
      return `<a class="carro" href="${esc(base)}/${esc(stand.slug)}/v/${esc(v.id)}">
<div class="foto">${v.foto_capa ? `<img src="${esc(v.foto_capa)}" alt="${esc(titulo(v))}" loading="lazy">` : ''}</div>
<div class="linha1"><span class="ponto${reservado ? ' res' : ''}"></span><span class="kicker">${reservado ? 'Reservado' : 'Disponível'}${v.ano ? ` · ${esc(v.ano)}` : ''}</span></div>
<div class="nome"><h3>${esc(titulo(v))}</h3><span class="preco">${esc(fmtPreco(v.preco))}</span></div>
<div class="det">${[v.versao, `${fmtNumero(v.kms)} km`, rotulo(v.combustivel)].filter(Boolean).map(esc).join(' · ')}</div>
</a>`;
    })
    .join('\n');

  const stock = `<section id="stock"><div class="wrap">
<div class="cab"><div><div class="kicker">Em stock</div><h2>Viaturas à venda</h2></div><span class="total">${veiculos.length} ${veiculos.length === 1 ? 'viatura' : 'viaturas'}</span></div>
${veiculos.length ? `<div class="grelha">${cartoes}</div>` : '<div class="vazio">De momento não há viaturas disponíveis. Volta em breve!</div>'}
</div></section>`;

  const tel = soDigitos(stand.contacto);
  const contacto = `<section class="contacto"><div class="wrap">
<div><div class="kicker">Visite-nos</div><h2>Venha ver de perto.</h2>
<div class="acoes">${botoesContacto(base, stand, { invertido: true })}</div></div>
<dl>
${stand.morada ? `<div><dt>Morada</dt><dd>${esc(stand.morada)}</dd></div>` : ''}
${stand.contacto ? `<div><dt>Contacto</dt><dd>${tel ? `<a href="tel:${esc(tel)}">${esc(stand.contacto)}</a>` : esc(stand.contacto)}</dd></div>` : ''}
${stand.redesSociais ? `<div><dt>Redes sociais</dt><dd>${esc(stand.redesSociais)}</dd></div>` : ''}
</dl>
</div></section>`;

  return layout({
    base,
    stand,
    tituloPagina: `${stand.nome} — Viaturas à venda`,
    descricao: `Viaturas à venda em ${stand.nome}${stand.morada ? ` — ${stand.morada}` : ''}.`,
    imagem: destaque?.foto_capa ?? stand.logoUrl,
    corpo: capa + stock + contacto,
  });
}

export function paginaFicha(base: string, stand: StandPublico, v: VeiculoPublico, fotos: string[]): string {
  const cv = v.potencia_kw ? `${Math.round(v.potencia_kw * 1.36)} cv` : null;
  const factos: [string, string | null][] = [
    ['Ano', v.ano ? String(v.ano) : null],
    ['Km', fmtNumero(v.kms)],
    ['Combustível', rotulo(v.combustivel)],
    ['Potência', cv],
  ];
  const linhas: [string, string | null][] = [
    ['Marca', v.marca],
    ['Modelo', v.modelo],
    ['Versão', v.versao],
    ['Ano', v.ano ? String(v.ano) : null],
    ['Quilómetros', `${fmtNumero(v.kms)} km`],
    ['Combustível', rotulo(v.combustivel)],
    ['Potência', cv],
    ['Cilindrada', v.cilindrada ? `${fmtNumero(v.cilindrada)} cm³` : null],
    ['Cor', suavizar(v.cor)],
    ['Lugares', v.num_lugares ? String(v.num_lugares) : null],
    ['Segmento', rotulo(v.categoria)],
  ];
  const galeria = fotos.length
    ? `<div class="galeria">${fotos
        .map(
          (f, i) =>
            `<a href="${esc(f)}" target="_blank" rel="noopener"><img src="${esc(f)}" alt="${esc(titulo(v))} — foto ${i + 1}" loading="${i ? 'lazy' : 'eager'}"></a>`,
        )
        .join('')}</div>`
    : '<div class="vazio">Fotografias em breve</div>';

  const corpo = `<div class="wrap">
<a class="voltar" href="${esc(base)}/${esc(stand.slug)}#stock">← Todas as viaturas</a>
<div class="ficha">
<div class="g">${galeria}</div>
<aside class="painel">
<div class="linha1" style="display:flex;align-items:center;gap:8px"><span class="ponto${v.estado === 'reservado' ? ' res' : ''}"></span><span class="kicker">${v.estado === 'reservado' ? 'Reservado' : 'Disponível'}</span></div>
<h1>${esc(titulo(v))}</h1>${v.versao ? `<div class="versao">${esc(v.versao)}</div>` : ''}
<div class="preco">${esc(fmtPreco(v.preco))}</div>
<div class="factos">${factos
    .filter(([, valor]) => valor)
    .map(([nome, valor]) => `<div><b>${esc(valor)}</b><span>${esc(nome)}</span></div>`)
    .join('')}</div>
<div class="acoes">${botoesContacto(base, stand, { vehicleId: v.id })}</div>
</aside>
<div class="specs"><h2>Ficha técnica</h2><dl>${linhas
    .filter(([, valor]) => valor)
    .map(([nome, valor]) => `<div><dt>${esc(nome)}</dt><dd>${esc(valor)}</dd></div>`)
    .join('')}</dl></div>
</div></div>`;

  return layout({
    base,
    stand,
    tituloPagina: `${titulo(v)}${v.ano ? ` ${v.ano}` : ''} — ${stand.nome}`,
    descricao: `${titulo(v)}${v.versao ? ` ${v.versao}` : ''}, ${resumo(v).replace(/&[^;]+;/g, '')}. ${fmtPreco(v.preco)}.`,
    imagem: fotos[0] ?? null,
    corpo,
  });
}

export function paginaMarcar(
  base: string,
  stand: StandPublico,
  veiculos: Pick<VeiculoPublico, 'id' | 'marca' | 'modelo'>[],
  valores: CamposMarcacao,
  erros: string[],
  limites: { dataMin: string; dataMax: string },
): string {
  const opcoes = veiculos
    .map(
      (v) =>
        `<option value="${esc(v.id)}"${v.id === valores.vehicleId ? ' selected' : ''}>${esc(`${v.marca} ${v.modelo}`)}</option>`,
    )
    .join('');
  const corpo = `<div class="wrap"><div class="folha">
<a class="voltar" href="${esc(base)}/${esc(stand.slug)}">← Todas as viaturas</a>
<div class="kicker">${esc(stand.nome)}</div>
<h1>Marcar visita</h1>
<p class="intro">Escolhe o dia e a hora que te dá jeito. O stand confirma contigo por telefone ou mensagem.</p>
${erros.length ? `<div class="erros">${erros.map((e) => `<div>${esc(e)}</div>`).join('')}</div>` : ''}
<form method="post" action="${esc(base)}/${esc(stand.slug)}/marcar">
<label for="nome">Nome *</label><input id="nome" name="nome" required maxlength="100" value="${esc(valores.nome)}" autocomplete="name">
<div class="lado">
<div><label for="telefone">Telefone</label><input id="telefone" name="telefone" type="tel" maxlength="30" value="${esc(valores.telefone)}" autocomplete="tel"></div>
<div><label for="email">Email</label><input id="email" name="email" type="email" maxlength="120" value="${esc(valores.email)}" autocomplete="email"></div>
</div>
<div class="ajuda">Indica pelo menos o telefone ou o email.</div>
<div class="lado">
<div><label for="data">Dia *</label><input id="data" name="data" type="date" required min="${esc(limites.dataMin)}" max="${esc(limites.dataMax)}" value="${esc(valores.data)}"></div>
<div><label for="hora">Hora *</label><input id="hora" name="hora" type="time" required min="09:00" max="20:00" step="900" value="${esc(valores.hora)}"></div>
</div>
<label for="vehicleId">Viatura de interesse</label>
<select id="vehicleId" name="vehicleId"><option value="">Nenhuma em particular</option>${opcoes}</select>
<label for="mensagem">Mensagem</label><textarea id="mensagem" name="mensagem" rows="4" maxlength="1000">${esc(valores.mensagem)}</textarea>
<div class="armadilha" aria-hidden="true"><label for="website">Não preencher</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
<label class="consent"><input type="checkbox" name="consentimento" value="sim" required>
<span>Autorizo ${esc(stand.nome)} a usar estes dados só para me contactar sobre esta visita.</span></label>
<div style="margin-top:28px"><button class="btn" type="submit">Pedir marcação</button></div>
</form></div></div>`;
  return layout({ base, stand, tituloPagina: `Marcar visita — ${stand.nome}`, descricao: `Marca uma visita a ${stand.nome}.`, corpo });
}

export function paginaObrigado(base: string, stand: StandPublico): string {
  const corpo = `<div class="wrap"><div class="folha" style="text-align:center;padding-top:96px">
<div class="kicker">Pedido enviado</div>
<h1>Obrigado.</h1>
<p class="intro">${esc(stand.nome)} vai confirmar a tua visita por telefone ou mensagem.</p>
<a class="btn" href="${esc(base)}/${esc(stand.slug)}#stock">Ver viaturas</a>
</div></div>`;
  return layout({ base, stand, tituloPagina: `Pedido enviado — ${stand.nome}`, descricao: `Pedido de visita a ${stand.nome}.`, corpo });
}

export function paginaNaoEncontrada(base = ''): string {
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Página não encontrada</title><style>${css(base)}</style></head>
<body><main><div class="wrap"><div class="folha" style="text-align:center;padding-top:120px">
<div class="kicker">Erro 404</div><h1>Página não encontrada.</h1>
<p class="intro">Esta página não existe ou já não está disponível.</p></div></div></main></body></html>`;
}
