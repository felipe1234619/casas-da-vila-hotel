import {
  selectKnowledgeSources
} from "./router.js";

import {
  loadKnowledgeSources
} from "./loader.js";

export async function buildOperationalKnowledge({
  userMessage = "",
  intent = "",
  selectedPromptSections = [],
  runtimeContext = {}
} = {}) {
  const selectedSources =
    selectKnowledgeSources({
      userMessage,
      intent,
      selectedPromptSections
    });

  const {
    knowledge,
    loadedSources,
    missingSources,
    sourceFiles
  } = await loadKnowledgeSources(
    selectedSources
  );

  /*
   * Dados operacionais fornecidos por integrações,
   * como disponibilidade real ou resultado de preços,
   * têm prioridade e são adicionados separadamente.
   */
  const operationalContext = {
    knowledge,

    runtime: {
      availability:
        runtimeContext.availability ||
        null,

      pricing:
        runtimeContext.pricing ||
        null,

      reservation_status:
        runtimeContext.reservation_status ||
        null,

      payment_status:
        runtimeContext.payment_status ||
        null,

      hold_status:
        runtimeContext.hold_status ||
        null
    },

    official_contact: {
      whatsapp:
        "+55 73 99143-5522"
    }
  };

  return {
    operationalContext,
    selectedSources,
    loadedSources,
    missingSources,
    sourceFiles
  };
}

export {
  selectKnowledgeSources
} from "./router.js";

export {
  loadKnowledgeSource,
  loadKnowledgeSources,
  clearKnowledgeCache,
  listConfiguredSources
} from "./loader.js";