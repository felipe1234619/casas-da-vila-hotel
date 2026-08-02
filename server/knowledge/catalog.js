import { readFile } from "node:fs/promises";

const KNOWLEDGE_DIRECTORY = new URL(
  "../../knowledge/",
  import.meta.url
);

const CATALOG_FILE = new URL(
  "../../knowledge/index.json",
  import.meta.url
);

const ROUTER_FILE = new URL(
  "../../knowledge/router.json",
  import.meta.url
);

let catalogCache = null;
let routerCache = null;
const moduleCache = new Map();

async function readJson(fileUrl) {
  const content = await readFile(fileUrl, "utf8");
  return JSON.parse(content);
}

export async function loadKnowledgeCatalog({
  useCache = true
} = {}) {
  if (useCache && catalogCache) {
    return catalogCache;
  }

  const catalog = await readJson(CATALOG_FILE);

  if (
    !catalog ||
    typeof catalog !== "object" ||
    !catalog.modules
  ) {
    throw new Error(
      "Invalid knowledge/index.json catalog."
    );
  }

  if (useCache) {
    catalogCache = catalog;
  }

  return catalog;
}

export async function loadKnowledgeRouter({
  useCache = true
} = {}) {
  if (useCache && routerCache) {
    return routerCache;
  }

  const router = await readJson(ROUTER_FILE);

  if (
    !router ||
    typeof router !== "object" ||
    !Array.isArray(router.routes)
  ) {
    throw new Error(
      "Invalid knowledge/router.json configuration."
    );
  }

  if (useCache) {
    routerCache = router;
  }

  return router;
}

export async function loadCatalogModule(
  moduleName,
  {
    useCache = true
  } = {}
) {
  const catalog =
    await loadKnowledgeCatalog({
      useCache
    });

  const moduleDefinition =
    catalog.modules?.[moduleName];

  if (!moduleDefinition) {
    return {
      module: moduleName,
      loaded: false,
      required: false,
      data: null,
      file: null,
      priority: null,
      error:
        `Unknown catalog module: ${moduleName}`
    };
  }

  if (
    useCache &&
    moduleCache.has(moduleName)
  ) {
    return moduleCache.get(moduleName);
  }

  const fileUrl = new URL(
    moduleDefinition.file,
    KNOWLEDGE_DIRECTORY
  );

  try {
    const data = await readJson(fileUrl);

    const result = {
      module: moduleName,
      loaded: true,
      required:
        moduleDefinition.required === true,
      data,
      file: moduleDefinition.file,
      priority:
        moduleDefinition.priority ?? null,
      description:
        moduleDefinition.description || null,
      error: null
    };

    if (useCache) {
      moduleCache.set(moduleName, result);
    }

    return result;
  } catch (error) {
    const result = {
      module: moduleName,
      loaded: false,
      required:
        moduleDefinition.required === true,
      data: null,
      file: moduleDefinition.file,
      priority:
        moduleDefinition.priority ?? null,
      description:
        moduleDefinition.description || null,
      error:
        error?.message || String(error)
    };

    if (result.required) {
      throw new Error(
        `Required knowledge module "${moduleName}" could not be loaded: ${result.error}`
      );
    }

    return result;
  }
}

export async function loadCatalogModules(
  moduleNames = [],
  options = {}
) {
  const uniqueModules = [
    ...new Set(moduleNames)
  ];

  const results = await Promise.all(
    uniqueModules.map((moduleName) =>
      loadCatalogModule(
        moduleName,
        options
      )
    )
  );

  const knowledge = {};
  const loadedModules = [];
  const missingModules = [];
  const files = {};

  for (const result of results) {
    if (result.loaded) {
      knowledge[result.module] =
        result.data;

      loadedModules.push(
        result.module
      );

      files[result.module] =
        result.file;
    } else {
      missingModules.push({
        module: result.module,
        required: result.required,
        error: result.error
      });
    }
  }

  return {
    knowledge,
    loadedModules,
    missingModules,
    files
  };
}

export function clearKnowledgeCatalogCache() {
  catalogCache = null;
  routerCache = null;
  moduleCache.clear();
}