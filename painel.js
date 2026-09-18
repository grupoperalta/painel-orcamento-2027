/* Painel do Orçamento 2027, versão publicada: decifra no navegador e navega sem servidor. */
(function () {
  "use strict";
  // O GitHub Pages não deixa mandar X-Frame-Options nem frame-ancestors:
  // a página se recusa a abrir dentro de moldura de outro site.
  if (window.top !== window.self) { document.documentElement.innerHTML = ""; return; }

  var trava = document.getElementById("trava");
  var app = document.getElementById("app");
  var form = document.getElementById("form-senha");
  var campo = document.getElementById("senha");
  var botao = document.getElementById("entrar");
  var erro = document.getElementById("erro");
  var P = null, estilo = null, atual = null, relogio = null;

  function b64(s) { var x = atob(s), u = new Uint8Array(x.length); for (var i = 0; i < x.length; i++) { u[i] = x.charCodeAt(i); } return u; }

  async function decifra(senha) {
    var E = window.ORC_ENC;
    if (!E) { throw new Error("sem-dados"); }
    var base = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveKey"]);
    var k = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(E.s), iterations: E.it, hash: "SHA-256" },
                                          base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    var claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(E.iv) }, k, b64(E.d));
    var fluxo = new Blob([claro]).stream().pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(fluxo).text());
  }

  // A MESMA chave de rota do gerador (scripts/gerar_estatico.py, função chave):
  // caminho decodificado + parâmetros não vazios em ordem, um por linha.
  function chave(href) {
    var u = new URL(href, "https://painel.invalid");
    var q = [];
    u.searchParams.forEach(function (v, k) { if (v && !(k === "empresa" && v === "CONSOLIDADO")) { q.push([k, v]); } });
    q.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0); });
    return decodeURIComponent(u.pathname) + q.map(function (p) { return "\n" + p[0] + "=" + p[1]; }).join("");
  }

  function hashDe(k) {
    var partes = k.split("\n"), caminho = partes.shift(), q = new URLSearchParams();
    partes.forEach(function (p) { var i = p.indexOf("="); q.append(p.slice(0, i), p.slice(i + 1)); });
    var s = q.toString();
    return "#" + encodeURI(caminho) + (s ? "?" + s : "");
  }

  function daHash() {
    var h = location.hash.slice(1);
    if (!h || h.charAt(0) !== "/") { return null; }
    try { return chave(h); } catch (e) { return null; }
  }

  function aviso(msg) {
    var a = document.getElementById("aviso");
    if (!a) { return; }
    a.textContent = msg; a.hidden = false;
    clearTimeout(relogio); relogio = setTimeout(function () { a.hidden = true; }, 7000);
  }

  function mostra(k, ancora, empilha) {
    var pg = P && P.paginas[k];
    if (!pg) { return false; }
    var av = document.getElementById("aviso");
    if (av) { av.hidden = true; }
    document.getElementById("conteudo").innerHTML = pg[1];
    atual = k;
    app.querySelectorAll("nav li").forEach(function (li) {
      var a = li.querySelector("a");
      li.className = (a && a.getAttribute("href") === "/aba/" + pg[0]) ? "on" : "";
    });
    if (empilha) { history.pushState({ k: k }, "", hashDe(k)); } else { history.replaceState({ k: k }, "", hashDe(k)); }
    var alvo = ancora ? document.getElementById(ancora) : null;
    if (alvo) { alvo.scrollIntoView(); } else { window.scrollTo(0, 0); }
    return true;
  }

  function vai(href) {
    var u = new URL(href, "https://painel.invalid");
    var ancora = u.hash ? decodeURIComponent(u.hash.slice(1)) : "";
    if (mostra(chave(href), ancora, true)) { return; }
    aviso(u.pathname.indexOf("/dre/linha/") === 0
      ? "Na versão publicada, a lista completa de cada linha está na DRE consolidada. Nesta visão, abra a linha pelo botão ▸."
      : "Esta visão não está na versão publicada do painel.");
  }

  function alterna(b) {
    var alvo = document.getElementById(b.getAttribute("data-alvo"));
    if (!alvo) { return; }
    var aberto = b.getAttribute("aria-expanded") === "true";
    b.setAttribute("aria-expanded", String(!aberto));
    alvo.hidden = aberto;
    b.textContent = aberto ? "▸" : "▾";
  }

  app.addEventListener("click", function (ev) {
    if (!P) { return; }
    if (ev.target.closest("[data-bloquear]")) { ev.preventDefault(); bloqueia(); return; }
    var tg = ev.target.closest(".tg");
    if (tg && tg.getAttribute("data-alvo")) { ev.preventDefault(); alterna(tg); return; }
    var a = ev.target.closest("a[href]");
    if (!a) { return; }
    var h = a.getAttribute("href");
    if (!h || h.charAt(0) !== "/") { return; }          // âncora da própria página: o navegador cuida
    ev.preventDefault();
    vai(h);
  });

  // filtros: <select data-auto>; na versão publicada vale um filtro por vez
  app.addEventListener("change", function (ev) {
    var s = ev.target.closest("select[data-auto]");
    if (!P || !s || !s.form) { return; }
    var caminho = atual.split("\n")[0], todos = new URLSearchParams();
    Array.prototype.forEach.call(s.form.elements, function (el) {
      if (el.tagName === "SELECT" && el.name && el.value) { todos.append(el.name, el.value); }
    });
    if (mostra(chave(caminho + "?" + todos.toString()), "", true)) { return; }
    var so = new URLSearchParams(); if (s.value) { so.append(s.name, s.value); }
    if (mostra(chave(caminho + "?" + so.toString()), "", true)) {
      var rot = s.labels && s.labels[0] ? s.labels[0].firstChild.textContent.trim() : s.name;
      aviso("Na versão publicada os filtros valem um de cada vez: mostrando só " + rot + ".");
      return;
    }
    aviso("Esta combinação de filtros não está na versão publicada do painel.");
  });
  app.addEventListener("submit", function (ev) { ev.preventDefault(); });

  // busca dentro de uma tabela: <input data-busca="#id-da-tabela">
  app.addEventListener("input", function (ev) {
    var inp = ev.target.closest("input[data-busca]");
    if (!inp) { return; }
    var t = document.querySelector(inp.getAttribute("data-busca"));
    if (!t) { return; }
    var q = inp.value.trim().toLowerCase();
    t.querySelectorAll("tbody tr").forEach(function (tr) {
      if (tr.classList.contains("tot")) { return; }
      tr.hidden = !!q && tr.textContent.toLowerCase().indexOf(q) === -1;
    });
  });

  window.addEventListener("popstate", function (ev) {
    if (!P) { return; }
    var k = (ev.state && ev.state.k) || daHash() || P.padrao;
    if (k !== atual && !mostra(k, "", false)) { mostra(P.padrao, "", false); }
  });

  function bloqueia() {
    P = null; atual = null;
    app.innerHTML = ""; app.hidden = true;
    if (estilo) { estilo.remove(); estilo = null; }
    trava.hidden = false; campo.value = ""; erro.textContent = ""; botao.disabled = false;
    history.replaceState(null, "", location.pathname);
    campo.focus();
  }

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    if (!window.crypto || !crypto.subtle || typeof DecompressionStream === "undefined") {
      erro.textContent = "Este navegador não decifra o painel. Atualize-o (no iPhone, iOS 16.4 ou mais novo) ou use Chrome, Edge ou Firefox atualizados.";
      return;
    }
    var senha = campo.value;
    if (!senha || botao.disabled) { return; }
    botao.disabled = true; erro.textContent = "Decifrando…";
    try {
      P = await decifra(senha);
    } catch (e) {
      P = null; botao.disabled = false; campo.value = ""; campo.focus();
      erro.textContent = (e && e.message === "sem-dados") ? "Os dados do painel não carregaram. Recarregue a página." : "Senha incorreta.";
      return;
    }
    senha = null; campo.value = "";
    estilo = document.createElement("style");
    estilo.textContent = P.css;
    document.head.appendChild(estilo);
    app.innerHTML = P.moldura;
    trava.hidden = true; app.hidden = false; erro.textContent = "";
    var k = daHash();
    if (!k || !mostra(k, "", false)) { mostra(P.padrao, "", false); }
  });
})();
