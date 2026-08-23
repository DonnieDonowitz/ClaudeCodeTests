/* Banner cookie minimale — nessuna dipendenza, usato su tutte le pagine del sito. */
(function () {
  "use strict";
  var STORAGE_KEY = "elisafit-notice-ack";

  function alreadyChosen() {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return false;
    }
  }

  function remember(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* localStorage non disponibile: il banner ricomparirà al prossimo caricamento, non è grave */
    }
  }

  function updateFloatOffset(banner) {
    /* Evita che il banner copra i pulsanti flottanti (torna su, CTA sticky). */
    var h = banner.classList.contains("show") ? banner.offsetHeight : 0;
    document.documentElement.style.setProperty("--float-bottom", h ? h + 36 + "px" : "24px");
  }

  function init() {
    if (alreadyChosen()) return;
    var banner = document.getElementById("site-notice");
    if (!banner) return;

    requestAnimationFrame(function () {
      banner.classList.add("show");
      updateFloatOffset(banner);
    });
    window.addEventListener("resize", function () { updateFloatOffset(banner); });

    var accept = document.getElementById("notice-ok");
    var decline = document.getElementById("notice-minimal");

    function hide(value) {
      remember(value);
      banner.classList.remove("show");
      updateFloatOffset(banner);
    }

    if (accept) accept.addEventListener("click", function () { hide("accepted"); });
    if (decline) decline.addEventListener("click", function () { hide("declined"); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
