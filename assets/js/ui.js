(function () {
  function safeLocaleFromPath() {
    return window.location.pathname.startsWith('/en/') ? 'en' : 'pt';
  }

  function renderHeader(locale = 'pt') {
    const isEN = locale === 'en';

    return `
      <header class="siteHeader">
        <div class="headerInner">

          <a class="brand" href="/${locale}/" aria-label="Casas da Vila">
            <span class="brandMark" aria-hidden="true"></span>
            <span class="brandText">
              <strong class="brandName">Casas da Vila</strong>
              <span class="brandSub">${isEN ? 'Trancoso, Bahia' : 'Trancoso, Bahia'}</span>
            </span>
          </a>

          <nav class="nav" aria-label="${isEN ? 'Main navigation' : 'Navegação principal'}">
            <a href="/${locale}/${isEN ? 'houses' : 'casas'}/">${isEN ? 'Houses' : 'Casas'}</a>
            <a href="/${locale}/${isEN ? 'experiences' : 'experiencias'}/">${isEN ? 'Experiences' : 'Experiências'}</a>
            <a href="/${locale}/${isEN ? 'location' : 'localizacao'}/">${isEN ? 'Location' : 'Localização'}</a>
            <a href="/${locale}/${isEN ? 'about' : 'sobre'}/">${isEN ? 'About' : 'Sobre'}</a>
            <a href="/${locale}/${isEN ? 'contact' : 'contato'}/">${isEN ? 'Contact' : 'Contato'}</a>
          </nav>

          <div class="headerActions">
            <div class="langSwitch" aria-label="${isEN ? 'Language selector' : 'Seletor de idioma'}">
              <a href="/pt/" class="${locale === 'pt' ? 'active' : ''}">PT</a>
              <a href="/en/" class="${locale === 'en' ? 'active' : ''}">EN</a>
            </div>

            <a href="/${locale}/${isEN ? 'book' : 'reservar'}/" class="btn btnPrimary hideMobile">
              ${isEN ? 'Book now' : 'Reservar'}
            </a>
          </div>

        </div>
      </header>
    `;
  }

  async function loadGlobalFooter() {
    const mount = document.getElementById('site-footer');
    if (!mount) return;

    try {
      const res = await fetch('/assets/components/footer.html', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Footer load failed: ${res.status}`);

      mount.innerHTML = await res.text();
      hydrateFooterLanguage();
    } catch (err) {
      console.error('Erro ao carregar footer global:', err);
    }
  }

  function hydrateFooterLanguage() {
    const footer = document.querySelector('.siteFooter');
    if (!footer) return;

    const isEnglish = window.location.pathname.startsWith('/en/');
    const lang = isEnglish ? 'en' : 'pt';

    const dict = {
      pt: {
        brand_eyebrow: 'Casas da Vila',
        brand_title: 'Uma estadia tropical em Trancoso',
        brand_tag: 'Casas boutique imersas em jardim, silêncio e no ritmo mais lento da Bahia.',
        explore_title: 'Explorar',
        nav_houses: 'Casas',
        nav_experiences: 'Experiências',
        nav_location: 'Localização',
        nav_about: 'Sobre',
        nav_policies: 'Políticas',
        reserve_title: 'Reserva',
        reserve_cta: 'Ver disponibilidade',
        contact_cta: 'Fale conosco',
        location_meta: 'Trancoso • Bahia • Brasil',
        benefit_meta: 'Café da manhã e estacionamento incluídos',
        instagram_title: 'Instagram',
        instagram_handle: '@casasdavila',
        instagram_cta: 'Acompanhar',
        copyright: '© 2026 Casas da Vila',
        bottom_location: 'Trancoso, Bahia, Brasil'
      },
      en: {
        brand_eyebrow: 'Casas da Vila',
        brand_title: 'A tropical stay in Trancoso',
        brand_tag: 'Boutique houses immersed in gardens, quietness, and the slower rhythm of Bahia.',
        explore_title: 'Explore',
        nav_houses: 'Houses',
        nav_experiences: 'Experiences',
        nav_location: 'Location',
        nav_about: 'About',
        nav_policies: 'Policies',
        reserve_title: 'Reservations',
        reserve_cta: 'Check availability',
        contact_cta: 'Contact us',
        location_meta: 'Trancoso • Bahia • Brazil',
        benefit_meta: 'Breakfast and parking included',
        instagram_title: 'Instagram',
        instagram_handle: '@casasdavila',
        instagram_cta: 'Follow',
        copyright: '© 2026 Casas da Vila',
        bottom_location: 'Trancoso, Bahia, Brazil'
      }
    };

    const links = {
      pt: {
        houses: '/pt/casas/',
        experiences: '/pt/experiencias/',
        location: '/pt/localizacao/',
        about: '/pt/sobre/',
        policies: '/pt/politicas/',
        reserve: '/pt/reservar/',
        contact: '/pt/contato/'
      },
      en: {
        houses: '/en/houses/',
        experiences: '/en/experiences/',
        location: '/en/location/',
        about: '/en/about/',
        policies: '/en/policies/',
        reserve: '/en/book/',
        contact: '/en/contact/'
      }
    };

    footer.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[lang][key]) el.textContent = dict[lang][key];
    });

    footer.querySelectorAll('[data-link]').forEach((el) => {
      const key = el.getAttribute('data-link');
      if (links[lang][key]) el.setAttribute('href', links[lang][key]);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadGlobalFooter();
  });
  async function loadGlobalHeader() {
  const mount = document.getElementById('site-header');
  if (!mount) return;

  try {
    const res = await fetch('/assets/components/header.html', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Header load failed: ${res.status}`);

    mount.innerHTML = await res.text();
    hydrateHeaderLanguage();
    hydrateHeaderScrollState();
  } catch (err) {
    console.error('Erro ao carregar header global:', err);
  }
}

function hydrateHeaderLanguage() {
  const root = document.getElementById('site-header');
  if (!root) return;

  const isEnglish = window.location.pathname.startsWith('/en/');
  const lang = isEnglish ? 'en' : 'pt';

  const dict = {
    pt: {
      nav_houses: 'Casas',
      nav_experiences: 'Experiências',
      nav_location: 'Localização',
      nav_about: 'Sobre',
      nav_contact: 'Contato',
      reserve_cta: 'Reservar'
    },
    en: {
      nav_houses: 'Houses',
      nav_experiences: 'Experiences',
      nav_location: 'Location',
      nav_about: 'About',
      nav_contact: 'Contact',
      reserve_cta: 'Book'
    }
  };

  const links = {
    pt: {
      home: '/pt/',
      houses: '/pt/casas/',
      experiences: '/pt/experiencias/',
      location: '/pt/localizacao/',
      about: '/pt/sobre/',
      contact: '/pt/contato/',
      reserve: '/pt/reservar/'
    },
    en: {
      home: '/en/',
      houses: '/en/houses/',
      experiences: '/en/experiences/',
      location: '/en/location/',
      about: '/en/about/',
      contact: '/en/contact/',
      reserve: '/en/book/'
    }
  };

  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[lang][key]) el.textContent = dict[lang][key];
  });

  root.querySelectorAll('[data-link]').forEach((el) => {
    const key = el.getAttribute('data-link');
    if (links[lang][key]) el.setAttribute('href', links[lang][key]);
  });

  const ptLink = root.querySelector('[data-lang-link="pt"]');
  const enLink = root.querySelector('[data-lang-link="en"]');

  if (ptLink) {
    ptLink.classList.toggle('active', lang === 'pt');
    ptLink.setAttribute('href', getLanguageSwapUrl('pt'));
  }

  if (enLink) {
    enLink.classList.toggle('active', lang === 'en');
    enLink.setAttribute('href', getLanguageSwapUrl('en'));
  }
}

