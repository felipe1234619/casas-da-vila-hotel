(() => {
  const ORIGIN = "https://casasdavila.com";
  const OG = `${ORIGIN}/assets/meta/og`;

  const DATA = {
    "home-pt": {
      title: "Casas da Vila | Hospedagem boutique em Trancoso",
      description: "Casas da Vila em Trancoso: casas autorais com jardim, piscina, café da manhã e uma experiência tropical próxima ao Quadrado.",
      canonical: "/pt/",
      image: `${OG}/og-home.jpg`,
      locale: "pt_BR",
      lang: "pt-BR",
      alt: { "pt-BR": "/pt/", en: "/en/", "x-default": "/pt/" },
      schema: "home"
    },

    "home-en": {
      title: "Casas da Vila | Tropical Boutique Stay in Trancoso",
      description: "Casas da Vila in Trancoso: a boutique stay with authorial houses, tropical gardens, pool and breakfast near the Quadrado.",
      canonical: "/en/",
      image: `${OG}/og-home.jpg`,
      locale: "en_US",
      lang: "en",
      alt: { "pt-BR": "/pt/", en: "/en/", "x-default": "/en/" },
      schema: "home"
    },

    "houses-pt": {
      title: "Casas em Trancoso | Casas da Vila",
      description: "Conheça a coleção de casas da Casas da Vila em Trancoso: arquitetura autoral, jardins tropicais e uma experiência boutique próxima ao Quadrado.",
      canonical: "/pt/casas/",
      image: `${OG}/og-default.jpg`,
      locale: "pt_BR",
      lang: "pt-BR",
      alt: { "pt-BR": "/pt/casas/", en: "/en/houses/", "x-default": "/pt/casas/" },
      schema: "collection"
    },

    "houses-en": {
      title: "Houses in Trancoso | Casas da Vila",
      description: "Explore the Casas da Vila collection in Trancoso: tropical architecture, gardens and a boutique stay experience near the Quadrado.",
      canonical: "/en/houses/",
      image: `${OG}/og-default.jpg`,
      locale: "en_US",
      lang: "en",
      alt: { "pt-BR": "/pt/casas/", en: "/en/houses/", "x-default": "/en/houses/" },
      schema: "collection"
    },

    "book-pt": {
      title: "Reservar | Casas da Vila",
      description: "Consulte disponibilidade nas Casas da Vila em Trancoso e encontre a casa ideal para sua estadia com jardim, piscina e café da manhã incluído.",
      canonical: "/pt/reservar/",
      image: `${OG}/og-booking.jpg`,
      locale: "pt_BR",
      lang: "pt-BR",
      alt: { "pt-BR": "/pt/reservar/", en: "/en/book/", "x-default": "/en/book/" },
      schema: "booking"
    },

    "book-en": {
      title: "Book | Casas da Vila",
      description: "Check availability at Casas da Vila in Trancoso and find the ideal house for your stay with garden, pool and breakfast included.",
      canonical: "/en/book/",
      image: `${OG}/og-booking.jpg`,
      locale: "en_US",
      lang: "en",
      alt: { "pt-BR": "/pt/reservar/", en: "/en/book/", "x-default": "/en/book/" },
      schema: "booking"
    },

    "about-pt": {
      title: "Sobre | Casas da Vila",
      description: "Casas da Vila em Trancoso: um projeto de hospitalidade com casas autorais, jardins tropicais e uma experiência silenciosa próxima ao Quadrado.",
      canonical: "/pt/sobre/",
      image: `${OG}/og-default.jpg`,
      locale: "pt_BR",
      lang: "pt-BR",
      alt: { "pt-BR": "/pt/sobre/", en: "/en/about/", "x-default": "/en/about/" },
      schema: "page"
    },

    "about-en": {
      title: "About | Casas da Vila",
      description: "Casas da Vila in Trancoso: a boutique hospitality project with tropical houses, gardens and a quiet stay experience near the Quadrado.",
      canonical: "/en/about/",
      image: `${OG}/og-default.jpg`,
      locale: "en_US",
      lang: "en",
      alt: { "pt-BR": "/pt/sobre/", en: "/en/about/", "x-default": "/en/about/" },
      schema: "page"
    },

    "experiences-pt": {
      title: "Experiências | Casas da Vila",
      description: "Experiências em Trancoso: praias, gastronomia, natureza e uma vivência local a partir das Casas da Vila.",
      canonical: "/pt/experiencias/",
      image: `${OG}/og-default.jpg`,
      locale: "pt_BR",
      lang: "pt-BR",
      alt: { "pt-BR": "/pt/experiencias/", en: "/en/experiences/", "x-default": "/en/experiences/" },
      schema: "page"
    },

    "experiences-en": {
      title: "Experiences | Casas da Vila",
      description: "Experiences in Trancoso through beaches, nature, local gastronomy and a slower tropical rhythm from Casas da Vila.",
      canonical: "/en/experiences/",
      image: `${OG}/og-default.jpg`,
      locale: "en_US",
      lang: "en",
      alt: { "pt-BR": "/pt/experiencias/", en: "/en/experiences/", "x-default": "/en/experiences/" },
      schema: "page"
    },

    "location-pt": {
      title: "Localização | Casas da Vila",
      description: "Casas da Vila está em Trancoso, Bahia, próxima ao Quadrado, às praias e à paisagem tropical da região.",
      canonical: "/pt/localizacao/",
      image: `${OG}/og-default.jpg`,
      locale: "pt_BR",
      lang: "pt-BR",
      alt: { "pt-BR": "/pt/localizacao/", en: "/en/location/", "x-default": "/en/location/" },
      schema: "page"
    },

    "location-en": {
      title: "Location | Casas da Vila",
      description: "Located in Trancoso, Casas da Vila is close to the Quadrado and surrounded by beaches and tropical landscape.",
      canonical: "/en/location/",
      image: `${OG}/og-default.jpg`,
      locale: "en_US",
      lang: "en",
      alt: { "pt-BR": "/pt/localizacao/", en: "/en/location/", "x-default": "/en/location/" },
      schema: "page"
    },

    "contact-pt": {
      title: "Contato | Casas da Vila",
      description: "Entre em contato com Casas da Vila em Trancoso para reservas, dúvidas e informações sobre sua estadia.",
      canonical: "/pt/contato/",
      image: `${OG}/og-default.jpg`,
      locale: "pt_BR",
      lang: "pt-BR",
      alt: { "pt-BR": "/pt/contato/", en: "/en/contact/", "x-default": "/en/contact/" },
      schema: "contact"
    },

    "contact-en": {
      title: "Contact | Casas da Vila",
      description: "Contact Casas da Vila in Trancoso for reservations, stay details and information about your visit.",
      canonical: "/en/contact/",
      image: `${OG}/og-default.jpg`,
      locale: "en_US",
      lang: "en",
      alt: { "pt-BR": "/pt/contato/", en: "/en/contact/", "x-default": "/en/contact/" },
      schema: "contact"
    },

    "nye-pt": {
      title: "Réveillon 2027 em Trancoso | Casas da Vila",
      description: "Hospedagem boutique para o Réveillon 2027 em Trancoso, com casas autorais, jardim e atmosfera tropical.",
      canonical: "/pt/reveillon-2027/",
      image: `${OG}/og-booking.jpg`,
      locale: "pt_BR",
      lang: "pt-BR",
      alt: { "pt-BR": "/pt/reveillon-2027/", en: "/en/nye-2027/", "x-default": "/en/nye-2027/" },
      schema: "page"
    },

    "nye-en": {
      title: "NYE 2027 in Trancoso | Casas da Vila",
      description: "Boutique stay for New Year’s Eve 2027 in Trancoso, with tropical houses, gardens and a quieter festive atmosphere.",
      canonical: "/en/nye-2027/",
      image: `${OG}/og-booking.jpg`,
      locale: "en_US",
      lang: "en",
      alt: { "pt-BR": "/pt/reveillon-2027/", en: "/en/nye-2027/", "x-default": "/en/nye-2027/" },
      schema: "page"
    }
  };

  const HOUSES = {
    "casa-grande": {
      name: "Casa Grande",
      image: "casa-grande.jpg",
      pt: "Casa Grande em Trancoso: casa ampla com jardim, piscina, áreas de convívio e atmosfera tropical nas Casas da Vila.",
      en: "Casa Grande in Trancoso: a spacious tropical house with garden, pool, outdoor living areas and a calm stay at Casas da Vila."
    },
    "casa-manga": {
      name: "Casa Manga",
      image: "casa-manga.jpg",
      pt: "Casa Manga em Trancoso: casa tropical com jardim, sombra natural e uma atmosfera tranquila nas Casas da Vila.",
      en: "Casa Manga in Trancoso: a tropical house with garden, natural shade and a quiet atmosphere at Casas da Vila."
    },
    "casa-branca": {
      name: "Casa Branca",
      image: "casa-branca.jpg",
      pt: "Casa Branca em Trancoso: uma casa leve e acolhedora com jardim, atmosfera tropical e permanência tranquila.",
      en: "Casa Branca in Trancoso: a light and welcoming tropical house with garden and a calm atmosphere."
    },
    "casa-oca": {
      name: "Casa Oca",
      image: "casa-oca.jpg",
      pt: "Casa Oca em Trancoso: refúgio tropical com textura, sombra, jardim e atmosfera íntima nas Casas da Vila.",
      en: "Casa Oca in Trancoso: a tropical retreat with texture, shade, garden and an intimate atmosphere at Casas da Vila."
    },
    "casa-dende": {
      name: "Casa Dendê",
      image: "casa-dende.jpg",
      pt: "Casa Dendê em Trancoso: casa tropical com jardim, presença natural e atmosfera acolhedora nas Casas da Vila.",
      en: "Casa Dendê in Trancoso: a tropical house with garden, natural presence and a welcoming atmosphere at Casas da Vila."
    },
    "casa-dos-baloes": {
      name: "Casa dos Balões",
      image: "casa-dos-baloes.jpg",
      pt: "Casa dos Balões em Trancoso: casa de escala generosa com jardim, convivência e atmosfera tropical acolhedora.",
      en: "Casa dos Balões in Trancoso: a generous tropical house with garden, open living areas and a welcoming atmosphere."
    },
    "atelie-azul": {
      name: "Ateliê Azul",
      image: "atelie-azul.jpg",
      pt: "Ateliê Azul em Trancoso: casa autoral com jardim, cor, atmosfera tropical e permanência tranquila.",
      en: "Ateliê Azul in Trancoso: an authorial tropical house with garden, color and a quiet atmosphere."
    },
    "casa-rosada": {
      name: "Casa Rosada",
      image: "casa-rosada.jpg",
      pt: "Casa Rosada em Trancoso: casa acolhedora com jardim, cozinha e atmosfera tropical para 2 hóspedes.",
      en: "Casa Rosada in Trancoso: 85 sqm tropical house with garden, kitchen and a warm, intimate stay for two guests."
    }
  };

  Object.entries(HOUSES).forEach(([slug, h]) => {
    DATA[`house-pt-${slug}`] = {
      title: `${h.name} | Casas da Vila`,
      description: h.pt,
      canonical: `/pt/casas/${slug}/`,
      image: `${OG}/houses/${h.image}`,
      locale: "pt_BR",
      lang: "pt-BR",
      alt: { "pt-BR": `/pt/casas/${slug}/`, en: `/en/houses/${slug}/`, "x-default": `/en/houses/${slug}/` },
      schema: "house",
      houseName: h.name
    };

    DATA[`house-en-${slug}`] = {
      title: `${h.name} | Casas da Vila`,
      description: h.en,
      canonical: `/en/houses/${slug}/`,
      image: `${OG}/houses/${h.image}`,
      locale: "en_US",
      lang: "en",
      alt: { "pt-BR": `/pt/casas/${slug}/`, en: `/en/houses/${slug}/`, "x-default": `/en/houses/${slug}/` },
      schema: "house",
      houseName: h.name
    };
  });

  const pageKey = document.documentElement.dataset.seoPage;
  const conf = DATA[pageKey];

  if (!conf) return;

  function absolute(path) {
    return path.startsWith("http") ? path : `${ORIGIN}${path}`;
  }

  function upsertMeta(attr, key, content) {
    if (!content) return;
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function upsertLink(rel, href, attrs = {}) {
    if (!href) return;
    let selector = `link[rel="${rel}"]`;
    if (attrs.hreflang) selector += `[hreflang="${attrs.hreflang}"]`;

    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }

    el.setAttribute("href", absolute(href));

    Object.entries(attrs).forEach(([k, v]) => {
      if (v) el.setAttribute(k, v);
    });
  }

  function injectJsonLd(graph) {
    document.head.querySelectorAll('script[data-seo-engine="jsonld"]').forEach((el) => el.remove());

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.seoEngine = "jsonld";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": graph
    });
    document.head.appendChild(script);
  }

  document.documentElement.setAttribute("lang", conf.lang);
  document.title = conf.title;

  upsertMeta("name", "description", conf.description);
  upsertMeta("name", "robots", "index, follow");

  upsertLink("canonical", conf.canonical);

  Object.entries(conf.alt || {}).forEach(([lang, href]) => {
    upsertLink("alternate", href, { hreflang: lang });
  });

  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:site_name", "Casas da Vila");
  upsertMeta("property", "og:title", conf.title);
  upsertMeta("property", "og:description", conf.description);
  upsertMeta("property", "og:url", absolute(conf.canonical));
  upsertMeta("property", "og:image", conf.image);
  upsertMeta("property", "og:image:secure_url", conf.image);
  upsertMeta("property", "og:image:width", "1200");
  upsertMeta("property", "og:image:height", "630");
  upsertMeta("property", "og:image:type", "image/jpeg");
  upsertMeta("property", "og:locale", conf.locale);

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", conf.title);
  upsertMeta("name", "twitter:description", conf.description);
  upsertMeta("name", "twitter:image", conf.image);

  const business = {
    "@type": "LodgingBusiness",
    "@id": `${ORIGIN}/#lodging`,
    name: "Casas da Vila",
    url: ORIGIN,
    image: `${OG}/og-home.jpg`,
    description: "Boutique tropical stay in Trancoso with authorial houses, garden, pool and breakfast included.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Trancoso",
      addressRegion: "BA",
      addressCountry: "BR"
    }
  };

  const webpage = {
    "@type": "WebPage",
    "@id": `${absolute(conf.canonical)}#webpage`,
    url: absolute(conf.canonical),
    name: conf.title,
    description: conf.description,
    inLanguage: conf.lang,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${ORIGIN}/#website`,
      name: "Casas da Vila",
      url: ORIGIN
    }
  };

  const graph = [
    {
      "@type": "WebSite",
      "@id": `${ORIGIN}/#website`,
      name: "Casas da Vila",
      url: ORIGIN
    },
    business,
    webpage
  ];

  if (conf.schema === "house") {
    graph.push({
      "@type": "Accommodation",
      "@id": `${absolute(conf.canonical)}#accommodation`,
      name: conf.houseName,
      url: absolute(conf.canonical),
      image: conf.image,
      description: conf.description,
      containedInPlace: {
        "@id": `${ORIGIN}/#lodging`
      }
    });
  }

  if (conf.schema === "booking") {
    graph.push({
      "@type": "ReserveAction",
      target: absolute(conf.canonical),
      result: {
        "@type": "Reservation",
        name: "Casas da Vila booking"
      }
    });
  }

  injectJsonLd(graph);
})();