# Lead Designer Notes — IA

Voz da IA. Opiniões, riscos e sugestões. Status: proposta → aprovada/rejeitada pelo CD.

## 2026-07-05 — Proposta: sobrevivência por habilidade (SPEC-0010, pré-V1)

O CD pediu "formas de viver mais" antes do go-live da V1. Transformei o pedido numa spec (`SPEC-0010`) com três peças de um mesmo eixo — *jogar bem = viver mais* — e três tasks (T-033..T-035, fase F2.5). Registro aqui o racional de design e o que estou de olho, porque isto mexe direto com os pilares 3 (risco real) e 4 (anti-snowball).

**A ideia central que defendo — kill contextual.** O abate paga conforme a *temperatura da briga*: duelo isolado → XP (progressão); cercado → cura % da vida **faltante** (sobrevivência). Isso não é enfeite: é o que impede a cura de virar bola de neve. Num 1v1 o dominante **não** se sustenta de graça (ganha XP, não vida), então o loop "mato→curo→mato" contra alvos isolados nunca abre. E curar da *faltante* faz o recurso ir para quem estava por um fio, não para quem já domina — recompensa proporcional ao risco corrido. É a mesma filosofia da aura (oportunidade ganha por mecânica), só que determinística e sem tocar no sistema de aura (que fica Pós-V1).

**Escassez como design, não como limitação.** `hp_orb` (poucos, longe de todos e uns dos outros) e `shield_temp` (máx. 2) forçam **deslocamento** e exposição — você tem que sair da toca para se curar. Reusa o espaçamento que o spawner já faz, só com distâncias próprias e teto por kind, num passe dedicado (não polui o orçamento/pesos do coletável comum).

**Riscos que estou vigiando (medir antes de mexer):**
1. *Aglomerado curador* — brigas grandes premiando quem mata pode incentivar teamfight eterno. Mitigado por "cura da faltante" + mapa grande; confirmar com métrica `kill_heal`.
2. *Proxy de "briga"* — usei proximidade de inimigos vivos no abate (barato, imediato). Alternativa: "tomou dano de N fontes nos últimos Xs". Se soar errado jogando, troco o proxy sem mudar a interface.
3. *Confusão escudo × invulnerabilidade de nascimento* — mantidos como caminhos distintos no servidor: nascimento **bloqueia** (dano 0), escudo **reduz**. Eventos de debug separados.
4. *Calibração é sensação* — os 4 tunables-chave (`KILL_HEAL_MISSING_FRAC_BASE`, `COMBAT_THREAT_RADIUS`, `HP_ORB_AMOUNT`, `SHIELD_TEMP_DAMAGE_MULT`) só o CD fecha jogando; entrego com defaults e marco pendente de veredito, como fiz com VFX/progressão.

**O que deliberadamente deixei de fora** (para não nascer meio-pronto): regen passiva parado (contraria jogo ativo), cura por `box`/armadura/crítico/lifesteal-por-dano, escudo como skill de build, e qualquer amarra com aura ou persistência entre rounds. *Status: proposta — aguardando veredito do CD na SPEC-0010 (especialmente os 4 tunables).*

## 2026-07-04 — Feedback de arquitetura (pedido no PROMPT-0003)

**Saudável.** O pivô Bomberman → campo aberto custa UMA função (`buildMap`) porque colisão, rede, seed sync e bots são camadas independentes — é exatamente o teste que uma boa arquitetura deve passar. O EffectSystem absorveu speed_up sem tocar o Room e vai absorver dano/atributos igual; o shared já evitou drift 3 vezes (cliente, servidor e bots reconstroem o mesmo mapa de 3 números).

