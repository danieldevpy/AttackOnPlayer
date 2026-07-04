# PROMPT-0023 — T-017: Skills de projétil — multishot, pierce, marcos e box · 2026-07-04

## Pedido (resumo fiel do CD)
Continuação da execução da SPEC-0004 (PROMPT-0020..0022). Esta leva: T-017.

## Decisões tomadas (e por quem)
- CD (via SPEC-0004): multishot/pierce como skills discretas em marcos de nível; box sorteia skill.
- IA (**desvio da spec, registrado**): a spec sugeria estender `LauncherDef.fire`; implementei as skills como **modificadores por player** (`shared/skills.ts`: `SKILLS` + `combinedSkillMods`) aplicados sobre o lançador no `ProjectileSystem`. Motivo: skill é do *jogador* (sobrevive à troca de lançador futura) e `LauncherDef` fica reservado a armas trocáveis — os dois empilham sem colisão de responsabilidade. O critério de aceite não muda.
- IA: regras de combinação anti-explosão: projéteis/tiro = **MAX**, fatores (dano/range/cooldown/vel) = **PRODUTO**, pierce = **SOMA**. `tiro_duplo`+`leque` dá 3 projéteis, nunca 6.
- IA: spawn com spread generalizado (N projéteis centrados no facing; N=1 degenera no tiro reto — zero mudança sem skill). Dano/range/velocidade **congelados no disparo** (`damageMult`/`maxRange`/`speedMult` no projétil), coerente com a regra da T-015.
- IA: pierce via `hitIds` no projétil (não re-acerta o mesmo alvo); safe zone continua consumindo o projétil.
- IA: marcos (4/8/12): a oferta vira `[★skill A, ★skill B, card de atributo]` — escolher 1 de 2 skills ou abrir mão por pontos. Skill possuída é substituída por outra que falte; sem faltantes → oferta normal. **Oferta enviada fica armazenada** (`pending.cards`) e a resolução valida contra ela — nunca recomputa (estado do player pode ter mudado).
- IA: `impulso` = gancho `onKill` no Room: reseta `lastFireAt` + efeito `kill_rush` (+30% vel/2s) no EffectSystem (mesmo pipeline, expira sozinho). Timeout de marco = auto-pick de atributos (AFK não ganha skill).
- IA: box concede skill faltante aleatória (RNG aceitável: box é drop raro de zona de guerra — risco→recompensa, ADR-005 intocada) + evento `box_skill` no F3.
- IA: morte apaga skills (`p.skills = new ArraySchema()`), junto com build e fila de cards.

## Resultado verificado
- Testes novos: `shared/skills.test.ts` (neutralidade sem skills, números da spec, combinação MAX/PRODUTO/SOMA, ids desconhecidos ignorados, marcos apontam para skills existentes) e `server/systems/skills.test.ts` (tiro_duplo spawna 2 com 13 de dano; perfurante atravessa exatamente 1 alvo e não re-acerta; cooldown 750ms do perfurante; fôlego range 10.8u + speedMult 1.2; kill_rush aplica e expira).
- ⚠️ Gates de execução pendentes de runtime (limitação da sessão; ver PROMPT-0020).
- Revisão estática: `combinedSkillMods` chamado 1x por tick por atirador (barato); HUD/F3 mostram skills; bots recebem cards de skill nos marcos e escolhem `cards[0]` (ganham skill — se beneficiam da mecânica, T-008b refina).

## Regras que nascem daqui
- Modificador de combate combina por MAX/PRODUTO/SOMA conforme o risco de explosão — nunca dois multiplicadores de contagem se multiplicam.
- Poder de projétil é sempre congelado no spawn; nenhuma mudança de estado do atirador afeta projéteis em voo.
- Oferta enviada ao cliente é a fonte de validação (armazenar, não recomputar) sempre que a oferta depender do estado no momento do envio.

## Pendências para o próximo prompt
- Rodar gates; conferir com bots que marcos disparam card ★ (nível 4 é alcançável em ~155 XP).