function getLanguageSwapUrl(targetLang) {
  const path = window.location.pathname;

  const ptToEnMap = [
    ['/pt/', '/en/'],
    ['/pt/casas/', '/en/houses/'],
    ['/pt/experiencias/', '/en/experiences/'],
    ['/pt/localizacao/', '/en/location/'],
    ['/pt/sobre/', '/en/about/'],
    ['/pt/contato/', '/en/contact/'],
    ['/pt/politicas/', '/en/policies/'],
    ['/pt/reservar/', '/en/book/']
  ];

  const enToPtMap = [
    ['/en/', '/pt/'],
    ['/en/houses/', '/pt/casas/'],
    ['/en/experiences/', '/pt/experiencias/'],
    ['/en/location/', '/pt/localizacao/'],
    ['/en/about/', '/pt/sobre/'],
    ['/en/contact/', '/pt/contato/'],
    ['/en/policies/', '/pt/politicas/'],
    ['/en/book/', '/pt/reservar/']
  ];

  const map = targetLang === 'en' ? ptToEnMap : enToPtMap;

  for (const [from, to] of map) {
    if (path === from) return to;
  }

  return targetLang === 'en' ? '/en/' : '/pt/';
}

function hydrateHeaderScrollState() {
  const update = () => {
    if (window.scrollY > 30) {
      document.body.classList.add('is-scrolled');
    } else {
      document.body.classList.remove('is-scrolled');
    }
  };

  window.addEventListener('scroll', update, { passive: true });
  update();
}

