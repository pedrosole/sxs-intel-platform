import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const SKILL_MAP = {
  maykon: "skill-copywriting",
  iza: "skill-briefing",
  rapha: "skill-strategy",
  argos: "skill-qa",
}

const newLearnings = [
  {
    agent_id: "maykon",
    skill_id: SKILL_MAP.maykon,
    content: `NUNCA usar estruturas "Não é sobre X, é sobre Y" — é clichê de IA, genérico e artificial. Clientes identificam imediatamente como conteúdo gerado por máquina. Usar abordagens diretas e naturais.`
  },
  {
    agent_id: "maykon",
    skill_id: SKILL_MAP.maykon,
    content: `NUNCA usar figuras de linguagem forçadas ou metáforas que não traduzem a personalidade do cliente/conteúdo. Exemplo do que NÃO fazer: "aquela conversa sussurrada entre irmãos". Usar termos que o cliente realmente usaria no dia a dia.`
  },
  {
    agent_id: "maykon",
    skill_id: SKILL_MAP.maykon,
    content: `Roteiros devem ser FLUIDOS EM FALA — testar mentalmente se soa natural quando lido em voz alta. Peças de vídeo (reels) são faladas, não lidas. Ajustar cadência, pausas e vocabulário para oralidade real.`
  },
  {
    agent_id: "iza",
    skill_id: SKILL_MAP.iza,
    content: `Conteúdo DEVE ser compatível com o perfil e proposta de valor do cliente. Não forçar temas que não casam com o posicionamento do escritório/marca. Antes de briefar, verificar se o ângulo faz sentido para AQUELE cliente específico.`
  },
  {
    agent_id: "iza",
    skill_id: SKILL_MAP.iza,
    content: `Datas comemorativas exigem PROFUNDIDADE EMOCIONAL proporcional à data. Dia das Mães, Dia dos Pais, etc. não podem ter homenagem limitada a temas técnicos do nicho. O emocional vem primeiro, a conexão com o serviço vem como consequência natural — nunca forçada.`
  },
  {
    agent_id: "iza",
    skill_id: SKILL_MAP.iza,
    content: `Propor conteúdos DINÂMICOS e DESCONTRAÍDOS quando possível — conectar temas pessoais/cotidianos com o profissional de forma leve. Exemplo: "que mulher não pensa mais na morte depois de ser mãe?" é mais real que "planejamento sucessório na maternidade".`
  },
  {
    agent_id: "rapha",
    skill_id: SKILL_MAP.rapha,
    content: `Incluir no calendário peças que mostrem DIFERENCIAIS DO ATENDIMENTO do cliente (ex: relatórios quinzenais, contato direto, baixa terceirização) — não apenas temas técnicos do nicho. A experiência do cliente no serviço é conteúdo de alto valor.`
  },
  {
    agent_id: "argos",
    skill_id: SKILL_MAP.argos,
    content: `VETAR conteúdo que soe artificial ou "cara de IA": estruturas repetitivas tipo "Não é sobre X, é sobre Y", metáforas forçadas, figuras de linguagem que o cliente real jamais usaria. Se parecer template, reprovar.`
  },
]

let added = 0
for (const l of newLearnings) {
  const { error } = await supabase.from("agent_skill_learnings").insert(l)
  if (error) {
    console.error(`ERRO @${l.agent_id}:`, error.message)
  } else {
    added++
    console.log(`✓ @${l.agent_id}: ${l.content.substring(0, 70)}...`)
  }
}

console.log(`\n✅ ${added}/${newLearnings.length} learnings adicionados (total: ${23 + added})`)
