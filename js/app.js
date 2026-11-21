import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';
import { APP_VERSION } from './version.js';
import { I18N, LANGS, LANG_NAMES, LANG_SHORT, LOCALES } from './i18n.js';
import { CITIES } from './cities.js';

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

/* ---------- storage helpers (try/catch: private mode) ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
};

function detectLang() {
  const saved = store.get('lang');
  if (LANGS.includes(saved)) return saved;
  const nav = (navigator.language || '').slice(0, 2).toLowerCase();
  if (LANGS.includes(nav)) return nav;
  return LANGS.includes(CONFIG.DEFAULT_LANG) ? CONFIG.DEFAULT_LANG : 'kk';
}

const $app = document.getElementById('app');
const state = { user: null, profile: null, priv: null, lang: detectLang(), channel: null, ai: { pet: null, msgs: [] } };

/* ---------- icons (inline SVG, stroke) ---------- */
const PAW = '<g fill="currentColor" stroke="none"><ellipse cx="14" cy="20" rx="3.6" ry="4.6"/><ellipse cx="22" cy="13.5" rx="3.6" ry="4.8"/><ellipse cx="30" cy="13.5" rx="3.6" ry="4.8"/><ellipse cx="38" cy="20" rx="3.6" ry="4.6"/><path d="M24 22c-6 0-11 5-11 9.5 0 3 2.6 4.5 5.5 4.5 2 0 3.6-.9 5.5-.9s3.5.9 5.5.9c2.9 0 5.5-1.5 5.5-4.5C35 27 30 22 24 22z"/></g>';
const ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  steth: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M5 3h2M13 3h2"/><path d="M10 13v2a5 5 0 0 0 10 0v-1.5"/><circle cx="20" cy="12" r="2"/>',
  aid: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M12 9v5M9.5 11.5h5"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  camera: '<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  pin: '<path d="M12 21s-6-5.500-6-10a6 6 0 0 1 12 0c0 4.500-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
  send: '<path d="M4 12l16-8-6 16-3-7z"/>',
  logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  paw: PAW
};
const ic = (n, s = 22) => `<svg class="ic" width="${s}" height="${s}" viewBox="${n === 'paw' ? '0 0 48 48' : '0 0 24 24'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const heroArt = `<svg viewBox="0 0 200 200" aria-hidden="true"><g fill="currentColor">
  <g transform="translate(18 34) rotate(-14) scale(2.5)" opacity=".16">${PAW}</g>
  <g transform="translate(86 6) rotate(12) scale(1.9)" opacity=".28">${PAW}</g>
  <g transform="translate(70 100) rotate(-6) scale(2.7)" opacity=".5">${PAW}</g></g></svg>`;

/* ---------- helpers ---------- */
const t = (k) => (I18N[state.lang][k] ?? I18N.en[k] ?? k);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (s) => {
  let out = '', inList = false;
  for (const raw of esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split('\n')) {
    const m = raw.match(/^\s*([-*•]|\d+\.)\s+(.*)$/);
    if (m) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${m[2]}</li>`; }
    else { if (inList) { out += '</ul>'; inList = false; } if (raw.trim()) out += `<p>${raw}</p>`; }
  }
  return out + (inList ? '</ul>' : '');
};
let toastTimer;
const toast = (msg) => {
  const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
};
const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
const initials = (n) => (n || '?').trim().charAt(0).toUpperCase();
const fmtTime = (d) => new Date(d).toLocaleTimeString(LOCALES[state.lang], { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d) => new Date(d).toLocaleDateString(LOCALES[state.lang]);
const phoneDigits = (s) => String(s || '').replace(/\D/g, '');
const tgUser = (s) => String(s || '').replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
function cleanup() { if (state.channel) { sb.removeChannel(state.channel); state.channel = null; } }
function requireLogin() { if (!state.user) { location.hash = '#/login'; toast(t('login_needed')); return false; } return true; }
const needsRegistration = () => !!state.user && !state.priv?.onboarded;

async function compressImage(file, max = 1280, quality = 0.82) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', quality));
}
async function squareImage(file, size = 512, quality = 0.85) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas'); c.width = c.height = size;
  c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', quality));
}

/* ---------- phone / telegram validation ---------- */
function normPhone(s) {
  let d = phoneDigits(s);
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  else if (d.length === 10) d = '7' + d;
  return d.length >= 11 && d.length <= 15 ? '+' + d : null;
}
function normTelegram(s) {
  const v = String(s || '').trim().replace(/^https?:\/\/(t|telegram)\.me\//i, '').replace(/^@/, '');
  if (!v) return { ok: true, value: null };
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v) ? { ok: true, value: v } : { ok: false };
}
const cityName = (id) => { const c = CITIES.find((x) => x.id === id); return c ? c[state.lang] : ''; };

