import {
  loadKnowledgeCatalog,
  loadKnowledgeRouter
} from "./catalog.js";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeKeyword(value) {
  return normalizeText(value);
}

function sourceFileToModuleName(
  source,
  catalog
) {
  if (!source || source === "booking_system") {
    return null;
  }

  for (
    const [
      moduleName,
      definition
    ] of Object.entries(
      catalog.modules || {}
    )
  ) {
    if (
      definition?.file === source
    ) {
      return moduleName;
    }
  }

  return null;
}

function calculateRouteScore(
  normalizedMessage,
  route
) {
  const keywords =
    Array.isArray(route.keywords)
      ? route.keywords
      : [];

  let matches = 0;

  for (const keyword of keywords) {
    const normalizedKeyword =
      normalizeKeyword(keyword);

    if (
      normalizedKeyword &&
      normalizedMessage.includes(
        normalizedKeyword
      )
    ) {
      matches += 1;
    }
  }

  if (matches === 0) {
    return 0;
  }

  const priority =
    Number(route.priority) || 1;

  return matches * 100 - priority;
}

export async function resolveKnowledgeRoute({
  userMessage = "",
  intent = ""
} = {}) {
  const [catalog, router] =
    await Promise.all([
      loadKnowledgeCatalog(),
      loadKnowledgeRouter()
    ]);

  const normalizedInput =
    normalizeText(
      `${intent} ${userMessage}`
    );

  const rankedRoutes =
    router.routes
      .map((route) => ({
        route,
        score:
          calculateRouteScore(
            normalizedInput,
            route
          )
      }))
      .filter(
        ({ score }) => score > 0
      )
      .sort(
        (a, b) => b.score - a.score
      );

  const selectedModules =
    new Set();

  const matchedRoutes = [];

  /*
   * validation_rules.json é obrigatório
   * segundo router.json.
   */
  const validationSource =
    router.validation?.always_check;

  const validationModule =
    sourceFileToModuleName(
      validationSource,
      catalog
    );

  if (validationModule) {
    selectedModules.add(
      validationModule
    );
  }

  for (const {
    route,
    score
  } of rankedRoutes) {
    matchedRoutes.push({
      intent: route.intent,
      source: route.source,
      priority: route.priority,
      score
    });

    const moduleName =
      sourceFileToModuleName(
        route.source,
        catalog
      );

    if (moduleName) {
      selectedModules.add(
        moduleName
      );
    }
  }

  const requiresBookingSystem =
    rankedRoutes.some(
      ({ route }) =>
        route.source ===
        "booking_system"
    );

  /*
   * Fallback do router.json.
   */
  if (
    selectedModules.size ===
      (validationModule ? 1 : 0) &&
    router.fallback?.source
  ) {
    const fallbackModule =
      sourceFileToModuleName(
        router.fallback.source,
        catalog
      );

    if (fallbackModule) {
      selectedModules.add(
        fallbackModule
      );
    }
  }

  return {
    selectedModules: [
      ...selectedModules
    ],

    matchedRoutes,

    requiresBookingSystem,

    fallbackMessage:
      router.fallback?.if_unknown ||
      catalog.knowledge_rules
        ?.unknown_information_response ||
      null,

    neverAnswerWithoutSource:
      router.validation
        ?.never_answer_without_source ===
      true
  };
}