async function loadGlobalFooter() {
  const mount = document.getElementById('site-footer');
  if (!mount) return;

  try {
    const res = await fetch('/assets/components/footer.html', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Footer load failed: ${res.status}`);

    mount.innerHTML = await res.text();
    hydrateFooterLanguage();
  } catch (err) {
    console.error('Erro ao carregar footer global:', err);
  }
}

function hydrateFooterLanguage() {
  const footer = document.querySelector('.siteFooter');
  if (!footer) return;

  const isEnglish = window.location.pathname.startsWith('/en/');
  const lang = isEnglish ? 'en' : 'pt';

  const dict = {
    pt: {
      brand_eyebrow: 'Casas da Vila',
      brand_title: 'Uma estadia tropical em Trancoso',
      brand_tag: 'Casas boutique imersas em jardim, silêncio e no ritmo mais lento da Bahia.',
      explore_title: 'Explorar',
      nav_houses: 'Casas',
      nav_experiences: 'Experiências',
      nav_location: 'Localização',
      nav_about: 'Sobre',
      nav_policies: 'Políticas',
      reserve_title: 'Reserva',
      reserve_cta: 'Ver disponibilidade',
      contact_cta: 'Fale conosco',
      location_meta: 'Trancoso • Bahia • Brasil',
      benefit_meta: 'Café da manhã e estacionamento incluídos',
      instagram_title: 'Instagram',
      instagram_handle: '@casasdavila',
      instagram_cta: 'Acompanhar',
      copyright: '© 2026 Casas da Vila',
      bottom_location: 'Trancoso, Bahia, Brasil'
    },
    en: {
      brand_eyebrow: 'Casas da Vila',
      brand_title: 'A tropical stay in Trancoso',
      brand_tag: 'Boutique houses immersed in gardens, quietness, and the slower rhythm of Bahia.',
      explore_title: 'Explore',
      nav_houses: 'Houses',
      nav_experiences: 'Experiences',
      nav_location: 'Location',
      nav_about: 'About',
      nav_policies: 'Policies',
      reserve_title: 'Reservations',
      reserve_cta: 'Check availability',
      contact_cta: 'Contact us',
      location_meta: 'Trancoso • Bahia • Brazil',
      benefit_meta: 'Breakfast and parking included',
      instagram_title: 'Instagram',
      instagram_handle: '@casasdavila',
      instagram_cta: 'Follow',
      copyright: '© 2026 Casas da Vila',
      bottom_location: 'Trancoso, Bahia, Brazil'
    }
  };

  const links = {
    pt: {
      houses: '/pt/casas/',
      experiences: '/pt/experiencias/',
      location: '/pt/localizacao/',
      about: '/pt/sobre/',
      policies: '/pt/politicas/',
      reserve: '/pt/reservar/',
      contact: '/pt/contato/'
    },
    en: {
      houses: '/en/houses/',
      experiences: '/en/experiences/',
      location: '/en/location/',
      about: '/en/about/',
      policies: '/en/policies/',
      reserve: '/en/book/',
      contact: '/en/contact/'
    }
  };

  footer.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[lang][key]) el.textContent = dict[lang][key];
  });

  footer.querySelectorAll('[data-link]').forEach((el) => {
    const key = el.getAttribute('data-link');
    if (links[lang][key]) el.setAttribute('href', links[lang][key]);
  });
}
async function loadGlobalHeader() {
  const mount = document.getElementById('site-header');
  if (!mount) return;

  try {
    const res = await fetch('/assets/components/header.html', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Header load failed: ${res.status}`);

    mount.innerHTML = await res.text();
    hydrateHeaderLanguage();
    hydrateHeaderScrollState();
    bindMobileDrawer();
  } catch (err) {
    console.error('Erro ao carregar header global:', err);
  }
}

