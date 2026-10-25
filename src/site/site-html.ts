// Páginas HTML do site público do stand (secção nova, 2026-10-25). Geradas
// no servidor (leves e legíveis por motores de busca) com template literals —
// TUDO o que vem da BD ou do visitante passa por `esc()` antes de entrar no
// HTML. Nenhuma página usa JavaScript.

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

// URL para dentro de `url(...)` num atributo style: o escape HTML não chega
// (o browser desfaz as entidades antes de ler o CSS), por isso só aceita
// http(s) e codifica os caracteres que permitiriam sair do url().
function cssUrl(url: string): string | null {
  if (!/^https?:\/\//i.test(url)) return null;
  return url.replace(/['"()\\\s<>]/g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'));
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

function resumo(v: VeiculoPublico): string {
  return [v.ano, `${fmtNumero(v.kms)} km`, v.combustivel].filter(Boolean).map(esc).join(' · ');
}

// Só números (e um "+" inicial) para links tel:/wa.me — o resto do contacto
// pode ter texto livre.
function soDigitos(contacto: string | null): string | null {
  if (!contacto) return null;
  const d = contacto.replace(/[^\d+]/g, '');
  return d.replace(/\D/g, '').length >= 9 ? d : null;
}

const CSS = `
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d2b2a;background:#f7f6f3;line-height:1.45}
a{color:inherit}.wrap{max-width:1100px;margin:0 auto;padding:0 18px}
header{background:#fff;border-bottom:1px solid #e6e3dd}header .wrap{display:flex;align-items:center;gap:14px;padding:14px 18px}
header img{height:52px;width:52px;object-fit:contain;border-radius:10px}header h1{font-size:1.35rem;margin:0}
.contactos{font-size:.92rem;color:#5b6664;display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:2px}
.btn{display:inline-block;background:#1f9e8a;color:#fff;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:600;border:0;font-size:1rem;cursor:pointer}
.btn.sec{background:#fff;color:#1f9e8a;border:1.5px solid #1f9e8a}.btn:hover{filter:brightness(.95)}
main{padding:22px 0 40px}h2{font-size:1.2rem;margin:0 0 14px}
.grelha{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.carro{background:#fff;border-radius:14px;overflow:hidden;text-decoration:none;border:1px solid #ebe8e2;display:flex;flex-direction:column}
.carro .foto{aspect-ratio:4/3;background:#e9e6e0 center/cover no-repeat;position:relative}
.etiqueta{position:absolute;top:10px;left:10px;background:#e07a2e;color:#fff;font-size:.8rem;font-weight:700;padding:4px 10px;border-radius:999px}
.carro .info{padding:12px 14px 14px;display:flex;flex-direction:column;gap:4px;flex:1}
.carro h3{margin:0;font-size:1.05rem}.carro .det{color:#5b6664;font-size:.9rem}.preco{font-weight:800;color:#1f9e8a;font-size:1.2rem;margin-top:auto}
.vazio{background:#fff;border-radius:14px;padding:28px;text-align:center;color:#5b6664}
.galeria{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:14px}
.galeria img{height:min(62vw,430px);max-width:92%;object-fit:cover;scroll-snap-align:start;border-radius:14px;background:#e9e6e0}
.ficha{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:22px;margin-top:18px}
.caixa{background:#fff;border-radius:14px;padding:18px;border:1px solid #ebe8e2}
table{width:100%;border-collapse:collapse}td{padding:7px 0;border-bottom:1px solid #f0ede8}td:first-child{color:#5b6664}
.acoes{display:flex;flex-direction:column;gap:10px;margin-top:14px}.acoes .btn{text-align:center}
form label{display:block;font-weight:600;margin:14px 0 5px}input,textarea,select{width:100%;padding:10px 12px;border:1.5px solid #d9d5ce;border-radius:10px;font:inherit;background:#fff}
.lado{display:grid;grid-template-columns:1fr 1fr;gap:12px}.erros{background:#fdeaea;color:#a12626;border-radius:10px;padding:10px 14px;margin-bottom:6px}
.consent{display:flex;gap:10px;align-items:flex-start;font-weight:400;font-size:.92rem}.consent input{width:auto;margin-top:4px}
.armadilha{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
footer{color:#8a928f;font-size:.85rem;text-align:center;padding:24px 0}
@media(max-width:760px){.ficha{grid-template-columns:1fr}.lado{grid-template-columns:1fr}}
`;

function layout(opts: { base: string; stand: StandPublico; tituloPagina: string; descricao: string; imagem?: string | null; corpo: string }): string {
  const { base, stand } = opts;
  const tel = soDigitos(stand.contacto);
  const contactos = [
    stand.contacto ? (tel ? `<a href="tel:${esc(tel)}">${esc(stand.contacto)}</a>` : esc(stand.contacto)) : '',
    stand.morada ? esc(stand.morada) : '',
    stand.redesSociais ? esc(stand.redesSociais) : '',
  ].filter(Boolean).map((c) => `<span>${c}</span>`).join('');
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
<style>${CSS}</style>
</head>
<body>
<header><div class="wrap">
${stand.logoUrl ? `<a href="${esc(base)}/${esc(stand.slug)}"><img src="${esc(stand.logoUrl)}" alt="${esc(stand.nome)}"></a>` : ''}
<div><h1><a href="${esc(base)}/${esc(stand.slug)}" style="text-decoration:none">${esc(stand.nome)}</a></h1>
<div class="contactos">${contactos}</div></div>
</div></header>
<main><div class="wrap">${opts.corpo}</div></main>
<footer>${esc(stand.nome)}</footer>
</body>
</html>`;
}

export function paginaLista(base: string, stand: StandPublico, veiculos: VeiculoPublico[]): string {
  const cartoes = veiculos
    .map((v) => {
      const capa = v.foto_capa ? cssUrl(v.foto_capa) : null;
      const foto = capa ? ` style="background-image:url(${esc(capa)})"` : '';
      const reservado = v.estado === 'reservado' ? '<span class="etiqueta">Reservado</span>' : '';
      return `<a class="carro" href="${esc(base)}/${esc(stand.slug)}/v/${esc(v.id)}">
<div class="foto"${foto}>${reservado}</div>
<div class="info"><h3>${esc(titulo(v))}</h3>${v.versao ? `<div class="det">${esc(v.versao)}</div>` : ''}
<div class="det">${resumo(v)}</div><div class="preco">${esc(fmtPreco(v.preco))}</div></div></a>`;
    })
    .join('\n');
  const corpo = `
<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
<h2 style="margin:0">Viaturas à venda (${veiculos.length})</h2>
<a class="btn" href="${esc(base)}/${esc(stand.slug)}/marcar">Marcar visita</a></div>
${veiculos.length ? `<div class="grelha">${cartoes}</div>` : '<div class="vazio">De momento não há viaturas disponíveis. Volta em breve!</div>'}`;
  return layout({
    base,
    stand,
    tituloPagina: `${stand.nome} — Viaturas à venda`,
    descricao: `Viaturas à venda em ${stand.nome}${stand.morada ? ` — ${stand.morada}` : ''}.`,
    imagem: stand.logoUrl ?? veiculos.find((v) => v.foto_capa)?.foto_capa,
    corpo,
  });
}

export function paginaFicha(base: string, stand: StandPublico, v: VeiculoPublico, fotos: string[]): string {
  const tel = soDigitos(stand.contacto);
  const linhas: [string, string | null][] = [
    ['Ano', v.ano ? String(v.ano) : null],
    ['Quilómetros', `${fmtNumero(v.kms)} km`],
    ['Combustível', v.combustivel],
    ['Potência', v.potencia_kw ? `${Math.round(v.potencia_kw * 1.36)} cv` : null],
    ['Cilindrada', v.cilindrada ? `${fmtNumero(v.cilindrada)} cm³` : null],
    ['Cor', v.cor],
    ['Lugares', v.num_lugares ? String(v.num_lugares) : null],
    ['Segmento', v.categoria],
  ];
  const tabela = linhas
    .filter(([, valor]) => valor)
    .map(([nome, valor]) => `<tr><td>${esc(nome)}</td><td>${esc(valor)}</td></tr>`)
    .join('');
  const galeria = fotos.length
    ? `<div class="galeria">${fotos.map((f, i) => `<img src="${esc(f)}" alt="${esc(titulo(v))} — foto ${i + 1}" loading="${i ? 'lazy' : 'eager'}">`).join('')}</div>`
    : '<div class="vazio">Sem fotografias</div>';
  const corpo = `
<a href="${esc(base)}/${esc(stand.slug)}" style="color:#5b6664">← Todas as viaturas</a>
<div class="ficha"><div>${galeria}</div>
<div class="caixa">
${v.estado === 'reservado' ? '<span class="etiqueta" style="position:static;display:inline-block;margin-bottom:8px">Reservado</span>' : ''}
<h2 style="margin-bottom:2px">${esc(titulo(v))}</h2>${v.versao ? `<div class="det" style="color:#5b6664">${esc(v.versao)}</div>` : ''}
<div class="preco" style="font-size:1.6rem;margin:10px 0">${esc(fmtPreco(v.preco))}</div>
<table>${tabela}</table>
<div class="acoes">
<a class="btn" href="${esc(base)}/${esc(stand.slug)}/marcar?v=${esc(v.id)}">Marcar visita para ver esta viatura</a>
${tel ? `<a class="btn sec" href="tel:${esc(tel)}">Ligar para o stand</a>` : ''}
</div></div></div>`;
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
    .map((v) => `<option value="${esc(v.id)}"${v.id === valores.vehicleId ? ' selected' : ''}>${esc(`${v.marca} ${v.modelo}`)}</option>`)
    .join('');
  const corpo = `
<a href="${esc(base)}/${esc(stand.slug)}" style="color:#5b6664">← Todas as viaturas</a>
<div class="caixa" style="max-width:620px;margin:14px auto 0">
<h2>Marcar visita a ${esc(stand.nome)}</h2>
<p style="color:#5b6664;margin-top:-6px">Escolhe o dia e a hora que te dá jeito. O stand confirma contigo por telefone ou mensagem.</p>
${erros.length ? `<div class="erros">${erros.map((e) => `<div>${esc(e)}</div>`).join('')}</div>` : ''}
<form method="post" action="${esc(base)}/${esc(stand.slug)}/marcar">
<label for="nome">Nome *</label><input id="nome" name="nome" required maxlength="100" value="${esc(valores.nome)}" autocomplete="name">
<div class="lado">
<div><label for="telefone">Telefone</label><input id="telefone" name="telefone" type="tel" maxlength="30" value="${esc(valores.telefone)}" autocomplete="tel"></div>
<div><label for="email">Email</label><input id="email" name="email" type="email" maxlength="120" value="${esc(valores.email)}" autocomplete="email"></div>
</div>
<div style="color:#5b6664;font-size:.85rem;margin-top:4px">Indica pelo menos o telefone ou o email.</div>
<div class="lado">
<div><label for="data">Dia *</label><input id="data" name="data" type="date" required min="${esc(limites.dataMin)}" max="${esc(limites.dataMax)}" value="${esc(valores.data)}"></div>
<div><label for="hora">Hora *</label><input id="hora" name="hora" type="time" required min="09:00" max="20:00" step="900" value="${esc(valores.hora)}"></div>
</div>
<label for="vehicleId">Viatura de interesse</label>
<select id="vehicleId" name="vehicleId"><option value="">Nenhuma em particular</option>${opcoes}</select>
<label for="mensagem">Mensagem</label><textarea id="mensagem" name="mensagem" rows="3" maxlength="1000">${esc(valores.mensagem)}</textarea>
<div class="armadilha" aria-hidden="true"><label for="website">Não preencher</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
<label class="consent"><input type="checkbox" name="consentimento" value="sim" required>
<span>Autorizo ${esc(stand.nome)} a usar estes dados só para me contactar sobre esta visita.</span></label>
<div style="margin-top:18px"><button class="btn" type="submit">Pedir marcação</button></div>
</form></div>`;
  return layout({ base, stand, tituloPagina: `Marcar visita — ${stand.nome}`, descricao: `Marca uma visita a ${stand.nome}.`, corpo });
}

export function paginaObrigado(base: string, stand: StandPublico): string {
  const corpo = `
<div class="caixa" style="max-width:620px;margin:20px auto;text-align:center">
<h2>Pedido enviado ✓</h2>
<p>Obrigado! ${esc(stand.nome)} vai confirmar a tua visita por telefone ou mensagem.</p>
<p><a class="btn" href="${esc(base)}/${esc(stand.slug)}">Ver viaturas</a></p>
</div>`;
  return layout({ base, stand, tituloPagina: `Pedido enviado — ${stand.nome}`, descricao: `Pedido de visita a ${stand.nome}.`, corpo });
}

export function paginaNaoEncontrada(): string {
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Página não encontrada</title><style>${CSS}</style></head>
<body><main><div class="wrap"><div class="vazio" style="margin-top:40px">Esta página não existe ou já não está disponível.</div></div></main></body></html>`;
}
