# Creative Director Notes — Daniel

Voz do Daniel. A IA registra aqui, mas o conteúdo é decisão dele.

## 2026-07-04 — Concepção
- Jogo simples, 3D, bonecos pequenos genéricos, câmera de cima, campo limitado estilo Bomberman.
- Objetivo: acertar/derrotar com diferentes "armas". Nível sobe e desce; morrer derruba nível, podendo zerar.
- Sessões de sala por nível; sem sala do seu nível, joga com níveis abaixo. Partida alvo: 2–3 min.
- Multiplataforma via web, leve sempre, com controle de ping visível.
- Desenvolvimento em modo debug: mecânica primeiro, arte depois. Bots inteligentes para testar.
- Sistema de aura: quem tem aura precisa de mais mecânica para merecer drops melhores. "Famar" aura para players com mecânica pronta.
- Atributos vantajosos só aparecem longe de jogadores; servidor monitora densidade do mapa.
- Matchmaking como IA de gerenciamento (monitorar quantidade, níveis, decidir abrir/fechar/juntar salas, sortear drops).
- Produção simples e testável via VPS bem localizadas, sem deploy complexo.
- Quer agente que analise tendências atuais e turbine mecânica/gamificação.
- Métricas: entender a sessão de cada jogador + visão coletiva.
- Se der certo, vira portfólio.
- Papel: Creative Director. A IA propõe/argumenta/registra; Daniel decide.

## 2026-07-04 — Decisões que desbloqueiam T-004/T-006

**Box "reset de MU":** quer permanência real durante a "sessão de vida" do jogador — ao trocar de sala/round, atributos (força etc.) podem se manter ou avançar, dentro de limites medidos, com balanceamento pensado para servidor grande (várias rooms, população escalando). Quer poder ver cada ponto de atributo acumulado, mas isso só aparece no **modo desenvolvimento** por enquanto — é peça de infraestrutura que contribui com a sessão e fica pronta para ser "acionada" (ligada de verdade na gameplay) depois.

**Coins:** devem comprar algo já nesta task (não só acumular).

**Perda de nível na morte:** nível baixo perde pouco atributo ao morrer; nível muito avançado tem perda muito maior (escala com o nível, não é fixo). Quer também o conceito de "crítico" e camadas de defesa — vida/atributo primeiro (simples), depois armadura, depois aura determinando chance de sobreviver — mantendo o jogo dinâmico. Reset total deve existir, mas como **opção ativável** (por room e/ou modo global), não comportamento único.

**Registrado por:** IA, ver interpretação técnica e limites de escopo em `docs/LEAD_DESIGNER_NOTES.md` (mesma data) e ADR-012.

## 2026-07-05 — Primeiro teste manual da V1 (perfis de controle + bots + bandeira)

**Perfil keyboard:** movimentação absoluta (WASD estilo strafe) com setas girando ficou complicada — quer **tank controls**: W/S andam/recuam baseado na rotação do jogador.

**Bots devem simular players:** *"ataca, vai pra cima, às vezes corre, às vezes volta a atacar; quando se sentir encurralado, para de correr e volta a atacar"*. Rejeitado: fuga infinita com vida baixa, esfregar na borda do mapa sem atirar, todos com o mesmo comportamento. Quer **comportamentos específicos por bot** + uma **dosagem** dessas características para cada bot iniciado.

**Bandeira:** não quer todos os bots focando o portador — quer **conflitos entre si**, com o portador como um alvo possível; os bots devem "**compartilhar**" os alvos para dividir bem a jogatina. Disputar tem que incluir atirar (perseguição sem tiro rejeitada). Regra de retorno: caída e não disputada em **5 segundos**, volta ao centro.

**Sessões de teste:** precisa conseguir iniciar ~10 bots juntos na mesma partida (`npm run bots`), cada um com perfil sorteado diferente.

**Registrado por:** IA — implementação e interpretação técnica em `docs/prompts/PROMPT-0032.md`; veredito final: aprovado ("está melhor agora").

## 2026-07-05 — Feedback de jogo: progressão de skill/atributo + menu travando na morte

