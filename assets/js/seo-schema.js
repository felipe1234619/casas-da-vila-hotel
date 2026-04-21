(() => {
  const ORIGIN = "https://casasdavila.com";

  const pageKey = document.documentElement.dataset.seoPage;
  if (!pageKey) return;

  function injectSchema(obj) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(obj);
    document.head.appendChild(script);
  }

  /* =========================
     BASE BUSINESS (GLOBAL)
  ========================= */
  const baseBusiness = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "name": "Casas da Vila",
    "url": ORIGIN,
    "image": `${ORIGIN}/assets/meta/og/og-home.jpg`,
    "description": "Boutique tropical stay in Trancoso with authorial houses, garden, pool and breakfast included.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Trancoso",
      "addressRegion": "BA",
      "addressCountry": "BR"
    }
  };

  /* =========================
     WEB SITE (GLOBAL)
  ========================= */
  const webSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Casas da Vila",
    "url": ORIGIN
  };

  /* =========================
     BREADCRUMB BUILDER
  ========================= */
  function breadcrumb(items) {
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": items.map((item, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": item.name,
        "item": item.url
      }))
    };
  }

  /* =========================
     HOUSE SCHEMA (GENÉRICO)
  ========================= */
  function houseSchema(name, slug, locale = "pt") {
    const basePath = locale === "pt" ? "/pt/casas/" : "/en/houses/";
    return {
      "@context": "https://schema.org",
      "@type": "LodgingBusiness",
      "name": name,
      "url": `${ORIGIN}${basePath}${slug}/`,
      "image": `${ORIGIN}/assets/meta/og/og-houses.jpg`,
      "description": `House ${name} at Casas da Vila in Trancoso.`,
      "containedInPlace": {
        "@type": "Place",
        "name": "Casas da Vila"
      }
    };
  }

  /* =========================
     SWITCH POR PÁGINA
  ========================= */

  // HOME
  if (pageKey === "home-pt" || pageKey === "home-en") {
    injectSchema(baseBusiness);
    injectSchema(webSite);
  }

  // HOUSES INDEX
  if (pageKey === "houses-pt" || pageKey === "houses-en") {
    injectSchema(baseBusiness);

    injectSchema(
      breadcrumb([
        { name: "Home", url: `${ORIGIN}` },
        { name: "Casas", url: `${ORIGIN}/pt/casas/` }
      ])
    );
  }

  // BOOKING
  if (pageKey === "book-pt" || pageKey === "book-en") {
    injectSchema(baseBusiness);
  }

  // CONTACT
  if (pageKey === "contact-pt" || pageKey === "contact-en") {
    injectSchema(baseBusiness);
  }

  // LOCATION
  if (pageKey === "location-pt" || pageKey === "location-en") {
    injectSchema(baseBusiness);
  }

  // EXPERIENCES
  if (pageKey === "experiences-pt" || pageKey === "experiences-en") {
    injectSchema(baseBusiness);
  }

  // POLICIES
  if (pageKey === "policies-pt" || pageKey === "policies-en") {
    injectSchema(baseBusiness);
  }

  /* =========================
     CASAS INDIVIDUAIS PT
  ========================= */

  if (pageKey === "house-pt-casa-grande") {
    injectSchema(houseSchema("Casa Grande", "casa-grande", "pt"));
  }

  if (pageKey === "house-pt-casa-branca") {
    injectSchema(houseSchema("Casa Branca", "casa-branca", "pt"));
  }

  if (pageKey === "house-pt-casa-dende") {
    injectSchema(houseSchema("Casa Dendê", "casa-dende", "pt"));
  }

  if (pageKey === "house-pt-casa-dos-baloes") {
    injectSchema(houseSchema("Casa dos Balões", "casa-dos-baloes", "pt"));
  }

  if (pageKey === "house-pt-casa-manga") {
    injectSchema(houseSchema("Casa Manga", "casa-manga", "pt"));
  }

  if (pageKey === "house-pt-casa-oca") {
    injectSchema(houseSchema("Casa Oca", "casa-oca", "pt"));
  }

  if (pageKey === "house-pt-casa-rosada") {
    injectSchema(houseSchema("Casa Rosada", "casa-rosada", "pt"));
  }

  if (pageKey === "house-pt-atelie-azul") {
    injectSchema(houseSchema("Ateliê Azul", "atelie-azul", "pt"));
  }

  /* =========================
     CASAS INDIVIDUAIS EN
  ========================= */

  if (pageKey === "house-en-casa-grande") {
    injectSchema(houseSchema("Casa Grande", "casa-grande", "en"));
  }

  if (pageKey === "house-en-casa-branca") {
    injectSchema(houseSchema("Casa Branca", "casa-branca", "en"));
  }

  if (pageKey === "house-en-casa-dende") {
    injectSchema(houseSchema("Casa Dendê", "casa-dende", "en"));
  }

  if (pageKey === "house-en-casa-dos-baloes") {
    injectSchema(houseSchema("Casa dos Balões", "casa-dos-baloes", "en"));
  }

  if (pageKey === "house-en-casa-manga") {
    injectSchema(houseSchema("Casa Manga", "casa-manga", "en"));
  }

  if (pageKey === "house-en-casa-oca") {
    injectSchema(houseSchema("Casa Oca", "casa-oca", "en"));
  }

  if (pageKey === "house-en-casa-rosada") {
    injectSchema(houseSchema("Casa Rosada", "casa-rosada", "en"));
  }

  if (pageKey === "house-en-atelie-azul") {
    injectSchema(houseSchema("Ateliê Azul", "atelie-azul", "en"));
  }

})();