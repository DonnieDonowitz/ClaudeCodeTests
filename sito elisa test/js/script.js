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
    // Skrill: la tua email business Skrill (Quick Checkout). Vedi README.
    skrillMerchantEmail: "inserisci-la-tua-email@skrill-business.com",
    skrillStatusUrl: "https://hook.eu1.make.com/INSERISCI_IL_TUO_WEBHOOK_MAKE",
    returnUrl: window.location.origin + window.location.pathname.replace(/index\.html$/, "") + "thankyou.html",
    cancelUrl: window.location.href,
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

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateProgress();
        updateNav();
        updateFloating();
        ticking = false;
      });
      ticking = true;
    }
  });
  updateProgress(); updateNav(); updateFloating();

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
      navLinksBox.style.background = "rgba(11,13,16,.97)";
      navLinksBox.style.padding = "24px";
      navLinksBox.style.borderBottom = "1px solid rgba(255,255,255,.08)";
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
  initTilt(".book-3d", 14);
  initTilt(".avatar-3d", 10);
  initTilt(".price-card", 6);
  initTilt(".benefit-card", 8);

  /* ---------------- Parallax blobs on mouse move (hero) ---------------- */
  if (!prefersReducedMotion && hero) {
    const blobs = $$(".blob", hero);
    hero.addEventListener("mousemove", (e) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      blobs.forEach((b, i) => {
        const depth = (i + 1) * 14;
        b.style.transform = `translate3d(${x * depth}px, ${y * depth}px, 0)`;
      });
    });
  }

  /* ---------------- Lightweight particle network (hero canvas) ---------------- */
  const canvas = $("#particles-bg");
  if (canvas && !prefersReducedMotion) {
    const ctx = canvas.getContext("2d");
    let w, h, particles, animId;
    const COUNT = window.innerWidth < 700 ? 34 : 60;

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    function makeParticles() {
      particles = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.6,
      }));
    }
    function step() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(198,255,60,0.55)";
        ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) {
            ctx.strokeStyle = `rgba(51,224,255,${(1 - d / 130) * 0.25})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(step);
    }
    function start() {
      resize(); makeParticles();
      cancelAnimationFrame(animId);
      step();
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(animId);
      else step();
    });
    window.addEventListener("resize", () => { resize(); makeParticles(); });
    start();
  }

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
  const payTabs = $$(".pay-tab");
  payTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      payTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      $$(".pay-panel").forEach((p) => p.classList.remove("active"));
      $("#panel-" + tab.dataset.pay).classList.add("active");
    });
  });

  /* ---------------- Consent checkbox gate ---------------- */
  const consent = $("#consent-checkbox");
  const skrillBtn = $("#skrill-pay-btn");
  function refreshConsentGate() {
    const ok = consent && consent.checked;
    if (skrillBtn) skrillBtn.disabled = !ok;
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
          return actions.order.capture().then(function () {
            window.location.href = CONFIG.returnUrl + "?status=success";
          });
        },
        onError: function () {
          showToast("Si è verificato un problema con il pagamento PayPal. Riprova o scrivici via email.");
        },
      })
      .render("#paypal-button-container");
  }
  loadPaypalSdk();

  /* ---------------- Skrill Quick Checkout (redirect via form POST) ---------------- */
  if (skrillBtn) {
    skrillBtn.addEventListener("click", () => {
      if (!consent || !consent.checked) return;
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "https://pay.skrill.com/";
      form.target = "_blank";
      const fields = {
        pay_to_email: CONFIG.skrillMerchantEmail,
        recipient_description: "Elisa Fit",
        transaction_id: "ORD-" + Date.now(),
        return_url: CONFIG.returnUrl + "?status=success",
        cancel_url: CONFIG.cancelUrl,
        status_url: CONFIG.skrillStatusUrl,
        language: "IT",
        amount: CONFIG.price,
        currency: CONFIG.currency,
        detail1_description: "Prodotto",
        detail1_text: CONFIG.productName,
      };
      Object.entries(fields).forEach(([k, v]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = v;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      form.remove();
    });
  }

  /* ---------------- Cursor spotlight ---------------- */
  const glow = $("#cursor-glow");
  if (glow && !prefersReducedMotion && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    window.addEventListener("mousemove", (e) => {
      glow.classList.add("show");
      glow.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%,-50%)`;
    });
    document.addEventListener("mouseleave", () => glow.classList.remove("show"));
  }

  /* ---------------- Cinematic pinned 3D scroll transition ---------------- */
  const cineSection = $("#cinematic");
  const cineStage = $("#cine-stage");
  const cineCaptions = $$(".cine-caption");
  const cineDots = $$(".cine-dots span");

  function smooth01(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x * x * (3 - 2 * x);
  }

  if (cineSection && cineStage && !prefersReducedMotion) {
    const keyframes = [
      { p: 0, ry: -24, rx: 8, s: 0.8, z: -40 },
      { p: 0.5, ry: 180, rx: -6, s: 1.05, z: 60 },
      { p: 1, ry: 380, rx: 0, s: 1.3, z: 160 },
    ];

    function lerpStage(progress) {
      let a = keyframes[0], b = keyframes[keyframes.length - 1];
      for (let i = 0; i < keyframes.length - 1; i++) {
        if (progress >= keyframes[i].p && progress <= keyframes[i + 1].p) {
          a = keyframes[i]; b = keyframes[i + 1];
          break;
        }
      }
      const span = b.p - a.p || 1;
      const t = (progress - a.p) / span;
      return {
        ry: a.ry + (b.ry - a.ry) * t,
        rx: a.rx + (b.rx - a.rx) * t,
        s: a.s + (b.s - a.s) * t,
        z: a.z + (b.z - a.z) * t,
      };
    }

    function updateCinematic() {
      const rect = cineSection.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;

      const kf = lerpStage(progress);
      cineStage.style.transform = `translateZ(${kf.z}px) rotateY(${kf.ry}deg) rotateX(${kf.rx}deg) scale(${kf.s})`;

      cineCaptions.forEach((cap) => {
        const [s, e] = cap.dataset.range.split(",").map(Number);
        const local = (progress - s) / (e - s || 1);
        let opacity = 0;
        if (local >= 0 && local <= 1) {
          opacity = Math.min(smooth01(local / 0.2), smooth01((1 - local) / 0.2), 1);
        }
        cap.style.opacity = String(opacity);
        cap.classList.toggle("show", opacity > 0.02);
      });

      const dotIndex = progress < 0.335 ? 0 : progress < 0.665 ? 1 : 2;
      cineDots.forEach((d, i) => d.classList.toggle("active", i === dotIndex));
    }

    let cineTicking = false;
    window.addEventListener("scroll", () => {
      if (!cineTicking) {
        requestAnimationFrame(() => { updateCinematic(); cineTicking = false; });
        cineTicking = true;
      }
    });
    window.addEventListener("resize", updateCinematic);
    updateCinematic();
  } else if (cineCaptions.length) {
    cineCaptions.forEach((cap) => { cap.style.opacity = "1"; cap.classList.add("show"); });
  }

  /* ---------------- Pinned horizontal module gallery ---------------- */
  const pinGallery = $(".pin-gallery");
  const pinTrack = $("#pin-track");
  const pinViewport = $(".pin-gallery-viewport");
  const pinProgressBar = $("#pin-progress-bar");

  if (pinGallery && pinTrack && pinViewport) {
    const desktopQuery = window.matchMedia("(min-width: 901px)");
    let maxTranslate = 0;
    let pinActive = false;

    function measurePinGallery() {
      const trackWidth = pinTrack.scrollWidth;
      const viewportWidth = pinViewport.clientWidth;
      maxTranslate = Math.max(0, trackWidth - viewportWidth);
      pinGallery.style.height = window.innerHeight + maxTranslate + "px";
    }

    function updatePinGallery() {
      if (!pinActive) return;
      const rect = pinGallery.getBoundingClientRect();
      const progress = maxTranslate > 0 ? Math.min(1, Math.max(0, -rect.top / maxTranslate)) : 0;
      pinTrack.style.transform = `translate3d(${-progress * maxTranslate}px,0,0)`;
      if (pinProgressBar) pinProgressBar.style.width = progress * 100 + "%";
    }

    function setupPinMode() {
      if (desktopQuery.matches && !prefersReducedMotion) {
        pinActive = true;
        measurePinGallery();
        updatePinGallery();
      } else {
        pinActive = false;
        pinGallery.style.height = "";
        pinTrack.style.transform = "";
        if (pinProgressBar) pinProgressBar.style.width = "0%";
      }
    }

    let pinTicking = false;
    window.addEventListener("scroll", () => {
      if (!pinTicking) {
        requestAnimationFrame(() => { updatePinGallery(); pinTicking = false; });
        pinTicking = true;
      }
    });
    window.addEventListener("resize", () => { setupPinMode(); });
    setupPinMode();
  }

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
