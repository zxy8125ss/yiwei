/* 一苇 · 古文观止入门 */
const VERSION = '1.3.1';
const KEY = 'yw.state.v1';
const SNAP = 'yw.snaps.v1';
const INTERVALS = [1, 2, 4, 7, 15, 30]; // 复习间隔（天），第 6 轮后算掌握
const TYPE_ORDER = ['通假', '古今异义', '词类活用', '实词', '虚词', '特殊句式'];

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
const mdCN = s => { const [, m, d] = s.split('-'); return `${+m} 月 ${+d} 日`; };
const plainOf = sent => sent.t.map(p => typeof p === 'string' ? p : p.c).join('');
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- 数据 ---------- */
let TEXTS = [], CAT = null, BYID = {};
let S = load();

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  return Object.assign({ texts: {}, settings: { py: true, fs: 19, note: 'foot' }, last: null, backupAt: null }, s || {});
}
function save() {
  S.updated = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  snapshot();
}
// 每天留一份本机快照（保留 7 份），误操作时可从「我的」恢复
function snapshot() {
  try {
    const snaps = JSON.parse(localStorage.getItem(SNAP) || '[]');
    const d = today();
    const rest = snaps.filter(x => x.d !== d);
    rest.unshift({ d, s: JSON.stringify(S) });
    localStorage.setItem(SNAP, JSON.stringify(rest.slice(0, 7)));
  } catch (e) {}
}
const st = id => S.texts[id] || null;

function statusOf(id) {
  const t = st(id);
  if (!t || !t.read) return { k: 'new', label: '未读', cls: '' };
  if (t.box >= INTERVALS.length) return { k: 'done', label: '已掌握', cls: 'qing' };
  if (t.due && t.due <= today()) return { k: 'due', label: '今天复习', cls: 'zhu' };
  const n = daysBetween(today(), t.due);
  return { k: 'wait', label: n === 1 ? '明天复习' : `${n} 天后复习`, cls: 'amber' };
}
const dueList = () => TEXTS.filter(t => statusOf(t.id).k === 'due');

/* ---------- 路由 ---------- */
const app = $('#app');
function go(h) { location.hash = h; }
window.addEventListener('hashchange', render);