**Dívidas a vigiar (nenhuma urgente):**
1. Cliente itera o estado inteiro por frame — ok até ~200 entidades; projéteis (T-005) vão pressionar. Se pesar: callbacks tipados do Colyseus ou interest management. Medir antes de otimizar.
2. `main.ts` do cliente crescendo — separar `net.ts`/`hud.ts` quando o combate entrar (na T-005, não antes).
3. Zero testes unitários — a curva de XP (T-003) é onde eles passam a valer a pena (balance depende dela).
4. Tensão de design: box "reset MU" (meta-progressão) vs constituição (progressão por round). Decisão do CD antes da T-004 — recomendo round-only agora.
5. Sandbox de teste: processos fantasmas seguram portas; testes sempre em PORT alternativa (aprendido na prática).

**Opinião sobre o rumo:** lançadores data-driven é a decisão mais importante desta sessão — transforma "adicionar arma" de tarefa de engenharia em tarefa de design. Com F3 debug (T-007) cedo, cada task seguinte fica mais barata de validar. Sugiro executar T-007 logo após T-001 se sentir o desenvolvimento "às cegas".

## 2026-07-04

**Risco 1 — Snowball em partidas de 2–3 min.** Quem abre vantagem cedo tende a fechar o round sozinho. Sugestões: upgrades dentro do round expiram no fim; veteranos vivos há muito tempo ficam visíveis no minimapa ("caça ao rei"); força necessária para matá-los cresce, mas a recompensa também. *Status: proposta (decidir no M1).*

**Risco 2 — Nível zerar pode expulsar jogador casual.** Perder tudo é tenso e bom, mas zerar com frequência mata retenção. Sugestão: piso de proteção nos 3 primeiros níveis, e perda proporcional (ex.: -30% do progresso) acima disso. *Status: proposta (decidir no M1).*

**Opinião — Aura.** Concordo com o modelo aprovado (ADR-005): aura ganha por mecânica, gasta em oportunidade. Alerta: medir "mecânica pronta" precisa de métricas objetivas (esquiva no último instante, precisão, streak sem dano) — já previsto em observabilidade. Sem isso vira sensação, não sistema.

**Opinião — Predição de movimento.** Em M0 usei interpolação simples (cliente segue o estado do servidor com lerp). Com ping < 80ms fica bom. Predição client-side completa só quando houver combate — implementar antes é custo sem retorno. *Status: decidido tacitamente, reavaliar no M1.*

**Sugestão — Guardian único (não vários NPCs).** Um só NPC de elite que entra quando falta gente: vira treino, desafio, coop e evento com um único cérebro para manter. *Status: aprovado na concepção, implementar no M3.*

**Alerta técnico — 45s/2–3min de partida exige tudo instantâneo.** Loading > 5s destrói o loop "mais um round". Manter bundle pequeno é requisito de design, não só técnico.

## 2026-07-04 — Interpretação técnica das decisões de T-004/T-006 (escopo delimitado)

O pedido do CD é maior que uma task — vou implementar a fatia buildável agora e registrar o resto como proposta para os marcos certos, em vez de meio-construir tudo.

**Meta-progressão entre rooms (box):** tensiona direto com a constituição ("progressão por round") e com a recomendação anterior da IA em `progression.md` ("persistência só cosmética/rank, nunca poder"). CD decidiu por cima disso — registrado, é decisão dele. Escopo que vou construir agora: `PersistentProgress` por `playerToken` (id gerado no cliente, guardado em localStorage, enviado no join) acumulando pontos de atributo entre partidas; visível SÓ com `DEV_MODE` ligado (painel debug, integra com o overlay F3 do T-007). **Não vou** ligar isso ao poder real dentro do round nem ao balanceamento multi-sala (ADR-007/matchmaking) — isso exige o sistema de salas/matchmaking do M3, que não existe ainda. Fica a peça pronta para "acionar" quando M3 chegar (ADR-012).

**Coins:** CD não especificou o quê. Proposta da IA (implementada): coins compram **reroll** da distribuição automática de atributos do último nível (ver T-003 auto-distribuição). Justificativa: reusa o sistema já existente (sem UI de loja nova), é testável por bot (gasta ao acumular um limiar), e é o precursor natural da "escolha manual" (v2) já prevista em growth.md.

