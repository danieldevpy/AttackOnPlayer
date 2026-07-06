# SPEC-0011 — Feedback de gameplay #2: ameaça por poder, arsenal, bandeira viva e feedback de coleta

**Status:** aprovada · **Marco:** V1 · **Data:** 2026-07-05

## Problema / objetivo

Segundo lote de feedback do CD jogando com bots (o primeiro virou a Sessão 12/13). Quatro dores:
(1) ficar forte deixa o jogo **mais fácil**, não mais perigoso — bots quase não atacam um alvo forte parado;
(2) combate monótono com um projétil só, e o projétil atual **não passa por vãos diagonais**;
(3) bandeira com leitura fraca (não se sabe de longe se está livre) e ciclo repetitivo (sempre volta ao centro → jogo vira "pega-bandeira");
(4) coleta e renascimento sem feedback — coleta muda (só quem olha o HUD nota) e respawn parece teletransporte.

## Comportamento esperado

### T-037 — Bots caçam poder + coragem com vida cheia 〔bots〕
- **Aura atrai ameaça:** quanto maior a banda de poder do alvo (`POWER_BAND_MID`/`POWER_BAND_HIGH` — a "aura" visível do jogo), maior o peso de engage dos bots sobre ele, e maior a distância em que os bots o percebem (aura é fama: visível de longe, como o aro visual). Um jogador nível 8+ parado NÃO fica em paz.
- **Divisão equilibrada:** o mecanismo de distribuição existente (`targetBias` determinístico por par bot–alvo + confiança por distância) continua valendo — nem todos os bots convergem no mesmo alvo. O peso extra por aura é limitado (teto) para nunca virar "todos contra um".
- **Coragem com vida cheia:** bot com HP ≥ ~90% e inimigo percebido sempre parte pra cima do alvo mais próximo (não vagueia/farma passivamente com inimigo na cara).
- **Fuga só com plano:** fugir exige HP baixo **e** um coletável de cura percebido (hp_orb) para onde correr. Sem rota de cura → luta (kite/desespero já existentes).

### T-038 — Projétil menor: colisão diagonal 〔shared/server〕
- Raio de colisão do projétil contra o cenário reduzido o suficiente para **atravessar o vão diagonal** entre dois props colidíveis adjacentes na diagonal. Visual acompanha (projétil um pouco menor), leitura de hit em player preservada (TTK e sensação de acerto não mudam de forma perceptível).

### T-039 — Arsenal: 3 lançadores + arma coletável única 〔shared/server/client〕
- **3 lançadores jogáveis**: `basic_shot` (padrão, discreto, sem VFX chamativo — todos nascem com ele) + 2 vantajosos e visualmente mais ricos (ex.: pesado, dano alto/mais lento; rápido, cadência alta/dano menor). Vantagem clara mas não absurda (anti-snowball).
- **1 arma no chão por vez** no mapa inteiro: coletável de arma nasce em célula **totalmente aleatória** do mapa, mas nunca sobre estrutura/prop (célula walkable e alcançável), ignorando zonas/pesos dos coletáveis comuns.
- Ao coletar: o lançador do jogador troca na hora; o tipo da arma é definido no spawn (visual mostra qual é). **Na morte volta ao `basic_shot`.**
- Respawn da arma: cooldown **sorteado entre 15 e 30 s** após a coleta.

### T-040 — Bandeira nunca bloqueada 〔server/shared〕
- Toda posição em que a bandeira "assenta" (nascimento, volta ao centro, drop na morte/desconexão) é ajustada para a célula walkable **alcançável** mais próxima — nunca dentro/em cima de prop, nunca em bolsão inacessível.

### T-041 — Bandeira acesa/desativada 〔client〕
- **Livre no chão = acesa:** chamativa (emissivo pulsante/luz) — dá pra ver de longe que está disponível.
- **Carregada = desativada:** o mesh da bandeira (que segue o portador) fica apagado/cinza; quem brilha é o portador (glow existente).