function render() {
  const h = location.hash.replace(/^#\/?/, '');
  const [p, a, b] = h.split('/');
  quiz = null;
  if (p === 't' && BYID[a]) return viewText(BYID[a], b || 'text');
  if (p === 'review') return viewReview();
  if (p === 'zt') return viewTopics(a, b ? decodeURIComponent(b) : null);
  if (p === 'xuci') return viewTopics('duoyi', a ? decodeURIComponent(a) : null);
  if (p === 'me') return viewMe();
  return viewHome();
}

const ICON = {
  road: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 19c4-2 4-6 8-7s5-5 8-8"/><circle cx="4" cy="19" r="1.4" fill="currentColor"/><circle cx="20" cy="4" r="1.4" fill="currentColor"/></svg>',
  review: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/><path d="M12 8v4l3 2"/></svg>',
  xu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  play: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z" fill="currentColor"/></svg>',
  out: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5"/></svg>',
};

function shell(title, body, { tab = null, back = null, act = '' } = {}) {
  const due = dueList().length;
  app.innerHTML = `
    <header class="top">
      ${back ? `<button class="back" aria-label="返回" data-back="${back}">${ICON.back}</button>` : ''}
      <h1>${esc(title)}</h1>${act}
    </header>
    <main>${body}</main>
    <nav class="tabbar">
      <a href="#/" class="${tab === 'home' ? 'on' : ''}">${ICON.road}路线</a>
      <a href="#/review" class="${tab === 'review' ? 'on' : ''}">${ICON.review}复习${due ? `<span class="dot">${due}</span>` : ''}</a>
      <a href="#/zt" class="${tab === 'zt' ? 'on' : ''}">${ICON.xu}专题</a>
      <a href="#/me" class="${tab === 'me' ? 'on' : ''}">${ICON.me}我的</a>
    </nav>`;
  const b = $('[data-back]');
  if (b) b.onclick = () => (history.length > 1 && sessionStorage.getItem('yw.inapp')) ? history.back() : go(b.dataset.back);
  window.scrollTo(0, 0);
}

/* ---------- 首页：路线 ---------- */
let qOffset = 0;
const famousLines = () => TEXTS.flatMap(t => t.paras.flat().filter(s => s.m).map(s => ({ s, t })));
function lineOfDay(off) {
  const all = famousLines(); if (!all.length) return null;
  const day = daysBetween('2026-01-01', today());
  return all[((day * 37 + off) % all.length + all.length) % all.length];
}
function viewHome() {
  const due = dueList();
  const q = lineOfDay(qOffset);
  let html = q ? `<div class="quote">
      <div class="qk"><span class="seal">句</span>今日名句</div>
      <a class="qq" href="#/t/${q.t.id}/text">${esc(plainOf(q.s))}</a>
      <div class="qy">${esc(q.s.y)}</div>
      <div class="qf"><a href="#/t/${q.t.id}/text">——${esc(q.t.author)}《${esc(q.t.title.replace(/（.*）/, ''))}》</a><button id="qNext">换一句</button></div>
    </div>` : '';
  if (due.length) html += `<a class="duebar" href="#/review"><span>今天有 <b>${due.length}</b> 篇到了复习时间</span><span>去复习 ›</span></a>`;
  let no = 0;
  for (const sg of CAT.stages) {
    const items = CAT.list.filter(x => x.stage === sg.n);
    const ready = items.filter(x => BYID[x.id]);
    const done = ready.filter(x => st(x.id)?.read).length;
    html += `<div class="sec"><h2>阶段${'一二三'[sg.n - 1]} · ${sg.name}</h2><span class="num">${ready.length ? `${done}/${ready.length} 已读` : '整理中'}</span></div>
      <div class="sub muted small" style="margin:-6px 0 10px">${sg.desc}</div><div class="list">`;
    for (const x of items) {
      no++;
      const t = BYID[x.id];
      if (!t) {
        html += `<div class="item soon"><span class="no">${no}</span><div class="main"><div class="t">${esc(x.title)}</div><div class="m">${esc(x.author)}</div></div><span class="chip">整理中</span></div>`;
        continue;
      }
      const s = statusOf(t.id);
      html += `<a class="item" href="#/t/${t.id}/${st(t.id)?.read ? 'text' : 'intro'}"><span class="no">${no}</span>
        <div class="main"><div class="t">${esc(t.title)}</div><div class="m">${esc(t.dynasty)} · ${esc(t.author)} · ${t.chars} 字</div></div>
        <span class="chip ${s.cls}">${s.label}</span></a>`;
    }
    html += '</div>';
  }
  shell('路线', html, { tab: 'home' });
  const qn = $('#qNext'); if (qn) qn.onclick = () => { qOffset++; viewHome(); };
}

/* ---------- 篇章页 ---------- */
function viewText(t, tab) {
  S.last = t.id; save();
  sessionStorage.setItem('yw.inapp', '1');
  const s = statusOf(t.id);
  const tabs = [['intro', '导读'], ['text', '原文'], ['words', '字词'], ['test', '自测']];
  // 有核实过的朗读页面就直接打开；否则打开 B 站搜索这一篇的朗诵
  const l = (t.listen || [])[0] || { url: 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(t.title.replace(/（.*）/, '') + ' 朗诵'), who: 'B站搜索' };
  let body = `<div class="hero">
      <div class="vt">${esc(t.title.replace(/（.*）/, ''))}</div>
      <div class="meta">
        <div class="tags"><span class="chip">${esc(t.juan)}</span><span class="chip">${esc(t.genre)}</span><span class="chip">${t.chars} 字</span>${s.k !== 'new' ? `<span class="chip ${s.cls}">${s.label}</span>` : ''}</div>
        <div class="a">${esc(t.dynasty)} · ${esc(t.author)}</div>
        <div class="gist">${esc(t.intro.gist || '')}</div>
        ${l ? `<a class="listen-btn" href="${esc(l.url)}" target="_blank" rel="noopener">${ICON.play}<span>名家朗读</span><small>${esc(l.who || '')}</small></a>` : ''}
      </div>
    </div>
    <div class="tabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div id="pane"></div>`;
  shell(t.title, body, { back: '#/' });
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => history.replaceState(null, '', `#/t/${t.id}/${b.dataset.tab}`) || renderPane(t, b.dataset.tab));
  renderPane(t, tab);
}

function renderPane(t, tab) {
  app.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const pane = $('#pane');
  if (tab === 'intro') pane.innerHTML = paneIntro(t);
  else if (tab === 'words') pane.innerHTML = paneWords(t);
  else if (tab === 'test') return startQuiz(pane, [t], false);
  else { paneText(t, pane); return; }
  const go2 = pane.querySelector('[data-go]');
  if (go2) go2.onclick = () => { history.replaceState(null, '', `#/t/${t.id}/${go2.dataset.go}`); renderPane(t, go2.dataset.go); window.scrollTo(0, $('.tabs').offsetTop - 60); };
}

