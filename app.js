/* 一苇 · 古文观止入门 */
const VERSION = '1.0.0';
const KEY = 'yw.state.v1';
const SNAP = 'yw.snaps.v1';
const INTERVALS = [1, 2, 4, 7, 15, 30]; // 复习间隔（天），第 6 轮后算掌握
const XUCI = ['之', '其', '而', '以', '于', '乃', '焉', '者', '也', '乎', '为', '则', '夫', '若', '所', '欤', '诸', '尔', '见', '且'];
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
  return Object.assign({ texts: {}, settings: { py: true, fs: 19 }, last: null, backupAt: null }, s || {});
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
  if (p === 'xuci') return viewXuci(a ? decodeURIComponent(a) : null);
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
      <a href="#/xuci" class="${tab === 'xuci' ? 'on' : ''}">${ICON.xu}虚词</a>
      <a href="#/me" class="${tab === 'me' ? 'on' : ''}">${ICON.me}我的</a>
    </nav>`;
  const b = $('[data-back]');
  if (b) b.onclick = () => (history.length > 1 && sessionStorage.getItem('yw.inapp')) ? history.back() : go(b.dataset.back);
  window.scrollTo(0, 0);
}

/* ---------- 首页：路线 ---------- */
function viewHome() {
  const due = dueList();
  const readN = TEXTS.filter(t => st(t.id)?.read).length;
  const last = S.last && BYID[S.last] ? BYID[S.last] : null;
  const next = TEXTS.find(t => !st(t.id)?.read);
  const cont = last && !st(last.id)?.read ? last : (next || last);
  let html = `<div class="today">
    <a class="card ${due.length ? 'due' : ''}" href="#/review">
      <span class="k">今天要复习</span>
      <span class="v">${due.length} <small>篇</small></span>
    </a>
    ${cont ? `<a class="card" href="#/t/${cont.id}/${st(cont.id)?.read ? 'text' : 'intro'}">
      <span class="k">${st(cont.id)?.read ? '再读一遍' : (readN ? '接着读' : '从这篇开始')}</span>
      <span class="v serif">${esc(cont.title.replace(/（.*）/, ''))}</span>
    </a>` : ''}
  </div>`;
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
}

/* ---------- 篇章页 ---------- */
function viewText(t, tab) {
  S.last = t.id; save();
  sessionStorage.setItem('yw.inapp', '1');
  const s = statusOf(t.id);
  const tabs = [['intro', '导读'], ['text', '原文'], ['words', '字词'], ['test', '自测']];
  let body = `<div class="hero">
      <div class="vt">${esc(t.title.replace(/（.*）/, ''))}</div>
      <div class="meta">
        <div class="tags"><span class="chip">${esc(t.juan)}</span><span class="chip">${esc(t.genre)}</span><span class="chip">${t.chars} 字</span>${s.k !== 'new' ? `<span class="chip ${s.cls}">${s.label}</span>` : ''}</div>
        <div class="a">${esc(t.dynasty)} · ${esc(t.author)}</div>
        <div class="gist">${esc(t.intro.gist || '')}</div>
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

function sentHTML(s, pi, si) {
  const inner = s.t.map(p => {
    if (typeof p === 'string') return esc(p);
    const cls = p.tj ? ' class="tj"' : '';
    return p.py ? `<ruby${cls}>${esc(p.c)}<rt>${esc(p.py)}</rt></ruby>` : `<span${cls}>${esc(p.c)}</span>`;
  }).join('');
  return `<span class="s${s.m ? ' m' : ''}" data-s="${pi}.${si}">${inner}</span>`;
}
function noteHTML(s) {
  const tjs = s.t.filter(p => typeof p !== 'string' && p.tj);
  return `<div class="note"><div class="y">${esc(s.y)}</div>${s.n.length ? `<dl>${s.n.map(n => `<div class="row"><dt>${esc(n.w)}</dt><dd>：${esc(n.d)}</dd></div>`).join('')}</dl>` : ''}</div>`;
}

