(function () {
  "use strict";

  var I18N = window.I18N;
  var PROJECTS = window.PROJECTS;
  var LANGS = ["si", "en", "ta"];
  var DEFAULT_LANG = "si";
  var STORAGE_KEY = "vje-lang";
  var currentLang = DEFAULT_LANG;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function lookup(obj, path) {
    return path.split(".").reduce(function (o, k) { return o && o[k] != null ? o[k] : undefined; }, obj);
  }
  function t(key) {
    var v = lookup(I18N[currentLang], key);
    return v != null ? v : lookup(I18N[DEFAULT_LANG], key) || "";
  }
  function storeGet() { try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; } }
  function storeSet(v) { try { localStorage.setItem(STORAGE_KEY, v); } catch (e) { /* ignore */ } }

  /* ---------- project illustrations ---------- */
  var PROJECT_ART = {
    echo:
      '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="10" fill="currentColor"/>' +
      '<circle class="ring r1" cx="60" cy="60" r="24" /><circle class="ring r2" cx="60" cy="60" r="38" />' +
      '<circle class="ring r3" cx="60" cy="60" r="52" /></svg>',
    steps:
      '<svg viewBox="0 0 120 120" aria-hidden="true" fill="currentColor">' +
      '<g class="step s1"><ellipse cx="42" cy="92" rx="8" ry="12"/><circle cx="38" cy="75" r="3"/><circle cx="44" cy="74" r="3"/><circle cx="49" cy="77" r="2.5"/></g>' +
      '<g class="step s2"><ellipse cx="72" cy="70" rx="8" ry="12"/><circle cx="68" cy="53" r="3"/><circle cx="74" cy="52" r="3"/><circle cx="79" cy="55" r="2.5"/></g>' +
      '<g class="step s3"><ellipse cx="48" cy="44" rx="8" ry="12"/><circle cx="44" cy="27" r="3"/><circle cx="50" cy="26" r="3"/><circle cx="55" cy="29" r="2.5"/></g></svg>',
    moon:
      '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="30" fill="currentColor" opacity=".18"/>' +
      '<path d="M70 32a30 30 0 1 0 0 56 24 24 0 1 1 0-56z" fill="currentColor"/>' +
      '<g class="sparkle"><path d="M88 30l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="currentColor"/>' +
      '<circle cx="96" cy="70" r="2.5" fill="currentColor"/><circle cx="28" cy="34" r="2" fill="currentColor"/></g></svg>',
    lotus:
      '<svg viewBox="0 0 120 120" aria-hidden="true" fill="currentColor">' +
      '<path class="petal p0" d="M60 28c9 11 12 22 12 32s-5 20-12 26c-7-6-12-16-12-26s3-21 12-32z"/>' +
      '<path class="petal p1" d="M28 50c12 2 20 7 25 15s5 16 4 21c-8 0-16-3-21-11s-8-16-8-25z" opacity=".8"/>' +
      '<path class="petal p2" d="M92 50c-12 2-20 7-25 15s-5 16-4 21c8 0 16-3 21-11s8-16 8-25z" opacity=".8"/>' +
      '<rect x="30" y="92" width="60" height="4" rx="2"/></svg>'
  };

  /* ---------- projects ---------- */
  function renderProjects() {
    var grid = $("#project-grid");
    if (!grid) return;
    grid.innerHTML = PROJECTS.map(function (p, i) {
      var alt = currentLang === "en" ? p.name.si : p.name.en;
      return (
        '<article class="project-card theme-' + p.art + '" style="--i:' + i + '">' +
          '<button type="button" class="project-hit" data-project="' + p.id + '" aria-haspopup="dialog">' +
            '<div class="project-art">' + PROJECT_ART[p.art] + '</div>' +
            '<div class="project-body">' +
              '<span class="project-index">0' + (i + 1) + '</span>' +
              '<p class="project-meaning">' + p.meaning[currentLang] + '</p>' +
              '<h3 class="project-name">' + p.name[currentLang] + '</h3>' +
              '<p class="project-alt">' + alt + '</p>' +
              '<p class="project-desc">' + p.desc[currentLang] + '</p>' +
              '<span class="project-more">' + t("projects.more") +
                ' <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5l7 7-7 7-1.4-1.4 4.6-4.6H4v-2h12.2l-4.6-4.6z"/></svg></span>' +
            '</div>' +
          '</button>' +
        '</article>'
      );
    }).join("");
    tiltCards();
  }

  /* ---------- language ---------- */
  function setLang(lang, persist) {
    if (LANGS.indexOf(lang) === -1) lang = DEFAULT_LANG;
    currentLang = lang;

    document.documentElement.lang = lang;
    document.body.classList.remove("lang-si", "lang-en", "lang-ta");
    document.body.classList.add("lang-" + lang);

    $all("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    $all(".lang-switch button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
    document.title = t("orgName") + " | " + (lang === "en" ? I18N.si.orgName : I18N.en.orgName);

    renderProjects();
    renderAlbums();
    if (openProjectId) fillModal(openProjectId);
    if (avAlbum) fillAlbumView();
    if (lbList) lbShow(lbIndex);
    if (fbLoaded) loadFbPlugin();
    if (persist) storeSet(lang);
  }

  function initLang() {
    var fromUrl = new URLSearchParams(location.search).get("lang");
    var initial = (fromUrl && LANGS.indexOf(fromUrl) > -1) ? fromUrl : (storeGet() || DEFAULT_LANG);
    setLang(initial, false);
    $all(".lang-switch button").forEach(function (b) {
      b.addEventListener("click", function () {
        document.body.classList.add("lang-fade");
        setTimeout(function () {
          setLang(b.dataset.lang, true);
          document.body.classList.remove("lang-fade");
        }, reduceMotion ? 0 : 160);
      });
    });
  }

  /* ---------- header / nav ---------- */
  function initHeader() {
    var header = $(".site-header");
    var toTop = $(".to-top");
    var toggle = $(".nav-toggle");
    var nav = $("#main-nav");

    function onScroll() {
      var y = window.scrollY;
      header.classList.toggle("scrolled", y > 40);
      toTop.classList.toggle("show", y > 600);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    function closeMenu() {
      document.body.classList.remove("menu-open");
      toggle.setAttribute("aria-expanded", "false");
    }
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    $all("a", nav).forEach(function (a) { a.addEventListener("click", closeMenu); });
    window.addEventListener("resize", function () { if (window.innerWidth > 1100) closeMenu(); });

    // highlight active section
    var links = $all("a[href^='#']", nav);
    var sections = links.map(function (a) { return $(a.getAttribute("href")); }).filter(Boolean);
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            links.forEach(function (a) {
              a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id);
            });
          }
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      sections.forEach(function (s) { io.observe(s); });
    }
  }

  /* ---------- hero video ---------- */
  function initVideo() {
    var video = $(".hero-video");
    var playBtn = $("#vc-play");
    var muteBtn = $("#vc-mute");
    if (!video) return;

    if (reduceMotion) { video.removeAttribute("autoplay"); video.pause(); }

    function sync() {
      playBtn.classList.toggle("paused", video.paused);
      playBtn.setAttribute("aria-label", video.paused ? "Play video" : "Pause video");
      muteBtn.classList.toggle("unmuted", !video.muted);
      muteBtn.setAttribute("aria-label", video.muted ? "Unmute video" : "Mute video");
    }
    playBtn.addEventListener("click", function () {
      if (video.paused) { video.play(); } else { video.pause(); }
    });
    muteBtn.addEventListener("click", function () {
      video.muted = !video.muted;
      if (!video.muted && video.paused) video.play();
      sync();
    });
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    video.addEventListener("volumechange", sync);
    sync();

    // pause when hero is off-screen to save battery / CPU
    if ("IntersectionObserver" in window) {
      var userPaused = false;
      playBtn.addEventListener("click", function () { userPaused = video.paused; });
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) { video.pause(); }
          else if (!userPaused && !reduceMotion) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
        });
      }, { threshold: 0.1 }).observe($(".hero"));
    }

    // subtle parallax on hero content
    if (!reduceMotion) {
      var content = $(".hero-content");
      window.addEventListener("scroll", function () {
        var y = window.scrollY;
        if (y < window.innerHeight) {
          content.style.transform = "translateY(" + y * 0.25 + "px)";
          content.style.opacity = String(Math.max(0, 1 - y / (window.innerHeight * 0.8)));
        }
      }, { passive: true });
    }
  }

  /* ---------- scroll reveal ---------- */
  function initReveal() {
    var els = $all(".reveal");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    els.forEach(function (el) { io.observe(el); });

    // project cards animate in as a group
    var grid = $("#project-grid");
    if (grid) {
      grid.classList.add("pending");
      var gio = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { grid.classList.remove("pending"); gio.disconnect(); }
      }, { threshold: 0.1 });
      gio.observe(grid);
    }
  }

  /* ---------- card tilt (pointer devices only) ---------- */
  function tiltCards() {
    if (reduceMotion || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    $all(".project-card").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty("--rx", (-y * 6).toFixed(2) + "deg");
        card.style.setProperty("--ry", (x * 8).toFixed(2) + "deg");
        card.style.setProperty("--mx", ((x + 0.5) * 100).toFixed(1) + "%");
        card.style.setProperty("--my", ((y + 0.5) * 100).toFixed(1) + "%");
      });
      card.addEventListener("pointerleave", function () {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------- project modal ---------- */
  var modal, lastFocus, openProjectId = null;

  function fillModal(id) {
    var p = PROJECTS.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var art = $("#modal-art");
    art.className = "modal-art theme-" + p.art;
    art.innerHTML = PROJECT_ART[p.art];
    $("#modal-meaning").textContent = p.meaning[currentLang];
    $("#modal-title").textContent = p.name[currentLang];
    $("#modal-alt").textContent = currentLang === "en" ? p.name.si : p.name.en;
    $("#modal-desc").textContent = p.desc[currentLang];
  }

  function openModal(id) {
    openProjectId = id;
    fillModal(id);
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    requestAnimationFrame(function () { modal.classList.add("open"); });
    $(".modal-close", modal).focus();
  }

  function closeModal() {
    if (!openProjectId) return;
    openProjectId = null;
    modal.classList.remove("open");
    document.body.classList.remove("modal-open");
    setTimeout(function () { modal.hidden = true; }, reduceMotion ? 0 : 250);
    if (lastFocus) lastFocus.focus();
  }

  function initModal() {
    modal = $("#project-modal");
    document.addEventListener("click", function (e) {
      var hit = e.target.closest("[data-project]");
      if (hit) { openModal(hit.dataset.project); return; }
      if (e.target.closest("[data-close]")) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (!openProjectId) return;
      if (e.key === "Escape") closeModal();
      if (e.key === "Tab") { // keep focus inside the dialog
        var f = $all("a, button", modal);
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- gallery (albums synced from Facebook into data/gallery.js) ---------- */
  var GAL = ((window.FB_GALLERY || {}).albums) || [];
  var ALBUM_THEMES = ["echo", "steps", "moon", "lotus"];
  var ALBUMS_STEP = 8;
  var albumsShown = ALBUMS_STEP;
  var LOCALES = { si: "si-LK", en: "en-GB", ta: "ta-LK" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return "";
    try { return new Intl.DateTimeFormat(LOCALES[currentLang], { year: "numeric", month: "long" }).format(d); }
    catch (e) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
  }
  function albumMeta(a) {
    return [a.count + " " + t("gallery.photos"), fmtDate(a.date)].filter(Boolean).join(" · ");
  }
  function findAlbum(id) {
    for (var i = 0; i < GAL.length; i++) if (GAL[i].id === id) return GAL[i];
    return null;
  }
  function updateScrollLock() {
    document.body.classList.toggle("modal-open", !!(openProjectId || avAlbum || lbList));
  }

  function renderAlbums() {
    var grid = $("#album-grid");
    if (!grid) return;
    var empty = !GAL.length;
    $("#album-empty").hidden = !empty;
    grid.hidden = empty;
    $("#album-more").hidden = empty || albumsShown >= GAL.length;
    if (empty) return;

    grid.innerHTML = GAL.slice(0, albumsShown).map(function (a, i) {
      var cover = a.cover && a.cover.thumb;
      var theme = ALBUM_THEMES[i % ALBUM_THEMES.length];
      var media = cover
        ? '<img src="' + esc(cover) + '" alt="" loading="lazy" />'
        : '<div class="album-placeholder theme-' + theme + '">' + PROJECT_ART[theme] + "</div>";
      return (
        '<button type="button" class="album-card" data-album-id="' + esc(a.id) + '">' +
          '<div class="album-media">' + media +
            '<span class="album-count" aria-hidden="true">' +
              '<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM6 17h12l-4-5-3 4-2-2.5z"/></svg>' + a.count +
            "</span>" +
          "</div>" +
          '<div class="album-info">' +
            '<h3 class="album-title">' + esc(a.name) + "</h3>" +
            '<p class="album-meta">' + esc(albumMeta(a)) + "</p>" +
            '<span class="album-link">' + t("gallery.view") + "</span>" +
          "</div>" +
        "</button>"
      );
    }).join("");
  }

  /* album view (full-screen page listing every photo of one album) */
  var av, avAlbum = null, avLastFocus, avPushed = false;

  function fillAlbumView() {
    var a = avAlbum;
    $("#av-title").textContent = a.name;
    $("#av-meta").textContent = albumMeta(a);
    var desc = $("#av-desc");
    desc.textContent = a.description || "";
    desc.hidden = !a.description;
  }

  /* each album's photos live in data/albums/<id>.js and are loaded on first open */
  var albumWaiters = {};
  window.FB_ALBUM_LOADED = function (id, data) {
    var a = findAlbum(id);
    if (a) { a.photos = data.photos || []; a.description = data.description || ""; }
    (albumWaiters[id] || []).forEach(function (cb) { cb(!!a); });
    delete albumWaiters[id];
  };
  function loadAlbum(a, cb) {
    if (a.photos) { cb(true); return; }
    if (albumWaiters[a.id]) { albumWaiters[a.id].push(cb); return; }
    albumWaiters[a.id] = [cb];
    var s = document.createElement("script");
    s.src = "data/albums/" + encodeURIComponent(a.id) + ".js";
    s.onerror = function () {
      (albumWaiters[a.id] || []).forEach(function (f) { f(false); });
      delete albumWaiters[a.id];
      s.remove();
    };
    document.head.appendChild(s);
  }

  function renderAlbumPhotos(a) {
    $("#av-grid").innerHTML = a.photos.map(function (p, i) {
      var ratio = p.w && p.h ? (p.w / p.h).toFixed(3) : "1";
      return (
        '<button type="button" class="av-photo" data-photo="' + i + '" style="--r:' + ratio + '"' +
          ' aria-label="' + esc(p.caption || a.name) + " (" + (i + 1) + "/" + a.photos.length + ')">' +
          '<img src="' + esc(p.thumb) + '" alt="" loading="lazy" />' +
        "</button>"
      );
    }).join("");
  }

  function openAlbumView(id, push, onReady) {
    var a = findAlbum(id);
    if (!a) return false;
    var same = avAlbum && avAlbum.id === a.id;
    avAlbum = a;
    fillAlbumView();
    if (!same) {
      av.scrollTop = 0;
      $("#av-grid").innerHTML = '<div class="av-loading" role="status"><span></span></div>';
      loadAlbum(a, function (ok) {
        if (avAlbum !== a) return;            // user moved on meanwhile
        if (!ok) { $("#av-grid").innerHTML = '<p class="av-error">⚠</p>'; return; }
        fillAlbumView();
        renderAlbumPhotos(a);
        if (onReady) onReady();
      });
    } else if (onReady && a.photos) {
      onReady();
    }
    if (av.hidden) {
      avLastFocus = document.activeElement;
      av.hidden = false;
      requestAnimationFrame(function () { av.classList.add("open"); });
      $(".av-back", av).focus();
    }
    if (push) {
      history.pushState({ album: a.id }, "", "#album=" + encodeURIComponent(a.id));
      avPushed = true;
    }
    updateScrollLock();
    return true;
  }

  function closeAlbumView(fromHistory) {
    if (!avAlbum) return;
    if (lbList) lbClose();
    avAlbum = null;
    av.classList.remove("open");
    setTimeout(function () { if (!avAlbum) av.hidden = true; }, reduceMotion ? 0 : 300);
    updateScrollLock();
    if (!fromHistory) {
      if (avPushed) { avPushed = false; history.back(); }
      else history.replaceState(null, "", location.pathname + location.search + "#gallery");
    }
    if (avLastFocus && document.contains(avLastFocus)) avLastFocus.focus();
  }

  /* lightbox */
  var lb, lbList = null, lbIndex = 0, lbTitle = "", lbLastFocus;

  function lbShow(i) {
    lbIndex = (i + lbList.length) % lbList.length;
    var p = lbList[lbIndex];
    var img = $("#lb-img");
    img.classList.remove("loaded");
    img.onload = function () { img.classList.add("loaded"); };
    img.src = p.full;
    img.alt = p.caption || lbTitle;
    $("#lb-caption").textContent = p.caption || lbTitle;
    $("#lb-count").textContent = (lbIndex + 1) + " / " + lbList.length;
    if (lbList.length > 1) { var n = new Image(); n.src = lbList[(lbIndex + 1) % lbList.length].full; }
    lb.classList.toggle("single", lbList.length < 2);
  }
  function lbOpen(list, index, title) {
    lbList = list;
    lbTitle = title || "";
    lbLastFocus = document.activeElement;
    lb.hidden = false;
    requestAnimationFrame(function () { lb.classList.add("open"); });
    lbShow(index || 0);
    updateScrollLock();
    $(".lb-close", lb).focus();
  }
  function lbClose() {
    if (!lbList) return;
    lbList = null;
    lb.classList.remove("open");
    setTimeout(function () { if (!lbList) { lb.hidden = true; $("#lb-img").removeAttribute("src"); } }, reduceMotion ? 0 : 250);
    updateScrollLock();
    if (lbLastFocus && document.contains(lbLastFocus)) lbLastFocus.focus();
  }

  /* deep links: #album=<id>  or  #album=<id>&photo=<n> */
  function openFromHash() {
    var m = /^#album=([^&]+)(?:&photo=(\d+))?/.exec(location.hash);
    if (!m) return;
    openAlbumView(decodeURIComponent(m[1]), false, m[2] ? function () {
      var n = Math.max(0, Math.min(avAlbum.photos.length - 1, parseInt(m[2], 10) - 1));
      lbOpen(avAlbum.photos, n, avAlbum.name);
    } : null);
  }

  function initGallery() {
    lb = $("#lightbox");
    av = $("#album-view");
    if (!lb || !av) return;

    $("#album-more-btn").addEventListener("click", function () {
      albumsShown += ALBUMS_STEP;
      renderAlbums();
    });

    document.addEventListener("click", function (e) {
      var card = e.target.closest("[data-album-id]");
      if (card) { openAlbumView(card.dataset.albumId, true); return; }
      var photo = e.target.closest("[data-photo]");
      if (photo && avAlbum) { lbOpen(avAlbum.photos, +photo.dataset.photo, avAlbum.name); return; }
      if (e.target.closest("[data-av='close']")) { closeAlbumView(false); return; }
      var ctl = e.target.closest("[data-lb]");
      if (ctl && lbList) {
        var act = ctl.dataset.lb;
        if (act === "close") lbClose();
        else if (act === "prev") lbShow(lbIndex - 1);
        else if (act === "next") lbShow(lbIndex + 1);
        return;
      }
      if (lbList && (e.target === lb || e.target.classList.contains("lb-figure"))) lbClose();
    });

    document.addEventListener("keydown", function (e) {
      if (lbList) {
        if (e.key === "Escape") lbClose();
        else if (e.key === "ArrowLeft") lbShow(lbIndex - 1);
        else if (e.key === "ArrowRight") lbShow(lbIndex + 1);
        return;
      }
      if (avAlbum && e.key === "Escape") closeAlbumView(false);
    });

    // phone "back" button closes the album view
    window.addEventListener("popstate", function (e) {
      if (e.state && e.state.album) { avPushed = true; openAlbumView(e.state.album, false); }
      else if (avAlbum) { avPushed = false; closeAlbumView(true); }
    });

    // swipe between photos
    var x0 = null;
    lb.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (x0 === null || !lbList) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) lbShow(lbIndex + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  /* Facebook Page plugin (loaded only when the section is near the viewport) */
  var FB_LOCALES = { si: "si_LK", en: "en_US", ta: "ta_IN" };
  var fbLoaded = false;
  function loadFbPlugin() {
    var box = $("#fb-frame");
    if (!box) return;
    var w = Math.max(280, Math.min(500, Math.floor(box.clientWidth || 500)));
    var h = 620;
    var src = "https://www.facebook.com/plugins/page.php?" + [
      "href=" + encodeURIComponent("https://www.facebook.com/vikasithaapi"),
      "tabs=timeline", "width=" + w, "height=" + h,
      "small_header=false", "adapt_container_width=true", "hide_cover=false", "show_facepile=true",
      "locale=" + FB_LOCALES[currentLang]
    ].join("&");
    box.innerHTML =
      '<iframe title="Facebook — Vikasitha Api" src="' + src + '" width="' + w + '" height="' + h + '"' +
      ' style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true"' +
      ' allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" loading="lazy"></iframe>';
    fbLoaded = true;
  }
  function initFbPlugin() {
    var box = $("#fb-frame");
    if (!box) return;
    if (!("IntersectionObserver" in window)) { loadFbPlugin(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { loadFbPlugin(); io.disconnect(); }
    }, { rootMargin: "400px 0px" });
    io.observe(box);
    var lastW = window.innerWidth, timer;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (fbLoaded && Math.abs(window.innerWidth - lastW) > 80) { lastW = window.innerWidth; loadFbPlugin(); }
      }, 400);
    });
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    var y = $("#year"); if (y) y.textContent = new Date().getFullYear();
    initModal();
    initGallery();
    initLang();
    initFbPlugin();
    openFromHash();
    initHeader();
    initVideo();
    initReveal();
  });
})();
