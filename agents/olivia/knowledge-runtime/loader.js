import {
  readFile
} from "node:fs/promises";

const SOURCE_FILES = Object.freeze({
  villa_inventory: [
    new URL(
      "../../../knowledge/inventory.json",
      import.meta.url
    )
  ],

  rate_rules: [
    new URL(
      "../../../knowledge/rate_rules.json",
      import.meta.url
    )
  ],

  policies: [
    new URL(
      "../../../knowledge/policies.json",
      import.meta.url
    )
  ],

  guest_services: [
    new URL(
      "../../../knowledge/experiences.json",
      import.meta.url
    )
  ],

  knowledge_base: [
    new URL(
      "../../../knowledge/faq.json",
      import.meta.url
    )
  ],

  commercial_strategy: [
    new URL(
      "../../../knowledge/commercial_strategy.json",
      import.meta.url
    )
  ],

  ranking_rules: [
    new URL(
      "../../../knowledge/ranking_rules.json",
      import.meta.url
    )
  ],

  validation_rules: [
    new URL(
      "../../../knowledge/validation_rules.json",
      import.meta.url
    )
  ],

  glossary: [
    new URL(
      "../../../knowledge/glossary.json",
      import.meta.url
    )
  ],

  router: [
    new URL(
      "../../../knowledge/router.json",
      import.meta.url
    )
  ],

  index: [
    new URL(
      "../../../knowledge/index.json",
      import.meta.url
    )
  ]
});

const sourceCache = new Map();

async function readJsonFile(fileUrl) {
  const raw = await readFile(
    fileUrl,
    "utf8"
  );

  return JSON.parse(raw);
}

async function loadFirstExistingFile(
  candidates = []
) {
  let lastError = null;

  for (const fileUrl of candidates) {
    try {
      const data =
        await readJsonFile(fileUrl);

      return {
        data,
        file:
          fileUrl.pathname
            .split("/")
            .pop() || null
      };
    } catch (error) {
      lastError = error;

      if (
        error?.code !== "ENOENT"
      ) {
        throw error;
      }
    }
  }

  return {
    data: null,
    file: null,
    error: lastError
  };
}

export async function loadKnowledgeSource(
  sourceName,
  {
    useCache = true
  } = {}
) {
  const candidates =
    SOURCE_FILES[sourceName];

  if (!candidates) {
    return {
      source: sourceName,
      loaded: false,
      data: null,
      file: null,
      error:
        `Unknown knowledge source: ${sourceName}`
    };
  }

  if (
    useCache &&
    sourceCache.has(sourceName)
  ) {
    return sourceCache.get(
      sourceName
    );
  }

  try {
    const result =
      await loadFirstExistingFile(
        candidates
      );

    const response = {
      source: sourceName,
      loaded: Boolean(result.data),
      data: result.data,
      file: result.file,
      error:
        result.data
          ? null
          : `No file found for source: ${sourceName}`
    };

    if (useCache) {
      sourceCache.set(
        sourceName,
        response
      );
    }

    return response;
  } catch (error) {
    console.error(
      "Knowledge source loading error:",
      {
        sourceName,
        message:
          error?.message ||
          String(error)
      }
    );

    return {
      source: sourceName,
      loaded: false,
      data: null,
      file: null,
      error:
        error?.message ||
        String(error)
    };
  }
}

export async function loadKnowledgeSources(
  sourceNames = [],
  options = {}
) {
  const uniqueSources = [
    ...new Set(sourceNames)
  ];

  const results =
    await Promise.all(
      uniqueSources.map((sourceName) =>
        loadKnowledgeSource(
          sourceName,
          options
        )
      )
    );

  const knowledge = {};
  const loadedSources = [];
  const missingSources = [];
  const sourceFiles = {};

  for (const result of results) {
    if (
      result.loaded &&
      result.data !== null
    ) {
      knowledge[result.source] =
        result.data;

      loadedSources.push(
        result.source
      );

      sourceFiles[result.source] =
        result.file;
    } else {
      missingSources.push({
        source: result.source,
        error: result.error
      });
    }
  }

  return {
    knowledge,
    loadedSources,
    missingSources,
    sourceFiles
  };
}

export function clearKnowledgeCache() {
  sourceCache.clear();
}

export function listConfiguredSources() {
  return Object.keys(SOURCE_FILES);
}