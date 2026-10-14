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
24. **Nível dos inimigos** (pedido do dono: "o level dos mobs ao lado do nome e hp"). Domínio:
    `levels.ts` (`entityLevel`: herói pela progressão, inimigos e chefes pelo campo `level`;
    `levelDifficulty` em 5 faixas pela diferença de nível), nível em cada `EnemyTemplate` (Gosma 1
    a Salteador 9), chefes (Rei Goblin 6, Rainha 10, Imperador 12, Lorde Esqueleto = cripta + 2),
    esqueletos da cripta no nível dela. Apresentação: selo com o número à esquerda da barra de vida
    flutuante, "Nv N" ao lado do nome no painel do alvo e na barra do chefe, na cor da dificuldade
    (cinza, verde, amarelo, laranja, vermelho). 5 testes novos.
25. **Minimapa** (pedido do dono). Domínio: `mapMarkers.ts` decide o que aparece (inimigos, chefes,
    NPCs com quest nova ou para entregar, portal da cripta, saídas, baú, itens raros e épicos no chão),
    só do "lugar" onde o herói está (vale ou cripta). Apresentação: `minimap.ts` com o fundo do vale
    desenhado uma vez (bioma, altura, relevo sombreado, água, praça, árvores e pedras de
    `placeProps`) e o da cripta a partir da planta (salas limpas em verde); minimapa redondo que gira
    com a câmera, com "N", nome da região e marcadores importantes presos na borda; mapa grande na
    tecla M, norte para cima, com nomes dos chefes e legenda. 4 testes novos.
26. **Conjuntos de itens** (pedido do dono, primeiro do roadmap). Domínio: `sets.ts` com 4 conjuntos
    de 3 peças, um por chefe (Espólios do Rei Goblin, Seda da Rainha, Armadura do Imperador,
    Relíquias do Lorde); a arma acompanha a classe de quem a encontra. 2 peças: bônus de atributo
    (somado em `equipmentBonus`); 3 peças: poder em `Bonuses.powers`, lido em `combat.ts` (Fúria
    Real +30% de dano abaixo de metade da vida, Veneno deixa lento no golpe básico, Casca de Areia
    -20% de dano recebido, Colheita de Almas cura 6% e adianta as habilidades a cada abate). Cada
    chefe derruba uma peça do seu conjunto, de preferência uma que o herói ainda não tem
    (`pickSetSlot`). `Item.set` vai no save sem migração. Apresentação: cor verde-água "Peça de
    conjunto" na mochila, loja, log e drop (feixe mais alto), brilho verde-água no herói, tooltip com
    as três peças (vestidas acesas) e os bônus de 2 e 3, aviso ao ligar o bônus. Lab: herói com o
    conjunto do Imperador. 12 testes novos.
27. **Baú e dificuldade do mundo** (pedido do dono: "estou nível 20 e já não tem mais nada"). Domínio:
    `worldTier.ts` (Aventureiro, Veterano +10, Apocalipse +20, Pesadelo +30; vencer os três chefes no
    maior nível destrava o próximo; `scaleEnemyToLevel` reescala vida ×1,13, dano ×1,11, XP ×1,25 e
    ouro ×1,12 por nível a partir dos números de nascença em `tierBase`, então trocar de era é
    reversível; lacaios de chefe também escalam), **nível do item** (`Item.level` = nível de quem
    derrubou; `itemPower` cresce 8% por nível acima de 10 em dano, vida e regeneração, não em
    porcentagens; vale para drops, chefes, conjuntos, baú da cripta e estoque da Mercadora), `stash.ts`
    (baú de 3 abas × 30, compartilhado entre os slots, com ids novos ao carregar) e `sanctuary.ts`
    (pontos de uso). Save guarda a era e reescala o vale ao carregar. Apresentação: baú e Altar das Eras
    esculpidos na praça, painéis do baú e do altar, "Era X" no painel do herói, marcadores no mapa,
    nível do item no tooltip, baú salvo em `vale.stash`. 12 testes novos.
