/* World Drone News Map: guest preview, sign-in, member profile, and the live map.
   Data is read from Supabase; row-level security only lets members with a profile read it.
   Guests get a small preview from the preview_data() function (supabase/preview.sql). */
(() => {
const CFG = window.DNM_CONFIG || {};
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl = u => /^https:\/\//.test(u || "") ? u : null;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const locale = () => LANG === "en" ? "en-US" : "ko-KR";
const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(locale(), {month:"short", day:"numeric"}); };
const ageH = iso => (Date.now() - new Date(iso).getTime()) / 36e5;
const num = n => Number(n || 0).toLocaleString(locale());
const kindLabel = k => KINDS[k][LANG];
const kindOf = c => KINDS[c.kind] ? c.kind : "major";
const newsTitle = n => LANG === "en" ? (n.title_en || n.title) : (n.title_ko || n.title);
const coField = (c, f) => c.kind === "portal" ? trList(c[f]) : L(c, f);
const coPlace = c => c.kind === "portal" ? `${krPlace(c.place)}, ${country("대한민국")}` : [c.place, country(c.country)].filter(Boolean).join(", ");
const placeKey = n => `${(+n.lat).toFixed(1)},${(+n.lon).toFixed(1)}`;
const redirectTo = location.origin + location.pathname;
let map = null, popup = null, authMode = "in", loadedAs = null, subscribed = false;

const state = {
  news: [], companies: [], regions: [], krTotals: null, updatedAt: null,
  range: 30, cats: new Set(Object.keys(CATS)), kinds: new Set(Object.keys(KINDS)),
  place: null, sel: null, company: null, members: null, profile: null,
  guest: false, region: null, preview: { newsTotal: 0, portalTotal: 0, off: false }
};

/* ---------- Shapes for organization types (drawn once, used on the map and in the legend) ---------- */
const SHAPES = {
  major: (c, s) => { c.rect(-s*.72, -s*.72, s*1.44, s*1.44); },
  startup: (c, s) => { c.moveTo(0, -s*.95); c.lineTo(s*.9, s*.7); c.lineTo(-s*.9, s*.7); c.closePath(); },
  sme: (c, s) => { c.moveTo(0, -s); c.lineTo(s*.8, 0); c.lineTo(0, s); c.lineTo(-s*.8, 0); c.closePath(); },
  research: (c, s) => { for (let i = 0; i < 10; i++) { const r = i % 2 ? s*.45 : s; const a = -Math.PI/2 + i*Math.PI/5; c[i ? "lineTo" : "moveTo"](Math.cos(a)*r, Math.sin(a)*r); } c.closePath(); },
  portal: (c, s) => { c.arc(0, 0, s*.7, 0, Math.PI*2); }
};
function shapeImage(kind, px) {
  const ratio = 2, size = px * ratio, cv = document.createElement("canvas");
  cv.width = cv.height = size; const c = cv.getContext("2d");
  c.translate(size/2, size/2); c.beginPath(); SHAPES[kind](c, size/2 - 2*ratio);
  c.fillStyle = css(KINDS[kind].v); c.fill(); c.lineWidth = 1.4*ratio; c.strokeStyle = "#0f1a24"; c.stroke();
  return c.getImageData(0, 0, size, size);
}
function shapeSvg(kind) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 24;
  const c = cv.getContext("2d"); c.translate(12, 12); c.beginPath(); SHAPES[kind](c, 10);
  c.fillStyle = css(KINDS[kind].v); c.fill(); c.lineWidth = 1.6; c.strokeStyle = css("--ink"); c.stroke();
  return `<img src="${cv.toDataURL()}" width="12" height="12" alt="">`;
}

/* ---------- Text ---------- */
function applyLang() {
  document.documentElement.lang = LANG; document.title = T("title");
  document.querySelectorAll("[data-t]").forEach(el => { const v = T(el.dataset.t); if (typeof v === "string") el.textContent = v; });
  $("langBtn").textContent = T("lang");
  $("aSubmit").textContent = authMode === "up" ? T("signUp") : authMode === "reset" ? T("newPass") : T("signIn");
  const role = $("fRole").value;
  $("fRole").innerHTML = `<option value=""></option>` + Object.entries(T("roles")).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  $("fRole").value = role;
  $("segRange").setAttribute("aria-label", T("range")); $("cats").setAttribute("aria-label", T("cats")); $("kinds").setAttribute("aria-label", T("kinds"));
  $("feed").setAttribute("aria-label", T("feed")); $("map").setAttribute("aria-label", T("map"));
  for (const [k, c] of Object.entries(CATS)) { const b = $("cat-" + k); if (b) b.innerHTML = `<span class="sw" style="background:var(${c.v});border-radius:50%"></span>${esc(c[LANG])}`; }
  for (const k of Object.keys(KINDS)) { const b = $("kind-" + k); if (b) b.innerHTML = `${shapeSvg(k)}${esc(kindLabel(k))}`; }
  $("legend").innerHTML = `<span><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="var(--accent)"/></svg>${esc(T("legendNews"))}</span>`
    + Object.keys(KINDS).map(k => `<span>${shapeSvg(k)}${esc(kindLabel(k))}</span>`).join("") + `<span>${esc(T("legendHint"))}</span>`;
  renderMembers(); renderGate();
  if (map) { refreshMapText(); render(); }
  if (state.news.length) statusLine();
}
$("langBtn").onclick = () => { LANG = LANG === "en" ? "ko" : "en"; try { localStorage.setItem("lang", LANG); } catch (e) {} applyLang(); };

