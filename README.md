# Vale das Gosmas

RPG 3D single-player em estilo voxel, rodando no navegador. TypeScript + Three.js + Vite.

## Jogar

```bash
npm install
npm run dev
```

Abra `http://localhost:5173` e clique na tela para começar.

| Controle | Ação |
| --- | --- |
| WASD / setas | mover (S anda de ré, A/D de lado, o corpo segue a câmera) |
| Mouse | girar a câmera |
| Clique esquerdo / E | atacar |
| Espaço | esquiva com rolamento (invulnerável durante o rolamento) |
| 1 a 4 | habilidades: Golpe Giratório, Investida, Grito de Guerra, Segundo Fôlego |
| Scroll | zoom |
| Shift | correr |
| Q | beber poção (escolhe a menor que cobre o que falta) |
| I | abrir a mochila (clique equipa ou usa, botão direito larga no chão) |
| F | falar com o NPC mais próximo |
| ESC | menu de pausa |

Gosmas vivem perto do santuário central, goblins mais longe e orcs na borda do mapa.
Derrote inimigos para ganhar XP, ouro e loot: equipamentos de três slots (arma, armadura,
acessório) em quatro raridades (comum, incomum, raro, épico) e poções pequenas e grandes,
que se empilham na mochila. Itens caem no chão e são coletados ao passar por cima.
Inimigos avisam o golpe com uma área vermelha que se preenche: saia dela ou role (Espaço) para evitar.
No santuário vivem três NPCs: a **Anciã Mira** dá a cadeia principal (gosmas, goblins e o Rei Goblin),
o **Ferreiro Brom** pede ferro dos orcs e forja uma arma rara, e o **Guarda Tiago** ensina a lutar.
Um "!" sobre o NPC indica quest disponível e "?" quest pronta para entregar.
No platô ao norte, cercado de totens, vive o **Rei Goblin**: um chefe com Golpe Pesado, Pisão em área e
Investida Real em linha, três fases que aceleram os avisos, lacaios na fúria final e loot épico garantido. Subir de nível cura por completo e aumenta vida e dano.
Se cair, você renasce no santuário depois de alguns segundos. Inimigos renascem em casa.

O progresso é salvo automaticamente no navegador (a cada 45 s, ao concluir quests, subir de nível e ao
sair da aba). Ao abrir o jogo de novo, ele continua de onde parou. No menu (ESC) dá para salvar na hora,
exportar o save como arquivo `.json`, importar um arquivo e começar um novo jogo.

Todo o áudio é sintetizado em tempo real com Web Audio, sem arquivos: efeitos de golpe, dano, passos,
esquiva, coleta (acorde por raridade), poção, nível, quests e habilidades, mais uma trilha ambiente
generativa que vira um tema pulsante quando um chefe entra em combate. Volumes no menu (ESC).

Veja o [ROADMAP](ROADMAP.md) para a visão e os próximos marcos.

## Comandos

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # build de produção em dist/
npm run preview    # serve o build
npm test           # testes do domínio (Vitest)
npm run typecheck  # tsc --noEmit
```

## Arquitetura

O código separa **o que o jogo é** de **como ele aparece**:

```
src/
  domain/          regras puras, sem Three.js nem DOM (testável com Vitest)
    components.ts  Entity e seus componentes (Transform, Health, Combat, Progression, EnemyAI…)
    world.ts       agregado raiz: entidades, tempo e fila de eventos
    factories.ts   criação de jogador e inimigos (templates por tipo)
    systems/       movimento, IA (máquina de estados), habilidades/esquiva, combate, coleta, renascimento
    simulation.ts  stepWorld(world, dt): roda os sistemas e devolve eventos
    progression.ts XP e nível
    items.ts       definições de itens, raridades e geração por tier
    inventory.ts   mochila, equipamento e recálculo de atributos
    loot.ts        tabelas de drop por inimigo
    skills.ts      definições das habilidades, esquiva e buffs
    boss.ts        chefes: padrões de golpe (melee, área, investida), formas de telegraph e fases
    npc.ts         NPCs do santuário e suas falas
    quests.ts      definições de quests, diário do jogador, aceitar/avançar/entregar
    save.ts        snapshot serializável do progresso e reconstrução do mundo a partir dele
    terrain.ts     função de altura do terreno (compartilhada com a malha visual)
    worldgen.ts    geração determinística do mundo por anéis de dificuldade
  game/            apresentação em Three.js e HUD em HTML
    camera.ts      câmera orbital em terceira pessoa
    input.ts       teclado, mouse e pointer lock
    voxel.ts       VoxelBuilder: pinta cubos numa grade e gera a malha (greedy meshing)
    models.ts      herói (com o equipamento visível) e inimigos desenhados em voxels
    entityViews.ts liga entidades a modelos, animação procedural e barras de vida
    effects.ts     números de dano flutuantes
    hud.ts         painéis de status, alvo e log de combate
    inventoryUI.ts painel da mochila com tooltips e comparação de itens
    skillBar.ts    barra de habilidades com recarga
    dialogueUI.ts  painel de conversa com NPCs
    questTracker.ts lista de quests ativas
    storage.ts     localStorage, exportar e importar arquivo de save
    audio.ts       sintetizador de efeitos e música generativa (Web Audio)
    itemIcons.ts   ícones de itens em pixel art (usados na UI e nos drops 3D)
    dropViews.ts   itens caídos no chão: ícone extrudado em voxel, anel e feixe por raridade
    terrainMesh.ts terreno em blocos (colunas por célula, degraus de 0,5 m)
    environment.ts árvores, pedras e santuário em voxels (instanciados)
  main.ts          bootstrap e loop com passo fixo de simulação
```

A simulação roda em passo fixo (60 Hz) e emite eventos (`damage`, `death`, `levelUp`…)
que a camada visual consome para animações, textos flutuantes e log. Como o domínio não
conhece renderização, ele pode futuramente rodar num servidor para multiplayer sem mudar as regras.