28. **Pathfinding e Dungeon 2.0** (pedido do dono: "deixar a cripta grande e bonita"). Domínio:
    `pathfinding.ts` (campo de fluxo: Dijkstra a partir da célula do herói, diagonais sem cortar quina,
    custo extra colado em parede; cada inimigo desce o campo mirando a célula mais distante que ainda
    vê; refeito quando o herói muda de célula), `steerToward` no AI (linha reta no vale ou com caminho
    livre). `dungeonLayout.ts` refeito: grade 128×128, dois andares, salas retangulares, redondas, em
    cruz e salões com colunas, corredores que entram até o centro, salas laterais de tesouro e
    santuário, eventos por sala (emboscada, ondas, armadilhas), `Tile.Trap`. `dungeon.ts`: andares
    (`descend`), Cavaleiro Sepulcral guardando a escada (minichefe com loot garantido), o Lorde no
    andar 2, emboscadas que nascem ao entrar, segunda onda, espinhos em ciclo (aviso 1 s, ferem 14% da
    vida, inimigos também), santuário (cura e +25% de dano por 60 s), baú de tesouro. Apresentação:
    `dungeonView.ts` refeito com malhas únicas por andar em voxels de 1/6 m (pele das paredes com blocos
    em relevo e musgo, topo, arcos nas entradas, pilares com caneluras, poço da escada com degraus,
    piso de lajes com tapetes e grades), `dungeonDecor.ts` (sarcófago, barril, ossada, velas,
    estandarte, teia, entulho, urna, espinhos, santuário, braseiro), luzes coloridas por fonte, poeira no
    ar, guardião 35% maior, HUD com o andar, minimapa com armadilhas, escada e santuário. Custo: ~0,9 s
    para montar um andar, ~140k triângulos de cenário por andar, ~430k no quadro da arena. 17 testes
    novos ou refeitos.
29. **Sistema de zonas e Floresta Ancestral** (pedido do dono: "como vamos aumentar o mundo? mapas tipo
    Ragnarok"). Domínio: `zones.ts` (zonas como quadrados próprios no mesmo `World`: Vale em 0,0 e
    Floresta em 0,−420; `zoneAt`, portões `ZONE_GATES` e `travel`), `terrainHeight`, `isWater`,
    `biomeAt` e o limite do movimento passam a perguntar a zona; respawn no ponto seguro da zona;
    marcadores do mapa só da zona do herói, com o portão. Floresta (níveis 12 a 20): relevo com rio,
    acampamento ao sul, ruínas de Elar a leste e clareira ao norte; Lobo Cinzento (matilhas), Ente
    Jovem e Espírito Élfico (arqueiro de raios); Ente Ancião (nível 20: Chicote de Vinhas, Raiz
    Esmagadora, Nuvem de Esporos com poça `spores`, Lascas de Casca, lobos na fúria); conjunto Coração
    da Floresta (2 peças: +6 vida/s; 3: Casca de Espinhos devolve 30% do dano); Guardiã Lyra com 4
    quests; recompensas de quest no nível do herói. Apresentação: `createTerrainMesh`, `Foliage` e
    `createEnvironment` por zona (samambaias, cogumelinhos azuis, árvores ancestrais em 1/9 m,
    carvalhos sombrios, troncos caídos, arcos, estátuas e colunas élficas, barracas e fogueira);
    zonas montadas na primeira visita (~1 s), só a zona do herói visível; portões com véu verde;
    neblina esverdeada na floresta; minimapa por zona; modelos de lobo (quatro patas no trote), ente,
    espírito translúcido, Ente Ancião (voxels duas vezes maiores) e Guardiã. ~1,1M triângulos no quadro
    da floresta. 10 testes novos.
