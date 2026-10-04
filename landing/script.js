"use strict";

(function initLanding() {
  var COPY_RESET_MS = 2000;

  function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(value);
    }
    return new Promise(function resolveFallback(resolve, reject) {
      var area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      try {
        var ok = document.execCommand("copy");
        document.body.removeChild(area);
        if (ok) {
          resolve();
        } else {
          reject(new Error("execCommand copy failed"));
        }
      } catch (error) {
        document.body.removeChild(area);
        reject(error);
      }
    });
  }

  function initCopyButtons() {
    var buttons = document.querySelectorAll("[data-copy-target]");
    buttons.forEach(function bindCopy(button) {
      button.addEventListener("click", function onClick() {
        var target = document.querySelector(button.getAttribute("data-copy-target"));
        if (!target) {
          return;
        }
        var value = target.textContent.trim();
        copyText(value).then(function onCopied() {
          button.textContent = "Copied";
          window.setTimeout(function reset() {
            button.textContent = "Copy";
          }, COPY_RESET_MS);
        }).catch(function onFail() {
          button.textContent = "Copy failed";
          window.setTimeout(function reset() {
            button.textContent = "Copy";
          }, COPY_RESET_MS);
        });
      });
    });
  }

  function initMobileMenu() {
    var toggle = document.getElementById("menu-toggle");
    var menu = document.getElementById("mobile-menu");
    if (!toggle || !menu) {
      return;
    }

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        menu.removeAttribute("hidden");
      } else {
        menu.setAttribute("hidden", "");
      }
    }

    toggle.addEventListener("click", function onToggle() {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    menu.addEventListener("click", function onMenuClick(event) {
      if (event.target.closest("a")) {
        setOpen(false);
      }
    });

    document.addEventListener("keydown", function onKey(event) {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  initCopyButtons();
  initMobileMenu();
})();
