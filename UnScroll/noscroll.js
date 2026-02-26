(function () {
  "use strict";

  var DEFAULT_SKIP = [
    "youtube.com",
    "docs.google.com",
    "sheets.google.com",
    "slides.google.com",
    "drive.google.com",
    "mail.google.com",
    "calendar.google.com",
    "meet.google.com",
    "maps.google.com",
    "figma.com",
    "codepen.io",
    "codesandbox.io"
  ];

  var BAR_HEIGHT = 56;
  var CHECK_INTERVAL = 2000;
  var SCROLL_COOLDOWN = 400;

  var currentPage = 1;
  var totalPages = 1;
  var stepHeight = 0;
  var contentHeight = 0;
  var isInitialized = false;
  var wrapper = null;
  var lastScrollTime = 0;
  var scrollAccumulator = 0;
  var SCROLL_THRESHOLD = 80;

  function checkAndStart() {
    var host = window.location.hostname || "";
    host = host.replace("www.", "");

    chrome.storage.sync.get({ skipSites: null }, function (data) {
      var skipList;
      if (data.skipSites === null) {
        skipList = DEFAULT_SKIP;
      } else {
        skipList = data.skipSites;
      }

      var shouldSkip = false;
      for (var i = 0; i < skipList.length; i++) {
        if (host.indexOf(skipList[i]) !== -1) {
          shouldSkip = true;
          break;
        }
      }

      if (shouldSkip) {
        return;
      }

      startExtension();
    });
  }

  chrome.storage.onChanged.addListener(function (changes) {
    if (changes.skipSites) {
      var host = window.location.hostname.replace("www.", "");
      var newList = changes.skipSites.newValue || [];
      var oldList = changes.skipSites.oldValue || [];

      var nowSkipped = false;
      for (var i = 0; i < newList.length; i++) {
        if (host.indexOf(newList[i]) !== -1) {
          nowSkipped = true;
          break;
        }
      }

      var wasSkipped = false;
      for (var j = 0; j < oldList.length; j++) {
        if (host.indexOf(oldList[j]) !== -1) {
          wasSkipped = true;
          break;
        }
      }

      if (nowSkipped !== wasSkipped) {
        window.location.reload();
      }
    }
  });

  function startExtension() {
    if (document.documentElement) {
      document.documentElement.style.overflow = "hidden";
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        setTimeout(initialize, 500);
      });
    } else {
      setTimeout(initialize, 500);
    }

    window.addEventListener("load", function () {
      setTimeout(function () {
        if (!isInitialized) {
          initialize();
        }
        setTimeout(function () {
          calculatePages();
          updateBar();
        }, 500);
      }, 1000);
    });
  }

  function wrapContent() {
    wrapper = document.createElement("div");
    wrapper.id = "noscroll-wrapper";

    while (document.body.firstChild) {
      wrapper.appendChild(document.body.firstChild);
    }

    document.body.appendChild(wrapper);

    wrapper.style.cssText =
      "position: relative !important;" +
      "top: 0px !important;" +
      "left: 0 !important;" +
      "width: 100% !important;" +
      "padding-bottom: " + BAR_HEIGHT + "px !important;";
  }

  function killScrolling() {
    document.documentElement.classList.add("noscroll-active");

    document.addEventListener("wheel", handleWheel, {
      passive: false, capture: true
    });

    document.addEventListener("touchmove", stopEvent, {
      passive: false, capture: true
    });

    document.addEventListener("keydown", handleKeys, { capture: true });

    // Handle touch gestures for mobile/tablet
    var touchStartY = 0;
    var touchHandled = false;

    document.addEventListener("touchstart", function (e) {
      if (e.target && e.target.closest && e.target.closest("#noscroll-bar")) {
        return;
      }
      if (e.touches && e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        touchHandled = false;
      }
    }, { passive: true, capture: true });

    document.addEventListener("touchend", function (e) {
      if (touchHandled) { return; }
      if (e.changedTouches && e.changedTouches.length === 1) {
        var touchEndY = e.changedTouches[0].clientY;
        var diff = touchStartY - touchEndY;

        if (Math.abs(diff) > 50) {
          touchHandled = true;
          if (diff > 0) {
            goToPage(currentPage + 1);
          } else {
            goToPage(currentPage - 1);
          }
        }
      }
    }, { passive: true, capture: true });

    setInterval(function () {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    }, 50);

    window.addEventListener("scroll", function () {
      window.scrollTo(0, 0);
    }, { capture: true });
  }

  function handleWheel(e) {
    // Allow scrolling inside our bar
    if (e.target && e.target.closest && e.target.closest("#noscroll-bar")) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var now = Date.now();
    var delta = e.deltaY;

    // Reset accumulator if enough time has passed since last scroll
    if (now - lastScrollTime > SCROLL_COOLDOWN) {
      scrollAccumulator = 0;
    }

    lastScrollTime = now;

    // Accumulate scroll delta
    scrollAccumulator += delta;

    // Once accumulated scroll passes the threshold, change page
    if (scrollAccumulator > SCROLL_THRESHOLD) {
      scrollAccumulator = 0;
      goToPage(currentPage + 1);
    } else if (scrollAccumulator < -SCROLL_THRESHOLD) {
      scrollAccumulator = 0;
      goToPage(currentPage - 1);
    }
  }

  function stopEvent(e) {
    if (e.target && e.target.closest &&
        e.target.closest("#noscroll-bar")) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function handleKeys(e) {
    var tag = "";
    if (e.target && e.target.tagName) {
      tag = e.target.tagName.toUpperCase();
    }
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      return;
    }
    if (e.target && e.target.isContentEditable) {
      return;
    }

    var key = e.key || "";

    if (key === "ArrowRight" || key === "PageDown" || key === " ") {
      e.preventDefault();
      e.stopPropagation();
      goToPage(currentPage + 1);
      return;
    }
    if (key === "ArrowLeft" || key === "PageUp") {
      e.preventDefault();
      e.stopPropagation();
      goToPage(currentPage - 1);
      return;
    }
    if (key === "Home") {
      e.preventDefault();
      e.stopPropagation();
      goToPage(1);
      return;
    }
    if (key === "End") {
      e.preventDefault();
      e.stopPropagation();
      goToPage(totalPages);
      return;
    }
    if (key === "ArrowDown" || key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }

  function calculatePages() {
    stepHeight = window.innerHeight - BAR_HEIGHT;

    if (stepHeight < 100) {
      stepHeight = 400;
    }

    if (wrapper) {
      contentHeight = wrapper.scrollHeight;
    } else {
      contentHeight = Math.max(
        document.body.scrollHeight || 0,
        document.documentElement.scrollHeight || 0
      );
    }

    if (contentHeight <= stepHeight) {
      totalPages = 1;
    } else {
      totalPages = Math.ceil(contentHeight / stepHeight);
    }

    if (totalPages < 1) { totalPages = 1; }
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
  }

  function goToPage(page) {
    if (page < 1) { page = 1; }
    if (page > totalPages) { page = totalPages; }

    currentPage = page;

    if (wrapper) {
      var offset = (currentPage - 1) * stepHeight;

      var maxOffset = contentHeight - stepHeight;
      if (maxOffset < 0) { maxOffset = 0; }
      if (offset > maxOffset) { offset = maxOffset; }

      wrapper.style.top = "-" + offset + "px";
    }

    window.scrollTo(0, 0);
    updateBar();
  }

  function buildBar() {
    var existing = document.getElementById("noscroll-bar");
    if (existing) {
      existing.parentNode.removeChild(existing);
    }

    var barEl = document.createElement("div");
    barEl.id = "noscroll-bar";
    barEl.setAttribute("style",
      "position: fixed !important;" +
      "bottom: 0 !important;" +
      "left: 0 !important;" +
      "width: 100vw !important;" +
      "height: " + BAR_HEIGHT + "px !important;" +
      "min-height: " + BAR_HEIGHT + "px !important;" +
      "max-height: " + BAR_HEIGHT + "px !important;" +
      "background: #1a1a2e !important;" +
      "display: flex !important;" +
      "flex-direction: row !important;" +
      "justify-content: center !important;" +
      "align-items: center !important;" +
      "gap: 6px !important;" +
      "z-index: 2147483647 !important;" +
      "border-top: 2px solid #4361ee !important;" +
      "font-family: -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif !important;" +
      "box-shadow: 0 -4px 20px rgba(0,0,0,0.4) !important;" +
      "padding: 0 10px !important;" +
      "overflow: hidden !important;" +
      "pointer-events: auto !important;"
    );

    document.body.appendChild(barEl);
    updateBar();
  }

  function makeBtn(text, pageNum, isActive, isDisabled) {
    var btn = document.createElement("button");
    btn.textContent = text;

    var bg = isActive ? "#4361ee" : "#16213e";
    var col = isActive ? "#ffffff" : "#e0e0e0";
    var fw = isActive ? "700" : "500";
    var op = isDisabled ? "0.3" : "1";
    var cur = isDisabled ? "not-allowed" : "pointer";

    btn.setAttribute("style",
      "display:inline-block !important;" +
      "padding:7px 14px !important;" +
      "margin:0 !important;" +
      "border:1px solid #4361ee !important;" +
      "background:" + bg + " !important;" +
      "color:" + col + " !important;" +
      "border-radius:5px !important;" +
      "cursor:" + cur + " !important;" +
      "font-size:13px !important;" +
      "font-weight:" + fw + " !important;" +
      "opacity:" + op + " !important;" +
      "font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif !important;" +
      "line-height:1.2 !important;" +
      "white-space:nowrap !important;" +
      "min-width:36px !important;" +
      "height:34px !important;" +
      "pointer-events:auto !important;" +
      "position:static !important;" +
      "text-decoration:none !important;" +
      "float:none !important;"
    );

    if (!isDisabled) {
      btn.addEventListener("mouseenter", function () {
        if (!isActive) {
          btn.style.background = "#4361ee";
          btn.style.color = "#fff";
        }
      });
      btn.addEventListener("mouseleave", function () {
        if (!isActive) {
          btn.style.background = bg;
          btn.style.color = col;
        }
      });
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        goToPage(pageNum);
      });
    }

    return btn;
  }

  function getPageNumbers(current, total) {
    var pages = [];
    var i;
    if (total <= 9) {
      for (i = 1; i <= total; i++) { pages.push(i); }
      return pages;
    }
    pages.push(1);
    if (current > 4) { pages.push("dots"); }
    var s = current - 2;
    if (s < 2) { s = 2; }
    var end = current + 2;
    if (end > total - 1) { end = total - 1; }
    for (i = s; i <= end; i++) { pages.push(i); }
    if (current < total - 3) { pages.push("dots"); }
    pages.push(total);
    return pages;
  }

  function updateBar() {
    var barEl = document.getElementById("noscroll-bar");
    if (!barEl) { return; }

    while (barEl.firstChild) {
      barEl.removeChild(barEl.firstChild);
    }

    barEl.appendChild(makeBtn("First", 1, false, currentPage === 1));
    barEl.appendChild(makeBtn("Prev", currentPage - 1, false, currentPage === 1));

    var pages = getPageNumbers(currentPage, totalPages);
    for (var i = 0; i < pages.length; i++) {
      if (pages[i] === "dots") {
        var d = document.createElement("span");
        d.textContent = "...";
        d.setAttribute("style",
          "color:#666 !important;" +
          "padding:0 2px !important;" +
          "font-size:14px !important;"
        );
        barEl.appendChild(d);
      } else {
        barEl.appendChild(makeBtn(
          String(pages[i]),
          pages[i],
          pages[i] === currentPage,
          false
        ));
      }
    }

    barEl.appendChild(makeBtn("Next", currentPage + 1, false, currentPage === totalPages));
    barEl.appendChild(makeBtn("Last", totalPages, false, currentPage === totalPages));

    var info = document.createElement("span");
    info.textContent = "Page " + currentPage + " / " + totalPages;
    info.setAttribute("style",
      "color:#a0a0a0 !important;" +
      "font-size:11px !important;" +
      "font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif !important;" +
      "margin-left:10px !important;" +
      "white-space:nowrap !important;"
    );
    barEl.appendChild(info);
  }

  function showNotice() {
    var n = document.createElement("div");
    n.textContent = "Unscroll active. Scroll, swipe, or use arrow keys to turn pages.";
    n.setAttribute("style",
      "position:fixed !important;" +
      "top:16px !important;" +
      "right:16px !important;" +
      "background:rgba(26,26,46,0.95) !important;" +
      "color:#e0e0e0 !important;" +
      "padding:12px 20px !important;" +
      "border-radius:8px !important;" +
      "border:1px solid #4361ee !important;" +
      "z-index:2147483647 !important;" +
      "font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif !important;" +
      "font-size:13px !important;" +
      "box-shadow:0 4px 20px rgba(0,0,0,0.4) !important;" +
      "max-width:300px !important;"
    );
    document.body.appendChild(n);

    setTimeout(function () {
      n.style.opacity = "0";
      n.style.transition = "opacity 0.5s ease";
      setTimeout(function () {
        if (n.parentNode) { n.parentNode.removeChild(n); }
      }, 600);
    }, 3000);
  }

  function startMonitor() {
    setInterval(function () {
      var old = totalPages;
      calculatePages();
      if (totalPages !== old) {
        updateBar();
      }
    }, CHECK_INTERVAL);

    if (typeof MutationObserver !== "undefined" && wrapper) {
      var obs = new MutationObserver(function () {
        var old = totalPages;
        calculatePages();
        if (totalPages !== old) {
          updateBar();
        }
      });
      obs.observe(wrapper, { childList: true, subtree: true });
    }
  }

  function initialize() {
    if (isInitialized) { return; }
    if (!document.body) { return; }
    isInitialized = true;

    wrapContent();
    killScrolling();

    document.documentElement.style.cssText =
      "overflow:hidden !important;" +
      "height:100vh !important;" +
      "max-height:100vh !important;" +
      "margin:0 !important;" +
      "padding:0 !important;";

    document.body.style.cssText =
      "overflow:hidden !important;" +
      "height:100vh !important;" +
      "max-height:100vh !important;" +
      "margin:0 !important;" +
      "padding:0 !important;" +
      "position:relative !important;";

    calculatePages();
    buildBar();
    goToPage(1);
    showNotice();

    window.addEventListener("resize", function () {
      calculatePages();
      goToPage(currentPage);
    });

    startMonitor();
  }

  checkAndStart();

})();