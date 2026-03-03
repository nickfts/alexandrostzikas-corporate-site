(function () {
  const authHashKeys = [
    "recovery_token",
    "invite_token",
    "confirmation_token",
    "email_change_token"
  ];
  const isAdminPath = window.location.pathname.startsWith("/admin");
  const hasIdentityTokenInHash = authHashKeys.some((key) => window.location.hash.includes(`${key}=`));
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const heroSlogan = document.querySelector(".hero-slogan");
  const analyticsConfig = window.__SITE_ANALYTICS_CONFIG__ || {};
  const analyticsMeasurementId = String(analyticsConfig.measurementId || "").trim();
  const analyticsEnabled = Boolean(analyticsConfig.enabled && analyticsMeasurementId);
  const consentStorageKey = "azt_cookie_consent";
  const acceptedConsentTtlMs = 365 * 24 * 60 * 60 * 1000;

  if (!prefersReducedMotion && heroSlogan) {
    document.documentElement.classList.add("motion-ready");
  }

  // Identity links may land on public pages. Force redirect to /admin so Decap/Identity can process the token.
  if (!isAdminPath && hasIdentityTokenInHash) {
    window.location.replace(`/admin/${window.location.hash}`);
    return;
  }

  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.querySelector(".main-nav");
  const dropdownToggle = document.querySelector(".nav-dropdown-toggle");
  const dropdown = document.getElementById("products-dropdown");

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    mainNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth < 1024) {
          mainNav.classList.remove("is-open");
          menuToggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  function closeDropdown() {
    if (!dropdown || !dropdownToggle) return;
    dropdown.hidden = true;
    dropdownToggle.setAttribute("aria-expanded", "false");
  }

  if (dropdownToggle && dropdown) {
    dropdownToggle.addEventListener("click", () => {
      const willOpen = dropdown.hidden;
      dropdown.hidden = !willOpen;
      dropdownToggle.setAttribute("aria-expanded", String(willOpen));
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!target.closest(".nav-has-dropdown")) {
        closeDropdown();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDropdown();
      }
    });

    dropdown.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeDropdown);
    });
  }

  function loadAnalytics() {
    if (!analyticsEnabled || window.__aztAnalyticsLoaded) return;

    window.__aztAnalyticsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag() {
        window.dataLayer.push(arguments);
      };

    window.gtag("js", new Date());
    window.gtag("config", analyticsMeasurementId, { anonymize_ip: true });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsMeasurementId)}`;
    script.setAttribute("data-consent-managed", "true");
    document.head.appendChild(script);
  }

  function readStoredAcceptedConsent() {
    try {
      const raw = localStorage.getItem(consentStorageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.status !== "accepted") return false;
      if (typeof parsed.expiresAt !== "number") return false;
      if (Date.now() > parsed.expiresAt) {
        localStorage.removeItem(consentStorageKey);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  function persistAcceptedConsent() {
    try {
      localStorage.setItem(
        consentStorageKey,
        JSON.stringify({
          status: "accepted",
          acceptedAt: Date.now(),
          expiresAt: Date.now() + acceptedConsentTtlMs
        })
      );
    } catch {
      // Ignore storage failures and continue with in-memory consent for this session.
    }
  }

  function clearAcceptedConsent() {
    try {
      localStorage.removeItem(consentStorageKey);
    } catch {
      // Ignore storage failures.
    }
  }

  const cookieBanner = document.querySelector("[data-cookie-banner]");
  const cookieAcceptBtn = document.querySelector("[data-cookie-accept]");
  const cookieRejectBtn = document.querySelector("[data-cookie-reject]");
  const cookiePreferenceButtons = Array.from(document.querySelectorAll("[data-cookie-preferences]"));

  function showCookieBanner() {
    if (!cookieBanner) return;
    cookieBanner.hidden = false;
    document.body.classList.add("has-cookie-banner");
  }

  function hideCookieBanner() {
    if (!cookieBanner) return;
    cookieBanner.hidden = true;
    document.body.classList.remove("has-cookie-banner");
  }

  function openCookiePreferences(event) {
    if (event) event.preventDefault();
    showCookieBanner();
    if (cookieAcceptBtn) cookieAcceptBtn.focus();
  }

  cookiePreferenceButtons.forEach((button) => {
    button.addEventListener("click", openCookiePreferences);
  });

  if (analyticsEnabled) {
    if (readStoredAcceptedConsent()) {
      loadAnalytics();
      hideCookieBanner();
    } else {
      showCookieBanner();
    }

    if (cookieAcceptBtn) {
      cookieAcceptBtn.addEventListener("click", () => {
        persistAcceptedConsent();
        loadAnalytics();
        trackEvent("cookie_consent_accept");
        hideCookieBanner();
      });
    }

    if (cookieRejectBtn) {
      cookieRejectBtn.addEventListener("click", () => {
        clearAcceptedConsent();
        hideCookieBanner();
      });
    }
  } else {
    hideCookieBanner();
  }

  function trackEvent(eventName, params = {}) {
    if (typeof window.gtag !== "function") return;

    window.gtag("event", eventName, {
      page_path: window.location.pathname,
      ...params
    });
  }

  document.addEventListener("click", (event) => {
    const clickable = event.target.closest("a, button");
    if (!clickable) return;

    const explicitEvent = clickable.dataset.trackEvent;
    const explicitLabel = clickable.dataset.trackLabel || "";
    const href = clickable.getAttribute("href") || "";

    if (explicitEvent) {
      trackEvent(explicitEvent, {
        event_label: explicitLabel || clickable.textContent.trim().slice(0, 120),
        link_url: href
      });
      return;
    }

    if (clickable.tagName !== "A" || !href) return;

    if (href.startsWith("tel:")) {
      trackEvent("contact_phone_click", { event_label: href.replace("tel:", "") });
      return;
    }

    if (href.startsWith("mailto:")) {
      trackEvent("contact_email_click", { event_label: href.replace("mailto:", "") });
      return;
    }

    if (clickable.hasAttribute("download")) {
      trackEvent("file_download_click", {
        event_label: clickable.textContent.trim().slice(0, 120),
        link_url: href
      });
      return;
    }

    if (clickable.target === "_blank") {
      trackEvent("outbound_link_click", {
        event_label: clickable.textContent.trim().slice(0, 120),
        link_url: href
      });
    }
  });

  const contactForm = document.querySelector("[data-remote-contact-form]");
  if (contactForm) {
    const statusEl = contactForm.querySelector("[data-form-status]");
    const submitBtn = contactForm.querySelector("button[type='submit']");

    function setFormStatus(message, isError = false) {
      if (!statusEl) return;
      statusEl.hidden = false;
      statusEl.textContent = message;
      statusEl.classList.toggle("is-error", isError);
      statusEl.classList.toggle("is-success", !isError);
    }

    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const endpoint = contactForm.getAttribute("action") || "";
      const honeypot = contactForm.querySelector("input[name='_gotcha']");

      if (!endpoint.trim()) {
        setFormStatus("Η φόρμα δεν είναι διαθέσιμη αυτή τη στιγμή.", true);
        return;
      }

      if (honeypot && honeypot.value.trim()) {
        // Silent drop for spam bots.
        return;
      }

      const formData = new FormData(contactForm);
      if (submitBtn) submitBtn.disabled = true;
      setFormStatus("Αποστολή...", false);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
          headers: {
            Accept: "application/json"
          }
        });

        if (!response.ok) {
          throw new Error("FORM_SUBMIT_FAILED");
        }

        contactForm.reset();
        setFormStatus("Το μήνυμά σας στάλθηκε επιτυχώς.", false);
        trackEvent("contact_form_submit_success");
      } catch (error) {
        setFormStatus("Δεν ήταν δυνατή η αποστολή. Προσπαθήστε ξανά σε λίγο.", true);
        trackEvent("contact_form_submit_error");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  const revealElements = Array.from(document.querySelectorAll(".reveal-on-view"));
  if (!revealElements.length) return;

  // Trigger hero reveal immediately so slogan animation starts without observer jitter on load.
  const heroReveal = document.querySelector(".hero.reveal-on-view");
  if (heroReveal) {
    heroReveal.classList.add("is-visible");
  }

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
  );

  revealElements.forEach((element) => observer.observe(element));
})();
