// Gera o site estático em dist/.
// Uso: node build.mjs   (o Cloudflare Pages roda isso a cada deploy)
//
// Para editar:
//   - textos das páginas: objeto PAGES, mais abaixo
//   - palestras, publicações, entrevistas: data/links.json
//   - posts do blog: chegam sozinhos pelo RSS do Ciência et al.

import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";

const SITE = "https://www.marinno.com.br";
const FEED = "https://cienciaetal.bearblog.dev/feed/";
const EMAIL = "eu@marinno.com.br";
const DESC = "Marinno Arthur — direito, inovação e transferência de tecnologia, na interseção entre universidade, empresa e Estado.";

const esc = (s = "") => String(s).replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const decode = (s = "") => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&").trim();

// ---------- blog (RSS/Atom) ----------
async function loadPosts() {
  try {
    const res = await fetch(FEED, { headers: { "user-agent": "marinno.com.br build" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const xml = await res.text();
    const tag = (block, name) => (block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)) || [])[1];
    const blocks = [...xml.matchAll(/<(entry|item)\b[\s\S]*?<\/\1>/g)].map(m => m[0]);
    const posts = blocks.map(b => {
      const link = (b.match(/<link[^>]*href="([^"]+)"/) || [])[1] || decode(tag(b, "link") || "");
      const date = tag(b, "published") || tag(b, "updated") || tag(b, "pubDate") || "";
      const d = new Date(decode(date));
      return { d: isNaN(d) ? "" : d.toISOString().slice(0, 10), title: decode(tag(b, "title") || ""), u: link };
    }).filter(p => p.title && p.u);
    if (!posts.length) throw new Error("feed vazio");
    console.log(`RSS: ${posts.length} posts`);
    return posts;
  } catch (e) {
    console.warn(`RSS indisponível (${e.message}); usando data/posts-fallback.json`);
    return JSON.parse(await readFile("data/posts-fallback.json", "utf8"));
  }
}

// ---------- layout ----------
const NAV = [
  ["/", "intro"],
  ["/quem-e/", "quem é"],
  ["/o-que-faz/", "o que faz"],
  ["/o-que-anda-falando/", "o que anda falando"],
  ["/como-contactar/", "como contactar"],
];

const CSS = `
:root{--bg:#fff;--fg:#000;--muted:#555;--rule:#000;--soft:#e6e6e6}
@media (prefers-color-scheme:dark){:root{--bg:#000;--fg:#fff;--muted:#aaa;--rule:#fff;--soft:#222}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font-family:"Newsreader",Georgia,serif;font-size:20px;line-height:1.55;font-optical-sizing:auto}
.wrap{max-width:38rem;margin:0 auto;padding:3.5rem 1.5rem 4rem}
a{color:inherit;text-decoration:underline;text-underline-offset:.18em;text-decoration-thickness:1px}
a:hover{text-decoration-thickness:2px}
.mono{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.72rem;letter-spacing:.01em}
header{margin-bottom:3rem}
.name{font-size:1.9rem;font-weight:600;letter-spacing:-.01em;text-decoration:none;line-height:1}
nav{margin-top:1.1rem;display:flex;flex-wrap:wrap;gap:.35rem 1.1rem}
nav a{text-decoration:none;font-family:"IBM Plex Mono",monospace;font-size:.8rem}
nav a[aria-current="page"]{text-decoration:underline;text-decoration-thickness:2px}
h1{font-size:1.45rem;font-weight:600;margin:0 0 1.2rem;line-height:1.25}
h2{font-family:"IBM Plex Mono",monospace;font-size:.75rem;font-weight:500;margin:2.6rem 0 .9rem;padding-top:.6rem;border-top:1px solid var(--rule)}
p{margin:0 0 1.05rem}
.lede{font-size:1.3rem;line-height:1.4;margin-bottom:2rem}
ul.plain{list-style:none;padding:0;margin:0}
ul.plain li{padding:.5rem 0;border-bottom:1px solid var(--soft);display:grid;grid-template-columns:5.2rem 1fr;gap:.8rem;align-items:baseline}
ul.plain li[hidden]{display:none}
ul.plain li .mono{color:var(--muted)}
.tag{font-family:"IBM Plex Mono",monospace;font-size:.65rem;border:1px solid var(--fg);padding:0 .3rem;margin-left:.4rem;white-space:nowrap;vertical-align:.12em}
.filters{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 1.2rem}
.filters button{font-family:"IBM Plex Mono",monospace;font-size:.72rem;background:none;color:var(--fg);border:1px solid var(--fg);padding:.2rem .55rem;cursor:pointer}
.filters button[aria-pressed="true"]{background:var(--fg);color:var(--bg)}
.frente{margin-bottom:1.6rem}.frente h3{font-size:1.05rem;font-weight:600;margin:0 0 .25rem}
.frente .mono{color:var(--muted);display:block;margin-bottom:.35rem}
.contact{font-size:1.6rem;font-weight:600}
.photo{width:100%;height:auto;display:block;margin:0 0 1.8rem;filter:grayscale(1)}
footer{margin-top:4rem;padding-top:.8rem;border-top:1px solid var(--rule);display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem}
footer a{text-decoration:none}
@media (max-width:520px){body{font-size:18px}.wrap{padding-top:2.2rem}ul.plain li{grid-template-columns:1fr;gap:.1rem}}
`;

function layout({ path, title, body, script = "" }) {
  const full = title ? `${title} — Marinno Arthur` : "Marinno Arthur — direito, inovação e transferência de tecnologia";
  const nav = NAV.map(([h, l]) => `<a href="${h}"${h === path ? ' aria-current="page"' : ""}>${l}</a>`).join("\n    ");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(DESC)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(DESC)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="Ciência et al." href="${FEED}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS.trim()}</style>
${path === "/" ? `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "Person", name: "Marinno Arthur Berno", alternateName: "Marinno Arthur",
    url: SITE, email: "mailto:" + EMAIL, jobTitle: "Assessor Especial — Procuradoria Jurídica da UEL",
    address: { "@type": "PostalAddress", addressLocality: "Londrina", addressRegion: "PR", addressCountry: "BR" },
    alumniOf: "Universidade Estadual de Londrina",
    sameAs: ["https://www.linkedin.com/in/marinnoarthur/", "https://www.instagram.com/marinnoarthur/", "http://lattes.cnpq.br/4148888374845697", "https://cienciaetal.bearblog.dev/"],
  })}</script>` : ""}
</head>
<body>
<div class="wrap">
<header>
  <a class="name" href="/">marinno</a>
  <nav aria-label="principal">
    ${nav}
  </nav>
</header>
<main>
${body}
</main>
<footer class="mono">
  <span>© ${new Date().getFullYear()} Marinno Arthur · Londrina, PR</span>
  <span><a href="https://www.linkedin.com/in/marinnoarthur/">linkedin</a> · <a href="https://www.instagram.com/marinnoarthur/">instagram</a> · <a href="${FEED}">rss</a></span>
</footer>
</div>
${script}
</body>
</html>
`;
}

const fmt = d => (d && d.length > 4 ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : d || "");
const row = i => `<li data-t="${i.t}"><span class="mono">${fmt(i.d)}</span><span>${i.u ? `<a href="${esc(i.u)}">${esc(i.title)}</a>` : esc(i.title)}<span class="tag">${i.t}</span></span></li>`;

// ---------- páginas ----------
const PAGES = (feed) => ({
  "/": {
    title: "",
    body: `
<p class="lede">Advogado e gestor de inovação. Trabalho onde universidade, empresa e Estado se encontram: propriedade intelectual, transferência de tecnologia e políticas públicas de inovação.</p>
<h2>agora</h2>
<ul class="plain">
  <li><span class="mono">2026–</span><span>Assessor Especial na Procuradoria Jurídica da UEL</span></li>
  <li><span class="mono">2025–</span><span>Gestor de projetos de PD&amp;I no LABIM — Laboratório de Biotecnologia Microbiana, UEL</span></li>
  <li><span class="mono">—</span><span>Sócio da OnDemand, consultoria em inovação e transferência de tecnologia</span></li>
  <li><span class="mono">2026–</span><span>Mestrando em Administração no PPGA/UEL</span></li>
  <li><span class="mono">2026–</span><span>Professor convidado nas Faculdades Pequeno Príncipe</span></li>
</ul>
<h2>últimas</h2>
<ul class="plain">${feed.slice(0, 3).map(row).join("")}</ul>
<p style="margin-top:1rem"><a href="/o-que-anda-falando/">tudo o que anda falando →</a></p>`,
  },

  "/quem-e/": {
    title: "quem é",
    body: `
<h1>quem é</h1>
<!-- Para usar foto: coloque public/foto.jpg e descomente a linha abaixo -->
<!-- <img class="photo" src="/foto.jpg" alt="Marinno Arthur" width="1200" height="800"> -->
<p><strong>Marinno Arthur</strong> é formado em Direito pela <strong>Universidade Estadual de Londrina</strong> e especialista em Direito Constitucional Contemporâneo. Começou pela pesquisa em direitos humanos e pelo ensino jurídico, coordenou projeto de extensão com egressos do sistema prisional e escreveu sobre pedagogia histórico-crítica aplicada ao direito.</p>
<p>Chegou à inovação pela própria universidade. Em 2021 assumiu a coordenação do Escritório de Transferência de Tecnologia da <strong>AINTEC/UEL</strong> e, entre 2022 e 2025, foi Assessor Técnico da Agência, cuidando de licenciamento, parcerias universidade-empresa e captação de recursos para projetos de inovação.</p>
<p>Hoje é Assessor Especial na <strong>Procuradoria Jurídica da UEL</strong>, onde trabalha com direito público e inovação, gestor de projetos de PD&amp;I no <strong>LABIM</strong>, onde estrutura a transferência de bioinsumos para empresas parceiras, e sócio da <strong>OnDemand</strong>. Em 2024 recebeu três Leões de Bronze no <strong>Cannes Lions</strong>, em Design, Creative Data e Direct.</p>
<p>Na academia, faz mestrado no <strong>PPGA/UEL</strong> pesquisando arquiteturas de transferência de tecnologia em ICTs, cursa especializações em Gestão Pública (UEL) e em Gestão de Ambientes Promotores de Inovação (UNICENTRO), e escreve notas de aula, leituras e ensaios no <a href="https://cienciaetal.bearblog.dev/">Ciência et al.</a></p>
<h2>trajetória</h2>
<ul class="plain">
  <li><span class="mono">2026–</span><span>Assessor Especial, Procuradoria Jurídica — UEL</span></li>
  <li><span class="mono">2026–</span><span>Mestrado em Administração — PPGA/UEL</span></li>
  <li><span class="mono">2026–</span><span>Professor convidado — Faculdades Pequeno Príncipe</span></li>
  <li><span class="mono">2025–</span><span>Gestor de projetos de PD&amp;I — LABIM/UEL</span></li>
  <li><span class="mono">2025–</span><span>Especializações em Gestão Pública (UEL) e Ambientes Promotores de Inovação (UNICENTRO)</span></li>
  <li><span class="mono">2024</span><span>Três Leões de Bronze — Cannes Lions</span></li>
  <li><span class="mono">2022–25</span><span>Assessor Técnico — Agência de Inovação Tecnológica da UEL (AINTEC)</span></li>
  <li><span class="mono">2021–22</span><span>Coordenador do Escritório de Transferência de Tecnologia — AINTEC/UEL</span></li>
  <li><span class="mono">2015–16</span><span>Especialização em Direito Constitucional Contemporâneo — IDCC</span></li>
  <li><span class="mono">2011–16</span><span>Graduação em Direito — UEL</span></li>
</ul>
<p style="margin-top:1rem" class="mono"><a href="http://lattes.cnpq.br/4148888374845697">currículo lattes completo →</a></p>`,
  },

  "/o-que-faz/": {
    title: "o que faz",
    body: `
<h1>o que faz</h1>
<p>Quatro frentes que se alimentam: o direito público dentro da universidade, a gestão de projetos de pesquisa que viram produto, a consultoria para quem está construindo inovação, e a pesquisa e o ensino sobre tudo isso.</p>
<div class="frente"><h3>Direito público e inovação</h3><span class="mono">procuradoria jurídica · uel</span>
<p>Pareceres jurídicos, análise de risco regulatório e interpretação de instrumentos normativos em governança institucional, políticas públicas e inovação tecnológica.</p></div>
<div class="frente"><h3>Gestão de PD&amp;I e transferência de tecnologia</h3><span class="mono">labim · uel</span>
<p>Metodologias para estruturar a transferência de tecnologia entre o laboratório e empresas parceiras, com foco em bioinsumos: processos, regulamentos e fluxos que aumentam a chance de um projeto chegar ao mercado.</p></div>
<div class="frente"><h3>Consultoria</h3><span class="mono">ondemand</span>
<p>Para startups e empresas: contratos de transferência de tecnologia, licenciamento e confidencialidade. Para ICTs e ambientes de inovação: políticas de inovação, contratos de P&amp;D e capacitação em propriedade intelectual.</p></div>
<div class="frente"><h3>Pesquisa e ensino</h3><span class="mono">ppga/uel · faculdades pequeno príncipe</span>
<p>Pesquisa sobre arquiteturas de transferência de tecnologia em ICTs e interação universidade-empresa. Aulas e palestras sobre propriedade intelectual, captação de recursos e empreendedorismo.</p></div>`,
  },

  "/o-que-anda-falando/": {
    title: "o que anda falando",
    body: `
<h1>o que anda falando</h1>
<div class="filters" role="group" aria-label="filtrar por tipo">
  <button data-f="todos" aria-pressed="true">todos</button>
  <button data-f="texto" aria-pressed="false">textos</button>
  <button data-f="palestra" aria-pressed="false">palestras</button>
  <button data-f="publicação" aria-pressed="false">publicações</button>
  <button data-f="mídia" aria-pressed="false">mídia</button>
</div>
<ul class="plain" id="feed">${feed.map(row).join("")}</ul>`,
    script: `<script>
document.querySelectorAll(".filters button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".filters button").forEach(x=>x.setAttribute("aria-pressed",x===b));
  const f=b.dataset.f;
  document.querySelectorAll("#feed li").forEach(li=>li.hidden=!(f==="todos"||li.dataset.t===f));
}));
</script>`,
  },

  "/como-contactar/": {
    title: "como contactar",
    body: `
