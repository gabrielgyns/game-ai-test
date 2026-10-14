# Registro de decisões

Formato: contexto → decisão → motivo → alternativas descartadas.

## D1. Three.js + TypeScript no navegador, não uma engine
Dono prefere TypeScript e quer codar junto no repositório. Godot/Unity dariam editor e física
prontos, mas tirariam o fluxo de "IA edita o repo, dono joga". Decisão: Three.js + Vite.

## D2. RPG single-player com domínio isolado, não MMORPG
Jogar sozinho torna servidor e rede desperdício agora. O domínio sem Three.js/DOM mantém a porta
aberta para multiplayer depois sem reescrever regras.

## D3. Simulação em passo fixo (60 Hz) com eventos
Combate previsível e testável; a apresentação consome eventos para animações, textos e sons.
Alternativa descartada: apresentação lendo o estado e inferindo mudanças (frágil).

## D4. Estilo voxel por geração procedural de cubos, não arquivos .vox
Sem assets disponíveis e sem artista; modelos por código ficam versionados e fáceis de variar
(equipamento visível no herói é só outra combinação de caixas). Arquivos .vox ficam como opção futura.

## D5. Greedy meshing no VoxelBuilder
Copas de árvore em voxel estouravam o número de triângulos (678k na cena). Fundir faces coplanares
da mesma cor reduziu para 245k. Winding por produto vetorial, não por tabela manual (a tabela
manual errou e o teste pegou).

## D6. Terreno em blocos compartilhado entre domínio e malha
Uma única `terrainHeight` quantizada. Garante que o que se vê é onde se pisa. A altura visual das
entidades é suavizada na apresentação para subir degraus parecer passo.

## D7. Corpo do herói segue a câmera (estilo MMO)
Pedido do dono: andar de ré com S mantendo o inimigo à frente. `movement.faceYaw` desacopla a
direção do corpo da direção do movimento.

## D8. Espaço é esquiva; ataque é clique ou E
Com habilidades e rolamento, o Espaço virou a esquiva (Zelda). Mudança de controle comunicada ao dono.

## D9. Golpes telegrafados com conferência de alcance no fim
Antes os inimigos acertavam na hora e a esquiva era só reflexo. Com aviso + conferência tardia,
sair da área ou rolar evita o golpe de verdade. Chefes alternam padrões (melee, área, investida).

## D10. Brilho de raridade por bloom seletivo + aura em casca
Emissivo forte sozinho deixou a armadura chapada. A solução que mantém a cor do item: casca da
mesma geometria, 9% maior, aditiva, acima do limiar do bloom; emissivo só como tingido leve.
O dono pediu "LEVE" e "neon": é um bloom com força 0,45 e limiar 1,0.

## D11. Poções empilhadas e o Q "esperto"
Consumíveis do mesmo nome empilham até 10. O atalho bebe a menor poção que cobre a vida faltante,
senão a maior, para não desperdiçar.

## D12. NPCs como terceiro tipo de entidade e regra explícita de hostilidade
`isHostile` substituiu "kind diferente do meu", que faria o Pisão do chefe acertar NPCs.

## D13. Save regenera o mundo pela seed
Arquivo pequeno e imune a mudanças no mapa. Efeito: ao carregar, inimigos e chefe estão vivos de
novo. Aceito como "o mundo descansou junto". Versão no formato para migrar no futuro.

## D14. Áudio 100% sintetizado
Sem arquivos de som disponíveis e sem licenças a gerenciar. Combina com o voxel. Trocar por
samples é um marco futuro no roadmap.

## D15. Lock-on adiado
Explicado ao dono (lanterna vs. holofote); ele preferiu seguir com conteúdo. Fica no roadmap.

## D16. Personagens em 16 voxels/m, com AO e grão cozidos nos vértices
Dobrar a resolução (de 8 para 16 por metro) e cozinhar oclusão ambiente e grão nas cores dos
vértices foi o que mais aproximou o visual de Minecraft Dungeons sem sair do voxel. Alternativas
descartadas: trocar para low-poly (eu modelo às cegas, rostos ficariam ruins) e assets glTF
(perderia a identidade e a dependência de arte externa). Custo aceito: ~2,5× mais triângulos por
personagem; mitigado com manchas de grão de 2 voxels nos mobs.

## D17. Rig humanoide com membros em pivôs
Pernas, braços e cabeça são malhas separadas com pivô na articulação. O ciclo de caminhada e as
poses (aviso, golpe, giro) ficam na view, sem esqueleto nem animações gravadas. Simples, barato e
suficiente para o estilo.