function hydrateHeaderLanguage() {
  const root = document.getElementById('site-header');
  if (!root) return;

  const isEnglish = window.location.pathname.startsWith('/en/');
  const lang = isEnglish ? 'en' : 'pt';

  const dict = {
    pt: {
      nav_houses: 'Casas',
      nav_experiences: 'Experiências',
      nav_location: 'Localização',
      nav_about: 'Sobre',
      nav_contact: 'Contato',
      reserve_cta: 'Reservar'
    },
    en: {
      nav_houses: 'Houses',
      nav_experiences: 'Experiences',
      nav_location: 'Location',
      nav_about: 'About',
      nav_contact: 'Contact',
      reserve_cta: 'Book'
    }
  };

  const links = {
    pt: {
      home: '/pt/',
      houses: '/pt/casas/',
      experiences: '/pt/experiencias/',
      location: '/pt/localizacao/',
      about: '/pt/sobre/',
      contact: '/pt/contato/',
      reserve: '/pt/reservar/'
    },
    en: {
      home: '/en/',
      houses: '/en/houses/',
      experiences: '/en/experiences/',
      location: '/en/location/',
      about: '/en/about/',
      contact: '/en/contact/',
      reserve: '/en/book/'
    }
  };

  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[lang][key]) el.textContent = dict[lang][key];
  });

  root.querySelectorAll('[data-link]').forEach((el) => {
    const key = el.getAttribute('data-link');
    if (links[lang][key]) el.setAttribute('href', links[lang][key]);
  });

  const ptLink = root.querySelector('[data-lang-link="pt"]');
  const enLink = root.querySelector('[data-lang-link="en"]');

  if (ptLink) {
    ptLink.classList.toggle('active', lang === 'pt');
    ptLink.setAttribute('href', getLanguageSwapUrl('pt'));
  }

  if (enLink) {
    enLink.classList.toggle('active', lang === 'en');
    enLink.setAttribute('href', getLanguageSwapUrl('en'));
  }

  bindLanguagePreference();
}

function bindLanguagePreference() {
  document.querySelectorAll('[data-lang-link]').forEach((link) => {
    link.addEventListener('click', () => {
      const lang = link.getAttribute('data-lang-link');
      if (lang === 'pt' || lang === 'en') {
        try {
          localStorage.setItem('cdv:lang', lang);
        } catch (err) {
          console.warn('Não foi possível salvar o idioma preferido.', err);
        }
      }
    });
  });
}

function getLanguageSwapUrl(targetLang) {
  const path = window.location.pathname.replace(/\/+$/, '/') || '/';

  const directMap = {
    '/pt/': '/en/',
    '/pt/casas/': '/en/houses/',
    '/pt/experiencias/': '/en/experiences/',
    '/pt/localizacao/': '/en/location/',
    '/pt/sobre/': '/en/about/',
    '/pt/contato/': '/en/contact/',
    '/pt/politicas/': '/en/policies/',
    '/pt/reservar/': '/en/book/',

    '/en/': '/pt/',
    '/en/houses/': '/pt/casas/',
    '/en/experiences/': '/pt/experiencias/',
    '/en/location/': '/pt/localizacao/',
    '/en/about/': '/pt/sobre/',
    '/en/contact/': '/pt/contato/',
    '/en/policies/': '/pt/politicas/',
    '/en/book/': '/pt/reservar/'
  };

  if (directMap[path]) return directMap[path];

  if (path.startsWith('/pt/casas/')) {
    const slug = path.replace('/pt/casas/', '').replace(/\/+$/, '');
    return targetLang === 'en' ? `/en/houses/${slug}/` : path;
  }

  if (path.startsWith('/en/houses/')) {
    const slug = path.replace('/en/houses/', '').replace(/\/+$/, '');
    return targetLang === 'pt' ? `/pt/casas/${slug}/` : path;
  }

  return targetLang === 'en' ? '/en/' : '/pt/';
}

function hydrateHeaderScrollState() {
  let ticking = false;

  const update = () => {
    const y = window.scrollY || window.pageYOffset;

    if (y > 24) {
      document.body.classList.add('is-scrolled');
    } else {
      document.body.classList.remove('is-scrolled');
    }

    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  update();
}
function bindMobileDrawer() {
  const toggle = document.querySelector('.headerMenuToggle');
  const drawer = document.querySelector('.mobileDrawer');
  const closeBtn = document.querySelector('.mobileDrawerClose');

  if (!toggle || !drawer || !closeBtn) return;

  const openDrawer = () => {
    document.body.classList.add('drawer-open');
    toggle.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
  };

  const closeDrawer = () => {
    document.body.classList.remove('drawer-open');
    toggle.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
  };

  toggle.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', closeDrawer);

  drawer.addEventListener('click', (e) => {
    if (e.target === drawer) closeDrawer();
  });

  drawer.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeDrawer);
  });
}
document.addEventListener('DOMContentLoaded', () => {
  loadGlobalHeader();
  loadGlobalFooter();
});

function hydrateHeaderScrollState() {
  let ticking = false;

  const update = () => {
    const y = window.scrollY || window.pageYOffset;

    if (y > 24) {
      document.body.classList.add('is-scrolled');
    } else {
      document.body.classList.remove('is-scrolled');
    }

    ticking = false;
  };


  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  update();
}

})();