# Fluxo de trabalho

## Comandos
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest (domínio)
npm run typecheck  # tsc --noEmit (estrito)
npm run build      # produção em dist/
```

## Ciclo de um marco
1. Entenda o pedido do dono. Se houver bugs reportados, corrija-os primeiro.
2. Modele no domínio (`src/domain`) com testes antes da apresentação.
3. Apresentação em `src/game` + ligação em `main.ts`.
4. Verifique: `npm test`, `npm run typecheck`, `npm run build` e um script Playwright headless que
   monte a cena pelo gancho `window.__game` e tire screenshots. Olhe as imagens.
5. Atualize `README.md`, `ROADMAP.md` e `docs/ai/historico.md`.
6. Commit com mensagem descritiva em português (título no imperativo, corpo explicando domínio e
   apresentação separadamente). Push na branch de trabalho e fast-forward na `main`
   (autorizado pelo dono para todos os marcos).
7. Entregue ao dono: o que mudou, como foi verificado, o que ficou de fora e sugestão do próximo marco.

## Convenções de código
- TypeScript estrito com `noUncheckedIndexedAccess`. Comentários e nomes de domínio em português;
  identificadores de código em inglês.
- Nada de Three.js ou DOM em `src/domain`.
- Novos eventos entram em `events.ts` e são tratados em `handleEvents` no `main.ts`.
- Novos inimigos: template em `factories.ts`, modelo em `models.ts` (+ `createModel`), loot em
  `loot.ts`, spawn em `worldgen.ts`. Chefes: `boss.ts` com padrões e fases.
- Novos itens: `items.ts` (templates por tier), ícone em `itemIcons.ts`, visual no herói em
  `models.ts` se for vestível.

## Trabalho visual
Mudanças de modelo passam primeiro pelo lab: `npm run dev` e abra `http://localhost:5173/lab.html`
(ou `?e=mob.orc&anim=walk&preset=night&compare=1&turn=0` para um estado específico). No headless,
`window.__lab.show(id)`, `setAnim`, `orbit(azimute, polar, escala)` e `step(dt, n)` deixam fotografar
cada modelo com um único navegador. Branch de design: `design/lab`, mesclada na `main` só com o ok
do dono.

## Ferramentas de verificação headless
Scripts de exemplo viveram no scratchpad da sessão (não versionados). Padrão:
```js
const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
// goto, esconder #overlay, window.__game.openMenu() + Escape, teleportar via __game.world/player, screenshot
```
