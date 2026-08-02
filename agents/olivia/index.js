import {
  buildOliviaSystemPrompt
} from "./prompts/index.js";

export const oliviaAgent = Object.freeze({
  id: "olivia",
  name: "Olivia",
  role: "Private Villa Concierge",
  property: "Casas da Vila Trancoso",

  supportedLanguages: [
    "pt-BR",
    "en",
    "es"
  ],

  officialWhatsApp:
    "+55 73 99143-5522",

  knowledgeManifest:
    "./knowledge.json",

  buildSystemPrompt({
    conversationContext = {},
    operationalContext = {},
    additionalInstructions = ""
  } = {}) {
    return buildOliviaSystemPrompt({
      conversationContext,
      operationalContext,
      additionalInstructions
    });
  }
});

export default oliviaAgent;