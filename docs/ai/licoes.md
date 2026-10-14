# Lições e armadilhas

## Sobre verificar
- **Testes de domínio pegam bugs que o olho não vê.** O teste de "andar para +Z" revelou que a
  convenção de yaw estava invertida; o teste de winding revelou faces de costas no VoxelBuilder.
  Escreva o teste antes de olhar a cena.
- **Headless com Playwright funciona para este jogo**: `--use-gl=swiftshader`, expor um gancho
  `window.__game` em modo DEV (`world`, `player`, `cam`, `openMenu`, `setPaused`, `save`,
  `audioLevel`) e teleportar entidades pelo domínio para montar a cena. Pointer lock não existe
  no headless: esconda o overlay e chame `openMenu()` + `Escape` para marcar o jogo como iniciado.
- O renderizador por software roda a 4–7 fps; **nunca use tempo real para sincronizar** um teste
  (use `waitForFunction` sobre o estado do domínio) e **não julgue desempenho por ele**. Bloom
  também quase não aparece no software; na GPU real fica diferente.
- Para capturar um instante de animação, pause (`setPaused(true)`) no momento certo e tire a foto.
- `pkill` no fim de uma cadeia `&&` encerra a cadeia com código 144; rode-o separado ou com `; true`.

## Sobre o navegador
- `beforeunload` dispara o autosave: qualquer fluxo que apaga o save e recarrega precisa suprimir o
  autosave antes (`suppressAutosave`), senão o save volta.
- Escolha de classe antes de o mundo existir: guardar em `sessionStorage` e recarregar é mais simples
  do que tornar a criação do mundo assíncrona em `main.ts`.
- ESC que solta o pointer lock é consumido pelo navegador; o segundo ESC chega à página.
  O Chrome recusa recapturar o mouse por ~1 s após um ESC: `requestPointerLock` pode rejeitar.
- Painéis modais devem soltar o pointer lock de propósito e dizer ao coordenador que não é pausa
  do menu (`inventoryUI.isOpen` / `dialogue.isOpen` antes de abrir o menu).
- Áudio só inicia após gesto do usuário; `unlock()` no primeiro clique.

## Sobre o domínio
- Qualquer coisa que muda a sensação de "quem pode ferir quem" passa por `isHostile`.
- Ao adicionar campo em `Item`, atualize a espada inicial em `factories.ts` e o save.
- `addItem` deve manter a identidade do objeto (testes e drops dependem disso); só a quantidade
  muda ao empilhar.
- Eventos emitidos enquanto o mundo está pausado (diálogo, mochila) só são processados no próximo
  `stepWorld`; para feedback imediato, drene e trate na hora (`dialogue.onAction`).
- Coleta automática roda no mesmo tick da morte: testes de loot devem olhar eventos `drop` ou a
  união drops + mochila.
- Itens largados precisam de `requireLeave`, senão voltam para a mochila no mesmo tick.

## Sobre o visual voxel
- Greedy meshing troca variação por voxel por variação por retângulo; o jitter de tom é por face
  fundida. Ficou bom para árvores; para texturas finas, reduza o jitter.
- Telegraph e outros adereços por entidade devem ser escondidos **também** no ramo de morte da view.
- O bloom pega tudo acima de 1,0 de luminância: cores HDR em materiais (multiplyScalar > 1) ou
  emissivo alto. Mantenha o resto da cena abaixo (neve e céu estão próximos do limite).