/* ---------- Views ---------- */
// "guest" shows the map preview; sign-in then opens as a dialog over it.
function show(view) {
  const guest = view === "guest";
  state.guest = guest;
  $("app").classList.toggle("guest", guest);
  $("mapView").hidden = !(guest || view === "mapView");
  $("joinView").hidden = view !== "joinView";
  $("authView").hidden = view !== "authView";
  for (const id of ["signInBtn", "joinBtn", "gateBar", "lockNote", "authClose"]) $(id).hidden = !guest;
  $("bootMsg").hidden = true;
  $("signOutBtn").hidden = guest || view === "authView";
  $("status").hidden = $("mapView").hidden;
}
function renderGate() {
  if (!state.guest) return;
  $("gateText").textContent = state.preview.off ? T("previewSoon") : STR[LANG].gate(state.news.length, Math.max(state.preview.newsTotal, state.news.length));
}
function msg(el, text, ok) { el.textContent = text || ""; el.hidden = !text; el.classList.toggle("ok", !!ok); }

if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || !window.supabase) {
  applyLang(); $("bootMsg").textContent = T("notConfigured"); $("bootMsg").hidden = false; return;
}
const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true } });

/* ---------- Sign in / sign up ---------- */
function setMode(m) {
  authMode = m;
  $("tabIn").setAttribute("aria-selected", m === "in"); $("tabUp").setAttribute("aria-selected", m === "up");
  $("aPass").autocomplete = m === "in" ? "current-password" : "new-password";
  $("aEmail").closest("label").hidden = m === "reset";
  $("aReset").hidden = m !== "in";
  $("aSubmit").textContent = m === "up" ? T("signUp") : m === "reset" ? T("newPass") : T("signIn");
  msg($("aMsg"), "");
}
function openAuth(mode) { setMode(mode); $("authView").hidden = false; $("aEmail").focus(); }
function closeAuth() { if (state.guest) $("authView").hidden = true; }
$("signInBtn").onclick = () => openAuth("in");
$("joinBtn").onclick = $("gateBtn").onclick = $("lockNote").onclick = () => openAuth("up");
$("authClose").onclick = closeAuth;
$("authView").onclick = e => { if (e.target === $("authView")) closeAuth(); };
$("tabIn").onclick = () => setMode("in");
$("tabUp").onclick = () => setMode("up");
$("googleWrap").hidden = !CFG.googleLogin;
$("aGoogle").onclick = () => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
$("aReset").onclick = async () => {
  const email = $("aEmail").value.trim();
  if (!email) return msg($("aMsg"), T("needEmailOnly"));
  await sb.auth.resetPasswordForEmail(email, { redirectTo });
  msg($("aMsg"), T("resetSent"), true);
};
$("authForm").onsubmit = async e => {
  e.preventDefault();
  const email = $("aEmail").value.trim(), password = $("aPass").value;
  if ((authMode !== "reset" && !email) || password.length < 8) return msg($("aMsg"), T("needEmail"));
  $("aSubmit").disabled = true; msg($("aMsg"), "");
  try {
    if (authMode === "reset") {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      msg($("aMsg"), T("passSaved"), true); setMode("in"); route();
    } else if (authMode === "up") {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
      if (!data.session) msg($("aMsg"), T("checkMail"), true);
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    msg($("aMsg"), /invalid login/i.test(err.message || "") ? T("badLogin") : (err.message || T("loadFail")));
  } finally { $("aSubmit").disabled = false; }
};
$("signOutBtn").onclick = async () => { await sb.auth.signOut(); location.replace(redirectTo); };

/* ---------- Member profile ---------- */
$("joinForm").onsubmit = async e => {
  e.preventDefault();
  const v = { name: $("fName").value.trim(), org: $("fOrg").value.trim(), role: $("fRole").value,
              country: $("fCountry").value.trim() || null, purpose: $("fPurpose").value.trim() || null };
  if (!v.name || !v.org || !v.role || !$("fConsent").checked) return msg($("jMsg"), T("gNeed"));
  $("jSubmit").disabled = true; msg($("jMsg"), "");
  const { data: { user } } = await sb.auth.getUser();
  const { error } = await sb.from("profiles").insert({ id: user.id, ...v, consent: true, lang: LANG });
  $("jSubmit").disabled = false;
  if (error) return msg($("jMsg"), T("gFail"));
  route();
};

/* ---------- Routing by sign-in state ---------- */
let routing = null;
async function route() {
  if (routing) return routing;
  routing = (async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { show("guest"); startApp(); return; }
    const { data: prof, error } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (error) { show("guest"); startApp(); openAuth("in"); msg($("aMsg"), T("loadFail")); return; }
    if (!prof) { show("joinView"); return; }
    state.profile = prof;
    show("mapView");
    startApp();
  })().finally(() => { routing = null; });
  return routing;
}
sb.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") { show("authView"); setMode("reset"); return; }
  if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") setTimeout(route, 0);
});

