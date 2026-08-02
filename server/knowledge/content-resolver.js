function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function extractGuestCount(text) {
  const normalized = normalizeText(text);

  const numberMatch = normalized.match(
    /\b(\d{1,2})\s*(hospedes|hospede|guests?|pessoas?|people|adultos?|adults?)\b/
  );

  if (numberMatch) {
    return Number(numberMatch[1]);
  }

  const wordNumbers = {
    casal: 2,
    couple: 2,
    dois: 2,
    duas: 2,
    two: 2,
    tres: 3,
    três: 3,
    three: 3,
    quatro: 4,
    four: 4,
    cinco: 5,
    five: 5,
    seis: 6,
    six: 6,
    sete: 7,
    seven: 7,
    oito: 8,
    eight: 8,
    nove: 9,
    nine: 9,
    dez: 10,
    ten: 10
  };

  for (const [word, count] of Object.entries(wordNumbers)) {
    if (normalized.includes(word)) {
      return count;
    }
  }

  return null;
}

function findMentionedVillaNames(text) {
  const normalized = normalizeText(text);

  const aliases = [
    {
      canonical: "Casa Grande",
      values: ["casa grande"]
    },
    {
      canonical: "Casa Rosada",
      values: ["casa rosada", "casa rosa"]
    },
    {
      canonical: "Casa Manga",
      values: ["casa manga"]
    },
    {
      canonical: "Ateliê Azul",
      values: [
        "atelie azul",
        "atelier azul",
        "blue atelier"
      ]
    },
    {
      canonical: "Casa Oca",
      values: ["casa oca", "oca"]
    },
    {
      canonical: "Casa Dendê",
      values: ["casa dende", "dende"]
    },
    {
      canonical: "Casa Branca",
      values: ["casa branca", "asa branca"]
    },
    {
      canonical: "Casa dos Balões",
      values: [
        "casa dos baloes",
        "casa baloes",
        "baloes"
      ]
    }
  ];

  return aliases
    .filter(({ values }) =>
      values.some((alias) =>
        normalized.includes(alias)
      )
    )
    .map(({ canonical }) => canonical);
}

function getArrayFromObject(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const candidateKeys = [
    "villas",
    "houses",
    "inventory",
    "items",
    "accommodations"
  ];

  for (const key of candidateKeys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }

  return [];
}

function getVillaName(villa) {
  return (
    villa?.name ||
    villa?.villa_name ||
    villa?.title ||
    villa?.display_name ||
    villa?.slug ||
    ""
  );
}

function getVillaCapacity(villa) {
  const candidates = [
    villa?.capacity,
    villa?.max_guests,
    villa?.maximum_occupancy,
    villa?.occupancy,
    villa?.guests
  ];

  for (const value of candidates) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function resolveInventory({
  inventory,
  userMessage
}) {
  const villas = getArrayFromObject(inventory);

  if (villas.length === 0) {
    return inventory;
  }

  const mentionedNames =
    findMentionedVillaNames(userMessage);

  const guestCount =
    extractGuestCount(userMessage);

  let selected = villas;

  if (mentionedNames.length > 0) {
    selected = villas.filter((villa) => {
      const name = normalizeText(
        getVillaName(villa)
      );

      return mentionedNames.some(
        (mentioned) =>
          name.includes(
            normalizeText(mentioned)
          )
      );
    });
  } else if (guestCount) {
    selected = villas.filter((villa) => {
      const capacity =
        getVillaCapacity(villa);

      return (
        capacity !== null &&
        capacity >= guestCount
      );
    });
  }

  /*
   * Evita devolver o inventário inteiro.
   * Para recomendações genéricas, limita às primeiras
   * quatro opções compatíveis.
   */
  const limited = selected.slice(0, 4);

  return {
    query: {
      mentioned_villas:
        mentionedNames,
      guest_count:
        guestCount
    },

    matched_villas:
      limited,

    total_matches:
      selected.length
  };
}

function resolveFaq({
  faq,
  userMessage
}) {
  if (!faq) {
    return faq;
  }

  const normalized =
    normalizeText(userMessage);

  const items =
    Array.isArray(faq)
      ? faq
      : Array.isArray(faq.items)
        ? faq.items
        : Array.isArray(faq.faq)
          ? faq.faq
          : [];

  if (items.length === 0) {
    return faq;
  }

  const scored = items
    .map((item) => {
      const searchable =
        normalizeText(
          JSON.stringify(item)
        );

      const words =
        normalized
          .split(/\s+/)
          .filter((word) =>
            word.length >= 4
          );

      const score =
        words.filter((word) =>
          searchable.includes(word)
        ).length;

      return {
        item,
        score
      };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item }) => item);

  return scored.length > 0
    ? scored
    : [];
}

export function resolveKnowledgeContent({
  knowledge = {},
  userMessage = ""
} = {}) {
  const resolved = {};

  for (const [moduleName, data] of Object.entries(
    knowledge
  )) {
    if (moduleName === "inventory") {
      resolved.inventory =
        resolveInventory({
          inventory: data,
          userMessage
        });

      continue;
    }

    if (moduleName === "faq") {
      resolved.faq =
        resolveFaq({
          faq: data,
          userMessage
        });

      continue;
    }

    /*
     * Os demais módulos continuam integrais nesta etapa.
     * Depois poderemos criar resolvers específicos para
     * rate_rules, policies e experiences.
     */
    resolved[moduleName] = data;
  }

  return resolved;
}