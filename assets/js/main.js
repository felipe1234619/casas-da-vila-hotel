(function () {
  function qs(selector, scope = document) {
    return scope.querySelector(selector);
  }

  function qsa(selector, scope = document) {
    return Array.from(scope.querySelectorAll(selector));
  }

  function setupHeaderScroll() {
    const header = qs('.siteHeader');
    if (!header) return;

    function update() {
      if (window.scrollY > 18) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
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
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
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

        const headerOffset =
          qs('.siteHeader')?.offsetHeight || 0;

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

  document.addEventListener('DOMContentLoaded', function () {
    setupHeaderScroll();
    setupReveal();
    setupParallax();
    setupSmoothAnchors();
    setupCurrentYear();
  });
})();