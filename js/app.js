import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';
import { I18N } from './i18n.js';

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $app = document.getElementById('app');
const state = { user: null, profile: null, lang: localStorage.getItem('lang') || CONFIG.DEFAULT_LANG, channel: null, ai: { pet: null, msgs: [] } };

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
const toast = (msg) => {
  const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
};
const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
const initials = (n) => (n || '?').trim().charAt(0).toUpperCase();
const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const phoneDigits = (s) => String(s || '').replace(/\D/g, '');
const tgUser = (s) => String(s || '').replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
function cleanup() { if (state.channel) { sb.removeChannel(state.channel); state.channel = null; } }
function requireLogin() { if (!state.user) { location.hash = '#/login'; toast(t('login_needed')); return false; } return true; }

async function compressImage(file, max = 1280, quality = 0.82) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', quality));
}

/* ---------- layout ---------- */
function renderChrome() {
  const items = [['#/', '🏠', 'nav_home'], ['#/vets', '🩺', 'nav_vets'], ['#/ai', '🤖', 'nav_ai'], ['#/chats', '💬', 'nav_chats']];
  const cur = location.hash.split('/')[1] || '';
  const active = (h) => ('#/' + cur) === h || (h === '#/' && cur === '');
  document.getElementById('navDesktop').innerHTML = items.map(([h, , k]) => `<a href="${h}" class="${active(h) ? 'active' : ''}">${t(k)}</a>`).join('');
  document.getElementById('navMobile').innerHTML = items.map(([h, ic, k]) => `<a href="${h}" class="${active(h) ? 'active' : ''}"><span class="ic">${ic}</span>${t(k)}</a>`).join('');
  document.getElementById('langBtn').textContent = state.lang === 'kk' ? 'KZ' : 'EN';
  document.documentElement.lang = state.lang;
  const box = document.getElementById('userBox');
  if (!state.user) { box.innerHTML = `<a class="btn" href="#/login">${t('login')}</a>`; return; }
  const name = state.profile?.full_name || state.user.email;
  const av = state.profile?.avatar_url;
  box.innerHTML = `<div class="menu"><span class="avatar" id="avBtn">${av ? `<img class="avatar" src="${esc(av)}" referrerpolicy="no-referrer" alt="">` : esc(initials(name))}</span></div>`;
  document.getElementById('avBtn').onclick = () => {
    const m = box.querySelector('.menu'); const ex = m.querySelector('.menu-pop');
    if (ex) { ex.remove(); return; }
    m.insertAdjacentHTML('beforeend', `<div class="menu-pop"><div class="who">${esc(name)}</div><button id="outBtn">${t('logout')}</button></div>`);
    document.getElementById('outBtn').onclick = async () => { await sb.auth.signOut(); };
  };
}

document.getElementById('langBtn').onclick = () => {
  state.lang = state.lang === 'kk' ? 'en' : 'kk'; localStorage.setItem('lang', state.lang); route();
};

