const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODEL = "openai/gpt-oss-20b";

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new TypeError(
      "Groq messages must be a non-empty array."
    );
  }

  for (const message of messages) {
    if (
      !message ||
      typeof message !== "object" ||
      !["system", "user", "assistant"].includes(message.role) ||
      typeof message.content !== "string"
    ) {
      throw new TypeError(
        "Every Groq message must contain a valid role and string content."
      );
    }
  }
}

function normalizeGroqError(data, status) {
  return (
    data?.error?.message ||
    data?.message ||
    `Groq request failed with HTTP ${status}.`
  );
}

export async function generateGroqCompletion({
  messages,
  temperature = 0.3,
  maxTokens = 700,
  model = process.env.GROQ_MODEL || DEFAULT_MODEL
}) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GROQ_API_KEY environment variable."
    );
  }

  validateMessages(messages);

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 25000);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",

      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },

      signal: controller.signal,

      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_completion_tokens: maxTokens,
        stream: false
      })
    });

    const data = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      const message = normalizeGroqError(
        data,
        response.status
      );

      console.error("Groq API error:", {
        status: response.status,
        message,
        model
      });

      throw new Error(message);
    }

    const text =
      data?.choices?.[0]?.message?.content;

    if (
      typeof text !== "string" ||
      !text.trim()
    ) {
      throw new Error(
        "Groq returned an empty completion."
      );
    }

    return {
      text: text.trim(),
      model: data?.model || model,
      usage: data?.usage || null,
      id: data?.id || null
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        "Groq request timed out."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}