/* ---------- Members (admins only) ---------- */
function renderMembers() {
  if (!state.members) return;
  $("membersBtn").textContent = STR[LANG].membersBtn(state.members.length);
  $("mTitle").textContent = STR[LANG].mTitle(state.members.length);
  $("mHead").innerHTML = T("mCols").map(c => `<th>${esc(c)}</th>`).join("");
  $("mBody").innerHTML = state.members.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.org)}</td><td>${esc(T("roles")[m.role] || m.role || "")}</td><td>${esc(m.country || "")}</td><td>${esc(m.purpose || "")}</td><td>${esc(m.joined_at ? new Date(m.joined_at).toLocaleDateString(locale()) : "")}</td></tr>`).join("");
}
async function loadMembers() {
  const { data } = await sb.from("profiles").select("name,org,role,country,purpose,joined_at").order("joined_at", { ascending: false });
  state.members = data || []; $("membersBtn").hidden = false; renderMembers();
}
$("membersBtn").onclick = () => { loadMembers(); $("mPanel").hidden = false; };
$("mClose").onclick = () => { $("mPanel").hidden = true; };
$("mPanel").onclick = e => { if (e.target === $("mPanel")) $("mPanel").hidden = true; };
document.addEventListener("keydown", e => { if (e.key === "Escape") { $("mPanel").hidden = true; closeAuth(); } });

/* ---------- Filters ---------- */
for (const k of Object.keys(CATS)) {
  const b = document.createElement("button"); b.className = "chip"; b.id = "cat-" + k; b.type = "button"; b.setAttribute("aria-pressed", "true");
  b.onclick = () => { if (state.guest) return openAuth("up"); state.cats.has(k) ? state.cats.delete(k) : state.cats.add(k); b.setAttribute("aria-pressed", state.cats.has(k)); render(); };
  $("cats").appendChild(b);
}
for (const k of Object.keys(KINDS)) {
  const b = document.createElement("button"); b.className = "chip"; b.id = "kind-" + k; b.type = "button"; b.setAttribute("aria-pressed", "true");
  b.onclick = () => { if (state.guest) return openAuth("up"); state.kinds.has(k) ? state.kinds.delete(k) : state.kinds.add(k); b.setAttribute("aria-pressed", state.kinds.has(k)); render(); };
  $("kinds").appendChild(b);
}
document.querySelectorAll("#segRange button").forEach(b => b.onclick = () => {
  if (state.guest) return openAuth("up");
  state.range = +b.dataset.range;
  document.querySelectorAll("#segRange button").forEach(x => x.setAttribute("aria-pressed", x === b)); render();
});
$("clearPlace").onclick = () => { state.place = null; render(); };
applyLang();

/* ---------- Map ---------- */
const REG_MIN = 3.6, PORTAL_MIN = 6.6;   // zoom where Korea switches from one bubble to regions, then to firms
const FONT = ["Noto Sans Regular"], FONT_B = ["Noto Sans Bold"];

const fallbackStyle = () => ({
  version: 8, glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: { land: { type: "geojson", data: "assets/land-50m.geojson" } },
  layers: [{ id: "background", type: "background", paint: { "background-color": css("--ocean") } },
           { id: "land", type: "fill", source: "land", paint: { "fill-color": css("--land"), "fill-antialias": false } }]
});

function themeBase() {
  const land = css("--land"), ocean = css("--ocean"), border = css("--border"), label = css("--label");
  const set = (id, p, v) => { try { map.setPaintProperty(id, p, v); } catch (e) {} };
  const hide = id => { try { map.setLayoutProperty(id, "visibility", "none"); } catch (e) {} };
  for (const l of map.getStyle().layers) {
    if (l.id.startsWith("dnm-")) continue;
    const key = (l.id + " " + (l["source-layer"] || "")).toLowerCase();
    const water = /water|ocean|river|lake|sea/.test(key);
    if (l.type === "background") set(l.id, "background-color", l.id === "background" && map.getSource("land") ? ocean : land);
    else if (l.type === "fill") {
      if (l.id === "land") set(l.id, "fill-color", land);
      else if (water) { set(l.id, "fill-color", ocean); set(l.id, "fill-opacity", 1); }
      else hide(l.id);
    } else if (l.type === "fill-extrusion" || l.type === "raster" || l.type === "hillshade") hide(l.id);
    else if (l.type === "line") {
      if (water) set(l.id, "line-color", ocean);
      else if (/boundary|admin/.test(key)) { set(l.id, "line-color", border); }
      else { set(l.id, "line-color", border); set(l.id, "line-opacity", .6); }
    } else if (l.type === "symbol") {
      if (/poi|housenum|transportation_name|road|highway|shield|aerodrome/.test(key)) { hide(l.id); continue; }
      set(l.id, "text-color", water ? css("--muted") : label);
      set(l.id, "text-halo-color", water ? ocean : land);
      set(l.id, "text-halo-width", 1);
    }
  }
  $("map").parentElement.style.background = ocean;
}

function geo(features) { return { type: "FeatureCollection", features }; }
const pt = (lon, lat, props) => ({ type: "Feature", geometry: { type: "Point", coordinates: [+lon, +lat] }, properties: props });

function filteredNews() {
  return state.news.filter(n => state.cats.has(n.category) && (state.guest || ageH(n.published) <= state.range * 24 + 12))
    .sort((a, b) => new Date(b.published) - new Date(a.published));
}
const catColorExpr = () => ["match", ["get", "cat"], ...Object.entries(CATS).flatMap(([k, c]) => [k, css(c.v)]), css("--c-biz")];

function addLayers() {
  for (const k of Object.keys(KINDS)) { if (map.hasImage("k-" + k)) map.removeImage("k-" + k); map.addImage("k-" + k, shapeImage(k, k === "research" ? 18 : k === "portal" ? 11 : 15), { pixelRatio: 2 }); }
  map.addSource("dnm-news", { type: "geojson", data: geo([]), cluster: true, clusterRadius: 36, clusterMaxZoom: 9 });
  map.addSource("dnm-cos", { type: "geojson", data: geo([]) });
  map.addSource("dnm-portal", { type: "geojson", data: geo([]), cluster: true, clusterRadius: 40, clusterMaxZoom: 11 });
  map.addSource("dnm-regions", { type: "geojson", data: geo([]) });
  // Labels use twin sources so markers still draw if the label font can't load
  map.addSource("dnm-news-t", { type: "geojson", data: geo([]), cluster: true, clusterRadius: 36, clusterMaxZoom: 9 });
  map.addSource("dnm-portal-t", { type: "geojson", data: geo([]), cluster: true, clusterRadius: 40, clusterMaxZoom: 11 });
  map.addSource("dnm-regions-t", { type: "geojson", data: geo([]) });

  // Korean businesses: one bubble at world zoom, regions in the middle, firms close up
  const regPaint = { "circle-radius": ["get", "r"], "circle-color": css("--k-portal"), "circle-opacity": .45, "circle-stroke-color": css("--k-portal"), "circle-stroke-width": 1.2 };
  const regText = { layout: { "text-field": ["concat", ["get", "n"], "\n", ["get", "label"]], "text-font": FONT_B, "text-size": 10, "text-allow-overlap": true, "text-line-height": 1.25 },
    paint: { "text-color": css("--on-land"), "text-halo-color": css("--land"), "text-halo-width": 1 } };
  const isAll = ["==", ["get", "all"], true], notAll = ["!=", ["get", "all"], true];
  map.addLayer({ id: "dnm-reg-all", type: "circle", source: "dnm-regions", maxzoom: REG_MIN, filter: isAll, paint: regPaint });
  map.addLayer({ id: "dnm-reg", type: "circle", source: "dnm-regions", minzoom: REG_MIN, maxzoom: PORTAL_MIN, filter: notAll, paint: regPaint });
  map.addLayer({ id: "dnm-reg-all-n", type: "symbol", source: "dnm-regions-t", maxzoom: REG_MIN, filter: isAll, ...regText });
  map.addLayer({ id: "dnm-reg-n", type: "symbol", source: "dnm-regions-t", minzoom: REG_MIN, maxzoom: PORTAL_MIN, filter: notAll, ...regText });
  map.addLayer({ id: "dnm-portal-c", type: "circle", source: "dnm-portal", minzoom: PORTAL_MIN, filter: ["has", "point_count"],
    paint: { "circle-radius": ["step", ["get", "point_count"], 11, 10, 14, 40, 18], "circle-color": css("--k-portal"), "circle-opacity": .55, "circle-stroke-color": css("--k-portal"), "circle-stroke-width": 1.2 } });
  map.addLayer({ id: "dnm-portal-cn", type: "symbol", source: "dnm-portal-t", minzoom: PORTAL_MIN, filter: ["has", "point_count"],
    layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FONT_B, "text-size": 10, "text-allow-overlap": true },
    paint: { "text-color": css("--on-land") } });
  map.addLayer({ id: "dnm-portal", type: "symbol", source: "dnm-portal", minzoom: PORTAL_MIN, filter: ["!", ["has", "point_count"]],
    layout: { "icon-image": "k-portal", "icon-allow-overlap": true } });
  map.addLayer({ id: "dnm-cos", type: "symbol", source: "dnm-cos",
    layout: { "icon-image": ["concat", "k-", ["get", "kind"]], "icon-allow-overlap": true, "symbol-sort-key": ["get", "order"] } });
  map.addLayer({ id: "dnm-cos-sel", type: "circle", source: "dnm-cos", filter: ["==", ["get", "id"], ""],
    paint: { "circle-radius": 11, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": css("--accent"), "circle-stroke-width": 2.5 } });
  // News on top
  map.addLayer({ id: "dnm-news-halo", type: "circle", source: "dnm-news", filter: ["all", ["!", ["has", "point_count"]], ["get", "fresh"]],
    paint: { "circle-radius": 15, "circle-color": catColorExpr(), "circle-opacity": .22 } });
  map.addLayer({ id: "dnm-news-c", type: "circle", source: "dnm-news", filter: ["has", "point_count"],
    paint: { "circle-radius": ["step", ["get", "point_count"], 12, 5, 15, 15, 19], "circle-color": css("--accent"), "circle-stroke-color": css("--panel"), "circle-stroke-width": 1.5 } });
  map.addLayer({ id: "dnm-news-cn", type: "symbol", source: "dnm-news-t", filter: ["has", "point_count"],
    layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FONT_B, "text-size": 11, "text-allow-overlap": true },
    paint: { "text-color": "#ffffff" } });
  map.addLayer({ id: "dnm-news", type: "circle", source: "dnm-news", filter: ["!", ["has", "point_count"]],
    paint: { "circle-radius": ["case", ["boolean", ["get", "sel"], false], 9, 7], "circle-color": catColorExpr(),
             "circle-stroke-color": ["case", ["boolean", ["get", "sel"], false], css("--ink"), css("--panel")], "circle-stroke-width": ["case", ["boolean", ["get", "sel"], false], 2.5, 1.5] } });
  wireEvents();
}

function refreshMapText() {
  const src = map && map.getSource("dnm-regions"); if (!src) return;
  const max = Math.max(1, ...state.regions.map(r => +r.total || 0));
  const feats = state.kinds.has("portal") ? state.regions.map(r => pt(r.lon, r.lat, { name: r.name, label: regionName(r.name), n: num(r.total), total: +r.total, make: +r.make, use: +r.use, r: 9 + 15 * Math.sqrt((+r.total || 0) / max) })) : [];
  if (feats.length && state.krTotals) feats.push(pt(131.6, 37.2, { all: true, name: "__all", label: T("korea"), n: num(state.krTotals.total), total: state.krTotals.total, make: state.krTotals.make, use: state.krTotals.use, r: 20 }));
  src.setData(geo(feats)); map.getSource("dnm-regions-t").setData(geo(feats));
}

function render() {
  const items = filteredNews();
  if (map && map.getSource("dnm-news")) {
    const nf = geo(items.map(n => pt(n.lon, n.lat, { id: n.id, cat: n.category, fresh: ageH(n.published) < 24, key: placeKey(n), sel: state.sel === n.id || state.place === placeKey(n) })));
    map.getSource("dnm-news").setData(nf); map.getSource("dnm-news-t").setData(nf);
    const cos = state.companies.filter(c => c.kind !== "portal" && state.kinds.has(kindOf(c)));
    const order = { research: 1, startup: 2, sme: 3, major: 4 };
    map.getSource("dnm-cos").setData(geo(cos.map(c => pt(c.lon, c.lat, { id: c.id, kind: kindOf(c), order: order[kindOf(c)] || 5 }))));
    map.setFilter("dnm-cos-sel", ["==", ["get", "id"], state.company || ""]);
    const portal = state.kinds.has("portal") ? state.companies.filter(c => c.kind === "portal") : [];
    const pf = geo(portal.map(c => pt(c.lon, c.lat, { id: c.id })));
    map.getSource("dnm-portal").setData(pf); map.getSource("dnm-portal-t").setData(pf);
    refreshMapText();
  }
  renderList(items);
}

function companyCard(c) {
  const u = safeUrl(c.url), portal = c.kind === "portal";
  const src = portal ? `${T("portalSrc")}${c.as_of ? " · " + STR[LANG].collected(c.as_of) : ""}` : c.source;
  const desc = portal ? c.desc : L(c, "desc");
  const rows = [[c.kind === "research" ? T("loc") : T("hq"), coPlace(c)], [T("field"), coField(c, "segment")], [T("founded"), c.founded],
    [T("products"), coField(c, "products")], [T("airframe"), trList(c.airframe)], [T("type"), portal ? trList(c.type) : L(c, "type")], [T("source"), src]].filter(r => r[1]);
  const sub = LANG === "ko" && c.name_ko && c.name_ko !== c.name ? c.name_ko : "";
  return `<div class="cocard"><div class="meta"><span>${esc(kindLabel(kindOf(c)))}</span><button id="closeCo" class="x" type="button" aria-label="${esc(T("closeAria"))}">${esc(T("close"))}</button></div>
  <h3>${esc(c.name)}${sub ? ` <span class="ko">${esc(sub)}</span>` : ""}</h3>
  ${desc ? `<p>${esc(desc)}${portal && LANG === "en" ? ` <span class="note">(${esc(T("krDesc"))})</span>` : ""}</p>` : ""}
  <dl>${rows.map(r => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join("")}</dl>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(T("website"))}</a>` : ""}</div>`;
}