function paneIntro(t) {
  const i = t.intro;
  const listen = t.listen && t.listen.length
    ? `<h3>名家朗读</h3><div class="listen">${t.listen.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${ICON.play}<span>${esc(l.label)}</span>${ICON.out}</a>`).join('')}</div>`
    : '';
  return `<div class="intro">
    <h3>一句话</h3><div class="gistbox">${esc(i.gist)}</div>
    <h3>作者</h3><p>${esc(i.author)}</p>
    <h3>写作背景</h3><p>${esc(i.bg)}</p>
    <h3>文章脉络</h3><ol class="flow">${(i.flow || []).map(f => `<li>${esc(f)}</li>`).join('')}</ol>
    ${i.tip ? `<h3>读法提示</h3><p>${esc(i.tip)}</p>` : ''}
    ${listen}
    <button class="done-btn" data-go="text">读原文</button>
  </div>`;
}

const PUNC = /[，。、；：？！“”‘’（）《》—…·]/;
function unitHTML(p) {
  if (typeof p === 'string') return esc(p);
  const cls = p.tj ? ' class="tj"' : '';
  return p.py ? `<ruby${cls}>${esc(p.c)}<rt>${esc(p.py)}</rt></ruby>` : `<span${cls}>${esc(p.c)}</span>`;
}
// 把每条注释挂到它解释的字词后面（教科书式）：页下注用编号，夹注直接插在字后
function sentHTML(s, pi, si, ctx) {
  const units = [];
  for (const p of s.t) {
    if (typeof p === 'string') for (const ch of p) units.push({ c: ch, h: esc(ch) });
    else units.push({ c: p.c, h: unitHTML(p) });
  }
  const ends = []; let acc = 0;
  for (const u of units) { acc += u.c.length; ends.push(acc); }
  const plain = units.map(u => u.c).join('');
  const marks = units.map(() => []);
  let from = 0;
  for (const n of s.n) {
    const key = n.w.replace(/[（(].*$/, '');
    let i = plain.indexOf(key, from);
    if (i < 0) i = plain.indexOf(key);
    let ui;
    if (i >= 0) { const e = i + key.length; ui = ends.findIndex(x => x >= e); from = i; }
    else { ui = units.length - 1; while (ui > 0 && PUNC.test(units[ui].c)) ui--; }
    marks[ui].push(n);
  }
  let html = '';
  units.forEach((u, k) => {
    html += u.h;
    for (const n of marks[k]) {
      if (ctx.mode === 'foot') { ctx.n++; ctx.foot.push({ k: ctx.n, n }); html += `<sup class="fn">${ctx.n}</sup>`; }
      else if (ctx.mode === 'inline') html += `<span class="jz">〔${esc(n.d)}〕</span>`;
    }
  });
  return `<span class="s${s.m ? ' m' : ''}" data-s="${pi}.${si}">${html}</span>`;
}

let showAllY = false;
function paneText(t, pane) {
  const s = statusOf(t.id);
  const read = st(t.id)?.read;
  const mode = S.settings.note || 'foot';
  pane.innerHTML = `
    <div class="tools">
      <div class="seg" id="nMode">${[['foot', '页下注'], ['inline', '夹注'], ['off', '不看注']].map(([k, n]) => `<button data-m="${k}" class="${mode === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <span class="sp"></span>
      <button class="tog" id="fsM" aria-label="字号缩小">A−</button>
      <button class="tog" id="fsP" aria-label="字号放大">A＋</button>
    </div>
    <div class="tools" style="margin-top:0">
      <button class="tog ${S.settings.py ? 'on' : ''}" id="tPy">注音</button>
      <button class="tog ${showAllY ? 'on' : ''}" id="tY">全文译文</button>
    </div>
    <div class="hint">点任意一句看译文。朱砂下划线是名句。</div>
    <div class="wen ${S.settings.py ? '' : 'nopy'} mode-${mode}" id="wen" style="--fs:${S.settings.fs}px"></div>
    ${read
      ? `<button class="done-btn ghost" disabled>已读 · ${esc(s.label)}</button>`
      : `<button class="done-btn" id="doneBtn">读完了，安排复习</button>`}
    <div class="hint" style="text-align:center">读完后第二天提醒第一次复习，之后间隔逐渐拉长。</div>`;
  const wen = $('#wen');
  const draw = () => {
    const ctx = { mode: S.settings.note || 'foot', n: 0, foot: [] };
    wen.className = `wen ${S.settings.py ? '' : 'nopy'} mode-${ctx.mode}`;
    wen.innerHTML = t.paras.map((p, pi) => {
      ctx.foot = [];
      const body = `<p data-p="${pi}">${p.map((x, si) => sentHTML(x, pi, si, ctx)).join('')}</p>`;
      const y = showAllY ? `<div class="para-y">${esc(p.map(x => x.y).join(''))}</div>` : '';
      const foot = ctx.foot.length ? `<div class="fnl">${ctx.foot.map(f => `<div class="fni"><span class="fnn">${f.k}</span><b>${esc(f.n.w)}</b>　${esc(f.n.d)}</div>`).join('')}</div>` : '';
      return body + y + foot;
    }).join('');
  };
  draw();
  let open = null;
  wen.onclick = e => {
    const el = e.target.closest('.s'); if (!el) return;
    wen.querySelectorAll('.yi').forEach(n => n.remove());
    wen.querySelectorAll('.s.on').forEach(n => n.classList.remove('on'));
    if (open === el.dataset.s) { open = null; return; }
    open = el.dataset.s;
    const [pi, si] = open.split('.').map(Number);
    el.classList.add('on');
    el.closest('p').insertAdjacentHTML('afterend', `<div class="yi"><span class="yk">译</span>${esc(t.paras[pi][si].y)}</div>`);
  };
  $('#nMode').querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    S.settings.note = b.dataset.m; save(); open = null;
    $('#nMode').querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === b)); draw();
  });
  $('#tPy').onclick = e => { S.settings.py = !S.settings.py; save(); e.target.classList.toggle('on', S.settings.py); wen.classList.toggle('nopy', !S.settings.py); };
  $('#tY').onclick = e => { showAllY = !showAllY; e.target.classList.toggle('on', showAllY); open = null; draw(); };
  const fs = d => { S.settings.fs = Math.max(16, Math.min(25, S.settings.fs + d)); save(); wen.style.setProperty('--fs', S.settings.fs + 'px'); };
  $('#fsM').onclick = () => fs(-1);
  $('#fsP').onclick = () => fs(1);
  const db = $('#doneBtn');
  if (db) db.onclick = () => {
    S.texts[t.id] = Object.assign(S.texts[t.id] || {}, { read: Date.now(), box: 0, due: addDays(today(), 1), hist: (S.texts[t.id]?.hist || []) });
    save();
    toast(`已读完，${mdCN(addDays(today(), 1))}第一次复习`);
    viewText(t, 'text');
  };
}

