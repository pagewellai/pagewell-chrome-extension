// 阅读页的渐进增强。
//
// 前提：没有这个文件页面也必须完整可读。这里只加三件事 ——
// 侧栏抽屉、目录高亮、复制按钮。任何一件失败都不该影响正文。
(() => {
  'use strict';

  // ---- 读者的开关：明暗 ----
  //
  // 它是**读者的**偏好，不是作者的设定 —— 和浏览器的字号缩放同一类东西。
  // 所以它落在 <html> 上，而不是文档容器上：容器上那些是作者冻进去的
  // 设计快照，读者的选择不该混进那一份。
  //
  // 曾经还有一个「阅读宽度」开关（2026-09-15 去掉）：版心改成散文停在行长、
  // 其余撑满整栏之后，「加宽」只剩「散文也不限行长」这一个意思，170 个英文
  // 字符一行没人读得动，开关就成了一个只会把页面弄坏的按钮。旧的
  // localStorage 里可能还存着 width，读的时候直接丢掉。
  //
  // ⚠️ 首次上色由 <head> 里那段极短的脚本做（render.PrefsScript），
  // 不在这里 —— 这个文件在 </body> 之前才跑，那时候页面已经画过一次了，
  // 而「先白一下再变黑」是所有明暗切换里最难看的一个瑕疵。
  // 这里只负责画按钮和处理点击。
  const THEMES = ['', 'light', 'dark'];   // '' = 跟随系统
  const THEME_LABEL = { '': 'System', light: 'Light', dark: 'Dark' };

  const PREFS_KEY = 'pw:prefs';
  const readPrefs = () => {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch { /* 存不了就是没存 */ }
    // 存下来的值要当**外部输入**看：它可能是上一版写的、别的标签页写的，
    // 或者有人手改的。不归一的话 ICON[cur] 会是 undefined，
    // 按钮上就真的印出 "undefined" —— 而那看起来像页面坏了。
    return {
      theme: THEMES.includes(raw.theme) ? raw.theme : '',
    };
  };
  const writePrefs = (p) => {
    // file:// 下有些浏览器直接抛异常。一个存不下偏好的页面照样能用，
    // 所以吞掉它 —— 但不要因此不设属性：本次会话仍然该生效。
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* 无痕模式等 */ }
  };

  const applyPrefs = (p) => {
    const el = document.documentElement;
    if (p.theme) el.dataset.theme = p.theme; else delete el.dataset.theme;
  };

  const ICON = {
    system: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8"/></svg>',
    light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>',
    dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13a8 8 0 1 1-9-9 6.5 6.5 0 0 0 9 9z"/></svg>',
  };

  function mountPrefs() {
    // 阅读页的 ⋯ 菜单里留了一个槽（.pw-prefs-slot，标签由服务端翻译好挂在 data-l-* 上）：
    // 有槽就挂成一行带文字的菜单项；没有（独立导出的那份文件、插件就地渲染的页面）
    // 就退回一枚图标按钮，接在顶栏动作后面，没有顶栏时自己浮在右上角。
    const slot = document.querySelector('.pw-prefs-slot');
    const host = slot || document.querySelector('.pw-actions') || document.body;
    if (document.querySelector('.pw-prefs')) return;
    const bar = document.createElement('div');
    bar.className = 'pw-prefs' + (slot ? ' is-menu' : '');
    const L = (k, fallback) => (slot && slot.dataset['l' + k.charAt(0).toUpperCase() + k.slice(1)]) || fallback;
    const label = (text) => { const s = document.createElement('span'); s.textContent = text; return s; };

    const prefs = readPrefs();
    applyPrefs(prefs);

    const theme = document.createElement('button');
    theme.type = 'button';
    theme.dataset.pref = 'theme';
    const drawTheme = () => {
      const cur = prefs.theme || '';
      const state = L(cur || 'system', THEME_LABEL[cur]);
      theme.innerHTML = ICON[cur || 'system'];
      theme.title = L('appearance', 'Appearance') + ': ' + state;
      theme.setAttribute('aria-label', theme.title);
      theme.setAttribute('aria-pressed', String(cur !== ''));
      if (slot) theme.append(label(L('appearance', 'Appearance') + ' · ' + state));
    };
    theme.addEventListener('click', () => {
      prefs.theme = THEMES[(THEMES.indexOf(prefs.theme || '') + 1) % THEMES.length];
      applyPrefs(prefs); writePrefs(prefs); drawTheme();
    });
    drawTheme();

    bar.append(theme);
    host.appendChild(bar);
  }
  mountPrefs();

  // ---- ⋯ 菜单：点外面关，选了动作也关（偏好开关除外 —— 可能想连着切） ----
  const more = document.querySelector('.pw-more');
  if (more) {
    document.addEventListener('click', (e) => {
      if (!more.open) return;
      if (!more.contains(e.target)) { more.removeAttribute('open'); return; }
      const hit = e.target.closest('.pw-more-pop a, .pw-more-pop button');
      if (hit && !hit.dataset.pref && !hit.dataset.copy) more.removeAttribute('open');
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') more.removeAttribute('open'); });
  }

  // ---- 沙箱制品：高度跟着内容走 + 全屏（ReaderSandbox 画板） ----
  //
  // 沙箱那边的 frame.js 用 postMessage 报文档高度，这里照着把 iframe 拉到那么高：
  // 内容区自己不出现垂直滚动条，整篇都露出来，再高就整页滚。
  // 消息只认「来自这个 iframe」的，而且只拿一个数字 —— 沙箱里的内容是别人写的。
  const frame = document.querySelector('.pw-frame');
  const wrap = frame && frame.closest('.pw-frame-wrap');
  if (frame && wrap) {
    let lastDelta = 0, sameDelta = 0;
    window.addEventListener('message', (e) => {
      if (e.source !== frame.contentWindow || !e.data || e.data.type !== 'pagewell:height') return;
      // 沙箱顺带报了各标题的位置（页内目录要它）。沙箱里的内容是别人写的：
      // 只收「短字符串 + 有限数」这一种形状，多一个字段都不看。
      if (Array.isArray(e.data.anchors)) {
        const anchors = [];
        for (const a of e.data.anchors.slice(0, 500)) {
          if (a && typeof a.id === 'string' && a.id.length <= 300 && Number.isFinite(a.top)) anchors.push({ id: a.id, top: a.top });
        }
        frame.dispatchEvent(new CustomEvent('pagewell:anchors', { detail: anchors }));
      }
      const h = Math.ceil(Number(e.data.height));
      if (!(h > 0) || document.fullscreenElement || document.documentElement.classList.contains('is-fullscreen')) return;
      const delta = h - frame.getBoundingClientRect().height;
      if (Math.abs(delta) < 2) return;
      // 跟着视口高度走的布局（height: 100vh 再加一点）会在每次调高之后再报高同样的量：
      // 那不是内容变多，是布局在追我们。同一个增量连着来两次就停手。
      if (delta > 0 && Math.abs(delta - lastDelta) < 2) {
        if (++sameDelta >= 2) return;
      } else {
        sameDelta = 0;
      }
      lastDelta = delta;
      frame.style.height = Math.max(h, 160) + 'px';
      wrap.classList.add('is-sized');
    });
    // 喊一声让沙箱把高度和标题位置报过来：它从缓存里来得比这段脚本还早时，第一次报的没人收。
    // 现在喊一次（它已经加载好就会应），load 之后再喊一次（现在喊时它可能还是空白页）。
    const sync = () => { try { frame.contentWindow.postMessage({ type: 'pagewell:sync' }, '*'); } catch { /* 还没有窗口 */ } };
    sync();
    frame.addEventListener('load', sync);

    // 全屏：只把内容那一块放到整块屏幕上。原生 Fullscreen API 优先，没有（iOS Safari）就固定定位兜底。
    const fsBtn = document.querySelector('[data-fullscreen]');
    if (fsBtn) {
      const root = document.documentElement;
      const labelOn = fsBtn.getAttribute('aria-label'), labelOff = fsBtn.dataset.lExit || labelOn;
      let exitBtn = null;
      const setState = (on) => {
        fsBtn.setAttribute('aria-pressed', String(on));
        fsBtn.setAttribute('aria-label', on ? labelOff : labelOn);
        fsBtn.title = on ? labelOff : labelOn;
      };
      const fallbackOff = () => {
        root.classList.remove('is-fullscreen');
        if (exitBtn) { exitBtn.remove(); exitBtn = null; }
        setState(false);
      };
      const fallbackOn = () => {
        root.classList.add('is-fullscreen');
        exitBtn = document.createElement('button');
        exitBtn.type = 'button';
        exitBtn.className = 'pw-fs-exit';
        exitBtn.textContent = labelOff + ' · Esc';
        exitBtn.addEventListener('click', fallbackOff);
        wrap.appendChild(exitBtn);
        setState(true);
      };
      fsBtn.addEventListener('click', () => {
        if (document.fullscreenElement) { document.exitFullscreen(); return; }
        if (root.classList.contains('is-fullscreen')) { fallbackOff(); return; }
        if (wrap.requestFullscreen) {
          wrap.requestFullscreen().then(() => setState(true)).catch(fallbackOn);
        } else {
          fallbackOn();
        }
      });
      document.addEventListener('fullscreenchange', () => setState(!!document.fullscreenElement));
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && root.classList.contains('is-fullscreen')) fallbackOff();
      });
    }
  }

  // ---- 侧栏抽屉（窄屏） ----
  const btn = document.querySelector('.pw-menu');
  const nav = document.getElementById('pw-nav');
  if (btn && nav) {
    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    });
    // 点了链接就收起来，否则在手机上会挡住刚跳过去的内容
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) nav.classList.remove('is-open');
    });
  }

  // ---- 页内目录（ReaderOutline 画板） ----
  //
  // 标题的位置有两个来源：正文就在这页上时直接量 DOM；沙箱文档的标题在跨源 iframe 里，
  // 这页看不见它们，由 frame.js 随高度一起把「锚 → 距文档顶部多少」报上来，这里加上
  // iframe 自己的位置。以前的做法是把 href="#锚" 交给浏览器，沙箱那一路根本落不到。
  // 当前一节 = 最后一个已经滚过顶栏那条线的标题；滚到底就是最后一节。
  const toc = document.querySelector('.pw-toc');
  const links = toc ? [...toc.querySelectorAll('a[href^="#"]')] : [];
  if (links.length) {
    const byId = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frameAnchors = null;
    const topOffset = () => (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--h-top')) || 54) + 16;
    // 正文里没写 id 的标题：目录里的锚是摄取时按文字算的 slug（render/extract.go 的
    // ensureAnchor），这里照同一条规则在 DOM 上再算一遍找到它 —— 和 frame.js 里那份
    // 是同一段逻辑；改一处就要改三处。
    const slug = (t) => t.toLowerCase().replace(/[^\p{L}\p{Nd}]+/gu, '-').replace(/^-+|-+$/g, '');
    let resolved;
    const headingFor = (id) => {
      const direct = document.getElementById(id);
      if (direct) return direct;
      if (!resolved) {
        resolved = new Map();
        const seen = new Map();
        for (const h of document.querySelectorAll('.pw-body :is(h1, h2, h3, h4, h5, h6)')) {
          if (h.getAttribute('data-toc') === 'skip') continue;
          const text = (h.textContent || '').replace(/\s+/g, ' ').trim();
          if (!text) continue;
          let key = h.id;
          if (!key) {
            const base = slug(text) || 'section';
            const n = (seen.get(base) || 0) + 1;
            seen.set(base, n);
            key = n > 1 ? base + '-' + n : base;
          }
          if (!resolved.has(key)) resolved.set(key, h);
        }
      }
      return resolved.get(id);
    };
    // 文档顺序里每个目录条目的绝对位置（页面坐标）
    const positions = () => {
      if (frame) {
        if (!frameAnchors) return [];
        const base = frame.getBoundingClientRect().top + window.scrollY;
        return frameAnchors.filter((a) => byId.has(a.id)).map((a) => ({ id: a.id, top: base + a.top }));
      }
      const out = [];
      for (const id of byId.keys()) {
        const h = headingFor(id);
        if (h && h.getClientRects().length) out.push({ id, top: h.getBoundingClientRect().top + window.scrollY });
      }
      return out;
    };
    let current;
    const mark = (id) => {
      if (id === current) return;
      current = id;
      for (const a of links) {
        const on = a === byId.get(id);
        a.classList.toggle('is-current', on);
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      }
      // 目录自己太长时把当前条目滚进可见范围 —— 只滚目录那一层（.pw-toc-in 是钉住且会滚的那层），不动页面
      const a = byId.get(id);
      const pane = toc.querySelector('.pw-toc-in') || toc;
      if (a && pane.scrollHeight > pane.clientHeight) {
        const top = a.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
        const bottom = top + a.offsetHeight;
        if (top < pane.scrollTop + 24) pane.scrollTop = Math.max(0, top - 24);
        else if (bottom > pane.scrollTop + pane.clientHeight - 24) pane.scrollTop = bottom - pane.clientHeight + 24;
      }
    };
    // 刚点过的那一条钉住一会儿：短文档里目标一节到不了顶栏那条线（页面已经到底），
    // 按位置算会立刻点亮别的一条，人刚点的东西不该被抢走。之后一滚动就照常算。
    let pinned, pinTimer;
    const spy = () => {
      if (pinned) { mark(pinned); return; }
      const list = positions();
      if (!list.length) return;
      const line = window.scrollY + topOffset() + 1;
      let hit;
      for (const p of list) { if (p.top <= line) hit = p.id; else break; }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) hit = list[list.length - 1].id;
      mark(hit);
    };
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; spy(); });
    };
    const jump = (id, smooth) => {
      const p = positions().find((x) => x.id === id);
      if (!p) return false;
      window.scrollTo({ top: Math.max(0, p.top - topOffset()), behavior: smooth && !reduced ? 'smooth' : 'auto' });
      return true;
    };
    toc.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const id = decodeURIComponent(a.hash.slice(1));
      // 位置不知道（沙箱还没报、标题被藏起来了）就交给浏览器，至少行为和普通链接一样
      if (!jump(id, true)) return;
      e.preventDefault();
      history.replaceState(null, '', '#' + a.hash.slice(1));
      pinned = id;
      clearTimeout(pinTimer);
      pinTimer = setTimeout(() => { pinned = undefined; }, 1000);
      mark(id);
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    if (frame) {
      let landed = false;
      // 地址栏里改 # 或前进后退：浏览器自己找不到沙箱里的标题，照目录的路子跳
      window.addEventListener('hashchange', () => {
        if (location.hash.length > 1) jump(decodeURIComponent(location.hash.slice(1)), false);
      });
      frame.addEventListener('pagewell:anchors', (e) => {
        frameAnchors = e.detail;
        // 带着 #锚 打开的沙箱文档：第一次知道位置就跳过去（等 iframe 拉高之后的那一拍）
        if (!landed && location.hash.length > 1) {
          landed = true;
          requestAnimationFrame(() => jump(decodeURIComponent(location.hash.slice(1)), false));
        }
        spy();
      });
    } else {
      spy();
    }
  }

  // ---- 复制 ----
  const source = document.querySelector('[data-copy-source]');
  const flash = (el, msg) => {
    const old = el.textContent;
    el.textContent = msg;
    setTimeout(() => { el.textContent = old; }, 1400);
  };

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const kind = b.dataset.copy;
    try {
      if (kind === 'rich' && source && window.ClipboardItem && navigator.clipboard?.write) {
        // 富文本走 ClipboardItem，粘进 Notion / 飞书 / Word 才能保住格式。
        // 同时带一份 text/plain flavor，给不认 HTML 的目标兜底。
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([source.innerHTML], { type: 'text/html' }),
          'text/plain': new Blob([source.innerText], { type: 'text/plain' }),
        })]);
      } else {
        const url = new URL(location.href);
        url.searchParams.set('as', kind === 'markdown' ? 'markdown' : 'text');
        const res = await fetch(url, { headers: { Accept: 'text/plain' } });
        if (!res.ok) throw new Error(String(res.status));
        await navigator.clipboard.writeText(await res.text());
      }
      flash(b, b.ownerDocument.documentElement.lang.startsWith('zh') ? '已复制' : 'Copied');
      b.closest('details')?.removeAttribute('open');
    } catch (err) {
      // 剪贴板 API 在非安全上下文里会直接抛。告诉用户实情，
      // 而不是假装成功
      flash(b, '⌘C');
      console.warn('copy failed', err);
    }
  });

  document.querySelector('[data-print]')?.addEventListener('click', () => window.print());

  // ---- 沙箱 iframe 自适应高度 ----
  // 沙箱是跨源的，读不到内容高度，所以只能由 iframe 内部主动 postMessage。
  // 收不到就保持 CSS 里的 min-height —— 不猜、不轮询。
  window.addEventListener('message', (e) => {
    const frame = document.querySelector('.pw-frame');
    if (!frame || e.source !== frame.contentWindow) return;
    const h = Number(e.data?.pagewellHeight);
    if (Number.isFinite(h) && h > 0 && h < 200000) frame.style.height = h + 'px';
  });
})();

