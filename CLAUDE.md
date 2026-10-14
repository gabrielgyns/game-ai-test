# Vale das Gosmas — instruções para IAs

Antes de mexer no projeto, leia `docs/ai/README.md` e os arquivos que ele indexa: visão, arquitetura,
decisões, histórico, lições e fluxo de trabalho. O `ROADMAP.md` diz o que vem a seguir.

Resumo do essencial:
- `src/domain` é puro (sem Three.js/DOM) e testado com Vitest; `src/game` é apresentação.
- Verifique com `npm test`, `npm run typecheck`, `npm run build` e, para mudanças visuais, um
  Chromium headless com screenshots (ver `docs/ai/fluxo-de-trabalho.md`).
- Corrija bugs reportados pelo dono antes de começar o próximo marco.
- Ao fechar um marco: atualize `README.md`, `ROADMAP.md` e `docs/ai/historico.md`.
