# docs/ai — memória do projeto para humanos e IAs

Esta pasta guarda o contexto que não cabe no código: a visão do jogo, as decisões e o porquê delas,
o histórico do que foi construído, o que o dono do projeto pediu e como gosta de trabalhar, e as
lições aprendidas. **Qualquer IA (ou pessoa) que for mexer no projeto deve ler isto antes.**

| Arquivo | O que tem |
| --- | --- |
| [visao.md](visao.md) | O que o jogo quer ser, referências, público (o próprio dono) e preferências dele |
| [arquitetura.md](arquitetura.md) | Como o código é organizado, convenções e invariantes que não podem quebrar |
| [decisoes.md](decisoes.md) | Registro de decisões com motivo e alternativas descartadas |
| [historico.md](historico.md) | Cronologia dos marcos, pedidos do dono e bugs corrigidos |
| [licoes.md](licoes.md) | Insights e armadilhas descobertas no caminho |
| [fluxo-de-trabalho.md](fluxo-de-trabalho.md) | Como desenvolver, verificar, commitar e entregar neste projeto |
| [../../ROADMAP.md](../../ROADMAP.md) | O que já foi feito e os próximos marcos |

Regra de manutenção: ao fechar um marco, atualize `historico.md` e o `ROADMAP.md`; ao tomar uma decisão
estrutural, registre em `decisoes.md`; ao descobrir uma armadilha, anote em `licoes.md`.