// 字词：按在文中出现的先后编号，一行一条
function wordsInOrder(t) {
  const full = t.paras.flat().map(plainOf).join('');
  return t.words.map((w, i) => ({ w, pos: (p => p < 0 ? 1e6 + i : p)(full.indexOf(w.ex)) })).sort((a, b) => a.pos - b.pos).map(x => x.w);
}
function paneWords(t) {
  const ws = wordsInOrder(t);
  let html = `<div class="wl">${ws.map((w, i) => `<div class="wrow"><span class="wn">${i + 1}</span><div class="wb">
      <div class="wh"><b>${esc(w.w)}</b><span class="tag t-${TYPE_ORDER.indexOf(w.t)}">${esc(w.t)}</span></div>
      <div class="wd">${esc(w.d)}</div><div class="wex">${hl(w.ex, w.w)}</div></div></div>`).join('')}</div>`;
  if (t.idioms && t.idioms.length) html += `<div class="sec"><h2>出自本篇的成语</h2></div><div class="wl">${t.idioms.map(x => `<div class="wrow"><div class="wb"><div class="wh"><b>${esc(x.w)}</b></div><div class="wd">${esc(x.d)}</div><div class="wex">原句：${esc(x.ex)}</div></div></div>`).join('')}</div>`;
  return html + `<button class="done-btn ghost" data-go="test" style="margin-top:20px">去自测</button>`;
}
function hl(ex, w) {
  const i = ex.indexOf(w);
  if (i < 0 || w.length > 6) return esc(ex);
  return esc(ex.slice(0, i)) + `<b>${esc(w)}</b>` + esc(ex.slice(i + w.length));
}

/* ---------- 自测：遮字 ---------- */
function makeItems(t, n = 8) {
  const words = [], lines = [];
  const sents = t.paras.flat();
  const seen = new Set();
  for (const w of t.words) {
    if (w.w.length > 4 || w.t === '特殊句式') continue;
    const s = sents.find(x => plainOf(x).includes(w.ex.replace(/[“”]/g, '')) || plainOf(x).includes(w.ex));
    if (!s) continue;
    const text = plainOf(s);
    const k = text + '|' + w.w;
    if (seen.has(k) || !text.includes(w.w)) continue;
    seen.add(k);
    words.push({ kind: 'w', text, ans: w.w, hint: w.d, t });
  }
  for (const s of sents.filter(x => x.m)) {
    const text = plainOf(s);
    const parts = text.split(/(?<=[，；：])/);
    if (parts.length >= 2) {
      const cut = parts.slice(0, Math.ceil(parts.length / 2)).join('');
      const rest = text.slice(cut.length).replace(/[。！？”]+$/, '');
      const tail = text.slice(cut.length + rest.length);
      lines.push({ kind: 'l', pre: cut, ans: rest, post: tail, hint: s.y, t });
    } else {
      const core = text.replace(/[。！？”]+$/, '');
      lines.push({ kind: 'l', pre: '', ans: core, post: text.slice(core.length), hint: s.y, t, whole: 1 });
    }
  }
  shuffle(words); shuffle(lines);
  const nl = Math.min(lines.length, Math.ceil(n / 2));
  const out = lines.slice(0, nl).concat(words.slice(0, n - nl));
  if (out.length < n) out.push(...lines.slice(nl, nl + n - out.length));
  return shuffle(out);
}

