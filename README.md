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
| Clique esquerdo / Espaço | atacar |
| Scroll | zoom |
| Shift | correr |
| ESC | menu de pausa |

Gosmas vivem perto do santuário central, goblins mais longe e orcs na borda do mapa.
Derrote inimigos para ganhar XP e ouro. Subir de nível cura por completo e aumenta vida e dano.
Se cair, você renasce no santuário depois de alguns segundos. Inimigos renascem em casa.

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
    systems/       movimento, IA (máquina de estados), combate, renascimento
    simulation.ts  stepWorld(world, dt): roda os sistemas e devolve eventos
    progression.ts XP e nível
    terrain.ts     função de altura do terreno (compartilhada com a malha visual)
    worldgen.ts    geração determinística do mundo por anéis de dificuldade
  game/            apresentação em Three.js e HUD em HTML
    camera.ts      câmera orbital em terceira pessoa
    input.ts       teclado, mouse e pointer lock
    voxel.ts       VoxelBuilder: pinta cubos numa grade e gera a malha (greedy meshing)
    models.ts      herói e inimigos desenhados em voxels
    entityViews.ts liga entidades a modelos, animação procedural e barras de vida
    effects.ts     números de dano flutuantes
    hud.ts         painéis de status, alvo e log de combate
    terrainMesh.ts terreno em blocos (colunas por célula, degraus de 0,5 m)
    environment.ts árvores, pedras e santuário em voxels (instanciados)
  main.ts          bootstrap e loop com passo fixo de simulação
```

A simulação roda em passo fixo (60 Hz) e emite eventos (`damage`, `death`, `levelUp`…)
que a camada visual consome para animações, textos flutuantes e log. Como o domínio não
conhece renderização, ele pode futuramente rodar num servidor para multiplayer sem mudar as regras.
