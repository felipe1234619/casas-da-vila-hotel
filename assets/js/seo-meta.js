(() => {
  const ORIGIN = 'https://casasdavila.com';
  const DEFAULT_OG = `${ORIGIN}/assets/meta/og/og-home.jpg`;
  const HOUSES_OG = `${ORIGIN}/assets/meta/og/og-houses.jpg`;
  const BOOKING_OG = `${ORIGIN}/assets/meta/og/og-booking.jpg`;
  const PROJECT_OG = `${ORIGIN}/assets/meta/og/og-project.jpg`;

  const SEO = {
    'home-pt': {
      canonical: `${ORIGIN}/pt/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/`,
        'en': `${ORIGIN}/en/`,
        'x-default': `${ORIGIN}/pt/`
      },
      robots: 'index, follow',
      ogTitle: 'Casas da Vila | Hospedagem boutique em Trancoso',
      ogDescription: 'Casas autorais em Trancoso com café da manhã, jardim, piscina e atmosfera tropical.',
      ogImage: DEFAULT_OG,
      ogLocale: 'pt_BR'
    },

    'home-en': {
      canonical: `${ORIGIN}/en/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/`,
        'en': `${ORIGIN}/en/`,
        'x-default': `${ORIGIN}/pt/`
      },
      robots: 'index, follow',
      ogTitle: 'Casas da Vila | Tropical boutique stay in Trancoso',
      ogDescription: 'Authorial houses in Trancoso with breakfast, garden, pool and a quieter tropical rhythm.',
      ogImage: DEFAULT_OG,
      ogLocale: 'en_US'
    },

    'houses-pt': {
      canonical: `${ORIGIN}/pt/casas/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/`,
        'en': `${ORIGIN}/en/houses/`,
        'x-default': `${ORIGIN}/en/houses/`
      },
      robots: 'index, follow',
      ogTitle: 'Casas em Trancoso | Casas da Vila',
      ogDescription: 'Descubra a coleção de casas em Trancoso com identidade própria, atmosfera tropical e experiência boutique.',
      ogImage: HOUSES_OG,
      ogLocale: 'pt_BR'
    },

    'houses-en': {
      canonical: `${ORIGIN}/en/houses/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/`,
        'en': `${ORIGIN}/en/houses/`,
        'x-default': `${ORIGIN}/en/houses/`
      },
      robots: 'index, follow',
      ogTitle: 'Houses in Trancoso | Casas da Vila',
      ogDescription: 'Explore a collection of tropical boutique houses in Trancoso, each with its own atmosphere and scale.',
      ogImage: HOUSES_OG,
      ogLocale: 'en_US'
    },

    'book-pt': {
      canonical: `${ORIGIN}/pt/reservar/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/reservar/`,
        'en': `${ORIGIN}/en/book/`,
        'x-default': `${ORIGIN}/en/book/`
      },
      robots: 'index, follow',
      ogTitle: 'Reservar | Casas da Vila',
      ogDescription: 'Consulte disponibilidade nas Casas da Vila e encontre a casa ideal para a sua estadia em Trancoso.',
      ogImage: BOOKING_OG,
      ogLocale: 'pt_BR'
    },

    'book-en': {
      canonical: `${ORIGIN}/en/book/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/reservar/`,
        'en': `${ORIGIN}/en/book/`,
        'x-default': `${ORIGIN}/en/book/`
      },
      robots: 'index, follow',
      ogTitle: 'Book | Casas da Vila',
      ogDescription: 'Check availability at Casas da Vila and find the ideal house for your stay in Trancoso.',
      ogImage: BOOKING_OG,
      ogLocale: 'en_US'
    },

    'contact-pt': {
      canonical: `${ORIGIN}/pt/contato/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/contato/`,
        'en': `${ORIGIN}/en/contact/`,
        'x-default': `${ORIGIN}/en/contact/`
      },
      robots: 'index, follow',
      ogTitle: 'Contato | Casas da Vila',
      ogDescription: 'Entre em contato com as Casas da Vila para reservas, dúvidas sobre a estadia e informações sobre Trancoso.',
      ogImage: PROJECT_OG,
      ogLocale: 'pt_BR'
    },

    'contact-en': {
      canonical: `${ORIGIN}/en/contact/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/contato/`,
        'en': `${ORIGIN}/en/contact/`,
        'x-default': `${ORIGIN}/en/contact/`
      },
      robots: 'index, follow',
      ogTitle: 'Contact | Casas da Vila',
      ogDescription: 'Contact Casas da Vila for reservations, stay details and information about Trancoso.',
      ogImage: PROJECT_OG,
      ogLocale: 'en_US'
    },

    'location-pt': {
      canonical: `${ORIGIN}/pt/localizacao/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/localizacao/`,
        'en': `${ORIGIN}/en/location/`,
        'x-default': `${ORIGIN}/en/location/`
      },
      robots: 'index, follow',
      ogTitle: 'Localização em Trancoso | Casas da Vila',
      ogDescription: 'Veja a localização das Casas da Vila em Trancoso e descubra a proximidade com o Quadrado, praias e experiências da região.',
      ogImage: PROJECT_OG,
      ogLocale: 'pt_BR'
    },

    'location-en': {
      canonical: `${ORIGIN}/en/location/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/localizacao/`,
        'en': `${ORIGIN}/en/location/`,
        'x-default': `${ORIGIN}/en/location/`
      },
      robots: 'index, follow',
      ogTitle: 'Location in Trancoso | Casas da Vila',
      ogDescription: 'See where Casas da Vila is located in Trancoso, close to the Quadrado, beaches and local experiences.',
      ogImage: PROJECT_OG,
      ogLocale: 'en_US'
    },

    'experiences-pt': {
      canonical: `${ORIGIN}/pt/experiencias/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/experiencias/`,
        'en': `${ORIGIN}/en/experiences/`,
        'x-default': `${ORIGIN}/en/experiences/`
      },
      robots: 'index, follow',
      ogTitle: 'Experiências em Trancoso | Casas da Vila',
      ogDescription: 'Descubra experiências em Trancoso entre praia, gastronomia, natureza, ritmo local e permanência tropical.',
      ogImage: PROJECT_OG,
      ogLocale: 'pt_BR'
    },

    'experiences-en': {
      canonical: `${ORIGIN}/en/experiences/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/experiencias/`,
        'en': `${ORIGIN}/en/experiences/`,
        'x-default': `${ORIGIN}/en/experiences/`
      },
      robots: 'index, follow',
      ogTitle: 'Experiences in Trancoso | Casas da Vila',
      ogDescription: 'Discover experiences in Trancoso through beaches, local rhythm, nature, gastronomy and tropical atmosphere.',
      ogImage: PROJECT_OG,
      ogLocale: 'en_US'
    },

    'policies-pt': {
      canonical: `${ORIGIN}/pt/politicas/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/politicas/`,
        'en': `${ORIGIN}/en/policies/`,
        'x-default': `${ORIGIN}/en/policies/`
      },
      robots: 'index, follow',
      ogTitle: 'Políticas | Casas da Vila',
      ogDescription: 'Consulte as políticas de reserva, estadia, cancelamento e condições gerais das Casas da Vila.',
      ogImage: PROJECT_OG,
      ogLocale: 'pt_BR'
    },

    'policies-en': {
      canonical: `${ORIGIN}/en/policies/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/politicas/`,
        'en': `${ORIGIN}/en/policies/`,
        'x-default': `${ORIGIN}/en/policies/`
      },
      robots: 'index, follow',
      ogTitle: 'Policies | Casas da Vila',
      ogDescription: 'Review booking, stay, cancellation and general policies for Casas da Vila.',
      ogImage: PROJECT_OG,
      ogLocale: 'en_US'
    },

    'nye-pt': {
      canonical: `${ORIGIN}/pt/reveillon-2027/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/reveillon-2027/`,
        'en': `${ORIGIN}/en/nye-2027/`,
        'x-default': `${ORIGIN}/en/nye-2027/`
      },
      robots: 'index, follow',
      ogTitle: 'Réveillon 2027 em Trancoso | Casas da Vila',
      ogDescription: 'Hospedagem boutique para o Réveillon 2027 em Trancoso, com atmosfera tropical, casas autorais e estadia especial.',
      ogImage: BOOKING_OG,
      ogLocale: 'pt_BR'
    },

    'nye-en': {
      canonical: `${ORIGIN}/en/nye-2027/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/reveillon-2027/`,
        'en': `${ORIGIN}/en/nye-2027/`,
        'x-default': `${ORIGIN}/en/nye-2027/`
      },
      robots: 'index, follow',
      ogTitle: 'NYE 2027 in Trancoso | Casas da Vila',
      ogDescription: 'Boutique stay for New Year’s Eve 2027 in Trancoso, with tropical atmosphere, authorial houses and special season planning.',
      ogImage: BOOKING_OG,
      ogLocale: 'en_US'
    },

    'blog-pt-onde-ficar': {
      canonical: `${ORIGIN}/pt/blog/onde-ficar-em-trancoso/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/blog/onde-ficar-em-trancoso/`,
        'en': `${ORIGIN}/en/blog/where-to-stay-in-trancoso/`,
        'x-default': `${ORIGIN}/en/blog/where-to-stay-in-trancoso/`
      },
      robots: 'index, follow',
      ogTitle: 'Onde ficar em Trancoso | Casas da Vila',
      ogDescription: 'Guia sobre onde ficar em Trancoso, com foco em atmosfera, localização e experiência de hospedagem.',
      ogImage: DEFAULT_OG,
      ogLocale: 'pt_BR'
    },

    'blog-en-where-to-stay': {
      canonical: `${ORIGIN}/en/blog/where-to-stay-in-trancoso/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/blog/onde-ficar-em-trancoso/`,
        'en': `${ORIGIN}/en/blog/where-to-stay-in-trancoso/`,
        'x-default': `${ORIGIN}/en/blog/where-to-stay-in-trancoso/`
      },
      robots: 'index, follow',
      ogTitle: 'Where to stay in Trancoso | Casas da Vila',
      ogDescription: 'A guide to where to stay in Trancoso, focused on atmosphere, location and boutique hospitality.',
      ogImage: DEFAULT_OG,
      ogLocale: 'en_US'
    },

