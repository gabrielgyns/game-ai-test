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

## Pedidos do dono ainda não atendidos ou adiados
- Lock-on de câmera (explicado, adiado por escolha dele).
- Mais biomas e segundo chefe (em andamento após este documento).