let quiz = null;
function startQuiz(pane, list, fromReview) {
  const t = list[0];
  const items = makeItems(t);
  const hist = st(t.id)?.hist || [];
  pane.innerHTML = `<div class="quiz-start card" style="margin-top:14px">
      <div class="big">遮字自测 · ${items.length} 题</div>
      <p class="muted small">会遮住关键字词或名句的后半句。先在心里想答案，再点「揭晓」，然后如实选「忘了 / 模糊 / 记得」。</p>
      ${hist.length ? `<p class="muted small">上次：${mdCN(hist[hist.length - 1][0])}，记得 ${Math.round(hist[hist.length - 1][1] * 100)}%</p>` : ''}
      <button class="done-btn" id="qGo" style="margin-bottom:0">开始</button>
    </div>`;
  $('#qGo').onclick = () => { quiz = { t, items, i: 0, score: 0, list, fromReview, pane }; drawQ(); };
}
function drawQ() {
  const q = quiz, it = q.items[q.i], pane = q.pane;
  const prompt = it.kind === 'w'
    ? esc(it.text).replace(esc(it.ans), `<span class="blank" id="ans">${esc(it.ans)}</span>`)
    : `${esc(it.pre)}<span class="blank" id="ans">${esc(it.ans) || ''}</span>${esc(it.post)}`;
  const blankW = it.kind === 'w' ? it.ans.length : Math.min(it.ans.length, 10);
  pane.innerHTML = `<div class="qcard">
      <div class="qbar"><i style="width:${(q.i / q.items.length) * 100}%"></i></div>
      <div class="qhead"><span>${it.kind === 'w' ? '补出遮住的字词' : (it.whole ? '背出这句名句' : '接出名句的后半句')}</span><span>${q.i + 1} / ${q.items.length}</span></div>
      <div class="qtext">${prompt}</div>
      <div id="qh"></div>
      <div class="qfrom">《${esc(q.t.title)}》</div>
      <div class="qbtns" id="qb">
        <button id="hintB">看提示</button>
        <button class="pri" id="showB">揭晓</button>
      </div>
    </div>`;
  const a = $('#ans'); a.style.minWidth = blankW + 'em';
  if (it.kind === 'l' && it.whole) a.style.minWidth = '6em';
  $('#hintB').onclick = e => { $('#qh').innerHTML = `<div class="qhint">${it.kind === 'w' ? '意思：' : '译文：'}${esc(it.hint)}</div>`; e.target.disabled = true; e.target.style.opacity = .4; };
  $('#showB').onclick = () => {
    a.classList.add('show'); a.style.minWidth = '';
    $('#qb').innerHTML = `<button class="b0" data-v="0">忘了</button><button class="b1" data-v="0.5">模糊</button><button class="b2" data-v="1">记得</button>`;
    $('#qb').querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
      q.score += +b.dataset.v; q.i++;
      q.i < q.items.length ? drawQ() : finishQ();
    });
  };
  window.scrollTo(0, Math.max(0, pane.offsetTop - 120));
}
function finishQ() {
  const q = quiz, r = q.score / q.items.length, id = q.t.id;
  const cur = S.texts[id] || { read: Date.now(), box: 0, hist: [] };
  if (!cur.read) cur.read = Date.now();
  let box = cur.box || 0;
  if (r >= 0.8) box = Math.min(box + 1, INTERVALS.length);
  else if (r < 0.5) box = 0;
  const due = box >= INTERVALS.length ? null : addDays(today(), INTERVALS[box]);
  Object.assign(cur, { box, due, last: today(), hist: (cur.hist || []).concat([[today(), Math.round(r * 100) / 100]]).slice(-20) });
  S.texts[id] = cur; save();
  const pct = Math.round(r * 100);
  const cls = r >= 0.8 ? 'good' : r >= 0.5 ? 'mid' : 'low';
  const msg = box >= INTERVALS.length ? '这篇已经掌握了，不再安排复习。'
    : `下次复习：${mdCN(due)}（${INTERVALS[box]} 天后）`;
  const word = r >= 0.8 ? '记得很牢' : r >= 0.5 ? '还有点模糊，间隔不变' : '忘得比较多，明天再来一次';
  const rest = q.fromReview ? dueList().filter(x => x.id !== id) : [];
  q.pane.innerHTML = `<div class="qcard result">
      <div class="score ${cls}">${pct}%</div>
      <p>${word}</p>
      <p class="small muted">${msg}</p>
      ${rest.length ? `<button class="done-btn" id="nextR">下一篇：${esc(rest[0].title)}</button>` : `<button class="done-btn ghost" id="again">再测一次</button>`}
    </div>`;
  const n = $('#nextR'); if (n) n.onclick = () => viewReview(true);
  const ag = $('#again'); if (ag) ag.onclick = () => startQuiz(q.pane, q.list, q.fromReview);
  quiz = null;
}

