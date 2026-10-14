# Histórico de marcos

Cada marco foi entregue na branch de trabalho e mergeado na `main` com autorização do dono.
Todos foram verificados com testes (Vitest), typecheck, build e um Chromium headless (Playwright)
com screenshots antes de serem considerados prontos.

1. **Base jogável**: mundo procedural, herói em terceira pessoa, inimigos com IA (idle, perseguir,
   atacar, voltar), combate, XP/nível, ouro, morte e renascimento. 13 testes.
2. **Ré e menu**: corpo segue a câmera (S anda de ré), menu de pausa com ESC. Bug descoberto por
   teste: convenção de yaw invertida (o herói andava de costas). Pedido do dono: estilo voxel.
3. **Voxel**: VoxelBuilder com greedy meshing, terreno em blocos, modelos e props em cubos.
   Correção: ESC não fechava o menu (o navegador consome o primeiro ESC do pointer lock).
4. **Inventário e equipamento**: raridades, tiers, drops no chão, mochila (I), poções (Q).
   Dono pediu slot da poção na barra: feito.
5. **Habilidades e esquiva**: 4 skills, rolamento invulnerável, equipamento visível no herói
   (dono notou que a skin não mudava ao equipar). Correções: texto flutuante cortado; rolamento
   girava em torno dos pés e afundava no chão (ordem de rotação YXZ + compensação do pivô).
6. **Telegraph, pilhas e brilho**: inimigos avisam o golpe; poções empilham (pequena/grande);
   brilho leve por raridade. Dono reportou: marca vermelha ficava no chão após a morte (view não
   escondia o telegraph; domínio não zerava o aviso). Corrigido no marco seguinte.
7. **Chefe Rei Goblin**: padrões de golpe, fases, lacaios, loot garantido, arena ao norte.
8. **Glow neon**: bloom seletivo (dono: "glow neon leve bem leve"), depois aura também no
   equipamento vestido (dono enviou referência do Perfect World).
9. **NPCs e quests**: Anciã, Ferreiro, Guarda; 4 quests encadeadas; diálogo (F); rastreador.
10. **Salvar e carregar**: autosave, continuar ao abrir, exportar/importar JSON, novo jogo.
11. **Som**: efeitos sintetizados e música generativa com tema de chefe.
12. **Correção**: item largado pela mochila era recoletado ao fechar o painel (`requireLeave`).
13. **Documentação**: esta pasta.
14. **Biomas e segundo chefe**: pântano (oeste) com água plana que atrasa o passo, aranhas e zumbis do
    lodo; deserto (leste) com escorpiões e salteadores; Rainha Aranha com padrão novo "aoe" (área
    fixada na posição do jogador no início do aviso); três quests novas. Lição: screenshots com o
    jogo pausado mostravam o herói na posição antiga porque as views não atualizavam na pausa;
    agora atualizam com dt 0 (e equipar na mochila já reflete no modelo).

15. **Classes**: Guerreiro, Arqueiro e Mago com atributos, estilo de ataque básico (melee, flecha,
    raio), arma inicial e barra própria de 4 habilidades. Projéteis como entidades do mundo com
    sistema próprio (acerto, perfuração, explosão, ajuda de mira em cone de 22°). Escudo Arcano
    absorve antes da vida. Escolha de classe na tela inicial (sessionStorage + reload). Bug
    corrigido no caminho: "Novo jogo" pelo menu era desfeito pelo autosave de `beforeunload`
    (flag `suppressAutosave`).