**Skill demorando demais:** *"conforme a pessoa vai ganhando nível é muito difícil aparecer uma escolha de skill, às vezes demora até o nível 11"*. Quer que em alguns momentos apareça **2 opções de atributo e 1 opção de skill** (inverso do que existia).

**Atributo fraco por escolha:** quer aumento maior nos cards de atributo — *"em vez de por ex +3 já dá +6"*.

**Bug reportado depois:** o menu de escolha de level-up fica aberto na tela mesmo depois do jogador morrer, mesmo não servindo mais pra nada — quer que feche.

**Registrado por:** IA — implementação e interpretação técnica em `docs/prompts/PROMPT-0033.md`.

## 2026-07-06 — Três correções antes de continuar o backlog

**Bandeira parada no mapa:** deve ter estado de enable/disable conforme alguém pegar, estar em cooldown, ou estar "pegável". *(Já implementado desde T-041/T-042 — livre = acesa pulsante, carregada = apagada, cooldown = some do mapa. IA confirmou por código + eventos de servidor (T-046) e adicionou linha de estado no F3 pra dar veredito textual; verificação visual em pixel segue bloqueada — ambiente de preview sem GPU para WebGL, mesmo risco já registrado em `LEAD_DESIGNER_NOTES.md` 2026-07-05.)*

**Verificar se a SPEC-0010 está funcional:** pediu checagem + teste. *(Confirmado funcional: smoke ao vivo com 8 bots — `kill_heal`/`kill_duel_bonus` com a matemática exata da spec, `hp_orb`/`shield_temp` respeitando teto e janela de respawn; redução de dano do escudo já coberta por teste unitário dedicado.)*

**Cards de level-up repetitivos:** quer mais variações de atributo e sorteio, "para não ficar sempre repetitivo". *(Reverte a decisão de T-016/SPEC-0004 — "determinístico, nunca sorteio" — registrada como pilar habilidade>sorte. IA implementou o pedido (pool de 6→12 cards, oferta sorteada a cada level-up) e registrou a tensão com a decisão anterior em `LEAD_DESIGNER_NOTES.md`, mas seguiu a instrução explícita do CD.)*

**Registrado por:** IA — implementação e interpretação técnica em `docs/prompts/PROMPT-0041.md`.

**Veredito (mesmo dia, via chat):** "estou de acordo com tudo" — aprovado sem ressalvas, inclusive os 2 pontos que ficaram pendentes de teste em browser (bandeira visual, sensação dos cards sorteados). Não foi um teste jogado no browser (ambiente sem isso ainda) — é aprovação pela implementação/explicação descrita. Libera a esteira para prosseguir ao F4.

## 2026-07-08 — Teste manual do Battle Royale relâmpago (T-066): 3 problemas de reação à zona

**Player longe não tem chance:** ao testar o evento de verdade, percebeu que quem está distante quando o evento começa não consegue chegar dentro do círculo a tempo — hoje só existe dano crescente esperando por quem está fora, nada que ajude a voltar.

**Tamanho do círculo parecia pequeno/inconsistente:** perguntou como o raio é calculado (não é fixo — vem da densidade de players + folga, com teto). Achou que deveria ser um pouco maior.

**Tempo entre aviso e início do encolhimento curto demais** para reagir.

**Pedido concreto:** quem estiver longe do círculo no momento em que o evento é "avisado" deve ganhar uma habilidade de velocidade só pra chegar dentro dele; ao entrar no círculo, a habilidade desativa e não pode ser reativada (nesta rodada do evento) — mas continua podendo pegar o `speed_up` normal do chão, que é outra coisa.

**Decisões fechadas via pergunta direta na sessão:** boost **automático** (não um botão que o jogador aciona); novo teto de raio **~30 tiles** (era 20, `BR_ZONE_RADIUS_MIN=6` intocado); warning de aviso **8s** (era 5s).

**Registrado por:** IA — implementação e interpretação técnica em `docs/BACKLOG.md` (T-074) e `docs/DEVLOG.md` (Sessão 55).

**Veredito (mesmo dia, via chat):** testou o Battle Royale de verdade e confirmou "tudo funcionou corretamente" — aprovado. Pediu só mais um ajuste: subir o teto do raio de ~30 para `BR_ZONE_RADIUS_MAX=50`.