/* ---------- router ---------- */
async function route() {
  cleanup(); renderChrome(); window.scrollTo(0, 0);
  const [, p1 = '', p2] = (location.hash.slice(1) || '/').split('/');
  $app.innerHTML = `<div class="loader">🐾</div>`;
  try {
    if (p1 === '') pageHome();
    else if (p1 === 'login') pageLogin();
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
function pageHome() {
  $app.innerHTML = `
    <section class="hero">
      <div class="pets">🐶 🐱 🐰 🐴 🐄</div>
      <h1>${t('home_title')}</h1>
      <p>${t('home_sub')}</p>
    </section>
    <section class="empty">
      <div class="big">🩺🐾</div>
      <h2>${t('home_empty_title')}</h2>
      <p class="muted">${t('home_empty_text')}</p>
      <div class="row" style="justify-content:center;margin-top:14px">
        <a class="btn orange" href="#/ai">🤖 ${t('nav_ai')}</a>
        <a class="btn ghost" href="#/vets">🩺 ${t('nav_vets')}</a>
      </div>
      <p class="muted" style="font-size:.8rem;margin-top:18px">${t('install_ios')}</p>
    </section>`;
}

function pageLogin() {
  if (state.user) { location.hash = '#/'; return; }
  $app.innerHTML = `
    <div class="card" style="max-width:440px;margin:30px auto;text-align:center">
      <div style="font-size:3rem">🐾</div>
      <h2>${t('login_title')}</h2>
      <p class="muted">${t('login_text')}</p>
      <button class="btn google" id="gBtn">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.100 0 24s.9 7.600 2.600 10.800l7.900-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 12-2.100 16-5.800l-7.600-5.900c-2.100 1.400-4.900 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z"/></svg>
        ${t('login')}
      </button>
    </div>`;
  document.getElementById('gBtn').onclick = () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
}

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
    <h1>🩺 ${t('vets_title')}</h1>
    <input id="q" type="search" placeholder="${esc(t('search'))}">
    <div id="vetList" class="cards" style="margin-top:16px"></div>`;
  const draw = () => {
    const q = document.getElementById('q').value.toLowerCase().trim();
    const list = vets.filter((v) => !q || [v.full_name, v.city, v.specialization, v.clinic].join(' ').toLowerCase().includes(q));
    document.getElementById('vetList').innerHTML = list.length ? list.map(vetCard).join('') :
      `<div class="empty" style="grid-column:1/-1"><div class="big">🐾</div><p class="muted">${t('vets_empty')}</p></div>`;
  };
  document.getElementById('q').oninput = draw; draw();
}

function vetCard(v) {
  const r = v.rating;
  return `<a class="card vet-card" href="#/vet/${v.id}">
    <div class="row">
      ${v.photo_url ? `<img class="photo" src="${esc(v.photo_url)}" alt="">` : `<div class="photo">🩺</div>`}
      <div><h3 style="margin:0">${esc(v.full_name)}</h3><div class="muted">${esc(v.city || '')}</div></div>
    </div>
    <div>${esc(v.specialization || '')}</div>
    <div class="row"><span class="stars">${r ? stars(r.avg_rating) : ''}</span><span class="muted">${r ? `${Number(r.avg_rating).toFixed(1)} (${r.reviews_count})` : t('no_rating')}</span></div>
    ${v.experience_years ? `<div class="muted">${v.experience_years} ${t('years')}</div>` : ''}
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
        ${v.photo_url ? `<img class="photo" style="width:96px;height:96px;border-radius:50%;object-fit:cover" src="${esc(v.photo_url)}" alt="">` : `<div class="vet-card photo" style="width:96px;height:96px;border-radius:50%;background:var(--mint-2);display:grid;place-items:center;font-size:2.6rem">🩺</div>`}
        <div>
          <h1 style="margin:0">${esc(v.full_name)}</h1>
          <div class="muted">${esc(v.city || '')}${v.clinic ? ' · ' + esc(v.clinic) : ''}</div>
          <div class="row"><span class="stars">${reviews.length ? stars(avg) : ''}</span><span class="muted">${reviews.length ? avg.toFixed(1) + ' (' + reviews.length + ')' : t('no_rating')}</span></div>
        </div>
      </div>
      <div style="margin-top:10px">
        ${v.specialization ? `<span class="tag">${esc(v.specialization)}</span>` : ''}
        ${(v.animals || []).map((a) => `<span class="tag">${esc(a)}</span>`).join('')}
        ${v.experience_years ? `<span class="tag">${v.experience_years} ${t('years')}</span>` : ''}
      </div>
      ${v.bio ? `<h3 style="margin-top:16px">${t('about')}</h3><p>${esc(v.bio)}</p>` : ''}
      <h3>${t('contacts')}</h3>
      <div class="contact-row">
        ${wa ? `<a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${wa}">WhatsApp</a>` : ''}
        ${tg ? `<a class="btn tg" target="_blank" rel="noopener" href="https://t.me/${esc(tg)}">Telegram</a>` : ''}
        ${!isSelf && v.user_id ? `<button class="btn orange" id="msgBtn">💬 ${t('write_msg')}</button>` : ''}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h2>${t('reviews_title')}</h2>
      <div id="revList">${reviews.length ? reviews.map((r) => `
        <div class="review">
          <div class="row"><b>${esc(r.profiles?.full_name || '—')}</b><span class="stars">${stars(r.rating)}</span><span class="muted" style="font-size:.8rem">${new Date(r.created_at).toLocaleDateString()}</span>
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
    <h1>🤖 ${t('ai_title')}</h1>
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
      <button class="btn orange" style="margin-top:14px">${t('start_ai')}</button>
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
    <div class="row" style="justify-content:space-between"><h1 style="margin:0">🤖 ${t('ai_title')}</h1><button class="chip" id="newCase">${t('new_case')}</button></div>
    <div class="notice" style="margin-top:12px">${t('ai_notice')}</div>
    <div class="chat-box" style="height:calc(100vh - 280px)">
      <div class="chat-scroll" id="aiScroll"><div class="bubble-wrap" id="aiMsgs"></div></div>
      <form class="composer" id="aiForm"><textarea id="aiInput" rows="1" placeholder="${esc(t('ai_followup'))}"></textarea><button class="icon-btn send" title="${t('send')}">➤</button></form>
    </div>
    <div style="margin-top:10px"><a class="btn ghost" href="#/vets">🩺 ${t('find_vet')}</a></div>`;
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
  $app.innerHTML = `<h1>💬 ${t('chats_title')}</h1>` + ((data || []).length ? data.map((c) => {
    const iAmVet = c.vets?.user_id === state.user.id;
    const name = iAmVet ? c.owner?.full_name : c.vets?.full_name;
    const img = iAmVet ? c.owner?.avatar_url : c.vets?.photo_url;
    return `<a class="list-item" href="#/chat/${c.id}">${img ? `<img class="avatar" src="${esc(img)}" referrerpolicy="no-referrer" alt="">` : `<span class="avatar">${esc(initials(name))}</span>`}<b>${esc(name || '—')}</b></a>`;
  }).join('') : `<div class="empty"><div class="big">💬</div><p class="muted">${t('chats_empty')}</p></div>`);
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
        <label class="icon-btn" style="display:grid;place-items:center;margin:0;cursor:pointer" title="${t('attach')}">📷<input type="file" id="file" accept="image/*" hidden></label>
        <textarea id="chatInput" rows="1" placeholder="${esc(t('type_msg'))}"></textarea>
        <button class="icon-btn send" title="${t('send')}">➤</button>
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
  if (!state.user) { state.profile = null; return; }
  const { data } = await sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
  state.profile = data;
}
sb.auth.onAuthStateChange(async (_evt, session) => {
  const prev = state.user?.id;
  state.user = session?.user || null;
  if (prev !== state.user?.id) { await loadProfile(); route(); }
});
(async () => {
  const { data } = await sb.auth.getSession();
  state.user = data.session?.user || null;
  await loadProfile();
  if (new URLSearchParams(location.search).has('code')) history.replaceState({}, '', location.pathname + location.hash);
  route();
})();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
