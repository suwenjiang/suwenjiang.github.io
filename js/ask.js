// ask this notebook — scripted intro + real client-side search over search.json
(function () {
  var root = document.getElementById("askChat");
  if (!root) return;
  var body = document.getElementById("askBody");
  var chipsBox = document.getElementById("askChips");
  var form = document.getElementById("askForm");
  var input = document.getElementById("askInput");
  var indexUrl = root.getAttribute("data-index");
  var POSTS = [];
  var VIEWS = null;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // first chip is fixed; the rest are generated from the notebook's real top tags
  var CHIPS = ["What's in here?", "ArcGIS", "python", "docker"];
  function buildChips() {
    var tags = topTags(4);
    CHIPS = ["What's in here?"];
    if (VIEWS && VIEWS.total > 0) CHIPS.push("most read");
    CHIPS = CHIPS.concat(tags.length ? tags : ["ArcGIS", "python", "docker"]);
  }

  function esc(s) { return (s || "").replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]); }); }
  function scroll() { body.scrollTop = body.scrollHeight; }

  function addMsg(role, html) {
    var m = document.createElement("div");
    m.className = "msg " + role;
    m.innerHTML = '<div class="msg-av">' + (role === "user" ? "you" : "AI") + '</div><div class="msg-bubble">' + html + "</div>";
    body.appendChild(m); scroll();
    return m;
  }
  function renderChips() {
    chipsBox.innerHTML = "";
    CHIPS.forEach(function (q) {
      var c = document.createElement("button");
      c.type = "button"; c.className = "chip-q"; c.textContent = q;
      c.addEventListener("click", function () { handle(q); });
      chipsBox.appendChild(c);
    });
  }
  function botReply(html, delay) {
    var t = addMsg("bot", '<div class="typing"><i></i><i></i><i></i></div>');
    setTimeout(function () { t.querySelector(".msg-bubble").innerHTML = html; scroll(); renderChips(); }, reduce ? 0 : (delay || 600));
  }

  function topTags(n) {
    var counts = {};
    POSTS.forEach(function (p) { (p.tags || []).forEach(function (t) { var name = t.name || t; counts[name] = (counts[name] || 0) + 1; }); });
    return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, n);
  }

  function search(q) {
    var t = q.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5 ]/g, " ").trim();
    var terms = t.split(/\s+/).filter(function (w) { return w.length > 1; });
    if (!terms.length) return [];
    var scored = POSTS.map(function (p) {
      var title = (p.title || "").toLowerCase();
      var tags = (p.tags || []).map(function (x) { return (x.name || x); }).join(" ").toLowerCase();
      var content = (p.content || "").toLowerCase();
      var s = 0;
      terms.forEach(function (w) {
        if (title.indexOf(w) >= 0) s += 6;
        if (tags.indexOf(w) >= 0) s += 4;
        if (content.indexOf(w) >= 0) s += 1;
      });
      return { p: p, s: s };
    }).filter(function (x) { return x.s > 0; });
    scored.sort(function (a, b) { return b.s - a.s || new Date(b.p.date) - new Date(a.p.date); });
    return scored.slice(0, 6).map(function (x) { return x.p; });
  }

  function resultsHtml(q, list) {
    if (!list.length) return "No posts matched <strong>" + esc(q) + "</strong>. Try: " + topTags(4).map(function (t) { return "<em>" + esc(t) + "</em>"; }).join(", ") + ".";
    var items = list.map(function (p) {
      var d = p.date ? (" <span class='r-date'>" + new Date(p.date).toISOString().slice(0, 10) + "</span>") : "";
      return "<li><a href='" + p.url + "'>" + esc(p.title || p.url) + "</a>" + d + "</li>";
    }).join("");
    return list.length + " post" + (list.length > 1 ? "s" : "") + " on <strong>" + esc(q) + "</strong>:<ul class='r-list'>" + items + "</ul>";
  }

  function mostReadHtml() {
    if (!VIEWS || !VIEWS.hot || !VIEWS.hot.length || !VIEWS.total) return "No read stats yet — the counter just started collecting. Check back soon.";
    var titleByUrl = {}; POSTS.forEach(function (p) { titleByUrl[p.url] = p.title || p.url; });
    var items = VIEWS.hot.slice(0, 6).filter(function (h) { return titleByUrl[h.url]; }).map(function (h) {
      return "<li><a href='" + h.url + "'>" + esc(titleByUrl[h.url]) + "</a> <span class='r-date'>" + h.views + " views</span></li>";
    }).join("");
    return "Most read right now:<ul class='r-list'>" + items + "</ul>";
  }

  function handle(q) {
    addMsg("user", esc(q));
    chipsBox.innerHTML = "";
    var low = q.toLowerCase();
    if (/most read|hottest|popular|most viewed|最热|热门|最多/.test(low)) {
      botReply(mostReadHtml());
      return;
    }
    if (/what.?s? in|about this|overview|topics|有哪些|内容/.test(low)) {
      botReply("This notebook has <strong>" + POSTS.length + " posts</strong> \u2014 mostly GIS tooling, ArcGIS, cloud (AWS/Azure), Python, docker and the odd Linux fix. Top tags: " + topTags(6).map(function (t) { return "<em>" + esc(t) + "</em>"; }).join(", ") + ". Type a keyword to dig in.");
      return;
    }
    botReply(resultsHtml(q, search(q)));
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = (input.value || "").trim();
    if (!v) return;
    input.value = "";
    handle(v);
  });

  fetch("/views.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (v) { VIEWS = v; }).catch(function () {}).finally(function () {
  fetch(indexUrl).then(function (r) { return r.json(); }).then(function (data) {
    POSTS = data || [];
    buildChips(); // suggestions follow whatever tech is actually in the notebook
    botReply("Hi \u2014 I'm this notebook's assistant. Ask what's here, or search by keyword. \ud83d\udc47", reduce ? 0 : 350);
  }).catch(function () {
    botReply("Hi \u2014 search index didn't load, but you can browse the posts below.", 0);
  });
  });
})();