30. **Áreas no lugar de eras** (pedido do dono: "não queremos ficar matando os mesmos mobs no mesmo
    mundo, algo tipo Ragnarok: passo daquele ponto e faz loading para uma área nova, com vila"). Saiu a
    dificuldade do mundo inteira (`worldTier.ts`, `tierBase`, Altar das Eras, "Era X" no painel,
    eventos de era); o nível do item ficou. Domínio: `ZONE_PASSAGES` e `passageAt` (a boca é uma faixa
    além de uma linha na borda; chega-se fora da boca de volta), `villages.ts` (Santuário do Vale e
    Acampamento da Guardiã: pedra, baú e ponto de chegada; `villageSystem` ativa a pedra a 9 m na
    primeira visita; `teleport` cobra 20 + 3 por nível, troca de zona e não funciona na cripta),
    lojas por id (`SHOPS`: a do Mascate tem 5 ofertas, mais raras, nível mínimo 12; recompra por loja;
    save migra a loja antiga), NPCs Mascate Faelan e Armeira Kaia, quest "Cerne de Ente" passa para a
    Armeira e "Madeira Viva" (10 entes, depois do chefe) é nova, respawn da floresta ao lado da pedra.
    Apresentação: tela de carregamento (fade, nome, faixa de nível, linha da área, barra) que monta a
    área e os modelos completos atrás dela; passagens marcadas por trilha de lajes, postes com
    lanterna e cortina de névoa; Pedra de Teleporte esculpida (monólito com runas) e cristal flutuante
    que acende ao ativar, com luz fria; painel da pedra; vila do acampamento com quatro barracas,
    barraca do Mascate, baú e pedra; modelos do Mascate (mochila enorme, orelhas de elfo) e da Armeira
    (ombreira de casca, trança, martelo); nome da área no painel do herói; minimapa com a pedra.
    10 testes novos ou refeitos.
31. **Picos Gelados e a Caverna de Gelo** (pedido do dono: "agora faz os Picos Gelados com vila e
    dungeon"). Domínio: zona `picos` em 0,−840 (níveis 20 a 28), ligada à floresta por uma passagem no
    norte dela (penhasco aberto em x local 50); relevo de cristas (ruído dobrado), vila, patamar da
    caverna, platô do Gigante e lago congelado (`isIce`, gelo plano); gelo escorregadio
    (`movement.slide`, D40); bioma `snow`; Lobo das Neves, Espectro Gélido (estilhaço `iceShard` que
    deixa lento) e Yeti; Gigante de Gelo (nível 28: Punho Glacial, Tremor Gélido, Avalanche com chão
    congelado `FROST_POOL` que fere e deixa lento, Estilhaços, Avanço, lobos na fúria) com a Armadura
    do Inverno (2: +90 vida; 3: Pele de Geleira); Vila de Pedra-Fria com pedra, baú, Jarl Bjorn,
    Caçadora Eira e Mercadora Sigrid (loja `trader`, nível mínimo 20); 5 quests novas. Dungeons por
    tema (`DUNGEON_THEMES`, D39): a Caverna de Gelo na encosta leste, nível mínimo 20, lobos,
    espectros e yetis, Guardião Glacial na escada e Rainha Gélida no fundo (escala com o nível) com a
    Regalia da Rainha Gélida (2: +8% de velocidade; 3: Estilhaçar, +40% em alvo lento ou atordoado).
    Sem vidas, acorda na vila da zona da entrada. Apresentação: terreno de neve, pedra nas encostas e
    gelo com veios; capim queimado de frio; neve caindo (`snowfall.ts`); neblina branco-azulada;
    adereços novos (cabana de toras com telhado nevado e pingentes, pedras nevadas, cristais e
    pináculos de gelo, árvore morta nevada, boca da caverna); modelos do lobo das neves, yeti, espectro
    translúcido, Gigante (voxels 2,4× maiores) e Rainha, Jarl, Sigrid e Eira; estilhaço de gelo e poça de
    gelo; caverna com paleta, adereços (cristais, montes de neve, pingentes, lamparinas, ossada
    congelada, espinhos de gelo, braseiro de chama fria), luz fria e neve; portais por tema, entrar numa
    dungeon passa pela tela de carregamento; minimapa e lab com tudo. Medido no Chromium headless:
    ~0,6–0,66M triângulos no quadro dos Picos (vila, lago, centro), contra ~1,1M da floresta. 11 testes
    novos (`peaks.test.ts`).

## Pedidos do dono ainda não atendidos ou adiados
- Lock-on de câmera (explicado, adiado por escolha dele).
