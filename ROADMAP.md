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
- [x] Cenário em alta resolução: 25 modelos esculpidos em 12 voxels/m (carvalhos com galhos, bétulas, pinheiros em camadas e nevados, arbustos, pedras com musgo e líquen, arenitos, árvores mortas com barba-de-velho, cogumelos, cactos, ossadas e os marcos das arenas), três níveis de detalhe com sombra barata e recorte pela câmera
- [x] Modelos `.vox` do MagicaVoxel: `assets/vox/<id>.vox` substitui a escultura; o lab exporta qualquer adereço como `.vox` e mostra um arquivo arrastado para a cena
- [x] Nível de inimigos e chefes ao lado do nome e da vida, na cor da dificuldade para o herói
- [x] Minimapa que gira com a câmera (inimigos, chefes, quests, portal, baú, loot raro) e mapa grande na tecla M, no vale e na cripta
- [x] Conjuntos de itens: 4 conjuntos de 3 peças (um por chefe), bônus com 2 peças e poder com 3 (Fúria Real, Veneno, Casca de Areia, Colheita de Almas); o chefe derruba a peça que falta
- [x] Baú do santuário compartilhado entre os heróis (3 abas de 30)
- [x] Dificuldade do mundo no Altar das Eras: Aventureiro, Veterano, Apocalipse e Pesadelo, destravados pelos três chefes; itens com nível, que crescem com quem os derrubou
- [x] Lab de modelos (`/lab.html`): vitrine de tudo que aparece no jogo, luz, animações e comparação com a versão anterior

## Próximos

Itens técnicos (desempenho, pathfinding, qualidade gráfica, memória) ficam no [BACKLOG](BACKLOG.md).

O problema que puxa tudo abaixo: **no nível 20 o vale acaba.** O inimigo mais forte é nível 9, o chefe
mais forte é 12 e só a cripta acompanha o herói. A ordem dos marcos ataca isso primeiro.

### Fase 1: o que fazer depois do nível 12

1. **Elites com modificadores.** Inimigos raros com nome dourado e um ou dois modificadores (Veloz,
   Vampírico, Gélido, Explosivo, Escudeiro), reaproveitando status e afixos. Mais loot e XP.
2. **Ferreiro reforja.** Pagar ouro para trocar um afixo, subir a raridade ou melhorar uma peça de
   conjunto. Dá função ao Ferreiro e um destino para o ouro e o loot repetido.

### Fase 2: um mundo maior, em zonas (estilo Ragnarok)

3. **Sistema de zonas.** O mundo vira vários mapas ligados por saídas na borda; só a zona atual fica
   carregada. Cada zona tem terreno, biomas, faixa de nível, população, chefe com conjunto, quests e
   a entrada de uma dungeon. O save guarda a zona. O vale atual vira a primeira zona (níveis 1 a 12).
   - *Por que zonas e não um mundo contínuo:* cabe no desempenho (cenário e grama de uma zona só), cada
     zona é desenhada com cuidado e dá ritmo de progressão. O caminho já existe: a cripta vive numa
     região separada do mesmo `World` e o herói é levado para lá e de volta.
4. **Zonas novas**, cada uma com cara própria, uma dungeon e um chefe com conjunto:
   - Floresta Ancestral (níveis 12 a 20): árvores gigantes, ruínas élficas, lobos e entes.
   - Picos Gelados (20 a 28): neve, gelo escorregadio, yetis, nevasca.
   - Terras Vulcânicas (28 a 36): lava, cinzas, demônios do fogo.
5. **Viagem rápida.** Pedras de teleporte por zona, ativadas ao tocar e usadas pelo mapa grande. Só
   faz sentido com várias zonas e dungeons, então vem depois delas.
6. **Mundo vivo.** Eventos no mapa (acampamento goblin que aparece, chefe errante à noite, baú
   amaldiçoado) e clima por bioma (chuva, névoa, tempestade de areia, nevasca).
7. **Mais quests.** Coleta, exploração e escolta, uma linha de história por zona e quests repetíveis
   diárias.

### Fase 3: dungeons maiores e mais elaboradas

8. **Dungeon 2.0 (a cripta refeita).** Base para todas as próximas:
    - Planta com mais forma: salas em L, em cruz, redondas, com desníveis e rampas; ramos laterais com
      tesouro; portas trancadas e chaves; salas secretas.
    - Andares: 2 ou 3 níveis descendo até o chefe, com escada entre eles.
    - Salas com evento: emboscada, ondas, armadilhas (espinhos, lâminas, chão que cai), santuário com
      bênção, minichefe.
    - Visual no nível do cenário novo: paredes, arcos e colunas esculpidos em 1/12 m, adereços (caixões,
      barris, estandartes, teias, ossadas, correntes), luz colorida, névoa baixa e partículas.
    - Inimigos que contornam paredes (depende do pathfinding do BACKLOG).
9. **Temas de dungeon**, um por zona, cada um com inimigos, armadilhas, chefe e conjunto próprios: Mina
    Abandonada, Templo do Deserto, Covil da Rainha, Santuário Élfico, Caverna de Gelo, Forja Vulcânica.
10. **Dungeons de fim de jogo.** Modificadores sorteados (escuridão, inimigos explosivos, sem cura),
    níveis de dificuldade acima do mundo e chaves que caem como loot (como mapas no Path of Exile), com
    recordes locais de tempo.

### Depois

11. **Lock-on.** Travar a câmera num alvo (Zelda) como alternativa ao modo livre.
12. **Áudio com assets.** Trocar a síntese por samples e trilha composta quando houver arte sonora.
13. **Save na nuvem** (quando houver servidor); os slots locais já existem.
14. **Multiplayer.** Servidor rodando o mesmo domínio; cliente só renderiza.
