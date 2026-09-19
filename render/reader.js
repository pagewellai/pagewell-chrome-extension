// 阅读页的渐进增强。
//
// 前提：没有这个文件页面也必须完整可读。这里只加三件事 ——
// 侧栏抽屉、目录高亮、复制按钮。任何一件失败都不该影响正文。
(() => {
  'use strict';

  // 明暗不在这里切（2026-09-18 去掉了阅读页里的「外观」开关）。首次上色由 <head> 里那段极短的
  // 脚本做（render.PrefsScript）：它读 localStorage 的 pw:prefs.theme —— 读者在站点顶栏选的那一档
  //（site.js）—— 没选就跟系统。阅读页因此没有自己的偏好 UI，也就没有「先白一下再变黑」的问题。

  // ---- ⋯ 菜单：点外面关，选了动作也关（复制除外 —— 按钮上要先闪一下「已复制」） ----
  const more = document.querySelector('.pw-more');
  if (more) {
    document.addEventListener('click', (e) => {
      if (!more.open) return;
      if (!more.contains(e.target)) { more.removeAttribute('open'); return; }
      const hit = e.target.closest('.pw-more-pop a, .pw-more-pop button');
      if (hit && !hit.dataset.copy) more.removeAttribute('open');
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
    const htmlPrefs = document.querySelector('.pw-html-prefs');
    const widthBtn = htmlPrefs && htmlPrefs.querySelector('[data-html-width]');
    const themeBtn = htmlPrefs && htmlPrefs.querySelector('[data-html-theme]');
    const themes = ['', 'light', 'dark'];
    let widthState = '', themeState = '', prefsReady = false, layoutSent = false;
    // is-frame 自己必须铺满，所以不能从它的 padding 反推文章版心。这个不可见探针
    // 只解析 reader.css 的共享变量，送进 iframe 的是浏览器算好的 px 值。
    const layoutProbe = document.createElement('span');
    layoutProbe.setAttribute('aria-hidden', 'true');
    layoutProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;padding:var(--reader-main-start) var(--gutter) var(--reader-main-end);max-width:var(--reader-shell-max)';
    document.body.appendChild(layoutProbe);
    const readerLayout = () => {
      const s = getComputedStyle(layoutProbe);
      return { gutter: s.paddingLeft, start: s.paddingTop, end: s.paddingBottom, max: s.maxWidth };
    };
    const storedPrefs = () => {
      try { return JSON.parse(localStorage.getItem('pw:prefs') || '{}') || {}; } catch { return {}; }
    };
    const savePrefs = (change) => {
      const p = storedPrefs();
      for (const [key, value] of Object.entries(change)) {
        if (value) p[key] = value; else delete p[key];
      }
      try { localStorage.setItem('pw:prefs', JSON.stringify(p)); } catch { /* 无痕模式等 */ }
    };
    const sendPrefs = () => {
      try { frame.contentWindow.postMessage({ type: 'pagewell:prefs', width: widthState, theme: themeState, layout: readerLayout() }, '*'); } catch { /* 还没有窗口 */ }
    };
    const drawPrefs = () => {
      if (!htmlPrefs || !widthBtn || !themeBtn) return;
      const widthLabel = widthState === 'wide' ? htmlPrefs.dataset.lWidthWide : htmlPrefs.dataset.lWidthSet;
      widthBtn.title = htmlPrefs.dataset.lWidth + ': ' + widthLabel;
      widthBtn.setAttribute('aria-label', widthBtn.title);
      widthBtn.setAttribute('aria-pressed', String(widthState === 'wide'));
      const themeKey = themeState || 'system';
      const labelKey = 'l' + themeKey.charAt(0).toUpperCase() + themeKey.slice(1);
      themeBtn.title = htmlPrefs.dataset.lAppearance + ': ' + htmlPrefs.dataset[labelKey];
      themeBtn.setAttribute('aria-label', themeBtn.title);
      themeBtn.setAttribute('aria-pressed', String(themeState !== ''));
      for (const icon of themeBtn.querySelectorAll('[data-theme-icon]')) icon.hidden = icon.dataset.themeIcon !== themeKey;
    };
    const activatePrefs = (data) => {
      if (!htmlPrefs || !widthBtn || !themeBtn) return;
      if (!prefsReady) {
        const saved = storedPrefs();
        widthState = saved.width === 'wide' ? 'wide' : (data.width === 'wide' ? 'wide' : '');
        themeState = themes.includes(document.documentElement.dataset.theme || '') ? (document.documentElement.dataset.theme || '') : '';
        prefsReady = true;
        htmlPrefs.hidden = false;
        widthBtn.addEventListener('click', () => {
          widthState = widthState === 'wide' ? '' : 'wide';
          savePrefs({ width: widthState }); drawPrefs(); sendPrefs();
        });
        themeBtn.addEventListener('click', () => {
          themeState = themes[(themes.indexOf(themeState) + 1) % themes.length];
          if (themeState) document.documentElement.dataset.theme = themeState; else delete document.documentElement.dataset.theme;
          savePrefs({ theme: themeState }); drawPrefs(); sendPrefs();
        });
      }
      drawPrefs();
      // 偏好值相同也必须至少送一次版心：旧 standalone 最常见的状态正好都是空串，
      // 只按偏好差异发送会让控件搬上来了，文章却仍卡在旧窄栏里。
      if (!layoutSent || data.width !== widthState || data.theme !== themeState) {
        layoutSent = true;
        sendPrefs();
      }
    };
    window.addEventListener('message', (e) => {
      if (e.source !== frame.contentWindow || !e.data) return;
      if (e.data.type === 'pagewell:standalone') { activatePrefs(e.data); return; }
      if (e.data.type !== 'pagewell:height') return;
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
    frame.addEventListener('load', () => { layoutSent = false; sync(); });
    let layoutFrame = 0;
    window.addEventListener('resize', () => {
      if (!prefsReady) return;
      cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(sendPrefs);
    });

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

  // ---- 手机上的两张抽屉（MobileNav 画板）----
  //
  // 目录树（.pw-nav）在 <900 时不在屏幕上，页内目录（.pw-toc）在 <1240 时不在屏幕上：
  // 各自的按钮把它们作为底部抽屉升起来。抽屉的样子在 reader.css 的 .is-sheet 里，
  // 这里按 matchMedia 给元素挂 / 摘 is-sheet —— 窗口拉宽时抽屉变回栏，开着的也收起，
  // 不然桌面上会留着一张锁住滚动的隐形抽屉。同时只开一张；遮罩 / ✕ / Esc / 选中一项都关。
  const scrim = document.querySelector('.pw-scrim');
  const sheets = [
    { btn: document.querySelector('.pw-menu'), el: document.getElementById('pw-nav'), mq: matchMedia('(max-width: 899px)') },
    { btn: document.querySelector('.pw-outline-btn'), el: document.getElementById('pw-toc'), mq: matchMedia('(max-width: 1239px)') },
  ].filter((s) => s.btn && s.el);
  if (sheets.length) {
    const anyOpen = () => sheets.some((s) => s.el.classList.contains('is-open'));
    const set = (s, open) => {
      s.el.classList.toggle('is-open', open);
      s.btn.setAttribute('aria-expanded', String(open));
    };
    const settle = () => {
      const open = anyOpen();
      if (scrim) { scrim.hidden = !open; scrim.classList.toggle('is-on', open); }
      document.documentElement.classList.toggle('pw-sheet-open', open);
    };
    const closeAll = () => { sheets.forEach((s) => set(s, false)); settle(); };
    const toggle = (s) => {
      const open = !s.el.classList.contains('is-open');
      sheets.forEach((o) => set(o, o === s && open));
      settle();
    };
    sheets.forEach((s) => {
      const apply = () => { s.el.classList.toggle('is-sheet', s.mq.matches); if (!s.mq.matches && s.el.classList.contains('is-open')) closeAll(); };
      s.mq.addEventListener('change', apply);
      apply();
      s.btn.addEventListener('click', () => toggle(s));
      // 选了一项就收起来，否则在手机上会挡住刚跳过去的内容
      s.el.addEventListener('click', (e) => {
        if (e.target.closest('a') || e.target.closest('[data-sheet-close]')) closeAll();
      });
    });
    if (scrim) scrim.addEventListener('click', closeAll);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && anyOpen()) closeAll(); });
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
  // 成功的反馈是底部正中一枚小胶囊（.pw-toast）：⋯ 菜单一选就收起，按钮上闪的那下「已复制」
  // 没人看得到（用户 2026-09-18 指出）。失败仍然闪在按钮上 —— 那时菜单没收。
  let toastEl, toastTimer;
  const toast = (msg) => {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'pw-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 1800);
  };

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const kind = b.dataset.copy;
    try {
      if (kind === 'rich' && source && window.ClipboardItem && navigator.clipboard?.write) {
        // 富文本走 ClipboardItem，粘进 Notion / 飞书 / Word 才能保住格式。
        // 同时带一份 text/plain flavor，给不认 HTML 的目标兜底。
        // 复制的是一份克隆：图片与链接换成绝对地址 —— 正文里写的是站内相对地址，贴到别处就断了；
        // 行为原语挂上来的按钮（步骤的 Back / Next）不是内容，去掉。
        const clone = source.cloneNode(true);
        clone.querySelectorAll('.pw-steps-nav').forEach((n) => n.remove());
        for (const [sel, attr] of [['img[src]', 'src'], ['a[href]', 'href'], ['source[src]', 'src'], ['video[src]', 'src']]) {
          clone.querySelectorAll(sel).forEach((n) => {
            try { n.setAttribute(attr, new URL(n.getAttribute(attr), location.href).href); } catch { /* 无效地址原样留着 */ }
          });
        }
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([clone.innerHTML], { type: 'text/html' }),
          'text/plain': new Blob([source.innerText], { type: 'text/plain' }),
        })]);
      } else {
        const url = new URL(location.href);
        url.searchParams.set('as', kind === 'markdown' ? 'markdown' : 'text');
        const res = await fetch(url, { headers: { Accept: 'text/plain' } });
        if (!res.ok) throw new Error(String(res.status));
        await navigator.clipboard.writeText(await res.text());
      }
      b.closest('details')?.removeAttribute('open');
      toast(b.dataset.copied || 'Copied');
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
      // 导航放在列表**上面**（2026-09-18）：步骤是累加着露出来的，放在下面每点一次 Next
      // 按钮就往下挪一截，手指得跟着追。放上面它就钉在原地，新的一步在下面展开。
      el.insertBefore(nav, el.firstChild);
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

  /* PAGEWELL_HOSTED_LIBRARY_LOADER_START */
  /* ---------------------------------------------------------------- 托管库
     ⚠️ 这张表必须与 render/lib.go 一致，而且**要一起改**。
     为什么不去取一份清单：那是一次额外的往返，而且它会在离线时失败 ——
     而离线时这一段本来就该安静地什么都不做（源码留在页面上，读者照样读得到）。
     版本对不上的后果是取一个 404，然后走 catch —— 不是一次静默的错误渲染。 */
  const LIBS = {
    mermaid: '11.4.1',
    katex: '0.16.11',
    echarts: '5.5.1',
    abcjs: '6.4.4',
  };
  // 需要一份样式表才成立的库。katex 的公式排版一半在 CSS 里 ——
  // 少了它公式会散架，而那种坏法看起来像「渲染失败」。
  const LIB_STYLES = new Set(['katex']);
  // 经典脚本（UMD / IIFE）：跑完把自己挂在 globalThis 的这个名字上。与 render/lib.go 的 Global
  // 一起改（lib_test.go 盯着）。它们用 <script> 装而不是当作模块动态引入 —— 一个 IIFE 被当成
  // module 跑，顶层的 var 是模块作用域的，globalThis 上什么都没有。
  // ⚠️ 这段注释里不能出现「import」加括号的写法：插件的构建脚本用正则扫整份文件拦动态引入。
  const LIB_GLOBAL = { mermaid: 'mermaid', echarts: 'echarts' };
  /* PAGEWELL_LIBRARY_SOURCE_START */
  const LIB_BASE = (root && root.dataset.libBase && root.dataset.libBase.startsWith('chrome-extension://'))
    ? root.dataset.libBase : '';
  const PACKAGED_LIBRARIES = new Set(["mermaid@11.4.1","katex@0.16.11"]);
  const packagedLibraries = globalThis.__pagewellPackagedLibraries ??= Object.create(null);
  const pendingLibraries = new Map();
  const loadLibrary = (id, version) => {
    const key = id + '@' + version;
    if (!LIB_BASE || !PACKAGED_LIBRARIES.has(key)) {
      return Promise.reject(new Error('library is not packaged: ' + key));
    }
    if (packagedLibraries[key]) return Promise.resolve(packagedLibraries[key]);
    if (pendingLibraries.has(key)) return pendingLibraries.get(key);
    const pending = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = LIB_BASE + key + '.js';
      script.async = true;
      script.dataset.pagewellLibrary = key;
      script.addEventListener('load', () => {
        const loaded = packagedLibraries[key];
        loaded ? resolve(loaded) : reject(new Error('packaged library did not register: ' + key));
      }, { once: true });
      script.addEventListener('error', () => reject(new Error('packaged library failed to load: ' + key)), { once: true });
      document.head.appendChild(script);
    }).finally(() => pendingLibraries.delete(key));
    pendingLibraries.set(key, pending);
    return pending;
  };
  /* PAGEWELL_LIBRARY_SOURCE_END */

  const libBlocks = (id) => [...document.querySelectorAll(`.pw-lib[data-lib="${id}"]`)];

  const failLib = (id, msg) => {
    for (const fig of libBlocks(id)) {
      if (fig.classList.contains('pw-math-inline')) {
        fig.title = msg;
        continue;
      }
      let cap = fig.querySelector('figcaption');
      if (!cap) { cap = document.createElement('figcaption'); fig.appendChild(cap); }
      // 源码留着不动。一个空框比一段没渲染的源码糟得多。
      cap.textContent = msg;
    }
  };

  const output = (fig) => {
    let out = fig.querySelector('.pw-lib-out');
    if (!out) {
      out = document.createElement(fig.classList.contains('pw-math-inline') ? 'span' : 'div');
      out.className = 'pw-lib-out';
      fig.insertBefore(out, fig.firstChild);
    }
    return out;
  };

  const upgraders = {
    async mermaid(mod) {
      const m = mod.default || mod;
      // 图跟页面一套颜色（Charts 画板「Diagram」那格）：Mermaid 自带的 default / dark 两套主题
      // 是它自己的灰蓝配色，放在这一页上像贴进来的截图。base 主题把每个颜色都交给我们定，
      // 值从**这一块**的计算样式里读 —— 模板改了 --accent、读者切了明暗，图就跟着变，
      // 这里一个色值都不写（与 reader.css 管图表配色是同一条纪律）。
      const vars = (fig) => {
        const cs = getComputedStyle(fig);
        const v = (name) => cs.getPropertyValue(name).trim();
        const palette = {};
        for (let i = 0; i < 8; i++) {
          palette['pie' + (i + 1)] = v('--pw-c' + i);
          palette['git' + i] = v('--pw-c' + i);
          palette['cScale' + i] = v('--pw-c' + i);
        }
        return {
          darkMode: document.documentElement.getAttribute('data-theme') === 'dark'
            || (document.documentElement.getAttribute('data-theme') !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches),
          background: v('--bg'), fontFamily: v('--font'), fontSize: '14px',
          // 节点：浅主色的面、主色的边、正文色的字 —— 和 callout / 卡片同一套
          primaryColor: v('--accent-light'), primaryBorderColor: v('--accent'), primaryTextColor: v('--fg'),
          secondaryColor: v('--muted'), secondaryBorderColor: v('--mark'), secondaryTextColor: v('--fg'),
          tertiaryColor: v('--surface'), tertiaryBorderColor: v('--line'), tertiaryTextColor: v('--body'),
          mainBkg: v('--accent-light'), nodeBorder: v('--accent'), nodeTextColor: v('--fg'),
          // 线与箭头用图表里轴线那一档灰；边上的字直接压在页面底色上，不再有一块灰底
          lineColor: v('--dim'), defaultLinkColor: v('--dim'), arrowheadColor: v('--dim'),
          textColor: v('--body'), titleColor: v('--fg'),
          edgeLabelBackground: v('--bg'),
          clusterBkg: v('--muted'), clusterBorder: v('--line'),
          // 时序图
          actorBkg: v('--surface'), actorBorder: v('--accent'), actorTextColor: v('--fg'), actorLineColor: v('--mark'),
          signalColor: v('--body'), signalTextColor: v('--body'),
          labelBoxBkgColor: v('--accent-light'), labelBoxBorderColor: v('--accent'), labelTextColor: v('--fg'),
          loopTextColor: v('--fg'), activationBkgColor: v('--muted'), activationBorderColor: v('--mark'),
          sequenceNumberColor: v('--accent-fg'),
          noteBkgColor: v('--warn-bg'), noteBorderColor: v('--warn-fg'), noteTextColor: v('--fg'),
          // 饼图：和 ```chart 同一组色，扇区上的字与那边同一档
          pieStrokeColor: v('--bg'), pieOuterStrokeColor: v('--bg'),
          pieSectionTextColor: v('--slice-ink'), pieTitleTextColor: v('--fg'), pieLegendTextColor: v('--body'),
          ...palette,
        };
      };
      const draw = async () => {
        const figs = libBlocks('mermaid');
        if (!figs.length) return;
        m.initialize({
          startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: vars(figs[0]),
          // 比默认紧一档：默认的 50px 间距 + 16px 字把五个框的流程图撑到整栏宽
          flowchart: { padding: 10, nodeSpacing: 36, rankSpacing: 44 },
        });
        let n = 0;
        for (const fig of figs) {
          const src = fig.querySelector('.pw-lib-src').textContent;
          const { svg } = await m.render('pw-mmd-' + Date.now().toString(36) + '-' + (n++), src);
          output(fig).innerHTML = svg;
          fig.classList.add('is-ready');
        }
      };
      await draw();
      // 系统在读的时候切了明暗（日落自动切换）：颜色是渲染时烤进 SVG 的，重画一次
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { draw().catch(() => {}); });
    },
    async katex(mod) {
      const k = mod.default || mod;
      for (const fig of libBlocks('katex')) {
        const src = fig.querySelector('.pw-lib-src').textContent;
        k.render(src, output(fig), {
          displayMode: !fig.classList.contains('pw-math-inline'),
          throwOnError: false,
        });
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
  };

  const wanted = ((root && root.dataset.libs) || '').split(/\s+/).filter(Boolean);
  for (const id of wanted) {
    const version = LIBS[id];
    if (!version) continue;
    // 页面上真的有这种块才去取：一份声明了 mermaid 却没画图的文档，
    // 不该让读者下载 2.5 MB。
    if (!libBlocks(id).length) continue;
    if (LIB_BASE && LIB_STYLES.has(id) && !document.querySelector(`link[data-lib="${id}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${LIB_BASE}${id}@${version}.css`;
      link.dataset.lib = id;
      document.head.appendChild(link);
    }
    loadLibrary(id, version)
      .then((mod) => upgraders[id]?.(mod))
      .catch(() => failLib(id,
        `${id} could not load, so this block is shown as its source. The text above is the whole content.`));
  }
  /* PAGEWELL_HOSTED_LIBRARY_LOADER_END */

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