/* ---------- 复习 ---------- */
function viewReview(auto) {
  const due = dueList();
  const upcoming = TEXTS.filter(t => statusOf(t.id).k === 'wait').sort((a, b) => st(a.id).due < st(b.id).due ? -1 : 1);
  let html = '';
  if (!due.length) {
    html += `<div class="empty"><div class="big">今天没有要复习的</div>${TEXTS.some(t => st(t.id)?.read) ? '按计划来就好。' : '先去「路线」读完一篇，第二天这里会提醒你复习。'}</div>`;
  } else {
    html += `<div class="card"><div class="serif" style="font-size:18px;font-weight:600">今天复习 ${due.length} 篇</div>
      <p class="muted small" style="margin:4px 0 0">每篇约 8 题，两三分钟。按顺序做，做完自动排下一次。</p>
      <div id="rq"></div></div>
      <div class="list" style="margin-top:12px">${due.map(t => `<a class="item" href="#/t/${t.id}/test"><div class="main"><div class="t">${esc(t.title)}</div><div class="m">已复习 ${(st(t.id).hist || []).length} 次</div></div><span class="chip zhu">今天</span></a>`).join('')}</div>`;
  }
  if (upcoming.length) {
    html += `<div class="sec"><h2>之后的安排</h2></div><div class="list">${upcoming.map(t => {
      const s = statusOf(t.id);
      return `<a class="item" href="#/t/${t.id}/text"><div class="main"><div class="t">${esc(t.title)}</div><div class="m">${mdCN(st(t.id).due)} · 第 ${(st(t.id).box || 0) + 1} 轮</div></div><span class="chip amber">${s.label}</span></a>`;
    }).join('')}</div>`;
  }
  shell('复习', html, { tab: 'review' });
  if (due.length) {
    const rq = $('#rq');
    if (auto) startQuiz(rq, due, true), $('#qGo').click();
    else { rq.innerHTML = `<button class="done-btn" id="rgo" style="margin-bottom:0">开始复习《${esc(due[0].title)}》</button>`; $('#rgo').onclick = () => { startQuiz(rq, due, true); $('#qGo').click(); }; }
  }
}