### T-042 — Bandeira em cooldown 〔server/shared/client/bots〕
- Portador morre (ou some) → bandeira dropa. Se ninguém pegar em `FLAG_ABANDon...` (5 s), **em vez de voltar ao centro** ela entra em **cooldown de 60 s**: some do mapa, sem pickup. Ao fim, renasce no centro (acesa, posição validada pela T-040).
- Bots tratam bandeira em cooldown como inexistente. Quebra o loop "todo mundo só joga pega-bandeira".

### T-043 — Combo de XP 〔server/shared + client〕
- Coletas de `xp_orb` **em sequência sem tomar dano** formam combo. A partir da **3ª** coleta consecutiva, cada xp_orb vale em dobro (booster).
- Cada combo tem um **limite sorteado entre 3 e 5** coletas; ao atingir, o combo fecha e recomeça do zero (novo sorteio). Tomar dano zera o combo.
- Servidor autoritativo; cliente só mostra feedback discreto ("Combo ×3").

### T-044 — Textos flutuantes de coleta discretos 〔client〕
- Ao coletar xp/velocidade/coin/etc: texto flutuante pequeno, **opacidade reduzida**, fade rápido, no ponto da coleta — informa quem está atento, não polui. Reusa a infra de popup existente (orçamento fixo de sprites).

### T-045 — Transição de nascimento 〔client〕
- Ao nascer/renascer (self e inimigos): materialização (fade/scale-in curto + VFX leve) em vez de aparecer seco. Para o próprio jogador, transição de câmera/tela curta — nunca "teletransporte" do lugar da morte para o spawn.

## Fora de escopo
- Sistema completo de aura por mecânica (M2/ADR-005) — aqui a "aura" é a banda de poder por nível já existente.
- Novos patterns de projétil (fan/burst são das skills, T-017); as armas mudam números/visual, não o pattern.
- Drop da arma no chão ao morrer (a arma some; o ciclo de spawn repõe).
- Persistência de arma entre partidas.

## Critérios de aceite
- [ ] Teste de decisão: alvo banda alta é escolhido com peso maior; com N bots e vários alvos, os alvos continuam distribuídos (não 100% no mesmo).
- [ ] Teste de decisão: HP cheio + inimigo perto ⇒ engage; HP baixo sem cura percebida ⇒ não escolhe fugir.
- [ ] Teste server: projétil atravessa vão diagonal entre dois props colidíveis diagonais.
- [ ] Teste server: nunca existem 2 armas no chão; respawn dentro de [15 s, 30 s]; spawn nunca em célula não-walkable; morte devolve `basic_shot`.
- [ ] Teste server: bandeira dropada em cima de prop assenta em célula walkable alcançável.
- [ ] Teste server: drop sem pickup por 5 s ⇒ cooldown 60 s (sem pickup durante) ⇒ renasce no centro.
- [ ] Teste server: 3ª coleta seguida de xp vale 2×; dano zera o combo; limite sorteado ∈ [3,5] respeitado.
- [ ] Smoke headless com bots: sem erro, gates de teste todos verdes, tsc limpo em server/client/bots.
- [ ] Client: estados visuais da bandeira, popups discretos e transição de nascimento (veredito visual final é do CD).

## Decisão do Creative Director
Aprovada — a spec é transcrição direta do pedido do CD (2026-07-05, pós-teste de gameplay). Interpretações registradas em Notas da IA; ajustes finos ficam para o veredito de sensação.

## Notas da IA
- **"Aura"** hoje não existe como pontuação (M2); a leitura fiel do pedido é "poder visível" = banda de poder por nível (mesma fonte do aro visual da T-018). Quando a aura mecânica do M2 nascer, o peso dos bots troca de fonte sem mudar a forma.
- **Interpretações assumidas** (ajustáveis por constante): arma dura até a morte; qualquer abandono da bandeira (morte ou desconexão) leva ao cooldown; limite do combo sorteado ao iniciar o combo; booster do combo = 2× por coleta a partir da 3ª.
- **Risco de balance:** peso de aura alto demais recria o "todos contra um" que a Sessão 12 desfez — por isso teto explícito + manutenção do targetBias. Calibração final é veredito de sensação do CD.