// Guests see a short card with a sign-up button instead of the details.
function lockedCard(kicker, title, sub, body) {
  return `<div class="cocard"><div class="meta"><span>${esc(kicker)}</span><button id="closeCo" class="x" type="button" aria-label="${esc(T("closeAria"))}">${esc(T("close"))}</button></div>
  <h3>${esc(title)}${sub ? ` <span class="ko">${esc(sub)}</span>` : ""}</h3><p>${esc(body)}</p>
  <button class="btn small" type="button" data-join>${esc(T("joinFree"))}</button></div>`;
}
function guestCompanyCard(c) {
  const sub = LANG === "ko" && c.name_ko && c.name_ko !== c.name ? c.name_ko : "";
  return lockedCard(kindLabel(kindOf(c)), c.name, sub, `${coPlace(c)}. ${T("coLocked")}`);
}
function guestRegionCard(r) {
  return lockedCard(T("portalCard"), regionName(r.name), "", `${STR[LANG].regionTip("", num(r.total), num(r.make), num(r.use)).replace(/<br>/g, " · ").replace(/<[^>]+>/g, "").trim()}. ${T("regLocked")}`);
}
function upsell(shown) {
  const more = Math.max(0, state.preview.newsTotal - shown), kr = state.preview.portalTotal;
  return `<div class="upsell"><h3>${esc(STR[LANG].moreHead(more))}</h3><p>${esc(T("moreBody"))}${kr ? " " + esc(STR[LANG].moreBodyKr(num(kr))) : ""}</p>
  <button class="btn small" type="button" data-join>${esc(T("joinFree"))}</button></div>`;
}
function renderList(items) {
  const co = state.company && state.companies.find(c => c.id === state.company);
  const reg = state.guest && state.region && state.regions.find(r => r.name === state.region);
  const coHtml = co ? (state.guest ? guestCompanyCard(co) : companyCard(co)) : reg ? guestRegionCard(reg) : "";
  const list = state.place ? items.filter(n => placeKey(n) === state.place) : items;
  $("feedTitle").textContent = state.place ? STR[LANG].placeNews(list[0]?.place || T("selPlace")) : T("latest");
  $("clearPlace").hidden = !state.place;
  $("count").textContent = STR[LANG].count(list.length);
  $("list").innerHTML = coHtml + (list.length ? list.map(n => {
    const c = CATS[n.category] || CATS.business, u = safeUrl(n.url), t = newsTitle(n);
    return `<article class="card${state.sel === n.id ? " sel" : ""}" tabindex="0" data-id="${esc(n.id)}">
      <div class="stripe" style="background:var(${c.v})"></div>
      <div style="min-width:0">
        <div class="meta"><span>${esc(fmtDate(n.published))}</span><span>${esc([n.place, LANG === "en" ? (n.country_en || country(n.country)) : n.country].filter(Boolean).join(", "))}</span>${ageH(n.published) < 24 ? '<span class="new">NEW</span>' : ""}</div>
        <h3>${esc(t)}</h3>${n.title && t !== n.title ? `<p class="orig">${esc(n.title)}</p>` : ""}
        <div class="foot"><span class="tag" style="color:var(${c.v})">${esc(c[LANG])}</span><span>${esc(n.source)}</span>${state.guest ? `<button class="link" type="button" data-join>${esc(T("readLocked"))}</button>` : u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(T("readMore"))}</a>` : ""}</div>
      </div></article>`;
  }).join("") : state.guest ? "" : `<div class="empty">${esc(state.news.length ? T("noMatch") : T("noNews"))}</div>`)
    + (state.guest ? upsell(list.length) : "");
  if ($("closeCo")) $("closeCo").onclick = () => { state.company = null; state.region = null; render(); };
  $("list").querySelectorAll("[data-join]").forEach(b => b.onclick = e => { e.stopPropagation(); openAuth("up"); });
  $("list").querySelectorAll(".card").forEach(el => {
    const go = () => focusNews(el.dataset.id);
    el.onclick = e => { if (!e.target.closest("a,[data-join]")) go(); };
    el.onkeydown = e => { if (e.key === "Enter") go(); };
  });
}

function focusNews(id) {
  const n = state.news.find(x => x.id === id); if (!n) return;
  state.sel = id; state.place = null;
  map.flyTo({ center: [+n.lon, +n.lat], zoom: Math.max(map.getZoom(), 4), duration: 700 });
  render();
}

function tipAt(e, html) {
  if (!popup) popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: "260px" });
  popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
}
function wireEvents() {
  const hover = (layer, html) => {
    map.on("mousemove", layer, e => { map.getCanvas().style.cursor = "pointer"; const h = html(e.features[0]); if (h) tipAt(e, h); });
    map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; popup && popup.remove(); });
  };
  hover("dnm-news", f => { const n = state.news.find(x => x.id === f.properties.id); return n && `<b>${esc(n.place || "")}</b><br>${esc(newsTitle(n))}`; });
  hover("dnm-news-c", f => `<b>${esc(STR[LANG].count(f.properties.point_count))}</b>`);
  hover("dnm-cos", f => { const c = state.companies.find(x => x.id === f.properties.id); const seg = c && coField(c, "segment"); return c && `<b>${esc(c.name)}</b> <span style="color:var(--muted)">${esc(kindLabel(kindOf(c)))}</span><br>${seg ? esc(seg) + "<br>" : ""}<span style="color:var(--muted)">${esc(coPlace(c))}</span>`; });
  hover("dnm-portal", f => { const c = state.companies.find(x => x.id === f.properties.id); return c && `<b>${esc(c.name)}</b><br>${esc(coField(c, "segment") || "")}<br><span style="color:var(--muted)">${esc(coPlace(c))}</span>`; });
  hover("dnm-portal-c", f => esc(STR[LANG].clusterTip(f.properties.point_count)));
  for (const id of ["dnm-reg", "dnm-reg-all"]) hover(id, f => { const p = f.properties; return STR[LANG].regionTip(esc(p.label), esc(num(p.total)), esc(num(p.make)), esc(num(p.use))) + `<br><span style="color:var(--muted)">${esc(T("statsSrc"))}${state.krTotals?.asOf ? " · " + esc(state.krTotals.asOf) : ""}</span>`; });

  map.on("click", "dnm-news", e => { const k = e.features[0].properties.key; state.place = state.place === k ? null : k; state.sel = null; render(); });
  map.on("click", "dnm-news-c", async e => {
    const f = e.features[0], src = map.getSource("dnm-news");
    const leaves = await src.getClusterLeaves(f.properties.cluster_id, 200, 0);
    const keys = new Set(leaves.map(l => l.properties.key));
    if (keys.size === 1) { state.place = [...keys][0]; state.sel = null; render(); return; }
    const z = await src.getClusterExpansionZoom(f.properties.cluster_id);
    map.easeTo({ center: f.geometry.coordinates, zoom: z + .3 });
  });
  const openCo = e => { state.company = e.features[0].properties.id; state.region = null; state.place = null; render(); $("list").scrollTop = 0; };
  map.on("click", "dnm-cos", openCo);
  map.on("click", "dnm-portal", openCo);
  map.on("click", "dnm-portal-c", async e => {
    const f = e.features[0];
    const z = await map.getSource("dnm-portal").getClusterExpansionZoom(f.properties.cluster_id);
    map.easeTo({ center: f.geometry.coordinates, zoom: z + .3 });
  });
  for (const id of ["dnm-reg", "dnm-reg-all"]) map.on("click", id, e => {
    const p = e.features[0].properties;
    if (p.all) map.flyTo({ center: [127.8, 36.2], zoom: 5.6 });
    else if (state.guest) { state.region = p.name; state.company = null; state.place = null; render(); $("list").scrollTop = 0; }
    else map.flyTo({ center: e.features[0].geometry.coordinates, zoom: PORTAL_MIN + .9 });
  });
}

function buildMap(style) {
  map = new maplibregl.Map({ container: "map", style, center: [20, 25], zoom: Math.max(0, Math.log2($("map").clientWidth / 360)), minZoom: 0, maxZoom: 15,
    attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, cooperativeGestures: false });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.on("load", () => { themeBase(); addLayers(); render(); });
}
function initMap() {
  if (map) return;
  const want = CFG.tiles || "https://tiles.openfreemap.org/styles/positron";
  let done = false;
  const go = s => { if (done) return; done = true; buildMap(s); };
  const timer = setTimeout(() => go(fallbackStyle()), 6000);
  fetch(want).then(r => { if (!r.ok) throw 0; return r.json(); }).then(s => { clearTimeout(timer); go(s); }).catch(() => { clearTimeout(timer); go(fallbackStyle()); });
}
// Follow the system theme: recolor base map and markers
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  applyLang();
  if (!map || !map.isStyleLoaded()) return;
  themeBase();
  for (const id of map.getStyle().layers.map(l => l.id).filter(id => id.startsWith("dnm-"))) map.removeLayer(id);
  for (const id of ["dnm-news", "dnm-cos", "dnm-portal", "dnm-regions", "dnm-news-t", "dnm-portal-t", "dnm-regions-t"]) map.removeSource(id);
  addLayers(); render();
});

/* ---------- Data ---------- */
function setStatus(on, text) { $("dot").classList.toggle("on", on); $("statusText").textContent = text; }
function statusLine() {
  const t = state.updatedAt ? new Date(state.updatedAt).toLocaleString(locale(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  setStatus(true, state.guest ? STR[LANG].preview(t) : STR[LANG].live(t, state.news.length));
}
const okPoint = r => isFinite(+r.lat) && isFinite(+r.lon) && r.lat !== null && r.lon !== null;
async function fetchAll(table, cols, order) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(cols).range(from, from + 999);
    if (order) q = q.order(order, { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
async function loadData() {
  setStatus(false, T("connecting"));
  try {
    const [news, cos, regions, meta] = await Promise.all([
      sb.from("news").select("*").order("published", { ascending: false }).limit(1000).then(r => { if (r.error) throw r.error; return r.data; }),
      fetchAll("companies", "*"),
      sb.from("regions").select("*").then(r => r.data || []),
      sb.from("meta").select("key,value,updated_at").then(r => r.data || [])
    ]);
    state.news = news.filter(okPoint);
    state.companies = cos.filter(okPoint);
    state.regions = regions.filter(okPoint);
    const m = Object.fromEntries(meta.map(r => [r.key, r]));
    state.krTotals = m.kr_totals?.value || null;
    state.updatedAt = m.status?.value?.updatedAt || m.status?.updated_at || null;
    statusLine(); render();
  } catch (e) { setStatus(false, T("loadFail")); }
}
async function loadPreview() {
  setStatus(false, T("connecting"));
  const { data, error } = await sb.rpc("preview_data");
  if (!state.guest) return;
  if (error || !data) { state.preview.off = true; setStatus(false, T("previewSoon")); renderGate(); render(); return; }
  state.news = (data.news || []).filter(okPoint);
  state.companies = (data.companies || []).filter(okPoint);
  state.regions = (data.regions || []).filter(okPoint);
  state.krTotals = data.kr_totals || null;
  state.updatedAt = data.updated_at || null;
  state.preview = { newsTotal: +data.news_total || 0, portalTotal: +data.portal_total || 0, off: false };
  statusLine(); renderGate(); render();
}
function subscribe() {
  sb.channel("news-live").on("postgres_changes", { event: "*", schema: "public", table: "news" }, p => {
    if (p.eventType === "DELETE") state.news = state.news.filter(n => n.id !== p.old.id);
    else if (okPoint(p.new)) { state.news = state.news.filter(n => n.id !== p.new.id); state.news.push(p.new); state.updatedAt = new Date().toISOString(); }
    statusLine(); render();
  }).subscribe();
  // Fallback refresh in case the live connection drops
  setInterval(() => { if (!document.hidden) loadData(); }, 15 * 60 * 1000);
}
function startApp() {
  const as = state.guest ? "guest" : "member";
  if (loadedAs === as) return;
  loadedAs = as;
  if (map) map.resize(); else initMap();
  if (state.guest) { loadPreview(); return; }
  state.region = null; state.company = null;
  loadData();
  if (!subscribed) { subscribed = true; subscribe(); }
  if (state.profile?.is_admin) loadMembers();
}

route();
})();
