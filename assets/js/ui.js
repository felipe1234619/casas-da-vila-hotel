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

  function renderFooter(locale = 'pt') {
    const isEN = locale === 'en';

    return `
      <footer class="siteFooter">
        <div class="wrap">

          <div class="footerGrid">
            <div>
              <p class="eyebrow">${isEN ? 'Casas da Vila' : 'Casas da Vila'}</p>
              <h3 class="footerTitle">${isEN ? 'A tropical stay in Trancoso' : 'Uma estadia tropical em Trancoso'}</h3>
              <p class="footerText">
                ${isEN
                  ? 'Boutique houses immersed in garden, silence, and the slower rhythm of Bahia.'
                  : 'Casas boutique imersas em jardim, silêncio e no ritmo mais lento da Bahia.'}
              </p>
            </div>

            <div>
              <p class="eyebrow">${isEN ? 'Explore' : 'Explorar'}</p>
              <nav class="footerNav">
                <a href="/${locale}/${isEN ? 'houses' : 'casas'}/">${isEN ? 'Houses' : 'Casas'}</a>
                <a href="/${locale}/${isEN ? 'experiences' : 'experiencias'}/">${isEN ? 'Experiences' : 'Experiências'}</a>
                <a href="/${locale}/${isEN ? 'location' : 'localizacao'}/">${isEN ? 'Location' : 'Localização'}</a>
                <a href="/${locale}/${isEN ? 'policies' : 'politicas'}/">${isEN ? 'Policies' : 'Políticas'}</a>
              </nav>
            </div>

            <div>
              <p class="eyebrow">${isEN ? 'Contact' : 'Contato'}</p>
              <div class="footerNav">
                <a href="/${locale}/${isEN ? 'contact' : 'contato'}/">${isEN ? 'Talk to us' : 'Fale conosco'}</a>
                <a href="/${locale}/${isEN ? 'book' : 'reservar'}/">${isEN ? 'Check availability' : 'Ver disponibilidade'}</a>
                <span class="footerText">Trancoso • Bahia • Brasil</span>
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="footerText" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <span>© <span data-current-year></span> Casas da Vila</span>
            <span>${isEN ? 'Breakfast and parking included' : 'Café da manhã e estacionamento incluídos'}</span>
          </div>

        </div>
      </footer>
    `;
  }

  function mountGlobalShell() {
    const locale = safeLocaleFromPath();

    const headerRoot = document.getElementById('site-header');
    const footerRoot = document.getElementById('site-footer');

    if (headerRoot) headerRoot.innerHTML = renderHeader(locale);
    if (footerRoot) footerRoot.innerHTML = renderFooter(locale);
  }

  document.addEventListener('DOMContentLoaded', mountGlobalShell);
})();