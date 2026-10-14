# Roadmap

Visão: um RPG 3D de ação com a exploração e o combate direto de **Zelda**, a progressão,
classes e mundo aberto de **Perfect World**, e o visual voxel e o loot de **Minecraft Dungeons**.
Single-player primeiro; o domínio é isolado da renderização para permitir multiplayer depois.

## Feito

- [x] Mundo procedural com anéis de dificuldade (gosmas, goblins, orcs)
- [x] Herói em terceira pessoa, câmera orbital com pointer lock
- [x] Combate com cooldown, dano flutuante, barras de vida, log
- [x] IA de inimigos (idle, perseguir, atacar, voltar para casa)
- [x] XP, nível, ouro, regeneração, morte e renascimento
- [x] Andar de ré (S) e de lado (A/D) mantendo o alvo à frente
- [x] Menu de pausa com ESC (continuar, reiniciar, sensibilidade do mouse)
- [x] Estilo voxel: personagens, árvores, pedras e terreno em blocos, com greedy meshing
- [x] Inventário e equipamento: drops por tier e raridade, coleta automática, mochila (I), poções (Q)
- [x] Equipamento visível no herói (arma, armadura, botas, amuleto, anel)
- [x] Habilidades (1-4): Golpe Giratório, Investida, Grito de Guerra, Segundo Fôlego
- [x] Esquiva com rolamento (Espaço) com invulnerabilidade
- [x] Telegraph: inimigos avisam o golpe (área vermelha) antes de acertar; fugir ou rolar evita
- [x] Poções empilhadas (pequena 30%, grande 60%) e brilho leve por raridade nos itens
- [x] Chefe: Rei Goblin na arena ao norte, com três golpes telegrafados, três fases, lacaios e loot épico garantido
- [x] NPCs no santuário (Anciã, Ferreiro, Guarda) com diálogo (F), 4 quests encadeadas, rastreador e marcadores ! e ?
- [x] Salvar e carregar: autosave, continuar ao abrir, exportar/importar arquivo .json, novo jogo

## Próximos

1. **Mais vida no mundo voxel.** Água, flores e grama alta, variação de biomas, ciclo de dia e noite,
   e suporte a modelos `.vox` (MagicaVoxel) para quem quiser desenhar personagens num editor.
2. **Loot mais rico.** Afixos aleatórios (ex.: "da Serpente": +regeneração), conjuntos, venda de itens
   por ouro num mercador.
3. **Mais chefes.** Um por bioma, com mecânicas próprias (projéteis, poças, escudos) usando os padrões de golpe.
4. **Lock-on.** Travar a câmera num alvo (Zelda) como alternativa ao modo livre.
5. **Mais quests.** Objetivos de coleta e exploração, quests repetíveis diárias, e um mercador para vender loot.
6. **Vários slots de save** e save na nuvem (quando houver servidor).
7. **Áudio.** Efeitos de golpe, passos, música ambiente.
8. **Classes.** Guerreiro, arqueiro, mago (Perfect World), com árvore de habilidades.
9. **Dungeons.** Áreas instanciadas com chefes e loot garantido (Minecraft Dungeons).
10. **Multiplayer.** Servidor rodando o mesmo domínio; cliente só renderiza.