## D18. Lab de modelos reaproveita as views do jogo
`/lab.html` cria um `World` com uma entidade e passa pelo `EntityViews` de verdade, em vez de
duplicar a animação. O que se vê no lab é o que se vê no jogo. A versão anterior dos modelos fica
congelada em `src/lab/legacyModels.ts` só para comparação.

## D19. Trabalho visual em branch separada (`design/lab`)
A pedido do dono: mudanças de design ficam em `design/lab` até ele aprovar, e só então vão para a
`main`. Os marcos de gameplay continuam indo direto para a `main`.

## D20. Slots de save com porta chave-valor e recarga ao trocar
`SaveSlots` (domínio) recebe um `KeyValueStore` em vez de tocar no `localStorage`: os testes usam um
Map e o jogo usa o navegador, com queda para memória se o armazenamento estiver bloqueado. Trocar de
slot ou criar um herói recarrega a página com o pedido na `sessionStorage`, como a escolha de classe
já fazia; refazer o `main.ts` para trocar o mundo em memória custaria mais do que um recarregamento
de meio segundo. O pedido de novo jogo só some quando o jogo começa (o primeiro save ocupa o slot).
O nome do herói é opcional no `SaveData`, então a versão do save não mudou.

## D21. Ciclo de dia no domínio, efeitos na apresentação
O relógio (`dayCycle.ts`) é uma função pura de `world.time`: testável, salvo de graça e pronto para
regras futuras (inimigos noturnos). Céu, luz, partículas, tremor e grama são só apresentação. A
grama usa instâncias em blocos com LOD por "primeiras N instâncias de uma lista embaralhada" em vez
de geometrias de LOD separadas: zero memória extra e nenhuma troca visível.
O hit-stop congela a simulação (o acumulador do passo fixo não recebe tempo), não só a animação;
é single-player, então pausar o mundo por 50 ms é seguro e dá mais peso ao golpe.

## D22. Tipo de dano em vez de exceções por chefe
`applyDamage` recebe `basic | skill | hazard`. A Carapaça de Areia só olha o tipo, então qualquer
habilidade nova que cause dano já "sabe" quebrar escudos, e poças não geram "Esquivou!" a cada pulso.
Projéteis carregam `fromSkill`. Alternativa descartada: uma lista de habilidades que quebram escudo,
que precisaria ser lembrada a cada habilidade nova.

## D23. Tiros de inimigo sem ajuda de mira
A ajuda de mira (cone de 22°) é só do jogador. Se o tiro do inimigo se corrigisse no disparo, a linha
avisada mentiria e sair dela de lado não adiantaria.

## D24. Afixos separados dos atributos base
O item guarda `stats` (do modelo) e `affixes` (sorteados) separados; `itemBonus` soma os dois. Assim
o tooltip mostra o que é "do modelo" e o que é "sorte", a comparação cobre todos os bônus, e um afixo
novo é só uma entrada em `AFFIXES` com o atributo que ele alimenta. Bônus que não são vida/dano/
velocidade vivem em `entity.bonuses`, recalculado junto com o resto em `recomputeStats`.

## D25. Estoque da loja amarrado ao relógio
O estoque muda à meia-noite do relógio do mundo (dia do `dayCycle`) e é semeado por dia e nível, então
é o mesmo se você recarregar no mesmo dia. Ele é salvo (com o que já foi comprado) para não dar para
comprar o mesmo item duas vezes recarregando.

## D26. Talentos sobre primitivas de status
Os 24 talentos não têm regra própria espalhada pelos sistemas: eles pedem atordoar, lentidão,
vulnerabilidade, buff, cura, escudo, explosão em área ou poça. A IA respeita o atordoado, o
movimento respeita o lento e `applyDamage` respeita vulnerável e Pele de Ferro. Um talento novo
costuma ser uma linha em `useSkill`. Chefes resistem (metade do tempo) para os talentos não
anularem as lutas.

## D27. Escudo termina no sistema de habilidades
`applyDamage` só zera o escudo; quem encerra (e dispara o talento Retorno) é o `abilitySystem`, no
passo seguinte. Assim combate não importa habilidades (evita ciclo de import) e o fim do escudo tem
um lugar só, seja por tempo ou por dano.

## D28. Dungeon no mesmo World, numa região distante
A alternativa (um `World` por dungeon) exigiria refazer o boot: views, UI e sistemas nascem amarrados
a um mundo só. Em vez disso, a cripta é gerada em x ≥ 1000 e apagada ao sair, como um set de
filmagem nos fundos do estúdio. `terrainHeight` devolve chão plano ali e as paredes vêm da planta via
`isWalkable`. O vale continua simulando longe (ninguém de lá chega a 1 km). O save nunca guarda a
cripta: dentro dela, o herói é salvo na porta.