/* ---------- 词句专题 ---------- */
const TOPICS = [['mingju', '名句'], ['chengyu', '成语'], ['tongjia', '通假字'], ['gujin', '古今异义'], ['huoyong', '词类活用'], ['jushi', '特殊句式'], ['duoyi', '一词多义']];
const TOPIC_TYPE = { tongjia: '通假', gujin: '古今异义', huoyong: '词类活用', jushi: '特殊句式' };
const TOPIC_DESC = {
  mingju: '各篇最值得记住的句子，点开回到原文。',
  chengyu: '出自这些文章的成语和常用语。',
  tongjia: '古人用读音相同或相近的字代替本字，读时要按本字理解。',
  gujin: '字面和今天一样，意思却不一样，最容易读错。',
  huoyong: '名词当动词用、"使……""以……为……"等临时改变用法的词。',
  jushi: '宾语前置、定语后置、被动、判断等和现代汉语语序不同的句子。',
  duoyi: '同一个字在不同文章里的不同意思，虚词实词都在内。',
};
const shortT = t => t.title.replace(/（.*）/, '');
function polyIndex() {
  const idx = {};
  for (const t of TEXTS) for (const w of t.words) {
    if ([...w.w].length !== 1) continue;
    const k = w.d.replace(/，指.*$/, '').replace(/（.*?）/g, '');
    ((idx[w.w] = idx[w.w] || {})[k] = idx[w.w][k] || []).push({ ex: w.ex, t, type: w.t });
  }
  for (const c of Object.keys(idx)) if (Object.keys(idx[c]).length < 2) delete idx[c];
  return idx;
}
function viewTopics(key, sel) {
  if (!TOPIC_DESC[key]) key = 'mingju';
  let html = `<div class="chips">${TOPICS.map(([k, n]) => `<a href="#/zt/${k}" class="${k === key ? 'on' : ''}">${n}</a>`).join('')}</div>
    <p class="muted small" style="margin:10px 0 12px">${TOPIC_DESC[key]}</p>`;
  if (key === 'mingju') {
    for (const t of TEXTS) {
      const ms = t.paras.flat().filter(s => s.m); if (!ms.length) continue;
      html += `<div class="card topic"><a class="tt" href="#/t/${t.id}/text">《${esc(shortT(t))}》<small>${esc(t.author)}</small></a>${ms.map(s => `<div class="mj"><div class="mq">${esc(plainOf(s))}</div><div class="my">${esc(s.y)}</div></div>`).join('')}</div>`;
    }
  } else if (key === 'chengyu') {
    const all = TEXTS.flatMap(t => (t.idioms || []).map(x => ({ x, t })));
    html += `<div class="wl">${all.map(({ x, t }) => `<div class="wrow"><div class="wb"><div class="wh"><b>${esc(x.w)}</b><a class="src" href="#/t/${t.id}/text">《${esc(shortT(t))}》</a></div><div class="wd">${esc(x.d)}</div><div class="wex">原句：${esc(x.ex)}</div></div></div>`).join('')}</div>`;
  } else if (key === 'duoyi') {
    const idx = polyIndex();
    const order = ['之', '其', '而', '以', '于', '为', '乃', '焉', '者', '乎', '则', '夫', '若', '所'];
    const chars = Object.keys(idx).sort((a, b) => ((order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)) || Object.keys(idx[b]).length - Object.keys(idx[a]).length);
    if (!sel || !idx[sel]) sel = chars[0];
    html += `<div class="xgrid">${chars.map(c => `<button data-c="${esc(c)}" class="${c === sel ? 'on' : ''}">${esc(c)}<small>${Object.keys(idx[c]).length}</small></button>`).join('')}</div>
      <div class="sec"><h2 class="serif">“${esc(sel)}”</h2><span class="num">${Object.keys(idx[sel]).length} 种意思</span></div>`;
    for (const [d, exs] of Object.entries(idx[sel])) {
      html += `<div class="card xsense"><h4>${esc(d)}<span class="tag">${esc(exs[0].type)}</span></h4>${exs.map(e => `<div class="ex"><span class="q">${hl(e.ex, sel)}</span><a href="#/t/${e.t.id}/text">${esc(shortT(e.t))}</a></div>`).join('')}</div>`;
    }
  } else {
    const ty = TOPIC_TYPE[key];
    for (const t of TEXTS) {
      const ws = wordsInOrder(t).filter(w => w.t === ty); if (!ws.length) continue;
      html += `<div class="card topic"><a class="tt" href="#/t/${t.id}/text">《${esc(shortT(t))}》<small>${ws.length} 条</small></a>${ws.map(w => `<div class="tw"><b>${esc(w.w)}</b>　${esc(w.d)}<div class="wex">${hl(w.ex, w.w)}</div></div>`).join('')}</div>`;
    }
  }
  shell('词句专题', html, { tab: 'zt' });
  app.querySelectorAll('[data-c]').forEach(b => b.onclick = () => history.replaceState(null, '', '#/zt/duoyi/' + encodeURIComponent(b.dataset.c)) || viewTopics('duoyi', b.dataset.c));
  const on = $('.chips .on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
}

/* ---------- 我的 ---------- */
function viewMe() {
  const read = TEXTS.filter(t => st(t.id)?.read).length;
  const done = TEXTS.filter(t => statusOf(t.id).k === 'done').length;
  const tests = Object.values(S.texts).reduce((a, x) => a + (x.hist || []).length, 0);
  const theme = localStorage.getItem('yw.theme') || 'auto';
  const bk = S.backupAt ? `${mdCN(ymd(new Date(S.backupAt)))}` : '还没备份过';
  const html = `
    <div class="stats">
      <div class="card"><div class="v">${read}</div><div class="k">已读 / ${TEXTS.length}</div></div>
      <div class="card"><div class="v">${tests}</div><div class="k">自测次数</div></div>
      <div class="card"><div class="v">${done}</div><div class="k">已掌握</div></div>
    </div>
    <div class="sec"><h2>阅读</h2></div>
    <div class="list">
      <div class="row2"><div class="l">默认显示注音</div><div class="r"><div class="seg"><button data-py="1" class="${S.settings.py ? 'on' : ''}">开</button><button data-py="0" class="${S.settings.py ? '' : 'on'}">关</button></div></div></div>
      <div class="row2"><div class="l">原文字号</div><div class="r"><div class="seg">${[17, 19, 22].map(n => `<button data-fs="${n}" class="${S.settings.fs === n ? 'on' : ''}">${n === 17 ? '小' : n === 19 ? '中' : '大'}</button>`).join('')}</div></div></div>
      <div class="row2"><div class="l">外观</div><div class="r"><div class="seg">${[['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([k, n]) => `<button data-th="${k}" class="${theme === k ? 'on' : ''}">${n}</button>`).join('')}</div></div></div>
    </div>
    <div class="sec"><h2>备份</h2><span class="num">上次：${bk}</span></div>
    <div class="list">
      <div class="row2"><div class="l">导出备份<div class="s2">阅读进度和复习安排存成一个文件，可存到「文件」或发到微信</div></div><div class="r"><button class="btn zhu" id="exp">导出</button></div></div>
      <div class="row2"><div class="l">导入备份<div class="s2">换手机或误删后，用备份文件恢复</div></div><div class="r"><button class="btn" id="imp">导入</button></div></div>
      <div class="row2"><div class="l">恢复到某一天<div class="s2">本机自动保留最近 7 天的记录</div></div><div class="r"><button class="btn" id="snap">查看</button></div></div>
    </div>
    <input type="file" id="file" accept="application/json,.json" style="display:none">
    <div class="sec"><h2>关于</h2><span class="num">版本 ${VERSION}</span></div>
    <div class="card about">
      <p>「一苇」取自《诗经·河广》"谁谓河广？一苇杭之"——谁说河太宽，一叶苇舟就能渡过去。也取《前赤壁赋》"纵一苇之所如"。</p>
      <p>原文据开源项目 Ancient-China-Books/guwenguanzhi 所收吴楚材、吴调侯原本校对，篇目标题对照中华书局 2008 年版（葛兆光题解、戴燕注解）；遇课本通行写法不同处在注释中说明。导读、注释和译文为本 App 编写。</p>
      <p>已上线 ${TEXTS.length} 篇${TEXTS.length < CAT.list.length ? `，其余 ${CAT.list.length - TEXTS.length} 篇正在整理` : '，三个阶段全部完成'}。</p>
      <button class="btn" id="upd" style="margin-top:4px">检查更新</button>
    </div>`;
  shell('我的', html, { tab: 'me' });
  app.querySelectorAll('[data-py]').forEach(b => b.onclick = () => { S.settings.py = b.dataset.py === '1'; save(); viewMe(); });
  app.querySelectorAll('[data-fs]').forEach(b => b.onclick = () => { S.settings.fs = +b.dataset.fs; save(); viewMe(); });
  app.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { localStorage.setItem('yw.theme', b.dataset.th); applyTheme(); viewMe(); });
  $('#exp').onclick = exportBackup;
  $('#imp').onclick = () => $('#file').click();
  $('#file').onchange = importBackup;
  $('#snap').onclick = showSnaps;
  $('#upd').onclick = () => checkUpdate(true);
}

