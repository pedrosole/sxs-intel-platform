import { Agent } from "@/types"

export const agents: Agent[] = [
  {
    id: "hermes",
    name: "Hermes",
    role: "Orquestrador",
    icon: "🧠",
    order: 0,
    functionalName: "orchestrator-agent",
    description:
      "Abre o job, valida contexto, define a ordem, distribui tarefas, controla handoffs e fecha o ciclo. Registra aprendizados versionados e redistribui o proximo job com base no que funcionou ou falhou.",
    templates: ["workflow-orchestrator"],
    contexts: [],
  },
  {
    id: "debora",
    name: "Debora",
    role: "Analista de Inteligencia",
    icon: "📊",
    order: 1,
    functionalName: "market-intelligence-agent",
    description:
      "Analisa nicho, dores, tensoes, saturacao, oportunidades, vocabulario dominante e riscos. Audita concorrentes, formatos repetidos, promessas recicladas e espacos de diferenciacao. Define tom, estilo argumentativo, vocabulario permitido e proibido.",
    templates: [
      "niche-analysis-report",
      "competitor-content-audit",
      "brand-voice-profile",
    ],
    contexts: [
      {
        id: "ctx-rubrica",
        name: "rubrica-scoring.md",
        content: "",
        active: true,
      },
      {
        id: "ctx-metodologia-analise",
        name: "metodologia-analise.md",
        content: "",
        active: true,
      },
      {
        id: "ctx-guia-nichos",
        name: "guia-nichos.md",
        content: "",
        active: true,
      },
      {
        id: "ctx-research-nichos",
        name: "research-nichos-brasil.md",
        content: "",
        active: true,
      },
      {
        id: "ctx-content-patterns",
        name: "content-patterns.md",
        content: "",
        active: true,
      },
    ],
  },
  {
    id: "athena",
    name: "Athena",
    role: "Estrategista de Posicionamento",
    icon: "🎯",
    order: 2,
    functionalName: "positioning-strategy-agent",
    description:
      "Transforma analise em narrativa central da marca, promessa principal, diferenciais reais e cliches proibidos. Sintetiza a leitura de mercado em uma mensagem-mae que serve de referencia para todas as etapas seguintes.",
    templates: ["positioning-message-core"],
    contexts: [],
  },
  {
    id: "rapha",
    name: "Rapha",
    role: "Arquiteto de Conteudo",
    icon: "🗺️",
    order: 3,
    functionalName: "content-architecture-agent",
    description:
      "Organiza clusters, subtemas, dores, desejos, objecoes, estagios de consciencia e objetivos por conteudo. Distribui temas no tempo com logica de funil, campanha, sazonalidade, prova e testes.",
    templates: ["topic-cluster-map", "editorial-calendar"],
    contexts: [
      {
        id: "ctx-guia-nichos-rapha",
        name: "guia-nichos.md",
        content: "",
        active: true,
      },
      {
        id: "ctx-content-patterns-rapha",
        name: "content-patterns.md",
        content: "",
        active: true,
      },
    ],
  },
  {
    id: "iza",
    name: "Iza",
    role: "Pauteira",
    icon: "📋",
    order: 4,
    functionalName: "content-briefing-agent",
    description:
      "Traduz a pauta em instrucao clara por peca, com objetivo, angulo, prova, CTA e restricoes criativas. Entrega um brief fechado o suficiente para reduzir improviso na producao.",
    templates: ["content-brief"],
    contexts: [],
  },
  {
    id: "maykon",
    name: "Maykon",
    role: "Redator Multiformato",
    icon: "✍️",
    order: 5,
    functionalName: "multiformat-content-agent",
    description:
      "Converte o brief em roteiro, post estatico, carrossel e legenda, com hook, estrutura, clareza, retencao e CTA. Nao inventa posicionamento — executa o que foi travado no brief.",
    templates: [
      "video-script",
      "static-post-content",
      "carousel-content",
      "content-caption",
    ],
    contexts: [],
  },
  {
    id: "argos",
    name: "Argos",
    role: "Editor de QA",
    icon: "🔎",
    order: 6,
    functionalName: "qa-editor-agent",
    description:
      "Revisa clareza, originalidade, aderencia a voz, forca da mensagem, excesso de cliche e coerencia com o brief. Tem poder de veto — barra frase feita, abstracao vazia e desalinhamento.",
    templates: ["content-qa-review"],
    contexts: [],
  },
  {
    id: "jarbas",
    name: "Jarbas",
    role: "Performance & Insights",
    icon: "📈",
    order: 7,
    functionalName: "performance-insights-agent",
    description:
      "Le desempenho e transforma numeros em decisao pratica sobre o que repetir, matar, ajustar e testar. Realimenta @rapha, @athena e @debora conforme o tipo de aprendizado.",
    templates: ["content-performance-report"],
    contexts: [
      {
        id: "ctx-rubrica-jarbas",
        name: "rubrica-scoring.md",
        content: "",
        active: true,
      },
      {
        id: "ctx-data-schema-jarbas",
        name: "data-schema.md",
        content: "",
        active: true,
      },
    ],
  },
  {
    id: "leo",
    name: "Leo",
    role: "Designer Visual",
    icon: "🎨",
    order: 8,
    functionalName: "visual-design-agent",
    description:
      "Transforma pecas textuais aprovadas em visuais prontos para Instagram. Gera imagens de fundo via Gemini, monta HTML com logo, tipografia e overlay, faz preview e exporta PNG 1080x1350. Respeita identidade visual do cliente — cores, fontes e logo sempre alinhados.",
    templates: ["instagram-visual-piece", "carousel-multi-slide"],
    contexts: [
      {
        id: "ctx-leo-visual-design",
        name: "leo-visual-design.md",
        content: "",
        active: true,
      },
    ],
    skills: [
      {
        id: "skill-instagram-carousel",
        name: "Instagram Carousel",
        description:
          "Gera carrosseis HTML swipeable com slides exportaveis em 1080x1350px. Workflow completo: brand setup, slide copy, design system, HTML, export Playwright.",
        learnings: [],
      },
    ],
  },
]
