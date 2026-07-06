# Bandeira — "rei do mapa" (SPEC-0006 T-021, SPEC-0011 T-040/T-041/T-042)

**Bandeira = objetivo social.** Carregar dá 2× XP, mas expõe: todo mundo enxerga o portador de longe.

## Ciclo completo

1. **Ativa (livre)** — parada em algum ponto do mapa, pano **aceso** (emissivo pulsante, visível
   de longe). Qualquer jogador vivo que chegue a `FLAG_PICKUP_DIST` (= `COLLECT_DIST`) pega.
2. **Carregada** — segue a posição do portador; pano **apagado** (o glow passa a vir do próprio
   portador, não da bandeira). Ganho de XP do portador é multiplicado por `FLAG_XP_MULT = 2`.
3. **Dropada** — morte ou desconexão do portador derruba a bandeira no local (`flag_drop`);
   volta a ficar "ativa" nesse ponto e pode ser pega de novo imediatamente.
4. **Abandono → cooldown** — se ninguém pegar a bandeira dropada por `FLAG_ABANDON_RETURN_MS`
   (5 s), ela sai do jogo: `Flag.state = "cooldown"`, **some do mapa**, pickup impossível.
   Evento `flag_cooldown_start`.
5. **Renascimento** — após `FLAG_COOLDOWN_MS` (60 s) em cooldown, renasce **acesa no centro**
   do mapa (`state = "active"`). Evento `flag_respawn`.

Cada transição emite `debug_event` (F3/toast): `flag_pickup`, `flag_drop`,
`flag_cooldown_start`, `flag_respawn`.

## Assentamento sempre válido (T-040)

Toda vez que a bandeira assenta (nascimento da sala, drop, retorno ao centro), a posição passa
por `nearestReachableCell` — a célula walkable **alcançável** mais próxima do ponto pedido
(usa o `reachable` pré-computado do mapa). Isso garante que a bandeira nunca fica presa dentro de
um prop ou num bolsão fechado, mesmo em mapas com geometria adversa.

## Visual (T-041)

- **Livre**: material do pano pulsa emissivo — leitura de longe, sem precisar chegar perto.
- **Carregada**: mesh do pano apagado; o destaque vira o glow do próprio portador
  (ver [aura.md](aura.md) por faixa de poder).
- **Cooldown**: bandeira removida da cena — fora do jogo, sem confundir o jogador procurando algo
  que não pode ser pego.

Implementação: `packages/client/src/main.ts` (`updateFlagGround`, ~l.784).

## Bots

Bots tratam `state === "cooldown"` como "bandeira inexistente" — não perseguem, não avaliam
disputa enquanto ela está fora do jogo (`packages/bots/src/bot.ts`, ~l.193).

## Constantes-dial

| Constante | Valor | Efeito |
|---|---|---|
| `FLAG_XP_MULT` | 2 | Multiplicador de XP do portador |
| `FLAG_PICKUP_DIST` | = `COLLECT_DIST` | Raio de coleta |
| `FLAG_ABANDON_RETURN_MS` | 5000 ms | Tempo dropada e não disputada até entrar em cooldown |
| `FLAG_COOLDOWN_MS` | 60000 ms | Tempo fora do jogo até renascer no centro |

Definidas em `packages/shared/src/constants.ts`. Lógica de transição de estado em
`packages/server/src/systems/flag.ts` (`FlagSystem`), orquestrada por `ArenaRoom` a cada tick.