<h1>como contactar</h1>
<p>Para conversar sobre um projeto, uma palestra, uma parceria de pesquisa ou só trocar uma ideia:</p>
<p class="contact"><a href="mailto:${EMAIL}">${EMAIL}</a></p>
<h2>em outros lugares</h2>
<ul class="plain">
  <li><span class="mono">linkedin</span><span><a href="https://www.linkedin.com/in/marinnoarthur/">/in/marinnoarthur</a></span></li>
  <li><span class="mono">instagram</span><span><a href="https://www.instagram.com/marinnoarthur/">@marinnoarthur</a></span></li>
  <li><span class="mono">blog</span><span><a href="https://cienciaetal.bearblog.dev/">Ciência et al.</a></span></li>
  <li><span class="mono">lattes</span><span><a href="http://lattes.cnpq.br/4148888374845697">4148888374845697</a></span></li>
</ul>`,
  },
});

// ---------- build ----------
const posts = (await loadPosts()).map(p => ({ ...p, t: "texto" }));
const links = JSON.parse(await readFile("data/links.json", "utf8"));
// ordena por data, mais recente primeiro; ano isolado ("2025") conta como fim do ano
const key = i => (i.d.length === 4 ? i.d + "-12-31" : i.d);
const feed = [...posts, ...links].sort((a, b) => key(b).localeCompare(key(a)));

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });

const pages = PAGES(feed);
for (const [path, page] of Object.entries(pages)) {
  const dir = "dist" + path;
  await mkdir(dir, { recursive: true });
  await writeFile(dir + "index.html", layout({ path, ...page }));
}
await writeFile("dist/404.html", layout({ path: "/404", title: "não encontrado", body: `<h1>página não encontrada</h1><p><a href="/">voltar para o início →</a></p>` }));

const today = new Date().toISOString().slice(0, 10);
await writeFile("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Object.keys(pages).map(p => `  <url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`);
console.log(`ok: ${Object.keys(pages).length} páginas, ${feed.length} itens no fluxo`);
