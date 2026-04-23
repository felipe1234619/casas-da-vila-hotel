(function () {
  function isEnglishPath() {
    return window.location.pathname.startsWith('/en/');
  }

  function getLanguageSwapUrl(targetLang) {
    const path = (window.location.pathname.replace(/\/+$/, '/') || '/');

    const directMap = {
      '/pt/': '/en/',
      '/pt/casas/': '/en/houses/',
      '/pt/experiencias/': '/en/experiences/',
      '/pt/localizacao/': '/en/location/',
      '/pt/sobre/': '/en/about/',
      '/pt/contato/': '/en/contact/',
      '/pt/politicas/': '/en/policies/',
      '/pt/reservar/': '/en/book/',
      '/pt/blog/onde-ficar-em-trancoso/': '/en/blog/where-to-stay-in-trancoso/',
      '/pt/blog/o-que-fazer-em-trancoso/': '/en/blog/what-to-do-in-trancoso/',
      '/pt/blog/melhor-epoca-para-ir-a-trancoso/': '/en/blog/best-time-to-visit-trancoso/',

      '/en/': '/pt/',
      '/en/houses/': '/pt/casas/',
      '/en/experiences/': '/pt/experiencias/',
      '/en/location/': '/pt/localizacao/',
      '/en/about/': '/pt/sobre/',
      '/en/contact/': '/pt/contato/',
      '/en/policies/': '/pt/politicas/',
      '/en/book/': '/pt/reservar/',
      '/en/blog/where-to-stay-in-trancoso/': '/pt/blog/onde-ficar-em-trancoso/',
      '/en/blog/what-to-do-in-trancoso/': '/pt/blog/o-que-fazer-em-trancoso/',
      '/en/blog/best-time-to-visit-trancoso/': '/pt/blog/melhor-epoca-para-ir-a-trancoso/'
    };

    if (directMap[path]) return targetLang === 'en'
      ? directMap[path]
      : directMap[path];

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

    const lang = isEnglishPath() ? 'en' : 'pt';

    root.querySelectorAll('[data-i18n-pt][data-i18n-en]').forEach((el) => {
      el.textContent = lang === 'en'
        ? el.getAttribute('data-i18n-en')
        : el.getAttribute('data-i18n-pt');
    });

    root.querySelectorAll('[data-href-pt][data-href-en]').forEach((el) => {
      el.setAttribute(
        'href',
        lang === 'en'
          ? el.getAttribute('data-href-en')
          : el.getAttribute('data-href-pt')
      );
    });

    const ptLink = root.querySelector('[data-lang-link="pt"]');
    const enLink = root.querySelector('[data-lang-link="en"]');

    if (ptLink) {
      ptLink.classList.toggle('is-active', lang === 'pt');
      ptLink.setAttribute('href', lang === 'en' ? getLanguageSwapUrl('pt') : window.location.pathname);
    }

    if (enLink) {
      enLink.classList.toggle('is-active', lang === 'en');
      enLink.setAttribute('href', lang === 'pt' ? getLanguageSwapUrl('en') : window.location.pathname);
    }
  }

  function hydrateHeaderScrollState() {
    let ticking = false;

    const update = () => {
      const y = window.scrollY || window.pageYOffset;
      document.body.classList.toggle('is-scrolled', y > 24);
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

    if (!toggle || !drawer) return;

    const openDrawer = () => {
      document.body.classList.add('drawer-open');
      toggle.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
      drawer.classList.add('is-open');
    };

    const closeDrawer = () => {
      document.body.classList.remove('drawer-open');
      toggle.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.classList.remove('is-open');
    };

    toggle.addEventListener('click', () => {
      if (drawer.classList.contains('is-open')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    drawer.addEventListener('click', (e) => {
      if (e.target === drawer) closeDrawer();
    });

    drawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeDrawer);
    });
  }

  async function loadGlobalFooter() {
    const mount = document.getElementById('site-footer');
    if (!mount) return;

    try {
      const res = await fetch('/assets/components/footer.html', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Footer load failed: ${res.status}`);

mount.innerHTML = await res.text();
hydrateFooterLanguage();
highlightSeasonalFooterLinks();
    } catch (err) {
      console.error('Erro ao carregar footer global:', err);
    }
  }

  function hydrateFooterLanguage() {
    const footer = document.querySelector('.siteFooter');
    if (!footer) return;

    const lang = isEnglishPath() ? 'en' : 'pt';

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
        bottom_location: 'Trancoso, Bahia, Brasil',
blog_title: 'Guia de Trancoso',
blog_where: 'Onde ficar em Trancoso',
blog_what: 'O que fazer em Trancoso',
blog_nye: 'Réveillon 2027 em Trancoso',
landing_nye: 'Réveillon 2027'      },
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
        bottom_location: 'Trancoso, Bahia, Brazil',
blog_title: 'Trancoso Guide',
blog_where: 'Where to stay in Trancoso',
blog_what: 'What to do in Trancoso',
blog_nye: 'NYE 2027 in Trancoso',
landing_nye: 'NYE 2027'      }
    };

    const links = {
      pt: {
        houses: '/pt/casas/',
        experiences: '/pt/experiencias/',
        location: '/pt/localizacao/',
        about: '/pt/sobre/',
        policies: '/pt/politicas/',
        reserve: '/pt/reservar/',
        contact: '/pt/contato/',
blog_where: '/pt/blog/onde-ficar-em-trancoso/',
blog_what: '/pt/blog/o-que-fazer-em-trancoso/',
blog_nye: '/pt/blog/reveillon-2027-trancoso/',
landing_nye: '/pt/reveillon-2027/'
      },
      en: {
        houses: '/en/houses/',
        experiences: '/en/experiences/',
        location: '/en/location/',
        about: '/en/about/',
        policies: '/en/policies/',
        reserve: '/en/book/',
        contact: '/en/contact/',
        blog_where: '/en/blog/where-to-stay-in-trancoso/',
blog_what: '/en/blog/what-to-do-in-trancoso/',
blog_nye: '/en/blog/new-years-eve-2027-trancoso/',
landing_nye: '/en/nye-2027/'
    }};

    footer.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[lang][key]) el.textContent = dict[lang][key];
    });

    footer.querySelectorAll('[data-link]').forEach((el) => {
      const key = el.getAttribute('data-link');
      if (links[lang][key]) el.setAttribute('href', links[lang][key]);
    });
  }
function highlightSeasonalFooterLinks() {
  const footer = document.querySelector('.siteFooter');
  if (!footer) return;

  const now = new Date();

  // Ajuste aqui a janela de destaque
  // Exemplo:
  // destaque suave: de 1 de setembro de 2026 até 14 de dezembro de 2026
  // destaque forte: de 15 de dezembro de 2026 até 6 de janeiro de 2027
  const softStart = new Date('2026-09-01T00:00:00');
  const hotStart = new Date('2026-12-15T00:00:00');
  const endDate   = new Date('2027-01-07T00:00:00');

  const seasonalLinks = footer.querySelectorAll('[data-seasonal-link="nye"], [data-seasonal-link="nye-blog"]');
  if (!seasonalLinks.length) return;

  seasonalLinks.forEach((link) => {
    link.classList.remove('is-season-highlight', 'is-season-hot');
    link.removeAttribute('data-badge');
  });

  if (now >= softStart && now < endDate) {
    seasonalLinks.forEach((link) => {
      link.classList.add('is-season-highlight');
    });
  }

  if (now >= hotStart && now < endDate) {
    seasonalLinks.forEach((link) => {
      link.classList.remove('is-season-highlight');
      link.classList.add('is-season-hot');
    });
  }
}
  document.addEventListener('DOMContentLoaded', () => {
    loadGlobalHeader();
    loadGlobalFooter();
  });
})();