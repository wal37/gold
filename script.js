(function () {
  "use strict";

  function normalizeHomepageUrl() {
    const { pathname, search, hash, origin } = window.location;
    if (!pathname.endsWith("/index.html")) return;
    const cleanPath = pathname.replace(/\/index\.html$/, "/");
    window.location.replace(`${origin}${cleanPath}${search}${hash}`);
  }

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  }

  function initThemeToggle() {
    const root = document.documentElement;
    const toggleBtn = document.getElementById("theme-toggle");
    if (!toggleBtn) return;

    let savedTheme = "dark";
    try {
      savedTheme = localStorage.getItem("theme") || "dark";
    } catch (_) {
      savedTheme = "dark";
    }

    const setTheme = (theme) => {
      const isLight = theme === "light";
      root.classList.toggle("light", isLight);
      toggleBtn.textContent = isLight ? "☀️" : "🌙";
      try {
        localStorage.setItem("theme", isLight ? "light" : "dark");
      } catch (_) {
        // ignore storage failures (private mode/restrictions)
      }
    };

    setTheme(savedTheme);
    toggleBtn.addEventListener("click", () => {
      setTheme(root.classList.contains("light") ? "dark" : "light");
    });
  }

  function initScrollAnimations() {
    const items = document.querySelectorAll(".animate");
    if (!items.length) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    items.forEach((item) => observer.observe(item));
  }

  function initTabs() {
    const container = document.querySelector(".tab-buttons");
    if (!container) return;
    const section = container.closest("#products-overview");

    const tabs = Array.from(container.querySelectorAll(".tab-btn"));
    const panels = Array.from(document.querySelectorAll(".tab-content"));
    if (!tabs.length || !panels.length) return;

    container.setAttribute("role", "tablist");

    const hydratePanelImages = (panel) => {
      if (!panel) return;
      panel.querySelectorAll("img[data-src]").forEach((img) => {
        const src = img.getAttribute("data-src");
        if (!src) return;
        img.setAttribute("src", src);
        img.removeAttribute("data-src");
      });
    };

    // Defer non-active tab images to reduce initial network + decode cost.
    panels.forEach((panel) => {
      const isActive = panel.classList.contains("active");
      if (isActive) return;
      panel.querySelectorAll("img[src]").forEach((img) => {
        const src = img.getAttribute("src");
        if (!src || src.startsWith("data:")) return;
        img.setAttribute("data-src", src);
        img.removeAttribute("src");
      });
    });

    const activateTab = (btn, focus = false) => {
      const targetSelector = btn.getAttribute("data-target");
      if (!targetSelector) return;
      const targetPanel = document.querySelector(targetSelector);
      if (!targetPanel) return;
      hydratePanelImages(targetPanel);

      tabs.forEach((tab, index) => {
        const selected = tab === btn;
        tab.classList.toggle("active", selected);
        tab.setAttribute("aria-selected", selected ? "true" : "false");
        tab.setAttribute("tabindex", selected ? "0" : "-1");
        if (focus && selected) tab.focus();

        const selector = tab.getAttribute("data-target");
        const panel = selector ? document.querySelector(selector) : null;
        if (panel) {
          panel.classList.toggle("active", selected);
          panel.hidden = !selected;
        } else if (panels[index]) {
          panels[index].classList.toggle("active", selected);
          panels[index].hidden = !selected;
        }
      });
    };

    const activateByOffset = (offset) => {
      const currentIndex = tabs.findIndex((tab) => tab.classList.contains("active"));
      const baseIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = (baseIndex + offset + tabs.length) % tabs.length;
      activateTab(tabs[nextIndex]);
    };

    tabs.forEach((tab, index) => {
      tab.setAttribute("role", "tab");
      tab.id = tab.id || `tab-${index + 1}`;

      const targetSelector = tab.getAttribute("data-target");
      const panel = targetSelector ? document.querySelector(targetSelector) : null;
      if (!panel) return;

      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      panel.hidden = !tab.classList.contains("active");
    });

    container.addEventListener("click", (event) => {
      const btn = event.target.closest(".tab-btn");
      if (!btn) return;
      activateTab(btn);
    });

    container.addEventListener("keydown", (event) => {
      const current = event.target.closest(".tab-btn");
      if (!current) return;

      const currentIndex = tabs.indexOf(current);
      if (currentIndex < 0) return;

      let nextIndex = currentIndex;
      if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
      if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;

      if (nextIndex !== currentIndex) {
        event.preventDefault();
        activateTab(tabs[nextIndex], true);
      }
    });

    if (section) {
      const pulseArrow = (arrowEl) => {
        if (!arrowEl) return;
        arrowEl.classList.remove("is-pressing");
        void arrowEl.offsetWidth;
        arrowEl.classList.add("is-pressing");
      };

      const delegatedArrowNav = (event) => {
        const arrow = event.target.closest(".tab-nav-arrow");
        if (arrow && section.contains(arrow)) {
          event.preventDefault();
          event.stopPropagation();
          const dir = Number(arrow.getAttribute("data-dir") || "0");
          if (!dir) return;
          pulseArrow(arrow);
          activateByOffset(dir);
          return;
        }

        // Fallback: if the click lands on overlaid content, treat left/right edge zones as arrow taps.
        const rect = section.getBoundingClientRect();
        const x = event.clientX;
        const y = event.clientY;
        const withinYBand = y >= rect.top + rect.height * 0.22 && y <= rect.top + rect.height * 0.78;
        if (!withinYBand) return;
        if (x <= rect.left + 80) {
          event.preventDefault();
          pulseArrow(section.querySelector(".tab-nav-arrow--left"));
          activateByOffset(-1);
          return;
        }
        if (x >= rect.right - 80) {
          event.preventDefault();
          pulseArrow(section.querySelector(".tab-nav-arrow--right"));
          activateByOffset(1);
        }
      };

      section.addEventListener("click", delegatedArrowNav, true);

      // Keep arrows visible while Products Overview is on screen.
      if ("IntersectionObserver" in window) {
        const sectionObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              section.classList.toggle("is-in-view", entry.isIntersecting && entry.intersectionRatio > 0.08);
            });
          },
          { threshold: [0, 0.08, 0.2, 0.5] }
        );
        sectionObserver.observe(section);
      } else {
        section.classList.add("is-in-view");
      }

      // Mobile swipe between tabs (left/right) without relying on arrows.
      let touchStartX = 0;
      let touchStartY = 0;
      let touchActive = false;

      section.addEventListener(
        "touchstart",
        (event) => {
          if (!event.changedTouches || !event.changedTouches.length) return;
          const touch = event.changedTouches[0];
          touchStartX = touch.clientX;
          touchStartY = touch.clientY;
          touchActive = true;
        },
        { passive: true }
      );

      section.addEventListener(
        "touchend",
        (event) => {
          if (!touchActive || !event.changedTouches || !event.changedTouches.length) return;
          const touch = event.changedTouches[0];
          const deltaX = touch.clientX - touchStartX;
          const deltaY = touch.clientY - touchStartY;
          touchActive = false;

          const absX = Math.abs(deltaX);
          const absY = Math.abs(deltaY);
          if (absX < 48 || absX < absY * 1.25) return;
          activateByOffset(deltaX < 0 ? 1 : -1);
        },
        { passive: true }
      );
    }

    const activeTab = tabs.find((tab) => tab.classList.contains("active")) || tabs[0];
    if (activeTab) activateTab(activeTab);
  }

  function initMobileMenu() {
    const toggle = document.getElementById("mobile-menu");
    const menu = document.querySelector(".navbar__menu");
    if (!toggle || !menu) return;

    const menuId = menu.id || "primary-menu";
    menu.id = menuId;
    toggle.setAttribute("aria-controls", menuId);
    toggle.setAttribute("aria-expanded", "false");

    const setOpen = (open) => {
      menu.classList.toggle("active", open);
      toggle.classList.toggle("active", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };

    const isOpen = () => menu.classList.contains("active");

    toggle.addEventListener("click", () => {
      setOpen(!isOpen());
    });

    toggle.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setOpen(!isOpen());
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!isOpen()) return;
      setOpen(false);
      toggle.focus();
    });

    document.addEventListener("click", (event) => {
      if (!isOpen()) return;
      if (menu.contains(event.target) || toggle.contains(event.target)) return;
      setOpen(false);
    });

    toggle.addEventListener("blur", () => {
      if (!isOpen()) toggle.setAttribute("aria-expanded", "false");
    });

    toggle.addEventListener("focus", () => {
      if (!isOpen()) toggle.setAttribute("aria-expanded", "false");
    });

    menu.addEventListener("click", (event) => {
      const link = event.target.closest("a.navbar__links");
      if (!link) return;
      setOpen(false);
    });
  }

  function initExternalLinks() {
    document.querySelectorAll("a[href^='http']").forEach((anchor) => {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    });
  }

  onReady(() => {
    normalizeHomepageUrl();
    initThemeToggle();
    initScrollAnimations();
    initTabs();
    initMobileMenu();
    initCoreAccordions();
    initExternalLinks();
  });

  function initCoreAccordions() {
    const sections = Array.from(document.querySelectorAll(".core-services-section"));
    if (!sections.length) return;

    const desktopMQ = window.matchMedia("(min-width: 1025px)");
    let lastScrollAt = 0;
    let rafId = 0;

    const markScroll = () => {
      lastScrollAt = performance.now();
    };

    window.addEventListener("wheel", markScroll, { passive: true });
    window.addEventListener("scroll", markScroll, { passive: true });

    const syncPreview = (section, line) => {
      if (!section || !line) return;
      const previewImg = section.querySelector(".core-group-preview img");
      const src = line.dataset.image;
      if (!previewImg || !src) return;
      if (previewImg.getAttribute("src") !== src) previewImg.setAttribute("src", src);
    };

    const activateLine = (section, line) => {
      if (!section) return;
      const lines = section.__coreLines || [];
      if (!lines.length) return;
      const previousLine = section.__activeCoreLine || null;
      const previousIndex = previousLine ? lines.indexOf(previousLine) : -1;
      const nextIndex = line ? lines.indexOf(line) : -1;
      const expandDirection = previousIndex >= 0 && nextIndex >= 0 && nextIndex < previousIndex ? "rtl" : "ltr";

      lines.forEach((item) => {
        const isActive = Boolean(line) && item === line;
        item.classList.toggle("expanded", isActive);
        item.classList.toggle("collapsed", !isActive);
        item.classList.remove("expand-from-left", "expand-from-right");
        if (isActive) {
          item.classList.add(expandDirection === "rtl" ? "expand-from-right" : "expand-from-left");
        }

        const topicButton = item.querySelector(".topic-button");
        if (topicButton) topicButton.setAttribute("aria-expanded", isActive ? "true" : "false");
      });

      section.__activeCoreLine = line || null;
      if (line) syncPreview(section, line);
    };

    const setupSection = (section) => {
      const lines = Array.from(section.querySelectorAll(".core-group-list .core-line"));
      if (!lines.length) return;

      section.__coreLines = lines;

      lines.forEach((line) => {
        const src = line.dataset.image || "";
        const resolvedSrc = src ? new URL(src, window.location.href).href : "";
        line.style.setProperty("--topic-bg", resolvedSrc ? `url(\"${resolvedSrc}\")` : "none");

        const topicButton = line.querySelector(".topic-button");
        if (topicButton) topicButton.setAttribute("aria-expanded", "false");
      });

      const initial = section.querySelector(".core-line.expanded") || lines[0];
      activateLine(section, initial);

      if (section.__coreBound) return;
      section.__coreBound = true;

      section.addEventListener(
        "mouseenter",
        (event) => {
          if (!desktopMQ.matches) return;
          if (performance.now() - lastScrollAt < 150) return;
          const line = event.target.closest(".core-line");
          if (!line || !section.contains(line)) return;
          if (line === section.__activeCoreLine) return;
          activateLine(section, line);
        },
        true
      );

      section.addEventListener("focusin", (event) => {
        if (!desktopMQ.matches) return;
        const line = event.target.closest(".core-line");
        if (!line || !section.contains(line)) return;
        if (line === section.__activeCoreLine) return;
        activateLine(section, line);
      });

      section.addEventListener("click", (event) => {
        const line = event.target.closest(".core-line");
        if (!line || !section.contains(line)) return;

        const isSubtopic = event.target.closest(".subtopic-button");
        if (isSubtopic) return;

        if (desktopMQ.matches) {
          event.preventDefault();
          if (line === section.__activeCoreLine) return;
          activateLine(section, line);
          return;
        }

        const isAlreadyActive = line === section.__activeCoreLine && line.classList.contains("expanded");
        activateLine(section, isAlreadyActive ? null : line);
      });
    };

    const applyAll = () => {
      sections.forEach(setupSection);
    };

    const requestApply = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(applyAll);
    };

    applyAll();
    desktopMQ.addEventListener("change", requestApply);
    window.addEventListener("resize", requestApply, { passive: true });
  }

})();
