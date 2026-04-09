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
