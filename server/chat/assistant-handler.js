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

function generateSessionId() {
  return (
    "session_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}

function normalizeText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function extractVillaNames(text = "") {
  const normalizedText = String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const villaAliases = [
    {
      canonical: "Casa Grande",
      aliases: ["casa grande"]
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
      aliases: ["casa manga"]
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
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    /reserv|book|confirm|deposit|sinal|payment|pagamento/.test(
      normalized
    )
  ) {
    return "booking_request";
  }

  if (
    /dispon|available|availability|vaga/.test(
      normalized
    )
  ) {
    return "availability_question";
  }

  if (
    /preco|price|rate|tarifa|valor|quanto/.test(
      normalized
    )
  ) {
    return "pricing_question";
  }

  if (
    /qual casa|which villa|recommend|recomenda|melhor casa/.test(
      normalized
    )
  ) {
    return "villa_recommendation";
  }

  if (
    extractedData?.travel_dates
  ) {
    return "date_information";
  }

  if (
    extractedData?.guests
  ) {
    return "guest_information";
  }

  return "general_conversation";
}

function buildOperationalContext(req) {
  const body = req.body || {};

  return {
    source:
      body.operational_context?.source ||
      "casas_da_vila_chat",

    inventory:
      body.operational_context?.inventory ||
      null,

    availability:
      body.operational_context?.availability ||
      null,

    pricing:
      body.operational_context?.pricing ||
      null,

    policies:
      body.operational_context?.policies ||
      null,

    included_services:
      body.operational_context?.included_services ||
      null,

    reservation_status:
      body.operational_context?.reservation_status ||
      null,

    human_contact: {
      whatsapp: "+55 73 99143-5522"
    }
  };
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
        .slice(-8)
        .map((item) => ({
          role: item.role,
          content: item.content.slice(0, 3000)
        }))
    : [];

  safeHistory.push({
    role: "user",
    content: message
  });

  return safeHistory;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const body = req.body || {};

    const message = normalizeText(
      body.message
    );

    if (!message) {
      return res.status(400).json({
        error: "Message required"
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
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

    const intent = inferIntent({
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

    const operationalContext =
      buildOperationalContext(req);

    const agent = await loadAgent(
  body.agent || "olivia"
);

const systemPrompt =
  agent.buildSystemPrompt({
    conversationContext,
    operationalContext
  });

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

      profile:
        previousState.profile ||
        extractedData.profile ||
        null,

      last_intent: intent,

      recommended_villas:
        recommendedVillas.length > 0
          ? recommendedVillas
          : previousState.recommended_villas ||
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
            previousState.profile ||
            extractedData.profile ||
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

      model:
        completion.model,

      usage:
        completion.usage
    });
  } catch (error) {
    console.error(
      "OLIVIA LLM ERROR:",
      error
    );

    const isConfigurationError =
      String(error?.message || "").includes(
        "GROQ_API_KEY"
      );

    return res.status(
      isConfigurationError ? 503 : 500
    ).json({
      ok: false,

      error:
        isConfigurationError
          ? "Olivia is temporarily unavailable."
          : "Unable to generate Olivia response.",

      message:
        process.env.NODE_ENV ===
        "development"
          ? error?.message || String(error)
          : undefined
    });
  }
}