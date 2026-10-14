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
Escolha uma classe ao começar: **Guerreiro** (espada, corpo a corpo, vida alta), **Arqueiro**
(flechas de longe com ajuda de mira, Tiro Perfurante, Chuva de Flechas, Recuo Ágil, Foco) ou **Mago**
(raios arcanos, Bola de Fogo que explode, Nova Gélida, Teleporte, Escudo Arcano). Cada classe tem
sua barra de quatro habilidades e sua arma inicial; arcos e cajados também caem como loot.

Derrote inimigos para ganhar XP, ouro e loot: equipamentos de três slots (arma, armadura,
acessório) em quatro raridades (comum, incomum, raro, épico) e poções pequenas e grandes,
que se empilham na mochila. Itens caem no chão e são coletados ao passar por cima.
Inimigos avisam o golpe com uma área vermelha que se preenche: saia dela ou role (Espaço) para evitar.
No santuário vivem três NPCs: a **Anciã Mira** dá a cadeia principal (gosmas, goblins e o Rei Goblin),
o **Ferreiro Brom** pede ferro dos orcs e forja uma arma rara, e o **Guarda Tiago** ensina a lutar.
Um "!" sobre o NPC indica quest disponível e "?" quest pronta para entregar.
O mapa tem três biomas: as **Campinas do Vale** no centro, o **Pântano Sombrio** a oeste (água que
atrasa o passo, aranhas rápidas e zumbis do lodo) e o **Deserto Escaldante** a leste (escorpiões de
ferrão quase sem aviso e salteadores). No pântano reina a **Rainha Aranha**, cuja Teia Venenosa cai
onde você estava quando ela começou a tecer. No platô ao norte, cercado de totens, vive o **Rei Goblin**: um chefe com Golpe Pesado, Pisão em área e
Investida Real em linha, três fases que aceleram os avisos, lacaios na fúria final e loot épico garantido. Subir de nível cura por completo e aumenta vida e dano.
Se cair, você renasce no santuário depois de alguns segundos. Inimigos renascem em casa.

O progresso é salvo automaticamente no navegador (a cada 45 s, ao concluir quests, subir de nível e ao
sair da aba). Ao abrir o jogo de novo, ele continua de onde parou. No menu (ESC) dá para salvar na hora,
exportar o save como arquivo `.json`, importar um arquivo e começar um novo jogo.

Todo o áudio é sintetizado em tempo real com Web Audio, sem arquivos: efeitos de golpe, dano, passos,
esquiva, coleta (acorde por raridade), poção, nível, quests e habilidades, mais uma trilha ambiente
generativa que vira um tema pulsante quando um chefe entra em combate. Volumes no menu (ESC).

Os personagens são voxels de 16 por metro com rosto, roupa com costuras, armas detalhadas, oclusão
ambiente nos cantos e grão leve; pernas e braços são articulados e andam de verdade.

## Lab de modelos

`http://localhost:5173/lab.html` abre a vitrine: todos os heróis (3 classes × 4 conjuntos de
equipamento), mobs, chefes, NPCs, itens por raridade, habilidades, projéteis e adereços de cenário,
num pedestal com câmera orbital. Dá para trocar a luz (campina, pântano, deserto, noite, estúdio),
disparar as animações do jogo (andar, atacar, aviso de golpe, rolamento, investida, Golpe Giratório,
escudo, morte) e comparar lado a lado com a versão anterior dos modelos. É onde o visual é
trabalhado antes de ir para o jogo.

Veja o [ROADMAP](ROADMAP.md) para a visão e os próximos marcos.

## Para IAs e novos colaboradores

A pasta [`docs/ai`](docs/ai/README.md) guarda a memória do projeto: visão e referências, arquitetura
e invariantes, registro de decisões, histórico dos marcos com os pedidos do dono, lições aprendidas e
o fluxo de trabalho. O [`CLAUDE.md`](CLAUDE.md) na raiz aponta para ela. Leia antes de alterar o jogo.

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
    systems/       movimento, IA, habilidades/esquiva, combate, projéteis, coleta, renascimento
    simulation.ts  stepWorld(world, dt): roda os sistemas e devolve eventos
    progression.ts XP e nível
    items.ts       definições de itens, raridades e geração por tier
    inventory.ts   mochila, equipamento e recálculo de atributos
    loot.ts        tabelas de drop por inimigo
    skills.ts      definições das 12 habilidades, esquiva, buffs e escudo
    classes.ts     as três classes: atributos, estilo de ataque, arma inicial e barra
    projectiles.ts projéteis (flecha, raio, bola de fogo) com explosão e perfuração
    boss.ts        chefes: padrões de golpe (melee, área, investida), formas de telegraph e fases
    npc.ts         NPCs do santuário e suas falas
    quests.ts      definições de quests, diário do jogador, aceitar/avançar/entregar
    save.ts        snapshot serializável do progresso e reconstrução do mundo a partir dele
    terrain.ts     função de altura do terreno (compartilhada com a malha visual), água do pântano
    biomes.ts      biomas por região (campina, pântano, deserto) e pesos de transição
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
    projectileViews.ts flechas, raios e bolas de fogo em voo, explosões
    terrainMesh.ts terreno em blocos (colunas por célula, degraus de 0,5 m)
    environment.ts árvores, pedras e santuário em voxels (instanciados)
  main.ts          bootstrap e loop com passo fixo de simulação
```

A simulação roda em passo fixo (60 Hz) e emite eventos (`damage`, `death`, `levelUp`…)
que a camada visual consome para animações, textos flutuantes e log. Como o domínio não
conhece renderização, ele pode futuramente rodar num servidor para multiplayer sem mudar as regras.
