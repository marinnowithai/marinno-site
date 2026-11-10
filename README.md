# marinno.com.br

Site pessoal estático. Gerado por `build.mjs` (Node, sem dependências) e publicado no Cloudflare Pages.

## Como atualizar

- **Post novo:** escreva no Ciência et al. (Bear). O site lê o RSS e o post aparece no próximo build diário (6h). Para aparecer na hora: GitHub → Actions → "rebuild diário" → Run workflow.
- **Palestra, publicação, entrevista:** adicione uma linha em `data/links.json`, por exemplo:
  `{"d":"2026","t":"palestra","title":"Título da palestra","u":"https://link-opcional"}`
  Os tipos são `palestra`, `publicação` e `mídia`. O campo `d` aceita ano (`2026`) ou data completa (`2026-11-10`).
- **Textos das páginas:** objeto `PAGES` em `build.mjs`.
- **Foto:** coloque `public/foto.jpg` e descomente a linha `<img>` em "quem é".

## Configuração do Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Secret no GitHub (Settings → Secrets → Actions): `CF_DEPLOY_HOOK` = URL do deploy hook do Pages

## Testar localmente

    node build.mjs && npx serve dist
