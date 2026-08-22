/* Banner cookie minimale — nessuna dipendenza, usato su tutte le pagine del sito. */
(function () {
  "use strict";
  var STORAGE_KEY = "elisafit-cookie-consent";

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

  function init() {
    if (alreadyChosen()) return;
    var banner = document.getElementById("cookie-banner");
    if (!banner) return;

    requestAnimationFrame(function () {
      banner.classList.add("show");
    });

    var accept = document.getElementById("cookie-accept");
    var decline = document.getElementById("cookie-decline");

    function hide(value) {
      remember(value);
      banner.classList.remove("show");
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