## D29. Recorte de paredes no shader
Com paredes, a câmera de terceira pessoa fica atrás delas. Em vez de mover a câmera (que brigaria com
o mouse), o shader das paredes descarta pixels num funil entre a câmera e o herói, e a câmera da
cripta tem inclinação mínima maior. Barato, sem física de câmera, e o herói nunca some atrás de tijolo.

## D30. Cenário esculpido, com 12 voxels por metro
Os personagens usam 16 voxels/m, mas uma árvore de 5 m nessa escala passa de 50 mil triângulos. Com
12 voxels/m um carvalho fica entre 20 e 25 mil, e de perto a diferença para 16 quase não se vê. Em vez
de caixas empilhadas, o cenário é esculpido com formas (cápsulas, bolhas com ruído, demãos de musgo),
o que dá galhos curvos e copas irregulares com pouco código por modelo.

## D31. LOD por redução da própria grade
Os níveis médio e longe saem de `downsample` do mesmo modelo (blocos 2×2×2 e 4×4×4), sem desenhar
nada à parte: qualquer modelo novo, inclusive um `.vox`, ganha LOD de graça. A sombra usa uma redução
mais "magra" (só blocos bem cheios), que fica por dentro do modelo e não sombreia a própria superfície;
o projetor é desenhado na tela sem escrever cor nem profundidade, porque o Three testa as camadas da
câmera principal também na passada de sombra.

## D32. `.vox` substitui por id, sem manifesto
`import.meta.glob("/assets/vox/*.vox")` lista os arquivos na hora do build: basta salvar o arquivo com
o id do modelo, sem registrar nada. O carregamento é um `await` no topo do `main.ts`, antes de criar o
cenário, então não há troca visível depois do boot. Eixos: o editor é Z para cima com a vista Front
em -Y; o jogo é Y para cima com a frente em -Z, então (x, y, z) do editor vira (-x, z, y).

## D33. Conjuntos: atributo com 2 peças, poder com 3, um conjunto por chefe
O herói tem só três espaços, então cada conjunto tem três peças. O bônus de 2 peças é um atributo
comum (entra na mesma soma dos afixos); o de 3 é um poder com efeito no combate, lido por nome em
`combat.ts` (os números ficam em `SET_POWERS`). Cada chefe guarda um conjunto e derruba a peça que
falta, para que o farm de chefe tenha um fim visível. As peças são épicas por baixo (brilho, preço,
regras de loot) e só a apresentação as pinta de verde-água, sem uma raridade nova no domínio.

## D34. Dificuldade do mundo reescala a partir da nascença; loot pelo nível de quem derrubou
Cada inimigo guarda os números com que nasceu (`tierBase`) e a era aplica um bônus de nível sobre eles,
então trocar de era é idempotente e reversível, sem recriar o mundo. O poder do item vem do nível da
criatura que o derrubou (não da era nem do herói): uma regra só serve vale, cripta, chefes e conjuntos.
Só números absolutos crescem; porcentagens (crítico, roubo de vida, recarga) ficam, senão estourariam.
O baú é compartilhado entre os slots e mora fora do save (`vale.stash`), como no Diablo.

## D35. Caminho por campo de fluxo, não A* por inimigo
Todos os inimigos da cripta perseguem o mesmo alvo (o herói), então um único mapa de distâncias a
partir dele serve a todos: Dijkstra na grade, refeito quando o herói muda de célula (~16k células).
Cada inimigo só olha os vizinhos e mira a célula mais distante do caminho que ainda vê em linha reta.
Com caminho livre (ou no vale) continua em linha reta. Volta para casa segue deslizando nas paredes
(raro: o leash é longo).

## D36. Cripta desenhada como poucas malhas grandes
Instanciar um bloco por célula desenha as faces internas de cada parede. A cripta 2.0 constrói a "pele"
das paredes (só as duas camadas de voxel que dão para o chão), o topo, arcos e pilares num único
`VoxelBuilder` por andar, e o piso noutro: o greedy meshing funde o que é igual e o recorte de paredes
continua no shader. Custa ~0,9 s ao entrar ou descer, em troca de relevo nos blocos sem pesar no quadro.

## D37. Zonas como regiões do mesmo World
Como a cripta (D28), cada zona é um quadrado próprio no plano (Vale em 0,0; Floresta em 0,−420). As
funções do terreno, a água, o bioma e o limite de movimento perguntam `zoneAt(x, z)`. Assim simulação,
save (a posição já diz a zona), respawn e IA continuam iguais, e todas as zonas existem ao mesmo tempo
(poucos inimigos por zona: custo pequeno). A apresentação monta o desenho de uma zona na primeira
visita e só mostra a zona do herói. Viajar é um portão com F, como um warp do Ragnarok.

