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

## Próximos

1. **Estilo voxel.** Trocar as primitivas por modelos feitos de cubos (herói, inimigos, árvores)
   e terreno em blocos com degraus, mantendo as cores chapadas. Candidatos: modelos `.vox`
   (MagicaVoxel) carregados em runtime, ou geração procedural de voxels por código.
2. **Inventário e equipamento.** Drops de itens, slots (arma, armadura, acessório), raridades.
3. **Habilidades.** Barra de 4 skills com cooldown; esquiva com rolamento (Zelda).
4. **Lock-on.** Travar a câmera num alvo (Zelda) como alternativa ao modo livre.
5. **NPCs e quests.** Vila no santuário, diálogo, quests de caça e entrega.
6. **Salvar e carregar.** Persistir no localStorage e exportar para arquivo.
7. **Áudio.** Efeitos de golpe, passos, música ambiente.
8. **Classes.** Guerreiro, arqueiro, mago (Perfect World), com árvore de habilidades.
9. **Dungeons.** Áreas instanciadas com chefes e loot garantido (Minecraft Dungeons).
10. **Multiplayer.** Servidor rodando o mesmo domínio; cliente só renderiza.
