/* =============================================================
   ELISA FIT — script.js (vanilla JS, nessuna dipendenza esterna)
   ============================================================= */
(function () {
  "use strict";

  /* ---------------- Config prodotto (modifica qui i tuoi dati) ---------------- */
  const CONFIG = {
    productName: "Trasformazione Totale — Guida Personal Trainer",
    price: "27.00",
    currency: "EUR",
    // PayPal: crea un'app su https://developer.paypal.com/dashboard/applications
    // e incolla qui il tuo CLIENT ID "Live". Vedi README per la guida completa.
    paypalClientId: "TEST_INSERISCI_IL_TUO_PAYPAL_CLIENT_ID",
    returnUrl: window.location.origin + window.location.pathname.replace(/index\.html$/, "") + "thankyou.html",
  };

  /* ---------------- Utility ---------------- */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Anno footer ---------------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------- Scroll progress bar ---------------- */
  const progressBar = $("#scroll-progress");
  function updateProgress() {
    const h = document.documentElement;
    const scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
    if (progressBar) progressBar.style.width = scrolled + "%";
  }

  /* ---------------- Navbar scroll state + active link ---------------- */
  const navbar = $(".navbar");
  const navLinks = $$(".nav-links a");
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  function updateNav() {
    if (navbar) navbar.classList.toggle("scrolled", window.scrollY > 40);
    let current = sections[0];
    sections.forEach((sec) => {
      if (window.scrollY + 140 >= sec.offsetTop) current = sec;
    });
    navLinks.forEach((a) => {
      a.classList.toggle("active", current && a.getAttribute("href") === "#" + current.id);
    });
  }

  /* ---------------- Sticky CTA + back to top ---------------- */
  const stickyCta = $("#sticky-cta");
  const toTop = $("#to-top");
  const hero = $(".hero");

  function updateFloating() {
    const heroBottom = hero ? hero.offsetTop + hero.offsetHeight : 600;
    const past = window.scrollY > heroBottom;
    if (stickyCta) stickyCta.classList.toggle("show", past);
    if (toTop) toTop.classList.toggle("show", window.scrollY > 900);
  }

  /* ---------------- Mini-nav laterale a puntini (scroll-spy) ---------------- */
  const sideNav = $("#side-nav");
  const sideNavLinks = $$(".side-nav a");
  const sideNavSections = sideNavLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  function updateSideNav() {
    if (!sideNav) return;
    const heroBottom = hero ? hero.offsetTop + hero.offsetHeight * 0.6 : 400;
    sideNav.classList.toggle("show", window.scrollY > heroBottom);
    let current = null;
    sideNavSections.forEach((sec) => {
      if (window.scrollY + 220 >= sec.offsetTop) current = sec;
    });
    sideNavLinks.forEach((a) => {
      a.classList.toggle("active", !!current && a.getAttribute("href") === "#" + current.id);
    });
  }

  /* ---------------- Parallax leggero sul visual dell'hero ---------------- */
  const tiltWrap = $(".tilt-wrap");
  function updateHeroParallax() {
    if (!tiltWrap || !hero || prefersReducedMotion) return;
    const rect = hero.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    const progress = Math.min(1, Math.max(0, -rect.top / (rect.height || 1)));
    tiltWrap.style.transform = `translateY(${progress * 46}px)`;
  }

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateProgress();
        updateNav();
        updateFloating();
        updateSideNav();
        updateHeroParallax();
        ticking = false;
      });
      ticking = true;
    }
  });
  updateProgress(); updateNav(); updateFloating(); updateSideNav(); updateHeroParallax();

  if (toTop) toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  /* ---------------- Mobile nav toggle ---------------- */
  const navToggle = $("#nav-toggle");
  const navLinksBox = $("#nav-links");
  if (navToggle && navLinksBox) {
    navToggle.addEventListener("click", () => {
      navLinksBox.classList.toggle("mobile-open");
      navLinksBox.style.display = navLinksBox.classList.contains("mobile-open") ? "flex" : "";
      navLinksBox.style.position = "absolute";
      navLinksBox.style.top = "100%";
      navLinksBox.style.left = "0";
      navLinksBox.style.right = "0";
      navLinksBox.style.flexDirection = "column";
      navLinksBox.style.background = "rgba(250,247,242,.98)";
      navLinksBox.style.padding = "24px";
      navLinksBox.style.borderBottom = "1px solid var(--card-border)";
    });
    $$("a", navLinksBox).forEach((a) =>
      a.addEventListener("click", () => {
        navLinksBox.classList.remove("mobile-open");
        navLinksBox.style.display = "";
      })
    );
  }

  /* ---------------- Reveal on scroll (IntersectionObserver) ---------------- */
  const revealEls = $$(".reveal, .reveal-scale");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* ---------------- Animated counters ---------------- */
  const counters = $$("[data-count]");
  function animateCounter(el) {
    const target = parseFloat(el.getAttribute("data-count"));
    const suffix = el.getAttribute("data-suffix") || "";
    const decimals = el.getAttribute("data-decimals") ? parseInt(el.getAttribute("data-decimals"), 10) : 0;
    const duration = 1600;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = target * eased;
      el.textContent = (decimals ? val.toFixed(decimals) : Math.round(val)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if ("IntersectionObserver" in window && counters.length) {
    const ioCount = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            ioCount.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => ioCount.observe(el));
  }

  /* ---------------- 3D tilt (mouse move) ---------------- */
  function initTilt(selector, intensity) {
    const els = $$(selector);
    if (!els.length || prefersReducedMotion) return;
    els.forEach((el) => {
      const strength = intensity || 12;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(1400px) rotateY(${x * strength}deg) rotateX(${-y * strength}deg)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "perspective(1400px) rotateY(0deg) rotateX(0deg)";
      });
    });
  }
  initTilt(".book-3d", 6);

  /* ---------------- Testimonial slider ---------------- */
  const track = $("#testi-track");
  const dotsWrap = $("#testi-dots");
  if (track) {
    const slides = $$(".testi-card", track);
    const perView = () => (window.innerWidth >= 800 ? 3 : 1);
    let index = 0;
    let autoplay;

    function maxIndex() { return Math.max(0, slides.length - perView()); }
    function render() {
      const pct = (100 / perView()) * Math.min(index, maxIndex());
      track.style.transform = `translateX(-${pct}%)`;
      if (dotsWrap) $$("button", dotsWrap).forEach((d, i) => d.classList.toggle("active", i === index));
    }
    if (dotsWrap) {
      dotsWrap.innerHTML = "";
      for (let i = 0; i <= maxIndex(); i++) {
        const b = document.createElement("button");
        b.addEventListener("click", () => { index = i; render(); resetAutoplay(); });
        dotsWrap.appendChild(b);
      }
    }
    function next() { index = index >= maxIndex() ? 0 : index + 1; render(); }
    function resetAutoplay() {
      clearInterval(autoplay);
      autoplay = setInterval(next, 4500);
    }
    window.addEventListener("resize", () => { index = 0; render(); if (dotsWrap) { dotsWrap.innerHTML = ""; for (let i = 0; i <= maxIndex(); i++) { const b = document.createElement("button"); b.addEventListener("click", () => { index = i; render(); resetAutoplay(); }); dotsWrap.appendChild(b); } render(); } });
    render();
    resetAutoplay();
  }

  /* ---------------- FAQ accordion ---------------- */
  $$(".faq-item").forEach((item) => {
    const q = $(".faq-q", item);
    const a = $(".faq-a", item);
    q.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      $$(".faq-item").forEach((i) => {
        i.classList.remove("open");
        $(".faq-a", i).style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add("open");
        a.style.maxHeight = a.scrollHeight + "px";
      }
    });
  });

  /* ---------------- Countdown (offerta valida fino a mezzanotte) ---------------- */
  const cd = { h: $("#cd-h"), m: $("#cd-m"), s: $("#cd-s") };
  if (cd.h && cd.m && cd.s) {
    function tick() {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      let diff = Math.max(0, end - now);
      const h = Math.floor(diff / 3.6e6);
      const m = Math.floor((diff % 3.6e6) / 6e4);
      const s = Math.floor((diff % 6e4) / 1000);
      cd.h.textContent = String(h).padStart(2, "0");
      cd.m.textContent = String(m).padStart(2, "0");
      cd.s.textContent = String(s).padStart(2, "0");
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------------- Payment method tabs ---------------- */
  /* ---------------- Consent checkbox gate ---------------- */
  const consent = $("#consent-checkbox");
  function refreshConsentGate() {
    const ok = consent && consent.checked;
    $("#paypal-button-container")?.classList.toggle("disabled-overlay", !ok);
  }
  if (consent) {
    consent.addEventListener("change", refreshConsentGate);
    refreshConsentGate();
  }

  /* ---------------- Toast helper ---------------- */
  function showToast(msg) {
    let t = $("#toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 4500);
  }

  /* ---------------- PayPal Buttons ---------------- */
  function renderPaypalFallback() {
    const box = $("#paypal-button-container");
    if (!box) return;
    box.innerHTML =
      '<p style="font-size:.8rem;color:var(--text-dim);text-align:center;padding:14px;border:1px dashed var(--card-border);border-radius:12px;">Configura il tuo PayPal Client ID in <code>js/script.js</code> (CONFIG.paypalClientId) per attivare il pulsante di pagamento. Vedi il README per la guida passo-passo.</p>';
  }

  function loadPaypalSdk() {
    if (!CONFIG.paypalClientId || CONFIG.paypalClientId.startsWith("TEST_INSERISCI")) {
      renderPaypalFallback();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(CONFIG.paypalClientId)}&currency=${CONFIG.currency}&intent=capture`;
    script.onload = renderPaypalButtons;
    script.onerror = renderPaypalFallback;
    document.head.appendChild(script);
  }

  function renderPaypalButtons() {
    if (!window.paypal || !$("#paypal-button-container")) return;
    window.paypal
      .Buttons({
        style: { shape: "pill", color: "gold", layout: "vertical", label: "paypal" },
        onInit: function (data, actions) {
          actions.disable();
          if (consent) {
            consent.addEventListener("change", () => (consent.checked ? actions.enable() : actions.disable()));
          } else {
            actions.enable();
          }
        },
        createOrder: function (data, actions) {
          return actions.order.create({
            purchase_units: [
              {
                description: CONFIG.productName,
                amount: { value: CONFIG.price, currency_code: CONFIG.currency },
              },
            ],
            application_context: { shipping_preference: "NO_SHIPPING" },
          });
        },
        onApprove: function (data, actions) {
          return actions.order.capture().then(function (details) {
            // La consegna vera e propria dell'ebook avviene lato server: PayPal invia
            // un webhook a api/paypal-webhook.php non appena il pagamento è confermato,
            // che genera un link di download sicuro e lo invia via email al pagatore.
            // Questo redirect serve solo per l'esperienza utente sul sito.
            window.location.href = CONFIG.returnUrl + "?order=" + encodeURIComponent(details.id || data.orderID || "");
          });
        },
        onError: function () {
          showToast("Si è verificato un problema con il pagamento PayPal. Riprova o scrivici via email.");
        },
      })
      .render("#paypal-button-container");
  }
  loadPaypalSdk();

  /* ---------------- Anno / smooth anchor fallback per Safari vecchi ---------------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
})();