**Perda de nível / crítico / armadura / aura-sobrevivência:** vou implementar a curva de perda escalando com nível (piso baixo nos níveis iniciais, perda cresce com o nível) + toggle de reset total (por room, com default global). **Não vou** implementar armadura, crítico ou "aura decide sobrevivência" agora — são sistemas de combate/aura que dependem do M2 (Aura, ADR-005) e de combate já rodando de verdade (T-005/T-006 é o próprio combate nascendo). Registrado como proposta para quando Aura entrar em pauta, para não nascerem meio-prontos.

## 2026-07-05 — Execução agêntica sequencial da V1 (T-019 em diante)

**Modo de trabalho desta leva:** o CD pediu execução autônoma pelo BACKLOG (T-019..T-032) sem pausar para aprovação a cada task, perguntando só em bloqueio genuíno. Vou seguir a ordem da SPEC-0006/BACKLOG, manter o processo do AGENTS.md (spec → implementar → testar com bots/gates → DEVLOG/PROMPT → commit) a cada task, e só levantar uma pergunta ao CD quando a decisão for dele por natureza (gosto/sensação de jogo, trade-off de produto) — não quando for uma decisão técnica que a documentação já resolve.

**Risco registrado — verificação de UI sem veredito humano.** O ambiente de preview headless desta sessão não tem GPU (screenshot do canvas WebGL trava). Para não bloquear a esteira, estou validando a lógica de cada perfil/feature client-side isolando as classes via import dinâmico no browser (`preview_eval`) — prova que o código funciona, mas **não substitui** o julgamento de "está gostoso de jogar?" (crosshair 360° do perfil mouse, por exemplo). Critérios de aceite que dependem de sensação ficam marcados como pendentes de veredito humano no `SESSAO_ATUAL.md`, mesmo com a task tecnicamente concluída — não vou marcar esses critérios como ✅ sozinho.

## 2026-07-06 — Bandeira (recorrência do risco de verificação visual) + reversão do pilar "sem sorteio" dos cards

**Bandeira:** confirmei `document.hidden === true` e `requestAnimationFrame` nunca disparando no preview desta sessão (o loop `animate()` do `main.ts` simplesmente não roda em página oculta) — é a MESMA limitação registrada em 2026-07-05, agora com diagnóstico exato em vez de suposição. Não é bug de jogo; é o ambiente de preview que não sustenta um loop de render de página "invisível" ao compositor. Fiz o que dava pra fazer sem pixel: revisei o código (`updateFlagGround` em `visuals.ts` já cobre os 3 estados corretamente) e adicionei uma linha de texto no F3 (`bandeira: livre/carregada/cooldown`) — isso pelo menos dá um caminho de verificação que não depende de WebGL renderizar, pro CD (ou uma sessão futura com browser de verdade) confirmar rápido.

**Cards de level-up — reversão de princípio.** T-016 registrou explicitamente "DETERMINÍSTICOS por nível (nunca sorteio): quem conhece a tabela planeja a build (pilar habilidade > sorte)". O CD pediu o oposto hoje: mais variedade e sorteio, achando repetitivo. Implementei como pedido (pool 6→12, oferta de 3 sorteada por level-up, sem repetir cards na mesma oferta) — mas registro a tensão: **oferta aleatória não é o mesmo que build aleatória**. A escolha entre os 3 continua 100% do jogador; o que virou sorte é SÓ o menu disponível a cada level-up, igual "loot pool" de cards de roguelike (Slay the Spire/Hades), não RNG de poder. Ajustei também os `preferredCardIds` dos perfis de bot (T-008b) pra incluir os cards novos como fallback, senão a build "concentrada" dos perfis ficaria mais diluída com um pool maior e aleatório.
