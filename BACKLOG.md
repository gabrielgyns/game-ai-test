# Backlog

Itens técnicos e de qualidade que não são marcos de jogo (esses ficam no [ROADMAP](ROADMAP.md)). Cada
item diz o problema, a proposta e como saber que funcionou. Ao fazer um item, marque `[x]`, anote a
data e registre o resultado em `docs/ai/historico.md`.

## Desempenho

Medição de referência (out/2026, Chromium headless com renderização por software, campina perto do
santuário). O tempo de CPU vale; o de GPU não dá para medir aqui.

| Parte | Custo por quadro | Leitura |
| --- | --- | --- |
| Simulação (combate, IA, quests) | 0,13 ms | desprezível |
| Minimapa | 0,22 ms | desprezível |
| Cenário (LOD) e grama | 0,07 ms | desprezível |
| Triângulos | ~1,07 milhão | alto |
| Draw calls | ~608 | alto |
| Objetos na cena | ~2.400 (1.766 malhas) | alto |
| Memória JS | ~286 MB | dá para baixar |

Conclusão: a lógica usa menos de 1 ms dos 16 ms de um quadro a 60 FPS. O gargalo é a GPU (bloom em
tela cheia, sombra de 2048 px que redesenha o mapa, ~1M de triângulos) e o número de draw calls.

Ordem sugerida: 1 e 2 primeiro (maior ganho, menor risco); o contador do item 2 diz se 3 a 5 ainda
valem a pena.

1. [ ] **Presets de qualidade (Baixo / Médio / Alto) no menu.**
   O preset controla a resolução da tela (`pixelRatio`), o bloom (ligado, em meia resolução ou
   desligado), o tamanho do mapa de sombra, a densidade da grama e as distâncias do LOD (`LOD_HI`,
   `LOD_MID`). O preset Alto é o jogo de hoje. A escolha fica salva em `localStorage`, como o tremor de
   câmera.
   *Pronto quando:* o Baixo cortar ao menos metade dos triângulos e dos pixels desenhados, sem
   mudar nada no domínio.
2. [ ] **Contador de FPS (tecla F3).**
   Mostra FPS, tempo por quadro, triângulos e draw calls (com `info.autoReset` desligado; ver
   `docs/ai/licoes.md`). Serve para o dono medir na máquina dele e passar números reais.
   *Pronto quando:* aparecer e sumir com F3 sem custo perceptível ligado.
3. [ ] **Sombra mais barata.**
   Refazer o mapa de sombra só quando o herói andar ou o sol mudar (`shadowMap.autoUpdate = false`
   com `needsUpdate` sob demanda). Tirar `castShadow` de inimigos e NPCs além de ~30 m.
   *Pronto quando:* a passada de sombra rodar em menos da metade dos quadros, sem sombras "pulando".
4. [ ] **Menos draw calls nos personagens.**
   Juntar numa malha só as peças que não se mexem (tronco, cabeça, acessórios) e esconder modelos além
   da neblina (inimigos parados longe).
   *Pronto quando:* tirar 200 a 300 chamadas na campina, com as animações iguais no lab.
5. [ ] **Memória.**
   Soltar os dados de montagem (VoxelBuilder) depois que viram geometria, compactar as listas de
   posição da grama em `Float32Array`, conferir geometrias duplicadas (`renderer.info.memory`).
   *Pronto quando:* a memória JS cair para menos de 200 MB na mesma cena.

## Jogabilidade (técnico)

6. [ ] **Pathfinding na cripta.**
   Hoje os inimigos andam em linha reta até o herói e deslizam nas paredes, e podem ficar presos numa
   quina. Proposta: A* na grade da planta (`dungeonLayout`), com o caminho recalculado a cada ~0,5 s ou
   quando o herói muda de célula, e linha reta quando há visão direta. Pré-requisito da Dungeon 2.0.
   *Pronto quando:* um teste de domínio mostrar um esqueleto contornando um pilar e um corredor em L até
   alcançar o herói, sem custo perceptível com 30 inimigos acordados.

## Não priorizados

Ideias registradas para não se perderem. O dono disse que não são prioridade agora.

- **Acessibilidade.** Modo para daltônicos (as cores de nível usam verde contra vermelho) e tamanho de
  fonte ajustável.
- **Controle (gamepad).** Mover, mirar e habilidades pela Gamepad API.

