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
- [x] Som sintetizado: efeitos para combate, loot, habilidades e quests; trilha ambiente generativa e tema de chefe
- [x] Biomas: Pântano Sombrio (oeste, água, aranhas, zumbis do lodo) e Deserto Escaldante (leste, escorpiões, salteadores)
- [x] Segundo chefe: Rainha Aranha no pântano, com Teia Venenosa mirada no jogador, Bote e aranhas na fúria
- [x] 3 quests novas (Rainha, escorpiões, salteadores); o Guarda passa a dar quest
- [x] Classes: Guerreiro, Arqueiro (flechas, ajuda de mira) e Mago (raios, Bola de Fogo, Escudo Arcano), cada uma com 4 habilidades
- [x] Voxel rico: personagens em 16 voxels/m com rosto, roupa, armas e acessórios detalhados, AO e grão; membros articulados com ciclo de caminhada
- [x] Mais vida no mundo: ciclo de dia e noite (céu, sol, lua, estrelas, vaga-lumes, braseiros), grama e flores com vento, partículas de acerto e morte, clarão no alvo, tremor de câmera e hit-stop
- [x] Terceiro chefe: Imperador Escorpião no deserto, com Rajada de Espinhos em leque, Cuspe Ácido que deixa poças e Carapaça de Areia que só habilidades quebram; quest do Guarda
- [x] Inimigos arqueiros (Goblin Arqueiro na campina, Salteador Arqueiro no deserto) que mantêm distância e atiram com aviso em linha
- [x] Afixos nos equipamentos (8 tipos, de regeneração em combate a crítico e roubo de vida) e Mercadora Zuri com venda, poções, estoque diário e recompra
- [x] Árvore de habilidades: 1 ponto por nível, 5 ranks por habilidade (60 ao todo) com talentos que atordoam, congelam, deixam lento ou vulnerável, criam fogo e tempestades; reinício por ouro
- [x] Dungeons: Cripta Esquecida instanciada (planta nova a cada entrada), paredes com colisão e linha de visão, esqueletos que escalam com o nível, Lorde Esqueleto, baú de loot garantido, três vidas, recorte de paredes na câmera
- [x] Saves em 5 slots locais, com nome do herói, resumo de progresso, exportar/importar por slot e migração do save antigo
- [x] Lab de modelos (`/lab.html`): vitrine de tudo que aparece no jogo, luz, animações e comparação com a versão anterior

## Próximos

1. **Cenário em alta resolução.** Árvores com galhos e pedras com musgo na mesma resolução dos
   personagens, e suporte a modelos `.vox` (MagicaVoxel) para desenhar num editor.
2. **Conjuntos de itens.** Peças que dão bônus quando vestidas juntas; afixos e mercador já existem.
3. **Lock-on.** Travar a câmera num alvo (Zelda) como alternativa ao modo livre.
4. **Mais quests.** Objetivos de coleta e exploração e quests repetíveis diárias.
5. **Save na nuvem** (quando houver servidor); os slots locais já existem.
6. **Áudio com assets.** Trocar a síntese por samples e trilha composta quando houver arte sonora.
7. **Mais dungeons.** Novos temas (mina, templo do deserto), salas especiais (armadilhas, desafios) e modificadores de dificuldade.
8. **Multiplayer.** Servidor rodando o mesmo domínio; cliente só renderiza.