/* ---------- theme ---------- */
const themeBtn = document.getElementById('themeBtn');
const curTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
function applyTheme(th) {
  document.documentElement.dataset.theme = th;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = th === 'dark' ? '#121915' : '#2f5d4a';
  themeBtn.innerHTML = ic(th === 'dark' ? 'sun' : 'moon', 18);
}
function setTheme(th) { store.set('theme', th); applyTheme(th); }
themeBtn.onclick = () => {
  setTheme(curTheme() === 'dark' ? 'light' : 'dark');
  if ((location.hash.split('/')[1] || '') === 'settings') route();
};
applyTheme(curTheme());

/* ---------- language ---------- */
async function setLang(l) {
  if (!LANGS.includes(l)) return;
  state.lang = l; store.set('lang', l);
  if (state.user && state.priv) await sb.from('profile_private').update({ lang: l }).eq('id', state.user.id);
  route();
}
const langBtn = document.getElementById('langBtn');
const langPop = document.getElementById('langPop');
langBtn.onclick = (e) => {
  e.stopPropagation();
  langPop.innerHTML = LANGS.map((l) => `<button data-l="${l}" class="${l === state.lang ? 'on' : ''}">${LANG_NAMES[l]}${l === state.lang ? '<span>✓</span>' : ''}</button>`).join('');
  langPop.classList.toggle('hidden');
  langPop.querySelectorAll('button').forEach((b) => b.onclick = () => { langPop.classList.add('hidden'); setLang(b.dataset.l); });
};
document.addEventListener('click', () => langPop.classList.add('hidden'));

/* ---------- layout ---------- */
function renderChrome() {
  const items = [['#/', 'home', 'nav_home'], ['#/vets', 'steth', 'nav_vets'], ['#/ai', 'aid', 'nav_ai'], ['#/chats', 'chat', 'nav_chats'], ['#/settings', 'sliders', 'nav_settings']];
  const cur = location.hash.split('/')[1] || '';
  const key = { about: 'settings', register: 'settings', login: 'settings' }[cur] || cur;
  const active = (h) => ('#/' + key) === h || (h === '#/' && key === '');
  document.getElementById('navDesktop').innerHTML = items.map(([h, , k]) => `<a href="${h}" class="${active(h) ? 'active' : ''}">${t(k)}</a>`).join('');
  document.getElementById('navMobile').innerHTML = items.map(([h, i, k]) => `<a href="${h}" class="${active(h) ? 'active' : ''}">${ic(i, 22)}<span class="l">${t(k)}</span></a>`).join('');
  langBtn.textContent = LANG_SHORT[state.lang];
  document.documentElement.lang = state.lang;
  const box = document.getElementById('userBox');
  if (!state.user) { box.innerHTML = `<a class="btn" href="#/login">${t('login_short')}</a>`; return; }
  const name = state.profile?.full_name || state.user.email;
  const av = state.profile?.avatar_url;
  box.innerHTML = `<a href="#/settings" aria-label="${esc(t('settings_title'))}">${av ? `<img class="avatar" src="${esc(av)}" referrerpolicy="no-referrer" alt="">` : `<span class="avatar">${esc(initials(name))}</span>`}</a>`;
}

/* ---------- router ---------- */
const OPEN_PAGES = ['register', 'settings', 'about', 'login'];
async function route() {
  cleanup(); renderChrome(); window.scrollTo(0, 0);
  const [, p1 = '', p2] = (location.hash.slice(1) || '/').split('/');
  if (needsRegistration() && !OPEN_PAGES.includes(p1)) { location.hash = '#/register'; return; }
  $app.innerHTML = `<div class="loader"><span class="spin"></span></div>`;
  try {
    if (p1 === '') pageHome();
    else if (p1 === 'login') pageLogin();
    else if (p1 === 'register') pageRegister();
    else if (p1 === 'settings') pageSettings();
    else if (p1 === 'about') pageAbout();
    else if (p1 === 'vets') await pageVets();
    else if (p1 === 'vet' && p2) await pageVet(p2);
    else if (p1 === 'ai') pageAI();
    else if (p1 === 'chats') await pageChats();
    else if (p1 === 'chat' && p2) await pageChat(p2);
    else pageHome();
  } catch (e) { console.error(e); $app.innerHTML = `<div class="card">${t('error')}<br><small class="muted">${esc(e.message || e)}</small></div>`; }
}
window.addEventListener('hashchange', route);

