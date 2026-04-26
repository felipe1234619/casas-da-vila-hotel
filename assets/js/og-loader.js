(function () {
  const ORIGIN = window.location.origin;

  // 🧭 mapa central de OG
  const ogMap = {
    "/": "og-home.jpg",
    "/index.html": "og-home.jpg",

    "/booking": "og-booking.jpg",

    // casas
    "/houses/casa-manga": "houses/casa-manga.jpg",
    "/houses/casa-grande": "houses/casa-grande.jpg",
    "/houses/casa-dos-baloes": "houses/casa-dos-baloes.jpg",
    "/houses/casa-rosa": "houses/casa-rosa.jpg",
    "/houses/casa-branca": "houses/casa-branca.jpg",
    "/houses/casa-oca": "houses/casa-oca.jpg",
    "/houses/casa-dende": "houses/casa-dende.jpg",
    "/houses/atelie-azul": "houses/atelie-azul.jpg",

    // PT
    "/pt/casas/casa-manga": "houses/casa-manga.jpg",
    "/pt/casas/casa-grande": "houses/casa-grande.jpg",
    "/pt/casas/casa-dos-baloes": "houses/casa-dos-baloes.jpg",
    "/pt/casas/casa-rosa": "houses/casa-rosa.jpg",
    "/pt/casas/casa-branca": "houses/casa-branca.jpg",
    "/pt/casas/casa-oca": "houses/casa-oca.jpg",
    "/pt/casas/casa-dende": "houses/casa-dende.jpg",
    "/pt/casas/atelie-azul": "houses/atelie-azul.jpg",

    // EN
    "/en/houses/casa-manga": "houses/casa-manga.jpg",
    "/en/houses/casa-grande": "houses/casa-grande.jpg",
    "/en/houses/casa-dos-baloes": "houses/casa-dos-baloes.jpg",
    "/en/houses/casa-rosa": "houses/casa-rosa.jpg",
    "/en/houses/casa-branca": "houses/casa-branca.jpg",
    "/en/houses/casa-oca": "houses/casa-oca.jpg",
    "/en/houses/casa-dende": "houses/casa-dende.jpg",
    "/en/houses/atelie-azul": "houses/atelie-azul.jpg"
  };

  function normalizePath(path) {
    return path.replace(/\/$/, "");
  }

  function getOgImage() {
    const path = normalizePath(window.location.pathname);

    if (ogMap[path]) {
      return ogMap[path];
    }

    // fallback inteligente
    return "og-default.jpg";
  }

  function setMeta(property, content) {
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("property", property);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  const ogImagePath = getOgImage();
  const fullUrl = `${ORIGIN}/assets/meta/og/${ogImagePath}`;

  // 🔥 aplica OG
  setMeta("og:image", fullUrl);
  setMeta("og:image:secure_url", fullUrl);
  setMeta("og:image:type", "image/jpeg");
  setMeta("og:image:width", "1200");
  setMeta("og:image:height", "630");

})();