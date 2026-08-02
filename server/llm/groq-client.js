const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

export async function generateGroqResponse({
  apiKey,
  systemPrompt,
  userMessage,
  model = "llama-3.3-70b-versatile",
  temperature = 0.2
}) {
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(
      `Groq API ${response.status}`
    );
  }

  const json = await response.json();

  return json.choices?.[0]?.message?.content || "";
}