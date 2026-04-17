// Insere novas skill learnings PROPOSITIVAS focadas em storytelling e giro narrativo irrepetível
// Contexto: feedback geral da Gabriela — "roteiros mesma estrutura, headlines fracos, sem criatividade"
// Regra central: giro narrativo é único por peça, não repete no calendário NEM entre clientes

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim()
const sb = createClient(url, key)

const learnings = [
  // === @rapha — Arquitetura de conteúdo ===
  {
    agent_id: "rapha",
    skill_id: "skill-content-architecture",
    content:
      "GIRO NARRATIVO É IRREPETÍVEL. Cada peça do calendário deve ter um momento de giro (virada/surpresa narrativa) único. O giro não pode se repetir dentro do mesmo calendário NEM entre calendários de clientes diferentes — giro usado é giro aposentado. Antes de alocar giros, consultar entregas anteriores no Supabase (calendar_pieces.script). Tratar giro como asset criativo singular.",
  },
  {
    agent_id: "rapha",
    skill_id: "skill-content-architecture",
    content:
      "Planejar distribuição de ESTRUTURAS NARRATIVAS antes de briefar — a variação é decisão de arquitetura, não improvisação do copywriter. Para calendários de 12+ peças, alocar no mínimo 6 estruturas diferentes: confessional, in media res, inversão de expectativa, pergunta retórica, lista-revelação, metáfora estendida, diálogo simulado, contrafactual, cenário comparativo, monólogo direto. Mapear cada peça à estrutura no planejamento.",
  },
  {
    agent_id: "rapha",
    skill_id: "skill-content-architecture",
    content:
      "Storytelling é MOTOR do conteúdo, não acabamento. A narrativa define a estrutura da peça desde o planejamento — não se aplica 'por cima' de um texto informativo. Peça que informa sem surpreender na forma é invisível no feed. No marketing digital, o formato com que a informação chega é tão importante quanto a informação em si — porque no Instagram o público decide em 1.5s se continua ou passa.",
  },

  // === @iza — Briefing de conteúdo ===
  {
    agent_id: "iza",
    skill_id: "skill-content-briefing",
    content:
      "O briefing de cada peça DEVE especificar: (a) estrutura narrativa (confessional, in media res, inversão, etc.), (b) tipo de giro esperado e em que ponto do roteiro ele acontece, (c) referência de tom (provocativo, íntimo, técnico-acessível, etc.). NÃO delegar decisão de estrutura ao copywriter — se o briefing não define, o copywriter repete o padrão mais seguro e o calendário sai repetitivo.",
  },
  {
    agent_id: "iza",
    skill_id: "skill-content-briefing",
    content:
      "Intercalar intencionalmente peças informativas e emocionais no calendário. Padrão mínimo 2:1 (info:emoção). Nunca duas peças puramente emocionais em sequência — fadiga emocional no feed reduz engajamento. A alternância mantém o público em estado de 'não sei o que vem a seguir', que é o coração da retenção em marketing digital.",
  },

  // === @maykon — Copywriting ===
  {
    agent_id: "maykon",
    skill_id: "skill-copywriting",
    content:
      "GIRO NARRATIVO É OBRIGATÓRIO E ÚNICO EM CADA PEÇA. Todo roteiro deve ter UM ponto claro onde a expectativa do público muda — a frase que faz reprocessar tudo que veio antes. Esse giro não pode repetir em nenhuma outra peça do calendário NEM em entregas de outros clientes. Giro usado é giro aposentado para sempre. Se não conseguir criar giro inédito, a peça precisa ser reestruturada até encontrar um.",
  },
  {
    agent_id: "maykon",
    skill_id: "skill-copywriting",
    content:
      "Headlines devem PROVOCAR, não descrever. Teste de qualidade: se trocar o tema e a headline ainda funcionar, ela é genérica demais e deve ser reescrita. Headline forte é intransferível — funciona SOMENTE para aquele tema, aquele cliente, aquela peça. Exemplos: 'Construir patrimônio é metade do trabalho' = FRACO (serve pra qualquer advogado). '30 anos de suor. E depois?' = FORTE (específico, provocativo, com ritmo).",
  },
  {
    agent_id: "maykon",
    skill_id: "skill-copywriting",
    content:
      "Usar voz em 1ª pessoa (fala do cliente) em pelo menos 30% das peças do calendário. Conteúdo em 1ª pessoa gera autoridade pessoal, diferencia de perfis genéricos de nicho e cria conexão direta — pilares do marketing digital para profissionais liberais. NUNCA repetir a mesma estrutura de abertura em peças consecutivas. Repertório mínimo de 6 aberturas diferentes por calendário de 12+ peças.",
  },

  // === @nay — QA/Validação ===
  {
    agent_id: "nay",
    skill_id: "skill-content-qa",
    content:
      "VALIDAR UNICIDADE DE GIRO: nenhum giro narrativo pode se repetir no calendário inteiro. Cruzar com calendários anteriores do MESMO CLIENTE e de OUTROS CLIENTES (consultar calendar_pieces.script em todas as entregas). Giro narrativo repetido = reprovação automática da peça. Essa regra não tem exceção — repetir giro entre clientes significa que a agência está reciclando criativo.",
  },
  {
    agent_id: "nay",
    skill_id: "skill-content-qa",
    content:
      "VALIDAR DIVERSIDADE CRIATIVA: (1) calendário de 12+ peças deve ter no mínimo 6 estruturas narrativas diferentes — menos que isso = flag 'repertório insuficiente', devolve pra @rapha replanejar; (2) headlines devem passar no teste de genericidade — se a headline serve pra outro tema ou cliente, é genérica e deve ser reescrita; (3) nenhuma estrutura de abertura pode repetir em peças consecutivas.",
  },
]

console.log("═══ INSERINDO LEARNINGS DE STORYTELLING ═══\n")

let ok = 0
const errors = []

for (const l of learnings) {
  const { error } = await sb.from("agent_skill_learnings").insert(l)
  if (error) {
    errors.push({ agent: l.agent_id, error: error.message })
    console.log(`✗ ${l.agent_id}: ${error.message}`)
  } else {
    ok++
    console.log(`✓ ${l.agent_id} (${l.skill_id}): ${l.content.slice(0, 80)}...`)
  }
}

console.log(`\n═══ RESUMO ═══`)
console.log(`Inseridos: ${ok}/${learnings.length}`)
console.log(`Erros: ${errors.length}`)
if (errors.length) console.log(JSON.stringify(errors, null, 2))

// Stats finais
const { data: all } = await sb
  .from("agent_skill_learnings")
  .select("agent_id")
const byAgent = {}
for (const l of all || []) byAgent[l.agent_id] = (byAgent[l.agent_id] || 0) + 1
console.log("\nTotal learnings por agente:", JSON.stringify(byAgent))
