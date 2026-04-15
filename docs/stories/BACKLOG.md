# SXS Intel — Backlog de Correcoes (Sprint Fix-01)

**Contexto:** Diagnostico pos-entrega Gabriela Lopes (2026-04-07)
**Criado por:** @sm River

---

## Ordem de Execucao (dependencias respeitadas)

| # | Story | Tipo | Prioridade | Estimativa | Depende de |
|---|-------|------|-----------|------------|------------|
| 1 | [1.1](1.1.story.md) — Fix Pipeline Output Limits | Bug Fix | CRITICAL | P | — |
| 2 | [1.2](1.2.story.md) — Calendar Persistence Bridge | Feature | CRITICAL | M | 1.1 |
| 3 | [1.4](1.4.story.md) — Fix Hermes Redundancy | Bug Fix | HIGH | P | 1.2 |
| 4 | [1.3](1.3.story.md) — Rewrite /clientes (Supabase) | Feature | HIGH | M | 1.2 |
| 5 | [1.5](1.5.story.md) — Auto-Extract Client Summaries | Enhancement | MEDIUM | P | — |

**Nota:** Story 1.5 e independente e pode ser executada em paralelo com qualquer outra.

---

## Resumo dos Gaps (origem)

| Gap | Evidencia | Story |
|-----|-----------|-------|
| @iza limita 5 pecas, max_tokens baixo | Gabriela: 5/16 pecas entregues | 1.1 |
| calendar_meta e calendar_pieces vazios | Supabase query: 0 registros | 1.2 |
| Link do calendario nunca gerado | Nenhum share_token existe | 1.2 |
| Hermes reorganiza outputs redundantemente | 48k tokens gastos | 1.4 |
| /clientes mostra mock, nao Supabase | import { clients } from mock.ts | 1.3 |
| brand_voice_summary e positioning_summary NULL | client_summaries: ambos null | 1.5 |

---

## Ja Corrigidos (nesta sessao)

- [x] Hermes decisividade — Regra 7+8 no prompt (deployed)
- [x] Scroll do chat — min-h-0 + viewport overflow + selector fix (deployed)

---

## Epic 2 — Design Studio

**PRD:** [docs/prd/design-studio.md](../prd/design-studio.md)
**Depende de:** Sprint Fix-01 (stories 1.1–1.4 concluídas)

### Ordem de Execução

```
2.1 ─┬─→ 2.2 ─→ 2.3 (Asset Management track)
     └─→ 2.4          (Gemini API, paralelo)
              2.2 + 2.3 + 2.4 ─→ 2.5 (Design Studio page)
                                  2.5 ─┬─→ 2.6 (Export PNG)
                                       └─→ 2.7 (Fluxo Calendário)
```

| # | Story | Tipo | Prioridade | Estimativa | Depende de |
|---|-------|------|-----------|------------|------------|
| 1 | [2.1](2.1.story.md) — Schema & Storage Setup | Infra | CRITICAL | P | Sprint Fix-01 |
| 2 | [2.2](2.2.story.md) — Asset Upload API | Feature | CRITICAL | M | 2.1 |
| 3 | [2.3](2.3.story.md) — Asset Management UI (4 Abas) | Feature | CRITICAL | G | 2.2 |
| 4 | [2.4](2.4.story.md) — Gemini Image Generation API | Feature | HIGH | P | 2.1 |
| 5 | [2.5](2.5.story.md) — Design Studio Page | Feature | HIGH | G | 2.2, 2.3, 2.4 |
| 6 | [2.6](2.6.story.md) — Export PNG (Playwright) | Feature | HIGH | M | 2.5 |
| 7 | [2.7](2.7.story.md) — Fluxo Integrado Calendário → Design | Feature | MEDIUM | P | 2.5 |

**Notas:**
- Stories 2.2 e 2.4 podem ser desenvolvidas em paralelo (ambas dependem apenas de 2.1)
- Story 2.3 (UI) depende de 2.2 (API) estar funcional
- Story 2.5 é o coração do epic — consolida tudo
- Stories 2.6 e 2.7 são independentes entre si, ambas dependem de 2.5
