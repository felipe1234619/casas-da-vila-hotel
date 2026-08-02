import {
  resolveKnowledgeContent
} from "./content-resolver.js";

import {
  loadCatalogModules
} from "./catalog.js";

import {
  resolveKnowledgeRoute
} from "./resolver.js";

export async function buildKnowledgeRuntime({
  userMessage = "",
  intent = "",
  runtimeContext = {}
} = {}) {
  const route =
    await resolveKnowledgeRoute({
      userMessage,
      intent
    });

  const loaded =
    await loadCatalogModules(
      route.selectedModules
    );

  const operationalContext = {
    verified_knowledge:
  resolveKnowledgeContent({
    knowledge: loaded.knowledge,
    userMessage
  }),
    live_runtime: {
      availability:
        runtimeContext.availability ||
        null,

      pricing:
        runtimeContext.pricing ||
        null,

      reservation_status:
        runtimeContext
          .reservation_status ||
        null,

      payment_status:
        runtimeContext
          .payment_status ||
        null,

      hold_status:
        runtimeContext.hold_status ||
        null
    },

    routing: {
      matched_routes:
        route.matchedRoutes,

      requires_booking_system:
        route.requiresBookingSystem,

      never_answer_without_source:
        route.neverAnswerWithoutSource,

      fallback_message:
        route.fallbackMessage
    },

    official_contact: {
      whatsapp:
        "+55 73 99143-5522"
    }
  };

  return {
    operationalContext,

    selectedModules:
      route.selectedModules,

    matchedRoutes:
      route.matchedRoutes,

    requiresBookingSystem:
      route.requiresBookingSystem,

    loadedModules:
      loaded.loadedModules,

    missingModules:
      loaded.missingModules,

    files:
      loaded.files
  };
}