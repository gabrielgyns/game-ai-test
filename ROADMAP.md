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
- [x] Itens com nível, que crescem com quem os derrubou (a dificuldade do mundo, que vinha junto, saiu: o mundo cresce em áreas novas)
- [x] Dungeon 2.0: cripta em dois andares com salas de formas variadas, salas de tesouro e santuário, emboscadas, ondas, armadilhas de espinhos, Cavaleiro Sepulcral guardando a escada, visual esculpido (paredes em relevo, arcos, colunas, tapetes, adereços, luz colorida) e inimigos que contornam paredes (campo de fluxo)
- [x] Sistema de zonas (estilo Ragnarok): o mundo em áreas ligadas por passagens na borda, com tela de carregamento, só a área do herói desenhada
- [x] Vilas: cada área com a sua (baú compartilhado, loja regional, quests) e Pedras de Teleporte entre as vilas visitadas, por ouro
- [x] Picos Gelados (níveis 20 a 28): neve caindo, lago congelado escorregadio, Vila de Pedra-Fria (Jarl Bjorn, Mercadora Sigrid, Caçadora Eira) com 5 quests, lobos das neves, espectros gélidos, yetis e o Gigante de Gelo com a Armadura do Inverno
- [x] Terras Vulcânicas (níveis 28 a 36): rios de lava que queimam, cinza e brasas no ar, Bastião de Brasa (Comandante Varga, Ferreira Ignis, Batedor Kael) com 5 quests, cães de lava, piromantes, golens de magma e o Senhor das Chamas com a Coroa das Chamas
- [x] Forja Vulcânica: Guarda da Forja, Mestre da Forja e a Forja Ancestral
- [x] Santuário Élfico, a dungeon da Floresta: Sentinela de Elar, Oráculo de Elar e o Véu de Elar
- [x] Dungeons por tema: a Caverna de Gelo (Guardião Glacial, Rainha Gélida e a Regalia da Rainha Gélida), ao lado da Cripta Esquecida
- [x] Floresta Ancestral (níveis 12 a 20): rio, ruínas de Elar, vila do acampamento (Guardiã Lyra, Mascate Faelan, Armeira Kaia) com 5 quests, lobos, entes, espíritos élficos e o Ente Ancião com o conjunto Coração da Floresta
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

3. ~~Sistema de zonas~~, a ~~Floresta Ancestral~~, ~~passagens na borda~~ e ~~vilas com Pedra de
   Teleporte~~: feitos (ver acima). Cada área nova segue a mesma receita: vila (baú, loja regional,
   quests, pedra), inimigos novos, chefe com conjunto e, de preferência, uma dungeon própria. Áreas de
   passagem (só trilha e inimigos, sem vila) também cabem entre duas vilas.
4. **Zonas novas**, cada uma com cara própria, uma vila, uma dungeon e um chefe com conjunto:
   - ~~Picos Gelados (20 a 28)~~: feitos, com a Caverna de Gelo.
   - ~~Terras Vulcânicas (28 a 36)~~: feitas, com a Forja Vulcânica.
   - Próximas ideias: uma área de passagem entre duas vilas, e zonas acima do nível 36 (por exemplo
     um Abismo ou Ilhas Celestes), cada uma com vila, dungeon e chefe com conjunto.
   - ~~Uma dungeon própria da Floresta~~: o Santuário Élfico, feito.
5. ~~Viagem rápida~~: feita como Pedras de Teleporte nas vilas (ver acima).
6. **Mundo vivo.** Eventos no mapa (acampamento goblin que aparece, chefe errante à noite, baú
   amaldiçoado) e clima por bioma (chuva, névoa, tempestade de areia, nevasca).
7. **Mais quests.** Coleta, exploração e escolta, uma linha de história por zona e quests repetíveis
   diárias.

### Fase 3: dungeons maiores e mais elaboradas

8. ~~Dungeon 2.0~~: feita (ver acima). Ficaram para depois: portas trancadas com chave e salas secretas.
9. **Temas de dungeon**, um por zona, cada um com inimigos, armadilhas, chefe e conjunto próprios. A
    máquina de temas existe (`DUNGEON_THEMES`): ~~Caverna de Gelo~~, ~~Santuário Élfico~~ e ~~Forja
    Vulcânica~~ feitos; faltam Mina Abandonada, Templo do Deserto e Covil da Rainha (no vale).
10. **Dungeons de fim de jogo.** Modificadores sorteados (escuridão, inimigos explosivos, sem cura),
    níveis de dificuldade acima do mundo e chaves que caem como loot (como mapas no Path of Exile), com
    recordes locais de tempo.

### Depois

11. **Lock-on.** Travar a câmera num alvo (Zelda) como alternativa ao modo livre.
12. **Áudio com assets.** Trocar a síntese por samples e trilha composta quando houver arte sonora.
13. **Save na nuvem** (quando houver servidor); os slots locais já existem.
14. **Multiplayer.** Servidor rodando o mesmo domínio; cliente só renderiza.