16. **Voxel rico e lab de modelos** (branch `design/lab`, a pedido do dono: "continuar com voxel,
    voxel mais rico, um /lab para mostrar tudo"). VoxelBuilder ganhou oclusão ambiente por vértice,
    grão por voxel (com manchas de N voxels), `sphere`, `carve`, `stampXY/XZ` (ASCII art), `recolorFront`
    (pintar na superfície de uma bola) e `tone/shades` para paletas. Todos os personagens foram
    redesenhados em 16 voxels/m em `src/game/characters/` (herói, mobs, chefes, NPCs) com um rig
    humanoide articulado (`buildHumanoid`): pernas, braços e cabeça em pivôs; o `entityViews` anima
    o ciclo de caminhada, o braço livre no aviso e a pose de repouso da arma. `lab.html` reaproveita
    `World` + `EntityViews` para mostrar as animações reais, com presets de luz e comparação com a
    versão anterior (`src/lab/legacyModels.ts`). Custo: ~600k triângulos por quadro no spawn (antes
    ~245k); grão em manchas de 2 voxels nos mobs e fino só no herói. Aprovado pelo dono e mesclado
    na `main`. Bug reportado no teste dele: depois do Golpe Giratório o braço da arma ficava
    esticado no herói, porque o reset só rodava em modelos sem braço livre; agora os dois braços
    voltam e um teste em `src/game/entityViews.test.ts` cobre isso.
17. **Saves em slots** (pedido do dono: "mais de 1 save, localmente"). Domínio em `saveSlots.ts`:
    `SaveSlots` sobre uma porta `KeyValueStore` (5 slots, slot ativo, resumo por slot, migração do
    save único antigo `vale.save` para o primeiro slot livre), nome do herói opcional no `SaveData`
    (sem subir a versão) e nomes sugeridos por classe. Apresentação: tela de saves (`slotsUI.ts`) que
    substitui a escolha de classe do overlay e os botões de exportar/importar/novo jogo do menu.
    Trocar de slot salva o atual e recarrega a página (o mundo nasce uma vez no boot). Verificado com
    11 testes de domínio e um roteiro headless de 15 checagens (criar, trocar, apagar, migrar).
18. **Mais vida no mundo** (pedido do dono, "puro visual, muito impacto"). Domínio: `dayCycle.ts`
    (relógio sobre `world.time`, então o horário é salvo; dia de 12 min começando às 8h; altura do sol,
    luz do dia e crepúsculo). Apresentação: `sky.ts` (uma direcional que é sol de dia e lua à noite,
    trocando de lado quando a intensidade é zero; céu, neblina, hemisférica, estrelas, discos de sol e
    lua, vaga-lumes), `foliage.ts` (~15 mil tufos de grama, ~1.600 flores, ~1.100 juncos em blocos de
    24 m, com LOD por fração de instâncias embaralhadas e vento/pisada no vertex shader),
    `particles.ts` (pool de 700 cubos instanciados), clarão branco nos materiais do alvo, `shake.ts`
    (trauma² com decaimento, regulável no menu) e hit-stop de 45–80 ms nos golpes corpo a corpo.
    Braseiros no santuário com luz pontual à noite. Custo medido: ~830k triângulos por quadro no spawn
    (antes ~620k).
19. **Chefe do deserto e arqueiros** (pedido do dono). Domínio: `hazards.ts` + `hazardSystem` (poças
    com pulsos de dano, hostilidade do dono, sem "esquivou" ao rolar por cima), padrões novos `fan`
    (leque sem ajuda de mira, aviso em cone) e `lob` (arremesso em arco que cai nos pontos avisados;
    na fase 2 e 3 vira 3 e 5 globos, com `groundWarning` para os extras), dano com tipo
    (`basic | skill | hazard`) para a Carapaça de Areia (3 camadas, só habilidades, atordoa 4,5 s com
    +50% de dano, volta a cada fase), `createScorpionEmperor` no tablado leste (+1 m, obeliscos),
    quest "O Imperador das Areias" do Guarda, e inimigos com `basicPattern` de projétil e
    `keepDistance` (Goblin Arqueiro e Salteador Arqueiro). Projéteis de inimigo nunca usam ajuda de
    mira, para a linha avisada ser honesta. Apresentação: aviso em cone, poças em voxel que borbulham,
    casca dourada translúcida, estrelas de atordoamento, linha da carapaça na barra do chefe, modelos
    do Imperador e dos arqueiros. 14 testes novos.
20. **Mercador e afixos** (pedido do dono: "dá uso ao ouro"). Domínio: `affixes.ts` (8 afixos com
    slots permitidos e valores por tier; quantidade por raridade; o primeiro vira sobrenome),
    `Bonuses` derivados em `recomputeStats` (crítico, roubo de vida, recarga limitada a 40%, ouro,
    regeneração sempre ativa), aplicados em `applyDamage`, `regenerate`, `kill` e `useSkill`;
    `shop.ts` (venda a 35%, compra a 3× o valor, poções a preço fixo, estoque de 4 itens por dia do
    relógio e por nível, recompra dos 6 últimos), salvo no `SaveData.shop`; Mercadora Zuri no
    santuário. Apresentação: modelo da Mercadora com balança e bolsa de moedas, barraca com toldo
    listrado, painel da loja, tooltip compartilhado com afixos e comparação de todos os bônus,
    número de crítico laranja com "!", som de moedas. Concordância de "Reforçad@" no plural.
21. **Árvore de habilidades** (pedido do dono: "dá motivo para subir de nível"). Domínio:
    `skillTree.ts` (dados dos 60 ranks; `skillMods` soma o que foi comprado; pontos = nível − 1;
    `learnRank` em ordem; `resetTalents` por 30 ouro × nível; `effectiveCooldown` junta ranks e
    afixo do Sábio), `status.ts` (atordoado, lento, vulnerável, com chefes a meia duração), Pele de
    Ferro (`abilities.guard`), crítico extra no Foco, poças do herói (fogo, tempestade de flechas),
    flechas e investida que atordoam, buff ao fim do deslocamento, Retorno e Mana Viva no escudo,
    Último Suspiro disparado por `applyDamage`. O sistema de habilidades foi reescrito em cima dessas
    primitivas. Talentos salvos no `SaveData.player.talents`. Apresentação: painel (K) com 4 colunas,
    aviso de pontos sobre a barra, estrelas de atordoamento para qualquer criatura, tom azul (lento)
    e roxo (vulnerável), poças de fogo e chuva de flechas. 19 testes novos.
22. **Dungeons** (pedido do dono: "áreas instanciadas com chefe e loot garantido, estilo Minecraft
    Dungeons"). Domínio: `dungeonLayout.ts` (planta 96×96 por seed: sala inicial, 5 de combate e a do
    chefe encadeadas por corredores retos, pilares 2×2 nas salas grandes) e `dungeon.ts` (a cripta
    vive no mesmo `World` em x ≥ 1000; `enterDungeon` povoa as salas com inimigos escalados pelo
    nível e tier de loot, `closeDungeon` apaga tudo da região, `isWalkable`/`canStand` dão paredes ao
    movimento e aos projéteis, `hasLineOfSight` controla o aggro, `playerRespawnPoint` conta 3 vidas,
    `dungeonSystem` detecta salas limpas e a vitória, `openChest` dá ouro e loot garantido). Save
    dentro da cripta guarda o herói na porta. Esqueleto, Esqueleto Arqueiro, Lorde Esqueleto
    (`createSkeletonLord`, escala com o nível) e projétil de osso. Quest "A Cripta Esquecida" da
    Anciã. Apresentação: portal de pedra no mapa, `dungeonView.ts` (piso, paredes de tijolo, pilares,
    tochas com 6 luzes que seguem o herói, baú que abre, portais), vale escondido e céu escuro dentro
    da cripta, câmera mais de cima, recorte de paredes em funil no shader, painel da cripta no HUD.
    Custo: ~340k triângulos dentro da cripta. 15 testes novos.
23. **Cenário em alta resolução** (pedido do dono: "árvores com galhos e pedras com musgo na mesma
    resolução dos personagens, e suporte a .vox"). `VoxelBuilder` com chave numérica (bem mais
    rápido), `downsample` para LOD, `forEach`/`bounds`/`get`. `props/sculpt.ts` (cápsulas que afinam,
    galhos em curva, bolhas com borda por ruído, demãos no topo e na superfície), `trees.ts`,
    `rocks.ts`, `landmarks.ts` e `catalog.ts` com 25 modelos em 1/12 m; `placeProps` decide onde
    cada um nasce (bioma, faixa de altura, arenas e portal livres). `field.ts`: três níveis (até 15 m
    completo, até 34 m metade, além disso um quarto), sombra vinda de uma versão magra do modelo,
    nível longe sem sombra e recortado pela câmera a cada quadro, peças pequenas somem além de 70 m,
    modelo completo montado um por quadro depois do boot. `vox.ts`: leitura e escrita do formato do
    MagicaVoxel (paleta, cena com vários modelos via nTRN/nGRP/nSHP, conversão de eixos, redução para
    255 cores); `assets/vox/<id>.vox` substitui a escultura. Lab: nível de detalhe, exportar `.vox`,
    arrastar `.vox` para a cena, comparação com os adereços antigos (`legacyProps.ts`). Custo: ~1,1M
    triângulos no vale (antes ~870k), ~400k no pântano e no deserto, ~1,5M no platô do Rei Goblin,
    que vê o mapa inteiro; boot ~1,3 s mais lento no headless. 16 testes novos.

## Pedidos do dono ainda não atendidos ou adiados
- Lock-on de câmera (explicado, adiado por escolha dele).
