# SPEC-0005 — Presença viva, morte dura, facing por movimento

> Nota: o nome do arquivo ainda diz "mira-continua" (título original). O item 6 foi corrigido para **facing por movimento** — ver a nota de correção abaixo.

**Status:** implementada · **Marco:** M1.5 (ajustes pós-teste) · **Data:** 2026-07-04

## Problema / objetivo
Após teste do CD com bots, seis ajustes de ritmo e controle:
1. o mapa "esfria" quando ninguém coleta — progressão devia existir só por estar vivo;
2. morrer punia pouco (perdia fração do nível) — queremos risco real máximo;
3. o reroll (R) era só reorganização, não progressão;
4. as zonas safe criavam cantos intocáveis que travavam o combate;
5. sem safe, nascer/renascer precisava de uma janela justa para se reposicionar;
6. a mira/facing "grudava" nas 8 direções do movimento, impedindo tiro em ângulos finos.

## Comportamento esperado
1. **XP passivo:** todo player conectado (bots inclusos) ganha **+1 XP/s** (`XP_PER_SECOND`) só por estar vivo na sala. O ganho entra em unidades **inteiras** (acumulador de tempo no servidor) — o HUD nunca mostra XP fracionado.
2. **Morte zera o nível:** ao morrer o player volta ao **nível 1** (antes: `lossFraction`, perda parcial). XP e build/skills continuam apagados.
3. **Reroll dá XP:** pressionar **R** (custo 15 coins) além de redistribuir os atributos concede **+20 XP** (`REROLL_XP_REWARD`) — pode subir de nível e abrir card na hora.
4. **Sem área safe:** o mapa não gera mais zonas safe; não há região que bloqueia dano/tiro. Só restam zonas de guerra e campo.
5. **Invulnerabilidade de nascimento:** ao nascer/renascer o player fica **3s imune a dano** (`SPAWN_PROTECTION_MS`). A imunidade **cai no instante em que ele dispara** (não dá para atacar protegido). Bolha translúcida no cliente + contador no F3.
6. **Facing pelo movimento:** a direção/visão do player (`Player.dir`) deriva do **movimento** (WASD), calculada pelo servidor a partir de `inputX/inputZ`. O **mouse não controla o facing**. Parado, mantém o último `dir` (nunca zera). O tiro sai sempre na direção em que o player anda/olha.

> **Correção (2026-07-05):** a versão inicial deste item colocava o facing sob o **mouse** (mira contínua). O CD pediu o oposto — facing pelo movimento, como antes, só que mais eficiente (sem raycast por tick nem `aim` na rede). Ajustado. O campo `aimX/aimZ` do protocolo continua existindo e é usado **só pelos bots** (que miram no alvo).

## Fora de escopo
- Política de escudo diferente por perfil de bot (bots hoje ignoram a proteção do alvo ao atirar — desperdiçam tiros nos 3s, aceitável).
- Balance fino do XP passivo/reroll (números iniciais, re-medir com bots depois).
- Remoção do código do primitivo `zone.kind === "safe"` (mantido: testes de combate ainda o exercem; só não é mais gerado no mapa).

## Critérios de aceite
- [x] Bots sobem de nível sem kills (XP passivo) — visto no smoke (bot sem tiros chegou ao nível 2).
- [x] Alvo protegido recebe **0 dano** e emite `shield_block`; disparar zera a própria proteção — verificado por script no `ProjectileSystem`.
- [x] `buildMap` não gera nenhum tile safe — verificado (0 safe, só war/field).
- [x] Reroll chama `grantXp` (+20 XP) além de redistribuir.
- [x] Morte seta `level = 1`.
- [x] Cliente do player **não** envia `aim`; o facing segue o movimento (servidor deriva `dir` de `inputX/inputZ`).
- [x] Gates: shared 13/13, server 17/17, `tsc --noEmit` ×3, guarda `.js` órfão, smoke com bots.

## Decisão do Creative Director
Pedido direto do CD (2026-07-04) após teste com bots — os seis itens acima. Implementados; aguardando veredito no browser.

## Notas da IA
- **Safe → invuln temporal** é uma troca limpa: remove o problema (cantos intocáveis) e mantém a proteção que importa (não morrer no frame do respawn). Break-on-fire evita o abuso "torre invulnerável".
- **Facing pelo movimento** (item 6): o CD quer a direção presa ao movimento, não ao mouse. Remover o `aim` do cliente do player é também a opção mais eficiente (zero raycast por tick, payload de rede menor). Com teclado o facing é naturalmente 8-direcional; a suavização visual (interpolação de `rotation.y`) já existe no cliente.
- **XP passivo + morte-zera-nível** se equilibram: a morte agora dói de verdade, mas ninguém fica preso no fundo — sobe de novo só jogando. Re-medir pacing com bots é o próximo passo de balance.
- Risco monitorado: XP passivo alimenta `grantXp` toda tick para todos — custo O(players), desprezível no teto de 8.
