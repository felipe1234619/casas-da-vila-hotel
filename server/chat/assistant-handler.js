import {
  buildConversationContext
} from "../../engine/state/conversation-context.js";

import {
  calculateSalesStage
} from "../../engine/state/sales-stage.js";

import {
  extractConversationData
} from "../../engine/state/memory-extractor.js";

import {
  getConversationState,
  updateConversationState
} from "../../engine/state/conversation-state.js";

import {
  generateGroqCompletion
} from "./llm/groq-client.js";

import {
  loadAgent
} from "../agents/load-agent.js";

import {
  buildKnowledgeRuntime
} from "../knowledge/runtime-builder.js";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_MESSAGE_LENGTH = 2000;

function generateSessionId() {
  return [
    "session",
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2, 10)
  ].join("_");
}

function normalizeText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeForMatching(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function extractVillaNames(text = "") {
  const normalizedText =
    normalizeForMatching(text);

  const villaAliases = [
    {
      canonical: "Casa Grande",
      aliases: [
        "casa grande"
      ]
    },
    {
      canonical: "Casa Rosada",
      aliases: [
        "casa rosada",
        "casa rosa"
      ]
    },
    {
      canonical: "Casa Manga",
      aliases: [
        "casa manga"
      ]
    },
    {
      canonical: "Ateliê Azul",
      aliases: [
        "atelie azul",
        "atelier azul",
        "blue atelier"
      ]
    },
    {
      canonical: "Casa Oca",
      aliases: [
        "casa oca",
        "oca"
      ]
    },
    {
      canonical: "Casa Dendê",
      aliases: [
        "casa dende",
        "dende"
      ]
    },
    {
      canonical: "Casa Branca",
      aliases: [
        "casa branca",
        "asa branca"
      ]
    },
    {
      canonical: "Casa dos Balões",
      aliases: [
        "casa dos baloes",
        "casa baloes",
        "baloes"
      ]
    }
  ];

  return villaAliases
    .filter(({ aliases }) =>
      aliases.some((alias) =>
        normalizedText.includes(alias)
      )
    )
    .map(({ canonical }) => canonical);
}

function inferIntent({
  message,
  extractedData
}) {
  const normalized =
    normalizeForMatching(message);

  if (
    /whatsapp|falar com alguem|atendente|equipe de reservas|reservations team|human assistance/.test(
      normalized
    )
  ) {
    return "human_handoff";
  }

  if (
    /pet|cachorro|animal|crianca|children|politica|policy|cancel|reembolso|refund|evento|festa|silencio|barulho|smoking|fumar/.test(
      normalized
    )
  ) {
    return "policy_question";
  }

  if (
    /transfer|transporte|chef|cozinheiro|jantar|restaurante|restaurant|experiencia|experience|passeio|atividade|massagem/.test(
      normalized
    )
  ) {
    return "services_question";
  }

  if (
    /reserv|book|confirm|deposit|sinal|payment|pagamento|checkout|pix/.test(
      normalized
    )
  ) {
    return "booking_request";
  }

  if (
    /dispon|available|availability|vaga|calendar|calendario/.test(
      normalized
    )
  ) {
    return "availability_question";
  }

  if (
    /preco|price|rate|tarifa|valor|quanto custa|desconto|discount/.test(
      normalized
    )
  ) {
    return "pricing_question";
  }

  if (
    /qual casa|which villa|recommend|recomenda|melhor casa|best villa|comparar|compare/.test(
      normalized
    )
  ) {
    return "villa_recommendation";
  }

  if (extractedData?.travel_dates) {
    return "date_information";
  }

  if (extractedData?.guests) {
    return "guest_information";
  }

  return "general_conversation";
}

function buildRecentMessages({
  history,
  message
}) {
  const safeHistory = Array.isArray(history)
    ? history
        .filter(
          (item) =>
            item &&
            ["user", "assistant"].includes(
              item.role
            ) &&
            typeof item.content === "string"
        )
        .slice(-MAX_HISTORY_MESSAGES)
        .map((item) => ({
          role: item.role,
          content:
            item.content
              .trim()
              .slice(
                0,
                MAX_HISTORY_MESSAGE_LENGTH
              )
        }))
        .filter((item) => item.content)
    : [];

  const lastHistoryMessage =
    safeHistory[
      safeHistory.length - 1
    ];

  const currentMessageAlreadyIncluded =
    lastHistoryMessage?.role === "user" &&
    lastHistoryMessage.content === message;

  if (!currentMessageAlreadyIncluded) {
    safeHistory.push({
      role: "user",
      content: message
    });
  }

  return safeHistory;
}

function getRuntimeContext(body) {
  const operationalContext =
    body?.operational_context;

  return operationalContext &&
    typeof operationalContext === "object"
    ? operationalContext
    : {};
}

function getPromptContent(promptResult) {
  if (typeof promptResult === "string") {
    return {
      systemPrompt: promptResult,
      selectedSections: []
    };
  }

  const systemPrompt =
    promptResult?.prompt;

  if (
    typeof systemPrompt !== "string" ||
    !systemPrompt.trim()
  ) {
    throw new Error(
      "Olivia agent returned an invalid system prompt."
    );
  }

  return {
    systemPrompt,
    selectedSections:
      Array.isArray(
        promptResult.selectedSections
      )
        ? promptResult.selectedSections
        : []
  };
}

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    const body =
      req.body &&
      typeof req.body === "object"
        ? req.body
        : {};

    const message =
      normalizeText(body.message);

    if (!message) {
      return res.status(400).json({
        ok: false,
        error: "Message required"
      });
    }

    if (
      message.length >
      MAX_MESSAGE_LENGTH
    ) {
      return res.status(400).json({
        ok: false,
        error: "Message is too long"
      });
    }

    const currentSessionId =
      normalizeText(body.sessionId) ||
      normalizeText(body.session_id) ||
      generateSessionId();

    const previousState =
      getConversationState(
        currentSessionId
      ) || {};

    const extractedData =
      extractConversationData(
        message
      ) || {};

    const intent =
      inferIntent({
        message,
        extractedData
      });

    const enrichedMemory = {
      ...previousState,
      ...extractedData,
      last_intent: intent
    };

    const conversationContext =
      buildConversationContext(
        enrichedMemory
      );

    /*
     * Carrega o agente solicitado.
     * Olivia permanece como agente padrão.
     */
    const agent =
      await loadAgent(
        normalizeText(body.agent) ||
          "olivia"
      );

    /*
     * O Knowledge Runtime consulta:
     *
     * knowledge/index.json
     * knowledge/router.json
     *
     * e carrega apenas os módulos factuais
     * relevantes para a mensagem atual.
     */
    const knowledgeRuntime =
      await buildKnowledgeRuntime({
        userMessage: message,
        intent,
        runtimeContext:
          getRuntimeContext(body)
      });

    /*
     * O Prompt Router seleciona apenas os
     * módulos comportamentais necessários.
     */
    const promptResult =
      agent.buildSystemPrompt({
        userMessage: message,
        intent,
        conversationContext,
        operationalContext:
          knowledgeRuntime
            .operationalContext
      });

    const {
      systemPrompt,
      selectedSections
    } = getPromptContent(
      promptResult
    );

    console.info(
      "Olivia runtime:",
      {
        sessionId:
          currentSessionId,

        intent,

        selectedPromptSections:
          selectedSections,

        selectedKnowledgeModules:
          knowledgeRuntime
            .selectedModules,

        loadedKnowledgeModules:
          knowledgeRuntime
            .loadedModules,

        missingKnowledgeModules:
          knowledgeRuntime
            .missingModules,

        matchedRoutes:
          knowledgeRuntime
            .matchedRoutes,

        requiresBookingSystem:
          knowledgeRuntime
            .requiresBookingSystem,

        knowledgeFiles:
          knowledgeRuntime.files,

        promptCharacters:
          systemPrompt.length
      }
    );

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...buildRecentMessages({
        history:
          body.history ||
          body.messages ||
          [],
        message
      })
    ];

    const completion =
      await generateGroqCompletion({
        messages,
        temperature: 0.3,
        maxTokens: 700
      });

    const recommendedVillas =
      extractVillaNames(
        completion.text
      );

    const newState = {
      ...previousState,
      ...extractedData,

      profile:
        extractedData.profile ||
        previousState.profile ||
        null,

      last_intent: intent,

      recommended_villas:
        recommendedVillas.length > 0
          ? recommendedVillas
          : previousState
              .recommended_villas ||
            [],

      travel_dates:
        extractedData.travel_dates ||
        previousState.travel_dates ||
        null,

      guests:
        extractedData.guests ||
        previousState.guests ||
        null,

      trip_type:
        extractedData.trip_type ||
        previousState.trip_type ||
        null,

      sales_stage:
        calculateSalesStage({
          ...previousState,
          ...extractedData,

          profile:
            extractedData.profile ||
            previousState.profile ||
            null,

          last_intent: intent
        }),

      updated_at:
        new Date().toISOString()
    };

    updateConversationState(
      currentSessionId,
      newState
    );

    return res.status(200).json({
      ok: true,

      sessionId:
        currentSessionId,

      session_id:
        currentSessionId,

      response:
        completion.text,

      message:
        completion.text,

      intent,

      profile:
        newState.profile,

      memory:
        newState,

      routing: {
        prompt_sections:
          selectedSections,

        knowledge_modules:
          knowledgeRuntime
            .loadedModules,

        requires_booking_system:
          knowledgeRuntime
            .requiresBookingSystem
      },

      model:
        completion.model,

      usage:
        completion.usage
    });
  } catch (error) {
    console.error(
      "OLIVIA LLM ERROR:",
      {
        message:
          error?.message ||
          String(error),

        stack:
          error?.stack ||
          null
      }
    );

    const errorMessage =
      String(
        error?.message || ""
      );

    const isConfigurationError =
      errorMessage.includes(
        "GROQ_API_KEY"
      );

    const isRateLimitError =
      errorMessage.includes(
        "tokens per minute"
      ) ||
      errorMessage.includes(
        "Request too large"
      ) ||
      errorMessage.includes(
        "rate limit"
      );

    const statusCode =
      isConfigurationError
        ? 503
        : isRateLimitError
          ? 429
          : 500;

    return res
      .status(statusCode)
      .json({
        ok: false,

        error:
          isConfigurationError
            ? "Olivia is temporarily unavailable."
            : isRateLimitError
              ? "Olivia received more information than could be processed at once."
              : "Unable to generate Olivia response.",

        message:
          process.env.NODE_ENV ===
          "development"
            ? errorMessage
            : undefined
      });
  }
}