/* ---------- pages ---------- */
const linkRow = (href, icon, title, desc) =>
  `<a class="list-item" href="${href}"><span class="ibox">${ic(icon, 22)}</span><span class="t"><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</span><span class="chev">${ic('chev', 18)}</span></a>`;

function pageHome() {
  $app.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">${t('eyebrow')}</p>
        <h1>${t('home_title')}</h1>
        <p class="lead">${t('home_sub')}</p>
        <div class="row">
          <a class="btn clay" href="#/ai">${ic('aid', 20)} ${t('nav_ai')}</a>
          <a class="btn line" href="#/vets">${t('nav_vets')}</a>
        </div>
      </div>
      <div class="hero-art">${heroArt}</div>
    </section>
    <section class="rows">
      ${linkRow('#/ai', 'aid', t('nav_ai'), t('tile_ai_d'))}
      ${linkRow('#/vets', 'steth', t('nav_vets'), t('tile_vets_d'))}
      ${linkRow('#/chats', 'chat', t('nav_chats'), t('tile_chats_d'))}
    </section>
    <section class="empty">
      <div class="big">${ic('paw', 44)}</div>
      <h2>${t('home_empty_title')}</h2>
      <p class="muted" style="margin:0">${t('home_empty_text')}</p>
    </section>`;
}

function pageLogin() {
  if (state.user) { location.hash = needsRegistration() ? '#/register' : '#/'; return; }
  $app.innerHTML = `
    <div class="card" style="max-width:440px;margin:30px auto;text-align:center">
      <div style="color:var(--forest);display:flex;justify-content:center;margin-bottom:8px">${ic('paw', 44)}</div>
      <h2>${t('login_title')}</h2>
      <p class="muted">${t('login_text')}</p>
      <button class="btn google" id="gBtn">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
        ${t('login')}
      </button>
    </div>`;
  document.getElementById('gBtn').onclick = () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
}

/* ----- registration / profile edit ----- */
function pageRegister() {
  if (!requireLogin()) return;
  const edit = !!state.priv?.onboarded;
  const p = state.priv || {};
  const lc = LOCALES[state.lang];
  const cities = [...CITIES].sort((a, b) => (a.id === 'other') - (b.id === 'other') || a[state.lang].localeCompare(b[state.lang], lc));
  $app.innerHTML = `
    ${edit ? `<a class="back" href="#/settings">${t('back')}</a>` : ''}
    <form class="card" id="regForm" style="max-width:520px;margin:0 auto" novalidate>
      <h2>${edit ? t('edit_title') : t('register_title')}</h2>
      ${edit ? '' : `<p class="muted" style="margin-top:0">${t('register_sub')}</p>`}

      <label for="rName">${t('full_name')}</label>
      <input id="rName" autocomplete="name" maxlength="80" value="${esc(state.profile?.full_name || '')}">
      <div class="err" id="eName"></div>

      <label for="rPhone">${t('phone')}</label>
      <input id="rPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 7XX XXX XX XX" maxlength="20" value="${esc(p.phone || '+7 ')}">
      <div class="err" id="ePhone"></div>

      <label for="rCity">${t('city')}</label>
      <select id="rCity"><option value="">${t('choose_city')}</option>${cities.map((c) => `<option value="${c.id}" ${p.city === c.id ? 'selected' : ''}>${esc(c[state.lang])}</option>`).join('')}</select>
      <div class="err" id="eCity"></div>

      <label for="rTg">${t('telegram')}</label>
      <input id="rTg" placeholder="@username" autocapitalize="off" autocomplete="off" maxlength="64" value="${esc(p.telegram ? '@' + p.telegram : '')}">
      <div class="err" id="eTg"></div>

      <p class="hint">${t('privacy_note')}</p>
      <button class="btn block" id="regBtn" style="margin-top:14px">${edit ? t('save') : t('continue')}</button>
    </form>`;

  const $ = (id) => document.getElementById(id);
  const setErr = (inputId, errId, msg) => { $(errId).textContent = msg || ''; $(inputId).classList.toggle('invalid', !!msg); };
  $('regForm').onsubmit = async (e) => {
    e.preventDefault();
    const name = $('rName').value.trim(); const phone = normPhone($('rPhone').value);
    const city = $('rCity').value; const tg = normTelegram($('rTg').value);
    setErr('rName', 'eName', name ? '' : t('name_required'));
    setErr('rPhone', 'ePhone', phone ? '' : t('phone_invalid'));
    setErr('rCity', 'eCity', city ? '' : t('city_required'));
    setErr('rTg', 'eTg', tg.ok ? '' : t('telegram_invalid'));
    if (!name || !phone || !city || !tg.ok) return;
    const btn = $('regBtn'); btn.disabled = true;
    const [a, b] = await Promise.all([
      sb.from('profile_private').upsert({ id: state.user.id, phone, city, telegram: tg.value, lang: state.lang, onboarded: true, updated_at: new Date().toISOString() }),
      sb.from('profiles').update({ full_name: name }).eq('id', state.user.id)
    ]);
    if (a.error || b.error) { console.error(a.error || b.error); btn.disabled = false; return toast(t('error')); }
    await loadProfile(); toast(t('saved'));
    if (location.hash !== (edit ? '#/settings' : '#/')) location.hash = edit ? '#/settings' : '#/'; else route();
  };
}

/* ----- settings ----- */
function pageSettings() {
  const u = state.user;
  const name = state.profile?.full_name || u?.email || '';
  const av = state.profile?.avatar_url;
  const profileHtml = u ? `
    <div class="card profile-card">
      <div class="avatar-wrap">
        ${av ? `<img class="avatar-lg" id="avImg" src="${esc(av)}" referrerpolicy="no-referrer" alt="">` : `<div class="avatar-lg" id="avImg">${esc(initials(name))}</div>`}
        <label class="avatar-badge" title="${esc(t('change_photo'))}">${ic('camera', 16)}<input type="file" id="avFile" accept="image/*" hidden></label>
      </div>
      <div style="flex:1;min-width:180px">
        <h2 style="margin:0 0 2px">${esc(name)}</h2>
        <div class="muted" style="word-break:break-all">${esc(u.email || '')}</div>
        ${state.priv?.city ? `<div class="muted row" style="gap:5px;margin-top:2px">${ic('pin', 15)} ${esc(cityName(state.priv.city))}</div>` : ''}
        <button class="btn ghost" id="editProfile" style="margin-top:12px;padding:8px 14px">${ic('pencil', 16)} ${t('edit_profile')}</button>
      </div>
    </div>` : `
    <div class="card" style="text-align:center">
      <p class="muted" style="margin-top:0">${t('login_for_profile')}</p>
      <a class="btn" href="#/login">${t('login')}</a>
    </div>`;

  $app.innerHTML = `
    <h1>${t('settings_title')}</h1>
    ${profileHtml}
    <div class="card">
      <h3 style="margin-bottom:0">${t('theme')}</h3>
      <div class="seg" id="themeSeg">
        <button data-th="light" class="${curTheme() === 'light' ? 'on' : ''}">${t('theme_light')}</button>
        <button data-th="dark" class="${curTheme() === 'dark' ? 'on' : ''}">${t('theme_dark')}</button>
      </div>
    </div>
    <div class="card">
      <h3 style="margin-bottom:0">${t('language')}</h3>
      <div class="seg" id="langSeg">${LANGS.map((l) => `<button data-l="${l}" class="${l === state.lang ? 'on' : ''}">${LANG_NAMES[l]}</button>`).join('')}</div>
    </div>
    ${linkRow('#/about', 'info', t('about_btn'))}
    ${u ? `<button class="btn danger block" id="logoutBtn" style="margin-top:6px">${ic('logout', 18)} ${t('logout')}</button>` : ''}
    <p class="version">JanDos · ${t('version')} ${esc(APP_VERSION)}</p>`;

  document.querySelectorAll('#themeSeg button').forEach((b) => b.onclick = () => {
    setTheme(b.dataset.th);
    document.querySelectorAll('#themeSeg button').forEach((x) => x.classList.toggle('on', x === b));
  });
  document.querySelectorAll('#langSeg button').forEach((b) => b.onclick = () => setLang(b.dataset.l));
  const out = document.getElementById('logoutBtn');
  if (out) out.onclick = async () => { await sb.auth.signOut(); location.hash = '#/'; };
  const ep = document.getElementById('editProfile');
  if (ep) ep.onclick = () => { location.hash = '#/register'; };
  const file = document.getElementById('avFile');
  if (file) file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    try {
      const blob = await squareImage(f);
      const path = `${state.user.id}/avatar.jpg`;
      const up = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw up.error;
      const url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
      const upd = await sb.from('profiles').update({ avatar_url: url }).eq('id', state.user.id);
      if (upd.error) throw upd.error;
      await loadProfile(); toast(t('photo_saved')); route();
    } catch (e) { console.error(e); toast(t('error')); }
  };
}

/* ----- about ----- */
function pageAbout() {
  $app.innerHTML = `
    <a class="back" href="#/settings">${t('back')}</a>
    <div class="card about" style="max-width:640px;margin:0 auto">
      <div style="color:var(--forest);margin-bottom:8px">${ic('paw', 40)}</div>
      <h1>${t('about_title')}</h1>
      <p>${t('about_p1')}</p>
      <p>${t('about_p2')}</p>
      <p class="muted">${t('about_p3')}</p>
      <p class="version" style="margin-bottom:0;text-align:left">JanDos · ${t('version')} ${esc(APP_VERSION)}</p>
    </div>`;
}

/* ----- vets ----- */
async function loadVets() {
  const [{ data: vets, error }, { data: rat }] = await Promise.all([
    sb.from('vets').select('*').eq('is_published', true).order('full_name'),
    sb.from('vet_ratings').select('*')
  ]);
  if (error) throw error;
  const map = Object.fromEntries((rat || []).map((r) => [r.vet_id, r]));
  return (vets || []).map((v) => ({ ...v, rating: map[v.id] }));
}

async function pageVets() {
  const vets = await loadVets();
  $app.innerHTML = `
    <h1>${t('vets_title')}</h1>
    <input id="q" type="search" placeholder="${esc(t('search'))}">
    <div id="vetList" class="cards" style="margin-top:16px"></div>`;
  const draw = () => {
    const q = document.getElementById('q').value.toLowerCase().trim();
    const list = vets.filter((v) => !q || [v.full_name, v.city, v.specialization, v.clinic].join(' ').toLowerCase().includes(q));
    document.getElementById('vetList').innerHTML = list.length ? list.map(vetCard).join('') :
      `<div class="empty" style="grid-column:1/-1;width:100%"><div class="big">${ic('paw', 40)}</div><p class="muted" style="margin:0">${t('vets_empty')}</p></div>`;
  };
  document.getElementById('q').oninput = draw; draw();
}

function vetCard(v) {
  const r = v.rating;
  return `<a class="card vet-card" href="#/vet/${v.id}">
    <div class="row" style="flex-wrap:nowrap">
      ${v.photo_url ? `<img class="photo" src="${esc(v.photo_url)}" alt="">` : `<div class="photo">${ic('steth', 28)}</div>`}
      <div><h3 style="margin:0">${esc(v.full_name)}</h3><div class="muted">${esc(v.city || '')}</div></div>
    </div>
    <div>${esc(v.specialization || '')}</div>
    <div class="row"><span class="stars">${r ? stars(r.avg_rating) : ''}</span><span class="muted">${r ? `${Number(r.avg_rating).toFixed(1)} (${r.reviews_count})` : t('no_rating')}</span></div>
    ${v.experience_years ? `<div class="muted">${t('experience')}: ${v.experience_years}</div>` : ''}
  </a>`;
}

async function pageVet(id) {
  const [{ data: v, error }, { data: revs }] = await Promise.all([
    sb.from('vets').select('*').eq('id', id).single(),
    sb.from('reviews').select('id,rating,comment,created_at,author_id,profiles(full_name,avatar_url)').eq('vet_id', id).order('created_at', { ascending: false })
  ]);
  if (error || !v) throw error || new Error('Not found');
  const reviews = revs || [];
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  const wa = phoneDigits(v.whatsapp), tg = tgUser(v.telegram);
  const mine = state.user && reviews.find((r) => r.author_id === state.user.id);
  const isSelf = state.user && v.user_id === state.user.id;

  $app.innerHTML = `
    <a class="back" href="#/vets">${t('back')}</a>
    <div class="card">
      <div class="vet-head">
        ${v.photo_url ? `<img style="width:96px;height:96px;border-radius:50%;object-fit:cover" src="${esc(v.photo_url)}" alt="">` : `<div style="width:96px;height:96px;border-radius:50%;background:var(--sage-2);display:grid;place-items:center;color:var(--accent)">${ic('steth', 40)}</div>`}
        <div>
          <h1 style="margin:0 0 4px">${esc(v.full_name)}</h1>
          <div class="muted">${esc(v.city || '')}${v.clinic ? ' · ' + esc(v.clinic) : ''}</div>
          <div class="row"><span class="stars">${reviews.length ? stars(avg) : ''}</span><span class="muted">${reviews.length ? avg.toFixed(1) + ' (' + reviews.length + ')' : t('no_rating')}</span></div>
        </div>
      </div>
      <div style="margin-top:10px">
        ${v.specialization ? `<span class="tag">${esc(v.specialization)}</span>` : ''}
        ${(v.animals || []).map((a) => `<span class="tag">${esc(a)}</span>`).join('')}
        ${v.experience_years ? `<span class="tag">${t('experience')}: ${v.experience_years}</span>` : ''}
      </div>
      ${v.bio ? `<h3 style="margin-top:16px">${t('about')}</h3><p>${esc(v.bio)}</p>` : ''}
      <h3>${t('contacts')}</h3>
      <div class="contact-row">
        ${wa ? `<a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${wa}">WhatsApp</a>` : ''}
        ${tg ? `<a class="btn tg" target="_blank" rel="noopener" href="https://t.me/${esc(tg)}">Telegram</a>` : ''}
        ${!isSelf && v.user_id ? `<button class="btn clay" id="msgBtn">${ic('chat', 18)} ${t('write_msg')}</button>` : ''}
      </div>
    </div>

    <div class="card">
      <h2>${t('reviews_title')}</h2>
      <div id="revList">${reviews.length ? reviews.map((r) => `
        <div class="review">
          <div class="row"><b>${esc(r.profiles?.full_name || '—')}</b><span class="stars">${stars(r.rating)}</span><span class="muted" style="font-size:.8rem">${fmtDate(r.created_at)}</span>
          ${state.user && r.author_id === state.user.id ? `<button class="chip" data-del="${r.id}">${t('delete')}</button>` : ''}</div>
          ${r.comment ? `<p style="margin:6px 0 0">${esc(r.comment)}</p>` : ''}
        </div>`).join('') : `<p class="muted">${t('no_reviews')}</p>`}</div>
      ${!isSelf && !mine ? `
      <h3 style="margin-top:18px">${t('leave_review')}</h3>
      <label>${t('your_rating')}</label>
      <div class="star-pick" id="starPick">${[1, 2, 3, 4, 5].map((n) => `<span data-n="${n}">★</span>`).join('')}</div>
      <label>${t('your_comment')}</label>
      <textarea id="revText" maxlength="1000"></textarea>
      <button class="btn" id="revBtn" style="margin-top:12px">${t('send')}</button>` : ''}
    </div>`;

  const msgBtn = document.getElementById('msgBtn');
  if (msgBtn) msgBtn.onclick = async () => {
    if (!requireLogin()) return;
    let { data: c } = await sb.from('conversations').select('id').eq('vet_id', v.id).eq('owner_id', state.user.id).maybeSingle();
    if (!c) {
      const ins = await sb.from('conversations').insert({ vet_id: v.id, owner_id: state.user.id }).select('id').single();
      if (ins.error) return toast(t('error'));
      c = ins.data;
    }
    location.hash = '#/chat/' + c.id;
  };

  let rating = 0;
  const pick = document.getElementById('starPick');
  if (pick) pick.querySelectorAll('span').forEach((s) => s.onclick = () => {
    rating = +s.dataset.n; pick.querySelectorAll('span').forEach((x) => x.classList.toggle('on', +x.dataset.n <= rating));
  });
  const revBtn = document.getElementById('revBtn');
  if (revBtn) revBtn.onclick = async () => {
    if (!requireLogin()) return;
    if (!rating) return toast(t('your_rating'));
    revBtn.disabled = true;
    const { error: e } = await sb.from('reviews').insert({ vet_id: v.id, author_id: state.user.id, rating, comment: document.getElementById('revText').value.trim() || null });
    if (e) { revBtn.disabled = false; return toast(t('error')); }
    toast(t('saved')); pageVet(id);
  };
  document.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    await sb.from('reviews').delete().eq('id', b.dataset.del); pageVet(id);
  });
}

/* ---------- AI helper ---------- */
function pageAI() {
  if (state.ai.pet) return renderAIChat();
  const opt = (obj) => Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  $app.innerHTML = `
    <h1>${t('ai_title')}</h1>
    <div class="notice">${t('ai_notice')}</div>
    <form class="card" id="petForm">
      <div class="grid2">
        <div><label>${t('pet_species')}</label><select name="species" required>${opt(I18N[state.lang].species)}</select></div>
        <div><label>${t('pet_breed')}</label><input name="breed" maxlength="60"></div>
        <div><label>${t('pet_sex')}</label><select name="sex"><option value="male">${t('male')}</option><option value="female">${t('female')}</option><option value="unknown">${t('unknown')}</option></select></div>
        <div><label>${t('pet_age')}</label>
          <div class="row" style="flex-wrap:nowrap"><input name="age" type="number" min="0" step="0.5" style="flex:1"><select name="ageUnit" style="width:auto"><option value="years">${t('age_years')}</option><option value="months">${t('age_months')}</option></select></div></div>
        <div><label>${t('pet_weight')}</label><input name="weight" type="number" min="0" step="0.1"></div>
        <div><label>${t('pet_since')}</label><select name="since">
          <option value="just now">${t('since_now')}</option><option value="a few hours">${t('since_hours')}</option><option value="1 day">${t('since_day')}</option>
          <option value="a few days">${t('since_days')}</option><option value="more than a week">${t('since_week')}</option></select></div>
      </div>
      <label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" name="neutered" style="width:auto"> ${t('pet_neutered')}</label>
      <label>${t('pet_symptoms')}</label><textarea name="symptoms" required maxlength="2000"></textarea>
      <label>${t('pet_extra')}</label><textarea name="extra" maxlength="1000"></textarea>
      <button class="btn clay" style="margin-top:16px">${t('start_ai')}</button>
    </form>`;
  document.getElementById('petForm').onsubmit = (e) => {
    e.preventDefault();
    if (!requireLogin()) return;
    const f = new FormData(e.target);
    state.ai.pet = {
      species: I18N.en.species[f.get('species')], breed: f.get('breed') || 'unknown', sex: f.get('sex'), neutered: f.get('neutered') === 'on',
      age: f.get('age') ? `${f.get('age')} ${f.get('ageUnit')}` : 'unknown', weight_kg: f.get('weight') || 'unknown',
      since: f.get('since'), extra: f.get('extra') || ''
    };
    state.ai.msgs = [{ role: 'user', text: f.get('symptoms') }];
    renderAIChat(true);
  };
}

function renderAIChat(first = false) {
  $app.innerHTML = `
    <div class="row" style="justify-content:space-between"><h1 style="margin:0">${t('ai_title')}</h1><button class="chip" id="newCase">${t('new_case')}</button></div>
    <div class="notice" style="margin-top:12px">${t('ai_notice')}</div>
    <div class="chat-box" style="height:calc(100vh - 290px)">
      <div class="chat-scroll" id="aiScroll"><div class="bubble-wrap" id="aiMsgs"></div></div>
      <form class="composer" id="aiForm"><textarea id="aiInput" rows="1" placeholder="${esc(t('ai_followup'))}"></textarea><button class="icon-btn send" title="${t('send')}">${ic('send', 20)}</button></form>
    </div>
    <div style="margin-top:10px"><a class="btn ghost" href="#/vets">${ic('steth', 18)} ${t('find_vet')}</a></div>`;
  const draw = (typing) => {
    document.getElementById('aiMsgs').innerHTML = state.ai.msgs.map((m) => `<div class="bubble ${m.role === 'user' ? 'me' : 'other'}">${md(m.text)}</div>`).join('') +
      (typing ? `<div class="bubble other typing">${t('ai_typing')}</div>` : '');
    const s = document.getElementById('aiScroll'); s.scrollTop = s.scrollHeight;
  };
  const ask = async () => {
    draw(true);
    try {
      const { data, error } = await sb.functions.invoke('ai-assistant', { body: { pet: state.ai.pet, messages: state.ai.msgs, lang: state.lang } });
      if (error || !data?.reply) throw error || new Error('empty');
      state.ai.msgs.push({ role: 'assistant', text: data.reply });
    } catch (e) { console.error(e); state.ai.msgs.push({ role: 'assistant', text: t('ai_error') }); }
    draw(false);
  };
  document.getElementById('newCase').onclick = () => { state.ai = { pet: null, msgs: [] }; pageAI(); };
  document.getElementById('aiForm').onsubmit = (e) => {
    e.preventDefault(); const i = document.getElementById('aiInput'); const text = i.value.trim(); if (!text) return;
    i.value = ''; state.ai.msgs.push({ role: 'user', text }); ask();
  };
  if (first) ask(); else draw(false);
}

/* ---------- chats ---------- */
async function pageChats() {
  if (!requireLogin()) return;
  const { data, error } = await sb.from('conversations')
    .select('id,created_at,vet_id,owner_id,vets(full_name,photo_url,user_id),owner:profiles!conversations_owner_id_fkey(full_name,avatar_url)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  $app.innerHTML = `<h1>${t('chats_title')}</h1>` + ((data || []).length ? data.map((c) => {
    const iAmVet = c.vets?.user_id === state.user.id;
    const name = iAmVet ? c.owner?.full_name : c.vets?.full_name;
    const img = iAmVet ? c.owner?.avatar_url : c.vets?.photo_url;
    return `<a class="list-item" href="#/chat/${c.id}">${img ? `<img class="avatar" src="${esc(img)}" referrerpolicy="no-referrer" alt="">` : `<span class="avatar">${esc(initials(name))}</span>`}<span class="t"><b>${esc(name || '—')}</b></span><span class="chev">${ic('chev', 18)}</span></a>`;
  }).join('') : `<div class="empty"><div class="big">${ic('chat', 40)}</div><p class="muted" style="margin:0">${t('chats_empty')}</p></div>`);
}

async function pageChat(id) {
  if (!requireLogin()) return;
  const { data: c, error } = await sb.from('conversations')
    .select('id,vet_id,owner_id,vets(full_name,user_id),owner:profiles!conversations_owner_id_fkey(full_name)').eq('id', id).single();
  if (error || !c) throw error || new Error('Not found');
  const iAmVet = c.vets?.user_id === state.user.id;
  const title = iAmVet ? c.owner?.full_name : c.vets?.full_name;
  const { data: msgs } = await sb.from('messages').select('*').eq('conversation_id', id).order('created_at');
  const seen = new Set();

  $app.innerHTML = `
    <a class="back" href="#/chats">${t('back')}</a>
    <h2>${esc(title || '')}</h2>
    <div class="chat-box">
      <div class="chat-scroll" id="chatScroll"><div class="bubble-wrap" id="chatMsgs"></div></div>
      <div id="pv"></div>
      <form class="composer" id="chatForm">
        <label class="icon-btn" style="cursor:pointer" title="${t('attach')}">${ic('camera', 20)}<input type="file" id="file" accept="image/*" hidden></label>
        <textarea id="chatInput" rows="1" placeholder="${esc(t('type_msg'))}"></textarea>
        <button class="icon-btn send" title="${t('send')}">${ic('send', 20)}</button>
      </form>
    </div>`;

  const wrap = document.getElementById('chatMsgs');
  const scroll = document.getElementById('chatScroll');
  const add = (m) => {
    if (seen.has(m.id)) return; seen.add(m.id);
    wrap.querySelector('.muted')?.remove();
    const mine = m.sender_id === state.user.id;
    wrap.insertAdjacentHTML('beforeend', `<div class="bubble ${mine ? 'me' : 'other'}">${m.image_url ? `<a href="${esc(m.image_url)}" target="_blank" rel="noopener"><img src="${esc(m.image_url)}" alt=""></a>` : ''}${m.body ? md(m.body) : ''}<time>${fmtTime(m.created_at)}</time></div>`);
    scroll.scrollTop = scroll.scrollHeight;
  };
  if (!(msgs || []).length) wrap.innerHTML = `<p class="muted" style="text-align:center">${t('no_msgs')}</p>`;
  (msgs || []).forEach(add);

  state.channel = sb.channel('chat-' + id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (p) => add(p.new))
    .subscribe();

  let pending = null;
  const fileEl = document.getElementById('file');
  fileEl.onchange = () => {
    const f = fileEl.files[0]; if (!f) return; pending = f;
    document.getElementById('pv').innerHTML = `<div class="preview"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" class="chip" id="rmImg">✕</button></div>`;
    document.getElementById('rmImg').onclick = () => { pending = null; fileEl.value = ''; document.getElementById('pv').innerHTML = ''; };
  };
  document.getElementById('chatForm').onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput'); const body = input.value.trim();
    if (!body && !pending) return;
    const btn = e.target.querySelector('.send'); btn.disabled = true;
    try {
      let image_url = null;
      if (pending) {
        const blob = await compressImage(pending);
        const path = `${id}/${crypto.randomUUID()}.jpg`;
        const up = await sb.storage.from('chat-images').upload(path, blob, { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        image_url = sb.storage.from('chat-images').getPublicUrl(path).data.publicUrl;
      }
      const ins = await sb.from('messages').insert({ conversation_id: id, sender_id: state.user.id, body: body || null, image_url }).select().single();
      if (ins.error) throw ins.error;
      add(ins.data); input.value = ''; pending = null; fileEl.value = ''; document.getElementById('pv').innerHTML = '';
    } catch (err) { console.error(err); toast(t('error')); }
    btn.disabled = false;
  };
}

/* ---------- auth + boot ---------- */
async function loadProfile() {
  if (!state.user) { state.profile = null; state.priv = null; return; }
  const [a, b] = await Promise.all([
    sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle(),
    sb.from('profile_private').select('*').eq('id', state.user.id).maybeSingle()
  ]);
  state.profile = a.data; state.priv = b.data;
}
function applySavedLang() {
  const l = state.priv?.lang;
  if (LANGS.includes(l) && l !== state.lang) { state.lang = l; store.set('lang', l); }
}
sb.auth.onAuthStateChange((_evt, session) => {
  const prev = state.user?.id;
  state.user = session?.user || null;
  if (prev === state.user?.id) return;
  // supabase-js: ішінде await жасамау үшін setTimeout / avoid awaiting inside the auth callback
  setTimeout(async () => { await loadProfile(); applySavedLang(); route(); }, 0);
});
(async () => {
  const { data } = await sb.auth.getSession();
  state.user = data.session?.user || null;
  await loadProfile(); applySavedLang();
  if (new URLSearchParams(location.search).has('code')) history.replaceState({}, '', location.pathname + location.hash);
  route();
})();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(APP_VERSION)).catch(() => {});
