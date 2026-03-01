(function () {
  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.querySelector(".main-nav");
  const dropdownToggle = document.querySelector(".nav-dropdown-toggle");
  const dropdown = document.getElementById("products-dropdown");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  const revealElements = Array.from(document.querySelectorAll(".reveal-on-view"));
  if (!revealElements.length) return;

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
