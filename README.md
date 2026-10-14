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
| K | árvore de habilidades (um ponto por nível) |
| F | falar com o NPC mais próximo, entrar e sair da cripta, abrir o baú |
| ESC | menu de pausa |

Gosmas vivem perto do santuário central, goblins mais longe e orcs na borda do mapa.
Escolha uma classe ao começar: **Guerreiro** (espada, corpo a corpo, vida alta), **Arqueiro**
(flechas de longe com ajuda de mira, Tiro Perfurante, Chuva de Flechas, Recuo Ágil, Foco) ou **Mago**
(raios arcanos, Bola de Fogo que explode, Nova Gélida, Teleporte, Escudo Arcano). Cada classe tem
sua barra de quatro habilidades e sua arma inicial; arcos e cajados também caem como loot.

Derrote inimigos para ganhar XP, ouro e loot: equipamentos de três slots (arma, armadura,
acessório) em quatro raridades (comum, incomum, raro, épico) e poções pequenas e grandes,
que se empilham na mochila. Itens caem no chão e são coletados ao passar por cima.
Equipamentos incomuns ou melhores trazem **afixos** que dão sobrenome ao item ("Espada Longa
Encantada da Serpente"): **da Serpente** regenera vida mesmo em combate, **da Águia** dá chance de
crítico (75% a mais), **do Vampiro** devolve parte do dano como vida, **do Sábio** reduz a recarga das
habilidades, **da Fortuna** aumenta o ouro dos inimigos, e **da Fúria**, **do Urso** e **do Vento** somam
dano, vida e velocidade. Raros têm um ou dois afixos; épicos, dois.
No santuário, a **Mercadora Zuri** (F → Negociar) compra seu loot por 35% do valor, vende poções a
qualquer hora e quatro equipamentos com afixos que mudam a cada dia do relógio do jogo, e guarda os
últimos itens vendidos para recompra pelo mesmo preço.
Inimigos avisam o golpe com uma área vermelha que se preenche: saia dela ou role (Espaço) para evitar.
No santuário vivem três NPCs: a **Anciã Mira** dá a cadeia principal (gosmas, goblins e o Rei Goblin),
o **Ferreiro Brom** pede ferro dos orcs e forja uma arma rara, e o **Guarda Tiago** ensina a lutar.
Um "!" sobre o NPC indica quest disponível e "?" quest pronta para entregar.
O mapa tem três biomas: as **Campinas do Vale** no centro, o **Pântano Sombrio** a oeste (água que
atrasa o passo, aranhas rápidas e zumbis do lodo) e o **Deserto Escaldante** a leste (escorpiões de
ferrão quase sem aviso e salteadores). No pântano reina a **Rainha Aranha**, cuja Teia Venenosa cai
onde você estava quando ela começou a tecer. No extremo leste, num tablado cercado de obeliscos, reina o **Imperador Escorpião**: dispara uma
**Rajada de Espinhos** em leque (aviso em cone), lança **Cuspe Ácido** que cai nos pontos avisados e
deixa **poças** queimando no chão por 8 s, e se cobre com a **Carapaça de Areia**, que ignora ataques
básicos: só habilidades (1-4) arrancam as três camadas. Partida, ele fica atordoado e leva 50% a mais
de dano; a carapaça volta a cada fase, e na fúria ele chama salteadores arqueiros. **Arqueiros** também
andam pelo mapa (goblins na mata, salteadores no deserto): mantêm distância, recuam se você chega
perto e avisam o tiro com uma linha no chão; saia dela de lado.
No platô ao norte, cercado de totens, vive o **Rei Goblin**: um chefe com Golpe Pesado, Pisão em área e
Investida Real em linha, três fases que aceleram os avisos, lacaios na fúria final e loot épico garantido. Subir de nível cura por completo e aumenta vida e dano.
A nordeste do santuário, um arco de pedra com véu roxo leva à **Cripta Esquecida**, uma dungeon no
estilo Minecraft Dungeons: a cada entrada a planta é outra (sala inicial, cinco salas de combate
ligadas por corredores e a sala do chefe), os inimigos (esqueletos, esqueletos arqueiros, aranhas e
zumbis) escalam com o seu nível, e as paredes bloqueiam passos, flechas e a visão dos inimigos. No
fundo espera o **Lorde Esqueleto** (Golpe Sepulcral, Rajada de Ossos em leque, Pisão, Investida
Fantasma e esqueletos na fúria). Vencido, ele solta loot épico e abre um **baú** com ouro, dois itens
raros ou épicos e poções, além de um portal verde de volta ao vale. Você tem **três vidas** lá dentro:
caindo, volta à sala inicial; sem vidas, a cripta te expulsa e se fecha. A câmera fica mais de cima e
as paredes entre ela e o herói se recortam sozinhas para não tapar a luta.
Cada nível dá **1 ponto de habilidade** (K): cada uma das quatro habilidades da classe tem 5 ranks.
Os ranks 1, 2 e 4 melhoram números (dano, raio, recarga, duração); os ranks 3 e 5 são **talentos** que
mudam o jeito de jogar: a Investida atordoa, o Golpe Giratório cura e deixa os inimigos vulneráveis, o
Grito deixa todos lentos, o Segundo Fôlego dispara sozinho quando a vida fica crítica, o Tiro Perfurante
vira uma rajada de três flechas que atordoam, a Chuva de Flechas vira tempestade, a Bola de Fogo dobra e
deixa o chão em chamas, a Nova Gélida congela, o Teleporte explode na partida e o Escudo Arcano explode
ao acabar. Chefes resistem a atordoamento e lentidão (metade do tempo). Reiniciar a árvore custa ouro.
Se cair, você renasce no santuário depois de alguns segundos. Inimigos renascem em casa.

O jogo tem **5 slots de save** no navegador, cada um com um herói (classe e nome escolhidos na criação).
O slot em uso é salvo automaticamente (a cada 45 s, ao concluir quests, subir de nível e ao sair da aba),
e ao abrir o jogo de novo ele oferece continuar o último slot. A tela de saves (no início, ou em
ESC → Saves) mostra herói, classe, nível, ouro, quests e tempo de jogo de cada slot, e permite jogar,
criar um herói novo, apagar, exportar o slot como `.json` e importar um arquivo num slot vazio.
Saves antigos, de antes dos slots, migram sozinhos para o slot 1.

O mundo tem um **ciclo de dia e noite** de 12 minutos (o relógio fica no painel do herói e vem junto
no save): amanhecer e pôr do sol alaranjados, noite azulada com lua, estrelas e vaga-lumes, e braseiros
que acendem no santuário. As campinas têm grama e canteiros de flores que balançam ao vento e se abrem
quando o herói passa; o pântano tem juncos e o deserto, capim seco. Golpes soltam lascas em voxel na
cor da criatura, faíscas e um clarão branco no alvo; inimigos se desfazem em blocos ao morrer. A câmera
treme com golpes sofridos, pancadas de chefe e explosões (ajuste ou desligue em ESC → Tremor de câmera),
e golpes corpo a corpo têm um "hit-stop" curtinho para pesar na mão.

Todo o áudio é sintetizado em tempo real com Web Audio, sem arquivos: efeitos de golpe, dano, passos,
esquiva, coleta (acorde por raridade), poção, nível, quests e habilidades, mais uma trilha ambiente
generativa que vira um tema pulsante quando um chefe entra em combate. Volumes no menu (ESC).

Os personagens são voxels de 16 por metro com rosto, roupa com costuras, armas detalhadas, oclusão
ambiente nos cantos e grão leve; pernas e braços são articulados e andam de verdade.

O cenário é esculpido em voxels de 12 por metro: carvalhos (inclusive de outono) com galhos que se
abrem e copas em tufos, bétulas de casca branca, pinheiros em camadas nas encostas e nevados no alto da
muralha, arbustos com frutinhas, pedras com rachaduras, líquen e musgo no topo, lajes, arenitos em
camadas no deserto, árvores mortas com barba-de-velho no pântano, cogumelos gigantes, cactos com gomos
e espinhos, ossadas, pilares com caneluras no santuário, totens com crânio na arena do Rei Goblin,
casulos de seda na da Rainha e obeliscos com hieróglifos na do Imperador. Cada peça tem três níveis de
detalhe (perto, meio e longe) que trocam sozinhos com a distância.

**Modelos do MagicaVoxel.** Qualquer peça do cenário pode ser trocada por um desenho seu: no lab,
escolha o modelo e clique em **Exportar .vox**, edite no [MagicaVoxel](https://ephtracy.github.io/)
e salve em `assets/vox/<id>.vox` (o id aparece na descrição do modelo, por exemplo `carvalho-1.vox`).
O jogo usa o arquivo no lugar da escultura, na mesma escala (1 voxel = 1/12 m), com os mesmos níveis de
detalhe. A vista Front do editor é a frente do modelo no jogo, e o eixo Z do editor aponta para cima.
Para só olhar um arquivo, arraste-o para a cena do lab.

## Lab de modelos

`http://localhost:5173/lab.html` abre a vitrine: todos os heróis (3 classes × 4 conjuntos de
equipamento), mobs, chefes, NPCs, itens por raridade, habilidades, projéteis e adereços de cenário,
num pedestal com câmera orbital. Dá para trocar a luz (campina, pântano, deserto, noite, estúdio),
disparar as animações do jogo (andar, atacar, aviso de golpe, rolamento, investida, Golpe Giratório,
escudo, morte) e comparar lado a lado com a versão anterior dos modelos (personagens e cenário). Os
adereços de cenário mostram cada nível de detalhe (perto, meio, longe) e podem ser exportados como
`.vox`; um `.vox` arrastado para a cena aparece na vitrine. É onde o visual é trabalhado antes de ir
para o jogo.

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
    dungeonLayout.ts planta da cripta gerada por seed (salas, corredores, pilares)
    dungeon.ts     cripta instanciada: entrar, salas, chefe, baú, vidas, paredes e linha de visão
    skillTree.ts   árvore: 5 ranks por habilidade, talentos, pontos por nível e reinício por ouro
    status.ts      efeitos de status (atordoado, lento, vulnerável) usados pelos talentos
    affixes.ts     afixos sorteados nos equipamentos (Serpente, Águia, Vampiro, Sábio...)
    shop.ts        loja: preços, estoque do dia, compra, venda e recompra
    hazards.ts     poças no chão (receita e estado); o sistema em systems/hazards.ts pulsa o dano
    dayCycle.ts    relógio do mundo: hora, dia, altura do sol, luz do dia e crepúsculo
    save.ts        snapshot serializável do progresso e reconstrução do mundo a partir dele
    saveSlots.ts   slots de save sobre uma porta chave-valor (localStorage no jogo, Map nos testes)
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
    storage.ts     localStorage como porta dos slots, pedido de novo jogo, exportar e importar arquivo
    dungeonView.ts cripta desenhada da planta: piso, tijolos, pilares, tochas com luz, baú, recorte de paredes
    portal.ts      portal de pedra com véu girando (entrada no mapa e saídas da cripta)
    skillTreeUI.ts painel da árvore de habilidades (K) e aviso de pontos sobre a barra
    shopUI.ts      painel da Mercadora (à venda, recompra, mochila que vende no clique)
    itemTooltip.ts tooltip de item compartilhado (afixos e comparação com o equipado)
    slotsUI.ts     tela de saves (lista, criar herói, apagar, exportar, importar)
    audio.ts       sintetizador de efeitos e música generativa (Web Audio)
    itemIcons.ts   ícones de itens em pixel art (usados na UI e nos drops 3D)
    dropViews.ts   itens caídos no chão: ícone extrudado em voxel, anel e feixe por raridade
    projectileViews.ts flechas, raios e bolas de fogo em voo, explosões
    terrainMesh.ts terreno em blocos (colunas por célula, degraus de 0,5 m)
    environment.ts árvores, pedras, santuário e braseiros em voxels (instanciados)
    foliage.ts     grama, flores e juncos em blocos instanciados, com vento e pisada no shader
    sky.ts         céu, sol, lua, estrelas, neblina e vaga-lumes seguindo o relógio do domínio
    hazardViews.ts poças de ácido em voxel e avisos extras de queda no chão
    particles.ts   partículas em voxel (acerto, morte, poeira, brilho) num pool instanciado
    shake.ts       tremor de câmera por trauma
  main.ts          bootstrap e loop com passo fixo de simulação
```

A simulação roda em passo fixo (60 Hz) e emite eventos (`damage`, `death`, `levelUp`…)
que a camada visual consome para animações, textos flutuantes e log. Como o domínio não
conhece renderização, ele pode futuramente rodar num servidor para multiplayer sem mudar as regras.
