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

## Sobre modelar voxels por código
- `box(x0..x1)` com os cantos invertidos (comum ao espelhar com `sx * n`) virava uma caixa vazia e
  sumia com metade das patas da aranha. Agora `box`/`carve` aceitam os cantos em qualquer ordem.
- Olhos "colados" numa esfera ficam flutuando. Pinte na superfície (`recolorFront`) em vez de
  posicionar caixas num z fixo.
- Arma pendurada do ombro para baixo entra no chão se for mais longa que a altura da mão. Limite o
  comprimento e dê uma inclinação de repouso ao braço (`weaponArmRest`).
- Chapéu e capuz são a identidade da classe: o elmo da armadura de placas só vale para o guerreiro.
- Grão por voxel quebra a fusão de faces (greedy): um orc passa de 1,5k para 13k triângulos. Use
  manchas (`grainScale: 2`) fora do herói.

## Sobre medir e fotografar no lab
- `renderer.info` com `EffectComposer` mostra só o último passe (1 triângulo). Desligue
  `info.autoReset`, zere por quadro e leia depois do `composer.render()`.
- No headless, o `requestAnimationFrame` continua rodando enquanto o script chama `__lab.step`, então
  animações cíclicas podem estar em outra fase na hora do screenshot. Para checar estado, leia a
  cena por `evaluate` em vez de confiar só na imagem.
- No headless, o clique que começa o jogo às vezes consegue o pointer lock de verdade; com o mouse
  preso, cliques em botões do menu vão para o canvas. Para abrir o menu num teste, chame
  `document.exitPointerLock()` (o mesmo caminho do ESC) em vez de só mostrar o painel.
- Campos de texto em painéis precisam parar a propagação do `keydown`, senão digitar "Iva" no nome
  do herói abre a mochila (I) e bebe poção (Q).

## Sobre efeitos e desempenho
- Voxel de 10 cm na grama vira "estaca" perto da câmera; 6 cm (1/16) e 5 lâminas por tufo leem como
  capim. Densidade importa mais que tamanho: manchas por ruído ficam mais naturais que tapete uniforme.
- Para medir triângulos com o `EffectComposer`, desligue `info.autoReset`, zere num RAF e leia no
  seguinte: soma o quadro inteiro (incluindo a passada de sombra).
- `InstancedMesh.computeBoundingSphere()` depois de posicionar as instâncias habilita o recorte de
  câmera por bloco; sem ele, o mesh inteiro é desenhado mesmo fora da tela.
- Uma luz direcional que vira sol e lua precisa trocar de lado com intensidade zero, senão as sombras
  "pulam" no horizonte.
- O headless com software renderiza o mapa inteiro a ~3 fps (850k triângulos). Com o passo limitado
  a 0,1 s por quadro, o mundo anda a ~1/3 do tempo real: dê timeouts generosos e uma janela menor
  (960×600) para testes de luta. Não é sinal de problema no jogo.
- Para depurar a ordem de golpes de um chefe, simule só o domínio num teste de rascunho e registre os
  `windup`: em segundos se vê a rotação inteira, sem navegador.
- Itens de vitrine (ex.: a poção desenhada na loja) consomem ids se criados a cada render; crie uma
  vez no construtor do painel.
- Heurística de gênero do nome do item precisa de número também: "Botas" pede "Reforçadas".

## Sobre a cripta
- Teleportar o herói 1 km faz a câmera suavizada "voar" pelo mapa: chame `cam.snap()` ao entrar, sair
  e renascer.
- No headless, depois de soltar o pointer lock o menu de pausa reabre sozinho e engole o F. Nos
  roteiros, feche o menu pelo gancho (`setPaused(false)` e esconder `#menu`) antes de testar
  interações.
- Luzes pontuais que entram e saem da cena recompilam shaders: mantenha um conjunto fixo (as 6 das
  tochas) e só mude intensidade e posição.

## Sobre o cenário em alta resolução
- A superfície irregular é o que custa: uma copa lisa e uma rugosa com o mesmo volume diferem pouco em
  voxels e muito em triângulos. A oclusão ambiente soma ~70% (quebra a fusão de faces). O grão quase
  não pesa. Meça com um teste rascunho antes de escolher a resolução.
- `InstancedMesh` é recortado pela câmera como um bloco só: com instâncias espalhadas pelo mapa, a
  esfera cobre tudo e todas são desenhadas, nas duas passadas. Recorte na CPU (`Frustum` por instância)
  para o nível longe, e esferas por nível para os outros.
- O `WebGLShadowMap` testa `object.layers` contra a câmera **principal**: não dá para esconder um
  projetor de sombra da tela com camadas. Use material com `colorWrite: false, depthWrite: false`.
- Gravar arquivo em `assets/vox/` com o dev server ligado recarrega a página (o glob é observado).
  Num teste headless, isso troca a cena no meio do script.
- `Map.forEach` apagando as próprias chaves pula itens: junte primeiro, apague depois (`trimBelow`).

