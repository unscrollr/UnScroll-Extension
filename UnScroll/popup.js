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

  var skipList = [];
  var currentHost = "";

  function getCurrentTab(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs[0] && tabs[0].url) {
        try {
          var url = new URL(tabs[0].url);
          callback(url.hostname.replace("www.", ""));
        } catch (e) {
          callback("");
        }
      } else {
        callback("");
      }
    });
  }

  function loadSkipList(callback) {
    chrome.storage.sync.get({ skipSites: null }, function (data) {
      if (data.skipSites === null) {
        skipList = DEFAULT_SKIP.slice();
        saveSkipList(callback);
      } else {
        skipList = data.skipSites;
        if (callback) { callback(); }
      }
    });
  }

  function saveSkipList(callback) {
    chrome.storage.sync.set({ skipSites: skipList }, function () {
      if (callback) { callback(); }
    });
  }

  function isSkipped(host) {
    for (var i = 0; i < skipList.length; i++) {
      if (host.indexOf(skipList[i]) !== -1) {
        return true;
      }
    }
    return false;
  }

  function renderSkipList() {
    var container = document.getElementById("skip-list");
    container.innerHTML = "";

    if (skipList.length === 0) {
      container.innerHTML = '<div style="color:#555;font-size:11px;padding:8px;text-align:center">No disabled sites</div>';
      return;
    }

    var sorted = skipList.slice().sort();

    for (var i = 0; i < sorted.length; i++) {
      (function (site) {
        var item = document.createElement("div");
        item.className = "skip-item";

        var name = document.createElement("span");
        name.className = "skip-item-name";
        name.textContent = site;

        var removeBtn = document.createElement("button");
        removeBtn.className = "remove-btn";
        removeBtn.textContent = "X";
        removeBtn.title = "Remove " + site;
        removeBtn.addEventListener("click", function () {
          removeSite(site);
        });

        item.appendChild(name);
        item.appendChild(removeBtn);
        container.appendChild(item);
      })(sorted[i]);
    }
  }

  function updateSiteStatus() {
    var statusEl = document.getElementById("site-status");
    var btnEl = document.getElementById("toggle-site-btn");

    if (!currentHost) {
      statusEl.className = "site-status site-active";
      statusEl.textContent = "Cannot detect current site";
      btnEl.style.display = "none";
      return;
    }

    var skipped = isSkipped(currentHost);

    if (skipped) {
      statusEl.className = "site-status site-skipped";
      statusEl.textContent = "Unscroll is disabled on " + currentHost;
      btnEl.className = "current-site-btn btn-enable";
      btnEl.textContent = "Enable Unscroll on " + currentHost;
    } else {
      statusEl.className = "site-status site-active";
      statusEl.textContent = "Unscroll is active on " + currentHost;
      btnEl.className = "current-site-btn btn-disable";
      btnEl.textContent = "Disable Unscroll on " + currentHost;
    }
  }

  function addSite(site) {
    site = site.trim().toLowerCase();
    site = site.replace(/^https?:\/\//, "");
    site = site.replace(/^www\./, "");
    site = site.replace(/\/.*$/, "");

    if (!site) { return; }

    for (var i = 0; i < skipList.length; i++) {
      if (skipList[i] === site) { return; }
    }

    skipList.push(site);
    saveSkipList(function () {
      renderSkipList();
      updateSiteStatus();
    });
  }

  function removeSite(site) {
    var newList = [];
    for (var i = 0; i < skipList.length; i++) {
      if (skipList[i] !== site) {
        newList.push(skipList[i]);
      }
    }
    skipList = newList;
    saveSkipList(function () {
      renderSkipList();
      updateSiteStatus();
    });
  }

  function toggleCurrentSite() {
    if (!currentHost) { return; }

    if (isSkipped(currentHost)) {
      var matchingSite = null;
      for (var i = 0; i < skipList.length; i++) {
        if (currentHost.indexOf(skipList[i]) !== -1) {
          matchingSite = skipList[i];
          break;
        }
      }
      if (matchingSite) {
        removeSite(matchingSite);
      }
    } else {
      addSite(currentHost);
    }
  }

  function setupEvents() {
    document.getElementById("toggle-site-btn").addEventListener("click", function () {
      toggleCurrentSite();
    });

    document.getElementById("add-site-btn").addEventListener("click", function () {
      var input = document.getElementById("add-site-input");
      addSite(input.value);
      input.value = "";
    });

    document.getElementById("add-site-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        addSite(this.value);
        this.value = "";
      }
    });
  }

  function init() {
    setupEvents();

    getCurrentTab(function (host) {
      currentHost = host;

      loadSkipList(function () {
        renderSkipList();
        updateSiteStatus();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
