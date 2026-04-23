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

  const webSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Casas da Vila",
    "url": ORIGIN
  };

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

  function houseSchema(name, slug, locale = "pt") {
    const basePath = locale === "pt" ? "/pt/casas/" : "/en/houses/";
    return {
      "@context": "https://schema.org",
      "@type": "LodgingBusiness",
      "name": name,
      "url": `${ORIGIN}${basePath}${slug}/`,
      "image": `${ORIGIN}/assets/meta/og/og-houses.jpg`,
      "description": locale === "pt"
        ? `${name} nas Casas da Vila, em Trancoso.`
        : `${name} at Casas da Vila in Trancoso.`,
      "containedInPlace": {
        "@type": "Place",
        "name": "Casas da Vila"
      }
    };
  }

  function blogPostingSchema({ headline, description, url, image, lang = "pt-BR" }) {
    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": headline,
      "description": description,
      "url": url,
      "image": image,
      "inLanguage": lang,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": url
      },
      "publisher": {
        "@type": "Organization",
        "name": "Casas da Vila",
        "logo": {
          "@type": "ImageObject",
          "url": `${ORIGIN}/assets/meta/og/og-home.jpg`
        }
      }
    };
  }

  function webPageSchema({ name, description, url, lang = "pt-BR" }) {
    return {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": name,
      "description": description,
      "url": url,
      "inLanguage": lang,
      "isPartOf": {
        "@type": "WebSite",
        "name": "Casas da Vila",
        "url": ORIGIN
      }
    };
  }

  if (pageKey === "home-pt" || pageKey === "home-en") {
    injectSchema(baseBusiness);
    injectSchema(webSite);
  }

  if (pageKey === "houses-pt") {
    injectSchema(baseBusiness);
    injectSchema(
      breadcrumb([
        { name: "Home", url: `${ORIGIN}/pt/` },
        { name: "Casas", url: `${ORIGIN}/pt/casas/` }
      ])
    );
  }

  if (pageKey === "houses-en") {
    injectSchema(baseBusiness);
    injectSchema(
      breadcrumb([
        { name: "Home", url: `${ORIGIN}/en/` },
        { name: "Houses", url: `${ORIGIN}/en/houses/` }
      ])
    );
  }

  if (pageKey === "book-pt" || pageKey === "book-en") {
    injectSchema(baseBusiness);
  }

  if (pageKey === "contact-pt" || pageKey === "contact-en") {
    injectSchema(baseBusiness);
  }

  if (pageKey === "location-pt" || pageKey === "location-en") {
    injectSchema(baseBusiness);
  }

  if (pageKey === "experiences-pt" || pageKey === "experiences-en") {
    injectSchema(baseBusiness);
  }

  if (pageKey === "policies-pt" || pageKey === "policies-en") {
    injectSchema(baseBusiness);
  }

  if (pageKey === "nye-pt") {
    injectSchema(baseBusiness);
    injectSchema(
      webPageSchema({
        name: "Réveillon 2027 em Trancoso | Casas da Vila",
        description: "Página especial de Réveillon 2027 em Trancoso, com atmosfera tropical boutique e estadia nas Casas da Vila.",
        url: `${ORIGIN}/pt/reveillon-2027/`,
        lang: "pt-BR"
      })
    );
  }

  if (pageKey === "nye-en") {
    injectSchema(baseBusiness);
    injectSchema(
      webPageSchema({
        name: "NYE 2027 in Trancoso | Casas da Vila",
        description: "Special New Year's Eve 2027 page in Trancoso, with a tropical boutique atmosphere at Casas da Vila.",
        url: `${ORIGIN}/en/nye-2027/`,
        lang: "en"
      })
    );
  }

  if (pageKey === "blog-pt-onde-ficar") {
    injectSchema(
      blogPostingSchema({
        headline: "Onde ficar em Trancoso",
        description: "Guia sobre onde ficar em Trancoso, com foco em atmosfera, localização e experiência de hospedagem.",
        url: `${ORIGIN}/pt/blog/onde-ficar-em-trancoso/`,
        image: `${ORIGIN}/assets/meta/og/og-home.jpg`,
        lang: "pt-BR"
      })
    );
  }

  if (pageKey === "blog-en-where-to-stay") {
    injectSchema(
      blogPostingSchema({
        headline: "Where to stay in Trancoso",
        description: "A guide to where to stay in Trancoso, focused on atmosphere, location and boutique hospitality.",
        url: `${ORIGIN}/en/blog/where-to-stay-in-trancoso/`,
        image: `${ORIGIN}/assets/meta/og/og-home.jpg`,
        lang: "en"
      })
    );
  }

  if (pageKey === "blog-pt-o-que-fazer") {
    injectSchema(
      blogPostingSchema({
        headline: "O que fazer em Trancoso",
        description: "Guia com o que fazer em Trancoso entre praia, gastronomia, natureza e ritmo local.",
        url: `${ORIGIN}/pt/blog/o-que-fazer-em-trancoso/`,
        image: `${ORIGIN}/assets/meta/og/og-project.jpg`,
        lang: "pt-BR"
      })
    );
  }

  if (pageKey === "blog-en-what-to-do") {
    injectSchema(
      blogPostingSchema({
        headline: "What to do in Trancoso",
        description: "A guide to what to do in Trancoso through beaches, food, nature and local rhythm.",
        url: `${ORIGIN}/en/blog/what-to-do-in-trancoso/`,
        image: `${ORIGIN}/assets/meta/og/og-project.jpg`,
        lang: "en"
      })
    );
  }

  if (pageKey === "blog-pt-reveillon-2027") {
    injectSchema(
      blogPostingSchema({
        headline: "Réveillon 2027 em Trancoso",
        description: "Guia editorial sobre o Réveillon 2027 em Trancoso, com foco em atmosfera, estadia e planejamento.",
        url: `${ORIGIN}/pt/blog/reveillon-2027-trancoso/`,
        image: `${ORIGIN}/assets/meta/og/og-booking.jpg`,
        lang: "pt-BR"
      })
    );
  }

  if (pageKey === "blog-en-nye-2027") {
    injectSchema(
      blogPostingSchema({
        headline: "New Year's Eve 2027 in Trancoso",
        description: "Editorial guide to New Year's Eve 2027 in Trancoso, focused on atmosphere, stay and planning.",
        url: `${ORIGIN}/en/blog/new-years-eve-2027-trancoso/`,
        image: `${ORIGIN}/assets/meta/og/og-booking.jpg`,
        lang: "en"
      })
    );
  }

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