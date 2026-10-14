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

## Pedidos do dono ainda não atendidos ou adiados
- Lock-on de câmera (explicado, adiado por escolha dele).
