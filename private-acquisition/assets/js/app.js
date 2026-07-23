(function () {
  "use strict";

  const ACCESS_PASSWORD = "Jujubi2026";
  const ACCESS_KEY = "cdv_private_acquisition_access";
  const BROKER_KEY = "cdv_acquisition_broker";

  const body = document.body;
  const gate = document.getElementById("portalGate");
  const accessInput = document.getElementById("accessCode");
  const accessButton = document.getElementById("accessButton");
  const accessError = document.getElementById("accessError");
  const intro = document.getElementById("introScreen");

  const header = document.querySelector(".site-header");
  const menuButton = document.querySelector(".mobile-menu");
  const navigation = document.querySelector(".navigation");

  const params = new URLSearchParams(window.location.search);
  const broker = params.get("broker");

  if (broker) {
    sessionStorage.setItem(BROKER_KEY, broker);
  }

  function hideGate(runIntro) {
    if (!gate) return;

    gate.classList.add("hidden");
    body.classList.remove("portal-locked");

    if (runIntro && intro) {
      intro.classList.add("active");

      window.setTimeout(function () {
        intro.classList.remove("active");
      }, 2800);
    }
  }

  function validateAccess() {
    if (!accessInput) return;

    const value = accessInput.value.trim();

    if (value === ACCESS_PASSWORD) {
      sessionStorage.setItem(ACCESS_KEY, "true");
      accessError.textContent = "";
      hideGate(true);
      return;
    }

    accessError.textContent = "Invalid access code.";
    accessInput.value = "";
    accessInput.focus();
  }

  if (sessionStorage.getItem(ACCESS_KEY) === "true") {
    hideGate(false);
  } else {
    body.classList.add("portal-locked");
  }

  if (accessButton) {
    accessButton.addEventListener("click", validateAccess);
  }

  if (accessInput) {
    accessInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        validateAccess();
      }
    });
  }

  function updateHeader() {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 30);
  }

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  if (menuButton && navigation) {
    menuButton.addEventListener("click", function () {
      const open = navigation.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(open));
    });

    navigation.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navigation.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
      });
    });
  }

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.14
    }
  );

  document.querySelectorAll(".reveal").forEach(function (element) {
    observer.observe(element);
  });

  document.addEventListener("contextmenu", function (event) {
    event.preventDefault();
  });

  document.addEventListener("keydown", function (event) {
    const key = event.key.toLowerCase();

    if (
      (event.ctrlKey || event.metaKey) &&
      ["p", "s", "u"].includes(key)
    ) {
      event.preventDefault();
    }
  });
})();