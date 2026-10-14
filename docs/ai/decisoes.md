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
