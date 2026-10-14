# Arquitetura

## Dois mundos: domínio e apresentação

```
src/domain/   regras puras, sem Three.js nem DOM. Testável com Vitest.
src/game/     Three.js, HTML/CSS, Web Audio, input. Só observa o domínio e consome eventos.
src/main.ts   bootstrap, loop com passo fixo de 60 Hz, ligação entre os dois.
```

A analogia: o domínio é o "servidor" rodando dentro do cliente. Se um dia houver multiplayer,
o servidor roda `stepWorld` e o cliente roda só `src/game`.

## Entidades e sistemas (ECS leve)

- `Entity` em `components.ts`: `kind` (player | enemy | npc) + componentes opcionais (`transform`,
  `movement`, `health`, `combat`, `progression`, `ai`, `boss`, `abilities`, `inventory`, `equipment`,
  `quests`, `npc`, `stats`).
- `World` é o agregado raiz: entidades, drops, tempo, `random` determinístico e fila de eventos.
- `stepWorld(world, dt)` roda os sistemas **nesta ordem**: respawn → ai → abilities → movement →
  combat → pickup, e devolve os eventos do tick. A ordem importa (um dash iniciado em abilities já
  move no mesmo tick; a coleta vê os drops da morte no mesmo tick).
- Eventos (`events.ts`) são o único canal domínio → apresentação. A apresentação **nunca** muda o
  domínio por fora, exceto escrevendo intenções (`movement.intent`, `combat.wantsAttack`,
  `abilities.queuedSkill`, `wantsRoll`, `aimDirection`, `faceYaw`) e chamando funções puras do
  domínio (equipar, usar, aceitar quest).

## Invariantes que não podem quebrar

- **Yaw**: convenção do Three.js. `rotation.y = yaw` faz o -Z local apontar para
  `(-sin yaw, -cos yaw)`. Modelos "encaram" o próprio -Z. `yawFromDirection` e `directionFromYaw`
  em `math.ts` são a única fonte dessa conversão.
- **Terreno**: `terrainHeight(x, z)` em `domain/terrain.ts` é quantizada em células de 1 m e degraus
  de 0,5 m. Domínio e malha usam a mesma função, então o herói pisa exatamente no bloco desenhado.
- **Hostilidade**: `isHostile(a, b)` decide quem fere quem. NPCs nunca são alvo. Não use
  `kind !== kind` para isso.
- **Atributos**: `health.max` e `combat.damage` são derivados. Altere `baseMax`/`baseDamage` e
  chame `recomputeStats`. Nível altera a base; equipamento soma por cima.
- **Golpes telegrafados**: tudo passa por `AttackPattern` (melee, slam, charge, aoe). Inimigos comuns
  usam um padrão melee implícito; chefes têm listas. O alcance é conferido **no fim** do aviso;
  o aoe fixa o ponto (posição do alvo) **no início**.
- **Biomas**: `biomeAt`/`biomeWeights` em `biomes.ts` dirigem relevo, água, cor do terreno, props e
  spawns. Transição suave por peso em X.
- **Classes**: `classes.ts` é a única fonte de atributos base, estilo de ataque e barra de
  habilidades. O ataque básico vira um `AttackPattern` melee ou `projectile` conforme a classe.
  Projéteis vivem em `world.projectiles` e são resolvidos por `projectileSystem` (após o combate).
- **Direção de mira do jogador** é `abilities.aimDirection` (câmera), escrita por `main.ts` a cada
  frame; ataques, projéteis e dashes do jogador usam ela, não o yaw suavizado do corpo.
- **Ids de item** são globais (`items.ts`); ao carregar um save, `resetItemIds(max + 1)`.
- **Save**: só o que muda é salvo; o mundo é regenerado pela seed. Mudar a geração do mundo não
  quebra saves antigos, mas mudar o formato de `SaveData` exige subir `SAVE_VERSION` e migrar.

## Apresentação: peças principais

- `voxel.ts`: `VoxelBuilder` pinta cubos numa grade e gera uma `BufferGeometry` com greedy meshing
  e winding calculado por produto vetorial. Todo modelo e prop é feito com ele.
- `models.ts`: herói (reconstruído quando a assinatura do equipamento muda), inimigos, chefes, NPCs.
  Peças equipadas de raridade ganham aura (casca aditiva) + emissivo leve; o bloom em `main.ts`
  (limiar 1,0) transforma isso em neon. Nada mais na cena passa do limiar.
- `entityViews.ts`: liga entidade a modelo; animações procedurais (andar, golpe, rolamento em torno
  do centro com ordem de rotação YXZ, giro), barras de vida, telegraph (círculo ou linha), marcadores
  de quest sobre NPCs.
- `terrainMesh.ts` / `environment.ts`: terreno em blocos e props instanciados por variante.
- `audio.ts`: tudo sintetizado com Web Audio; música generativa com modo de chefe.
- UI em HTML sobre o canvas: `hud.ts`, `inventoryUI.ts`, `dialogueUI.ts`, `questTracker.ts`,
  `skillBar.ts`, `menu.ts`. Painéis modais (mochila, diálogo, menu) pausam a simulação e soltam o
  pointer lock; `main.ts` coordena quem está aberto.

## Dependências

Three.js (render + addons de pós-processamento), Vite, Vitest, TypeScript estrito
(`noUncheckedIndexedAccess` ligado: índices de array são `T | undefined`).
