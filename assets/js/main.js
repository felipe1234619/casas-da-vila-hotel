(function () {
  function qs(selector, scope = document) {
    return scope.querySelector(selector);
  }

  function qsa(selector, scope = document) {
    return Array.from(scope.querySelectorAll(selector));
  }

  function normalizePath(pathname) {
    let path = pathname || '/';

    path = path.replace(/\/index\.html$/, '/');
    path = path.replace(/\/{2,}/g, '/');

    if (!path.startsWith('/')) path = '/' + path;

    return path;
  }

  function isEnglishPath(pathname) {
    return normalizePath(pathname).startsWith('/en/');
  }

  function setupHeaderScroll() {
    const header = qs('.siteHeader');
    if (!header) return;

    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 18);
      document.body.classList.toggle('is-scrolled', window.scrollY > 18);
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  function setupReveal() {
    const items = qsa('[data-reveal]');
    if (!items.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px'
      }
    );

    items.forEach((item) => io.observe(item));
  }

  function setupParallax() {
    const items = qsa('.parallaxSoft');
    if (!items.length) return;

    function update() {
      const vh = window.innerHeight || 1;

      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const delta = (center - vh / 2) / vh;
        const offset = delta * -18;
        item.style.setProperty('--parallax-offset', `${offset}px`);
      });
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  function setupSmoothAnchors() {
    qsa('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;

        const target = qs(href);
        if (!target) return;

        event.preventDefault();

        const headerOffset = qs('.siteHeader')?.offsetHeight || 0;
        const top =
          target.getBoundingClientRect().top +
          window.pageYOffset -
          headerOffset -
          12;

        window.scrollTo({
          top,
          behavior: 'smooth'
        });
      });
    });
  }

  function setupCurrentYear() {
    qsa('[data-current-year]').forEach((el) => {
      el.textContent = String(new Date().getFullYear());
    });
  }

  function setupEditorialHeaderState() {
    const shell = qs('.siteHeaderShell');
    const header = qs('.siteHeader');

    if (!shell || !header) return;

    const hero =
      qs('.houseHero') ||
      qs('.contactHero') ||
      qs('.aboutHero') ||
      qs('.experiencesHero') ||
      qs('.bookingHero') ||
      qs('.successHero') ||
      qs('.locationHero') ||
      qs('.homeHero') ||
      qs('.hero');

    function applyHeaderState() {
      const y = window.scrollY || window.pageYOffset || 0;
      shell.classList.toggle('header-scrolled', y > 24);

      if (!hero) {
        shell.classList.remove('header-on-hero');
        return;
      }

      const heroRect = hero.getBoundingClientRect();
      const heroBottom = heroRect.bottom;
      const cutoff = 110;

      shell.classList.toggle('header-on-hero', heroBottom > cutoff);
    }

    applyHeaderState();
    window.addEventListener('scroll', applyHeaderState, { passive: true });
    window.addEventListener('resize', applyHeaderState);
  }

  function setupGlobalHeader() {
    const header = qs('.siteHeader');
    const shell = qs('.siteHeaderShell');
    const brand = qs('.brand');
    const navLinks = qsa('.nav a, .mobileNav a');
    const langLinks = qsa('[data-lang-link]');
    const reserveBtn = qs('.headerReserveBtn');
    const menuToggle = qs('.headerMenuToggle');
    const drawer = qs('.mobileDrawer');

    if (!header || !shell) return;

    document.body.classList.add('has-fixed-header');

    const currentPath = normalizePath(window.location.pathname);
    const lang = isEnglishPath(currentPath) ? 'en' : 'pt';

    const routes = {
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

    function translateDataset(node, keyBase) {
      const datasetKey = `${keyBase}${lang.toUpperCase()}`;
      return node.dataset?.[datasetKey] || node.textContent;
    }

    function mapEquivalentPath(path, targetLang) {
      const normalized = normalizePath(path);

      const ptToEn = [
        ['/pt/casas/', '/en/houses/'],
        ['/pt/experiencias/', '/en/experiences/'],
        ['/pt/localizacao/', '/en/location/'],
        ['/pt/sobre/', '/en/about/'],
        ['/pt/contato/', '/en/contact/'],
        ['/pt/reservar/', '/en/book/'],
        ['/pt/', '/en/']
      ];

      const enToPt = [
        ['/en/houses/', '/pt/casas/'],
        ['/en/experiences/', '/pt/experiencias/'],
        ['/en/location/', '/pt/localizacao/'],
        ['/en/about/', '/pt/sobre/'],
        ['/en/contact/', '/pt/contato/'],
        ['/en/book/', '/pt/reservar/'],
        ['/en/', '/pt/']
      ];

      const table = targetLang === 'en' ? ptToEn : enToPt;

      for (const [from, to] of table) {
        if (normalized.startsWith(from)) {
          return normalized.replace(from, to);
        }
      }

      return routes[targetLang].home;
    }

    if (brand) {
      brand.setAttribute('href', routes[lang].home);
    }

    navLinks.forEach((link) => {
      const key = link.dataset.link;
      if (!key || !routes[lang][key]) return;

      const translated =
        link.dataset[`i18n${lang.toUpperCase()}`] || link.textContent;

      link.textContent = translated;
      link.setAttribute('href', routes[lang][key]);

      const href = routes[lang][key];

      if (
        currentPath === href ||
        (href !== routes[lang].home && currentPath.startsWith(href))
      ) {
        link.classList.add('is-active');
      } else {
        link.classList.remove('is-active');
      }
    });

    if (reserveBtn) {
      reserveBtn.textContent =
        reserveBtn.dataset[`i18n${lang.toUpperCase()}`] || reserveBtn.textContent;
      reserveBtn.setAttribute('href', routes[lang].reserve);
    }

    langLinks.forEach((link) => {
      const linkLang = link.dataset.langLink;
      link.classList.toggle('is-active', linkLang === lang);

      if (linkLang === 'pt') {
        link.setAttribute('href', mapEquivalentPath(currentPath, 'pt'));
      }

      if (linkLang === 'en') {
        link.setAttribute('href', mapEquivalentPath(currentPath, 'en'));
      }
    });

    if (menuToggle && drawer) {
      function closeDrawer() {
        menuToggle.classList.remove('is-open');
        menuToggle.setAttribute('aria-expanded', 'false');
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('drawer-open');
      }

      function openDrawer() {
        menuToggle.classList.add('is-open');
        menuToggle.setAttribute('aria-expanded', 'true');
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        document.body.classList.add('drawer-open');
      }

      menuToggle.addEventListener('click', function () {
        if (drawer.classList.contains('is-open')) {
          closeDrawer();
        } else {
          openDrawer();
        }
      });

      drawer.addEventListener('click', function (event) {
        if (event.target === drawer) closeDrawer();
      });

      window.addEventListener('resize', function () {
        if (window.innerWidth > 980) closeDrawer();
      });
    }
  }

  function init() {
    setupHeaderScroll();
    setupReveal();
    setupParallax();
    setupSmoothAnchors();
    setupCurrentYear();
    setupEditorialHeaderState();
    setupGlobalHeader();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
(function () {
  const path = window.location.pathname.toLowerCase();
  const isEN = path.startsWith('/en/');
  const lang = isEN ? 'en' : 'pt';

  const routeMap = {
    '/pt/': '/en/',
    '/pt/casas/': '/en/houses/',
    '/pt/experiencias/': '/en/experiences/',
    '/pt/localizacao/': '/en/location/',
    '/pt/sobre/': '/en/about/',
    '/pt/contato/': '/en/contact/',
    '/pt/reservar/': '/en/book/',

    '/en/': '/pt/',
    '/en/houses/': '/pt/casas/',
    '/en/experiences/': '/pt/experiencias/',
    '/en/location/': '/pt/localizacao/',
    '/en/about/': '/pt/sobre/',
    '/en/contact/': '/pt/contato/',
    '/en/book/': '/pt/reservar/'
  };

  function applyHeaderI18n(root = document) {
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
    const altPath = routeMap[path] || (isEN ? '/pt/' : '/en/');

    if (ptLink) {
      ptLink.setAttribute('href', isEN ? altPath : path);
      ptLink.classList.toggle('is-active', !isEN);
    }

    if (enLink) {
      enLink.setAttribute('href', isEN ? path : altPath);
      enLink.classList.toggle('is-active', isEN);
    }

    const activeMap = {
      pt: {
        '/pt/casas/': 'houses',
        '/pt/experiencias/': 'experiences',
        '/pt/localizacao/': 'location',
        '/pt/sobre/': 'about',
        '/pt/contato/': 'contact',
        '/pt/reservar/': 'reserve'
      },
      en: {
        '/en/houses/': 'houses',
        '/en/experiences/': 'experiences',
        '/en/location/': 'location',
        '/en/about/': 'about',
        '/en/contact/': 'contact',
        '/en/book/': 'reserve'
      }
    };

    const currentKey = activeMap[lang][path];

    root.querySelectorAll('[data-link]').forEach((el) => {
      el.classList.toggle('is-active', el.getAttribute('data-link') === currentKey);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyHeaderI18n(document));
  } else {
    applyHeaderI18n(document);
  }
})();
/* Casas da Vila — Mobile Menu Toggle Definitivo */
(function () {
  document.addEventListener("click", function (event) {
    const toggle = event.target.closest(".headerMenuToggle");
    const drawer = document.querySelector(".mobileDrawer");

    if (!toggle || !drawer) return;

    const willOpen = toggle.getAttribute("aria-expanded") !== "true";

    toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
    drawer.classList.toggle("is-open", willOpen);
    drawer.classList.toggle("open", willOpen);
    drawer.setAttribute("aria-hidden", willOpen ? "false" : "true");
  });

  document.addEventListener("click", function (event) {
    if (!event.target.closest(".mobileDrawer a")) return;

    const toggle = document.querySelector(".headerMenuToggle");
    const drawer = document.querySelector(".mobileDrawer");

    if (toggle) toggle.setAttribute("aria-expanded", "false");

    if (drawer) {
      drawer.classList.remove("is-open", "open");
      drawer.setAttribute("aria-hidden", "true");
    }
  });
})();