const ROUTE_PATTERNS = Object.freeze({
  villas: [
    /villa/i,
    /casa/i,
    /resid[eê]ncia/i,
    /acomoda[cç][aã]o/i,
    /hospedagem/i,
    /capacity/i,
    /capacidade/i,
    /h[oó]spedes/i,
    /guests?/i,
    /quarto/i,
    /su[ií]te/i,
    /bedroom/i,
    /pool/i,
    /piscina/i,
    /casa grande/i,
    /casa rosada/i,
    /casa rosa/i,
    /casa manga/i,
    /casa oca/i,
    /casa dend[eê]/i,
    /casa branca/i,
    /casa dos bal[oõ]es/i,
    /casa bal[oõ]es/i,
    /ateli[eê] azul/i,
    /atelier azul/i
  ],

  pricing: [
    /pre[cç]o/i,
    /valor/i,
    /tarifa/i,
    /di[aá]ria/i,
    /quanto custa/i,
    /rate/i,
    /price/i,
    /cost/i,
    /discount/i,
    /desconto/i,
    /promo[cç][aã]o/i,
    /payment/i,
    /pagamento/i,
    /deposit/i,
    /dep[oó]sito/i,
    /sinal/i
  ],

  booking: [
    /reserv/i,
    /book/i,
    /availability/i,
    /disponibilidade/i,
    /available/i,
    /dispon[ií]vel/i,
    /check[- ]?in/i,
    /check[- ]?out/i,
    /confirm/i,
    /hold/i,
    /segurar.*data/i,
    /bloquear.*data/i,
    /cancel/i,
    /reembolso/i,
    /refund/i
  ],

  policies: [
    /pol[ií]tica/i,
    /regra/i,
    /rule/i,
    /pet/i,
    /cachorro/i,
    /animal/i,
    /crian[cç]a/i,
    /children/i,
    /smoking/i,
    /fumar/i,
    /sil[eê]ncio/i,
    /noise/i,
    /barulho/i,
    /festa/i,
    /party/i,
    /evento/i,
    /event/i,
    /estacionamento/i,
    /parking/i
  ],

  services: [
    /servi[cç]o/i,
    /service/i,
    /transfer/i,
    /transporte/i,
    /chef/i,
    /cozinheiro/i,
    /jantar/i,
    /restaurant/i,
    /restaurante/i,
    /praia/i,
    /beach/i,
    /experi[eê]ncia/i,
    /experience/i,
    /passeio/i,
    /atividade/i,
    /concierge/i
  ],

  humanHandoff: [
    /whatsapp/i,
    /humano/i,
    /human/i,
    /pessoa/i,
    /atendente/i,
    /equipe/i,
    /reservations team/i,
    /falar com algu[eé]m/i,
    /speak.*someone/i,
    /gerente/i,
    /manager/i
  ],

  recovery: [
    /errado/i,
    /incorreto/i,
    /wrong/i,
    /mistake/i,
    /voc[eê] disse/i,
    /you said/i,
    /n[aã]o foi isso/i,
    /reclama/i,
    /frustrad/i,
    /irritad/i
  ],

  languageAndVoice: [
    /portugu[eê]s/i,
    /english/i,
    /ingl[eê]s/i,
    /espa[nñ]ol/i,
    /spanish/i,
    /idioma/i,
    /language/i,
    /voz/i,
    /voice/i
  ]
});

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

export function selectOliviaPromptSections({
  userMessage = "",
  intent = ""
} = {}) {
  const text = normalizeText(
    `${intent} ${userMessage}`
  );

  const selected = new Set([
    "identity",
    "communication",
    "truth-and-safety"
  ]);

  const villaQuestion =
    matchesAny(text, ROUTE_PATTERNS.villas);

  const pricingQuestion =
    matchesAny(text, ROUTE_PATTERNS.pricing);

  const bookingQuestion =
    matchesAny(text, ROUTE_PATTERNS.booking);

  const policyQuestion =
    matchesAny(text, ROUTE_PATTERNS.policies);

  const serviceQuestion =
    matchesAny(text, ROUTE_PATTERNS.services);

  const handoffQuestion =
    matchesAny(text, ROUTE_PATTERNS.humanHandoff);

  const recoveryQuestion =
    matchesAny(text, ROUTE_PATTERNS.recovery);

  const languageQuestion =
    matchesAny(text, ROUTE_PATTERNS.languageAndVoice);

  if (villaQuestion) {
    selected.add("discovery-and-villas");
  }

  if (pricingQuestion || bookingQuestion) {
    selected.add("pricing-and-booking");
  }

  if (policyQuestion || serviceQuestion) {
    selected.add("policies-and-services");
  }

  if (handoffQuestion || recoveryQuestion) {
    selected.add("recovery-and-handoff");
  }

  if (languageQuestion) {
    selected.add("multilingual-and-voice");
  }

  if (
    pricingQuestion ||
    bookingQuestion ||
    policyQuestion ||
    recoveryQuestion
  ) {
    selected.add("checklists");
  }

  /*
   * Para uma conversa genérica sobre hospedagem,
   * o módulo de descoberta é o mais útil.
   */
  if (selected.size === 3) {
    selected.add("discovery-and-villas");
  }

  return [...selected];
}