/* ══════════════════════════════════════════════════════════════════════
   v0.2：行为原语、按需加载库、embed 激活
   docs/TEMPLATES.md §6.5 / §6.6
   ══════════════════════════════════════════════════════════════════════

   这一整段的前提和文件顶部那句是同一句：**没有这个文件页面也必须完整可读。**

   落到具体做法上只有一条：
     所有状态的内容都在 DOM 里，这里只决定显示哪一个。
   代码里到处是 el.hidden = true 与 classList.add('pw-step-hidden')，
   而**没有一处 remove()**。谁想「顺手清理一下 DOM」，请先回答
   「爬虫、屏幕阅读器、Ctrl-F 会看到什么」。 */
(() => {
  'use strict';

  const root = document.querySelector('[data-pw-doc]') || document.querySelector('.pw-body');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches ||
                 (root && root.dataset.motion === 'off');

  const onView = (el, fn, opts) => {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { fn(); io.disconnect(); }
    }, opts || { rootMargin: '0px 0px -12% 0px' });
    io.observe(el);
  };

  /* ---------------------------------------------------------------- 行为原语
     白名单是硬编码的，而且必须与 render/behavior.go 一致。
     不在表里的名字**当没写** —— 那是模板作者写的数据，
     而一个我们不认识的行为名只可能是拼错或者试探。 */
  const behaviors = {
    reveal(el) {
      if (reduce) return;
      el.classList.add('is-ready');
      onView(el, () => el.classList.add('is-in'));
    },

    steps(el) {
      const items = [...el.querySelectorAll('li, .pw-c > * > .step, [data-step]')]
        .filter((n) => n.parentElement.children.length > 1);
      if (items.length < 2) return;
      el.classList.add('is-ready');
      let at = 0;
      const nav = document.createElement('div');
      nav.className = 'pw-steps-nav';
      nav.innerHTML = '<button type="button" data-prev>Back</button>' +
        '<button type="button" data-next>Next</button>' +
        '<span class="pw-steps-count"></span><span class="pw-steps-dots"></span>';
      const dots = nav.querySelector('.pw-steps-dots');
      items.forEach(() => dots.appendChild(document.createElement('i')));
      el.appendChild(nav);
      const count = nav.querySelector('.pw-steps-count');
      const prev = nav.querySelector('[data-prev]');
      const next = nav.querySelector('[data-next]');
      const draw = () => {
        items.forEach((n, i) => {
          n.classList.toggle('pw-step-hidden', i > at);
          if (i === at) n.setAttribute('aria-current', 'step');
          else n.removeAttribute('aria-current');
        });
        [...dots.children].forEach((d, i) => d.classList.toggle('is-on', i <= at));
        count.textContent = `${at + 1} / ${items.length}`;
        prev.disabled = at === 0;
        next.disabled = at === items.length - 1;
      };
      const go = (d) => { at = Math.max(0, Math.min(items.length - 1, at + d)); draw(); };
      prev.addEventListener('click', () => go(-1));
      next.addEventListener('click', () => go(1));
      el.tabIndex = 0;
      el.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { go(1); e.preventDefault(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { go(-1); e.preventDefault(); }
      });
      draw();
    },

    scrolly(el) {
      const fig = el.querySelector('figure, .pw-c-figure, img');
      const steps = [...el.querySelectorAll('[data-scrolly-step], h3, p')];
      if (!fig || steps.length < 2) return;
      el.classList.add('is-ready');
      fig.classList.add('pw-scrolly-fig');
      if (!('IntersectionObserver' in window)) return;
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const state = e.target.dataset.scrollyState;
          if (state) fig.dataset.state = state;
          steps.forEach((s) => s.classList.toggle('is-linked', s === e.target));
        }
      }, { rootMargin: '-45% 0px -45% 0px' });
      steps.forEach((s) => io.observe(s));
    },

    tabs(el) {
      const panels = [...el.querySelectorAll('[data-tab], section, .pw-c-card')];
      if (panels.length < 2) return;
      el.classList.add('is-ready');
      const list = document.createElement('div');
      list.className = 'pw-tablist';
      list.setAttribute('role', 'tablist');
      const btns = panels.map((pan, i) => {
        const head = pan.querySelector('h2, h3, .head, p');
        const label = (pan.dataset.tab || (head && head.textContent) || `Tab ${i + 1}`).trim();
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.setAttribute('role', 'tab');
        b.id = `pw-tab-${i}-${Math.random().toString(36).slice(2, 7)}`;
        pan.setAttribute('role', 'tabpanel');
        pan.setAttribute('aria-labelledby', b.id);
        pan.classList.add('pw-tab-panel');
        list.appendChild(b);
        return b;
      });
      el.insertBefore(list, el.firstChild);
      const show = (n) => {
        panels.forEach((pan, i) => { pan.hidden = i !== n; });
        btns.forEach((b, i) => {
          b.setAttribute('aria-selected', String(i === n));
          b.tabIndex = i === n ? 0 : -1;
        });
      };
      btns.forEach((b, i) => {
        b.addEventListener('click', () => show(i));
        b.addEventListener('keydown', (e) => {
          const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!d) return;
          const n = (i + d + btns.length) % btns.length;
          show(n); btns[n].focus(); e.preventDefault();
        });
      });
      show(0);
    },

    accordion(el) {
      const groups = [...el.querySelectorAll('[data-acc], .qa, section')];
      if (!groups.length) return;
      el.classList.add('is-ready');
      groups.forEach((g) => {
        const head = g.querySelector('h2, h3, .head, p');
        if (!head) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pw-acc-head';
        btn.textContent = head.textContent;
        btn.setAttribute('aria-expanded', 'false');
        const body = document.createElement('div');
        body.className = 'pw-acc-body';
        // 不 remove()：把兄弟节点搬进一个容器，内容一个字都没少。
        let n = head.nextSibling;
        while (n) { const next = n.nextSibling; body.appendChild(n); n = next; }
        head.replaceWith(btn);
        g.appendChild(body);
        body.hidden = true;
        btn.addEventListener('click', () => {
          const open = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', String(!open));
          body.hidden = open;
        });
      });
    },

    compare(el) {
      const wrap = el.querySelector('.pw-cmp-wrap') || el.firstElementChild;
      if (!wrap || wrap.children.length < 2) return;
      el.classList.add('is-ready');
      wrap.classList.add('pw-cmp-wrap');
      const handle = document.createElement('div');
      handle.className = 'pw-cmp-handle';
      handle.setAttribute('role', 'slider');
      handle.setAttribute('aria-label', 'Compare');
      handle.setAttribute('aria-valuemin', '0');
      handle.setAttribute('aria-valuemax', '100');
      handle.tabIndex = 0;
      wrap.appendChild(handle);
      const set = (pct) => {
        const v = Math.max(0, Math.min(100, pct));
        wrap.style.setProperty('--pw-split', v + '%');
        handle.setAttribute('aria-valuenow', String(Math.round(v)));
      };
      set(50);
      const move = (e) => {
        const r = wrap.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        set((x / r.width) * 100);
      };
      const stop = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', stop);
      };
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', stop);
      });
      handle.addEventListener('keydown', (e) => {
        const now = parseFloat(handle.getAttribute('aria-valuenow')) || 50;
        if (e.key === 'ArrowRight') { set(now + 4); e.preventDefault(); }
        if (e.key === 'ArrowLeft') { set(now - 4); e.preventDefault(); }
      });
    },

    hotspot(el) {
      const img = el.querySelector('img');
      const notes = [...el.querySelectorAll('[data-hot]')];
      if (!img || !notes.length) return;
      el.classList.add('is-ready');
      const layer = img.parentElement;
      layer.style.position = 'relative';
      notes.forEach((note, i) => {
        note.classList.add('pw-hot-note');
        note.hidden = true;
        const [x, y] = (note.dataset.hot || '50,50').split(',');
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'pw-hot-pin';
        pin.textContent = String(i + 1);
        pin.style.insetInlineStart = x + '%';
        pin.style.insetBlockStart = y + '%';
        pin.setAttribute('aria-expanded', 'false');
        pin.addEventListener('click', () => {
          const open = !note.hidden;
          notes.forEach((n) => { n.hidden = true; });
          note.hidden = open;
          pin.setAttribute('aria-expanded', String(!open));
        });
        layer.appendChild(pin);
      });
    },

    counter(el) {
      const targets = [...el.querySelectorAll('[data-count]')];
      if (!targets.length || reduce) return;
      el.classList.add('is-ready');
      onView(el, () => {
        targets.forEach((t) => {
          const text = t.textContent.trim();
          const m = text.match(/^([^\d-]*)(-?[\d.]+)(.*)$/);
          if (!m) return;
          const [, pre, numStr, post] = m;
          const end = parseFloat(numStr);
          const dec = (numStr.split('.')[1] || '').length;
          const t0 = performance.now();
          const tick = (now) => {
            const p = Math.min(1, (now - t0) / 900);
            const eased = 1 - Math.pow(1 - p, 3);
            t.textContent = pre + (end * eased).toFixed(dec) + post;
            if (p < 1) requestAnimationFrame(tick);
            else t.textContent = text;
          };
          requestAnimationFrame(tick);
        });
      });
    },

    carousel(el) {
      const track = el.querySelector('.pw-car-track') || el.firstElementChild;
      if (!track || track.children.length < 2) return;
      el.classList.add('is-ready');
      track.classList.add('pw-car-track');
      const nav = document.createElement('div');
      nav.className = 'pw-steps-nav';
      nav.innerHTML = '<button type="button" data-prev>Back</button>' +
        '<button type="button" data-next>Next</button>';
      el.appendChild(nav);
      const step = () => track.clientWidth;
      nav.querySelector('[data-prev]').addEventListener('click',
        () => track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
      nav.querySelector('[data-next]').addEventListener('click',
        () => track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }));
    },

    lightbox(el) {
      el.classList.add('is-ready');
      el.addEventListener('click', (e) => {
        const img = e.target.closest('img');
        if (!img) return;
        openLightbox(img);
      });
    },

    'sticky-toc'(el) {
      el.classList.add('is-ready');
      const bar = document.createElement('div');
      bar.className = 'pw-toc-progress';
      el.insertBefore(bar, el.firstChild);
      const onScroll = () => {
        const h = document.documentElement;
        const pct = h.scrollHeight <= h.clientHeight ? 100
          : (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
        bar.style.inlineSize = Math.max(0, Math.min(100, pct)) + '%';
      };
      addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    },

    sync(el) {
      const a = [...el.querySelectorAll('[data-sync]')];
      if (a.length < 2) return;
      el.classList.add('is-ready');
      const link = (key, on) => {
        a.forEach((n) => {
          if (n.dataset.sync === key) n.classList.toggle('is-linked', on);
        });
      };
      a.forEach((n) => {
        n.tabIndex = 0;
        n.addEventListener('mouseenter', () => link(n.dataset.sync, true));
        n.addEventListener('mouseleave', () => link(n.dataset.sync, false));
        n.addEventListener('focus', () => link(n.dataset.sync, true));
        n.addEventListener('blur', () => link(n.dataset.sync, false));
      });
    },
  };

  function openLightbox(img) {
    const box = document.createElement('div');
    box.className = 'pw-lightbox';
    box.innerHTML = '<button type="button" aria-label="Close">✕</button>';
    const big = document.createElement('img');
    big.src = img.currentSrc || img.src;
    big.alt = img.alt || '';
    box.appendChild(big);
    document.body.appendChild(box);
    const close = () => { box.remove(); img.focus?.(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    box.addEventListener('click', close);
    document.addEventListener('keydown', esc);
    box.querySelector('button').focus();
  }

  for (const el of document.querySelectorAll('[data-behavior]')) {
    const fn = behaviors[el.dataset.behavior];
    // 不在白名单里的名字当没写：它是模板作者写的数据（§16）。
    if (typeof fn === 'function') {
      try { fn(el); } catch (err) { console.warn('behavior failed', el.dataset.behavior, err); }
    }
  }

  /* ---------------------------------------------------------------- 托管库
     ⚠️ 这张表必须与 render/lib.go 一致，而且**要一起改**。
     为什么不去取一份清单：那是一次额外的往返，而且它会在离线时失败 ——
     而离线时这一段本来就该安静地什么都不做（源码留在页面上，读者照样读得到）。
     版本对不上的后果是取一个 404，然后走 catch —— 不是一次静默的错误渲染。 */
  const LIBS = {
    mermaid: '11.4.1',
    katex: '0.16.11',
    echarts: '5.5.1',
    shiki: '1.24.0',
    abcjs: '6.4.4',
  };
  // 需要一份样式表才成立的库。katex 的公式排版一半在 CSS 里 ——
  // 少了它公式会散架，而那种坏法看起来像「渲染失败」。
  const LIB_STYLES = new Set(['katex']);
  const LIB_BASE = (root && root.dataset.libBase) || '/_/lib/';

  const libBlocks = (id) => [...document.querySelectorAll(`.pw-lib[data-lib="${id}"]`)];

  const failLib = (id, msg) => {
    for (const fig of libBlocks(id)) {
      let cap = fig.querySelector('figcaption');
      if (!cap) { cap = document.createElement('figcaption'); fig.appendChild(cap); }
      // 源码留着不动。一个空框比一段没渲染的源码糟得多。
      cap.textContent = msg;
    }
  };

  const output = (fig) => {
    let out = fig.querySelector('.pw-lib-out');
    if (!out) {
      out = document.createElement('div');
      out.className = 'pw-lib-out';
      fig.insertBefore(out, fig.firstChild);
    }
    return out;
  };

  const upgraders = {
    async mermaid(mod) {
      const m = mod.default || mod;
      m.initialize({ startOnLoad: false, securityLevel: 'strict',
        theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default' });
      let n = 0;
      for (const fig of libBlocks('mermaid')) {
        const src = fig.querySelector('.pw-lib-src').textContent;
        const { svg } = await m.render('pw-mmd-' + (n++), src);
        output(fig).innerHTML = svg;
        fig.classList.add('is-ready');
      }
    },
    async katex(mod) {
      const k = mod.default || mod;
      for (const fig of libBlocks('katex')) {
        const src = fig.querySelector('.pw-lib-src').textContent;
        k.render(src, output(fig), { displayMode: true, throwOnError: false });
        fig.classList.add('is-ready');
      }
    },
    async echarts(mod) {
      const ec = mod.default || mod;
      for (const fig of libBlocks('echarts')) {
        const src = fig.querySelector('.pw-lib-src').textContent;
        let spec;
        try { spec = JSON.parse(src); } catch { continue; }
        const out = output(fig);
        out.style.blockSize = (spec.height || 320) + 'px';
        ec.init(out).setOption(spec);
        fig.classList.add('is-ready');
      }
    },
    async abcjs(mod) {
      const abc = mod.default || mod;
      for (const fig of libBlocks('abcjs')) {
        abc.renderAbc(output(fig), fig.querySelector('.pw-lib-src').textContent);
        fig.classList.add('is-ready');
      }
    },
    async shiki() { /* 代码高亮是纯增强，没接上也完全读得了 */ },
  };

  const wanted = ((root && root.dataset.libs) || '').split(/\s+/).filter(Boolean);
  for (const id of wanted) {
    const version = LIBS[id];
    if (!version) continue;
    // 页面上真的有这种块才去取：一份声明了 mermaid 却没画图的文档，
    // 不该让读者下载 2.5 MB。
    if (!libBlocks(id).length && id !== 'shiki') continue;
    if (LIB_STYLES.has(id) && !document.querySelector(`link[data-lib="${id}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${LIB_BASE}${id}@${version}.css`;
      link.dataset.lib = id;
      document.head.appendChild(link);
    }
    import(/* @vite-ignore */ `${LIB_BASE}${id}@${version}.js`)
      .then((mod) => upgraders[id]?.(mod))
      .catch(() => failLib(id,
        `${id} could not load, so this block is shown as its source. The text above is the whole content.`));
  }

  /* ---------------------------------------------------------------- embed
     一块要跑代码的东西，只有**这一块**在隔离源的 iframe 里跑。
     页面其余部分仍然 inline、仍然被索引。

     sandbox 只给 allow-scripts，一样不多：
       allow-same-origin      给了就等于没有隔离 —— 里面的脚本能读
                              这个源上的 cookie 与 storage
       allow-forms            平台禁止发布收集凭据的页面
       allow-top-navigation   一块内容不该能把整个标签页带走
       allow-modals           alert/confirm 能伪装成平台自己的对话框
     referrerpolicy=no-referrer：不把读者从哪来告诉那段代码。 */
  for (const box of document.querySelectorAll('.pw-embed[data-embed-src]')) {
    const frame = document.createElement('iframe');
    frame.src = box.dataset.embedSrc;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('title', box.querySelector('.pw-embed-title')?.textContent || 'Embedded content');
    frame.style.blockSize = (parseInt(box.dataset.embedHeight, 10) || 420) + 'px';
    box.appendChild(frame);
    box.classList.add('is-ready');
  }
})();