async function exportBackup() {
  const data = JSON.stringify({ app: 'yiwei', version: VERSION, at: new Date().toISOString(), state: S }, null, 1);
  const name = `yiwei-backup-${today()}.json`;
  const file = new File([data], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: '一苇备份' });
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    S.backupAt = Date.now(); save(); toast('备份已导出'); viewMe();
  } catch (e) { if (e && e.name !== 'AbortError') toast('导出没有完成'); }
}
function importBackup(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (d.app !== 'yiwei' || !d.state) throw 0;
      if (!confirm(`用 ${d.at.slice(0, 10)} 的备份替换当前记录？`)) return;
      S = Object.assign(load(), d.state); save(); toast('已恢复'); viewMe();
    } catch (x) { toast('这不是一苇的备份文件'); }
  };
  r.readAsText(f);
}
function showSnaps() {
  let snaps = [];
  try { snaps = JSON.parse(localStorage.getItem(SNAP) || '[]'); } catch (e) {}
  if (snaps.length < 2) return toast('还没有更早的记录');
  const list = snaps.slice(1).map((x, i) => `${i + 1}. ${mdCN(x.d)}`).join('\n');
  const pick = prompt(`输入编号，恢复到那天的记录：\n${list}`);
  const x = snaps.slice(1)[+pick - 1];
  if (!x) return;
  S = Object.assign(load(), JSON.parse(x.s)); save(); toast(`已恢复到 ${mdCN(x.d)}`); viewMe();
}

/* ---------- 杂项 ---------- */
let tt;
function toast(m) {
  let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = m; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2200);
}
function applyTheme() {
  const t = localStorage.getItem('yw.theme') || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

// 自动更新：打开或切回 App 时检查，有新版本就直接换；正在自测时等做完再换
let pendingReload = false;
async function checkUpdate(manual) {
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json());
    if (r.version !== VERSION) {
      if (quiz) { pendingReload = true; return; }
      toast('发现新版本，正在更新…');
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.update().catch(() => {});
      setTimeout(() => location.reload(), 700);
    } else if (manual) toast('已经是最新版本');
  } catch (e) { if (manual) toast('现在连不上网络'); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
setInterval(() => { if (pendingReload && !quiz) location.reload(); }, 3000);

async function boot() {
  applyTheme();
  const [texts, cat] = await Promise.all([
    fetch('data/texts.json').then(r => r.json()),
    fetch('data/catalog.json').then(r => r.json()),
  ]);
  TEXTS = cat.list.map(x => texts.find(t => t.id === x.id)).filter(Boolean);
  CAT = cat;
  TEXTS.forEach(t => BYID[t.id] = t);
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  checkUpdate();
}
boot().catch(e => { app.innerHTML = `<div class="empty"><div class="big">加载失败</div>请检查网络后重新打开。</div>`; });