'blog-pt-o-que-fazer': {
  canonical: `${ORIGIN}/pt/blog/o-que-fazer-em-trancoso/`,
  hreflang: {
    'pt-BR': `${ORIGIN}/pt/blog/o-que-fazer-em-trancoso/`,
    'en': `${ORIGIN}/en/blog/what-to-do-in-trancoso/`,
    'x-default': `${ORIGIN}/en/blog/what-to-do-in-trancoso/`
  },
  robots: 'index, follow',
  ogTitle: 'O que fazer em Trancoso: praias, Quadrado e experiências | Casas da Vila',
  ogDescription: 'Guia completo sobre o que fazer em Trancoso: praias, Quadrado, gastronomia, experiências locais, roteiro de 3 dias e onde se hospedar.',
  ogImage: PROJECT_OG,
  ogLocale: 'pt_BR'
},
'blog-en-what-to-do': {
  canonical: `${ORIGIN}/en/blog/what-to-do-in-trancoso/`,
  hreflang: {
    'pt-BR': `${ORIGIN}/pt/blog/o-que-fazer-em-trancoso/`,
    'en': `${ORIGIN}/en/blog/what-to-do-in-trancoso/`,
    'x-default': `${ORIGIN}/en/blog/what-to-do-in-trancoso/`
  },
  robots: 'index, follow',
  ogTitle: 'Best Things to Do in Trancoso Brazil | Casas da Vila',
  ogDescription: 'Discover the best things to do in Trancoso, Brazil: beaches, the Quadrado, restaurants, local experiences, where to stay and a curated 3-day itinerary.',
  ogImage: PROJECT_OG,
  ogLocale: 'en_US'
},

    'blog-pt-reveillon-2027': {
      canonical: `${ORIGIN}/pt/blog/reveillon-2027-trancoso/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/blog/reveillon-2027-trancoso/`,
        'en': `${ORIGIN}/en/blog/new-years-eve-2027-trancoso/`,
        'x-default': `${ORIGIN}/en/blog/new-years-eve-2027-trancoso/`
      },
      robots: 'index, follow',
      ogTitle: 'Réveillon 2027 em Trancoso | Casas da Vila',
      ogDescription: 'Guia editorial sobre o Réveillon 2027 em Trancoso, com foco em atmosfera, estadia e planejamento.',
      ogImage: BOOKING_OG,
      ogLocale: 'pt_BR'
    },

    'blog-en-nye-2027': {
      canonical: `${ORIGIN}/en/blog/new-years-eve-2027-trancoso/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/blog/reveillon-2027-trancoso/`,
        'en': `${ORIGIN}/en/blog/new-years-eve-2027-trancoso/`,
        'x-default': `${ORIGIN}/en/blog/new-years-eve-2027-trancoso/`
      },
      robots: 'index, follow',
      ogTitle: 'New Year’s Eve 2027 in Trancoso | Casas da Vila',
      ogDescription: 'Editorial guide to New Year’s Eve 2027 in Trancoso, focused on atmosphere, stay and planning.',
      ogImage: BOOKING_OG,
      ogLocale: 'en_US'
    },

    'house-pt-atelie-azul': {
      canonical: `${ORIGIN}/pt/casas/atelie-azul/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/atelie-azul/`,
        'en': `${ORIGIN}/en/houses/atelie-azul/`,
        'x-default': `${ORIGIN}/en/houses/atelie-azul/`
      },
      robots: 'index, follow',
      ogTitle: 'Ateliê Azul | Casas da Vila',
      ogDescription: 'Conheça o Ateliê Azul, uma casa em Trancoso com atmosfera autoral, jardim e permanência tropical.',
      ogImage: HOUSES_OG,
      ogLocale: 'pt_BR'
    },

    'house-pt-casa-branca': {
      canonical: `${ORIGIN}/pt/casas/casa-branca/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/casa-branca/`,
        'en': `${ORIGIN}/en/houses/casa-branca/`,
        'x-default': `${ORIGIN}/en/houses/casa-branca/`
      },
      robots: 'index, follow',
      ogTitle: 'Casa Branca | Casas da Vila',
      ogDescription: 'Conheça a Casa Branca, uma estadia de leveza, frescor e atmosfera tropical em Trancoso.',
      ogImage: HOUSES_OG,
      ogLocale: 'pt_BR'
    },

    'house-pt-casa-dende': {
      canonical: `${ORIGIN}/pt/casas/casa-dende/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/casa-dende/`,
        'en': `${ORIGIN}/en/houses/casa-dende/`,
        'x-default': `${ORIGIN}/en/houses/casa-dende/`
      },
      robots: 'index, follow',
      ogTitle: 'Casa Dendê | Casas da Vila',
      ogDescription: 'Conheça a Casa Dendê, uma casa mais ampla em Trancoso com jardim, convívio e presença tropical.',
      ogImage: HOUSES_OG,
      ogLocale: 'pt_BR'
    },

    'house-pt-casa-dos-baloes': {
      canonical: `${ORIGIN}/pt/casas/casa-dos-baloes/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/casa-dos-baloes/`,
        'en': `${ORIGIN}/en/houses/casa-dos-baloes/`,
        'x-default': `${ORIGIN}/en/houses/casa-dos-baloes/`
      },
      robots: 'index, follow',
      ogTitle: 'Casa dos Balões | Casas da Vila',
      ogDescription: 'Conheça a Casa dos Balões, uma casa de escala generosa em Trancoso, ideal para estadias mais amplas.',
      ogImage: HOUSES_OG,
      ogLocale: 'pt_BR'
    },

    'house-pt-casa-grande': {
      canonical: `${ORIGIN}/pt/casas/casa-grande/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/casa-grande/`,
        'en': `${ORIGIN}/en/houses/casa-grande/`,
        'x-default': `${ORIGIN}/en/houses/casa-grande/`
      },
      robots: 'index, follow',
      ogTitle: 'Casa Grande | Casas da Vila',
      ogDescription: 'Conheça a Casa Grande, a experiência mais ampla e exclusiva das Casas da Vila em Trancoso.',
      ogImage: HOUSES_OG,
      ogLocale: 'pt_BR'
    },

    'house-pt-casa-manga': {
      canonical: `${ORIGIN}/pt/casas/casa-manga/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/casa-manga/`,
        'en': `${ORIGIN}/en/houses/casa-manga/`,
        'x-default': `${ORIGIN}/en/houses/casa-manga/`
      },
      robots: 'index, follow',
      ogTitle: 'Casa Manga | Casas da Vila',
      ogDescription: 'Conheça a Casa Manga, uma estadia em Trancoso marcada por natureza, sombra e um ritmo mais orgânico.',
      ogImage: HOUSES_OG,
      ogLocale: 'pt_BR'
    },

    'house-pt-casa-oca': {
      canonical: `${ORIGIN}/pt/casas/casa-oca/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/casa-oca/`,
        'en': `${ORIGIN}/en/houses/casa-oca/`,
        'x-default': `${ORIGIN}/en/houses/casa-oca/`
      },
      robots: 'index, follow',
      ogTitle: 'Casa Oca | Casas da Vila',
      ogDescription: 'Conheça a Casa Oca, um refúgio mais íntimo em Trancoso com textura, sombra e silêncio tropical.',
      ogImage: HOUSES_OG,
      ogLocale: 'pt_BR'
    },

    'house-pt-casa-rosada': {
      canonical: `${ORIGIN}/pt/casas/casa-rosada/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/casa-rosada/`,
        'en': `${ORIGIN}/en/houses/casa-rosada/`,
        'x-default': `${ORIGIN}/en/houses/casa-rosada/`
      },
      robots: 'index, follow',
      ogTitle: 'Casa Rosada | Casas da Vila',
      ogDescription: 'Conheça a Casa Rosada, uma casa charmosa em Trancoso com atmosfera delicada e presença tropical.',
      ogImage: HOUSES_OG,
      ogLocale: 'pt_BR'
    },

    'house-en-atelie-azul': {
      canonical: `${ORIGIN}/en/houses/atelie-azul/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/atelie-azul/`,
        'en': `${ORIGIN}/en/houses/atelie-azul/`,
        'x-default': `${ORIGIN}/en/houses/atelie-azul/`
      },
      robots: 'index, follow',
      ogTitle: 'Ateliê Azul | Casas da Vila',
      ogDescription: 'Discover Ateliê Azul, a tropical house in Trancoso with authorial atmosphere, garden and quiet permanence.',
      ogImage: HOUSES_OG,
      ogLocale: 'en_US'
    },

    'house-en-casa-branca': {
      canonical: `${ORIGIN}/en/houses/casa-branca/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/casa-branca/`,
        'en': `${ORIGIN}/en/houses/casa-branca/`,
        'x-default': `${ORIGIN}/en/houses/casa-branca/`
      },
      robots: 'index, follow',
      ogTitle: 'Casa Branca | Casas da Vila',
      ogDescription: 'Discover Casa Branca, a house in Trancoso defined by lightness, freshness and visual quiet.',
      ogImage: HOUSES_OG,
      ogLocale: 'en_US'
    },

    'house-en-casa-dende': {
      canonical: `${ORIGIN}/en/houses/casa-dende/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/casa-dende/`,
        'en': `${ORIGIN}/en/houses/casa-dende/`,
        'x-default': `${ORIGIN}/en/houses/casa-dende/`
      },
      robots: 'index, follow',
      ogTitle: 'Casa Dendê | Casas da Vila',
      ogDescription: 'Discover Casa Dendê, a broader tropical stay in Trancoso shaped by garden, openness and shared rhythm.',
      ogImage: HOUSES_OG,
      ogLocale: 'en_US'
    },

    'house-en-casa-dos-baloes': {
      canonical: `${ORIGIN}/en/houses/casa-dos-baloes/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/casa-dos-baloes/`,
        'en': `${ORIGIN}/en/houses/casa-dos-baloes/`,
        'x-default': `${ORIGIN}/en/houses/casa-dos-baloes/`
      },
      robots: 'index, follow',
      ogTitle: 'Casa dos Balões | Casas da Vila',
      ogDescription: 'Discover Casa dos Balões, a generous house in Trancoso designed for broader and more open stays.',
      ogImage: HOUSES_OG,
      ogLocale: 'en_US'
    },

    'house-en-casa-grande': {
      canonical: `${ORIGIN}/en/houses/casa-grande/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/casa-grande/`,
        'en': `${ORIGIN}/en/houses/casa-grande/`,
        'x-default': `${ORIGIN}/en/houses/casa-grande/`
      },
      robots: 'index, follow',
      ogTitle: 'Casa Grande | Casas da Vila',
      ogDescription: 'Discover Casa Grande, the most expansive and exclusive stay within Casas da Vila in Trancoso.',
      ogImage: HOUSES_OG,
      ogLocale: 'en_US'
    },

    'house-en-casa-manga': {
      canonical: `${ORIGIN}/en/houses/casa-manga/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/casa-manga/`,
        'en': `${ORIGIN}/en/houses/casa-manga/`,
        'x-default': `${ORIGIN}/en/houses/casa-manga/`
      },
      robots: 'index, follow',
      ogTitle: 'Casa Manga | Casas da Vila',
      ogDescription: 'Discover Casa Manga, a tropical stay in Trancoso shaped by nature, filtered light and organic calm.',
      ogImage: HOUSES_OG,
      ogLocale: 'en_US'
    },

    'house-en-casa-oca': {
      canonical: `${ORIGIN}/en/houses/casa-oca/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/casa-oca/`,
        'en': `${ORIGIN}/en/houses/casa-oca/`,
        'x-default': `${ORIGIN}/en/houses/casa-oca/`
      },
      robots: 'index, follow',
      ogTitle: 'Casa Oca | Casas da Vila',
      ogDescription: 'Discover Casa Oca, a quieter retreat in Trancoso shaped by texture, shade and intimate atmosphere.',
      ogImage: HOUSES_OG,
      ogLocale: 'en_US'
    },

    'house-en-casa-rosada': {
      canonical: `${ORIGIN}/en/houses/casa-rosada/`,
      hreflang: {
        'pt-BR': `${ORIGIN}/pt/casas/casa-rosada/`,
        'en': `${ORIGIN}/en/houses/casa-rosada/`,
        'x-default': `${ORIGIN}/en/houses/casa-rosada/`
      },
      robots: 'index, follow',
      ogTitle: 'Casa Rosada | Casas da Vila',
      ogDescription: 'Discover Casa Rosada, a charming tropical house in Trancoso with softness, warmth and quiet presence.',
      ogImage: HOUSES_OG,
      ogLocale: 'en_US'
    }
  };

  function upsertMetaByName(name, content) {
    if (!name || !content) return;
    let el = document.head.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function upsertMetaByProperty(property, content) {
    if (!property || !content) return;
    let el = document.head.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function upsertLink(rel, href, attrs = {}) {
    if (!rel || !href) return;

    let selector = `link[rel="${rel}"]`;
    if (attrs.hreflang) selector += `[hreflang="${attrs.hreflang}"]`;

    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }

    el.setAttribute('href', href);

    Object.entries(attrs).forEach(([key, value]) => {
      if (value) el.setAttribute(key, value);
    });
  }

  const pageKey = document.documentElement.dataset.seoPage;
  if (!pageKey) return;

  const conf = SEO[pageKey];
  if (!conf) return;

  upsertLink('canonical', conf.canonical);

  if (conf.hreflang) {
    Object.entries(conf.hreflang).forEach(([lang, href]) => {
      upsertLink('alternate', href, { hreflang: lang });
    });
  }

  upsertMetaByName('robots', conf.robots);

  upsertMetaByProperty('og:title', conf.ogTitle);
  upsertMetaByProperty('og:description', conf.ogDescription);
  upsertMetaByProperty('og:type', 'website');
  upsertMetaByProperty('og:url', conf.canonical);
  upsertMetaByProperty('og:image', conf.ogImage);
  upsertMetaByProperty('og:locale', conf.ogLocale);

  upsertMetaByName('twitter:card', 'summary_large_image');
  upsertMetaByName('twitter:title', conf.ogTitle);
  upsertMetaByName('twitter:description', conf.ogDescription);
  upsertMetaByName('twitter:image', conf.ogImage);

  
})();
