const AGENT_LOADERS = Object.freeze({
  olivia: () =>
    import("../../agents/olivia/index.js")
});

function normalizeAgentId(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export async function loadAgent(
  agentId = "olivia"
) {
  const normalizedId =
    normalizeAgentId(agentId);

  const loader =
    AGENT_LOADERS[normalizedId];

  if (!loader) {
    throw new Error(
      `Unknown agent: ${normalizedId}`
    );
  }

  const module = await loader();

  const agent =
    module.default ||
    module.oliviaAgent;

  if (
    !agent ||
    typeof agent.buildSystemPrompt !==
      "function"
  ) {
    throw new TypeError(
      `Agent "${normalizedId}" is invalid`
    );
  }

  return agent;
}

export function listAvailableAgents() {
  return Object.keys(AGENT_LOADERS);
}