let showAllY = false;
function paneText(t, pane) {
  const s = statusOf(t.id);
  const read = st(t.id)?.read;
  pane.innerHTML = `
    <div class="tools">
      <button class="tog ${S.settings.py ? 'on' : ''}" id="tPy">注音</button>
      <button class="tog ${showAllY ? 'on' : ''}" id="tY">全文译文</button>
      <span class="sp"></span>
      <button class="tog" id="fsM" aria-label="字号缩小">A−</button>
      <button class="tog" id="fsP" aria-label="字号放大">A＋</button>
    </div>
    <div class="hint">点任意一句，看注释和译文。朱砂下划线是名句。</div>
    <div class="wen ${S.settings.py ? '' : 'nopy'}" id="wen" style="--fs:${S.settings.fs}px"></div>
    ${read
      ? `<button class="done-btn ghost" disabled>已读 · ${esc(s.label)}</button>`
      : `<button class="done-btn" id="doneBtn">读完了，安排复习</button>`}
    <div class="hint" style="text-align:center">读完后会在明天提醒你第一次复习，之后间隔逐渐拉长。</div>`;
  const wen = $('#wen');
  const draw = () => {
    wen.innerHTML = t.paras.map((p, pi) => `<p>${p.map((x, si) => sentHTML(x, pi, si)).join('')}</p>` +
      (showAllY ? `<div class="para-y">${esc(p.map(x => x.y).join(''))}</div>` : '')).join('');
  };
  draw();
  let open = null;
  wen.onclick = e => {
    const el = e.target.closest('.s'); if (!el) return;
    wen.querySelectorAll('.note').forEach(n => n.remove());
    wen.querySelectorAll('.s.on').forEach(n => n.classList.remove('on'));
    if (open === el.dataset.s) { open = null; return; }
    open = el.dataset.s;
    const [pi, si] = open.split('.').map(Number);
    el.classList.add('on');
    const p = el.closest('p');
    const after = showAllY ? p.nextElementSibling : p;
    after.insertAdjacentHTML('afterend', noteHTML(t.paras[pi][si]));
  };
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

function paneWords(t) {
  const groups = {};
  for (const w of t.words) (groups[w.t] = groups[w.t] || []).push(w);
  let html = '';
  for (const k of TYPE_ORDER) {
    if (!groups[k]) continue;
    html += `<div class="wgroup"><h3>${k} · ${groups[k].length}</h3>` +
      groups[k].map(w => `<div class="wcard"><div class="w">${esc(w.w)}</div><div class="d">${esc(w.d)}<div class="ex">${hl(w.ex, w.w)}</div></div></div>`).join('') + '</div>';
  }
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

/* ---------- 虚词手册 ---------- */
function xuciIndex() {
  const idx = {};
  for (const t of TEXTS) for (const w of t.words) {
    if (w.t !== '虚词') continue;
    const c = w.w;
    const k = w.d.replace(/，指.*$/, '');
    ((idx[c] = idx[c] || {})[k] = idx[c][k] || []).push({ ex: w.ex, t });
  }
  return idx;
}
function viewXuci(sel) {
  const idx = xuciIndex();
  const chars = XUCI.filter(c => idx[c]).concat(Object.keys(idx).filter(c => !XUCI.includes(c)));
  if (!sel || !idx[sel]) sel = chars[0];
  const count = c => Object.values(idx[c]).reduce((a, b) => a + b.length, 0);
  let html = `<p class="muted small" style="margin:0 0 12px">从已收录各篇中汇总常见虚词的用法，点一个字查看。</p>
    <div class="xgrid">${chars.map(c => `<button data-c="${esc(c)}" class="${c === sel ? 'on' : ''}">${esc(c)}<small>${count(c)}</small></button>`).join('')}</div>
    <div class="sec"><h2 class="serif">“${esc(sel)}”</h2><span class="num">${Object.keys(idx[sel]).length} 种用法</span></div>`;
  for (const [d, exs] of Object.entries(idx[sel])) {
    html += `<div class="card xsense"><h4>${esc(d)}</h4>${exs.map(e => `<div class="ex"><span class="q">${hl(e.ex, sel)}</span><a href="#/t/${e.t.id}/text">${esc(e.t.title.replace(/（.*）/, ''))}</a></div>`).join('')}</div>`;
  }
  shell('虚词', html, { tab: 'xuci' });
  app.querySelectorAll('[data-c]').forEach(b => b.onclick = () => history.replaceState(null, '', '#/xuci/' + encodeURIComponent(b.dataset.c)) || viewXuci(b.dataset.c));
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
      <p>第一阶段 12 篇已上线，第二、三阶段正在整理。</p>
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
