const SOURCE_PATTERNS = Object.freeze({
  villa_inventory: [
    /villa/i,
    /casa/i,
    /resid[eê]ncia/i,
    /acomoda[cç][aã]o/i,
    /hospedagem/i,
    /capacidade/i,
    /capacity/i,
    /h[oó]spedes/i,
    /guests?/i,
    /quarto/i,
    /bedroom/i,
    /su[ií]te/i,
    /suite/i,
    /cama/i,
    /bed/i,
    /piscina/i,
    /pool/i,
    /casa grande/i,
    /casa rosada/i,
    /casa rosa/i,
    /casa manga/i,
    /casa oca/i,
    /casa dend[eê]/i,
    /casa branca/i,
    /asa branca/i,
    /casa dos bal[oõ]es/i,
    /casa bal[oõ]es/i,
    /ateli[eê] azul/i,
    /atelier azul/i,
    /blue atelier/i
  ],

  rate_rules: [
    /pre[cç]o/i,
    /valor/i,
    /tarifa/i,
    /di[aá]ria/i,
    /quanto custa/i,
    /price/i,
    /rate/i,
    /cost/i,
    /desconto/i,
    /discount/i,
    /promo[cç][aã]o/i,
    /promotion/i,
    /r[eé]veillon/i,
    /new year/i,
    /alta temporada/i,
    /high season/i,
    /minimum stay/i,
    /estadia m[ií]nima/i,
    /minimo de noites/i,
    /m[ií]nimo de noites/i
  ],

  policies: [
    /pol[ií]tica/i,
    /policy/i,
    /regra/i,
    /rule/i,
    /cancel/i,
    /reembolso/i,
    /refund/i,
    /n[aã]o reembols[aá]vel/i,
    /non-refundable/i,
    /pet/i,
    /cachorro/i,
    /animal/i,
    /crian[cç]a/i,
    /children/i,
    /smoking/i,
    /fumar/i,
    /sil[eê]ncio/i,
    /quiet/i,
    /noise/i,
    /barulho/i,
    /festa/i,
    /party/i,
    /evento/i,
    /event/i,
    /estacionamento/i,
    /parking/i,
    /check[- ]?in/i,
    /check[- ]?out/i,
    /entrada antecipada/i,
    /late checkout/i
  ],

  guest_services: [
    /servi[cç]o/i,
    /service/i,
    /transfer/i,
    /transporte/i,
    /motorista/i,
    /driver/i,
    /chef/i,
    /cozinheiro/i,
    /jantar/i,
    /dinner/i,
    /restaurante/i,
    /restaurant/i,
    /praia/i,
    /beach/i,
    /experi[eê]ncia/i,
    /experience/i,
    /passeio/i,
    /atividade/i,
    /activity/i,
    /concierge/i,
    /massagem/i,
    /massage/i,
    /decora[cç][aã]o/i,
    /decoration/i
  ],


  knowledge_base: [
    /casas da vila/i,
    /trancoso/i,
    /onde fica/i,
    /location/i,
    /localiza[cç][aã]o/i,
    /dist[aâ]ncia/i,
    /distance/i,
    /quadrado/i,
    /sobre o hotel/i,
    /about/i,
    /o que torna/i,
    /what makes/i,
    /hist[oó]ria/i,
    /history/i
  ],

  faq: [
    /wifi/i,
    /internet/i,
    /caf[eé] da manh[aã]/i,
    /breakfast/i,
    /arruma[cç][aã]o/i,
    /housekeeping/i,
    /recep[cç][aã]o/i,
    /reception/i,
    /d[uú]vida/i,
    /question/i
  ],
  commercial_strategy: [
  /estrat[eé]gia comercial/i,
  /commercial strategy/i,
  /obje[cç][aã]o/i,
  /objection/i,
  /negocia[cç][aã]o/i,
  /negotiation/i,
  /convers[aã]o/i,
  /conversion/i,
  /lead/i,
  /venda/i,
  /sales/i
],

ranking_rules: [
  /melhor casa/i,
  /best villa/i,
  /qual casa/i,
  /which villa/i,
  /recomenda/i,
  /recommend/i,
  /comparar/i,
  /compare/i,
  /ranking/i
],

validation_rules: [
  /validar/i,
  /validate/i,
  /confirmar/i,
  /confirm/i,
  /verificar/i,
  /verify/i,
  /correto/i,
  /correct/i
],

glossary: [
  /o que significa/i,
  /what does.*mean/i,
  /termo/i,
  /term/i,
  /gloss[aá]rio/i,
  /glossary/i,
  /bungalow/i,
  /chal[eé]/i,
  /villa/i
]
});

const INTENT_SOURCE_MAP = Object.freeze({
  villa_recommendation: [
    "villa_inventory",
    "ranking_rules",
    "validation_rules"
  ],

  guest_information: [
    "villa_inventory"
  ],

  date_information: [
    "rate_rules"
  ],

  pricing_question: [
    "villa_inventory",
    "rate_rules",
    "commercial_strategy",
    "validation_rules"
  ],

  availability_question: [
    "villa_inventory",
    "rate_rules",
    "validation_rules"
  ],

  booking_request: [
    "villa_inventory",
    "rate_rules",
    "policies",
    "commercial_strategy",
    "validation_rules"
  ],

  policy_question: [
    "policies",
    "validation_rules"
  ],

  services_question: [
    "guest_services"
  ],

  human_handoff: [
    "commercial_strategy"
  ]
});

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function matchesAny(text, patterns = []) {
  return patterns.some((pattern) =>
    pattern.test(text)
  );
}

export function selectKnowledgeSources({
  userMessage = "",
  intent = "",
  selectedPromptSections = []
} = {}) {
  const normalizedMessage =
    normalizeText(userMessage);

  const normalizedIntent =
    normalizeText(intent);

  const selectedSources = new Set();

  const intentSources =
    INTENT_SOURCE_MAP[normalizedIntent] ||
    [];

  intentSources.forEach((source) =>
    selectedSources.add(source)
  );

  for (const [source, patterns] of Object.entries(
    SOURCE_PATTERNS
  )) {
    if (
      matchesAny(
        normalizedMessage,
        patterns
      )
    ) {
      selectedSources.add(source);
    }
  }

  /*
   * Integração com o Prompt Router.
   * Os módulos escolhidos pelo prompt ajudam a definir
   * quais fontes factuais provavelmente serão necessárias.
   */
  if (
    selectedPromptSections.includes(
      "discovery-and-villas"
    )
  ) {
    selectedSources.add(
      "villa_inventory"
    );
  }

  if (
    selectedPromptSections.includes(
      "pricing-and-booking"
    )
  ) {
    selectedSources.add("rate_rules");
  }

  if (
    selectedPromptSections.includes(
      "policies-and-services"
    )
  ) {
    const hasServiceQuestion =
      matchesAny(
        normalizedMessage,
        SOURCE_PATTERNS.guest_services
      );

    const hasPolicyQuestion =
      matchesAny(
        normalizedMessage,
        SOURCE_PATTERNS.policies
      );

    if (hasServiceQuestion) {
      selectedSources.add(
        "guest_services"
      );
    }

    if (hasPolicyQuestion) {
      selectedSources.add("policies");
    }
  }

if (
  selectedPromptSections.includes(
    "recovery-and-handoff"
  )
) {
  selectedSources.add(
    "commercial_strategy"
  );
}    


  /*
   * Saudações e conversas puramente sociais não precisam
   * carregar todos os arquivos de conhecimento.
   */
  return [...selectedSources];
}

export {
  SOURCE_PATTERNS,
  INTENT_SOURCE_MAP
};