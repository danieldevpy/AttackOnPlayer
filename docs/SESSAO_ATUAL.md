# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-04
**Branch:** `movimento_e_direcao` — merge para `main` **ainda pendente** (checklist em `QA.md`; herdado da sessão anterior, ver Veredito abaixo).
**Marco:** M1 entregue (aguardando veredito/merge) → **M1.5 planejado e aprovado** (SPEC-0004, sem código ainda).

---

## Onde paramos

**Sessão de design (sem mudança de código).** O CD relatou que o dano escala devagar e é difícil eliminar players. Diagnóstico: o TTK era **matematicamente constante** — 10 tiros em qualquer nível, porque força e vitalidade escalam na mesma taxa (+4%/pt, pontos iguais por nível).

Produzido e aprovado pelo CD nesta sessão:

- `docs/proposals/PROPOSAL-0001-skills-atributos-escala.md` — diagnóstico completo, matemática, alternativas.
- `specs/SPEC-0004-skills-atributos-escala.md` — spec aprovada: TTK alvo 5 tiros, tabela `ATTR_DEFS` assimétrica (Força/Vitalidade/Agilidade + **Cadência** e **Alcance** novos, tetos por atributo), level-up por **cards de escolha** (3 pts, determinísticos, timeout 5s sem pausa), **skills de projétil** em marcos (Tiro Duplo/Leque/Perfurante/Fôlego/Impulso), juice de poder, bots com política de card por perfil.
- **ADR-013** no `DECISION_LOG.md`; linha **M1.5** no `ROADMAP.md`.
- Tasks **T-014..T-018** no `BACKLOG.md` (seção M1.5) + adendos em **T-008b** (política de cards por perfil, boss) e **T-OPTIONAL 1** (relatório TTK).

## Próximo passo sugerido

1. **Herdado:** veredito do CD nos fluxos da SPEC-0003 + merge `movimento_e_direcao` → `main` (idealmente antes de abrir código novo do M1.5).
2. **Implementação M1.5, em ordem** (cada task jogável e testável sozinha):
   `Executar T-014 do docs/BACKLOG.md` → T-015 → T-016 → T-017 → T-018 → T-008b.

Prompt típico: `Executar T-014 do docs/BACKLOG.md`

## Veredito do Creative Director

| Fluxo | Status | Notas |
|---|---|---|
| PROPOSAL-0001 / SPEC-0004 (design M1.5) | ✅ aprovado (2026-07-04) | defaults da spec valem até dados de bots dizerem o contrário |
| Facing por mouse/teclado/parado (T-009) | ⬜ pendente teste do CD | herdado da sessão anterior |
| Disparo por espaço/clique idênticos (T-010) | ⬜ pendente teste do CD | herdado |
| Nariz visível girando (T-011) | ⬜ pendente teste do CD | herdado |
| F3 mostra log sem `DEBUG=1` | ⬜ pendente teste do CD | herdado |
| Ritmo de ataque por skill + anti-stuck | ⬜ pendente teste do CD | herdado |
| Merge para `main` | ⬜ pendente | checklist em `QA.md` — gates locais limpos na sessão anterior |

## Comandos úteis agora

```bash
npm run test                        # 5/5 (nenhum código mudou nesta sessão)
npm run dev:server && npm run dev:client
npm run bots -- 3 30                # baseline de TTK/kills — comparar após T-014
```

## Leituras se a sessão nova for só conversa

- Spec ativa (aprovada, não iniciada) → `specs/SPEC-0004-skills-atributos-escala.md`
- Diagnóstico e alternativas do M1.5 → `docs/proposals/PROPOSAL-0001-skills-atributos-escala.md`
- Decisão consolidada → `DECISION_LOG.md` (ADR-013)
- Tasks prontas para executar → `docs/BACKLOG.md` (seção M1.5)
- Spec anterior (fechada, aguardando veredito) → `specs/SPEC-0003-facing-mira-gatilhos.md`
