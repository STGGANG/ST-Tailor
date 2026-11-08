/* ST Tailor 1.9.28 */
(() => {
  'use strict';
  // The script build runs inside Tavern Helper's iframe, so the real page is the parent window; the extension build runs in that window directly.
  const host = window.parent && window.parent !== window ? window.parent : window;
  const doc = host.document;
  const GLOBAL = '__ST_TAILOR__';
  const STORAGE = 'st_tailor_v1';
  const VERSION = "1.9.28";
  const IN_JSDOM = /jsdom/i.test(window.navigator?.userAgent || '');
  // Search only inside #chat, not the whole document: this runs on every DOM change, so keep it cheap.
  function welcomePanel() { return doc.getElementById('chat')?.getElementsByClassName('welcomePanel')[0] || null; }
  // ── Extension build only ──
  const KIND = 'extension';
  const importHost = url => import(url);
  const installPlatformUi = () => {};

  function createQrController(host, doc) {
  let root, signature = '', cleanup = () => {}, update = () => {}, managed = false;
  const ids = new WeakMap(); let serial = 0;
  const identify = node => { if (!ids.has(node)) ids.set(node, ++serial); return ids.get(node); };
  function sync(config) {
    if (!config.enabled && !managed) return;
    const next = doc.querySelector('#send_form #qr--bar');
    const sets = next ? [...next.querySelectorAll('.qr--buttons')].filter(n => !n.querySelector('.qr--buttons')) : [];
    const key = JSON.stringify([config, next && identify(next), sets.map(identify)]);
    if (signature === key) { update(); return; }
    const oldShell = root?.closest('.stt-qr-shell') || doc.querySelector('.stt-qr-shell');
    if (next && next !== root && oldShell?.contains(next)) oldShell.before(next);
    cleanup(); signature = key; root = next;
    if (!root || !config.enabled) { update = () => {}; return; }
    const undo = [], listeners = [], rows = [];
    root.setAttribute('data-stt-qr-managed', '');
    const managedRoot = root;
    undo.push(() => managedRoot.removeAttribute('data-stt-qr-managed'));
    const setStyle = (node, prop, value) => {
      const old = node.style.getPropertyValue(prop), priority = node.style.getPropertyPriority(prop);
      node.style.setProperty(prop, value, 'important');
      const applied = node.style.getPropertyValue(prop);
      undo.push(() => { if (node.style.getPropertyValue(prop) === applied) { if (old) node.style.setProperty(prop, old, priority); else node.style.removeProperty(prop); } });
    };
    const pinVisibility = node => {
      for (const [prop, value] of Object.entries({ visibility: 'visible', opacity: '1', 'pointer-events': 'auto', 'content-visibility': 'visible', clip: 'auto', 'clip-path': 'none', transform: 'none', translate: 'none', scale: 'none', animation: 'none', transition: 'none' })) setStyle(node, prop, value);
    };
    const attribute = (node, name, value) => { if (node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value)); };
    const create = (tag, cls) => { const n = doc.createElement(tag); n.className = cls; n.dataset.sttOwned = ''; return n; };
    const listen = (node, name, fn, options) => { node.addEventListener(name, fn, options); listeners.push(() => node.removeEventListener(name, fn, options)); };
    const wrap = (node, cls) => {
      const box = create('div', cls); node.before(box); box.append(node);
      undo.push(() => {
        if (box.parentNode) for (const child of [...box.childNodes]) if (child === node || !child.hasAttribute?.('data-stt-owned')) box.before(child);
        box.remove();
      });
      return box;
    };
    const shell = wrap(root, 'stt-qr-shell');
    const reveal = wrap(root, 'stt-qr-reveal');
    const body = wrap(root, 'stt-qr-body');
    shell.dataset.style = config.style || 'pill';
    pinVisibility(shell); pinVisibility(body);
    // Animate the input-gap fix (keepGap) at the reveal's speed; pinVisibility disables transitions, so re-enable only this one.
    // With OS reduced motion or SillyTavern's reduced motion, apply instantly (checked on every paint, so setting changes take effect at once).
    const stillMotion = () => !!host.matchMedia?.('(prefers-reduced-motion: reduce)').matches || doc.body.classList.contains('reduced-motion');
    const syncMotion = () => setStyle(shell, 'transition', stillMotion() ? 'none' : 'margin .18s ease');
    syncMotion();
    setStyle(shell, 'display', 'block');
    shell.dataset.mode = config.mode;
    const trigger = create('button', 'stt-qr-toggle'); trigger.type = 'button';
    // Give it a stable id so it is collected as an input-area button and can be
    // reordered / moved left or right like any other one.
    trigger.id = 'stt-qr-toggle';
    // data-icon makes the chevron visible to the icon pipeline, so picking a
    // custom icon in the panel replaces it rather than adding a second glyph.
    trigger.innerHTML = '<svg data-icon="stt-qr-chevron" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 14 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    trigger.setAttribute('aria-controls', 'qr--bar');
    const inputLeft = doc.getElementById('leftSendForm') || doc.getElementById('nonQRFormItems');
    if (inputLeft) inputLeft.prepend(trigger); else shell.before(trigger);
    undo.push(() => trigger.remove());
    // Match an ordinary composer icon, not the form's text color. Themes may
    // tint the glyph itself (::before) and/or dim its button with opacity.
    // Runs in the existing QR update; no new timer, observer, or DOM probe.
    const syncAppearance = () => {
      if (trigger.hidden || !trigger.isConnected) return;
      const boundary = trigger.closest('#nonQRFormItems') || trigger.closest('#send_form');
      if (!boundary) return;
      const computed = new Map();
      const css = node => {
        if (!computed.has(node)) computed.set(node, host.getComputedStyle(node));
        return computed.get(node);
      };
      const opacity = node => {
        let value = 1;
        for (; node && node !== boundary; node = node.parentElement) {
          const style = css(node);
          if (node.hidden || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return 0;
          // display:contents has no box of its own to apply opacity to.
          if (style.display !== 'contents') value *= Number(style.opacity);
        }
        return value;
      };
      const write = (name, value) => {
        if (trigger.style.getPropertyValue(name) !== value) trigger.style.setProperty(name, value);
      };
      for (const id of ['options_button', 'extensionsMenuButton', 'mes_impersonate']) {
        const source = doc.getElementById(id);
        const config = saved?.areas.input.items[`id:${id}`];
        // A per-button accent must not become the default for the QR toggle.
        if (!source || !boundary.contains(source) || config?.color || config?.icon === 'none') continue;
        if (source.matches(':hover,:active,:focus-visible')) {
          if (trigger.style.getPropertyValue('--stt-qr-color')) return;
          continue;
        }
        const glyph = source.querySelector('[data-stt-added-icon]')
          || (source.matches('.fa,.fas,.far,.fab,.fa-solid,.fa-regular,.fa-brands,svg') ? source
            : source.querySelector('.fa,.fas,.far,.fab,.fa-solid,.fa-regular,.fa-brands,svg') || source);
        const style = css(glyph);
        const before = glyph.matches('svg') ? null : host.getComputedStyle(glyph, '::before');
        const hasGlyph = before && !['none', 'normal', '""', "''"].includes(before.content);
        const sourceOpacity = opacity(glyph) * (hasGlyph ? Number(before.opacity) : 1);
        const parentOpacity = opacity(trigger.parentElement);
        if (!(sourceOpacity > 0) || !(parentOpacity > 0)) continue;
        const color = hasGlyph ? before.color : style.color;
        if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') continue;
        write('--stt-qr-color', color);
        write('--stt-qr-opacity', String(Math.min(1, sourceOpacity / parentOpacity)));
        return;
      }
      // No suitable native icon: release any stale sampled values. Explicit
      // per-item/common colors still use the existing inline icon overrides.
      for (const name of ['--stt-qr-color', '--stt-qr-opacity']) {
        if (trigger.style.getPropertyValue(name)) trigger.style.removeProperty(name);
      }
    };
    let opened = config.mode === 'always', contextOpen = false, pointerInside = false;
    const isContext = target => !!target?.closest?.('.ctx-menu,.ctx-blocker');
    const inside = target => target === trigger || trigger.contains(target) || shell.contains(target) || target === doc.getElementById('send_textarea');
    const paint = () => {
      syncMotion();
      const shown = config.mode === 'always' || opened || contextOpen;
      attribute(shell, 'data-open', shown); attribute(trigger, 'aria-expanded', shown);
      const label = shown ? 'QR 바 접기' : 'QR 바 펼치기';
      attribute(trigger, 'aria-label', label); attribute(trigger, 'title', label);
      if (body.inert !== !shown) body.inert = !shown; attribute(body, 'aria-hidden', !shown);
      keepGap();
    };
    trigger.hidden = config.mode !== 'toggle';
    listen(trigger, 'click', () => { opened = !opened; paint(); });
    listen(doc, 'focusin', e => { if (config.mode === 'focus') { opened = inside(e.target); paint(); } });
    listen(doc, 'focusout', () => host.queueMicrotask(() => { if (config.mode === 'focus' && !contextOpen && !pointerInside) { opened = inside(doc.activeElement); paint(); } }));
    listen(doc, 'pointerdown', e => {
      pointerInside = shell.contains(e.target);
      if (isContext(e.target)) return;
      if (shell.contains(e.target) || trigger.contains(e.target)) { if (config.mode === 'focus') opened = true; }
      else if (e.target === doc.getElementById('send_textarea') && config.mode === 'focus') opened = true;
      else { opened = false; contextOpen = false; }
      paint();
    }, true);
    // Touch may dispatch mousedown/focusout after pointerup. Keep the QR open
    // through that synthetic mouse sequence so the eventual click can arrive.
    listen(doc, 'pointerup', e => { if (!shell.contains(e.target)) pointerInside = false; });
    listen(doc, 'click', () => { pointerInside = false; }, true);
    listen(doc, 'pointercancel', () => { pointerInside = false; });
    listen(doc, 'keydown', e => { if (e.key === 'Escape') { contextOpen = false; opened = false; paint(); } });
    listen(root, 'click', () => host.queueMicrotask(() => { contextOpen = !!doc.querySelector('.ctx-menu'); if (contextOpen) paint(); }));
    listen(root, 'contextmenu', () => host.queueMicrotask(() => { contextOpen = !!doc.querySelector('.ctx-menu'); paint(); }));
    setStyle(root, 'width', '100%'); setStyle(root, 'max-width', '100%'); setStyle(root, 'min-width', '0');
    setStyle(root, 'margin', '0'); setStyle(root, 'opacity', '1');
    setStyle(root, 'overflow', 'visible'); setStyle(root, 'display', 'flex');
    setStyle(root, 'flex-direction', config.layout === 'sets' ? 'column' : 'row');
    setStyle(root, 'flex-wrap', 'nowrap');
    for (const group of root.querySelectorAll('.qr--buttons')) {
      const leaf = sets.includes(group);
      setStyle(group, 'display', config.layout === 'single' || !leaf ? 'contents' : 'flex');
      if (leaf && config.layout === 'sets') { setStyle(group, 'flex-wrap', 'nowrap'); setStyle(group, 'width', 'max-content'); setStyle(group, 'min-width', '100%'); }
    }
    for (const container of [root, ...root.querySelectorAll('.qr--buttons')]) {
      pinVisibility(container);
      for (const property of ['anchor-name', 'anchor-scope', 'scroll-snap-type']) setStyle(container, property, 'none');
      for (const [prop, value] of Object.entries({ 'overflow': 'visible', 'height': 'auto', 'max-height': 'none', 'min-height': '0', 'padding': '0', 'margin': '0', 'flex-wrap': 'nowrap', 'float': 'none', 'position': 'relative', 'inset': 'auto', 'transform': 'none' })) setStyle(container, prop, value);
      if (container !== root) setStyle(container, 'flex-direction', 'row');
    }
    for (const container of [root, ...sets]) { setStyle(container, 'column-gap', '6px'); setStyle(container, 'row-gap', '6px'); }
    const targets = config.layout === 'sets' && sets.length ? sets : [root];
    for (const target of targets) {
      const directSet = target !== root && target.parentElement === root;
      const viewport = wrap(target, 'stt-qr-viewport');
      const row = wrap(viewport, directSet ? 'stt-qr-row qr--buttons' : 'stt-qr-row');
      const left = create('button', 'stt-qr-arrow'), right = create('button', 'stt-qr-arrow');
      for (const [btn, text, label] of [[left, '‹', '빠른 답장 왼쪽 스크롤'], [right, '›', '빠른 답장 오른쪽 스크롤']]) { btn.type = 'button'; btn.textContent = text; btn.setAttribute('aria-label', label); }
      row.prepend(left); row.append(right);
      pinVisibility(row); pinVisibility(viewport);
      for (const [prop, value] of Object.entries({ display: 'flex', width: '100%', 'max-width': '100%', 'min-width': '0', 'flex-direction': 'row', 'flex-wrap': 'nowrap', overflow: 'visible', margin: '0', padding: '0', gap: '2px', 'box-sizing': 'border-box', 'flex-shrink': '0', height: 'auto', 'max-height': 'none', 'min-height': '0', position: 'relative', inset: 'auto', transform: 'none', float: 'none' })) setStyle(row, prop, value);
      for (const [prop, value] of Object.entries({ display: 'block', flex: '1 1 0%', width: '0', 'min-width': '0', 'max-width': '100%', 'overflow-x': 'auto', 'overflow-y': 'hidden', margin: '0', padding: '0', 'scrollbar-width': 'none', 'box-sizing': 'border-box' })) setStyle(viewport, prop, value);
      setStyle(target, 'width', 'max-content'); setStyle(target, 'min-width', '100%'); setStyle(target, 'max-width', 'none');
      const refresh = () => {
        const overflow = viewport.scrollWidth > viewport.clientWidth + 2;
        attribute(row, 'data-overflow', overflow);
        const alignment = overflow ? 'flex-start' : { left: 'flex-start', center: 'center', right: 'flex-end' }[config.align];
        if (target.style.justifyContent !== alignment) target.style.setProperty('justify-content', alignment, 'important');
        const atStart = viewport.scrollLeft <= 1, atEnd = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 2;
        attribute(row, 'data-fade-left', overflow && !atStart);
        attribute(row, 'data-fade-right', overflow && !atEnd);
        if (left.disabled !== atStart) left.disabled = atStart;
        if (right.disabled !== atEnd) right.disabled = atEnd;
      };
      const oldAlign = target.style.getPropertyValue('justify-content'), oldPriority = target.style.getPropertyPriority('justify-content');
      undo.push(() => { if (oldAlign) target.style.setProperty('justify-content', oldAlign, oldPriority); else target.style.removeProperty('justify-content'); });
      for (const [btn, direction] of [[left, -1], [right, 1]]) listen(btn, 'click', () => viewport.scrollBy({ left: direction * Math.max(100, viewport.clientWidth * .8), behavior: host.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
      listen(viewport, 'scroll', refresh, { passive: true }); rows.push(refresh);
    }

    // 'Theme' style: size, font and shadow come from the active theme; only keep what the
    // scrolling row needs (no extra outer margin on top of the row gap).
    const themeStyle = config.style === 'theme';
    for (const button of root.querySelectorAll('.qr--button')) {
      if (themeStyle) { setStyle(button, 'margin', '0'); continue; }
      for (const [prop, value] of Object.entries({ display: 'inline-flex', 'align-items': 'center', 'justify-content': 'center', gap: '5px', height: '28px', 'min-height': '28px', 'max-height': '28px', width: 'max-content', 'min-width': '0', 'max-width': 'none', padding: '3px 10px', margin: '0', 'box-sizing': 'border-box', 'font-size': '12px', 'line-height': '20px', 'font-weight': '500', 'text-indent': '0', transform: 'none', 'box-shadow': 'none' })) setStyle(button, prop, value);
    }

    let pointerStart;
    listen(root, 'pointerdown', e => { pointerStart = [e.clientX, e.clientY]; }, true);
    listen(root, 'click', e => { if (pointerStart && Math.hypot(e.clientX - pointerStart[0], e.clientY - pointerStart[1]) > 12 && e.detail !== 0) { e.preventDefault(); e.stopImmediatePropagation(); } pointerStart = null; }, true);
    update = () => {
      if (contextOpen && !doc.querySelector('.ctx-menu')) { contextOpen = false; if (config.mode === 'focus') opened = inside(doc.activeElement); paint(); }
      const activeSets = sets.filter(set => [...set.querySelectorAll('.qr--button')].some(btn => !btn.classList.contains('qr--hidden') && host.getComputedStyle(btn).display !== 'none'));
      shell.hidden = !activeSets.length;
      trigger.hidden = config.mode !== 'toggle' || !activeSets.length;
      syncAppearance();
      const display = activeSets.length ? 'block' : 'none';
      if (shell.style.display !== display) shell.style.setProperty('display', display, 'important');
      for (const set of sets) { const row = set.closest('.stt-qr-row'); if (row && config.layout === 'sets') { row.hidden = !activeSets.includes(set); const display = row.hidden ? 'none' : 'flex'; if (row.style.display !== display) row.style.setProperty('display', display, 'important'); } }
      rows.forEach(fn => fn());
      keepGap();
    };
    // The QR bar's margins are zeroed, so themes that relied on them to space it from the input end up touching it.
    // Measure to the visible input edge (a box with a border/background, else where the text starts) and pad only when short.
    const QR_MIN_GAP = 6;
    const painted = el => {
      const cs = host.getComputedStyle(el);
      const solid = color => !/^(transparent|rgba\(.*,\s*0\))$/.test(color);
      return solid(cs.backgroundColor) || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none'
        || (parseFloat(cs.borderTopWidth) > 0 && solid(cs.borderTopColor)) || (parseFloat(cs.borderBottomWidth) > 0 && solid(cs.borderBottomColor));
    };
    const inputEdge = above => {
      const items = doc.getElementById('nonQRFormItems'), text = doc.getElementById('send_textarea');
      const box = [items, text].find(el => el && painted(el));
      if (box) { const r = box.getBoundingClientRect(); return above ? r.top : r.bottom; }
      const el = text || items, r = el.getBoundingClientRect(), cs = host.getComputedStyle(el);
      return above ? r.top + (parseFloat(cs.paddingTop) || 0) : r.bottom - (parseFloat(cs.paddingBottom) || 0);
    };
    // Measure only after the reveal animation settles (positions shift mid-animation); the applied margin animates with it via CSS transition.
    let gapNeed = { top: 0, bottom: 0 };
    const settled = () => {
      const t = host.getComputedStyle(reveal).transform;
      const cs = host.getComputedStyle(shell);
      const same = prop => (parseFloat(cs.getPropertyValue(prop)) || 0) === (parseFloat(shell.style.getPropertyValue(prop)) || 0);
      return (t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)') && same('margin-top') && same('margin-bottom');
    };
    const keepGap = () => {
      const items = doc.getElementById('nonQRFormItems');
      const open = !shell.hidden && shell.dataset.open !== 'false';
      if (items && open && settled()) {
        const above = shell.getBoundingClientRect().top < items.getBoundingClientRect().top;
        // Measure the QR side from the visible buttons too, not the row box.
        const shown = [...shell.querySelectorAll('.qr--button')].map(b => b.getBoundingClientRect()).filter(r => r.height);
        const s = shown.length ? { top: Math.min(...shown.map(r => r.top)), bottom: Math.max(...shown.map(r => r.bottom)) } : shell.getBoundingClientRect();
        const edge = inputEdge(above);
        const applied = parseFloat(shell.style.getPropertyValue(above ? 'margin-bottom' : 'margin-top')) || 0;
        const need = Math.max(0, Math.round(QR_MIN_GAP - ((above ? edge - s.bottom : s.top - edge) - applied)));
        gapNeed = above ? { top: 0, bottom: need } : { top: need, bottom: 0 };
      }
      for (const [prop, value] of [['margin-top', open ? gapNeed.top : 0], ['margin-bottom', open ? gapNeed.bottom : 0]]) {
        const next = value ? `${value}px` : '';
        if (shell.style.getPropertyValue(prop) !== next) {
          if (next) shell.style.setProperty(prop, next, 'important'); else shell.style.removeProperty(prop);
        }
      }
    };
    const observer = host.ResizeObserver ? new host.ResizeObserver(update) : null;
    if (observer) { observer.observe(shell); for (const row of shell.querySelectorAll('.stt-qr-viewport')) observer.observe(row); }
    listen(host, 'resize', update); if (host.visualViewport) listen(host.visualViewport, 'resize', update);
    listen(reveal, 'transitionend', update); listen(shell, 'transitionend', update);
    if (config.mode === 'focus') opened = inside(doc.activeElement);
    managed = true;
    paint(); update();
    cleanup = () => { observer?.disconnect(); listeners.forEach(fn => fn()); undo.reverse().forEach(fn => fn()); update = () => {}; managed = false; };
  }
  return { sync, dispose() { cleanup(); signature = ''; root = null; } };
}
  const qrController = createQrController(host, doc);

  // Fonts: override UI and message-body font, size, weight, line height and letter spacing on top of the theme.
  // Size and line height are percentages of the theme's defaults, so each theme's base size is preserved.
  // lang: dropdown group (Korean when absent)
  const FONT_FACES = {
    pretendard: { name: '프리텐다드', family: '"Pretendard Variable", "Pretendard"', fallback: 'sans-serif',
      css: '@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css");' },
    suit: { name: 'SUIT', family: '"SUIT Variable"', fallback: 'sans-serif',
      faces: [['SUIT Variable', 'https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.woff2', '100 900', 'woff2-variations']] },
    presentation: { name: '프레젠테이션', family: '"STT Freesentation"', fallback: 'sans-serif',
      faces: [['4Regular', 400], ['5Medium', 500], ['6SemiBold', 600], ['7Bold', 700]].map(([file, weight]) =>
        ['STT Freesentation', `https://cdn.jsdelivr.net/gh/projectnoonnu/2404@1.0/Freesentation-${file}.woff2`, weight, 'woff2']) },
    nanumsquareneo: { name: '나눔스퀘어 네오', family: '"STT NanumSquareNeo"', fallback: 'sans-serif',
      faces: [['aLt', 300], ['bRg', 400], ['cBd', 700], ['dEb', 800]].map(([file, weight]) =>
        ['STT NanumSquareNeo', `https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareNeo/NanumSquareNeoTTF-${file}.woff`, weight, 'woff']) },
    paperlogy: { name: '페이퍼로지', family: '"STT Paperlogy"', fallback: 'sans-serif',
      faces: [['4Regular', 400], ['5Medium', 500], ['6SemiBold', 600], ['7Bold', 700]].map(([file, weight]) =>
        ['STT Paperlogy', `https://cdn.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-${file}.woff2`, weight, 'woff2']) },
    chosun: { name: '조선일보 명조', family: '"STT Chosun Myungjo"', fallback: 'serif',
      faces: [['STT Chosun Myungjo', 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/Chosunilbo_myungjo.woff', 400, 'woff']] },
    ridi: { name: '리디바탕', family: '"STT RIDIBatang"', fallback: 'serif',
      faces: [['STT RIDIBatang', 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_twelve@1.0/RIDIBatang.woff', 400, 'woff']] },
    nanummyeongjo: { name: '나눔명조', family: '"Nanum Myeongjo"', fallback: 'serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap");' },
    bookk: { name: '부크크 명조', family: '"STT BookkMyungjo"', fallback: 'serif',
      faces: [['Lt', 400], ['Bd', 700]].map(([file, weight]) =>
        ['STT BookkMyungjo', `https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2302@1.0/BookkMyungjo-${file}.woff2`, weight, 'woff2']) },
    leeseoyun: { name: '이서윤체', family: '"STT LeeSeoyun"', fallback: 'sans-serif',
      faces: [['STT LeeSeoyun', 'https://cdn.jsdelivr.net/npm/@noonnu/lee-seoyun@0.1.0/fonts/leeseoyun-normal.woff', 400, 'woff']] },
    kyobo: { name: '교보 손글씨', family: '"STT KyoboHand"', fallback: 'sans-serif',
      faces: [['STT KyoboHand', 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_20-04@1.0/KyoboHand.woff', 400, 'woff']] },
    omyu: { name: '오뮤 다예쁨', family: '"STT OmyuPretty"', fallback: 'sans-serif',
      faces: [['STT OmyuPretty', 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2304-01@1.0/omyu_pretty.woff2', 400, 'woff2']] },
    kkomi: { name: '국립공원 꼬미', family: '"STT KNPSKkomi"', fallback: 'sans-serif',
      faces: [['STT KNPSKkomi', 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2201-2@1.0/KNPSKkomi-Regular00.woff', 400, 'woff']] },
    konkon: { name: '온글잎 콘콘', family: '"STT OwnglyphKonkon"', fallback: 'sans-serif',
      faces: [['STT OwnglyphKonkon', 'https://cdn.jsdelivr.net/gh/projectnoonnu/2412-1@1.0/Ownglyph_corncorn-Rg.woff2', 400, 'woff2']] },
    imhyemin: { name: 'IM혜민', family: '"STT ImHyeMin"', fallback: 'sans-serif',
      faces: [['Regular', 400], ['Bold', 700]].map(([file, weight]) =>
        ['STT ImHyeMin', `https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2106@1.1/IM_Hyemin-${file}.woff2`, weight, 'woff2']) },
    kkakdugi: { name: '깍두기 도면', family: '"STT KkakdugiDrafting"', fallback: 'sans-serif',
      faces: [['Light', 300], ['Regular', 400], ['Bold', 700]].map(([file, weight]) =>
        ['STT KkakdugiDrafting', `https://cdn.jsdelivr.net/gh/Project-Noonnu/2610102356@kkakdugidrafting-extralight/kkakdugidrafting-extralight/KkakdugiDrafting-${file}.woff2`, weight, 'woff2']) },
    cinzel: { name: 'Cinzel', lang: 'en', family: '"Cinzel"', fallback: 'serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap");' },
    josefin: { name: 'Josefin Sans', lang: 'en', family: '"Josefin Sans"', fallback: 'sans-serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;600;700&display=swap");' },
    poiret: { name: 'Poiret One', lang: 'en', family: '"Poiret One"', fallback: 'sans-serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Poiret+One&display=swap");' },
    marcellus: { name: 'Marcellus', lang: 'en', family: '"Marcellus"', fallback: 'serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Marcellus&display=swap");' },
    bodoni: { name: 'Bodoni Moda', lang: 'en', family: '"Bodoni Moda"', fallback: 'serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@400;500;700&display=swap");' },
    montserrat: { name: 'Montserrat', lang: 'en', family: '"Montserrat"', fallback: 'sans-serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap");' },
    spacegrotesk: { name: 'Space Grotesk', lang: 'en', family: '"Space Grotesk"', fallback: 'sans-serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap");' },
    notosansjp: { name: 'Noto Sans JP', lang: 'ja', family: '"Noto Sans JP"', fallback: 'sans-serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap");' },
    mplusrounded: { name: 'M PLUS Rounded 1c', lang: 'ja', family: '"M PLUS Rounded 1c"', fallback: 'sans-serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700&display=swap");' },
    zenmaru: { name: 'Zen Maru Gothic', lang: 'ja', family: '"Zen Maru Gothic"', fallback: 'sans-serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&display=swap");' },
    notoserifjp: { name: 'Noto Serif JP', lang: 'ja', family: '"Noto Serif JP"', fallback: 'serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap");' },
    shippori: { name: 'Shippori Mincho', lang: 'ja', family: '"Shippori Mincho"', fallback: 'serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;600;700&display=swap");' },
    notosanssc: { name: 'Noto Sans SC (간체)', lang: 'zh', family: '"Noto Sans SC"', fallback: 'sans-serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap");' },
    notoserifsc: { name: 'Noto Serif SC (간체)', lang: 'zh', family: '"Noto Serif SC"', fallback: 'serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap");' },
    notosanstc: { name: 'Noto Sans TC (번체)', lang: 'zh', family: '"Noto Sans TC"', fallback: 'sans-serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap");' },
    wenkai: { name: 'LXGW WenKai TC (번체)', lang: 'zh', family: '"LXGW WenKai TC"', fallback: 'serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@300;400;700&display=swap");' },
    zcoolxiaowei: { name: 'ZCOOL XiaoWei (간체)', lang: 'zh', family: '"ZCOOL XiaoWei"', fallback: 'serif',
      css: '@import url("https://fonts.googleapis.com/css2?family=ZCOOL+XiaoWei&display=swap");' },
  };
  const FONT_GROUPS = ['ui', 'chat'];
  const FONT_LIMITS = { size: [70, 160], lineHeight: [70, 200], stroke: [0, 8], spacing: [-10, 20], fade: [0, 80] };
  // stroke / spacing: null = keep the theme's (stroke 0 also removes any stroke the theme added)
  const fontDefaults = () => ({ family: '', langs: { en: '', ja: '', zh: '' }, size: 100, lineHeight: 100, stroke: null, spacing: null });
  // Per-language fonts: the chosen font becomes an alias limited to that language's unicode-range, placed before the main font.
  // Japanese and Chinese share Han characters; if both are set, Han glyphs come from the earlier (Japanese) font.
  const FONT_LANG_ORDER = ['en', 'ja', 'zh'];
  const FONT_LANG_RANGES = {
    en: 'U+0000-024F, U+0259, U+02B0-02FF, U+1E00-1EFF, U+2000-206F, U+20A0-20CF, U+2100-214F, U+2190-21FF',
    ja: 'U+3000-30FF, U+31F0-31FF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF',
    zh: 'U+2E80-2FDF, U+3000-303F, U+3100-312F, U+31A0-31BF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FE30-FE4F, U+FF00-FFEF',
  };
  const langsUsed = g => FONT_LANG_ORDER.some(lang => g.langs?.[lang]);
  // Partial fonts: quotes and corner brackets in message text (SillyTavern wraps them in <q>) plus user-defined open/close characters.
  // No line height option: part of a line cannot have its own line height.
  const MARK_PRESETS = [
    { id: 'quote', name: '따옴표', sample: '" "  “ ”' },
    { id: 'corner', name: '낫표', sample: '「 」  『 』' },
  ];
  const MAX_MARK_RULES = 10;
  // fade: opacity % (0 = unchanged). No color option since colors differ per theme; fading only.
  const MARK_ADJUST = ['size', 'stroke', 'spacing', 'fade'];
  const markStyle = () => ({ family: '', size: 100, stroke: null, spacing: null, fade: 0 });
  const markDefaults = () => MARK_PRESETS.map(p => ({ id: p.id, ...markStyle() }));
  const markUsed = m => !!m.family || m.size !== 100 || m.stroke !== null || m.spacing !== null || m.fade > 0;
  const markChars = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 4);
  // Font tab styles (!important and the same specificity as the panel's other sections)
  const FONT_PANEL_CSS = `
#stt-panel#stt-panel#stt-panel .stt-font-slider { display: grid !important; grid-template-columns: 3.6em minmax(0, 1fr) 6.4em 30px !important; align-items: center !important; gap: 10px !important; margin: 8px 0 0 !important; }
#stt-panel#stt-panel#stt-panel .stt-font-slider.stt-font-slider > input[type="range"] { -webkit-appearance: none !important; appearance: none !important; width: 100% !important; min-width: 0 !important; height: 24px !important; min-height: 24px !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; cursor: pointer !important; }
#stt-panel#stt-panel#stt-panel .stt-font-slider.stt-font-slider > input[type="range"]::-webkit-slider-runnable-track { height: 4px !important; border-radius: 99px !important; background: linear-gradient(to right, var(--stt-accent) var(--stt-fill, 0%), var(--stt-border) var(--stt-fill, 0%)) !important; }
#stt-panel#stt-panel#stt-panel .stt-font-slider.stt-font-slider > input[type="range"]::-moz-range-track { height: 4px !important; border-radius: 99px !important; background: linear-gradient(to right, var(--stt-accent) var(--stt-fill, 0%), var(--stt-border) var(--stt-fill, 0%)) !important; }
#stt-panel#stt-panel#stt-panel .stt-font-slider.stt-font-slider > input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none !important; appearance: none !important; width: 16px !important; height: 16px !important; margin-top: -6px !important; border: 2px solid var(--stt-bg) !important; border-radius: 50% !important; background: var(--stt-accent) !important; box-shadow: 0 0 0 1px var(--stt-accent) !important; }
#stt-panel#stt-panel#stt-panel .stt-font-slider.stt-font-slider > input[type="range"]::-moz-range-thumb { width: 12px !important; height: 12px !important; border: 2px solid var(--stt-bg) !important; border-radius: 50% !important; background: var(--stt-accent) !important; box-shadow: 0 0 0 1px var(--stt-accent) !important; }
#stt-panel#stt-panel#stt-panel .stt-font-slider.stt-font-slider > input[type="range"]:focus-visible { outline: 2px solid var(--stt-accent) !important; outline-offset: 2px !important; border-radius: 4px !important; }
#stt-panel#stt-panel#stt-panel .stt-font-value { font-size: .86em !important; opacity: .8 !important; text-align: right !important; white-space: nowrap !important; }
#stt-panel#stt-panel#stt-panel .stt-font-slider > button { width: 30px !important; height: 30px !important; min-width: 30px !important; min-height: 30px !important; padding: 0 !important; border-color: transparent !important; background: transparent !important; color: var(--stt-muted) !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; }
#stt-panel#stt-panel#stt-panel .stt-font-register { display: grid !important; grid-template-columns: minmax(0, 1fr) auto !important; gap: 8px !important; align-items: center !important; margin: 10px 0 0 !important; }
#stt-panel#stt-panel#stt-panel .stt-font-code { display: block !important; width: 100% !important; min-height: 68px !important; margin: 8px 0 0 !important; padding: 8px 10px !important; resize: vertical !important; color: inherit !important; border: 1px solid var(--stt-border) !important; border-radius: 10px !important; background: var(--stt-wash) !important; box-shadow: none !important; font-family: ui-monospace, monospace !important; font-size: 12px !important; box-sizing: border-box !important; }
#stt-panel#stt-panel#stt-panel .stt-font-chips { display: flex !important; flex-wrap: wrap !important; gap: 6px !important; margin: 12px 0 0 !important; }
#stt-panel#stt-panel#stt-panel .stt-font-chip { display: inline-flex !important; align-items: center !important; gap: 2px !important; padding: 2px 2px 2px 12px !important; border: 1px solid var(--stt-border) !important; border-radius: 999px !important; font-size: .9em !important; }
#stt-panel#stt-panel#stt-panel .stt-font-code::placeholder { color: var(--stt-muted) !important; opacity: .7 !important; }
#stt-panel#stt-panel#stt-panel .stt-font-code:focus-visible { outline: 2px solid var(--stt-accent) !important; outline-offset: 2px !important; }
#stt-panel#stt-panel#stt-panel .stt-font-mark { display: grid !important; grid-template-columns: minmax(0, 8.5em) minmax(0, 1fr) auto !important; align-items: center !important; gap: 10px !important; margin: 8px 0 0 !important; }
#stt-panel#stt-panel#stt-panel .stt-font-mark > span { display: flex !important; flex-direction: column !important; min-width: 0 !important; line-height: 1.25 !important; }
#stt-panel#stt-panel#stt-panel .stt-font-mark > span > small { font-size: .78em !important; opacity: .65 !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
#stt-panel#stt-panel#stt-panel .stt-font-mark > button { width: 30px !important; height: 30px !important; min-width: 30px !important; min-height: 30px !important; padding: 0 !important; }
#stt-panel#stt-panel#stt-panel .stt-font-mark > button.stt-font-mark-toggle { width: 4.6em !important; padding: 0 !important; white-space: nowrap !important; font-size: .86em !important; }
#stt-panel#stt-panel#stt-panel .stt-font-mark-toggle[aria-expanded="true"] { border-color: var(--stt-accent-line) !important; background: var(--stt-wash3) !important; }
#stt-panel#stt-panel#stt-panel .stt-font-mark-adjust { margin: 2px 0 6px 2px !important; padding: 0 0 4px 14px !important; border-left: 2px solid var(--stt-border) !important; }
#stt-panel#stt-panel#stt-panel .stt-font-mark-add { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto !important; gap: 8px !important; align-items: center !important; margin: 14px 0 0 !important; }
#stt-panel#stt-panel#stt-panel .stt-font-marks-custom .stt-font-mark { grid-template-columns: minmax(0, 8.5em) minmax(0, 1fr) auto 30px !important; }\n@media (max-width: 600px) { #stt-panel#stt-panel#stt-panel .stt-font-mark { grid-template-columns: minmax(0, 5em) minmax(0, 1fr) auto !important; gap: 6px !important; } #stt-panel#stt-panel#stt-panel .stt-font-marks-custom .stt-font-mark { grid-template-columns: minmax(0, 5em) minmax(0, 1fr) auto 30px !important; } }
#stt-panel#stt-panel#stt-panel .stt-font-note { display: block !important; margin: 10px 0 0 !important; }
#stt-panel#stt-panel#stt-panel .stt-font-sample { display: block !important; overflow: hidden !important; padding: 0 2px !important; font-family: var(--stt-sample-font, var(--stt-ui-font, inherit)) !important; font-size: 1.02em !important; line-height: 1.5 !important; white-space: nowrap !important; text-overflow: ellipsis !important; opacity: .78 !important; }
#stt-panel#stt-panel#stt-panel select optgroup { background: var(--stt-solid) !important; color: var(--stt-muted) !important; font-style: normal !important; }
#stt-panel#stt-panel#stt-panel .stt-font-chip > button { min-width: 26px !important; min-height: 26px !important; padding: 0 !important; border: 0 !important; background: none !important; }
#stt-panel#stt-panel#stt-panel .stt-font-langs { margin: 14px 0 0 !important; padding-top: 6px !important; border-top: 1px solid var(--stt-border) !important; }
#stt-panel#stt-panel#stt-panel button.stt-font-langs-toggle { display: flex !important; justify-content: flex-start !important; align-items: center !important; gap: 8px !important; width: 100% !important; min-height: 36px !important; margin: 0 !important; padding: 0 4px !important; border: 0 !important; border-radius: 8px !important; background: transparent !important; color: var(--stt-fg) !important; font-size: .84em !important; font-weight: 700 !important; white-space: nowrap !important; }
#stt-panel#stt-panel#stt-panel button.stt-font-langs-toggle::after { content: "" !important; width: 6px !important; height: 6px !important; margin-left: 2px !important; border-right: 2px solid currentColor !important; border-bottom: 2px solid currentColor !important; transform: rotate(-45deg) !important; opacity: .6 !important; }
#stt-panel#stt-panel#stt-panel button.stt-font-langs-toggle[aria-expanded="true"]::after { transform: rotate(45deg) translate(-2px, -2px) !important; }
#stt-panel#stt-panel#stt-panel button.stt-font-langs-toggle:is(:hover, :focus-visible) { background: var(--stt-wash2, var(--stt-wash)) !important; }
#stt-panel#stt-panel#stt-panel .stt-font-langs-body { padding: 8px 0 0 !important; }
#stt-panel#stt-panel#stt-panel .stt-home-cols .stt-font-slider { grid-template-columns: 4.8em minmax(0, 1fr) 4.2em 30px !important; }
#stt-panel#stt-panel#stt-panel .stt-icon-blank::before { content: "" !important; display: block !important; width: .8em !important; height: .8em !important; border: 1.5px dashed var(--stt-faint) !important; border-radius: 4px !important; opacity: .7 !important; }
#stt-panel#stt-panel#stt-panel .stt-sub { margin: 4px 0 2px 2px !important; padding: 0 0 0 14px !important; border-left: 2px solid var(--stt-border) !important; }
#stt-panel#stt-panel#stt-panel .stt-sub[hidden] { display: none !important; }
#stt-panel#stt-panel#stt-panel .stt-home-cols { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; gap: 0 36px !important; align-items: start !important; }
#stt-panel#stt-panel#stt-panel .stt-home-cols > div > .stt-recent-counts:first-child { margin-top: 0 !important; }
@media (max-width: 880px) {
  #stt-panel#stt-panel#stt-panel .stt-home-cols { grid-template-columns: minmax(0, 1fr) !important; }
  #stt-panel#stt-panel#stt-panel .stt-home-cols > div:empty, #stt-panel#stt-panel#stt-panel .stt-home-cols > div[hidden] { display: none !important; }
  #stt-panel#stt-panel#stt-panel .stt-home-cols > div + div > :is(.stt-field, .stt-recent-counts):first-child { margin-top: 12px !important; }
  #stt-panel#stt-panel#stt-panel .stt-home-cols > .stt-sub-narrow { margin: 0 0 2px 2px !important; padding: 0 0 0 14px !important; border-left: 2px solid var(--stt-border) !important; }
  #stt-panel#stt-panel#stt-panel .stt-home-cols > .stt-sub-narrow > .stt-field:first-child { margin-top: 0 !important; padding-top: 12px !important; }
  #stt-panel#stt-panel#stt-panel .stt-home-cols .stt-sub { margin-bottom: 0 !important; }
}
#stt-panel#stt-panel#stt-panel .stt-font-lang { display: grid !important; grid-template-columns: 3.6em minmax(0, 1fr) !important; align-items: center !important; gap: 4px 10px !important; margin: 0 0 10px !important; font-size: inherit !important; }
#stt-panel#stt-panel#stt-panel .stt-font-lang > span:first-child { font-size: .92em !important; }
#stt-panel#stt-panel#stt-panel .stt-font-lang > .stt-font-sample { grid-column: 2 !important; font-size: .92em !important; }
`;
  const CUSTOM_PREFIX = 'custom:';
  const MAX_CUSTOM_FONTS = 20;
  // Custom fonts: keep only @import and @font-face with https URLs from the pasted code; drop all other CSS.
  function cleanFontCss(text) {
    const source = String(text || '').slice(0, 20000);
    const parts = [];
    for (const m of source.matchAll(/@import\s+url\(\s*(['"]?)(https:\/\/[^'")\s]+)\1\s*\)\s*;?/gi)) parts.push(`@import url("${m[2]}");`);
    for (const m of source.matchAll(/@font-face\s*\{([^{}]*)\}/gi)) {
      const body = m[1].replace(/\/\*[\s\S]*?\*\//g, '');
      if (/expression|javascript:|<|>/i.test(body) || [...body.matchAll(/url\(\s*['"]?([^'")\s]+)/gi)].some(u => !/^https:\/\//i.test(u[1]))) continue;
      parts.push(`@font-face {${body.trim().replace(/\s+/g, ' ')}}`);
    }
    return parts.join('\n').slice(0, 8000);
  }
  const fontNameValue = value => cleanString(String(value || '').replace(/["';{}\\<>]/g, ''), 60);
  // Pasted input → { name, css } (a bare font file URL becomes an @font-face)
  function parseCustomFont(name, code) {
    let text = String(code || '').trim();
    // <link> tags (e.g. Google Fonts): pick the stylesheet link, not the preconnect links before it.
    const tags = [...text.matchAll(/<link[^>]*>/gi)].map(m => m[0]);
    const tag = tags.find(t => /rel\s*=\s*["']?stylesheet/i.test(t)) || tags.find(t => /href\s*=\s*["']https:\/\/[^"']*css/i.test(t)) || tags[0];
    const link = tag && /href\s*=\s*["'](https:\/\/[^"']+)["']/i.exec(tag);
    if (link) text = link[1].replace(/&amp;/g, '&');
    const fileUrl = /^https:\/\/\S+\.(woff2?|ttf|otf)(\?\S*)?$/i.exec(text);
    let css;
    if (fileUrl) {
      const fmt = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' }[fileUrl[1].toLowerCase()];
      css = `@font-face { font-family: "${fontNameValue(name)}"; src: url("${text}") format("${fmt}"); font-display: swap; }`;
    } else if (/^https:\/\/\S+$/i.test(text)) css = `@import url("${text}");`;
    else css = cleanFontCss(text);
    const declared = [...css.matchAll(/font-family\s*:\s*(['"]?)([^;'"]+)\1/gi)].map(m => fontNameValue(m[2])).filter(Boolean);
    const finalName = fontNameValue(name) || declared[0] || '';
    if (!css || !finalName) return null;
    return { name: finalName, css };
  }
  // Icons and code keep their fonts.
  const FONT_SKIP = 'i, [class*="fa-"], [class^="ph "], [class*=" ph-"], [class*="material-"], code, pre, pre *, kbd, samp, .hljs, .hljs *';
  const CHAT_TEXT = '#chat .mes .mes_text, #chat .mes .mes_reasoning';

  function createFontController(host, doc) {
    let style = null, base = null, baseKey = '', applied = '';
    let marker = null, markKey = '', markPlan = null;

    // Theme defaults, measured with our style briefly disabled; re-measured only when the theme, font scale or first message changes.
    function measure() {
      const sample = doc.querySelector('#chat .mes .mes_text');   // the message body, not the reasoning block
      const theme = doc.getElementById('custom-style')?.textContent || '';
      const scale = doc.documentElement.style.getPropertyValue('--fontScale') || '';
      const key = `${scale}|${!!sample}|${theme}`;
      if (base && key === baseKey) return base;
      const was = style?.disabled;
      if (style) style.disabled = true;
      const px = (value, size) => value === 'normal' || !value ? size * 1.2 : parseFloat(value);
      const body = host.getComputedStyle(doc.body);
      const bodySize = parseFloat(body.fontSize) || 14;
      const chat = sample ? host.getComputedStyle(sample) : null;
      const chatSize = chat ? parseFloat(chat.fontSize) || bodySize : null;
      base = {
        uiFamily: quoteFamilies(body.fontFamily), chatFamily: quoteFamilies(chat?.fontFamily || body.fontFamily),
        fontScale: parseFloat(host.getComputedStyle(doc.documentElement).getPropertyValue('--fontScale')) || 1,
        bodyLine: px(body.lineHeight, bodySize),
        chatSize, chatLine: chat ? px(chat.lineHeight, chatSize) : null,
      };
      if (style) style.disabled = !!was;
      baseKey = key;
      return base;
    }

    // WebKit returns computed font names unquoted; a name with a part starting with a digit (e.g. '1c') invalidates the whole list, so re-quote.
    const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-\w+|emoji|math|fangsong|inherit|initial)$/i;
    const quoteFamilies = list => String(list || '').split(',').map(name => name.trim()).filter(Boolean)
      .map(name => /^["']/.test(name) || GENERIC.test(name) ? name : `"${name.replace(/["\\]/g, '')}"`).join(', ');

    function fontCss(ids, custom) {
      const out = [];
      for (const id of new Set(ids)) {
        if (id.startsWith(CUSTOM_PREFIX)) {
          const entry = custom.find(f => f.name === id.slice(CUSTOM_PREFIX.length));
          if (!entry) continue;
          for (const line of entry.css.split('\n')) line.startsWith('@import') ? out.unshift(line) : out.push(line);
          continue;
        }
        const face = FONT_FACES[id];
        if (!face) continue;
        if (face.css) out.unshift(face.css);   // @import must come first
        for (const [family, url, weight, format] of face.faces || []) {
          out.push(`@font-face { font-family: "${family}"; src: url("${url}") format("${format}"); font-weight: ${weight}; font-style: normal; font-display: swap; }`);
        }
      }
      return out;
    }

    const stack = id => id.startsWith(CUSTOM_PREFIX) ? `"${id.slice(CUSTOM_PREFIX.length)}", sans-serif` : `${FONT_FACES[id].family}, ${FONT_FACES[id].fallback}`;
    const round = value => Math.round(value * 100) / 100;

    // Per-language aliases: collect the font's @font-face rules (including imported CSS), rename them, and narrow unicode-range to that language.
    const aliasName = (lang, id) => `STT ${lang} ${id}`.replace(/["\\]/g, '');
    const aliases = new Map();   // 'lang|id' → CSS ('' = failed); missing = still loading
    const sheets = new Map();    // CSS URL → Promise<text>
    let lastConfig = null;
    const parseRanges = text => String(text).split(',').map(part => part.trim().replace(/^u\+/i, '')).filter(Boolean).map(part => {
      if (part.includes('?')) return [parseInt(part.replace(/\?/g, '0'), 16), parseInt(part.replace(/\?/g, 'f'), 16)];
      const [from, to = from] = part.split('-');
      return [parseInt(from, 16), parseInt(to, 16)];
    }).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && a <= b);
    const intersect = (left, right) => left.flatMap(([a, b]) => right.map(([c, d]) => [Math.max(a, c), Math.min(b, d)])).filter(([a, b]) => a <= b);
    const rangeText = list => list.map(([a, b]) => a === b ? `U+${a.toString(16)}` : `U+${a.toString(16)}-${b.toString(16)}`).join(', ');
    function fontSources(id, custom) {
      if (id.startsWith(CUSTOM_PREFIX)) {
        const entry = custom.find(f => f.name === id.slice(CUSTOM_PREFIX.length));
        if (!entry) return null;
        const imports = [...entry.css.matchAll(/@import\s+url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map(m => m[1]);
        return { imports, inline: entry.css.replace(/@import[^;]*;/gi, '') };
      }
      const face = FONT_FACES[id];
      if (!face) return null;
      return {
        imports: face.css ? [/url\("([^"]+)"\)/.exec(face.css)[1]] : [],
        inline: (face.faces || []).map(([, url, weight, format]) => `@font-face { src: url("${url}") format("${format}"); font-weight: ${weight}; font-style: normal; font-display: swap; }`).join('\n'),
      };
    }
    function rewrite(text, baseUrl, alias, lang) {
      const allowed = parseRanges(FONT_LANG_RANGES[lang]);
      const out = [];
      for (const [block] of String(text).matchAll(/@font-face\s*\{[^}]*\}/gi)) {
        let body = block.replace(/^@font-face\s*\{|\}$/gi, '');
        const own = /unicode-range\s*:\s*([^;]+)/i.exec(body);
        const ranges = own ? intersect(parseRanges(own[1]), allowed) : allowed;
        if (!ranges.length) continue;
        body = body.replace(/font-family\s*:[^;]*;?/gi, '').replace(/unicode-range\s*:[^;]*;?/gi, '')
          .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (match, quote, url) => { try { return `url("${new URL(url, baseUrl).href}")`; } catch { return match; } });
        out.push(`@font-face { font-family: "${alias}"; ${body.trim().replace(/;?$/, ';')} unicode-range: ${rangeText(ranges)}; }`);
      }
      return out.join('\n');
    }
    function requestAlias(lang, id, custom) {
      const key = `${lang}|${id}`;
      if (aliases.has(key) || !host.fetch) return;
      const source = fontSources(id, custom);
      if (!source) return;
      aliases.set(key, undefined);
      const alias = aliasName(lang, id);
      const fetchSheet = url => {
        if (!sheets.has(url)) sheets.set(url, host.fetch(url).then(r => r.ok ? r.text() : '').catch(() => ''));
        return sheets.get(url).then(text => rewrite(text, url, alias, lang));
      };
      Promise.all(source.imports.map(fetchSheet)).then(parts => {
        aliases.set(key, [rewrite(source.inline, doc.baseURI, alias, lang), ...parts].filter(Boolean).join('\n'));
        if (lastConfig) sync(lastConfig);
      });
    }
    // Group font stack: language aliases (loaded ones only) → main font (or the theme font) → generic family
    function familyStack(group, theme, custom) {
      const parts = [];
      for (const lang of FONT_LANG_ORDER) {
        const id = group.langs?.[lang];
        if (!id) continue;
        requestAlias(lang, id, custom);
        if (aliases.get(`${lang}|${id}`)) parts.push(`"${aliasName(lang, id)}"`);
      }
      if (group.family) return [...parts, stack(group.family)].join(', ');
      return parts.length ? [...parts, theme || 'sans-serif'].join(', ') : '';
    }
    const aliasCss = groups => FONT_LANG_ORDER.flatMap(lang => groups.map(g => g.langs?.[lang] && aliases.get(`${lang}|${g.langs[lang]}`)).filter(Boolean));

    // Partial-font marking: tag each <q> as quote or corner bracket, and wrap user-rule text in <span>.
    // When a message re-renders (streaming, edit, swipe), the observer re-marks only that message.
    const MARK_ROOTS = '.mes_text, .mes_reasoning';
    const MARK_SKIP = 'code, pre, textarea, script, style, [contenteditable="true"], [data-stt-mark]';
    const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    function planMarks(marks) {
      const custom = marks.filter(m => m.open);
      const source = custom.map(m => `(${escapeRe(m.open)}[^\n]+?${escapeRe(m.close)})`).join('|');
      return {
        tagQuotes: marks.some(m => m.id === 'quote' || m.id === 'corner'),
        test: source ? new RegExp(source) : null, find: source ? new RegExp(source, 'g') : null,
        ids: custom.map(m => m.id), key: `${marks.some(m => m.id === 'quote' || m.id === 'corner')}|${source}`,
      };
    }
    function markText(root, plan) {
      if (plan.tagQuotes) for (const q of root.querySelectorAll('q')) {
        const kind = /^\s*[「『]/.test(q.textContent) ? 'corner' : 'quote';
        if (q.dataset.sttQ !== kind) q.dataset.sttQ = kind;
      }
      if (!plan.test) return;
      const walker = doc.createTreeWalker(root, 4);   // NodeFilter.SHOW_TEXT
      const found = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (plan.test.test(node.data) && !node.parentElement?.closest(MARK_SKIP)) found.push(node);
      }
      for (const node of found) {
        const parts = doc.createDocumentFragment();
        let last = 0;
        for (const m of node.data.matchAll(plan.find)) {
          if (m.index > last) parts.append(node.data.slice(last, m.index));
          const span = doc.createElement('span');
          span.dataset.sttMark = plan.ids[m.slice(1).findIndex(Boolean)];
          span.textContent = m[0];
          parts.append(span);
          last = m.index + m[0].length;
        }
        if (last < node.data.length) parts.append(node.data.slice(last));
        node.replaceWith(parts);
      }
    }
    function unmark() {
      for (const span of doc.querySelectorAll('#chat [data-stt-mark]')) {
        const parent = span.parentNode;
        span.replaceWith(span.textContent);
        parent?.normalize();
      }
      for (const q of doc.querySelectorAll('#chat q[data-stt-q]')) delete q.dataset.sttQ;
    }
    function syncMarks(plan) {
      const key = plan?.key || '';
      if (key === markKey && (marker || !plan)) return;
      marker?.disconnect(); marker = null;
      if (markKey) unmark();
      markKey = ''; markPlan = plan;
      const chat = plan && doc.getElementById('chat');
      if (!chat) return;   // no #chat yet; retried on the next sync
      markKey = key;
      for (const root of chat.querySelectorAll(MARK_ROOTS)) markText(root, plan);
      if (!host.MutationObserver) return;
      marker = new host.MutationObserver(records => {
        const roots = new Set();
        for (const record of records) {
          const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
          const inside = target?.closest?.(MARK_ROOTS);
          if (inside) { roots.add(inside); continue; }
          for (const node of record.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.matches(MARK_ROOTS)) roots.add(node);
            else for (const root of node.querySelectorAll(MARK_ROOTS)) roots.add(root);
          }
        }
        // Our own wrapping re-triggers this, but marked text is skipped, so it settles after one extra pass.
        for (const root of roots) if (root.isConnected) markText(root, markPlan);
      });
      marker.observe(chat, { childList: true, subtree: true, characterData: true });
    }

    function sync(config) {
      lastConfig = config;
      const ui = config?.ui || fontDefaults(), chat = config?.chat || fontDefaults();
      const marks = (config?.marks || []).filter(markUsed);
      syncMarks(marks.length ? planMarks(marks) : null);
      const used = marks.length || [ui, chat].some(g => g.family || langsUsed(g) || g.size !== 100 || g.lineHeight !== 100 || g.stroke !== null || g.spacing !== null);
      if (!used) { if (style) { style.remove(); style = null; base = null; baseKey = ''; applied = ''; } return; }
      if (!style) {
        style = doc.createElement('style');
        style.id = 'stt-font-style';
        style.setAttribute('data-stt-owned', '');
      }
      // Must come after the theme style to win; only the theme is checked so we don't fight other styles for the last slot.
      const theme = doc.getElementById('custom-style');
      if (style.parentNode !== doc.head || (theme && theme.compareDocumentPosition(style) & host.Node.DOCUMENT_POSITION_PRECEDING)) doc.head.append(style);
      const b = measure();
      const chatAll = `html body :is(${CHAT_TEXT}), html body :is(${CHAT_TEXT}) :not(${FONT_SKIP})`;
      const custom = config?.custom || [];
      const rules = fontCss([ui.family, chat.family, ...marks.map(m => m.family)].filter(Boolean), custom);
      const uiFamily = familyStack(ui, b.uiFamily, custom), chatFamily = familyStack(chat, b.chatFamily, custom);
      rules.push(...aliasCss([ui, chat]));
      const uiAll = `html body :not(${CHAT_TEXT}, ${CHAT_TEXT.split(', ').map(s => `${s} *`).join(', ')}, ${FONT_SKIP})`;
      // One catch-all-selector rule per group, to keep style recalculation cheap.
      const block = (selector, list) => { const decl = list.filter(Boolean); if (decl.length) rules.push(`${selector} { ${decl.join('; ')}; }`); };
      if (ui.size !== 100) rules.push(`:root:root { --fontScale: ${round(b.fontScale * ui.size / 100)} !important; }`);
      if (uiFamily) rules.push(`html body { font-family: ${uiFamily} !important; }`);
      if (ui.lineHeight !== 100) rules.push(`html body { line-height: ${round(b.bodyLine * ui.size / 100 * ui.lineHeight / 100)}px !important; }`);
      block(uiAll, [
        uiFamily && `font-family: ${uiFamily} !important`,
        ui.stroke !== null && `-webkit-text-stroke-width: ${ui.stroke / 10}px !important`,
        ui.spacing !== null && `letter-spacing: ${ui.spacing / 100}em !important`,
      ]);
      // Message size is independent of the UI font scale: pin it to the theme's base size, then apply only the message ratio.
      const sizeFixed = b.chatSize && (chat.size !== 100 || ui.size !== 100 || chat.lineHeight !== 100);
      if (sizeFixed) rules.push(`html body :is(${CHAT_TEXT}) { font-size: ${round(b.chatSize * chat.size / 100)}px !important; }`);
      block(chatAll, [
        // Unitless line height, so nested text (paragraphs, headings) keeps the same ratio at its own size.
        sizeFixed && `line-height: ${round(b.chatLine / b.chatSize * chat.lineHeight / 100)} !important`,
        chatFamily && `font-family: ${chatFamily} !important`,
        chat.stroke !== null && `-webkit-text-stroke-width: ${chat.stroke / 10}px !important`,
        chat.spacing !== null && `letter-spacing: ${chat.spacing / 100}em !important`,
      ]);
      // Partial fonts share one specificity, so later rules win (user-rule text inside quotes follows the user rule).
      const scope = 'html body #chat#chat .mes :is(.mes_text, .mes_reasoning)';
      for (const mark of [...marks].sort((x, y) => !!x.open - !!y.open)) {
        const target = mark.id === 'quote' ? 'q:not([data-stt-q="corner"])' : mark.id === 'corner' ? 'q[data-stt-q="corner"]' : `[data-stt-mark="${mark.id}"]`;
        block(`${scope} :where(${target}), ${scope} :where(${target}) :where(:not(${FONT_SKIP}))`, [
          mark.family && `font-family: ${stack(mark.family)} !important`,
          mark.stroke !== null && `-webkit-text-stroke-width: ${mark.stroke / 10}px !important`,
          mark.spacing !== null && `letter-spacing: ${mark.spacing / 100}em !important`,
        ]);
        // Size on the wrapper only; applying it to descendants would compound the em.
        if (mark.size !== 100) rules.push(`${scope} :where(${target}) { font-size: ${mark.size / 100}em !important; }`);
        if (mark.fade > 0) rules.push(`${scope} :where(${target}) { opacity: ${round((100 - mark.fade) / 100)} !important; }`);
      }
      const text = rules.join('\n');
      if (text !== applied) { style.textContent = text; applied = text; }
    }

    return { sync, fontCss, stack, themeFamilies: () => measure(), dispose() { lastConfig = null; syncMarks(null); style?.remove(); style = null; base = null; baseKey = ''; applied = ''; } };
  }

  const fontController = createFontController(host, doc);

  // Home screen: clock/date, character search and favorite characters above 'Recent Chats'; plus hiding parts of the home header (version, links).
  // Layout is ours; colors and fonts follow the theme (SillyTavern theme colors and font). Re-inserted whenever SillyTavern redraws the home.
  // order: sits above even decorations the theme draws at the start of the home (::before banners, etc.).
  const homeDefaults = () => ({
    clock: { enabled: false, label: 'NOW', font: '', size: 100, top: 20, bottom: 8, hour12: false, date: true },
    hide: { version: false, links: false, temporary: false, settings: false, recent: false, assistant: false },
    search: false,
    favorites: { enabled: false, style: 'circle' },
  });
  const HOME_CSS = `
#chat .welcomePanel > .stt-home { order: -100 !important; display: flex !important; flex-direction: column; align-items: center; gap: 18px; width: 100%; flex: none; align-self: stretch; min-height: 0; height: auto; box-sizing: border-box; margin: var(--stt-home-top, 20px) 0 var(--stt-home-bottom, 8px); padding: 0; text-align: center; color: var(--SmartThemeBodyColor, inherit); }
#chat .welcomePanel > .stt-home[hidden] { display: none !important; }
.stt-home .stt-clock { display: flex; flex-direction: column; align-items: center; width: 100%; }
.stt-home .stt-clock-label { font-size: 12px; line-height: 1.4; letter-spacing: .32em; opacity: .7; margin: 0 0 4px; padding-left: .32em; white-space: nowrap; }
.stt-home .stt-clock-time { display: flex; align-items: baseline; gap: .12em; font-size: calc(clamp(52px, 11vw, 96px) * var(--stt-clock-scale, 1)); line-height: 1.02; font-variant-numeric: tabular-nums; letter-spacing: .02em; white-space: nowrap; }
.stt-home .stt-clock-ampm { font-size: .26em; letter-spacing: .12em; opacity: .7; }
.stt-home .stt-clock-date { margin-top: 8px; font-size: 13px; letter-spacing: .12em; opacity: .75; white-space: nowrap; }
#chat .welcomePanel > .stt-home .stt-clock-rule.mes_text { all: unset !important; display: block !important; width: min(72%, 440px) !important; margin-top: 4px !important; }
#chat .welcomePanel > .stt-home .stt-clock-rule > hr { width: 100%; }
.stt-home .stt-home-search { position: relative; width: min(100%, 440px); }
.stt-home .stt-home-search input { -webkit-appearance: none; appearance: none; box-sizing: border-box; width: 100%; height: 38px; margin: 0; padding: 0 14px 0 36px; border: 1px solid var(--SmartThemeBorderColor, currentColor); border-radius: 999px; background: color-mix(in srgb, var(--SmartThemeBlurTintColor, transparent) 70%, transparent); color: inherit; font: inherit; font-size: 14px; outline: none; }
.stt-home .stt-home-search input:focus-visible { box-shadow: 0 0 0 2px color-mix(in srgb, var(--SmartThemeQuoteColor, currentColor) 55%, transparent); }
.stt-home .stt-home-search::before { content: ""; position: absolute; z-index: 1; left: 13px; top: 19px; width: 15px; height: 15px; margin-top: -7.5px; background: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='10.5' cy='10.5' r='6.5'/%3E%3Cpath d='M15.5 15.5 20 20'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='10.5' cy='10.5' r='6.5'/%3E%3Cpath d='M15.5 15.5 20 20'/%3E%3C/svg%3E") center / contain no-repeat; opacity: .55; pointer-events: none; }
.stt-home .stt-home-results { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; padding: 4px; border: 1px solid var(--SmartThemeBorderColor, currentColor); border-radius: 14px; background: var(--SmartThemeBlurTintColor, transparent); text-align: left; }
.stt-home [hidden] { display: none !important; }
.stt-home .stt-home-result { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 38px; margin: 0; padding: 4px 10px 4px 4px; border: 0; border-radius: 10px; background: none; color: inherit; font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
.stt-home .stt-home-result:is(:hover, :focus-visible) { background: color-mix(in srgb, currentColor 9%, transparent); outline: none; }
.stt-home .stt-home-result img { width: 30px; height: 30px; flex: none; border-radius: 50%; object-fit: cover; object-position: center top; }
.stt-home .stt-home-result span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.stt-home .stt-home-empty { padding: 8px 10px; font-size: 13px; opacity: .65; }
.stt-home .stt-home-favs { width: 100%; }
.stt-home .stt-fav-list { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.stt-home .stt-fav { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 64px; margin: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; }
.stt-home .stt-fav img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; object-position: center top; box-shadow: 0 0 0 1.5px var(--SmartThemeBorderColor, currentColor); }
.stt-home .stt-fav span { max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 12px; opacity: .85; }
.stt-home .stt-fav:is(:hover, :focus-visible) img { box-shadow: 0 0 0 2px var(--SmartThemeQuoteColor, currentColor); }
.stt-home .stt-fav:focus-visible { outline: none; }
.stt-home .stt-home-favs[data-style="card"] .stt-fav-list { gap: 10px; }
.stt-home .stt-home-favs[data-style="card"] .stt-fav { width: 104px; gap: 0; overflow: hidden; border: 1px solid var(--SmartThemeBorderColor, currentColor); border-radius: 12px; background: var(--SmartThemeBlurTintColor, transparent); }
.stt-home .stt-home-favs[data-style="card"] .stt-fav img { width: 100%; height: auto; aspect-ratio: 3 / 4; border-radius: 0; box-shadow: none; }
.stt-home .stt-home-favs[data-style="card"] .stt-fav span { padding: 6px 8px 7px; font-size: 12.5px; }
.stt-home .stt-home-favs[data-style="card"] .stt-fav:is(:hover, :focus-visible) { border-color: var(--SmartThemeQuoteColor, currentColor); }
@media (max-width: 600px) { .stt-home .stt-fav-list { flex-wrap: nowrap; justify-content: flex-start; overflow-x: auto; scrollbar-width: none; padding: 3px; /* a horizontal scroller also clips vertically, so pad for the avatar's outer ring */ } .stt-home .stt-fav { flex: none; } .stt-home .stt-fav:first-child { margin-left: auto; } .stt-home .stt-fav:last-child { margin-right: auto; } .stt-home .stt-home-favs[data-style="card"] .stt-fav { width: 92px; } }
`;
  function createHomeController() {
    let style = null, node = null, timer = null, config = homeDefaults(), fonts = null, applied = '', query = '';
    const ctxChars = () => context()?.characters || [];
    // The character list order can change on import or creation, so look up by avatar file name at click time.
    const open = avatar => {
      const ctx = context();
      const id = ctx?.characters?.findIndex(c => c?.avatar === avatar) ?? -1;
      if (id >= 0 && ctx.selectCharacterById) ctx.selectCharacterById(id);
    };
    const characterButton = (cls, ch, thumb) => {
      const btn = doc.createElement('button'); btn.type = 'button'; btn.className = cls;
      const img = doc.createElement('img'); img.src = thumb(ch.avatar); img.alt = ''; img.loading = 'lazy';
      const name = doc.createElement('span'); name.textContent = ch.name;
      btn.append(img, name); btn.title = ch.name;
      btn.addEventListener('click', () => open(ch.avatar));
      return btn;
    };
    const thumbMaker = () => {
      const ctx = context();
      return ctx?.getThumbnailUrl ? file => ctx.getThumbnailUrl('avatar', file) : file => `/thumbnail?type=avatar&file=${encodeURIComponent(file)}`;
    };
    const parts = () => {
      const now = new Date();
      let h = now.getHours(); const m = String(now.getMinutes()).padStart(2, '0');
      let ampm = '';
      if (config.clock.hour12) { ampm = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; }
      const day = '일월화수목금토'[now.getDay()];
      return { time: `${String(h).padStart(2, '0')}:${m}`, ampm, date: `${now.getMonth() + 1}월 ${now.getDate()}일 · ${day}` };
    };
    const tick = () => {
      host.clearTimeout(timer); timer = null;
      const clock = node?.isConnected && node.querySelector('.stt-clock');
      if (!clock || clock.hidden) return;
      const { time, ampm, date } = parts();
      const set = (sel, text) => { const el = clock.querySelector(sel); if (el.textContent !== text) el.textContent = text; };
      set('.stt-clock-digits', time); set('.stt-clock-ampm', ampm); set('.stt-clock-date', date);
      clock.querySelector('.stt-clock-ampm').hidden = !ampm;
      const now = new Date();
      timer = host.setTimeout(tick, 60000 - now.getSeconds() * 1000 - now.getMilliseconds() + 50);   // right as the next minute starts
    };
    function build() {
      node = doc.createElement('div');
      node.className = 'stt-home';
      node.setAttribute('data-stt-owned', '');
      node.innerHTML = '<div class="stt-clock" role="timer" aria-label="현재 시각"><div class="stt-clock-label"></div><div class="stt-clock-time"><span class="stt-clock-digits"></span><span class="stt-clock-ampm"></span></div><div class="stt-clock-date"></div><div class="stt-clock-rule mes_text" aria-hidden="true"><hr></div></div>'
        + '<div class="stt-home-search"><input type="search" placeholder="캐릭터 검색" aria-label="캐릭터 검색" autocomplete="off" spellcheck="false"><div class="stt-home-results" role="listbox" hidden></div></div>'
        + '<div class="stt-home-favs" role="group" aria-label="즐겨찾기"><div class="stt-fav-list"></div></div>';
      const input = node.querySelector('.stt-home-search input');
      input.addEventListener('input', () => { query = input.value; renderResults(); });
      input.addEventListener('keydown', event => {
        if (event.isComposing || event.keyCode === 229) return;   // Enter during IME composition only commits the character
        if (event.key === 'Escape') { input.value = ''; query = ''; renderResults(); }
        else if (event.key === 'Enter') { event.preventDefault(); node.querySelector('.stt-home-result')?.click(); }
        else if (event.key === 'ArrowDown') { event.preventDefault(); node.querySelector('.stt-home-result')?.focus(); }
      });
      node.querySelector('.stt-home-results').addEventListener('keydown', event => {
        const items = [...node.querySelectorAll('.stt-home-result')], at = items.indexOf(doc.activeElement);
        if (event.key === 'ArrowDown' && at < items.length - 1) { event.preventDefault(); items[at + 1].focus(); }
        if (event.key === 'ArrowUp') { event.preventDefault(); (at > 0 ? items[at - 1] : input).focus(); }
      });
    }
    function renderResults() {
      const box = node?.querySelector('.stt-home-results');
      if (!box) return;
      const q = query.trim().toLowerCase();
      box.replaceChildren();
      box.hidden = !q;
      if (!q) return;
      const hits = [];
      for (const ch of ctxChars()) if (ch?.name?.toLowerCase().includes(q) && hits.push(ch) >= 8) break;
      if (!hits.length) { const empty = doc.createElement('div'); empty.className = 'stt-home-empty'; empty.textContent = '찾는 캐릭터가 없습니다.'; box.append(empty); return; }
      const thumb = thumbMaker();
      for (const ch of hits) { const btn = characterButton('stt-home-result', ch, thumb); btn.setAttribute('role', 'option'); box.append(btn); }
    }
    function renderFavorites() {
      const wrap = node?.querySelector('.stt-home-favs');
      if (!wrap) return;
      const list = wrap.querySelector('.stt-fav-list');
      const favs = config.favorites.enabled ? ctxChars().filter(ch => ch && (ch.fav === true || ch.fav === 'true')) : [];
      if (wrap.hidden !== !favs.length) wrap.hidden = !favs.length;
      if (wrap.dataset.style !== config.favorites.style) wrap.dataset.style = config.favorites.style;
      const key = favs.map(ch => `${ch.avatar}:${ch.name}`).join('|');
      if (list.dataset.key === key) return;
      list.dataset.key = key;
      const thumb = thumbMaker();
      list.replaceChildren(...favs.map(ch => characterButton('stt-fav', ch, thumb)));
    }
    // Write only on change: every write is seen by the DOM observer and triggers another check.
    const show = (el, on) => { if (el.hidden === on) el.hidden = !on; };
    function paint() {
      const c = config.clock;
      show(node.querySelector('.stt-clock'), c.enabled);
      const label = node.querySelector('.stt-clock-label');
      if (label.textContent !== c.label) label.textContent = c.label;
      show(label, !!c.label);
      show(node.querySelector('.stt-clock-date'), c.date);
      const scale = String(c.size / 100);
      if (node.style.getPropertyValue('--stt-clock-scale') !== scale) node.style.setProperty('--stt-clock-scale', scale);
      const top = `${c.top}px`;
      if (node.style.getPropertyValue('--stt-home-top') !== top) node.style.setProperty('--stt-home-top', top);
      const bottom = `${c.bottom}px`;
      if (node.style.getPropertyValue('--stt-home-bottom') !== bottom) node.style.setProperty('--stt-home-bottom', bottom);
      show(node.querySelector('.stt-home-search'), config.search);
      renderFavorites();
      show(node, c.enabled || config.search || !node.querySelector('.stt-home-favs').hidden);
    }
    const wanted = () => config.clock.enabled || config.search || config.favorites.enabled;
    // Re-insert if the home was redrawn (cheap: only looks up the home panel).
    function ensure() {
      if (!wanted()) return;
      const home = welcomePanel();
      if (!home) return;
      const fresh = node?.parentElement !== home;
      if (!node) build();
      place(home);
      if (fresh) { paint(); renderResults(); tick(); }
    }
    function place(home) {
      if (home.firstElementChild !== node) home.prepend(node);
    }
    function hideCss(h) {
      const out = [];
      if (h.links) out.push('#chat .welcomePanel .welcomeShortcuts > a.menu_button');
      if (h.temporary) out.push('#chat .welcomePanel .welcomeShortcuts > .openTemporaryChat');
      // Settings, collapse and expand buttons together (once hidden, the count and collapse are set from this panel)
      if (h.settings || h.recent) out.push('#chat .welcomePanel :is(.recentChatsSettings, .hideRecentChats, .showRecentChats)');
      // Also the theme's ::before/::after decorations on the header row; if the shortcuts are hidden too, hide the whole row.
      if (h.recent) out.push('#chat .welcomePanel :is(.recentChatsTitle, .welcomeRecent)', '#chat .welcomePanel .welcomeHeader::before', '#chat .welcomePanel .welcomeHeader::after');
      if (h.recent && h.links && h.temporary) out.push('#chat .welcomePanel .welcomeHeader');
      // The assistant's greeting/notice messages on the home (home screen only)
      if (h.assistant) out.push('#chat:has(> .welcomePanel) > .mes');
      if (h.links || h.temporary) out.push('#chat .welcomePanel .welcomeShortcuts > .welcomeShortcutsSeparator');
      if (h.links && h.temporary) out.push('#chat .welcomePanel .welcomeShortcuts');
      // Keep the logo/version space: removing it pushes the manage buttons out of the position the theme set.
      const keep = h.version ? '\n#chat .welcomePanel :is(.welcomeHeaderLogo, .welcomeHeaderVersionDisplay) { visibility: hidden !important; }' : '';
      return keep + (out.length ? `\n${out.join(',\n')} { display: none !important; }` : '');
    }
    function sync(next, fontConfig) {
      const d = homeDefaults();
      config = { ...d, ...next, clock: { ...d.clock, ...next?.clock }, hide: { ...d.hide, ...next?.hide }, favorites: { ...d.favorites, ...next?.favorites } };
      fonts = fontConfig;
      const hide = hideCss(config.hide);
      if (!wanted() && !hide) { dispose(); return; }
      const family = config.clock.font;
      // @import must come first to load; also target nested text so it beats the Font tab's catch-all UI font rule.
      const css = (family ? fontController.fontCss([family], fonts?.custom || []).join('\n') + '\n' : '') + HOME_CSS + hide
        + (family ? `\nhtml body #chat .welcomePanel > .stt-home :is(.stt-clock-time, .stt-clock-time *) { font-family: ${fontController.stack(family)} !important; }` : '');
      if (!style) { style = doc.createElement('style'); style.id = 'stt-home-style'; style.setAttribute('data-stt-owned', ''); doc.head.append(style); }
      if (css !== applied) { style.textContent = css; applied = css; }
      if (!wanted()) { host.clearTimeout(timer); timer = null; node?.remove(); node = null; query = ''; return; }
      if (node?.isConnected) { place(node.parentElement); paint(); tick(); } else ensure();
    }
    function dispose() {
      host.clearTimeout(timer); timer = null;
      node?.remove(); node = null; query = '';
      style?.remove(); style = null; applied = '';
    }
    const onVisible = () => { if (!doc.hidden && node?.isConnected) tick(); };
    doc.addEventListener('visibilitychange', onVisible);
    return {
      sync, ensure,
      favoritesChanged() { if (node?.isConnected) paint(); },
      dispose() { dispose(); doc.removeEventListener('visibilitychange', onVisible); },
    };
  }
  const homeController = createHomeController();

  // Top bar fold: folded by default; pressing the top indicator (handle, dots, shadow) expands it; an outside press or Esc folds it.
  // The chat (#sheld) moves up only while folded; expanded keeps the theme's original layout (theme decorations are sized to the top bar).
  // While a drawer is open (including ones opened by other features), the top bar shows even when folded.
  const foldDefaults = () => ({ mode: 'off', look: 'handle', color: '', hover: true, chatOnly: false });
  const FOLD_NARROW = '(max-width: 1000px)';
  const FOLD_LOOKS = ['handle', 'dots', 'shadow'];
  // Pinned panels count as open drawers: if the panel stays up while the top bar hides, it can't be closed or switched.
  const FOLD_OPEN_DRAWER = '#top-settings-holder .drawer-content.openDrawer';
  // Default indicator color: a gray picked from background brightness, not the text color, so it stays subtle on themes with strong text colors.
  const foldInkFor = color => {
    const [r = 0, g = 0, b = 0] = (String(color).match(/[\d.]+/g) || []).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5 ? '#6e6e6e' : '#d4d4d4';
  };
  const FOLD_CSS = `
/* Raise the chat to the very top (a leftover strip makes the theme background look cut off); the indicator overlays the chat. */
:root[data-stt-topbar] { --stt-fold-gap: 0px; }
:root[data-stt-topbar="folded"]:not([data-stt-drawer]) #sheld { --topBarBlockSize: var(--stt-fold-gap); }
:root[data-stt-topbar] #top-bar { transition: transform .22s ease, opacity .22s ease; }
:root[data-stt-topbar] #top-settings-holder { transition: visibility 0s; }
:root[data-stt-topbar] :is(#top-settings-holder > :not(.drawer), #top-settings-holder > .drawer > .drawer-toggle) { transition: transform .22s ease, opacity .22s ease; }
:root[data-stt-topbar="folded"]:not([data-stt-drawer]) #top-bar { transform: translateY(calc(-100% - 24px)); opacity: 0; }
:root[data-stt-topbar="folded"]:not([data-stt-drawer]) #top-settings-holder { visibility: hidden; transition: visibility 0s linear .22s; }
:root[data-stt-topbar="folded"]:not([data-stt-drawer]) #top-settings-holder .drawer-content { visibility: visible; }
:root[data-stt-topbar="folded"]:not([data-stt-drawer]) :is(#top-settings-holder > :not(.drawer), #top-settings-holder > .drawer > .drawer-toggle) { transform: translateY(-100%); opacity: 0; }
:root[data-stt-drawer] body > .stt-topbar-fold { display: none !important; }
/* Also hide bars extensions insert above the chat (top bar, connection profile row) so a theme's handle on them doesn't overlap the fold indicator; shown again when expanded. */
:root[data-stt-topbar="folded"]:not([data-stt-drawer]) #sheld > :is(#extensionTopBar, #extensionConnectionProfiles) { display: none !important; }
@media (prefers-reduced-motion: reduce) { :root[data-stt-topbar] :is(#top-bar, #top-settings-holder > *, #top-settings-holder > .drawer > .drawer-toggle) { transition: none !important; } }
`;
  // Fold indicator styles. Kept in the always-loaded stylesheet because the panel preview uses the same look.
  const FOLD_INDICATOR_CSS = `
.stt-topbar-fold { all: unset; box-sizing: border-box; position: fixed; z-index: 3006; top: 0; left: 50%; display: flex; align-items: center; justify-content: center; width: 144px; height: 22px; margin-left: -72px; padding-bottom: 4px; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; --stt-fold-a: 60%; --stt-fold-soft: 22%; }
.stt-topbar-fold[hidden], .stt-topbar-fold[aria-expanded="true"] { display: none !important; }
.stt-topbar-fold:focus-visible { outline: 2px solid var(--SmartThemeQuoteColor, currentColor); outline-offset: -2px; border-radius: 10px; --stt-fold-a: 95%; --stt-fold-soft: 36%; }
@media (hover: hover) { .stt-topbar-fold:hover { --stt-fold-a: 95%; --stt-fold-soft: 36%; } }
.stt-topbar-fold > span { display: block; position: relative; width: 32px; height: 4px; border-radius: 999px; background: color-mix(in srgb, var(--stt-fold-ink, #888) var(--stt-fold-a), transparent); transition: width .15s ease, background-color .15s ease, border-color .15s ease; }
@media (hover: hover) { .stt-topbar-fold[data-look="handle"]:hover > span { width: 40px; } }
.stt-topbar-fold[data-look="dots"] > span { width: 4px; height: 4px; border-radius: 50%; box-shadow: -8px 0 0 color-mix(in srgb, var(--stt-fold-ink, #888) var(--stt-fold-a), transparent), 8px 0 0 color-mix(in srgb, var(--stt-fold-ink, #888) var(--stt-fold-a), transparent); }
.stt-topbar-fold[data-look="shadow"] { left: 0; right: 0; width: 100%; height: 20px; margin: 0; padding: 0; align-items: flex-start; }
@media (hover: hover) and (pointer: fine) { .stt-topbar-fold:not([data-look="shadow"]) { left: 0; right: 0; width: 100%; height: 18px; margin: 0; padding: 0; } }
.stt-topbar-fold[data-look="shadow"] > span { width: 100%; height: 18px; border-radius: 0; background: linear-gradient(to bottom, color-mix(in srgb, var(--stt-fold-ink, #888) calc(var(--stt-fold-soft) * 1.35), transparent), transparent); }
`;
  // The panel resets everything inside it (all: revert !important), so the preview gets a copy of these rules scoped to the panel with !important.
  // @media lines (hover effects) are skipped; the preview doesn't need them.
  function foldMockCss() {
    const scope = '#stt-panel#stt-panel#stt-panel .stt-pv-fold';
    const rules = FOLD_INDICATOR_CSS.replace(/(^|\n)([^{\n@}][^{]*)\{([^}]*)\}/g, (all, nl, selector, body) =>
      nl + selector.split(',').map(part => `${scope} ${part.trim()}`).join(', ') + ' {' + body.replace(/;/g, ' !important;') + '}');
    return `${rules}\n${scope} .stt-topbar-fold { position: absolute !important; pointer-events: none !important; }\n`;
  }
  function createTopbarFold() {
    const root = doc.documentElement;
    let config = foldDefaults(), expanded = false, style = null, button = null, media = null, home = false;
    // chatOnly: don't fold on the home screen (no chat open). Home state is re-read only in render/check; elsewhere the cached value is used.
    const onHome = () => !!welcomePanel();
    const active = () => (config.mode === 'all' || (config.mode === 'narrow' && !!media?.matches)) && !(config.chatOnly && home);
    // Skip re-measuring while the theme background value is unchanged (measuring needs a temporary element).
    let inkKey = null, inkValue = '';
    const setAttr = (node, name, value) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };
    function autoInk() {
      const key = host.getComputedStyle(root).getPropertyValue('--SmartThemeBlurTintColor');
      if (key === inkKey) return inkValue;
      const probe = doc.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;color:var(--SmartThemeBlurTintColor, #000)';
      doc.body.append(probe);
      inkValue = foldInkFor(host.getComputedStyle(probe).color);
      probe.remove();
      inkKey = key;
      return inkValue;
    }
    const syncDrawer = () => { const open = !!doc.querySelector(FOLD_OPEN_DRAWER); if (root.hasAttribute('data-stt-drawer') !== open) root.toggleAttribute('data-stt-drawer', open); };
    function render() {
      syncDrawer();
      home = config.chatOnly && onHome();
      if (!active()) {
        root.removeAttribute('data-stt-topbar'); root.removeAttribute('data-stt-topbar-look'); root.style.removeProperty('--stt-fold-ink');
        if (button) button.hidden = true;
        expanded = false;
        return;
      }
      if (!style) { style = doc.createElement('style'); style.id = 'stt-topbar-fold-style'; style.setAttribute('data-stt-owned', ''); style.textContent = FOLD_CSS; doc.head.append(style); }
      if (!button?.isConnected) {
        button = doc.createElement('button'); button.type = 'button'; button.className = 'stt-topbar-fold';
        button.setAttribute('data-stt-owned', ''); button.append(doc.createElement('span'));
        button.addEventListener('click', () => { expanded = true; hoverOpened = false; render(); });
        doc.body.append(button);
      }
      // Write only on change: this runs on every refresh, and needless writes would wake the DOM observer.
      button.hidden = false;
      setAttr(button, 'data-look', config.look);
      setAttr(button, 'aria-expanded', String(expanded));
      setAttr(button, 'aria-label', '상단바 펼치기');
      setAttr(button, 'title', '상단바 펼치기');
      const ink = config.color || autoInk();
      if (root.style.getPropertyValue('--stt-fold-ink') !== ink) root.style.setProperty('--stt-fold-ink', ink);
      setAttr(root, 'data-stt-topbar', expanded ? 'open' : 'folded');
      setAttr(root, 'data-stt-topbar-look', config.look);
      if (!expanded) bottom = null;
    }
    // pointerup fires after SillyTavern closes drawers on an outside press (touchstart/mousedown), so both fold together; scrolling ends in pointercancel and is unaffected.
    // Bars extensions insert above the chat (and a theme's handle on them) don't count as outside presses, so they're usable with the top bar expanded.
    const CHAT_TOP_EXTRAS = '#sheld > :not(#chat, #form_sheld)';
    const IGNORE = `#top-settings-holder, #top-bar, .stt-topbar-fold, ${CHAT_TOP_EXTRAS}, #stt-panel, .popup, dialog, #shadow_popup, #world_popup, #character_popup, .ui-widget, #toast-container, .select2-results, .select2-container`;
    const onPointerUp = event => {
      if (!expanded || !active() || event.button > 0) return;
      const target = event.target;
      if (!target?.closest || target.closest(IGNORE) || doc.querySelector(FOLD_OPEN_DRAWER)) return;
      expanded = false; render();
    };
    const onKey = event => { if (event.key === 'Escape' && expanded && active() && !doc.querySelector(FOLD_OPEN_DRAWER) && !doc.querySelector('#stt-panel[open], dialog[open]')) { expanded = false; render(); } };
    // Desktop: hovering the very top (or the indicator) expands; moving well below the top bar folds it again (not while a drawer is open).
    const fine = host.matchMedia?.('(hover: hover) and (pointer: fine)') || null;
    let hoverOpened = false, leaveTimer = null, bottom = null;
    // The top bar height is fixed while expanded, so measure once instead of reading layout on every mouse move.
    const barBottom = () => bottom ??= Math.max(...['top-settings-holder', 'top-bar'].map(id => doc.getElementById(id)?.getBoundingClientRect().bottom || 0));
    const onMove = event => {
      if (!config.hover || !fine?.matches || !active()) return;
      if (!expanded) {
        if (event.clientY <= 4 || event.target?.closest?.('.stt-topbar-fold')) { expanded = true; hoverOpened = true; render(); }
        return;
      }
      if (!hoverOpened) return;
      if (event.clientY > barBottom() + 24 && !doc.querySelector(FOLD_OPEN_DRAWER) && !event.target?.closest?.(CHAT_TOP_EXTRAS)) {
        if (!leaveTimer) leaveTimer = host.setTimeout(() => {
          leaveTimer = null;
          if (hoverOpened && expanded && !doc.querySelector(FOLD_OPEN_DRAWER)) { expanded = false; hoverOpened = false; render(); }
        }, 350);
      } else { host.clearTimeout(leaveTimer); leaveTimer = null; }
    };
    const onMedia = () => render();
    function sync(next) {
      config = { ...foldDefaults(), ...next };
      if (config.mode === 'off') { dispose(); return; }
      if (!media) { media = host.matchMedia?.(FOLD_NARROW) || null; media?.addEventListener?.('change', onMedia); doc.addEventListener('pointerup', onPointerUp, true); doc.addEventListener('keydown', onKey); doc.addEventListener('pointermove', onMove, { passive: true }); }
      render();
    }
    function dispose() {
      root.removeAttribute('data-stt-topbar'); root.removeAttribute('data-stt-topbar-look'); root.removeAttribute('data-stt-drawer'); root.style.removeProperty('--stt-fold-ink');
      media?.removeEventListener?.('change', onMedia); media = null;
      doc.removeEventListener('pointerup', onPointerUp, true); doc.removeEventListener('keydown', onKey); doc.removeEventListener('pointermove', onMove);
      host.clearTimeout(leaveTimer); leaveTimer = null; hoverOpened = false;
      button?.remove(); button = null; style?.remove(); style = null; expanded = false;
    }
    // On DOM changes (observer), cheaply check only for home ↔ chat switches.
    const check = () => { if (config.mode === 'off') return; syncDrawer(); if (config.chatOnly && onHome() !== home) render(); };
    return { sync, dispose, check };
  }
  const topbarFold = createTopbarFold();

  // Input placeholder: default = SillyTavern's own; hide = empty; custom = replace only the connected text (the no-connection text stays).
  // SillyTavern copies the textarea's connected_text / no_connection_text attributes into placeholder whenever the connection changes, so edit those attributes.
  const inputTextDefaults = () => ({ mode: 'default', text: '' });
  function createInputTextController() {
    let original = null;
    const offline = () => !!doc.getElementById('send_form')?.classList.contains('no-connection');
    function put(node, connected, noConnection) {
      if (node.getAttribute('connected_text') !== connected) node.setAttribute('connected_text', connected);
      if (node.getAttribute('no_connection_text') !== noConnection) node.setAttribute('no_connection_text', noConnection);
      const shown = offline() ? noConnection : connected;
      if (node.getAttribute('placeholder') !== shown) node.setAttribute('placeholder', shown);
    }
    function restore() {
      if (!original) return;
      if (original.node.isConnected) put(original.node, original.connected, original.noConnection);
      original = null;
    }
    function sync(config) {
      const node = doc.getElementById('send_textarea');
      if (!node || !config || config.mode === 'default' || (config.mode === 'custom' && !config.text)) { restore(); return; }
      if (original?.node !== node) {
        restore();
        original = { node, connected: node.getAttribute('connected_text') ?? '', noConnection: node.getAttribute('no_connection_text') ?? '' };
      }
      if (config.mode === 'hide') put(node, '', '');
      else put(node, config.text, original.noConnection);
    }
    return { sync, dispose: restore };
  }
  const inputTextController = createInputTextController();
  const PANEL_CSS = "@font-face { font-family: \"STT Phosphor\"; src: url(\"https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/Phosphor.woff2\") format(\"woff2\"); font-weight: 400; font-style: normal; font-display: block; }\n/* SillyTavern menus and buttons */\n[data-stt-hidden][data-stt-hidden][data-stt-hidden][data-stt-hidden] { display: none !important; }\n[data-stt-ordered-menu]:not([hidden]):not(.displayNone):not([style*=\"display: none\"]):not([style*=\"display:none\"]) { display: flex !important; flex-direction: column; }\n[data-stt-no-glyph][data-stt-no-glyph][data-stt-no-glyph][data-stt-no-glyph]::before { content: \"\" !important; }\n[data-stt-source-color][data-stt-source-color][data-stt-source-color][data-stt-source-color]::before { color: var(--stt-source-color) !important; }\n[data-stt-glyph][data-stt-glyph][data-stt-glyph][data-stt-glyph]::before { content: var(--stt-glyph) !important; font-family: var(--stt-font) !important; font-weight: var(--stt-weight) !important; font-style: normal !important; }\n[data-stt-added-icon][data-stt-added-icon][data-stt-added-icon][data-stt-added-icon] { display: inline-block; margin-inline-end: .5em; pointer-events: none; }\n[data-stt-text] { pointer-events: none; }\n[data-stt-menu-row][data-stt-menu-row][data-stt-menu-row][data-stt-menu-row] { position: relative !important; padding-inline-start: calc(var(--stt-inset, 0px) + var(--stt-slot, 1.4em) + var(--stt-gap, .6em)) !important; text-indent: 0 !important; }\n[data-stt-menu-row][data-stt-menu-row][data-stt-menu-row][data-stt-menu-row][data-stt-menu-no-icon][data-stt-menu-no-icon][data-stt-menu-no-icon][data-stt-menu-no-icon] { padding-inline-start: var(--stt-inset, 4px) !important; }\n[data-stt-menu-label][data-stt-menu-label][data-stt-menu-label][data-stt-menu-label] { margin-inline-start: 0 !important; padding-inline-start: 0 !important; text-indent: 0 !important; }\n[data-stt-menu-icon][data-stt-menu-icon][data-stt-menu-icon][data-stt-menu-icon], [data-stt-menu-root-icon][data-stt-menu-root-icon][data-stt-menu-root-icon][data-stt-menu-root-icon]::before {\n  position: absolute !important; inset-inline-start: var(--stt-inset, 0px) !important;\n  top: 50% !important; translate: 0 -50% !important; width: var(--stt-slot, 1.4em) !important;\n  min-width: 0 !important; margin: 0 !important; padding: 0 !important; text-align: center !important;\n}\n[data-stt-message-button]:not([data-stt-hidden]) { display: inline-flex !important; align-items: center !important; justify-content: center !important; flex: 0 0 auto !important; align-self: center !important; margin: 0 !important; float: none !important; }\n[data-stt-button-glyph][data-stt-button-glyph][data-stt-button-glyph][data-stt-button-glyph]::before { position: static !important; margin: 0 !important; padding: 0 !important; text-indent: 0 !important; translate: none !important; }\n[data-stt-added-icon][data-stt-added-icon][data-stt-added-icon][data-stt-added-icon][data-stt-button-glyph][data-stt-button-glyph][data-stt-button-glyph][data-stt-button-glyph] { margin: 0 !important; }\n[data-stt-extension-layout] { display: grid !important; grid-template-columns: minmax(0, 1fr) !important; grid-template-rows: none !important; grid-auto-flow: row !important; grid-auto-rows: 1px !important; grid-auto-columns: minmax(0, 1fr) !important; align-items: start !important; align-content: start !important; column-gap: 10px !important; row-gap: 0 !important; }\n[data-stt-extension-item] { min-width: 0 !important; width: 100% !important; align-self: start !important; grid-area: auto !important; grid-column: auto !important; grid-row: auto !important; }\n[data-stt-extension-path] { display: contents !important; padding: 0 !important; margin: 0 !important; border: 0 !important; background: transparent !important; }\n#stt-open-wand { cursor: pointer; gap: .6em; align-items: center; order: 90000; }\n#stt-open-wand:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }\n/* Settings panel: neutral, follows theme colors; only warnings and reset get color */\n#stt-panel#stt-panel, #stt-panel#stt-panel :where(*) { all:revert!important; box-sizing:border-box!important; font-family:var(--stt-ui-font,inherit)!important; color:inherit!important; text-shadow:none!important; background-image:none!important; filter:none!important; }\n#stt-panel#stt-panel :where(*)::before, #stt-panel#stt-panel :where(*)::after { all:revert!important; content:none!important; }\n#stt-panel#stt-panel#stt-panel {\n  --stt-bg: var(--SmartThemeBlurTintColor, #1f1f1f) !important;\n  --stt-solid: var(--stt-bg) !important;\n  --stt-fg: var(--SmartThemeBodyColor, #eee) !important;\n  --stt-muted: color-mix(in srgb, var(--stt-fg) 64%, transparent) !important;\n  --stt-faint: color-mix(in srgb, var(--stt-fg) 42%, transparent) !important;\n  --stt-border: color-mix(in srgb, var(--stt-fg) 12%, transparent) !important;\n  --stt-line-strong: color-mix(in srgb, var(--stt-fg) 24%, transparent) !important;\n  --stt-wash: color-mix(in srgb, var(--stt-fg) 5%, transparent) !important;\n  --stt-wash2: color-mix(in srgb, var(--stt-fg) 9%, transparent) !important;\n  --stt-wash3: color-mix(in srgb, var(--stt-fg) 14%, transparent) !important;\n  --stt-accent: var(--stt-fg) !important;\n  --stt-accent-soft: var(--stt-wash3) !important;\n  --stt-accent-line: color-mix(in srgb, var(--stt-fg) 45%, transparent) !important;\n  /* Point color (fixed indigo): only marks \"where am I\" and the main action; everything else follows the theme. */\n  --stt-point: #7b72e9 !important;\n  --stt-point-text: color-mix(in srgb, var(--stt-point) 72%, var(--stt-fg)) !important;\n  --stt-point-soft: color-mix(in srgb, var(--stt-point) 16%, transparent) !important;\n  --stt-point-soft2: color-mix(in srgb, var(--stt-point) 26%, transparent) !important;\n  --stt-point-line: color-mix(in srgb, var(--stt-point) 50%, transparent) !important;\n  --stt-danger: color-mix(in srgb, #e5484d 80%, var(--stt-fg)) !important;\n  --stt-danger-soft: color-mix(in srgb, #e5484d 12%, transparent) !important;\n  --stt-danger-line: color-mix(in srgb, #e5484d 40%, transparent) !important;\n  --stt-warn: color-mix(in srgb, #d99a2b 82%, var(--stt-fg)) !important;\n  --stt-warn-soft: color-mix(in srgb, #e3a33a 14%, transparent) !important;\n  box-sizing: border-box !important; color: var(--stt-fg) !important; background: var(--stt-solid) !important;\n  font-family: var(--stt-ui-font, inherit) !important; font-size: clamp(13px, var(--mainFontSize, 15px), 16px) !important; line-height: 1.45 !important;\n  width: min(960px, calc(100vw - 28px)) !important; max-width: 960px !important;\n  height: min(900px, calc(100dvh - 56px)) !important; max-height: calc(100dvh - 28px) !important;\n  border: 1px solid var(--stt-border) !important; border-radius: 18px !important; padding: 0 !important; margin: auto !important;\n  box-shadow: 0 18px 50px rgba(0,0,0,.22) !important; backdrop-filter: none !important; overflow: hidden !important;\n}\n/* Make translucent theme backgrounds opaque (no show-through behind the dialog, switch knobs, save button text) */\n@supports (color: rgb(from red r g b)) { #stt-panel#stt-panel#stt-panel { --stt-solid: rgb(from var(--stt-bg) r g b / 1) !important; } }\n#stt-panel#stt-panel#stt-panel[open] { display: flex !important; flex-direction: column !important; }\n#stt-panel#stt-panel#stt-panel:focus, #stt-panel#stt-panel#stt-panel:focus-visible { outline: none !important; }\n#stt-panel#stt-panel#stt-panel::backdrop { background:#0009 !important; backdrop-filter:none !important; }\n#stt-panel#stt-panel#stt-panel *, #stt-panel#stt-panel#stt-panel *::before, #stt-panel#stt-panel#stt-panel *::after { box-sizing: border-box !important; text-shadow: none !important; }\n#stt-panel#stt-panel#stt-panel h2, #stt-panel#stt-panel#stt-panel h3, #stt-panel#stt-panel#stt-panel h4, #stt-panel#stt-panel#stt-panel p { padding: 0 !important; margin: 0 !important; }\n#stt-panel#stt-panel#stt-panel h2 { font: inherit !important; font-size: 1.12em !important; font-weight: 700 !important; letter-spacing: -.02em !important; line-height: 1.3 !important; color: inherit !important; }\n#stt-panel#stt-panel#stt-panel h3 { font: inherit !important; font-size: .95em !important; font-weight: 700 !important; letter-spacing: -.01em !important; line-height: 1.35 !important; color: inherit !important; }\n#stt-panel#stt-panel#stt-panel small { font-size: .8em !important; line-height: 1.5 !important; color: var(--stt-muted) !important; }\n\n/* Buttons */\n#stt-panel#stt-panel#stt-panel button, #stt-panel#stt-panel#stt-panel input, #stt-panel#stt-panel#stt-panel select, #stt-panel#stt-panel#stt-panel textarea { font: inherit !important; letter-spacing: normal !important; text-transform: none !important; box-shadow: none !important; margin: 0 !important; }\n#stt-panel#stt-panel#stt-panel button { display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 6px !important; width: auto !important; min-height: 34px !important; padding: 0 13px !important; border: 1px solid var(--stt-border) !important; border-radius: 10px !important; background: var(--stt-wash) !important; color: inherit !important; font-size: .86em !important; font-weight: 600 !important; line-height: 1.2 !important; white-space: nowrap !important; cursor: pointer !important; transition: background .15s, color .15s, border-color .15s !important; }\n#stt-panel#stt-panel#stt-panel button:hover { background: var(--stt-wash2) !important; }\n#stt-panel#stt-panel#stt-panel button:active { background: var(--stt-wash3) !important; }\n#stt-panel#stt-panel#stt-panel button:focus-visible, #stt-panel#stt-panel#stt-panel input:focus-visible, #stt-panel#stt-panel#stt-panel select:focus-visible, #stt-panel#stt-panel#stt-panel textarea:focus-visible, #stt-panel#stt-panel#stt-panel [tabindex]:focus-visible { outline: 2px solid var(--stt-accent-line) !important; outline-offset: 2px !important; }\n#stt-panel#stt-panel#stt-panel .stt-primary { border-color: var(--stt-fg) !important; background: var(--stt-fg) !important; color: var(--stt-solid) !important; }\n#stt-panel#stt-panel#stt-panel .stt-primary:hover { background: color-mix(in srgb, var(--stt-fg) 86%, transparent) !important; }\n#stt-panel#stt-panel#stt-panel .stt-danger { color: var(--stt-danger) !important; }\n#stt-panel#stt-panel#stt-panel .stt-danger:hover { border-color: var(--stt-danger-line) !important; background: var(--stt-danger-soft) !important; }\n#stt-panel#stt-panel#stt-panel .stt-action { min-height: 30px !important; padding: 0 10px !important; gap: 5px !important; font-size: .8em !important; flex-shrink: 0 !important; }\n#stt-panel#stt-panel#stt-panel .stt-action-icon { font-size: 1.15em !important; line-height: 1 !important; opacity: .85 !important; }\n\n/* Inputs */\n#stt-panel#stt-panel#stt-panel input:not([type=\"checkbox\"]):not([type=\"color\"]):not([type=\"file\"]):not([type=\"range\"]), #stt-panel#stt-panel#stt-panel select, #stt-panel#stt-panel#stt-panel textarea { width: 100% !important; min-width: 0 !important; min-height: 36px !important; padding: 6px 11px !important; border: 1px solid var(--stt-border) !important; border-radius: 10px !important; background-color: var(--stt-wash) !important; color: inherit !important; font-size: .92em !important; }\n#stt-panel#stt-panel#stt-panel input::placeholder, #stt-panel#stt-panel#stt-panel textarea::placeholder { color: var(--stt-faint) !important; opacity: .75 !important; }\n#stt-panel#stt-panel#stt-panel select { -webkit-appearance: none !important; appearance: none !important; padding-right: 32px !important; cursor: pointer !important; background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23888' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5'/%3E%3C/svg%3E\") !important; background-repeat: no-repeat !important; background-position: right 11px center !important; background-size: 12px !important; }\n#stt-panel#stt-panel#stt-panel select option { background: var(--stt-solid) !important; color: var(--stt-fg) !important; }\n#stt-panel#stt-panel#stt-panel input[type=\"color\"] { appearance: auto !important; width: 40px !important; height: 34px !important; padding: 2px !important; border: 1px solid var(--stt-border) !important; border-radius: 10px !important; background: transparent !important; cursor: pointer !important; }\n#stt-panel#stt-panel#stt-panel input[hidden] { display: none !important; }\n\n/* On/off switches */\n#stt-panel#stt-panel#stt-panel input[type=\"checkbox\"] { -webkit-appearance: none !important; appearance: none !important; position: relative !important; display: inline-block !important; flex: none !important; width: 38px !important; height: 22px !important; min-width: 38px !important; min-height: 22px !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 999px !important; background: var(--stt-wash3) !important; cursor: pointer !important; transition: background .15s !important; }\n#stt-panel#stt-panel#stt-panel input[type=\"checkbox\"]::before { content: \"\" !important; position: absolute !important; top: 3px !important; left: 3px !important; width: 16px !important; height: 16px !important; border-radius: 50% !important; background: #fff !important; box-shadow: 0 1px 2px rgba(0,0,0,.3) !important; transition: transform .15s !important; }\n#stt-panel#stt-panel#stt-panel input[type=\"checkbox\"]:checked { background: var(--stt-fg) !important; }\n#stt-panel#stt-panel#stt-panel input[type=\"checkbox\"]:checked::before { transform: translateX(16px) !important; background: var(--stt-solid) !important; }\n#stt-panel#stt-panel#stt-panel input[type=\"checkbox\"]:disabled { opacity: .45 !important; cursor: not-allowed !important; }\n#stt-panel#stt-panel#stt-panel .stt-check { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 14px !important; min-height: 34px !important; margin: 0 !important; padding: 5px 0 !important; font-size: .92em !important; cursor: pointer !important; }\n#stt-panel#stt-panel#stt-panel .stt-check + :is(.stt-field, .stt-form-grid) { margin-top: 10px !important; }\n#stt-panel#stt-panel#stt-panel .stt-check:has(small) { align-items: flex-start !important; }\n#stt-panel#stt-panel#stt-panel .stt-check:has(small) > input { margin-top: 1px !important; }\n#stt-panel#stt-panel#stt-panel .stt-check-text { display: flex !important; flex-direction: column !important; gap: 1px !important; min-width: 0 !important; font-weight: 500 !important; word-break: keep-all !important; overflow-wrap: anywhere !important; }\n#stt-panel#stt-panel#stt-panel .stt-check-text small { font-size: .86em !important; font-weight: 400 !important; }\n\n/* Header and tabs */\n#stt-panel#stt-panel#stt-panel .stt-header { display: flex !important; align-items: center !important; gap: 12px !important; padding: 14px 14px 12px 18px !important; flex-shrink: 0 !important; }\n#stt-panel#stt-panel#stt-panel .stt-brand { display: flex !important; align-items: center !important; gap: 11px !important; min-width: 0 !important; margin-right: auto !important; }\n#stt-panel#stt-panel#stt-panel .stt-logo { display: grid !important; place-items: center !important; flex: none !important; width: 36px !important; height: 36px !important; border-radius: 11px !important; background: var(--stt-wash2) !important; }\n#stt-panel#stt-panel#stt-panel .stt-logo .stt-icon-preview { width: auto !important; flex: none !important; font-size: 1.05em !important; }\n#stt-panel#stt-panel#stt-panel .stt-brand > div { display: flex !important; align-items: center !important; gap: 8px !important; min-width: 0 !important; }\n#stt-panel#stt-panel#stt-panel .stt-version { padding: 1px 8px !important; border-radius: 999px !important; background: var(--stt-wash2) !important; color: var(--stt-muted) !important; font-size: .72em !important; font-weight: 600 !important; white-space: nowrap !important; }\n#stt-panel#stt-panel#stt-panel .stt-style-toggle { min-height: 34px !important; padding: 0 12px 0 8px !important; gap: 4px !important; border-color: transparent !important; background: transparent !important; color: var(--stt-muted) !important; font-size: .82em !important; }\n#stt-panel#stt-panel#stt-panel .stt-style-toggle:hover { background: var(--stt-wash2) !important; color: var(--stt-fg) !important; }\n#stt-panel#stt-panel#stt-panel .stt-style-toggle .stt-style-short { display: none !important; }\n#stt-panel#stt-panel#stt-panel .stt-tabs { display: flex !important; align-items: center !important; gap: 4px !important; padding: 0 12px 10px !important; border-bottom: 1px solid var(--stt-border) !important; flex-shrink: 0 !important; overflow-x: auto !important; overflow-y: hidden !important; overscroll-behavior: contain !important; touch-action: pan-x !important; scrollbar-width: none !important; mask-image: linear-gradient(to right,transparent,#000 var(--stt-tabs-left,0px),#000 calc(100% - var(--stt-tabs-right,0px)),transparent) !important; -webkit-mask-image: linear-gradient(to right,transparent,#000 var(--stt-tabs-left,0px),#000 calc(100% - var(--stt-tabs-right,0px)),transparent) !important; }\n#stt-panel#stt-panel#stt-panel .stt-tabs::-webkit-scrollbar { display: none !important; }\n#stt-panel#stt-panel#stt-panel .stt-tabs button { flex: 0 0 auto !important; gap: 7px !important; min-height: 38px !important; padding: 0 13px !important; border: 0 !important; border-radius: 11px !important; background: transparent !important; color: var(--stt-muted) !important; font-size: .86em !important; }\n#stt-panel#stt-panel#stt-panel .stt-tabs button:hover { background: var(--stt-wash) !important; color: var(--stt-fg) !important; }\n#stt-panel#stt-panel#stt-panel .stt-tabs [aria-selected=\"true\"], #stt-panel#stt-panel#stt-panel .stt-tabs [aria-selected=\"true\"]:hover { background: var(--stt-wash2) !important; color: var(--stt-fg) !important; }\n#stt-panel#stt-panel#stt-panel .stt-tabs .stt-icon-preview { width: auto !important; flex: none !important; font-size: 1.02em !important; }\n#stt-panel#stt-panel#stt-panel .stt-tab-count { min-width: 1.6em !important; padding: 0 5px !important; border-radius: 999px !important; background: var(--stt-wash2) !important; font-size: .82em !important; font-weight: 600 !important; font-variant-numeric: tabular-nums !important; line-height: 1.5 !important; }\n#stt-panel#stt-panel#stt-panel .stt-tabs [aria-selected=\"true\"] .stt-tab-count { background: var(--stt-wash3) !important; }\n#stt-panel#stt-panel#stt-panel .stt-tabs [data-stt-off=\"true\"] { opacity: .55 !important; }\n#stt-panel#stt-panel#stt-panel .stt-tabs [data-stt-off=\"true\"] .stt-tab-label { text-decoration: line-through !important; text-decoration-thickness: 1px !important; }\n\n/* Body and cards */\n#stt-panel#stt-panel#stt-panel .stt-content { flex: 1 1 auto !important; min-height: 0 !important; padding: 16px 18px !important; overflow-y: auto !important; overscroll-behavior: contain !important; scrollbar-width: thin !important; }\n#stt-panel#stt-panel#stt-panel .stt-duo { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; gap: 14px !important; align-items: stretch !important; margin: 0 0 14px !important; }\n#stt-panel#stt-panel#stt-panel .stt-duo > .stt-common { margin: 0 !important; height: 100% !important; }\n#stt-panel#stt-panel#stt-panel .stt-duo > .stt-duo-wide { grid-column: 1 / -1 !important; height: auto !important; }\n#stt-panel#stt-panel#stt-panel .stt-common { padding: 16px 18px !important; margin: 0 0 14px !important; border: 0 !important; border-radius: 14px !important; background: var(--stt-wash) !important; }\n#stt-panel#stt-panel#stt-panel .stt-common > h3 { margin: 0 0 10px !important; }\n#stt-panel#stt-panel#stt-panel .stt-common > h3 + .stt-check, #stt-panel#stt-panel#stt-panel .stt-common-heading + .stt-check { margin-top: -4px !important; }\n#stt-panel#stt-panel#stt-panel .stt-common p { margin: 4px 0 12px !important; color: var(--stt-muted) !important; font-size: .8em !important; line-height: 1.55 !important; }\n#stt-panel#stt-panel#stt-panel .stt-common p:empty, #stt-panel#stt-panel#stt-panel .stt-content p:empty { display: none !important; }\n#stt-panel#stt-panel#stt-panel .stt-common > *:last-child, #stt-panel#stt-panel#stt-panel .stt-common .stt-field:last-child { margin-bottom: 0 !important; }\n#stt-panel#stt-panel#stt-panel .stt-common-heading { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; margin: -4px 0 12px !important; }\n#stt-panel#stt-panel#stt-panel .stt-common-fields { display: grid !important; grid-template-columns: 1fr 1fr 1.4fr !important; gap: 12px !important; }\n#stt-panel#stt-panel#stt-panel .stt-form-grid { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; gap: 0 16px !important; }\n#stt-panel#stt-panel#stt-panel .stt-common .stt-form-grid > .stt-field { margin-bottom: 12px !important; }\n#stt-panel#stt-panel#stt-panel .stt-common > .stt-form-grid:last-child { margin-bottom: -12px !important; }\n#stt-panel#stt-panel#stt-panel .stt-common .stt-field { margin-bottom: 10px !important; }\n#stt-panel#stt-panel#stt-panel .stt-recent-counts { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; gap: 0 12px !important; margin: 4px 0 2px 2px !important; padding: 2px 0 0 14px !important; border-left: 2px solid var(--stt-border) !important; }\n#stt-panel#stt-panel#stt-panel .stt-recent-counts[hidden] { display: none !important; }\n#stt-panel#stt-panel#stt-panel .stt-recent-counts > small { grid-column: 1 / -1 !important; margin: -2px 0 2px !important; }\n#stt-panel#stt-panel#stt-panel .stt-recent-counts > .stt-check { grid-column: 1 / -1 !important; margin-bottom: 6px !important; }\n#stt-panel#stt-panel#stt-panel .stt-recent-counts > .stt-field { margin-top: 0 !important; }\n#stt-panel#stt-panel#stt-panel .stt-off-note { display: block !important; margin: 0 0 14px !important; padding: 10px 14px !important; border-radius: 12px !important; background: var(--stt-warn-soft) !important; color: var(--stt-warn) !important; font-size: .86em !important; font-weight: 500 !important; }\n#stt-panel#stt-panel#stt-panel .stt-empty { display: flex !important; flex-direction: column !important; align-items: center !important; gap: 8px !important; padding: 44px 20px !important; color: var(--stt-muted) !important; font-size: .9em !important; text-align: center !important; }\n\n/* Item fields */\n#stt-panel#stt-panel#stt-panel .stt-field { display: flex !important; flex-direction: column !important; gap: 6px !important; width: 100% !important; margin: 0 0 14px !important; }\n#stt-panel#stt-panel#stt-panel .stt-field-label { font-size: .86em !important; font-weight: 600 !important; color: var(--stt-fg) !important; }\n#stt-panel#stt-panel#stt-panel .stt-color-control { display: flex !important; align-items: center !important; gap: 8px !important; }\n#stt-panel#stt-panel#stt-panel .stt-color-value { flex: 0 1 auto !important; min-width: 0 !important; color: var(--stt-muted) !important; font-size: .8em !important; font-variant-numeric: tabular-nums !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }\n#stt-panel#stt-panel#stt-panel .stt-color-control button { min-height: 30px !important; padding: 0 10px !important; font-size: .8em !important; }\n\n/* Item list and item settings */\n#stt-panel#stt-panel#stt-panel .stt-toolbar { display: flex !important; gap: 8px !important; margin: 0 !important; }\n#stt-panel#stt-panel#stt-panel .stt-toolbar input { flex: 1 !important; }\n#stt-panel#stt-panel#stt-panel .stt-toolbar button { flex-shrink: 0 !important; }\n#stt-panel#stt-panel#stt-panel .stt-editor { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; gap: 14px !important; min-height: 320px !important; }\n#stt-panel#stt-panel#stt-panel .stt-list { display: flex !important; flex-direction: column !important; gap: 6px !important; min-height: 250px !important; max-height: 54dvh !important; overflow-y: auto !important; overscroll-behavior: contain !important; scrollbar-width: thin !important; scrollbar-color: var(--stt-wash3) transparent !important; }\n#stt-panel#stt-panel#stt-panel .stt-list::-webkit-scrollbar { width: 6px !important; }\n#stt-panel#stt-panel#stt-panel .stt-list::-webkit-scrollbar-track { background: transparent !important; }\n#stt-panel#stt-panel#stt-panel .stt-list::-webkit-scrollbar-thumb { background: var(--stt-wash3) !important; border-radius: 8px !important; }\n/* Opaque item background so the browser's drag image is not see-through */\n#stt-panel#stt-panel#stt-panel .stt-row { display: flex !important; align-items: center !important; gap: 10px !important; min-height: 48px !important; padding: 9px 12px !important; border: 0 !important; border-radius: 12px !important; background: color-mix(in srgb, var(--stt-fg) 5%, var(--stt-solid)) !important; cursor: pointer !important; transition: background .15s, box-shadow .15s !important; -webkit-user-drag: element !important; user-select: none !important; }\n#stt-panel#stt-panel#stt-panel .stt-row > span { -webkit-user-drag: none !important; }\n#stt-panel#stt-panel#stt-panel .stt-row:hover { background: color-mix(in srgb, var(--stt-fg) 9%, var(--stt-solid)) !important; }\n#stt-panel#stt-panel#stt-panel .stt-row[aria-pressed=\"true\"] { background: color-mix(in srgb, var(--stt-fg) 9%, var(--stt-solid)) !important; box-shadow: inset 0 0 0 1.5px var(--stt-accent-line) !important; }\n#stt-panel#stt-panel#stt-panel .stt-row.stt-drop { box-shadow: inset 0 2px 0 var(--stt-fg) !important; }\n#stt-panel#stt-panel#stt-panel .stt-row.stt-drop-after { box-shadow: inset 0 -2px 0 var(--stt-fg) !important; }\n#stt-panel#stt-panel#stt-panel .stt-grip { color: var(--stt-faint) !important; cursor: grab !important; font-size: 1.1em !important; }\n#stt-panel#stt-panel#stt-panel .stt-icon-preview { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 26px !important; flex: 0 0 26px !important; font-size: 1.15em !important; line-height: 1.2 !important; }\n#stt-panel#stt-panel#stt-panel .stt-row-copy { display: flex !important; flex-direction: column !important; flex: 1 !important; min-width: 0 !important; gap: 1px !important; }\n#stt-panel#stt-panel#stt-panel .stt-row-copy strong { font-size: .94em !important; font-weight: 600 !important; overflow-wrap: anywhere !important; }\n#stt-panel#stt-panel#stt-panel .stt-row-copy small { font-size: .76em !important; overflow-wrap: anywhere !important; }\n#stt-panel#stt-panel#stt-panel .stt-row-hide { flex: 0 0 auto !important; min-height: 28px !important; padding: 0 9px !important; border-color: transparent !important; background: transparent !important; color: var(--stt-muted) !important; font-size: .76em !important; }\n#stt-panel#stt-panel#stt-panel .stt-row-hide:hover { background: var(--stt-wash3) !important; color: var(--stt-fg) !important; }\n#stt-panel#stt-panel#stt-panel .stt-row-locked, #stt-panel#stt-panel#stt-panel .stt-locked-note { color: var(--stt-faint) !important; font-size: .76em !important; }\n#stt-panel#stt-panel#stt-panel .stt-detail { width: 100% !important; min-width: 0 !important; flex-shrink: 0 !important; align-self: start !important; padding: 16px 18px !important; border: 0 !important; border-radius: 14px !important; background: var(--stt-wash) !important; }\n#stt-panel#stt-panel#stt-panel .stt-detail-heading { display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 8px !important; margin-bottom: 16px !important; overflow-wrap: anywhere !important; }\n#stt-panel#stt-panel#stt-panel .stt-detail-heading h3 { flex: 1 1 auto !important; min-width: 0 !important; font-size: 1em !important; }\n#stt-panel#stt-panel#stt-panel .stt-original { margin: -8px 0 14px !important; color: var(--stt-muted) !important; font-size: .78em !important; overflow-wrap: anywhere !important; }\n#stt-panel#stt-panel#stt-panel .stt-inline-actions { display: flex !important; flex: 0 0 auto !important; flex-wrap: nowrap !important; gap: 4px !important; margin: 0 0 0 auto !important; }\n#stt-panel#stt-panel#stt-panel .stt-state { margin-top: 16px !important; padding-top: 12px !important; border-top: 1px solid var(--stt-border) !important; }\n#stt-panel#stt-panel#stt-panel .stt-state summary { font-size: .88em !important; font-weight: 600 !important; cursor: pointer !important; }\n#stt-panel#stt-panel#stt-panel .stt-state p { margin: 8px 0 !important; color: var(--stt-muted) !important; font-size: .8em !important; line-height: 1.55 !important; }\n#stt-panel#stt-panel#stt-panel .stt-picker { margin: -4px 0 14px !important; padding: 10px !important; border: 1px solid var(--stt-border) !important; border-radius: 12px !important; }\n#stt-panel#stt-panel#stt-panel .stt-picker > input { margin-top: 8px !important; }\n#stt-panel#stt-panel#stt-panel .stt-icon-grid { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(38px, 1fr)) !important; gap: 4px !important; max-height: 170px !important; margin: 8px 0 !important; overflow-y: auto !important; scrollbar-width: thin !important; }\n#stt-panel#stt-panel#stt-panel .stt-icon-grid .stt-icon-empty { display: block !important; grid-column: 1 / -1 !important; width: 100% !important; color: var(--stt-muted) !important; line-height: 1.5 !important; white-space: normal !important; overflow-wrap: anywhere !important; }\n#stt-panel#stt-panel#stt-panel .stt-icon-grid button { display: grid !important; place-items: center !important; min-width: 0 !important; min-height: 38px !important; padding: 6px 3px !important; border-color: transparent !important; border-radius: 9px !important; }\n#stt-panel#stt-panel#stt-panel .stt-icon-grid [aria-pressed=\"true\"] { background: var(--stt-wash3) !important; box-shadow: inset 0 0 0 1.5px var(--stt-accent-line) !important; }\n#stt-panel#stt-panel#stt-panel .stt-icon-more { display: block !important; width: 100% !important; min-height: 32px !important; padding: 0 10px !important; border-style: dashed !important; background: transparent !important; color: var(--stt-muted) !important; font-size: .8em !important; }\n\n/* Footer */\n#stt-panel#stt-panel#stt-panel .stt-live { flex-shrink: 0 !important; min-height: 0 !important; padding: 6px 18px !important; color: var(--stt-muted) !important; font-size: .8em !important; }\n#stt-panel#stt-panel#stt-panel .stt-live[data-error=\"true\"] { color: var(--stt-danger) !important; font-weight: 600 !important; }\n#stt-panel#stt-panel#stt-panel .stt-footer { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 10px !important; flex-shrink: 0 !important; padding: 12px 18px !important; border-top: 1px solid var(--stt-border) !important; }\n#stt-panel#stt-panel#stt-panel .stt-utilities, #stt-panel#stt-panel#stt-panel .stt-save-actions { display: flex !important; gap: 4px !important; flex-wrap: wrap !important; }\n#stt-panel#stt-panel#stt-panel .stt-utilities button { min-height: 32px !important; padding: 0 10px !important; border-color: transparent !important; background: transparent !important; color: var(--stt-muted) !important; font-size: .8em !important; font-weight: 500 !important; }\n#stt-panel#stt-panel#stt-panel .stt-utilities button:hover { background: var(--stt-wash2) !important; color: var(--stt-fg) !important; }\n#stt-panel#stt-panel#stt-panel .stt-utilities button.stt-danger { color: var(--stt-danger) !important; }\n#stt-panel#stt-panel#stt-panel .stt-utilities button.stt-danger:hover { background: var(--stt-danger-soft) !important; }\n/* Area on/off: stands out from other footer text buttons (leading dot = on; yellow background when off) */\n#stt-panel#stt-panel#stt-panel .stt-utilities .stt-area-toggle { gap: 7px !important; margin-right: 6px !important; padding: 0 12px 0 10px !important; border-color: var(--stt-border) !important; background: var(--stt-wash) !important; color: var(--stt-fg) !important; font-weight: 600 !important; }\n#stt-panel#stt-panel#stt-panel .stt-utilities .stt-area-toggle::before { content: \"\" !important; display: block !important; width: 7px !important; height: 7px !important; border-radius: 50% !important; background: currentColor !important; }\n#stt-panel#stt-panel#stt-panel .stt-utilities .stt-area-toggle:hover { background: var(--stt-wash3) !important; }\n#stt-panel#stt-panel#stt-panel .stt-utilities .stt-area-toggle[aria-pressed=\"true\"] { border-color: color-mix(in srgb, var(--stt-warn) 45%, transparent) !important; background: var(--stt-warn-soft) !important; color: var(--stt-warn) !important; }\n#stt-panel#stt-panel#stt-panel .stt-utilities .stt-area-toggle[aria-pressed=\"true\"]::before { background: transparent !important; box-shadow: inset 0 0 0 1.5px currentColor !important; }\n#stt-panel#stt-panel#stt-panel .stt-save-actions { flex-shrink: 0 !important; gap: 6px !important; }\n#stt-panel#stt-panel#stt-panel .stt-save-actions button { min-height: 36px !important; padding: 0 16px !important; }\n#stt-panel#stt-panel#stt-panel [hidden], #stt-panel#stt-panel#stt-panel .stt-live:empty { display: none !important; }\n\n@media (max-width: 880px) { #stt-panel#stt-panel#stt-panel .stt-duo { grid-template-columns: minmax(0, 1fr) !important; gap: 12px !important; margin-bottom: 12px !important; } }\n@media (max-width: 700px) {\n  #stt-panel#stt-panel#stt-panel { width: 100vw !important; max-width: none !important; height: 100dvh !important; max-height: none !important; margin: 0 !important; inset: 0 !important; border: 0 !important; border-radius: 0 !important; }\n  #stt-panel#stt-panel#stt-panel .stt-header { padding: max(12px, env(safe-area-inset-top)) 10px 10px 14px !important; gap: 8px !important; }\n  #stt-panel#stt-panel#stt-panel .stt-tabs { padding: 0 8px 8px !important; gap: 2px !important; }\n  #stt-panel#stt-panel#stt-panel .stt-tabs button { min-height: 36px !important; padding: 0 11px !important; }\n  #stt-panel#stt-panel#stt-panel .stt-content { padding: 12px !important; }\n  #stt-panel#stt-panel#stt-panel .stt-common, #stt-panel#stt-panel#stt-panel .stt-detail { padding: 14px !important; }\n  #stt-panel#stt-panel#stt-panel .stt-editor { grid-template-columns: minmax(0, 1fr) !important; min-height: 0 !important; gap: 10px !important; }\n  #stt-panel#stt-panel#stt-panel .stt-list { min-height: 0 !important; max-height: none !important; overflow: visible !important; }\n  #stt-panel#stt-panel#stt-panel .stt-row { min-height: 50px !important; padding: 9px 10px !important; }\n  #stt-panel#stt-panel#stt-panel .stt-common-fields { grid-template-columns: 1fr 1fr !important; }\n  #stt-panel#stt-panel#stt-panel .stt-common-fields > .stt-field:last-child { grid-column: 1 / -1 !important; }\n  #stt-panel#stt-panel#stt-panel .stt-form-grid { grid-template-columns: minmax(0, 1fr) !important; }\n  #stt-panel#stt-panel#stt-panel .stt-live { padding: 6px 12px !important; }\n}\n@media (max-width: 640px) {\n  #stt-panel#stt-panel#stt-panel .stt-action .stt-action-text { display: none !important; }\n  #stt-panel#stt-panel#stt-panel .stt-inline-actions .stt-action { width: 32px !important; padding: 0 !important; }\n  #stt-panel#stt-panel#stt-panel .stt-footer { flex-wrap: nowrap !important; gap: 8px !important; padding: 10px 10px max(10px, env(safe-area-inset-bottom)) !important; }\n  #stt-panel#stt-panel#stt-panel .stt-utilities { flex: 0 1 auto !important; flex-wrap: nowrap !important; gap: 0 !important; }\n  #stt-panel#stt-panel#stt-panel .stt-utilities button { padding: 0 6px !important; font-size: 11px !important; }\n  #stt-panel#stt-panel#stt-panel .stt-utilities .stt-area-toggle { gap: 5px !important; margin-right: 4px !important; padding: 0 9px 0 8px !important; }\n  #stt-panel#stt-panel#stt-panel .stt-save-actions { flex-wrap: nowrap !important; gap: 4px !important; margin-left: auto !important; }\n  #stt-panel#stt-panel#stt-panel .stt-save-actions button { padding: 0 11px !important; font-size: 12.5px !important; }\n}\n@media (max-width: 600px) {\n  #stt-panel#stt-panel#stt-panel .stt-style-toggle { padding: 0 8px 0 6px !important; }\n  #stt-panel#stt-panel#stt-panel .stt-style-toggle .stt-style-long { display: none !important; }\n  #stt-panel#stt-panel#stt-panel .stt-style-toggle .stt-style-short { display: inline !important; }\n}\n@media (max-width: 420px) { #stt-panel#stt-panel#stt-panel .stt-version { display: none !important; } }\n@media (prefers-reduced-motion: reduce) { #stt-panel#stt-panel#stt-panel button, #stt-panel#stt-panel#stt-panel .stt-row, #stt-panel#stt-panel#stt-panel input[type=\"checkbox\"], #stt-panel#stt-panel#stt-panel input[type=\"checkbox\"]::before { transition: none !important; } }\n/* QR bar */\n.stt-qr-shell { width:100%; min-width:0; flex:0 0 100%; order:1; }\n.stt-qr-reveal { display:grid; grid-template-rows:1fr; opacity:1; transition:grid-template-rows .18s ease,opacity .18s ease,transform .18s ease; transform:translateY(0); }\n.stt-qr-shell[data-open=\"false\"] .stt-qr-reveal { grid-template-rows:0fr; opacity:0; transform:translateY(8px); pointer-events:none; }\n.stt-qr-body { min-height:0; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; }\n.stt-qr-row { display:flex; width:100%; min-width:0; align-items:center; gap:4px; }\n.stt-qr-viewport { flex:1 1 auto; min-width:0; overflow-x:auto; overscroll-behavior-x:contain; scrollbar-width:none; }\n.stt-qr-shell .qr--button { flex:0 0 auto!important; white-space:nowrap!important; }\n#send_form .stt-qr-row > .stt-qr-arrow { display:block!important; flex:0 0 18px!important; width:18px!important; min-width:18px!important; max-width:18px!important; min-height:36px!important; height:auto!important; margin:0!important; padding:0!important; border:0!important; border-radius:0!important; background:none!important; box-shadow:none!important; color:var(--SmartThemeBodyColor,inherit); font-size:24px!important; line-height:1!important; cursor:pointer; transform:none!important; }\n#send_form .stt-qr-row > .stt-qr-arrow::before, #send_form .stt-qr-row > .stt-qr-arrow::after { content:none!important; }\n.stt-qr-arrow:disabled { opacity:.3; cursor:default; }\n#send_form .stt-qr-row:not([data-overflow=\"true\"]) > .stt-qr-arrow { visibility:hidden!important; pointer-events:none; }\n@media (hover:none), (pointer:coarse), (max-width:600px) { #send_form .stt-qr-row > .stt-qr-arrow { display:none!important; } }\n@media (prefers-reduced-motion:reduce) { .stt-qr-reveal { transition:none; } }\nbody.reduced-motion .stt-qr-reveal { transition:none; }\n.stt-qr-shell[hidden], .stt-qr-row[hidden] { display:none!important; }\n.stt-qr-row.qr--buttons { display:flex!important; flex-wrap:nowrap!important; margin:0!important; padding:0!important; }\n.stt-qr-shell .qr--button.qr--hidden { display:none!important; }\n#send_form .stt-qr-viewport::-webkit-scrollbar { display:none!important; width:0!important; height:0!important; }\n#send_form .stt-qr-row { --stt-fade-left:0px; --stt-fade-right:0px; }\n#send_form .stt-qr-row[data-fade-left=\"true\"] { --stt-fade-left:16px; }\n#send_form .stt-qr-row[data-fade-right=\"true\"] { --stt-fade-right:16px; }\n#send_form .stt-qr-row[data-overflow=\"true\"] > .stt-qr-viewport { mask-image:linear-gradient(to right,transparent,#000 var(--stt-fade-left),#000 calc(100% - var(--stt-fade-right)),transparent); -webkit-mask-image:linear-gradient(to right,transparent,#000 var(--stt-fade-left),#000 calc(100% - var(--stt-fade-right)),transparent); }\n#send_form .stt-qr-toggle { display:inline-flex!important; align-items:center!important; justify-content:center!important; flex:0 0 28px!important; width:28px!important; min-width:28px!important; height:36px!important; min-height:36px!important; padding:0!important; margin:0!important; border:0!important; background:none!important; box-shadow:none!important; color:inherit!important; cursor:pointer!important; order:8!important; }\n#send_form .stt-qr-toggle[hidden] { display:none!important; }\n#send_form .stt-qr-toggle::before, #send_form .stt-qr-toggle::after { content:none!important; }\n#send_form .stt-qr-toggle svg { display:block!important; width:20px!important; height:20px!important; pointer-events:none!important; }\n#send_form .stt-qr-toggle[aria-expanded=\"true\"] svg { transform:rotate(180deg)!important; }\n#send_form .stt-qr-toggle:focus-visible { outline:2px solid currentColor!important; outline-offset:1px!important; }\n#send_form .stt-qr-toggle [data-stt-added-icon] { margin:0!important; display:inline-flex!important; align-items:center!important; justify-content:center!important; line-height:1!important; }\n#send_form .stt-qr-toggle[aria-expanded=\"true\"] [data-stt-added-icon] { transform:rotate(180deg)!important; }\n#send_form .stt-qr-toggle svg, #send_form .stt-qr-toggle path { color:inherit!important; }\n#send_form .stt-qr-toggle path { stroke:currentColor!important; fill:none!important; }\n@supports selector(::scroll-button(right)) {\n  #send_form #qr--bar[data-stt-qr-managed] .qr--buttons::scroll-button(*) { content:none!important; display:none!important; position-anchor:auto!important; }\n}\n/* QR bar buttons */\n#send_form#send_form :where(.stt-qr-shell:not([data-style=\"theme\"])) #qr--bar[data-stt-qr-managed] .qr--button {\n  border:1px solid color-mix(in srgb,var(--SmartThemeBodyColor,#777) 15%,transparent)!important;\n  background:color-mix(in srgb,var(--SmartThemeBodyColor,#777) 3%,var(--SmartThemeBlurTintColor,transparent))!important;\n  color:var(--SmartThemeBodyColor,inherit)!important;\n  font-family:inherit!important;\n  cursor:pointer!important;\n}\n#send_form#send_form :where(.stt-qr-shell:not([data-style=\"theme\"])) #qr--bar[data-stt-qr-managed] .qr--button:hover {\n  background:color-mix(in srgb,var(--SmartThemeBodyColor,#777) 7%,var(--SmartThemeBlurTintColor,transparent))!important;\n}\n#send_form#send_form#send_form .stt-qr-shell[data-style=\"pill\"] .qr--button { border-radius:999px!important; }\n#send_form#send_form#send_form .stt-qr-shell[data-style=\"rounded\"] .qr--button { border-radius:8px!important; }\n#send_form#send_form#send_form .stt-qr-shell[data-style=\"plain\"] .qr--button {\n  border-color:transparent!important; background:transparent!important; box-shadow:none!important;\n}\n#send_form#send_form#send_form .stt-qr-shell[data-style=\"plain\"] .qr--button:hover { background:color-mix(in srgb,var(--SmartThemeBodyColor,#777) 6%,transparent)!important; }\n#send_form#send_form :where(.stt-qr-shell:not([data-style=\"theme\"])) #qr--bar[data-stt-qr-managed] .qr--button > .qr--button-label {\n  color:inherit!important; font-size:inherit!important; line-height:inherit!important; font-weight:inherit!important;\n  margin:0!important; padding:0!important;\n}\n#extensions_settings#extensions_settings [data-stt-menu-icon],\n#extensions_settings2#extensions_settings2 [data-stt-menu-icon],\n#extensions_settings#extensions_settings [data-stt-menu-root-icon]::before,\n#extensions_settings2#extensions_settings2 [data-stt-menu-root-icon]::before {\n  position:absolute!important; inset-inline-start:var(--stt-inset,4px)!important;\n  top:50%!important; translate:0 -50%!important; transform:none!important;\n  width:var(--stt-slot,1.4em)!important; min-width:0!important;\n  margin:0!important; padding:0!important; text-align:center!important;\n}\n/* Composer layout: keep theme pseudo-elements from creating extra rows or space */\n#send_form#send_form #nonQRFormItems#nonQRFormItems[data-stt-input-layout]:not([data-stt-input-layout=\"theme\"])::before,\n#send_form#send_form #nonQRFormItems#nonQRFormItems[data-stt-input-layout]:not([data-stt-input-layout=\"theme\"])::after,\n#send_form#send_form #nonQRFormItems#nonQRFormItems[data-stt-input-layout]:not([data-stt-input-layout=\"theme\"]) > :is(#leftSendForm,#rightSendForm)::before,\n#send_form#send_form #nonQRFormItems#nonQRFormItems[data-stt-input-layout]:not([data-stt-input-layout=\"theme\"]) > :is(#leftSendForm,#rightSendForm)::after,\n#send_form#send_form #nonQRFormItems#nonQRFormItems[data-stt-input-layout] > #stt-input-spacer::before,\n#send_form#send_form #nonQRFormItems#nonQRFormItems[data-stt-input-layout] > #stt-input-spacer::after {\n  content:none!important; display:none!important;\n}\n#stt-panel#stt-panel#stt-panel select:disabled { opacity:.5!important; cursor:not-allowed!important; }\n/* A provider may write element.style.order itself. Keep our visual order in\n   a separate property instead of repeatedly overwriting the provider's value.\n   Scoped to the composer: an undocked/floating control is released immediately. */\n#send_form#send_form #nonQRFormItems#nonQRFormItems[data-stt-input-layout] [data-stt-input-order-managed][data-stt-input-order-managed] {\n  order:var(--stt-input-order,0)!important;\n}\n/* QR toggle: sample the native icon tone, without changing other controls.\n   Explicit icon colors remain inline !important and take precedence. */\n#send_form #stt-qr-toggle.stt-qr-toggle {\n  color:var(--stt-qr-color,var(--SmartThemeBodyColor,inherit))!important;\n  opacity:var(--stt-qr-opacity,.7)!important;\n}\n/* Desktop: both editor panes use the dialog's available height. Keep the\n   toolbar/footer outside the pane scrolling; small screens keep their existing\n   single-column/inline-detail layout. No resize measurements are necessary. */\n@media (min-width:641px) {\n  #stt-panel#stt-panel#stt-panel .stt-content {\n    display:flex!important; flex-direction:column!important;\n }\n  #stt-panel#stt-panel#stt-panel .stt-toolbar,\n  #stt-panel#stt-panel#stt-panel [data-stt-common] {\n    flex-shrink:0!important;\n }\n  #stt-panel#stt-panel#stt-panel .stt-editor {\n    flex:1 1 auto!important; min-height:min(180px,35dvh)!important;\n    grid-template-rows:auto minmax(0,1fr)!important;\n }\n  #stt-panel#stt-panel#stt-panel .stt-list {\n    min-height:0!important; max-height:none!important; align-self:stretch!important;\n }\n  #stt-panel#stt-panel#stt-panel .stt-detail {\n    min-height:0!important; align-self:start!important; max-height:100%!important; overflow-y:auto!important;\n    scrollbar-width:thin!important; scrollbar-color:#999 transparent!important;\n }\n}\n/* QR settings are a normal, top-aligned document, not an editor pane.\n   Explicitly exclude the hidden editor from sizing and scroll anchoring. */\n#stt-panel#stt-panel#stt-panel .stt-content[data-stt-area=\"qr\"] {\n  display:block!important; flex: 1 1 auto!important;\n  height:auto!important; min-height:0!important;\n  overflow-x:hidden!important; overflow-y:auto!important;\n  overflow-anchor:none!important; scroll-behavior:auto!important;\n}\n#stt-panel#stt-panel#stt-panel .stt-content[data-stt-area=\"qr\"] > [data-stt-common] {\n  display:block!important; height:auto!important; min-height:0!important;\n}\n#stt-panel#stt-panel#stt-panel .stt-content[data-stt-area=\"qr\"] > .stt-toolbar,\n#stt-panel#stt-panel#stt-panel .stt-content[data-stt-area=\"qr\"] > .stt-editor {\n  display:none!important;\n}\n/* Composer layout settings: desktop and mobile side by side; stacked on narrow screens */\n#stt-panel#stt-panel#stt-panel .stt-layout-grid { display:grid!important; grid-template-columns:minmax(0,1fr)!important; gap:0 14px!important; margin-top:4px!important; }\n#stt-panel#stt-panel#stt-panel .stt-layout-grid.stt-layout-split { grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important; }\n#stt-panel#stt-panel#stt-panel .stt-layout-title { margin:0 0 8px!important; font:inherit!important; font-size:.84em!important; font-weight:700!important; color:var(--stt-fg)!important; }\n@media (max-width:600px) {\n  #stt-panel#stt-panel#stt-panel .stt-layout-grid.stt-layout-split { grid-template-columns:minmax(0,1fr)!important; }\n  #stt-panel#stt-panel#stt-panel .stt-layout-split > .stt-layout-col + .stt-layout-col { margin-top:14px!important; }\n}\n/* Wide screens: give the editor (item list and settings) a minimum height so long settings above\n   cannot squeeze it; on overflow the whole panel scrolls, continuing once a pane hits its end. */\n@media (min-width:641px) {\n  #stt-panel#stt-panel#stt-panel .stt-editor { min-height:min(440px,64dvh)!important; }\n  #stt-panel#stt-panel#stt-panel .stt-list,\n  #stt-panel#stt-panel#stt-panel .stt-detail { overscroll-behavior:auto!important; }\n}\n\n/* Search and refresh sit atop the left list pane; item settings run full height on the right */\n@media (min-width:641px) {\n  #stt-panel#stt-panel#stt-panel .stt-editor > .stt-toolbar { grid-column:1!important; grid-row:1!important; }\n  #stt-panel#stt-panel#stt-panel .stt-editor > .stt-list { grid-column:1!important; grid-row:2!important; }\n  #stt-panel#stt-panel#stt-panel .stt-editor > .stt-detail { grid-column:2!important; grid-row:1 / span 2!important; }\n}\n/* Reset: cards and items get a gray icon only, hidden when already default (red is for full reset only) */\n#stt-panel#stt-panel#stt-panel .stt-action.stt-reset { width: 30px !important; padding: 0 !important; color: var(--stt-muted) !important; }\n#stt-panel#stt-panel#stt-panel .stt-action.stt-reset .stt-action-text { display: none !important; }\n#stt-panel#stt-panel#stt-panel .stt-action.stt-reset:hover { color: var(--stt-fg) !important; }\n#stt-panel#stt-panel#stt-panel .stt-font-slider > button[data-idle] { visibility: hidden !important; }\n#stt-panel#stt-panel#stt-panel .stt-utilities button.stt-danger[data-armed] { background: var(--stt-danger-soft) !important; font-weight: 700 !important; }\n/* (i) info: pressing expands a one-line explanation below */\n#stt-panel#stt-panel#stt-panel .stt-label-line { display: inline-flex !important; align-items: center !important; gap: 6px !important; }\n#stt-panel#stt-panel#stt-panel h3.stt-label-line { display: flex !important; }\n#stt-panel#stt-panel#stt-panel #stt-panel-title { white-space: nowrap !important; }\n@media (max-width: 640px) {\n}\n#stt-panel#stt-panel#stt-panel .stt-master { flex: none !important; min-height: 34px !important; padding: 0 12px 0 10px !important; gap: 6px !important; border-color: transparent !important; background: transparent !important; color: var(--stt-muted) !important; font-size: .8em !important; font-weight: 600 !important; white-space: nowrap !important; }\n#stt-panel#stt-panel#stt-panel .stt-master .stt-icon-preview { width: auto !important; flex: none !important; font-size: .95em !important; }\n#stt-panel#stt-panel#stt-panel .stt-master:hover { background: var(--stt-wash2) !important; color: var(--stt-fg) !important; }\n#stt-panel#stt-panel#stt-panel .stt-master[aria-pressed=\"true\"] { border-color: color-mix(in srgb, var(--stt-warn) 45%, transparent) !important; background: var(--stt-warn-soft) !important; color: var(--stt-warn) !important; }\n@media (max-width: 640px) {\n  #stt-panel#stt-panel#stt-panel .stt-master { width: 34px !important; padding: 0 !important; justify-content: center !important; }\n  #stt-panel#stt-panel#stt-panel .stt-master-text { display: none !important; }\n}\n/* ⓘ and its speech bubble (same look as the author's other extensions) */\n#stt-panel#stt-panel#stt-panel button.stt-info { position: relative !important; display: inline-grid !important; place-items: center !important; flex: none !important; width: 20px !important; height: 20px !important; min-width: 20px !important; min-height: 20px !important; margin: -2px 0 !important; padding: 0 !important; border: 0 !important; border-radius: 50% !important; background: transparent !important; color: var(--stt-faint) !important; font-size: 13px !important; line-height: 1 !important; cursor: pointer !important; transition: color .15s ease, background-color .15s ease !important; }\n#stt-panel#stt-panel#stt-panel button.stt-info::before { content: \"\" !important; position: absolute !important; inset: -6px !important; }\n#stt-panel#stt-panel#stt-panel button.stt-info .stt-icon-preview { width: auto !important; flex: none !important; font-size: 13px !important; }\n#stt-panel#stt-panel#stt-panel button.stt-info:hover, #stt-panel#stt-panel#stt-panel button.stt-info[aria-expanded=\"true\"] { background: var(--stt-wash2) !important; color: var(--stt-fg) !important; }\n#stt-panel#stt-panel#stt-panel .stt-tip-pop { position: absolute !important; z-index: 20 !important; display: block !important; width: max-content !important; max-width: min(300px, calc(100% - 24px)) !important; margin: 0 !important; padding: 10px 13px !important; border: 1px solid var(--stt-border) !important; border-radius: 12px !important; background: var(--stt-solid) !important; box-shadow: 0 8px 24px rgba(0, 0, 0, .28) !important; color: var(--stt-fg) !important; font-size: 12.5px !important; font-weight: 400 !important; line-height: 1.6 !important; text-align: left !important; white-space: normal !important; word-break: keep-all !important; overflow-wrap: anywhere !important; animation: stt-pop .12s ease-out !important; }\n#stt-panel#stt-panel#stt-panel .stt-tip-pop::before { content: \"\" !important; position: absolute !important; top: -6px !important; left: var(--stt-arrow-x, 20px) !important; width: 10px !important; height: 10px !important; border-top: 1px solid var(--stt-border) !important; border-left: 1px solid var(--stt-border) !important; background: inherit !important; transform: translateX(-50%) rotate(45deg) !important; }\n#stt-panel#stt-panel#stt-panel .stt-tip-pop.stt-tip-above::before { top: auto !important; bottom: -6px !important; border: 0 !important; border-right: 1px solid var(--stt-border) !important; border-bottom: 1px solid var(--stt-border) !important; }\n@keyframes stt-pop { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }\n@media (prefers-reduced-motion: reduce) { #stt-panel#stt-panel#stt-panel .stt-tip-pop { animation: none !important; } }\n/* Wide screens: tabs share the full popup width (still scroll if they do not fit) */\n@media (min-width: 641px) { #stt-panel#stt-panel#stt-panel .stt-tabs button { flex: 1 0 auto !important; justify-content: center !important; } }\n/* Point color placements */\n#stt-panel#stt-panel#stt-panel .stt-logo { background: linear-gradient(135deg, color-mix(in srgb, #9d95f4 34%, transparent), color-mix(in srgb, #5d53d4 20%, transparent)) !important; color: var(--stt-point-text) !important; }\n#stt-panel#stt-panel#stt-panel .stt-tabs [aria-selected=\"true\"], #stt-panel#stt-panel#stt-panel .stt-tabs [aria-selected=\"true\"]:hover { background: var(--stt-point-soft) !important; color: var(--stt-point-text) !important; }\n#stt-panel#stt-panel#stt-panel .stt-tabs [aria-selected=\"true\"] .stt-tab-count { background: var(--stt-point-soft2) !important; }\n#stt-panel#stt-panel#stt-panel .stt-primary { border-color: var(--stt-point-line) !important; background: linear-gradient(var(--stt-point-soft2), var(--stt-point-soft2)), var(--stt-solid) !important; color: var(--stt-point-text) !important; }\n#stt-panel#stt-panel#stt-panel .stt-primary:hover { background: linear-gradient(color-mix(in srgb, var(--stt-point) 36%, transparent), color-mix(in srgb, var(--stt-point) 36%, transparent)), var(--stt-solid) !important; }\n#stt-panel#stt-panel#stt-panel .stt-row[aria-pressed=\"true\"] { box-shadow: inset 0 0 0 1.5px var(--stt-point-line) !important; }\n";
  const AREAS = { wand: '마법봉 메뉴', topbar: '상단바 메뉴', extensions: '확장 패널', input: '입력창 버튼', messages: '메시지 버튼' };
  const AREA_IDS = Object.keys(AREAS);
  const TAB_IDS = ['home', 'topbar', 'extensions', 'wand', 'input', 'qr', 'messages', 'fonts'];
  const THEME_AS_IS = '테마 그대로';
  // Tabs with only a settings form, no item list.
  const FORM_TABS = new Set(['home', 'qr', 'fonts']);
  const TAB_ICONS = { home: 'fa-solid fa-house', topbar: 'fa-solid fa-bars', extensions: 'fa-solid fa-cubes', wand: 'fa-solid fa-wand-magic-sparkles', input: 'fa-solid fa-keyboard', qr: 'fa-solid fa-bolt', messages: 'fa-solid fa-message', fonts: 'fa-solid fa-font' };
  const NAMED_AREAS = new Set(['wand', 'extensions']);
  const OWN = '[data-stt-owned]';
  // Our own controls that should still show up as editable items.
  const OWN_EXEMPT = new Set(['stt-open-wand', 'stt-qr-toggle']);
  const STATUS = '[role="status"],[data-status],[data-state],.status-text,.status_text,.extension-status';
  // Version text and badges next to an extension name (e.g. an extension's 'new' update badge).
  const DECORATIONS = '.version,.badge,.extension_version,.extension-version,[data-version],[class*="badge" i],[class*="version" i]';
  const VERSION_TEXT = /^v?\d+\.\d+(?:\.\d+)*(?:[-+][\w.-]+)?$/i;
  // Short tags next to a name; used only by the extension panel's 'hide decorations'.
  const TAG_TEXT = /^(?:new|beta|alpha|dev|hot|updated?|update available|업데이트|신규|새\s*버전)!?$/i;
  const SKIP_TEXT = `script,style,input,textarea,select,button,svg,${STATUS},.inline-drawer-icon,.notes,${DECORATIONS},.fa-circle-question,.fa-question-circle`;
  const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
  const clone = value => JSON.parse(JSON.stringify(value));
  const context = () => host.SillyTavern?.getContext?.() || null;
  const cleanString = (value, max = 100) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const colorValue = value => /^#[\da-f]{6}$/i.test(value || '') ? value.toLowerCase() : '';
  const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
  const iconValue = value => value === 'none' ? 'none' : /^(?:(?:fa-solid|fa-regular|fa-brands) fa|ph ph)-[a-z0-9-]+$/.test(value || '') ? value : '';
  const numberValue = (value, min, max) => value === null || value === '' || value === undefined ? null : Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Math.round(Number(value)))) : null;
  const validKey = key => typeof key === 'string' && key.length <= 500 && !forbidden.has(key);
  const defaults = () => ({ schemaVersion: 1, inputText: inputTextDefaults(), areas: Object.fromEntries(AREA_IDS.map(id => [id, { order: [], items: {} }])), inputStyle: { iconSize: null, buttonSize: null, gap: null, color: '' }, inputLayout: { rows: 'theme', position: 'top' }, inputLayoutMobile: null, iconStyle: 'auto', qr: { mode: 'always', layout: 'single', align: 'center', style: 'theme' }, fonts: { version: 2, ui: fontDefaults(), chat: fontDefaults(), custom: [], marks: markDefaults() }, home: homeDefaults(), topbarFold: foldDefaults(), editAutoFocus: true, off: { qr: true }, disabled: false });

  function normalize(raw) {
    if (!isRecord(raw) || raw.schemaVersion !== 1) throw new Error('ST Tailor 설정 파일 형식 또는 버전이 맞지 않습니다.');
    const result = defaults();
    for (const area of AREA_IDS) {
      const source = raw.areas?.[area];
      if (!isRecord(source)) continue;
      result.areas[area].order = [...new Set((Array.isArray(source.order) ? source.order : []).filter(validKey))].slice(0, 3000);
      for (const [key, item] of Object.entries(isRecord(source.items) ? source.items : {}).slice(0, 3000)) {
        if (!validKey(key) || !isRecord(item)) continue;
        const setting = {
          alias: cleanString(item.alias), icon: iconValue(item.icon), color: colorValue(item.color),
          colorTarget: ['both', 'label', 'icon'].includes(item.colorTarget) ? item.colorTarget : 'both',
          fontWeight: ['bold', 'normal'].includes(item.fontWeight) ? item.fontWeight : 'bold',
          hidden: item.hidden === true, side: area === 'input' && ['left', 'right'].includes(item.side) ? item.side : '',
          preserveLabel: item.preserveLabel !== false, preserveIcon: item.preserveIcon !== false, preserveColor: item.preserveColor !== false,
          hideDecorations: item.hideDecorations !== false,
        };
        if ((area === 'input' && ['id:options_button', 'id:extensionsMenuButton'].includes(key)) || (area === 'wand' && key === 'id:stt-open-wand') || area === 'topbar') setting.hidden = false;
        if (area === 'topbar' && setting.icon === 'none') setting.icon = '';
        result.areas[area].items[key] = setting;
      }
    }
    const style = raw.inputStyle || {};
    result.inputStyle = { iconSize: numberValue(style.iconSize, 12, 48), buttonSize: numberValue(style.buttonSize, 24, 80), gap: numberValue(style.gap, 0, 24), color: colorValue(style.color) };
    const layout = isRecord(raw.inputLayout) ? raw.inputLayout : {};
    // Up to 1.6.1 there was no 'theme' option, so a missing value means the old default (single row).
    const rowsValue = value => ['theme', 'single', 'double'].includes(value) ? value : 'single';
    result.inputLayout = { rows: rowsValue(layout.rows), position: layout.position === 'bottom' ? 'bottom' : 'top' };
    const mobile = raw.inputLayoutMobile;
    result.inputLayoutMobile = isRecord(mobile) ? { rows: rowsValue(mobile.rows), position: mobile.position === 'bottom' ? 'bottom' : 'top' } : null;
    const qr = raw.qr || {};
    result.qr = { mode: ['always','focus','toggle'].includes(qr.mode) ? qr.mode : 'always', layout: qr.layout === 'sets' ? 'sets' : 'single', align: ['left','center','right'].includes(qr.align) ? qr.align : 'center', style: ['pill','rounded','plain','theme'].includes(qr.style) ? qr.style : 'theme' };
    result.iconStyle = ['auto', 'fa', 'ph'].includes(raw.iconStyle) ? raw.iconStyle : 'auto';
    const fonts = isRecord(raw.fonts) ? raw.fonts : {};
    // The first 1.5.0 release stored stroke 0 for 'as is'; 'as is' is now an empty value.
    const legacyStroke = fonts.version !== 2;
    result.fonts.version = 2;
    const seen = new Set();
    result.fonts.custom = (Array.isArray(fonts.custom) ? fonts.custom : []).map(f => isRecord(f) ? { name: fontNameValue(f.name), css: cleanFontCss(f.css) } : null)
      .filter(f => f && f.name && f.css && !seen.has(f.name) && seen.add(f.name)).slice(0, MAX_CUSTOM_FONTS);
    const validFamily = value => typeof value === 'string' && (Object.prototype.hasOwnProperty.call(FONT_FACES, value) || (value.startsWith(CUSTOM_PREFIX) && seen.has(value.slice(CUSTOM_PREFIX.length)))) ? value : '';
    const rawMarks = Array.isArray(fonts.marks) ? fonts.marks.filter(isRecord) : [];
    const markLook = m => ({ family: validFamily(m.family), size: numberValue(m.size, ...FONT_LIMITS.size) ?? 100,
      stroke: numberValue(m.stroke, ...FONT_LIMITS.stroke) ?? null, spacing: numberValue(m.spacing, ...FONT_LIMITS.spacing) ?? null, fade: numberValue(m.fade, ...FONT_LIMITS.fade) ?? 0 });
    const markIds = new Set();
    result.fonts.marks = [
      ...MARK_PRESETS.map(p => ({ id: p.id, ...markLook(rawMarks.find(m => m.id === p.id) || {}) })),
      ...rawMarks.filter(m => /^u[0-9a-z]{1,16}$/.test(m.id) && !markIds.has(m.id) && markIds.add(m.id))
        .map(m => ({ id: m.id, open: markChars(m.open), close: markChars(m.close), ...markLook(m) }))
        .filter(m => m.open && m.close).slice(0, MAX_MARK_RULES),
    ];
    for (const group of FONT_GROUPS) {
      const source = isRecord(fonts[group]) ? fonts[group] : {};
      const pick = (key, fallback) => numberValue(source[key], ...FONT_LIMITS[key]) ?? fallback;
      const langs = isRecord(source.langs) ? source.langs : {};
      result.fonts[group] = {
        family: validFamily(source.family),
        langs: Object.fromEntries(FONT_LANG_ORDER.map(lang => [lang, validFamily(langs[lang])])),
        size: pick('size', 100), lineHeight: pick('lineHeight', 100), stroke: legacyStroke && Number(source.stroke) === 0 ? null : pick('stroke', null), spacing: pick('spacing', null),
      };
    }
    const home = isRecord(raw.home) ? raw.home : {};
    const clock = isRecord(home.clock) ? home.clock : {}, hide = isRecord(home.hide) ? home.hide : {}, favs = isRecord(home.favorites) ? home.favorites : {};
    const clockFont = typeof clock.font === 'string' && (Object.prototype.hasOwnProperty.call(FONT_FACES, clock.font)
      || (clock.font.startsWith(CUSTOM_PREFIX) && result.fonts.custom.some(f => CUSTOM_PREFIX + f.name === clock.font))) ? clock.font : '';
    result.home = {
      clock: { enabled: clock.enabled === true, label: typeof clock.label === 'string' ? cleanString(clock.label, 40) : 'NOW',
        font: clockFont, size: numberValue(clock.size, 50, 200) ?? 100, top: numberValue(clock.top, 0, 80) ?? 20, bottom: numberValue(clock.bottom, 0, 80) ?? 8, hour12: clock.hour12 === true, date: clock.date !== false },
      hide: { version: hide.version === true, links: hide.links === true, temporary: hide.temporary === true, settings: hide.settings === true, recent: hide.recent === true, assistant: hide.assistant === true },
      search: home.search === true,
      favorites: { enabled: favs.enabled === true, style: favs.style === 'card' ? 'card' : 'circle' },
    };
    const fold = isRecord(raw.topbarFold) ? raw.topbarFold : {};
    result.topbarFold = { mode: ['off', 'narrow', 'all'].includes(fold.mode) ? fold.mode : 'off', look: FOLD_LOOKS.includes(fold.look) ? fold.look : 'handle', color: colorValue(fold.color), hover: fold.hover !== false, chatOnly: fold.chatOnly === true };
    result.editAutoFocus = raw.editAutoFocus !== false;
    const inputText = isRecord(raw.inputText) ? raw.inputText : {};
    result.inputText = { mode: ['default', 'hide', 'custom'].includes(inputText.mode) ? inputText.mode : 'default', text: typeof inputText.text === 'string' ? inputText.text.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 200) : '' };
    result.off = Object.fromEntries(TAB_IDS.filter(id => raw.off?.[id] === true).map(id => [id, true]));
    result.disabled = raw.disabled === true;
    // The QR bar's old separate 'enabled' switch was merged into the area on/off toggle.
    if (qr.enabled === false) result.off.qr = true;
    return result;
  }

  function readSettings() {
    const ctx = context();
    let raw = ctx?.extensionSettings?.[STORAGE];
    if (!raw && typeof getVariables === 'function') raw = getVariables({ type: 'script' })?.[STORAGE];
    if (!raw) return defaults();
    try { return normalize(raw); } catch (error) { console.warn('[ST Tailor] Saved settings retained; using defaults.', error); return defaults(); }
  }

  function persist(value) {
    const ctx = context();
    if (ctx?.extensionSettings && typeof ctx.saveSettingsDebounced === 'function') {
      ctx.extensionSettings[STORAGE] = clone(value);
      ctx.saveSettingsDebounced();
    } else if (typeof getVariables === 'function' && typeof replaceVariables === 'function') {
      replaceVariables({ ...getVariables({ type: 'script' }), [STORAGE]: clone(value) }, { type: 'script' });
    } else throw new Error('설정 저장 기능을 찾지 못했습니다. JS Slash Runner 전역 스크립트에서 실행해 주세요.');
  }

  let dead = false;
  let initTimer;
  let refreshTimer;
  let fontTimer;
  let pollingTimer, pollWatcher = null, pollDirty = true, pollQuiet = 0, pollSoon = null;
  let refreshing = false;
  let ready = false;
  let saved;
  let draft = null;
  // Recent-chat counts (SillyTavern 1.18+ gear button): read and written in SillyTavern's own
  // storage, never in our settings file.
  const RECENT_KEY = 'recentChatsSettings', FOLD_KEY = 'WelcomePage_RecentChatsHidden', RECENT_LIMIT = 1000;
  let recentDraft = null, recentSupported = null;
  function checkRecentSupport() {
    host.fetch(new URL('scripts/templates/welcomePanel.html', doc.baseURI)).then(r => r.ok ? r.text() : '')
      .then(text => { recentSupported = text.includes('recentChatsSettings'); }).catch(() => {});
  }
  function readRecentCounts() {
    let raw = null;
    try { raw = JSON.parse(context()?.accountStorage?.getItem(RECENT_KEY) || 'null'); } catch { raw = null; }
    const max = numberValue(raw?.maxDisplayed, 1, RECENT_LIMIT) ?? 15;
    return { max, collapsed: Math.min(numberValue(raw?.collapsedDisplayed, 1, RECENT_LIMIT) ?? 3, max), folded: context()?.accountStorage?.getItem(FOLD_KEY) === 'true' };
  }
  // Recent-chat fold state shares SillyTavern's fold-button value. The view updates at once;
  // the value is written on save.
  const showFolded = folded => welcomePanel()?.classList.toggle('recentHidden', folded);
  async function writeRecentCounts({ base, value }) {
    const max = value.max, collapsed = Math.min(value.collapsed, max);
    const storage = context()?.accountStorage;
    if (storage && value.folded !== base.folded) { storage.setItem(FOLD_KEY, String(value.folded)); showFolded(value.folded); }
    if (!storage || (max === base.max && collapsed === base.collapsed)) return;
    storage.setItem(RECENT_KEY, JSON.stringify({ maxDisplayed: max, collapsedDisplayed: collapsed }));
    if (!welcomePanel()) return;
    // Re-render home the way SillyTavern's gear button does after saving. The module must be
    // imported from SillyTavern's own URL to get the same instance that owns the screen.
    try {
      const mod = await importHost(new URL('scripts/welcome-screen.js', doc.baseURI).href);
      await mod.openWelcomeScreen?.({ force: true, expand: !!doc.querySelector('#chat button.showMoreChats.rotated') });
    } catch { /* Takes effect the next time home opens. */ }
  }
  let panel = null;
  let selectedArea = 'home';
  let selectedKey = null;
  let expandedKey = null;
  const expandedMarks = new Set();   // partial-font rules with 'adjust' expanded
  const expandedLangs = new Set();   // font groups (ui/chat) with per-language fonts expanded
  const compactPanel = () => host.matchMedia?.('(max-width: 640px)').matches === true;
  // Same breakpoint as SillyTavern's mobile layout.
  const MOBILE_LAYOUT_QUERY = '(max-width: 1000px)';
  const mobileLayout = () => host.matchMedia?.(MOBILE_LAYOUT_QUERY).matches === true;
  let layoutMobileState = null;
  let query = '';
  let effects = [];
  let extensionLayout = null;
  let wandObserver = null;
  let unsubscribers = [];
  let catalogs = { 'fa-solid': new Map(), 'fa-regular': new Map(), 'fa-brands': new Map(), ph: new Map() };
  let records = Object.fromEntries(AREA_IDS.map(id => [id, []]));
  let seen = new Map();
  let previousFingerprint = '';
  let sourceSnapshot = { chat: '', rest: '' };
  const nodeIds = new WeakMap();
  let nextNodeId = 1;
  let fontFamilies = { 'fa-solid': '"Font Awesome 6 Free"', 'fa-regular': '"Font Awesome 6 Free"', 'fa-brands': '"Font Awesome 6 Brands"', ph: '"STT Phosphor"' };
  const created = new Set();
  let disabledCache = null;
  let panelRootCache;
  let messageDigests = new WeakMap();
  let scanDigests = new WeakMap();
  let scanRoots = [];
  let wandFrame = 0;
  let wandTimer = null;
  let messageTimer = null;
  let rowTimers = [];
  // ST keeps building for a while after the script starts: locale strings land
  // late, extensions register their wand entries late, and a heavy chat pushes
  // all of it further out. Treat anything that shifts inside these windows as
  // initialisation rather than as a button whose glyph tracks state.
  const SETTLE_BOOT_MS = 30000;
  const SETTLE_ENTRY_MS = 10000;
  let settleUntil = 0;
  const disabledExtensions = () => disabledCache || (disabledCache = context()?.extensionSettings?.disabledExtensions || []);
  function beginPass() { disabledCache = null; panelRootCache = undefined; }
  const classOf = node => typeof node.className === 'string' ? node.className : (node.getAttribute('class') || '');
  const sameSnapshot = (a, b) => !!a && !!b && a.chat === b.chat && a.rest === b.rest;
  // A disabled area is swapped for defaults only when applying; its saved settings stay, so
  // re-enabling restores them. Disabling the whole tool equals every tab off, icon style included.
  function effective(cfg) {
    const off = cfg?.disabled ? Object.fromEntries(TAB_IDS.map(id => [id, true])) : cfg?.off || {};
    if (!Object.keys(off).length) return { ...cfg, qr: { ...cfg.qr, enabled: true } };
    const d = defaults();
    const out = { ...cfg, areas: { ...cfg.areas } };
    for (const id of AREA_IDS) if (off[id]) out.areas[id] = d.areas[id];
    if (off.input) { out.inputStyle = d.inputStyle; out.inputLayout = d.inputLayout; out.inputLayoutMobile = null; out.inputText = d.inputText; }
    if (off.messages) out.editAutoFocus = true;
    out.qr = off.qr ? { ...d.qr, enabled: false } : { ...cfg.qr, enabled: true };
    if (off.fonts) out.fonts = { ...d.fonts, custom: cfg.fonts.custom };   // kept: the clock font may use a custom font
    if (off.home) out.home = d.home;
    if (off.topbar) out.topbarFold = d.topbarFold;
    if (cfg.disabled) out.iconStyle = d.iconStyle;
    return out;
  }
  let appliedCache = null, appliedFrom = null;
  const appliedSettings = () => {
    if (appliedFrom !== saved) { appliedCache = effective(saved); appliedFrom = saved; }
    return appliedCache;
  };
  // While the panel is open, live previews (fonts, home) follow the draft.
  const liveSettings = () => panel && draft ? effective(draft) : appliedSettings();
  const previewDraft = () => { const e = effective(draft); fontController.sync(e.fonts); homeController.sync(e.home, e.fonts); topbarFold.sync(e.topbarFold); inputTextController.sync(e.inputText); };
  const editableSettings = () => draft || saved;
  const element = (tag, attrs = {}, text = '') => {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== undefined && value !== null) node.setAttribute(key, String(value));
    }
    if (text) node.textContent = text;
    return node;
  };
  const own = node => { node.setAttribute('data-stt-owned', ''); created.add(node); return node; };
  // The panel's status line is for errors only; the next re-render clears it.
  const report = (text, error = false) => {
    const live = panel?.querySelector('[data-stt-live]');
    if (live) { live.textContent = text; live.dataset.error = String(error); }
    else if (host.toastr) host.toastr[error ? 'error' : 'info'](text, '실리태번 재단사');
    else console[error ? 'warn' : 'info']('[ST Tailor]', text);
  };

  function attr(node, name, value) {
    const before = node.getAttribute(name);
    const next = String(value);
    if (before === next) return;
    node.setAttribute(name, next);
    effects.push(() => {
      if (node.getAttribute(name) !== next) return;
      if (before === null) node.removeAttribute(name); else node.setAttribute(name, before);
    });
  }

  function style(node, name, value) {
    const before = node.style.getPropertyValue(name);
    const priority = node.style.getPropertyPriority(name);
    const hadAttribute = node.hasAttribute('style');
    node.style.setProperty(name, value, 'important');
    const applied = node.style.getPropertyValue(name);
    const appliedPriority = node.style.getPropertyPriority(name);
    effects.push(() => {
      if (node.style.getPropertyValue(name) !== applied || node.style.getPropertyPriority(name) !== appliedPriority) return;
      if (before) node.style.setProperty(name, before, priority); else node.style.removeProperty(name);
      if (!hadAttribute && !node.getAttribute('style')) node.removeAttribute('style');
    });
  }

  function rollback() {
    extensionLayout?.dispose();
    extensionLayout = null;
    messageDigests = new WeakMap();
    for (const undo of effects.reverse()) undo();
    effects = [];
  }

  // A theme only has to win one font-size rule to un-hide the original label,
  // and then both the original and the alias show. Writing the alias into the
  // text node itself cannot be overridden by any stylesheet.
  function replaceText(textNode, value) {
    const before = textNode.nodeValue;
    if (before === value) return;
    textNode.nodeValue = value;
    effects.push(() => { if (textNode.nodeValue === value) textNode.nodeValue = before; });
  }

  function wrapText(textNode) {
    if (!textNode.parentNode) return null;
    const span = element('span', { 'data-stt-text': '' });
    textNode.replaceWith(span);
    span.append(textNode);
    effects.push(() => {
      if (span.parentNode) span.replaceWith(...span.childNodes);
    });
    return span;
  }

  function iconPrefix(node) {
    if (!node?.classList) return 'fa-solid';
    if (node.classList.contains('fa-brands') || node.classList.contains('fab')) return 'fa-brands';
    if (node.classList.contains('fa-regular') || node.classList.contains('far')) return 'fa-regular';
    return 'fa-solid';
  }

  function pseudoGlyph(node) {
    if (!node?.matches || node.matches('svg')) return '';
    if (IN_JSDOM) return '';
    const content = host.getComputedStyle(node, '::before').content || '';
    const glyph = content.replace(/^['"]|['"]$/g, '');
    return glyph && glyph !== 'none' && glyph !== 'normal' ? glyph : '';
  }

  const FA_UTILITY = /^fa-(?:fw|2xs|xs|sm|lg|xl|2xl|[1-9]0?x|spin|spin-pulse|spin-reverse|pulse|beat|beat-fade|fade|bounce|shake|flip|flip-horizontal|flip-vertical|flip-both|rotate-\d+|rotate-by|border|inverse|stack|stack-1x|stack-2x|li|ul|pull-left|pull-right|width-auto)$/;
  function iconName(list, prefix) {
    const names = [...(list || [])].filter(x => /^fa-[a-z0-9-]+$/.test(x) && !['fa-solid', 'fa-regular', 'fa-brands'].includes(x));
    return names.find(x => catalogs[prefix]?.has(x)) || names.find(x => !FA_UTILITY.test(x)) || names[0];
  }

  function fontGlyph(node) {
    if (!node?.classList) return null;
    const prefix = iconPrefix(node);
    const name = iconName(node.classList, prefix);
    if (!name) return null;
    return catalogs[prefix]?.has(name) || pseudoGlyph(node) ? `${prefix} ${name}` : null;
  }

  // Phosphor Regular 2.1.1 name:codepoint pairs (MIT).
  const PHOSPHOR_GLYPHS = 'acorn:eb9a,activity:e000,address-book:e6f8,address-book-tabs:ee4e,air-traffic-control:ecd8,airplane:e002,airplane-in-flight:e4fe,airplane-landing:e502,airplane-takeoff:e504,airplane-taxiing:e500,airplane-tilt:e5d6,airplay:e004,alarm:e006,alien:e8a6,align-bottom:e506,align-bottom-simple:eb0c,align-center-horizontal:e50a,align-center-horizontal-simple:eb0e,align-center-vertical:e50c,align-center-vertical-simple:eb10,align-left:e50e,align-left-simple:eaee,align-right:e510,align-right-simple:eb12,align-top:e512,align-top-simple:eb14,amazon-logo:e96c,ambulance:e572,anchor:e514,anchor-simple:e5d8,android-logo:e008,angle:e7bc,angular-logo:eb80,aperture:e00a,app-store-logo:e974,app-window:e5da,apple-logo:e516,apple-podcasts-logo:eb96,approximate-equals:edaa,archive:e00c,archive-box:e00e,archive-tray:e010,armchair:e012,arrow-arc-left:e014,arrow-arc-right:e016,arrow-bend-double-up-left:e03a,arrow-bend-double-up-right:e03c,arrow-bend-down-left:e018,arrow-bend-down-right:e01a,arrow-bend-left-down:e01c,arrow-bend-left-up:e01e,arrow-bend-right-down:e020,arrow-bend-right-up:e022,arrow-bend-up-left:e024,arrow-bend-up-right:e026,arrow-circle-down:e028,arrow-circle-down-left:e02a,arrow-circle-down-right:e02c,arrow-circle-left:e05a,arrow-circle-right:e02e,arrow-circle-up:e030,arrow-circle-up-left:e032,arrow-circle-up-right:e034,arrow-clockwise:e036,arrow-counter-clockwise:e038,arrow-down:e03e,arrow-down-left:e040,arrow-down-right:e042,arrow-elbow-down-left:e044,arrow-elbow-down-right:e046,arrow-elbow-left:e048,arrow-elbow-left-down:e04a,arrow-elbow-left-up:e04c,arrow-elbow-right:e04e,arrow-elbow-right-down:e050,arrow-elbow-right-up:e052,arrow-elbow-up-left:e054,arrow-elbow-up-right:e056,arrow-fat-down:e518,arrow-fat-left:e51a,arrow-fat-line-down:e51c,arrow-fat-line-left:e51e,arrow-fat-line-right:e520,arrow-fat-line-up:e522,arrow-fat-lines-down:e524,arrow-fat-lines-left:e526,arrow-fat-lines-right:e528,arrow-fat-lines-up:e52a,arrow-fat-right:e52c,arrow-fat-up:e52e,arrow-left:e058,arrow-line-down:e05c,arrow-line-down-left:e05e,arrow-line-down-right:e060,arrow-line-left:e062,arrow-line-right:e064,arrow-line-up:e066,arrow-line-up-left:e068,arrow-line-up-right:e06a,arrow-right:e06c,arrow-square-down:e06e,arrow-square-down-left:e070,arrow-square-down-right:e072,arrow-square-in:e5dc,arrow-square-left:e074,arrow-square-out:e5de,arrow-square-right:e076,arrow-square-up:e078,arrow-square-up-left:e07a,arrow-square-up-right:e07c,arrow-u-down-left:e07e,arrow-u-down-right:e080,arrow-u-left-down:e082,arrow-u-left-up:e084,arrow-u-right-down:e086,arrow-u-right-up:e088,arrow-u-up-left:e08a,arrow-u-up-right:e08c,arrow-up:e08e,arrow-up-left:e090,arrow-up-right:e092,arrows-clockwise:e094,arrows-counter-clockwise:e096,arrows-down-up:e098,arrows-horizontal:eb06,arrows-in:e09a,arrows-in-cardinal:e09c,arrows-in-line-horizontal:e530,arrows-in-line-vertical:e532,arrows-in-simple:e09e,arrows-left-right:e0a0,arrows-merge:ed3e,arrows-out:e0a2,arrows-out-cardinal:e0a4,arrows-out-line-horizontal:e534,arrows-out-line-vertical:e536,arrows-out-simple:e0a6,arrows-split:ed3c,arrows-vertical:eb04,article:e0a8,article-medium:e5e0,article-ny-times:e5e2,asclepius:ee34,asterisk:e0aa,asterisk-simple:e832,at:e0ac,atom:e5e4,avocado:ee04,axe:e9fc,baby:e774,baby-carriage:e818,backpack:e922,backspace:e0ae,bag:e0b0,bag-simple:e5e6,balloon:e76c,bandaids:e0b2,bank:e0b4,barbell:e0b6,barcode:e0b8,barn:ec72,barricade:e948,baseball:e71a,baseball-cap:ea28,baseball-helmet:ee4a,basket:e964,basketball:e724,bathtub:e81e,battery-charging:e0ba,battery-charging-vertical:e0bc,battery-empty:e0be,battery-full:e0c0,battery-high:e0c2,battery-low:e0c4,battery-medium:e0c6,battery-plus:e808,battery-plus-vertical:ec50,battery-vertical-empty:e7c6,battery-vertical-full:e7c4,battery-vertical-high:e7c2,battery-vertical-low:e7be,battery-vertical-medium:e7c0,battery-warning:e0c8,battery-warning-vertical:e0ca,beach-ball:ed24,beanie:ea2a,bed:e0cc,beer-bottle:e7b0,beer-stein:eb62,behance-logo:e7f4,bell:e0ce,bell-ringing:e5e8,bell-simple:e0d0,bell-simple-ringing:e5ea,bell-simple-slash:e0d2,bell-simple-z:e5ec,bell-slash:e0d4,bell-z:e5ee,belt:ea2c,bezier-curve:eb00,bicycle:e0d6,binary:ee60,binoculars:ea64,biohazard:e9e0,bird:e72c,blueprint:eda0,bluetooth:e0da,bluetooth-connected:e0dc,bluetooth-slash:e0de,bluetooth-x:e0e0,boat:e786,bomb:ee0a,bone:e7f2,book:e0e2,book-bookmark:e0e4,book-open:e0e6,book-open-text:e8f2,book-open-user:ede0,bookmark:e0e8,bookmark-simple:e0ea,bookmarks:e0ec,bookmarks-simple:e5f0,books:e758,boot:ecca,boules:e722,bounding-box:e6ce,bowl-food:eaa4,bowl-steam:e8e4,bowling-ball:ea34,box-arrow-down:e00e,box-arrow-up:ee54,boxing-glove:ea36,brackets-angle:e862,brackets-curly:e860,brackets-round:e864,brackets-square:e85e,brain:e74e,brandy:e6b4,bread:e81c,bridge:ea68,briefcase:e0ee,briefcase-metal:e5f2,broadcast:e0f2,broom:ec54,browser:e0f4,browsers:e0f6,bug:e5f4,bug-beetle:e5f6,bug-droid:e5f8,building:e100,building-apartment:e0fe,building-office:e0ff,buildings:e102,bulldozer:ec6c,bus:e106,butterfly:ea6e,cable-car:e49c,cactus:e918,caduceus:ee34,cake:e780,calculator:e538,calendar:e108,calendar-blank:e10a,calendar-check:e712,calendar-dot:e7b2,calendar-dots:e7b4,calendar-heart:e8b0,calendar-minus:ea14,calendar-plus:e714,calendar-slash:ea12,calendar-star:e8b2,calendar-x:e10c,call-bell:e7de,camera:e10e,camera-plus:ec58,camera-rotate:e7a4,camera-slash:e110,campfire:e9d8,car:e112,car-battery:ee30,car-profile:e8cc,car-simple:e114,cardholder:e5fa,cards:e0f8,cards-three:ee50,caret-circle-double-down:e116,caret-circle-double-left:e118,caret-circle-double-right:e11a,caret-circle-double-up:e11c,caret-circle-down:e11e,caret-circle-left:e120,caret-circle-right:e122,caret-circle-up:e124,caret-circle-up-down:e13e,caret-double-down:e126,caret-double-left:e128,caret-double-right:e12a,caret-double-up:e12c,caret-down:e136,caret-left:e138,caret-line-down:e134,caret-line-left:e132,caret-line-right:e130,caret-line-up:e12e,caret-right:e13a,caret-up:e13c,caret-up-down:e140,carrot:ed38,cash-register:ed80,cassette-tape:ed2e,castle-turret:e9d0,cat:e748,cell-signal-full:e142,cell-signal-high:e144,cell-signal-low:e146,cell-signal-medium:e148,cell-signal-none:e14a,cell-signal-slash:e14c,cell-signal-x:e14e,cell-tower:ebaa,certificate:e766,chair:e950,chalkboard:e5fc,chalkboard-simple:e5fe,chalkboard-teacher:e600,champagne:eaca,charging-station:e8d0,chart-bar:e150,chart-bar-horizontal:e152,chart-donut:eaa6,chart-line:e154,chart-line-down:e8b6,chart-line-up:e156,chart-pie:e158,chart-pie-slice:e15a,chart-polar:eaa8,chart-scatter:eaac,chat:e15c,chat-centered:e160,chat-centered-dots:e164,chat-centered-slash:e162,chat-centered-text:e166,chat-circle:e168,chat-circle-dots:e16c,chat-circle-slash:e16a,chat-circle-text:e16e,chat-dots:e170,chat-slash:e15e,chat-teardrop:e172,chat-teardrop-dots:e176,chat-teardrop-slash:e174,chat-teardrop-text:e178,chat-text:e17a,chats:e17c,chats-circle:e17e,chats-teardrop:e180,check:e182,check-circle:e184,check-fat:eba6,check-square:e186,check-square-offset:e188,checkerboard:e8c4,checks:e53a,cheers:ea4a,cheese:e9fe,chef-hat:ed8e,cherries:e830,church:ecea,cigarette:ed90,cigarette-slash:ed92,circle:e18a,circle-dashed:e602,circle-half:e18c,circle-half-tilt:e18e,circle-notch:eb44,circle-wavy:e604,circle-wavy-check:e606,circle-wavy-question:e608,circle-wavy-warning:e60c,circles-four:e190,circles-three:e192,circles-three-plus:e194,circuitry:e9c2,city:ea6a,clipboard:e196,clipboard-text:e198,clock:e19a,clock-afternoon:e19c,clock-clockwise:e19e,clock-countdown:ed2c,clock-counter-clockwise:e1a0,clock-user:edec,closed-captioning:e1a4,cloud:e1aa,cloud-arrow-down:e1ac,cloud-arrow-up:e1ae,cloud-check:e1b0,cloud-fog:e53c,cloud-lightning:e1b2,cloud-moon:e53e,cloud-rain:e1b4,cloud-slash:e1b6,cloud-snow:e1b8,cloud-sun:e540,cloud-warning:ea98,cloud-x:ea96,clover:edc8,club:e1ba,coat-hanger:e7fe,coda-logo:e7ce,code:e1bc,code-block:eafe,code-simple:e1be,codepen-logo:e978,codesandbox-logo:ea06,coffee:e1c2,coffee-bean:e1c0,coin:e60e,coin-vertical:eb48,coins:e78e,columns:e546,columns-plus-left:e544,columns-plus-right:e542,command:e1c4,compass:e1c8,compass-rose:e1c6,compass-tool:ea0e,computer-tower:e548,confetti:e81a,contactless-payment:ed42,control:eca6,cookie:e6ca,cooking-pot:e764,copy:e1ca,copy-simple:e1cc,copyleft:e86a,copyright:e54a,corners-in:e1ce,corners-out:e1d0,couch:e7f6,court-basketball:ee36,cow:eabe,cowboy-hat:ed12,cpu:e610,crane:ed48,crane-tower:ed49,credit-card:e1d2,cricket:ee12,crop:e1d4,cross:e8a0,crosshair:e1d6,crosshair-simple:e1d8,crown:e614,crown-cross:ee5e,crown-simple:e616,cube:e1da,cube-focus:ed0a,cube-transparent:ec7c,currency-btc:e618,currency-circle-dollar:e54c,currency-cny:e54e,currency-dollar:e550,currency-dollar-simple:e552,currency-eth:eada,currency-eur:e554,currency-gbp:e556,currency-inr:e558,currency-jpy:e55a,currency-krw:e55c,currency-kzt:ec4c,currency-ngn:eb52,currency-rub:e55e,cursor:e1dc,cursor-click:e7c8,cursor-text:e7d8,cylinder:e8fc,database:e1de,desk:ed16,desktop:e560,desktop-tower:e562,detective:e83e,dev-to-logo:ed0e,device-mobile:e1e0,device-mobile-camera:e1e2,device-mobile-slash:ee46,device-mobile-speaker:e1e4,device-rotate:edf2,device-tablet:e1e6,device-tablet-camera:e1e8,device-tablet-speaker:e1ea,devices:eba4,diamond:e1ec,diamonds-four:e8f4,dice-five:e1ee,dice-four:e1f0,dice-one:e1f2,dice-six:e1f4,dice-three:e1f6,dice-two:e1f8,disc:e564,disco-ball:ed98,discord-logo:e61a,divide:e1fa,dna:e924,dog:e74a,door:e61c,door-open:e7e6,dot:ecde,dot-outline:ece0,dots-nine:e1fc,dots-six:e794,dots-six-vertical:eae2,dots-three:e1fe,dots-three-circle:e200,dots-three-circle-vertical:e202,dots-three-outline:e204,dots-three-outline-vertical:e206,dots-three-vertical:e208,download:e20a,download-simple:e20c,dress:ea7e,dresser:e94e,dribbble-logo:e20e,drone:ed74,drop:e210,drop-half:e566,drop-half-bottom:eb40,drop-simple:ee32,drop-slash:e954,dropbox-logo:e7d0,ear:e70c,ear-slash:e70e,egg:e812,egg-crack:eb64,eject:e212,eject-simple:e6ae,elevator:ecc0,empty:edbc,engine:ea80,envelope:e214,envelope-open:e216,envelope-simple:e218,envelope-simple-open:e21a,equalizer:ebbc,equals:e21c,eraser:e21e,escalator-down:ecba,escalator-up:ecbc,exam:e742,exclamation-mark:ee44,exclude:e882,exclude-square:e880,export:eaf0,eye:e220,eye-closed:e222,eye-slash:e224,eyedropper:e568,eyedropper-sample:eac4,eyeglasses:e7ba,eyes:ee5c,face-mask:e56a,facebook-logo:e226,factory:e760,faders:e228,faders-horizontal:e22a,fallout-shelter:e9de,fan:e9f2,farm:ec70,fast-forward:e6a6,fast-forward-circle:e22c,feather:e9c0,fediverse-logo:ed66,figma-logo:e22e,file:e230,file-archive:eb2a,file-arrow-down:e232,file-arrow-up:e61e,file-audio:ea20,file-c:eb32,file-c-sharp:eb30,file-cloud:e95e,file-code:e914,file-cpp:eb2e,file-css:eb34,file-csv:eb1c,file-dashed:e704,file-doc:eb1e,file-dotted:e704,file-html:eb38,file-image:ea24,file-ini:eb33,file-jpg:eb1a,file-js:eb24,file-jsx:eb3a,file-lock:e95c,file-magnifying-glass:e238,file-md:ed50,file-minus:e234,file-pdf:e702,file-plus:e236,file-png:eb18,file-ppt:eb20,file-py:eb2c,file-rs:eb28,file-search:e238,file-sql:ed4e,file-svg:ed08,file-text:e23a,file-ts:eb26,file-tsx:eb3c,file-txt:eb35,file-video:ea22,file-vue:eb3e,file-x:e23c,file-xls:eb22,file-zip:e958,files:e710,film-reel:e8c0,film-script:eb50,film-slate:e8c2,film-strip:e792,fingerprint:e23e,fingerprint-simple:e240,finn-the-human:e56c,fire:e242,fire-extinguisher:e9e8,fire-simple:e620,fire-truck:e574,first-aid:e56e,first-aid-kit:e570,fish:e728,fish-simple:e72a,flag:e244,flag-banner:e622,flag-banner-fold:ecf2,flag-checkered:ea38,flag-pennant:ecf0,flame:e624,flashlight:e246,flask:e79e,flip-horizontal:ed6a,flip-vertical:ed6c,floppy-disk:e248,floppy-disk-back:eaf4,flow-arrow:e6ec,flower:e75e,flower-lotus:e6cc,flower-tulip:eacc,flying-saucer:eb4a,folder:e24a,folder-dashed:e8f8,folder-dotted:e8f8,folder-lock:ea3c,folder-minus:e254,folder-notch:e24a,folder-notch-minus:e254,folder-notch-open:e256,folder-notch-plus:e258,folder-open:e256,folder-plus:e258,folder-simple:e25a,folder-simple-dashed:ec2a,folder-simple-dotted:ec2a,folder-simple-lock:eb5e,folder-simple-minus:e25c,folder-simple-plus:e25e,folder-simple-star:ec2e,folder-simple-user:eb60,folder-star:ea86,folder-user:eb46,folders:e260,football:e718,football-helmet:ee4c,footprints:ea88,fork-knife:e262,four-k:ea5c,frame-corners:e626,framer-logo:e264,function:ebe4,funnel:e266,funnel-simple:e268,funnel-simple-x:e26a,funnel-x:e26c,game-controller:e26e,garage:ecd6,gas-can:e8ce,gas-pump:e768,gauge:e628,gavel:ea32,gear:e270,gear-fine:e87c,gear-six:e272,gender-female:e6e0,gender-intersex:e6e6,gender-male:e6e2,gender-neuter:e6ea,gender-nonbinary:e6e4,gender-transgender:e6e8,ghost:e62a,gif:e274,gift:e276,git-branch:e278,git-commit:e27a,git-diff:e27c,git-fork:e27e,git-merge:e280,git-pull-request:e282,github-logo:e576,gitlab-logo:e694,gitlab-logo-simple:e696,globe:e288,globe-hemisphere-east:e28a,globe-hemisphere-west:e28c,globe-simple:e28e,globe-simple-x:e284,globe-stand:e290,globe-x:e286,goggles:ecb4,golf:ea3e,goodreads-logo:ed10,google-cardboard-logo:e7b6,google-chrome-logo:e976,google-drive-logo:e8f6,google-logo:e292,google-photos-logo:eb92,google-play-logo:e294,google-podcasts-logo:eb94,gps:edd8,gps-fix:edd6,gps-slash:edd4,gradient:eb42,graduation-cap:e62c,grains:ec68,grains-slash:ec6a,graph:eb58,graphics-card:e612,greater-than:edc4,greater-than-or-equal:eda2,grid-four:e296,grid-nine:ec8c,guitar:ea8a,hair-dryer:ea66,hamburger:e790,hammer:e80e,hand:e298,hand-arrow-down:ea4e,hand-arrow-up:ee5a,hand-coins:ea8c,hand-deposit:ee82,hand-eye:ea4c,hand-fist:e57a,hand-grabbing:e57c,hand-heart:e810,hand-palm:e57e,hand-peace:e7cc,hand-pointing:e29a,hand-soap:e630,hand-swipe-left:ec94,hand-swipe-right:ec92,hand-tap:ec90,hand-waving:e580,hand-withdraw:ee80,handbag:e29c,handbag-simple:e62e,hands-clapping:e6a0,hands-praying:ecc8,handshake:e582,hard-drive:e29e,hard-drives:e2a0,hard-hat:ed46,hash:e2a2,hash-straight:e2a4,head-circuit:e7d4,headlights:e6fe,headphones:e2a6,headset:e584,heart:e2a8,heart-break:ebe8,heart-half:ec48,heart-straight:e2aa,heart-straight-break:eb98,heartbeat:e2ac,hexagon:e2ae,high-definition:ea8e,high-heel:e8e8,highlighter:ec76,highlighter-circle:e632,hockey:ec86,hoodie:ecd0,horse:e2b0,hospital:e844,hourglass:e2b2,hourglass-high:e2b4,hourglass-low:e2b6,hourglass-medium:e2b8,hourglass-simple:e2ba,hourglass-simple-high:e2bc,hourglass-simple-low:e2be,hourglass-simple-medium:e2c0,house:e2c2,house-line:e2c4,house-simple:e2c6,hurricane:e88e,ice-cream:e804,identification-badge:e6f6,identification-card:e2c8,image:e2ca,image-broken:e7a8,image-square:e2cc,images:e836,images-square:e834,infinity:e634,info:e2ce,instagram-logo:e2d0,intersect:e2d2,intersect-square:e87a,intersect-three:ecc4,intersection:edba,invoice:ee42,island:ee06,jar:e7e0,jar-label:e7e1,jeep:e2d4,joystick:ea5e,kanban:eb54,key:e2d6,key-return:e782,keyboard:e2d8,keyhole:ea78,knife:e636,ladder:e9e4,ladder-simple:ec26,lamp:e638,lamp-pendant:ee2e,laptop:e586,lasso:edc6,lastfm-logo:e842,layout:e6d6,leaf:e2da,lectern:e95a,lego:e8c6,lego-smiley:e8c7,lemniscate:e634,less-than:edac,less-than-or-equal:eda4,letter-circle-h:ebf8,letter-circle-p:ec08,letter-circle-v:ec14,lifebuoy:e63a,lightbulb:e2dc,lightbulb-filament:e63c,lighthouse:e9f6,lightning:e2de,lightning-a:ea84,lightning-slash:e2e0,line-segment:e6d2,line-segments:e6d4,line-vertical:ed70,link:e2e2,link-break:e2e4,link-simple:e2e6,link-simple-break:e2e8,link-simple-horizontal:e2ea,link-simple-horizontal-break:e2ec,linkedin-logo:e2ee,linktree-logo:edee,linux-logo:eb02,list:e2f0,list-bullets:e2f2,list-checks:eadc,list-dashes:e2f4,list-heart:ebde,list-magnifying-glass:ebe0,list-numbers:e2f6,list-plus:e2f8,list-star:ebdc,lock:e2fa,lock-key:e2fe,lock-key-open:e300,lock-laminated:e302,lock-laminated-open:e304,lock-open:e306,lock-simple:e308,lock-simple-open:e30a,lockers:ecb8,log:ed82,magic-wand:e6b6,magnet:e680,magnet-straight:e682,magnifying-glass:e30c,magnifying-glass-minus:e30e,magnifying-glass-plus:e310,mailbox:ec1e,map-pin:e316,map-pin-area:ee3a,map-pin-line:e318,map-pin-plus:e314,map-pin-simple:ee3e,map-pin-simple-area:ee3c,map-pin-simple-line:ee38,map-trifold:e31a,markdown-logo:e508,marker-circle:e640,martini:e31c,mask-happy:e9f4,mask-sad:eb9e,mastodon-logo:ed68,math-operations:e31e,matrix-logo:ed64,medal:e320,medal-military:ecfc,medium-logo:e322,megaphone:e324,megaphone-simple:e642,member-of:edc2,memory:e9c4,messenger-logo:e6d8,meta-logo:ed02,meteor:e9ba,metronome:ec8e,microphone:e326,microphone-slash:e328,microphone-stage:e75c,microscope:ec7a,microsoft-excel-logo:eb6c,microsoft-outlook-logo:eb70,microsoft-powerpoint-logo:eace,microsoft-teams-logo:eb66,microsoft-word-logo:eb6a,minus:e32a,minus-circle:e32c,minus-square:ed4c,money:e588,money-wavy:ee68,monitor:e32e,monitor-arrow-up:e58a,monitor-play:e58c,moon:e330,moon-stars:e58e,moped:e824,moped-front:e822,mosque:ecee,motorcycle:e80a,mountains:e7ae,mouse:e33a,mouse-left-click:e334,mouse-middle-click:e338,mouse-right-click:e336,mouse-scroll:e332,mouse-simple:e644,music-note:e33c,music-note-simple:e33e,music-notes:e340,music-notes-minus:ee0c,music-notes-plus:eb7c,music-notes-simple:e342,navigation-arrow:eade,needle:e82e,network:edde,network-slash:eddc,network-x:edda,newspaper:e344,newspaper-clipping:e346,not-equals:eda6,not-member-of:edae,not-subset-of:edb0,not-superset-of:edb2,notches:ed3a,note:e348,note-blank:e34a,note-pencil:e34c,notebook:e34e,notepad:e63e,notification:e6fa,notion-logo:e9a0,nuclear-plant:ed7c,number-circle-eight:e352,number-circle-five:e358,number-circle-four:e35e,number-circle-nine:e364,number-circle-one:e36a,number-circle-seven:e370,number-circle-six:e376,number-circle-three:e37c,number-circle-two:e382,number-circle-zero:e388,number-eight:e350,number-five:e356,number-four:e35c,number-nine:e362,number-one:e368,number-seven:e36e,number-six:e374,number-square-eight:e354,number-square-five:e35a,number-square-four:e360,number-square-nine:e366,number-square-one:e36c,number-square-seven:e372,number-square-six:e378,number-square-three:e37e,number-square-two:e384,number-square-zero:e38a,number-three:e37a,number-two:e380,number-zero:e386,numpad:e3c8,nut:e38c,ny-times-logo:e646,octagon:e38e,office-chair:ea46,onigiri:ee2c,open-ai-logo:e7d2,option:e8a8,orange:ee40,orange-slice:ed36,oven:ed8c,package:e390,paint-brush:e6f0,paint-brush-broad:e590,paint-brush-household:e6f2,paint-bucket:e392,paint-roller:e6f4,palette:e6c8,panorama:eaa2,pants:ec88,paper-plane:e394,paper-plane-right:e396,paper-plane-tilt:e398,paperclip:e39a,paperclip-horizontal:e592,parachute:ea7c,paragraph:e960,parallelogram:ecc6,park:ecb2,password:e752,path:e39c,patreon-logo:e98a,pause:e39e,pause-circle:e3a0,paw-print:e648,paypal-logo:e98c,peace:e3a2,pen:e3aa,pen-nib:e3ac,pen-nib-straight:e64a,pencil:e3ae,pencil-circle:e3b0,pencil-line:e3b2,pencil-ruler:e906,pencil-simple:e3b4,pencil-simple-line:ebc6,pencil-simple-slash:ecf6,pencil-slash:ecf8,pentagon:ec7e,pentagram:ec5c,pepper:e94a,percent:e3b6,person:e3a8,person-arms-spread:ecfe,person-simple:e72e,person-simple-bike:e734,person-simple-circle:ee58,person-simple-hike:ed54,person-simple-run:e730,person-simple-ski:e71c,person-simple-snowboard:e71e,person-simple-swim:e736,person-simple-tai-chi:ed5c,person-simple-throw:e732,person-simple-walk:e73a,perspective:ebe6,phone:e3b8,phone-call:e3ba,phone-disconnect:e3bc,phone-incoming:e3be,phone-list:e3cc,phone-outgoing:e3c0,phone-pause:e3ca,phone-plus:ec56,phone-slash:e3c2,phone-transfer:e3c6,phone-x:e3c4,phosphor-logo:e3ce,pi:ec80,piano-keys:e9c8,picnic-table:ee26,picture-in-picture:e64c,piggy-bank:ea04,pill:e700,ping-pong:ea42,pint-glass:edd0,pinterest-logo:e64e,pinwheel:eb9c,pipe:ed86,pipe-wrench:ed88,pix-logo:ecc2,pizza:e796,placeholder:e650,planet:e652,plant:ebae,play:e3d0,play-circle:e3d2,play-pause:e8be,playlist:e6aa,plug:e946,plug-charging:eb5c,plugs:eb56,plugs-connected:eb5a,plus:e3d4,plus-circle:e3d6,plus-minus:e3d8,plus-square:ed4a,poker-chip:e594,police-car:ec4a,polygon:e6d0,popcorn:eb4e,popsicle:ebbe,potted-plant:ec22,power:e3da,prescription:e7a2,presentation:e654,presentation-chart:e656,printer:e3dc,prohibit:e3de,prohibit-inset:e3e0,projector-screen:e658,projector-screen-chart:e65a,pulse:e000,push-pin:e3e2,push-pin-simple:e65c,push-pin-simple-slash:e65e,push-pin-slash:e3e4,puzzle-piece:e596,qr-code:e3e6,question:e3e8,question-mark:e3e9,queue:e6ac,quotes:e660,rabbit:eac2,racquet:ee02,radical:e3ea,radio:e77e,radio-button:eb08,radioactive:e9dc,rainbow:e598,rainbow-cloud:e59a,ranking:ed62,read-cv-logo:ed0c,receipt:e3ec,receipt-x:ed40,record:e3ee,rectangle:e3f0,rectangle-dashed:e3f2,recycle:e75a,reddit-logo:e59c,repeat:e3f6,repeat-once:e3f8,replit-logo:eb8a,resize:ed6e,rewind:e6a8,rewind-circle:e3fa,road-horizon:e838,robot:e762,rocket:e3fc,rocket-launch:e3fe,rows:e5a2,rows-plus-bottom:e59e,rows-plus-top:e5a0,rss:e400,rss-simple:e402,rug:ea1a,ruler:e6b8,sailboat:e78a,scales:e750,scan:ebb6,scan-smiley:ebb4,scissors:eae0,scooter:e820,screencast:e404,screwdriver:e86e,scribble:e806,scribble-loop:e662,scroll:eb7a,seal:e604,seal-check:e606,seal-percent:e60a,seal-question:e608,seal-warning:e60c,seat:eb8e,seatbelt:edfe,security-camera:eca4,selection:e69a,selection-all:e746,selection-background:eaf8,selection-foreground:eaf6,selection-inverse:e744,selection-plus:e69c,selection-slash:e69e,shapes:ec5e,share:e406,share-fat:ed52,share-network:e408,shield:e40a,shield-check:e40c,shield-checkered:e708,shield-chevron:e40e,shield-plus:e706,shield-slash:e410,shield-star:ec34,shield-warning:e412,shipping-container:e78c,shirt-folded:ea92,shooting-star:ecfa,shopping-bag:e416,shopping-bag-open:e418,shopping-cart:e41e,shopping-cart-simple:e420,shovel:e9e6,shower:e776,shrimp:eab4,shuffle:e422,shuffle-angular:e424,shuffle-simple:e426,sidebar:eab6,sidebar-simple:ec24,sigma:eab8,sign-in:e428,sign-out:e42a,signature:ebac,signpost:e89c,sim-card:e664,siren:e9b8,sketch-logo:e42c,skip-back:e5a4,skip-back-circle:e42e,skip-forward:e5a6,skip-forward-circle:e430,skull:e916,skype-logo:e8dc,slack-logo:e5a8,sliders:e432,sliders-horizontal:e434,slideshow:ed32,smiley:e436,smiley-angry:ec62,smiley-blank:e438,smiley-meh:e43a,smiley-melting:ee56,smiley-nervous:e43c,smiley-sad:e43e,smiley-sticker:e440,smiley-wink:e666,smiley-x-eyes:e442,snapchat-logo:e668,sneaker:e80c,sneaker-move:ed60,snowflake:e5aa,soccer-ball:e716,sock:ecce,solar-panel:ed7a,solar-roof:ed7b,sort-ascending:e444,sort-descending:e446,soundcloud-logo:e8de,spade:e448,sparkle:e6a2,speaker-hifi:ea08,speaker-high:e44a,speaker-low:e44c,speaker-none:e44e,speaker-simple-high:e450,speaker-simple-low:e452,speaker-simple-none:e454,speaker-simple-slash:e456,speaker-simple-x:e458,speaker-slash:e45a,speaker-x:e45c,speedometer:ee74,sphere:ee66,spinner:e66a,spinner-ball:ee28,spinner-gap:e66c,spiral:e9fa,split-horizontal:e872,split-vertical:e876,spotify-logo:e66e,spray-bottle:e7e4,square:e45e,square-half:e462,square-half-bottom:eb16,square-logo:e690,square-split-horizontal:e870,square-split-vertical:e874,squares-four:e464,stack:e466,stack-minus:edf4,stack-overflow-logo:eb78,stack-plus:edf6,stack-simple:e468,stairs:e8ec,stamp:ea48,standard-definition:ea90,star:e46a,star-and-crescent:ecf4,star-four:e6a4,star-half:e70a,star-of-david:e89e,steam-logo:ead4,steering-wheel:e9ac,steps:ecbe,stethoscope:e7ea,sticker:e5ac,stool:ea44,stop:e46c,stop-circle:e46e,storefront:e470,strategy:ea3a,stripe-logo:e698,student:e73e,subset-of:edc0,subset-proper-of:edb6,subtitles:e1a8,subtitles-slash:e1a6,subtract:ebd6,subtract-square:ebd4,subway:e498,suitcase:e5ae,suitcase-rolling:e9b0,suitcase-simple:e5b0,sun:e472,sun-dim:e474,sun-horizon:e5b6,sunglasses:e816,superset-of:edb8,superset-proper-of:edb4,swap:e83c,swatches:e5b8,swimming-pool:ecb6,sword:e5ba,synagogue:ecec,syringe:e968,t-shirt:e670,table:e476,tabs:e778,tag:e478,tag-chevron:e672,tag-simple:e47a,target:e47c,taxi:e902,tea-bag:e8e6,telegram-logo:e5bc,television:e754,television-simple:eae6,tennis-ball:e720,tent:e8ba,terminal:e47e,terminal-window:eae8,test-tube:e7a0,text-a-underline:ed34,text-aa:e6ee,text-align-center:e480,text-align-justify:e482,text-align-left:e484,text-align-right:e486,text-b:e5be,text-bolder:e5be,text-columns:ec96,text-h:e6ba,text-h-five:e6c4,text-h-four:e6c2,text-h-one:e6bc,text-h-six:e6c6,text-h-three:e6c0,text-h-two:e6be,text-indent:ea1e,text-italic:e5c0,text-outdent:ea1c,text-strikethrough:e5c2,text-subscript:ec98,text-superscript:ec9a,text-t:e48a,text-t-slash:e488,text-underline:e5c4,textbox:eb0a,thermometer:e5c6,thermometer-cold:e5c8,thermometer-hot:e5ca,thermometer-simple:e5cc,threads-logo:ed9e,three-d:ea5a,thumbs-down:e48c,thumbs-up:e48e,ticket:e490,tidal-logo:ed1c,tiktok-logo:eaf2,tilde:eda8,timer:e492,tip-jar:e7e2,tipi:ed30,tire:edd2,toggle-left:e674,toggle-right:e676,toilet:e79a,toilet-paper:e79c,toolbox:eca0,tooth:e9cc,tornado:e88c,tote:e494,tote-simple:e678,towel:ede6,tractor:ec6e,trademark:e9f0,trademark-registered:e3f4,traffic-cone:e9a8,traffic-sign:e67a,traffic-signal:e9aa,train:e496,train-regional:e49e,train-simple:e4a0,tram:e9ec,translate:e4a2,trash:e4a6,trash-simple:e4a8,tray:e4aa,tray-arrow-down:e010,tray-arrow-up:ee52,treasure-chest:ede2,tree:e6da,tree-evergreen:e6dc,tree-palm:e91a,tree-structure:e67c,tree-view:ee48,trend-down:e4ac,trend-up:e4ae,triangle:e4b0,triangle-dashed:e4b2,trolley:e5b2,trolley-suitcase:e5b4,trophy:e67e,truck:e4b4,truck-trailer:e4b6,tumblr-logo:e8d4,twitch-logo:e5ce,twitter-logo:e4ba,umbrella:e684,umbrella-simple:e686,union:edbe,unite:e87e,unite-square:e878,upload:e4be,upload-simple:e4c0,usb:e956,user:e4c2,user-check:eafa,user-circle:e4c4,user-circle-check:ec38,user-circle-dashed:ec36,user-circle-gear:e4c6,user-circle-minus:e4c8,user-circle-plus:e4ca,user-focus:e6fc,user-gear:e4cc,user-list:e73c,user-minus:e4ce,user-plus:e4d0,user-rectangle:e4d2,user-sound:eca8,user-square:e4d4,user-switch:e756,users:e4d6,users-four:e68c,users-three:e68e,van:e826,vault:e76e,vector-three:ee62,vector-two:ee64,vibrate:e4d8,video:e740,video-camera:e4da,video-camera-slash:e4dc,video-conference:edce,vignette:eba2,vinyl-record:ecac,virtual-reality:e7b8,virus:e7d6,visor:ee2a,voicemail:e4de,volleyball:e726,wall:e688,wallet:e68a,warehouse:ecd4,warning:e4e0,warning-circle:e4e2,warning-diamond:e7fc,warning-octagon:e4e4,washing-machine:ede8,watch:e4e6,wave-sawtooth:ea9c,wave-sine:ea9a,wave-square:ea9e,wave-triangle:eaa0,waveform:e802,waveform-slash:e800,waves:e6de,webcam:e9b2,webcam-slash:ecdc,webhooks-logo:ecae,wechat-logo:e8d2,whatsapp-logo:e5d0,wheelchair:e4e8,wheelchair-motion:e89a,wifi-high:e4ea,wifi-low:e4ec,wifi-medium:e4ee,wifi-none:e4f0,wifi-slash:e4f2,wifi-x:e4f4,wind:e5d2,windmill:e9f8,windows-logo:e692,wine:e6b2,wrench:e5d4,x:e4f6,x-circle:e4f8,x-logo:e4bc,x-square:e4fa,yarn:ed9a,yin-yang:e92a,youtube-logo:e4fc';
  let phosphorCatalog = null;
  function phosphorIcons() {
    if (phosphorCatalog) return phosphorCatalog;
    phosphorCatalog = new Map();
    for (const pair of PHOSPHOR_GLYPHS.split(',')) {
      const [name, hex] = pair.split(':');
      phosphorCatalog.set(`ph-${name}`, String.fromCodePoint(parseInt(hex, 16)));
    }
    return phosphorCatalog;
  }

  // Font Awesome icons reuse the glyph and font the page (theme included) actually renders, so if a
  // theme redraws icons in another font (e.g. Phosphor), icons picked here follow the same look.
  // Probed once with hidden icons and cached; re-probed when theme CSS changes.
  const faces = new Map();
  let faceSignature = '';
  function faceSignatureNow() {
    return `${styleSheetSignature()}|${doc.getElementById('custom-style')?.textContent?.length || 0}`;
  }
  function resolveFaces(values) {
    const todo = [...new Set(values)].filter(value => value && value !== 'none' && !value.startsWith('ph ') && !faces.has(value));
    if (!todo.length || !doc.body) return;
    if (IN_JSDOM) { for (const value of todo) faces.set(value, null); return; }
    const box = element('div', { 'data-stt-owned': '', 'aria-hidden': 'true', style: 'position:fixed;left:-9999px;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none' });
    const probes = todo.map(value => { const node = element('i', { class: value }); box.append(node); return [value, node]; });
    doc.body.append(box);
    for (const [value, node] of probes) {
      const before = host.getComputedStyle(node, '::before');
      const glyph = (before.content || '').replace(/^['"]|['"]$/g, '');
      faces.set(value, glyph && glyph !== 'none' && glyph !== 'normal' && [...glyph].length === 1
        ? { glyph, font: before.fontFamily, weight: before.fontWeight } : null);
    }
    box.remove();
  }
  function iconFace(prefix, name) {
    if (prefix === 'ph') {
      const glyph = catalogs.ph?.get(name);
      return glyph ? { glyph, font: fontFamilies.ph, weight: '400' } : null;
    }
    const value = `${prefix} ${name}`;
    resolveFaces([value]);
    const seen = faces.get(value);
    if (seen && catalogs[prefix]?.has(name)) return seen;
    const glyph = catalogs[prefix]?.get(name);
    return glyph ? { glyph, font: fontFamilies[prefix], weight: prefix === 'fa-solid' ? '900' : '400' } : seen || null;
  }

  // Icon style: 'auto' = as the theme draws them, 'fa' = force Font Awesome, 'ph' = force Phosphor.
  // Map of Font Awesome names used by SillyTavern to their closest Phosphor equivalents.
  const FA_TO_PH = '1:number-one,address-book:address-book,address-card:identification-card,align-left:align-left,anchor:anchor,angle-down:caret-down,angle-up:caret-up,angles-down:caret-double-down,angles-up:caret-double-up,archive:archive,arrow-alt-circle-right:arrow-circle-right,arrow-down:arrow-down,arrow-down-1-9:sort-ascending,arrow-down-9-1:sort-descending,arrow-down-a-z:sort-ascending,arrow-down-short-wide:sort-ascending,arrow-down-wide-short:sort-descending,arrow-left:arrow-left,arrow-right:arrow-right,arrow-right-arrow-left:arrows-left-right,arrow-right-from-bracket:sign-out,arrow-right-rotate:arrow-clockwise,arrow-right-to-bracket:sign-in,arrow-rotate-left:arrow-counter-clockwise,arrow-rotate-right:arrow-clockwise,arrow-turn-up:arrow-bend-right-up,arrow-up:arrow-up,arrow-up-from-bracket:export,arrow-up-right-from-square:arrow-square-out,arrow-up-short-wide:sort-ascending,arrow-up-wide-short:sort-descending,arrow-up-z-a:sort-descending,arrows-alt:arrows-out-cardinal,arrows-left-right:arrows-left-right,arrows-left-right-to-line:arrows-in-line-horizontal,arrows-rotate:arrows-clockwise,asterisk:asterisk,at:at,atom:atom,award:medal,baby:baby,backward-step:skip-back,ban:prohibit,bars:list,beer-mug-empty:beer-stein,bell:bell,bell-slash:bell-slash,biohazard:biohazard,bolt:lightning,book:book,book-atlas:book-open-text,book-bookmark:book-bookmark,book-open:book-open,book-open-reader:book-open-user,book-skull:skull,bookmark:bookmark,bowl-food:bowl-food,box-archive:archive,box-open:package,brain:brain,bread-slice:bread,broom:broom,brush:paint-brush,bucket:paint-bucket,bug:bug,bug-slash:bug,building:building,bullhorn:megaphone,bullseye:target,cake-candles:cake,calculator:calculator,calendar:calendar,calendar-check:calendar-check,calendar-day:calendar-dot,calendar-plus:calendar-plus,camera:camera,cancel:prohibit,candy-cane:gift,caret-down:caret-down,caret-right:caret-right,caret-up:caret-up,cat:cat,chain:link,chain-broken:link-break,champagne-glasses:champagne,chart-bar:chart-bar,chart-simple:chart-bar,check:check,check-circle:check-circle,check-double:checks,check-square:check-square,check-to-slot:check-square,chess-board:checkerboard,chess-queen:crown,chevron-down:caret-down,chevron-left:caret-left,chevron-right:caret-right,chevron-up:caret-up,children:users-three,church:church,circle:circle,circle-check:check-circle,circle-chevron-down:caret-circle-down,circle-chevron-up:caret-circle-up,circle-dot:record,circle-exclamation:warning-circle,circle-half-stroke:circle-half,circle-info:info,circle-nodes:graph,circle-notch:circle-notch,circle-play:play-circle,circle-question:question,circle-stop:stop-circle,circle-xmark:x-circle,city:city,clapperboard:film-slate,clipboard:clipboard,clipboard-check:clipboard-text,clipboard-list:clipboard-text,clock:clock,clock-rotate-left:clock-counter-clockwise,clone:copy-simple,close:x,cloud:cloud,cloud-arrow-down:cloud-arrow-down,cloud-arrow-up:cloud-arrow-up,cloud-bolt:cloud-lightning,cloud-moon:cloud-moon,cloud-sun:cloud-sun,cloud-upload:cloud-arrow-up,clover:clover,code:code,code-branch:git-branch,code-compare:git-diff,code-merge:git-merge,cog:gear,coins:coins,comment:chat-circle,comment-dots:chat-circle-dots,comment-slash:chat-circle-slash,comments:chats-circle,compass:compass,compress:arrows-in,compress-alt:arrows-in-simple,cookie-bite:cookie,copy:copy,couch:couch,cross:cross,crow:bird,crown:crown,cubes:cube,cut:scissors,database:database,desktop:desktop,diagram-next:flow-arrow,diagram-project:tree-structure,dice:dice-five,dice-d20:dice-six,dice-d6:dice-six,discord:discord-logo,display:monitor,dna:dna,dog:dog,door-open:door-open,dove:bird,down-left-and-up-right-to-center:arrows-in-simple,download:download,dragon:fire,droplet:drop,drumstick-bite:fork-knife,dungeon:castle-turret,ear-listen:ear,earth-asia:globe-hemisphere-east,edit:pencil-simple,ellipsis:dots-three,ellipsis-h:dots-three,ellipsis-vertical:dots-three-vertical,envelope:envelope,envelope-open:envelope-open,envelope-open-text:envelope-open,eraser:eraser,exclamation:exclamation-mark,exclamation-circle:warning-circle,exclamation-triangle:warning,expand:arrows-out,expand-alt:arrows-out-simple,explosion:sparkle,external-link:arrow-square-out,external-link-alt:arrow-square-out,eye:eye,eye-slash:eye-slash,face-grin-wink:smiley-wink,face-smile:smiley,face-smile-beam:smiley,feather:feather,feather-pointed:feather,file:file,file-alt:file-text,file-arrow-down:file-arrow-down,file-arrow-up:file-arrow-up,file-audio:file-audio,file-circle-check:file-text,file-circle-plus:file-plus,file-circle-xmark:file-x,file-code:file-code,file-export:export,file-image:file-image,file-import:file-arrow-down,file-invoice:receipt,file-lines:file-text,file-pen:note-pencil,file-zipper:file-zip,film:film-strip,filter:funnel,filter-circle-xmark:funnel-x,fingerprint:fingerprint,fire:fire,fish:fish,flag:flag,flag-checkered:flag-checkered,flask:flask,floppy-disk:floppy-disk,folder:folder,folder-minus:folder-minus,folder-open:folder-open,folder-plus:folder-plus,folder-tree:tree-view,font:text-aa,forward:fast-forward,forward-step:skip-forward,frog:paw-print,gamepad:game-controller,gauge-high:gauge,gear:gear,gem:diamond,ghost:ghost,gift:gift,github:github-logo,glasses:eyeglasses,globe:globe,graduation-cap:graduation-cap,grip:dots-six,grip-vertical:dots-six-vertical,guitar:guitar,gun:crosshair,hammer:hammer,hand:hand,hand-fist:hand-fist,hand-point-right:hand-pointing,hand-pointer:hand-pointing,hand-sparkles:sparkle,hands-clapping:hands-clapping,hard-drive:hard-drive,hat-cowboy:cowboy-hat,hat-wizard:magic-wand,hdd:hard-drive,headphones:headphones,headphones-simple:headphones,headset:headset,heart:heart,highlighter:highlighter,hippo:paw-print,horse:horse,hourglass:hourglass,hourglass-half:hourglass-medium,house:house,house-chimney:house-line,hurricane:hurricane,ice-cream:ice-cream,icons:shapes,id-badge:identification-badge,id-card:identification-card,image:image,image-portrait:user-square,images:images,inbox:tray,info-circle:info,key:key,keyboard:keyboard,khanda:shield,kiwi-bird:bird,landmark:bank,language:translate,layer-group:stack,leaf:leaf,left-long:arrow-left,left-right:arrows-left-right,lightbulb:lightbulb,link:link,link-slash:link-break,list:list,list-check:list-checks,list-ol:list-numbers,list-ul:list-bullets,location-dot:map-pin,lock:lock,lock-open:lock-open,magic-wand-sparkles:magic-wand,magnifying-glass:magnifying-glass,magnifying-glass-minus:magnifying-glass-minus,magnifying-glass-plus:magnifying-glass-plus,map:map-trifold,map-location-dot:map-trifold,markdown:markdown-logo,martini-glass-citrus:martini,masks-theater:mask-happy,maximize:corners-out,message:chat-centered,meteor:meteor,microchip:cpu,microphone:microphone,microphone-lines:microphone,microscope:microscope,minimize:corners-in,minus:minus,mobile-screen:device-mobile,mobile-screen-button:device-mobile,moon:moon,mountain-sun:mountains,mouse:mouse,mug-hot:coffee,mug-saucer:coffee,music:music-note,network-wired:network,note-sticky:note,notes-medical:first-aid,object-group:selection,om:flower-lotus,otter:paw-print,paint-roller:paint-roller,paintbrush:paint-brush,palette:palette,panorama:panorama,paper-plane:paper-plane-tilt,paperclip:paperclip,passport:identification-badge,paste:clipboard,pause:pause,paw:paw-print,peace:peace,pen:pen,pen-nib:pen-nib,pen-ruler:pencil-ruler,pen-to-square:note-pencil,pencil:pencil,people-arrows:users,people-group:users-three,person-circle-question:user-circle,person-dress:person,person-running:person-simple-run,person-through-window:door-open,person-walking:person-simple-walk,phone:phone,phone-slash:phone-slash,phone-volume:phone-call,photo-film:images,pie-chart:chart-pie,plane:airplane,plane-slash:airplane,play:play,plug:plug,plug-circle-check:plugs-connected,plug-circle-exclamation:plug,plug-circle-xmark:plugs,plus:plus,plus-circle:plus-circle,plus-square:plus-square,power-off:power,puzzle-piece:puzzle-piece,question:question,question-circle:question,quote-left:quotes,radiation:radioactive,radio:radio,rainbow:rainbow,random:shuffle,ranking-star:ranking,receipt:receipt,recycle:recycle,redo:arrow-clockwise,redo-alt:arrow-clockwise,refresh:arrows-clockwise,repeat:repeat,right-from-bracket:sign-out,right-left:arrows-left-right,ring:circle,robot:robot,rocket:rocket,rotate:arrows-clockwise,rotate-left:arrow-counter-clockwise,rotate-right:arrow-clockwise,ruler:ruler,ruler-combined:ruler,ruler-horizontal:ruler,sailboat:sailboat,satellite:broadcast,save:floppy-disk,scale-balanced:scales,scale-unbalanced:scales,scissors:scissors,screwdriver-wrench:wrench,scroll:scroll,sd-card:sim-card,search:magnifying-glass,seedling:plant,server:hard-drives,share:share,share-from-square:share,share-nodes:share-network,shield:shield,shield-halved:shield,shoe-prints:footprints,shuffle:shuffle,shuttle-space:rocket,sign-in-alt:sign-in,sign-out-alt:sign-out,signal:cell-signal-full,signature:signature,sitemap:tree-structure,skull:skull,skull-crossbones:skull,sliders:sliders,snowflake:snowflake,sort:arrows-down-up,spell-check:text-aa,spider:bug,spinner:spinner,square:square,square-check:check-square,square-minus:minus-square,square-poll-horizontal:chart-bar-horizontal,square-root-variable:function,star:star,star-of-life:asterisk,stethoscope:stethoscope,sticky-note:note,stop:stop,stop-circle:stop-circle,store:storefront,sun:sun,sync:arrows-clockwise,syringe:syringe,table-cells-large:squares-four,tag:tag,tags:tag,temperature-high:thermometer-hot,terminal:terminal,text-height:text-t,text-width:arrows-horizontal,theater-masks:mask-happy,thumb-tack:push-pin,thumbs-up:thumbs-up,thumbtack:push-pin,timeline:path,times:x,times-circle:x-circle,toggle-off:toggle-left,toggle-on:toggle-right,toolbox:toolbox,tools:wrench,torii-gate:bank,trash:trash,trash-alt:trash,trash-arrow-up:trash-simple,trash-can:trash,tree:tree,triangle-exclamation:warning,trophy:trophy,truck-arrow-right:truck,truck-moving:truck,tv:television,umbrella:umbrella,undo:arrow-counter-clockwise,unlink:link-break,unlock:lock-open,up-right-and-down-left-from-center:arrows-out-simple,up-right-from-square:arrow-square-out,upload:upload,user:user,user-astronaut:user,user-check:user-check,user-cog:user-gear,user-graduate:student,user-group:users,user-minus:user-minus,user-ninja:user,user-pen:user,user-plus:user-plus,user-secret:detective,user-shield:shield-check,user-slash:user-minus,user-tag:tag,user-tie:user,user-xmark:user-minus,users:users,users-gear:user-gear,users-slash:users,vest-patches:t-shirt,vial:flask,video:video,voicemail:voicemail,volcano:mountains,volume-high:speaker-high,volume-low:speaker-low,volume-off:speaker-none,volume-xmark:speaker-x,wand-magic:magic-wand,wand-magic-sparkles:magic-wand,wand-sparkles:magic-wand,water:waves,wave-square:wave-square,wifi:wifi-high,wikipedia-w:globe,wind:wind,window-maximize:app-window,window-restore:browsers,wine-glass:wine,wrench:wrench,x:x,xmark:x,yin-yang:yin-yang,youtube:youtube-logo';
  const ICON_STYLES = ['auto', 'fa', 'ph'];
  const ICON_STYLE_LABELS = { auto: '테마', fa: 'Font Awesome', ph: 'Phosphor' };
  const ICON_STYLE_SHORT = { auto: '테마', fa: 'FA', ph: 'Phosphor' };
  let iconPairs = null;
  let iconStyleKey = '';
  let iconStyleEmpty = false;
  let themeIconFonts = null;
  let themeIconKey = '';
  // Detects theme/extension CSS changes. Excludes our own icon stylesheet; theme CSS is compared by
  // content, not length.
  let iconThemeCss = null, iconThemeSheets = '', iconThemeVersion = 0;
  function iconThemeKey() {
    const css = doc.getElementById('custom-style')?.textContent || '';
    const sheets = styleSheetSignature().split('|').filter(part => !part.startsWith('stt-icon-style:')).join('|')
      + '|' + [...doc.styleSheets].map(sheet => sheet.ownerNode?.id === 'stt-icon-style' ? '' : sheet.disabled ? 0 : 1).join('');
    if (css !== iconThemeCss || sheets !== iconThemeSheets) { iconThemeCss = css; iconThemeSheets = sheets; iconThemeVersion++; }
    return String(iconThemeVersion);
  }
  // First font family the theme actually uses per icon. Probes are marked so our own icon style
  // does not apply to them.
  function themeIconFamilies() {
    const key = iconThemeKey();
    if (themeIconFonts && key === themeIconKey) return themeIconFonts;
    themeIconKey = key;
    themeIconFonts = new Map();
    if (!doc.body || IN_JSDOM) return themeIconFonts;
    const box = element('div', { 'data-stt-owned': '', 'aria-hidden': 'true', style: 'position:fixed;left:-9999px;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none' });
    const probes = [...faToPh().keys()].map(fa => {
      const prefix = catalogs['fa-solid']?.has(fa) ? 'fa-solid' : 'fa-brands';
      const node = element('i', { class: `${prefix} ${fa}`, 'data-stt-probe': '' });
      box.append(node);
      return [fa, node];
    });
    doc.body.append(box);
    for (const [fa, node] of probes) {
      const before = host.getComputedStyle(node, '::before');
      const content = (before.content || '').replace(/^['"]|['"]$/g, '');
      if (!content || content === 'none' || content === 'normal') continue;
      themeIconFonts.set(fa, (before.fontFamily || '').split(',')[0].replace(/["']/g, '').trim());
    }
    box.remove();
    return themeIconFonts;
  }
  function faToPh() {
    if (iconPairs) return iconPairs;
    iconPairs = new Map();
    for (const pair of FA_TO_PH.split(',')) {
      const [fa, ph] = pair.split(':');
      iconPairs.set(`fa-${fa}`, `ph-${ph}`);
    }
    return iconPairs;
  }
  function iconStyleCss(mode) {
    if (mode === 'auto') return '';
    const scope = 'html body:not(#stt-icon-scope)';
    const not = ':not([data-stt-glyph]):not([data-stt-probe])';
    const already = mode === 'ph' ? /phosphor/i : /awesome/i;
    const drawn = themeIconFamilies();
    const names = [], contents = [];
    for (const [fa, ph] of faToPh()) {
      // Skip icons the theme already draws in the chosen style: no override, no style cost.
      if (already.test(drawn.get(fa) || '')) continue;
      const glyph = mode === 'ph' ? catalogs.ph?.get(ph) : (catalogs['fa-solid']?.get(fa) || catalogs['fa-brands']?.get(fa));
      if (!glyph) continue;
      names.push(`.${fa}`);
      contents.push(`${scope} .${fa}.${fa}${not}::before { content: "\\${glyph.codePointAt(0).toString(16)}" !important; }`);
    }
    if (!names.length) return '';
    // A single :is() with ~500 icon classes is matched against every element; a plain selector list
    // lets the engine only test elements that carry one of those classes.
    // The extra id in the scope lifts specificity so extensions that pin their own icons to Font Awesome
    // with an id-scoped rule still follow the chosen style, without listing those extensions by name.
    const list = names.map(name => `${scope}:not(#stt-icon-scope-2) ${name}${not}::before`).join(',\n');
    const face = mode === 'ph'
      ? `font-family: ${fontFamilies.ph}, "Font Awesome 6 Free", "Font Awesome 6 Brands" !important; font-weight: 400 !important; font-style: normal !important; display: inline-block; line-height: 1; vertical-align: -.065em; transform: scale(1.15); -webkit-text-stroke: .02em currentColor;`
      : 'font-family: inherit !important; font-weight: inherit !important; vertical-align: baseline !important; transform: none !important; -webkit-text-stroke: 0 !important;';
    return `/* ST Tailor icon style: ${ICON_STYLE_LABELS[mode]} */\n`
      + `${list} { ${face} }\n`
      + contents.join('\n');
  }
  function applyIconStyle(mode) {
    mode = ICON_STYLES.includes(mode) ? mode : 'auto';
    const node = doc.getElementById('stt-icon-style');
    const key = mode === 'auto' ? 'auto' : `${mode}|${iconThemeKey()}`;
    if (key === iconStyleKey && (mode === 'auto' || node || iconStyleEmpty)) return false;
    const css = iconStyleCss(mode);
    if (!css) node?.remove();
    else if (node) node.textContent = css;
    else { const style = own(element('style', { id: 'stt-icon-style' })); style.textContent = css; doc.head.append(style); }
    iconStyleKey = mode === 'auto' ? 'auto' : `${mode}|${iconThemeKey()}`;
    iconStyleEmpty = !css;
    faces.clear();
    return true;
  }

  let sheetSignature = null;
  function styleSheetSignature() {
    const parts = [];
    for (const sheet of doc.styleSheets) {
      let count = -1;
      try { count = sheet.cssRules.length; } catch { count = -1; }
      parts.push(`${sheet.href || sheet.ownerNode?.id || ''}:${count}`);
    }
    return parts.join('|');
  }

  function loadIcons(force = true, reuse = false) {
    const signature = styleSheetSignature();
    if (!force && signature === sheetSignature) return;
    sheetSignature = signature;
    const cache = host.__ST_TAILOR_ICONS__;
    if (reuse && cache?.signature === signature) {
      catalogs = { ...cache.catalogs, ph: phosphorIcons() };
      fontFamilies = { ...cache.fontFamilies };
      return;
    }
    const next = { 'fa-solid': new Map(), 'fa-regular': new Map(), 'fa-brands': new Map(), ph: phosphorIcons() };
    const parseRules = (rules, hint = '') => {
      for (const rule of rules) {
        if (rule.cssRules && !rule.selectorText) { parseRules(rule.cssRules, hint); continue; }
        if (!rule.selectorText || !rule.style) continue;
        if (!/before|\.fa-/.test(rule.selectorText)) continue;
        const content = rule.style.getPropertyValue('content') || rule.style.getPropertyValue('--fa');
        if (!content) continue;
        let glyph = content.trim().replace(/^["']|["']$/g, '');
        glyph = glyph.replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
        if ([...glyph].length !== 1) continue;
        const selector = rule.selectorText;
        const prefix = /(?:fa-brands|fab)/.test(selector) || /brands/.test(hint) ? 'fa-brands'
          : /(?:fa-regular|far)/.test(selector) || /regular/.test(hint) ? 'fa-regular' : 'fa-solid';
        for (const match of selector.matchAll(/\.(fa-[a-z0-9-]+)(?=[:\s,.]|$)/g)) {
          if (!['fa-solid', 'fa-regular', 'fa-brands'].includes(match[1])) next[prefix].set(match[1], glyph);
        }
      }
    };
    // Present in the font but missing from SillyTavern's Font Awesome CSS.
    for (const name of ['fa-spaghetti-monster-flying', 'fa-pastafarianism']) next['fa-solid'].set(name, '\uf67b');
    for (const sheet of doc.styleSheets) {
      try {
        if (!sheet.ownerNode?.matches?.(OWN) && sheet.ownerNode?.id !== 'custom-style') parseRules(sheet.cssRules, `${sheet.href || ''} ${sheet.ownerNode?.getAttribute?.('href') || ''}`.toLowerCase());
      } catch {  }
    }
    catalogs = next;
    for (const prefix of ['fa-solid', 'fa-regular', 'fa-brands']) {
      const probe = element('i', { class: `${prefix} fa-star`, 'data-stt-owned': '', style: 'position:fixed;visibility:hidden;pointer-events:none' });
      doc.body.append(probe);
      const family = host.getComputedStyle(probe).fontFamily;
      if (family && /awesome/i.test(family)) fontFamilies[prefix] = family;
      probe.remove();
    }
    host.__ST_TAILOR_ICONS__ = { signature, catalogs, fontFamilies: { ...fontFamilies } };
  }

  // Some extensions draw their mark as a bare inline <svg> (no font glyph, no data-icon).
  // Count the outermost one as the row's icon so hiding or swapping icons covers it too.
  const inlineSvgIcon = node => node.matches('svg') && !node.parentElement?.closest('svg')
    && !node.closest('.inline-drawer-icon,.inline-drawer-toggle .fa-circle-chevron-down');

  function originalIcons(root) {
    const nodes = [root, ...root.querySelectorAll('i,span,div,svg')];
    return nodes.filter(node => (!node.closest(OWN) || OWN_EXEMPT.has(node.closest(OWN).id))
      && !node.matches('.inline-drawer-icon,.fa-question-circle,.fa-circle-question,[data-status],.status-text,.status_text,.extension-status,.version,.badge')
      && (fontGlyph(node) || node.matches('svg[data-icon]') || inlineSvgIcon(node)));
  }

  const originalIcon = root => originalIcons(root)[0] || null;

  const TOPBAR_HANDLES = [':scope > .drawer-toggle', ':scope > .top-bar-button', ':scope > .drawer-icon', ':scope > .top-bar-button-icon'];
  function topbarHandle(node) {
    for (const selector of TOPBAR_HANDLES) {
      const handle = node.querySelector(selector);
      if (handle) return handle;
    }
    return node;
  }

  function textParts(root) {
    const result = [];
    const walker = doc.createTreeWalker(root, host.NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue.trim() || node.parentElement.closest(root.id === 'stt-open-wand' ? SKIP_TEXT : `${SKIP_TEXT},${OWN}`)) continue;
      if (VERSION_TEXT.test(node.nodeValue.trim())) continue;
      if (/^[?ⓘ]$/.test(node.nodeValue.trim())) continue;
      result.push(node);
    }
    return result;
  }

  function labelInfo(root, area) {
    if (area === 'topbar') {
      const scope = topbarHandle(root);
      const icon = originalIcons(scope)[0] || scope.querySelector('.drawer-icon,.top-bar-button-icon,[data-icon]') || root.querySelector('.drawer-icon,.top-bar-button-icon,[data-icon]');
      const shortAttribute = ['aria-label', 'title', 'data-tooltip']
        .flatMap(name => [root.getAttribute(name), scope.getAttribute?.(name), icon?.getAttribute(name)])
        .map(value => cleanString(value, 60))
        .find(value => value && value.length <= 48);
      const iconClass = iconName(icon?.classList || root.classList, iconPrefix(icon || root));
      const name = shortAttribute || (iconClass ? `아이콘 · ${iconClass.replace(/^fa-/, '')}` : root.id || '상단바 아이콘');
      return { titleRoot: scope, parts: [], namedPart: null, name };
    }
    const titleRoot = area === 'extensions'
      ? root.querySelector('.inline-drawer-header,.inline-drawer-toggle,summary') || root
      : root;
    const parts = textParts(titleRoot);
    const namedPart = parts.find(n => n.parentElement.matches('[data-i18n],b,strong,.menu-label,.label,.title')) || parts[0];
    const text = parts.map(n => n.nodeValue.trim()).join(' ').replace(/\s+/g, ' ').slice(0, 180);
    const name = text || titleRoot.getAttribute('title') || titleRoot.getAttribute('aria-label') || titleRoot.getAttribute('data-tooltip') || root.id || '이름 없는 항목';
    return { titleRoot, parts, namedPart, name };
  }

  const ignoredClasses = /^(fa($|-)|fas$|far$|fab$|displayNone$|hidden$|disabled$|active$|selected$|visible$|interactable$|menu_button|mes_button$|flex|align|justify|gap|margin|padding|wide|up$|down$|open|closed|stt-)/;
  function stableKey(node, area, boundary) {
    const data = ['data-action', 'data-command', 'data-extension-id', 'data-extension', 'data-id'];
    if (node.id && area !== 'messages') return `id:${node.id}`;
    for (const name of data) {
      if (node.hasAttribute(name)) return `${name}:${node.getAttribute(name)}`;
    }
    const classes = [...node.classList].filter(x => !ignoredClasses.test(x)).sort();
    if (area === 'messages' && classes.length) return `action:${classes.join('.')}`;
    const i18n = node.getAttribute('data-i18n') || node.querySelector('[data-i18n]')?.getAttribute('data-i18n');
    let parent = node.parentElement;
    let parentId = '';
    while (parent && parent !== boundary) { if (parent.id) { parentId = parent.id; break; } parent = parent.parentElement; }
    if (i18n) return `i18n:${parentId}:${i18n}`;
    if (classes.length) return `class:${parentId}:${classes.join('.')}`;
    const link = node.getAttribute('href');
    if (link && !/^javascript:/i.test(link)) return `link:${parentId}:${link}`;
    return `label:${parentId}:${labelInfo(node, area).name}`;
  }

  function providerDisabled(node) {
    if (node.closest('[data-extension-enabled="false"],[data-feature-enabled="false"]')) return true;
    const disabled = disabledExtensions();
    if (!disabled.length) return false;
    const owner = node.closest('[data-extension-id],[data-extension]');
    const ownerId = owner?.getAttribute('data-extension-id') || owner?.getAttribute('data-extension');
    return !!ownerId && disabled.some(id => id === ownerId || id === `third-party/${ownerId}`);
  }

  function available(node, boundary) {
    if (!node.isConnected || providerDisabled(node)) return false;
    for (let current = node; current && current !== boundary; current = current.parentElement) {
      if (current.hidden || current.getAttribute('aria-hidden') === 'true') return false;
      if (host.getComputedStyle(current).display === 'none') return false;
    }
    return true;
  }

  const messageButtonRows = () => doc.getElementById('chat')?.querySelectorAll('.extraMesButtons') || [];

  const extensionRootList = () => ['extensions_settings', 'extensions_settings2']
    .map(id => doc.getElementById(id)).filter(Boolean);

  function extensionPanelRoot() {
    if (panelRootCache === undefined) panelRootCache = extensionBoundary(extensionRootList());
    return panelRootCache;
  }

  function extensionBoundary(roots) {
    const connected = roots.filter(root => root?.isConnected);
    if (!connected.length) return null;
    const candidates = new Set();
    for (const root of connected) {
      for (const selector of ['.extensions_block', '#rm_extensions_block']) {
        const candidate = root.closest(selector);
        if (candidate && connected.every(other => candidate.contains(other))) candidates.add(candidate);
      }
    }
    if (candidates.size) return [...candidates].sort((a, b) => {
      const depth = node => { let value = 0; for (let current = node; current; current = current.parentElement) value++; return value; };
      return depth(b) - depth(a);
    })[0];
    let common = connected[0];
    while (common && !connected.every(root => common === root || common.contains(root))) common = common.parentElement;
    return common;
  }

  const extensionGridItem = (entry, boundary = null) => {
    const drawer = entry.titleRoot.closest('.inline-drawer,details');
    if (!drawer || drawer === boundary || ['extensions_settings', 'extensions_settings2', 'rm_extensions_block'].includes(drawer.id)) return entry.titleRoot;
    return drawer;
  };

  // The layout is rebuilt on every settings change, so the last column count lives outside it
  // (changing a setting at the breakpoint width must not flip the column count). Panel heights and
  // width are kept too: when a refresh (generation start/end, etc.) rebuilds the layout while the
  // drawer is closed, it is pre-placed from memory, so opening the drawer need not re-measure every
  // panel and the open animation does not stutter.
  let extensionColumnsMemory = 0, extensionWidthMemory = 0;
  const extensionHeightMemory = new WeakMap(), extensionMarginMemory = new WeakMap();
  function layoutExtensionColumns(common, items, paths, gap) {
    const panels = new Set(items);
    const before = [], after = [];
    let passedPanels = false;
    const visit = parent => {
      for (const node of parent.children) {
        if (panels.has(node)) { passedPanels = true; continue; }
        if (paths.has(node)) { visit(node); continue; }
        if (node.matches('style,script,template')) continue;
        (passedPanels ? after : before).push(node);
      }
    };
    visit(common);
    const overrides = new Map();
    let frame = 0;
    let disposed = false;
    const set = (node, property, value) => {
      let properties = overrides.get(node);
      if (!properties) { properties = new Map(); overrides.set(node, properties); }
      if (!properties.has(property)) properties.set(property, { value: node.style.getPropertyValue(property), priority: node.style.getPropertyPriority(property), applied: null, hadStyle: node.hasAttribute('style') });
      const saved = properties.get(property);
      if (node.style.getPropertyValue(property) === value && node.style.getPropertyPriority(property) === 'important') return;
      node.style.setProperty(property, value, 'important');
      saved.applied = node.style.getPropertyValue(property);
    };
    // Measuring every frame while the drawer expands forces reflow and makes the animation stutter.
    // During animation, use the sizes ResizeObserver reports; measure directly only on first run,
    // on clicks (opening a nested drawer, etc.) and when the column count changes.
    const everything = () => [...before, ...items, ...after];
    const heights = extensionHeightMemory, margins = extensionMarginMemory;
    let width = null, padding = 0, columnsNow = 0;
    const readWidth = () => {
      const css = host.getComputedStyle(common);
      padding = (parseFloat(css.paddingLeft) || 0) + (parseFloat(css.paddingRight) || 0);
      width = common.clientWidth;
    };
    const measure = () => {
      for (const node of everything()) {
        const style = host.getComputedStyle(node);
        margins.set(node, (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0));
        heights.set(node, node.getClientRects().length && style.display !== 'none' ? node.offsetHeight : -1);
      }
    };
    const remembered = () => extensionColumnsMemory && extensionWidthMemory && everything().every(node => heights.has(node) && margins.has(node));
    const update = (full = false) => {
      frame = 0;
      if (disposed || !common.isConnected) return;
      if (full || width === null) readWidth();
      // Drawer closed (width 0): pre-place from memory if available. Do not read live values here;
      // everything would read as hidden.
      const hidden = !width;
      if (hidden && !remembered()) return;
      const layoutWidth = hidden ? extensionWidthMemory : width;
      if (!hidden) extensionWidthMemory = width;
      // Near the breakpoint the measured width jitters by a few px (scrollbar, retina rounding,
      // drawer animation), so two columns must get a bit narrower before dropping to one.
      const columns = layoutWidth >= ((columnsNow || extensionColumnsMemory) === 2 ? 680 : 700) ? 2 : 1;
      const previousColumns = columnsNow;
      columnsNow = extensionColumnsMemory = columns;
      set(common, 'grid-template-columns', `repeat(${columns}, minmax(0, 1fr))`);
      if (columns === 1) {
        // One column needs no masonry: just stack in order without measuring. Measuring every
        // panel here used to coincide with the drawer opening and cause jank; the result looks the same.
        set(common, 'grid-auto-rows', 'auto');
        set(common, 'row-gap', `${gap}px`);
        let index = 0;
        for (const node of [...before, ...items, ...after]) {
          set(node, 'grid-column', '1 / -1');
          set(node, 'grid-row', 'auto');
          set(node, 'order', String(index++));
        }
        return;
      }
      set(common, 'grid-auto-rows', '1px');
      set(common, 'row-gap', '0');
      // Exact measuring order: visibility, then column assignment, then height (height depends on
      // column width).
      const exact = !hidden && (full || previousColumns !== columns || !remembered());
      if (exact) for (const node of everything()) heights.set(node, node.getClientRects().length && host.getComputedStyle(node).display !== 'none' ? 0 : -1);
      const visible = nodes => nodes.filter(node => (heights.get(node) ?? -1) >= 0);
      const orderedItems = visible(items), leading = visible(before), trailing = visible(after);
      orderedItems.forEach((node, index) => set(node, 'grid-column', String(index % columns + 1)));
      for (const node of [...leading, ...trailing]) set(node, 'grid-column', '1 / -1');
      if (exact) measure();
      const spans = new Map([...leading, ...orderedItems, ...trailing].map(node => [node, Math.max(1, Math.ceil(heights.get(node) + (margins.get(node) || 0)))]));
      const ends = Array(columns).fill(1);
      const place = (node, column = null) => {
        const start = column === null ? Math.max(...ends) : ends[column];
        const height = spans.get(node);
        set(node, 'grid-row', `${start} / span ${height}`);
        const next = start + height + gap;
        if (column === null) ends.fill(next); else ends[column] = next;
      };
      for (const node of leading) place(node);
      orderedItems.forEach((node, index) => place(node, index % columns));
      for (const node of trailing) place(node);
    };
    // Rows are 1px tall and each panel spans as many as it measured, so a panel
    // that grows after placement overflows into its neighbour until we re-run.
    // requestAnimationFrame alone is not enough to guarantee that: it stops in a
    // hidden tab and gets starved while a heavy chat renders, which leaves the
    // overlap on screen. Pair it with a timer so the fix always lands.
    let backstop = 0, pendingFull = false;
    const runLayout = (full = false) => {
      host.cancelAnimationFrame(frame);
      host.clearTimeout(backstop);
      frame = 0; backstop = 0;
      const all = pendingFull || full === true;
      pendingFull = false;
      update(all);
    };
    const scheduleLayout = (full = false) => {
      if (full === true) pendingFull = true;
      if (disposed || frame || backstop) return;
      frame = host.requestAnimationFrame(runLayout);
      backstop = host.setTimeout(runLayout, 120);
    };
    let commonWatched = true, rewatchFrame = 0;
    const onResize = entries => {
      let widthChanged = false, heightChanged = false;
      for (const entry of entries) {
        if (entry.target !== common) continue;
        const next = Math.round(entry.contentRect.width + padding);
        if (next !== width) { width = next; widthChanged = true; }
      }
      // A closed drawer reports every panel as 0 x 0; keep the remembered heights.
      if (!width) { if (widthChanged) scheduleLayout(); return; }
      for (const entry of entries) {
        if (entry.target === common) continue;
        const box = entry.borderBoxSize?.[0];
        // 0 x 0 means hidden (display: none). Round like offsetHeight.
        const next = !box ? (entry.target.getClientRects().length ? entry.target.offsetHeight : -1)
          : box.inlineSize || box.blockSize ? Math.round(box.blockSize) : -1;
        if (heights.get(entry.target) !== next) { heights.set(entry.target, next); heightChanged = true; }
      }
      // One column: height changes do not affect placement, only width does.
      if (columnsNow === 1 && !widthChanged) return;
      if (widthChanged || columnsNow !== 2) { scheduleLayout(); return; }
      if (!heightChanged) return;
      // Two columns, only heights changed (e.g. drawer expanding): re-place before this frame paints
      // so lower panels do not lag behind. Re-placing resizes the container, so stop observing it
      // until the next frame; otherwise that notification loops within this frame (browser warning).
      if (commonWatched) { observer.unobserve(common); commonWatched = false; }
      runLayout();
      if (!rewatchFrame) rewatchFrame = host.requestAnimationFrame(() => {
        rewatchFrame = 0;
        if (!disposed && !commonWatched) { watch(common); commonWatched = true; }
      });
    };
    // Nested <details> toggles have no animation: re-measure right away instead of waiting for
    // observer notifications.
    const onToggle = () => { if (columnsNow !== 1) scheduleLayout(true); };
    // Other clicks (opening a drawer, etc.): verify once after the animation ends; observer values
    // are enough while it runs.
    let settleTimer = 0;
    const onClick = () => {
      if (columnsNow === 1) return;
      host.clearTimeout(settleTimer);
      settleTimer = host.setTimeout(() => scheduleLayout(true), 400);
    };
    const observer = host.ResizeObserver ? new host.ResizeObserver(onResize) : null;
    // border-box, so a theme that animates padding or borders is noticed too.
    const watch = node => { try { observer?.observe(node, { box: 'border-box' }); } catch { observer?.observe(node); } };
    watch(common);
    for (const node of [...items, ...before, ...after]) watch(node);
    host.addEventListener('resize', scheduleLayout);
    common.addEventListener('click', onClick);
    common.addEventListener('toggle', onToggle, true);
    // Late webfonts reflow every panel at once; re-measure when they land.
    if (doc.fonts?.status === 'loading') doc.fonts.ready.then(() => scheduleLayout(true)).catch(() => {});
    runLayout(true);
    return {
      dispose() {
        disposed = true;
        observer?.disconnect();
        host.cancelAnimationFrame(frame);
        host.clearTimeout(backstop);
        host.removeEventListener('resize', scheduleLayout);
        host.clearTimeout(settleTimer);
        host.cancelAnimationFrame(rewatchFrame);
        common.removeEventListener('click', onClick);
        common.removeEventListener('toggle', onToggle, true);
        for (const [node, properties] of overrides) for (const [property, saved] of properties) {
          if (saved.applied === null || node.style.getPropertyValue(property) !== saved.applied || node.style.getPropertyPriority(property) !== 'important') continue;
          if (saved.value) node.style.setProperty(property, saved.value, saved.priority); else node.style.removeProperty(property);
          if (!saved.hadStyle && !node.getAttribute('style')) node.removeAttribute('style');
        }
      },
    };
  }

  function dynamicInfo(node, info, area, key, icon) {
    const statusNode = info.titleRoot.querySelector(STATUS);
    const isSD = node.matches('.sd_message_gen') || (area !== 'topbar' && area !== 'extensions' && !!node.querySelector('.sd_message_gen'));
    const isStop = node.matches('#mes_stop,#stscript_stop,#stscript_pause,#stscript_continue');
    const explicit = node.matches('[aria-busy],[data-state],[data-status]') || !!statusNode;
    const signature = { label: info.parts.map(n => n.nodeValue).join(''), icon: fontGlyph(icon) || icon?.getAttribute('data-icon') || '', color: info.titleRoot.style.color + '|' + (icon?.style.color || '') };
    const memoryKey = `${area}/${key}`;
    let memory = seen.get(memoryKey);
    if (!memory) {
      memory = { initial: signature, changed: { label: false, icon: false, color: false } };
      seen.set(memoryKey, memory);
    } else {
      const settling = Date.now() < settleUntil;
      for (const field of ['label', 'icon', 'color']) {
        if (memory.initial[field] === signature[field]) continue;
        // Still booting, or the first sighting was blank because ST had not
        // finished building this button: adopt the real value as the baseline
        // instead of reading it as a glyph that tracks state, which would make
        // preserve-original win and silently drop the user's own alias/icon
        // for the rest of the session.
        if (settling || !memory.initial[field]) { memory.initial[field] = signature[field]; continue; }
        memory.changed[field] = true;
      }
    }
    const dynamic = isSD || isStop || explicit || Object.values(memory.changed).some(Boolean);
    const busy = isSD ? node.classList.contains('fa-hourglass')
      : isStop || node.getAttribute('aria-busy') === 'true' || !!statusNode || (explicit && !!(node.getAttribute('data-state') || node.getAttribute('data-status')));
    return { dynamic, busy, busyDriven: isSD || isStop, known: isSD || isStop || explicit, split: !!statusNode, changed: memory.changed };
  }

  // Some scripts dock beside #leftSendForm/#rightSendForm instead of inside
  // them (notably when those wrappers use display:contents). Share one small,
  // shallow source list between the editor, layout, and change detection.
  const inputSourceSides = new WeakMap();
  const INPUT_NON_BUTTON = 'style,script,template,textarea,input[type="hidden"],#nonQRFormItems,#leftSendForm,#rightSendForm,#qr--bar,.stt-qr-shell,.stt-qr-row,.stt-qr-arrow,[role="status"],[role="dialog"],[role="alert"]';
  const INPUT_LOOSE_BUTTON = 'button,[role="button"],a[href],input[type="button"],input[type="submit"],[onclick],.interactable,.menu_button,.menu_button_icon,.fa,.fas,.far,.fab,.fa-solid,.fa-regular,.fa-brands,svg[data-icon]';
  const INPUT_SOURCE_ICONS = 'i,svg,img,[data-icon],.fa,.fas,.far,.fab,.fa-solid,.fa-regular,.fa-brands';
  const INPUT_ORDER_ATTRIBUTE = 'data-stt-input-order-managed';
  const GENERATION_TOGGLED = '#mes_stop,#stscript_stop,#stscript_pause,#stscript_continue';

  function inputSourceStyle(node) {
    let value = node.style.cssText;
    // Our QR tone variables only repaint the icon; a theme color change must
    // not tear down/reapply the composer and wake other button providers.
    if (node.id === 'stt-qr-toggle') value = value.split(';')
      .filter(part => !/^\s*--stt-qr-(?:color|opacity)\s*:/.test(part)).join(';').trim();
    // SillyTavern shows/hides these buttons during generation and command runs. A display-only
    // change needs no reapply: placement orders every button regardless of visibility, and
    // SillyTavern owns visibility. Avoids a full reapply on every generation start/end.
    if (node.matches(GENERATION_TOGGLED)) value = value.split(';')
      .filter(part => !/^\s*display\s*:/.test(part)).join(';').trim();
    // The provider's order is not authoritative while our CSS owns placement.
    // Ignore only that property; hidden/state/size/icon changes are still read.
    return node.hasAttribute(INPUT_ORDER_ATTRIBUTE)
      ? value.replace(/(^|;)\s*order\s*:[^;]*(;|$)/gi, '$1').trim() : value;
  }


  function inputButtonSources() {
    const result = [];
    const visited = new Set();
    const add = (node, root, side, loose = false) => {
      if (visited.has(node) || node.matches(INPUT_NON_BUTTON)) return;
      if (node.closest(OWN) && !OWN_EXEMPT.has(node.id)) return;
      if (loose && !node.matches(INPUT_LOOSE_BUTTON)) return;
      visited.add(node);
      // A saved left/right choice must not redefine the original side.
      // Unaffiliated composer controls default to the left-hand tool group.
      if (side) inputSourceSides.set(node, side);
      else if (!inputSourceSides.has(node)) inputSourceSides.set(node, 'left');
      result.push({ node, root, side: inputSourceSides.get(node), loose });
    };
    for (const [id, side] of [['leftSendForm', 'left'], ['rightSendForm', 'right']]) {
      const root = doc.getElementById(id);
      if (root) for (const node of root.children) add(node, root, side);
    }
    for (const id of ['nonQRFormItems', 'send_form']) {
      const root = doc.getElementById(id);
      if (root) for (const node of root.children) add(node, root, '', true);
    }
    return result;
  }

  function collect(everything = false) {
    disabledCache = null;
    const wanted = new Set(AREA_IDS.filter(area => everything || areaInUse(area)));
    const next = Object.fromEntries(AREA_IDS.map(id => [id, []]));
    const add = (area, node, boundary, container, side = '') => {
      if (node.closest(OWN) && !OWN_EXEMPT.has(node.id)) return;
      const usable = available(node, boundary);
      // Message buttons are far too many to key up front, and they are never
      // the thing a user loses track of.
      if (!usable && area === 'messages') return;
      const info = labelInfo(node, area);
      let key = stableKey(node, area, boundary);
      if (area === 'extensions') {
        const owner = node.closest('.extension_container[id]');
        if (owner && owner.querySelector('.inline-drawer-header,.inline-drawer-toggle,summary') === info.titleRoot) key = `id:${owner.id}`;
      }
      if (!usable) {
        // Not on screen right now. Keep it listed only if the user configured
        // it, so a hidden item can always be found and switched back on.
        const saved = appliedSettings().areas[area];
        if (!saved.items[key] && !saved.order.includes(key)) return;
      }
      const existing = next[area].find(x => x.key === key);
      if (existing && area !== 'messages') {
        key += `:scope:${node.parentElement.id || node.parentElement.className}:${info.name}`;
        if (next[area].some(x => x.key === key)) return;
      }
      const icons = originalIcons(info.titleRoot);
      const icon = icons[0] || null;
      const state = dynamicInfo(node, info, area, key, icon);
      const entry = { node, container, side, ...info, icon, icons, state };
      const record = area === 'messages' ? next[area].find(x => x.key === key) : null;
      if (record) { record.entries.push(entry); record.state.dynamic ||= state.dynamic; record.state.busy ||= state.busy; return; }
      next[area].push({ key, area, name: info.name, originalIcon: icon && fontGlyph(icon), entries: [entry], side,
          protected: area === 'topbar' || (area === 'input' && ['options_button', 'extensionsMenuButton'].includes(node.id)) || (area === 'wand' && node.id === 'stt-open-wand'),
        state: { ...state }, weak: key.startsWith('label:') });
    };
    const wand = wanted.has('wand') ? doc.getElementById('extensionsMenu') : null;
    if (wand) {
      for (const child of wand.children) {
        // add() decides on availability: it keeps items the user configured so
        // a hidden one can still be found and switched back on.
        if (child.matches(OWN) && !OWN_EXEMPT.has(child.id)) continue;
        if (child.matches('.extension_container')) {
          for (const row of child.children) if (!row.matches('style,script,hr') && (row.textContent.trim() || row.title || originalIcon(row))) add('wand', row, wand, child);
        } else if (!child.matches('style,script,hr')) add('wand', child, wand, wand);
      }
    }
    const topbar = wanted.has('topbar') ? (doc.getElementById('top-settings-holder') || doc.getElementById('top-bar')) : null;
    if (topbar) {
      const iconCounts = new Map();
      const hasIcon = node => {
        let count = iconCounts.get(node);
        if (count === undefined) { count = originalIcons(topbarHandle(node)).length; iconCounts.set(node, count); }
        return count > 0;
      };
      let topbarItems = [...topbar.children];
      if (!topbarItems.some(hasIcon)) topbarItems = [...topbar.querySelectorAll(':scope > .drawer-toggle, :scope > .top-bar-button, :scope > .top-bar-button-container')];
      for (const child of topbarItems) {
        if (child.matches(OWN) || !available(child, topbar) || !hasIcon(child)) continue;
        add('topbar', child, topbar, topbar);
      }
    }
    const extensionRoots = wanted.has('extensions') ? extensionRootList() : [];
    const extensionPanel = extensionRoots.length ? extensionPanelRoot() : null;
    if (extensionPanel) {
      const seenExtensionNodes = new Set();
      for (const root of extensionRoots) {
        for (const header of root.querySelectorAll('.inline-drawer-header,.inline-drawer-toggle,summary')) {
          if (header.closest('.inline-drawer-content') || header.closest(OWN)) continue;
          let child = header.closest('.inline-drawer,details') || header.parentElement;
          while (child.parentElement && child.parentElement !== extensionPanel && !extensionRoots.includes(child.parentElement)) {
            const parent = child.parentElement;
            const headers = [...parent.querySelectorAll('.inline-drawer-header,.inline-drawer-toggle,summary')]
              .filter(h => !h.closest('.inline-drawer-content') && !h.closest(OWN));
            if (headers.length !== 1) break;
            child = parent;
          }
          if (!child || seenExtensionNodes.has(child)) continue;
          seenExtensionNodes.add(child); add('extensions', child, extensionPanel, extensionPanel);
        }
      }
    }
    if (wanted.has('input')) for (const { node, root, side } of inputButtonSources()) {
      add('input', node, root, root, side);
    }
    if (wanted.has('messages')) for (const root of messageButtonRows()) {
      for (const child of root.children) if (!child.matches('style,script')) add('messages', child, root, root);
    }
    records = next;
  }

  // An area nobody customised costs nothing: no collecting, no applying, and
  // no place in the change-detection snapshot. Only the settings panel needs
  // the full picture, so it asks for a complete scan explicitly.
  function areaInUse(area, settings = appliedSettings()) {
    if (area === 'input') {
      const { iconSize, buttonSize, gap, color } = settings.inputStyle;
      if (iconSize || buttonSize || color || gap !== null) return true;
    }
    const config = settings.areas[area];
    if (!config) return false;
    if (config.order.length) return true;
    return Object.values(config.items).some(item => item.hidden || item.icon || item.color || item.side
      || (NAMED_AREAS.has(area) && item.alias)
      || (area === 'extensions' && item.fontWeight === 'normal'));
  }

  function ordered(area, settings = appliedSettings()) {
    const order = settings.areas[area].order;
    const rank = new Map(order.map((key, i) => [key, i]));
    return [...records[area]].sort((a, b) => (rank.get(a.key) ?? 100000) - (rank.get(b.key) ?? 100000));
  }

  function suppressIcon(entry, icon) {
    if (icon.matches('svg')) { style(icon, 'display', 'none'); return; }
    if (icon === entry.node || icon === entry.titleRoot) attr(icon, 'data-stt-no-glyph', '');
    else style(icon, 'display', 'none');
  }

  function addCustomIcon(entry, face) {
    const span = element('span', { 'data-stt-owned': '', 'data-stt-added-icon': '', 'data-stt-glyph': '', 'aria-hidden': 'true' });
    const anchor = entry.icons.find(icon => icon !== entry.node && icon.parentNode);
    if (anchor) anchor.before(span); else entry.titleRoot.prepend(span);
    effects.push(() => span.remove());
    style(span, '--stt-glyph', JSON.stringify(face.glyph));
    style(span, '--stt-font', face.font);
    style(span, '--stt-weight', face.weight);
    return span;
  }

  function replaceGlyph(icon, face) {
    attr(icon, 'data-stt-no-glyph', '');
    attr(icon, 'data-stt-glyph', '');
    style(icon, '--stt-glyph', JSON.stringify(face.glyph));
    style(icon, '--stt-font', face.font);
    style(icon, '--stt-weight', face.weight);
    return icon;
  }

  // A global icon style also converts individually picked icons (icons without a counterpart stay
  // as picked). The saved choice itself is never rewritten.
  let phToFa = null;
  function styledIcon(value) {
    const source = panel && draft ? draft : saved;
    const mode = source?.disabled ? 'auto' : source?.iconStyle;
    if (!value || value === 'none' || mode === 'auto' || !mode) return value;
    const [prefix, name] = value.split(' ');
    if (mode === 'ph' && prefix !== 'ph') {
      const ph = faToPh().get(name);
      return ph && catalogs.ph?.has(ph) ? `ph ${ph}` : value;
    }
    if (mode === 'fa' && prefix === 'ph') {
      if (!phToFa) { phToFa = new Map(); for (const [fa, ph] of faToPh()) if (!phToFa.has(ph)) phToFa.set(ph, fa); }
      const fa = phToFa.get(name);
      const faPrefix = fa && (catalogs['fa-solid']?.has(fa) ? 'fa-solid' : catalogs['fa-brands']?.has(fa) ? 'fa-brands' : '');
      return faPrefix ? `${faPrefix} ${fa}` : value;
    }
    return value;
  }

  function iconOverride(entry, value) {
    if (!value) return null;
    value = styledIcon(value);
    const [prefix, name] = value.split(' ');
    const face = value === 'none' ? null : iconFace(prefix, name);
    if (value !== 'none' && !face) return null;
    if (value === 'none') { for (const icon of entry.icons) suppressIcon(entry, icon); return null; }
    const primary = entry.icon;
    if (primary && !primary.matches('svg')) {
      for (const icon of entry.icons) if (icon !== primary) suppressIcon(entry, icon);
      return replaceGlyph(primary, face);
    }
    for (const icon of entry.icons) suppressIcon(entry, icon);
    return addCustomIcon(entry, face);
  }

  function hideDecorations(entry) {
    const nodes = new Set(entry.titleRoot.querySelectorAll(DECORATIONS));
    const decorative = text => VERSION_TEXT.test(text) || TAG_TEXT.test(text);
    for (const leaf of entry.titleRoot.querySelectorAll('span,small,div')) {
      if (!decorative(leaf.textContent.trim())) continue;
      let node = leaf;
      while (node.parentElement !== entry.titleRoot && node.parentElement && decorative(node.parentElement.textContent.trim())) node = node.parentElement;
      nodes.add(node);
    }
    for (const node of nodes) {
      if (!node.closest(STATUS)) style(node, 'display', 'none');
    }
  }

  function colorOriginalIcon(entry, color) {
    for (const icon of entry.icons) {
      if (icon.matches('svg')) style(icon, 'color', color);
      else if (icon === entry.node || icon === entry.titleRoot) {
        attr(icon, 'data-stt-source-color', '');
        style(icon, '--stt-source-color', color);
      } else style(icon, 'color', color);
    }
  }

  function alignMenuIcon(entry, icon, removed, area = 'wand') {
    const row = entry.titleRoot;
    const size = rowFontSizes.get(row) ?? (parseFloat(host.getComputedStyle(row).fontSize) || 16);
    const inset = area === 'wand' ? '4px' : '10px';
    attr(row, 'data-stt-menu-row', '');
    style(row, '--stt-inset', inset);
    style(row, '--stt-slot', `${size * 1.4}px`);
    style(row, '--stt-gap', `${size * 0.6}px`);
    if (area === 'extensions' && (!icon || removed)) attr(row, 'data-stt-menu-no-icon', '');
    if (area === 'extensions') style(row, 'padding-inline-start', !icon || removed ? inset : `calc(${inset} + ${size * 2}px)`);
    style(row, 'text-indent', '0');
    for (const part of entry.parts) {
      for (let node = part.parentElement; node && node !== row; node = node.parentElement) attr(node, 'data-stt-menu-label', '');
    }
    if (!icon || removed) return;
    if (icon === row) attr(row, 'data-stt-menu-root-icon', '');
    else {
      attr(icon, 'data-stt-menu-icon', '');
      for (let parent = icon.parentElement; parent && parent !== row; parent = parent.parentElement) style(parent, 'position', 'static');
    }
  }

  function applyEntry(record, entry, config) {
    const { state } = entry;
    if (config.hidden && !record.protected) {
      // Attribute only: the stylesheet rule does the hiding. Writing inline
      // display here meant the owning extension's own jQuery .hide()/.toggle()
      // could replace our value, after which our undo refused to touch it and
      // the item stayed hidden with no way back.
      const hiddenTarget = record.area === 'extensions' ? extensionGridItem(entry) : entry.node;
      attr(hiddenTarget, 'data-stt-hidden', '');
    }
    const preserveLabel = config.preserveLabel !== false && state.changed.label && !state.split;
    const preserveIcon = record.area !== 'topbar' && config.preserveIcon !== false && (state.busy || (!state.busyDriven && state.changed.icon));
    const preserveColor = config.preserveColor !== false && (state.busy || (!state.busyDriven && state.changed.color));
    const color = record.area === 'input' ? (config.color || appliedSettings().inputStyle.color)
      : ['messages', 'topbar'].includes(record.area) ? (record.area === 'topbar' ? '' : config.color) : config.color;
    const hasAlias = NAMED_AREAS.has(record.area) && config.alias && !preserveLabel;
    const labelColor = color && !preserveColor && record.area !== 'messages' && config.colorTarget !== 'icon';
    if (hasAlias || labelColor) {
      for (const text of entry.parts) {
        const span = wrapText(text);
        if (!span) continue;
        if (labelColor) style(span, 'color', color);
        if (hasAlias && text === entry.namedPart) {
          attr(span, 'data-stt-alias', config.alias);
          replaceText(text, config.alias);
        }
      }
      if (hasAlias && !entry.parts.length) attr(entry.node, 'title', config.alias);
    }
    const replacement = !preserveIcon ? iconOverride(entry, config.icon) : null;
    if (record.area === 'extensions' && hasAlias && config.hideDecorations !== false) hideDecorations(entry);
    const visibleIcon = replacement || entry.titleRoot.querySelector('[data-stt-added-icon]') || entry.icon;
    if (color && !preserveColor && config.colorTarget !== 'label') {
      if (replacement) style(replacement, 'color', color);
      else if (!config.icon) colorOriginalIcon(entry, color);
    }
    if (hasAlias) attr(entry.node, 'aria-label', config.alias + (state.split ? ` ${entry.titleRoot.querySelector(STATUS)?.textContent || ''}` : ''));
    if (record.area === 'extensions') {
      const weight = config.fontWeight === 'normal' ? '400' : '700';
      style(entry.titleRoot, 'font-weight', weight);
      for (const part of entry.parts) {
        const parent = part.parentElement;
        if (parent) style(parent, 'font-weight', weight);
      }
    }
    if (NAMED_AREAS.has(record.area)) alignMenuIcon(entry, visibleIcon, config.icon === 'none', record.area);
    if (visibleIcon && !NAMED_AREAS.has(record.area) && config.icon && config.icon !== 'none') attr(visibleIcon, 'data-stt-button-glyph', '');
    if (record.area === 'input') {
      const { iconSize, buttonSize } = appliedSettings().inputStyle;
      if (iconSize) {
        style(entry.node, 'font-size', `${iconSize}px`);
        if (visibleIcon && visibleIcon !== entry.node) style(visibleIcon, 'font-size', `${iconSize}px`);
      }
      if (buttonSize) {
        for (const property of ['width', 'height', 'min-width', 'min-height']) style(entry.node, property, `${buttonSize}px`);
        // flex-shrink is owned by inputLayoutController, independently of size.
      }
    }
    if (record.area === 'messages') {
      attr(entry.node, 'data-stt-message-button', '');
    }
  }

  // Composer layout: persistent overrides, not part of the expensive global
  // rollback/reapply cycle. No input listener, observer, interval or resize
  // measurement is needed; flexbox handles textarea growth and viewport changes.
  function createInputLayoutController() {
    const overrides = new Map();
    const nativeOrder = new WeakMap();
    const orderMarkers = new Map();
    const syncOrderMarkers = nodes => {
      for (const [node, before] of orderMarkers) {
        if (nodes.has(node)) continue;
        if (node.getAttribute(INPUT_ORDER_ATTRIBUTE) === '') {
          if (before === null) node.removeAttribute(INPUT_ORDER_ATTRIBUTE);
          else node.setAttribute(INPUT_ORDER_ATTRIBUTE, before);
        }
        orderMarkers.delete(node);
      }
      for (const node of nodes) {
        if (!orderMarkers.has(node)) orderMarkers.set(node, node.getAttribute(INPUT_ORDER_ATTRIBUTE));
        if (node.getAttribute(INPUT_ORDER_ATTRIBUTE) !== '') node.setAttribute(INPUT_ORDER_ATTRIBUTE, '');
      }
    };
    let marker = null;
    let spacer = null;

    const restoreProperty = (node, property, saved) => {
      if (node.style.getPropertyValue(property) !== saved.applied || node.style.getPropertyPriority(property) !== 'important') return;
      if (saved.value) node.style.setProperty(property, saved.value, saved.priority);
      else node.style.removeProperty(property);
      if (!saved.hadStyle && !node.getAttribute('style')) node.removeAttribute('style');
    };
    const unmark = () => {
      if (!marker) return;
      const { node, before, applied } = marker;
      if (node.getAttribute('data-stt-input-layout') === applied) {
        if (before === null) node.removeAttribute('data-stt-input-layout');
        else node.setAttribute('data-stt-input-layout', before);
      }
      marker = null;
    };
    const ownMargins = new WeakMap();
    const clear = () => {
      unmark();
      syncOrderMarkers(new Set());
      for (const [node, properties] of overrides) for (const [property, saved] of properties) restoreProperty(node, property, saved);
      overrides.clear();
      spacer?.remove(); spacer = null;
    };
    const commit = desired => {
      // Release removed/replaced nodes so chat changes cannot retain old DOM.
      for (const [node, properties] of overrides) {
        const next = desired.get(node);
        for (const [property, saved] of properties) {
          if (next?.has(property)) continue;
          restoreProperty(node, property, saved);
          properties.delete(property);
        }
        if (!properties.size) overrides.delete(node);
      }
      for (const [node, properties] of desired) {
        let memory = overrides.get(node);
        if (!memory) { memory = new Map(); overrides.set(node, memory); }
        const hadStyle = node.hasAttribute('style');
        for (const [property, value] of properties) {
          const current = node.style.getPropertyValue(property);
          const priority = node.style.getPropertyPriority(property);
          let saved = memory.get(property);
          if (!saved) {
            saved = { value: current, priority, applied: null, hadStyle };
            memory.set(property, saved);
          } else if (current !== saved.applied || priority !== 'important') {
            // Remember an external inline edit before reasserting our layout.
            // Disposal then restores that edit rather than an obsolete value.
            saved.value = current; saved.priority = priority;
          }
          // CSSOM normalizes e.g. 0 to 0px; compare the last requested value
          // too, otherwise an unchanged refresh would still write attributes.
          if (saved.requested !== value || current !== saved.applied || priority !== 'important') {
            node.style.setProperty(property, value, 'important');
          }
          saved.requested = value;
          saved.applied = node.style.getPropertyValue(property);
        }
      }
    };

    function sync(settings, list) {
      const form = doc.getElementById('send_form');
      const common = doc.getElementById('nonQRFormItems');
      const left = doc.getElementById('leftSendForm');
      const right = doc.getElementById('rightSendForm');
      const textarea = doc.getElementById('send_textarea');
      // Do not guess at an extension's unrelated/custom composer structure.
      if (!form || !common || !left || !right || !textarea || !form.contains(common)
        || left.parentElement !== common || right.parentElement !== common || textarea.parentElement !== common) { clear(); return; }

      layoutMobileState = mobileLayout();
      const config = (layoutMobileState && settings.inputLayoutMobile) || settings.inputLayout;
      const theme = config.rows === 'theme';
      const double = config.rows === 'double';
      const mode = theme ? 'theme' : double ? `double-${config.position}` : 'single';
      const buttonConfig = settings.areas.input;
      const ranked = new Map(buttonConfig.order.map((key, index) => [key, index]));
      const known = new Map();
      for (const record of list) for (const entry of record.entries) known.set(entry.node, record.key);
      const buttons = [];
      for (const { node, root, side } of inputButtonSources()) {
        // A control outside this row can be edited, but do not reparent it or
        // force another extension's separate form section into this flex row.
        if (!common.contains(node)) continue;
        const key = known.get(node) || stableKey(node, 'input', root);
        if (!nativeOrder.has(node)) nativeOrder.set(node, Number.parseInt(host.getComputedStyle(node).order, 10) || 0);
        buttons.push({ node, key, root, native: side, side: buttonConfig.items[key]?.side || side, index: buttons.length });
      }
      const customOrder = buttonConfig.order.length > 0 || buttons.some(item => buttonConfig.items[item.key]?.side);
      buttons.sort((a, b) => customOrder
        ? (ranked.get(a.key) ?? 100000) - (ranked.get(b.key) ?? 100000) || a.index - b.index
        : nativeOrder.get(a.node) - nativeOrder.get(b.node) || a.index - b.index);

      const desired = new Map();
      const set = (node, values) => {
        let properties = desired.get(node);
        if (!properties) { properties = new Map(); desired.set(node, properties); }
        for (const [property, value] of Object.entries(values)) {
          // Use longhands so restoring a shorthand cannot erase a pre-existing
          // inline margin-left/top/etc. This controller uses uniform values.
          const names = property === 'inset' ? ['top', 'right', 'bottom', 'left']
            : property === 'margin' || property === 'padding' ? ['top', 'right', 'bottom', 'left'].map(side => `${property}-${side}`)
              : property === 'overflow' ? ['overflow-x', 'overflow-y'] : [property];
          for (const name of names) properties.set(name, value);
        }
      };
      // Icon gap: empty keeps the theme's left/right group gap (also after ungrouping); a number
      // overrides it.
      const gapSetting = settings.inputStyle.gap;
      const px = value => Number.parseFloat(value) || 0;
      const captured = (node, key, read) => {
        let memory = ownMargins.get(node);
        if (!memory) { memory = {}; ownMargins.set(node, memory); }
        if (!overrides.get(node)?.has(key)) memory[key] = read();
        return memory[key] ?? read();
      };
      const sideGap = root => gapSetting ?? px(captured(root, 'column-gap', () => host.getComputedStyle(root).columnGap));
      // Capture the originals before overriding, so switching settings back and forth always
      // returns to the theme's first values.
      for (const node of [left, right, common]) captured(node, 'column-gap', () => host.getComputedStyle(node).columnGap);
      for (const node of [textarea, ...buttons.map(item => item.node)]) {
        const cs = host.getComputedStyle(node);
        for (const key of ['margin-top', 'margin-bottom', 'margin-left', 'margin-right']) captured(node, key, () => px(cs.getPropertyValue(key)));
      }
      const spaceButtons = (useOwn) => {
        for (const { node, side } of buttons) {
          const half = sideGap(side === 'right' ? right : left) / 2;
          const own = useOwn ? [captured(node, 'margin-left', () => px(host.getComputedStyle(node).marginLeft)), captured(node, 'margin-right', () => px(host.getComputedStyle(node).marginRight))] : [0, 0];
          set(node, { 'margin-left': `${own[0] + half}px`, 'margin-right': `${own[1] + half}px` });
        }
      };
      if (theme && !customOrder) {
        if (gapSetting === null) { clear(); return; }
        for (const root of [left, right]) set(root, { 'column-gap': `${gapSetting}px` });
        for (const { node } of buttons) set(node, { 'margin-left': '0px', 'margin-right': '0px' });
        commit(desired);
        return;
      }
      if (!marker || marker.node !== common) {
        unmark();
        marker = { node: common, before: common.getAttribute('data-stt-input-layout'), applied: mode };
      }
      marker.applied = mode;
      if (common.getAttribute('data-stt-input-layout') !== mode) common.setAttribute('data-stt-input-layout', mode);
      if (theme) { spacer?.remove(); spacer = null; }
      else if (!spacer || spacer.parentElement !== common) {
        spacer?.remove();
        spacer = element('span', { id: 'stt-input-spacer', 'data-stt-owned': '', 'aria-hidden': 'true' });
        common.append(spacer);
      }

      // 'theme' mode: leave the row/box shape alone and only reorder buttons. Ungroup left/right
      // into one row only when some button was moved to the other side.
      if (theme) {
        const moved = buttons.some(item => item.side !== item.native);
        const managed = moved ? buttons : buttons.filter(item => item.root === left || item.root === right);
        if (moved) {
          for (const root of [left, right]) set(root, { display: 'contents' });
          set(textarea, { order: '10000' });
          // Ungrouping applies the theme's group alignment (e.g. bottom-aligned group, centered inside)
          // to each button separately, so buttons of different heights misalign. Recreate each
          // button's position inside its original group box with margins (moved buttons use the
          // destination side's box).
          const commonAlign = host.getComputedStyle(common).alignItems;
          const sideBox = root => {
            const cs = host.getComputedStyle(root);
            const heights = buttons.filter(item => item.root === root).map(item => item.node.getBoundingClientRect().height).filter(Boolean);
            const align = cs.alignSelf === 'auto' || cs.alignSelf === 'normal' ? commonAlign : cs.alignSelf;
            const own = [cs.minHeight, cs.height].map(value => /px$/.test(value) ? px(value) : 0);   // theme may fix the group height
            return { align, inner: cs.alignItems, height: Math.max(0, ...own, ...heights), top: px(cs.marginTop) + px(cs.paddingTop), bottom: px(cs.marginBottom) + px(cs.paddingBottom) };
          };
          const boxes = { left: sideBox(left), right: sideBox(right) };
          for (const { node, side } of buttons) {
            const h = node.getBoundingClientRect().height;
            if (!h) continue;
            const ownTop = captured(node, 'margin-top', () => px(host.getComputedStyle(node).marginTop));
            const ownBottom = captured(node, 'margin-bottom', () => px(host.getComputedStyle(node).marginBottom));
            const box = boxes[side] || boxes.left;
            const extra = Math.max(0, box.height - h - ownTop - ownBottom);
            const end = /end/.test(box.inner), start = /start/.test(box.inner) || box.inner === 'normal' || box.inner === 'stretch';
            const top = box.top + ownTop + (end ? extra : start ? 0 : extra / 2);
            const bottom = box.bottom + ownBottom + (end ? 0 : start ? extra : extra / 2);
            set(node, { 'align-self': box.align, 'margin-top': `${Math.round(top * 10) / 10}px`, 'margin-bottom': `${Math.round(bottom * 10) / 10}px` });
          }
          // Horizontal: group gap between buttons; keep the original distance to the textarea
          // (row gap + group padding).
          const rowGap = px(captured(common, 'column-gap', () => host.getComputedStyle(common).columnGap));
          set(common, { 'column-gap': '0px' });
          spaceButtons(gapSetting === null);
          const lcs = host.getComputedStyle(left), rcs = host.getComputedStyle(right);
          const taLeft = captured(textarea, 'margin-left', () => px(host.getComputedStyle(textarea).marginLeft));
          const taRight = captured(textarea, 'margin-right', () => px(host.getComputedStyle(textarea).marginRight));
          set(textarea, {
            'margin-left': `${Math.max(0, taLeft + rowGap + px(lcs.paddingRight) - sideGap(left) / 2)}px`,
            'margin-right': `${Math.max(0, taRight + rowGap + px(rcs.paddingLeft) - sideGap(right) / 2)}px`,
          });
        } else if (gapSetting !== null) {
          for (const root of [left, right]) set(root, { 'column-gap': `${gapSetting}px` });
          for (const { node } of buttons) set(node, { 'margin-left': '0px', 'margin-right': '0px' });
        }
        syncOrderMarkers(new Set(managed.map(item => item.node)));
        managed.forEach((item, index) => set(item.node, { '--stt-input-order': String((item.side === 'left' ? 10 : 20000) + index) }));
        for (const { node } of managed) if (node.style.getPropertyPriority('order') === 'important') set(node, { order: 'var(--stt-input-order)' });
        commit(desired);
        return;
      }
      // Inline !important wins over theme CSS, including responsive rules.
      // Only geometry is owned: colors, borders, fonts and textarea height stay.
      set(form, {
        display: 'flex', 'flex-direction': 'row', 'flex-wrap': 'wrap',
        'align-items': 'center', height: 'auto', 'block-size': 'auto',
        'min-height': '0', 'min-block-size': '0', 'max-height': 'none', 'max-block-size': 'none', overflow: 'visible',
      });
      set(common, {
        display: 'flex', 'flex-direction': 'row', 'flex-wrap': double ? 'wrap' : 'nowrap',
        'align-items': 'center', 'align-content': 'flex-start', 'justify-content': 'flex-start',
        'column-gap': '0px', 'row-gap': double ? '6px' : '0px',
        'flex-grow': '0', 'flex-shrink': '0', 'flex-basis': '100%', order: '25',
        width: '100%', 'inline-size': '100%', 'min-width': '0', 'min-inline-size': '0', 'max-width': '100%', 'max-inline-size': '100%',
        height: 'auto', 'block-size': 'auto', 'min-height': '0', 'min-block-size': '0', 'max-height': 'none', 'max-block-size': 'none',
        'box-sizing': 'border-box', margin: '0', padding: '0', overflow: 'visible',
        position: 'relative', inset: 'auto', float: 'none', transform: 'none', translate: 'none', rotate: 'none', scale: 'none',
      });
      for (const root of [left, right]) set(root, { display: 'contents', position: 'static' });
      set(textarea, {
        display: 'block', order: double ? (config.position === 'top' ? '-10000' : '30000') : '10000',
        'flex-grow': double ? '0' : '1', 'flex-shrink': double ? '0' : '1', 'flex-basis': double ? '100%' : '0px',
        width: double ? '100%' : '0px', 'inline-size': double ? '100%' : '0px',
        'min-width': '0', 'min-inline-size': '0', 'max-width': '100%', 'max-inline-size': '100%',
        'box-sizing': 'border-box', 'align-self': 'center', margin: '0',
        position: 'relative', inset: 'auto', float: 'none', transform: 'none', translate: 'none', rotate: 'none', scale: 'none',
      });
      // Hidden in one-row mode; consumes the free space between left/right
      // buttons in two-row mode. Never move or clone the real controls/input.
      set(spacer, {
        display: double ? 'block' : 'none', order: '10000',
        'flex-grow': '1', 'flex-shrink': '1', 'flex-basis': '0px',
        width: '0px', 'min-width': '0px', 'max-width': 'none', height: '0px', 'min-height': '0px',
        margin: '0px', padding: '0px', border: '0px', position: 'static',
        'pointer-events': 'none', transform: 'none',
      });
      syncOrderMarkers(new Set(buttons.map(item => item.node)));
      buttons.forEach((item, index) => set(item.node, {
        '--stt-input-order': String((item.side === 'left' ? 10 : 20000) + index),
        'flex-grow': '0', 'flex-shrink': '0', 'flex-basis': 'auto',
        'align-self': 'center', margin: '0', position: 'relative', inset: 'auto',
        float: 'none', transform: 'none', translate: 'none', rotate: 'none', scale: 'none',
        // Do not set display/visibility/opacity: ST owns send/stop/pause state.
      }));
      spaceButtons(false);
      if (!double) set(textarea, { 'margin-left': `${Math.max(0, 5 - sideGap(left) / 2)}px`, 'margin-right': `${Math.max(0, 5 - sideGap(right) / 2)}px` });
      // A theme may already have an inline !important order. Bind that case
      // to our variable, without writing ordinary provider-owned order values.
      // If the provider later replaces it with a normal inline order, the
      // stylesheet above still wins; no counter-write or observer is needed.
      for (const { node } of buttons) {
        if (node.style.getPropertyPriority('order') === 'important') {
          set(node, { order: 'var(--stt-input-order)' });
        }
      }
      commit(desired);
    }
    return { sync, dispose: clear };
  }

  const inputLayoutController = createInputLayoutController();

  function applyOrder(area) {
    const settings = appliedSettings();
    const list = ordered(area);
    if (area === 'input') return; // Handled together with composer row placement.
    if (!settings.areas[area].order.length) return;
    if (area === 'wand') {
      const root = doc.getElementById('extensionsMenu');
      if (!root) return;
      attr(root, 'data-stt-ordered-menu', '');
      for (const container of new Set(list.flatMap(r => r.entries.map(e => e.container)))) if (container !== root) style(container, 'display', 'contents');
      list.forEach((r, i) => r.entries.forEach(e => style(e.node, 'order', String(i + 10))));
    } else if (area === 'extensions') {
      const roots = extensionRootList();
      const common = extensionBoundary(roots);
      if (!common || common === doc.body || common === doc.documentElement || !roots.every(root => common.contains(root))) return;
      const gap = extensionGap ?? Math.max(0, Math.ceil(parseFloat(host.getComputedStyle(common).rowGap) || 0));
      attr(common, 'data-stt-extension-layout', '');
      for (const [property, value] of Object.entries({ display: 'grid', 'grid-template-rows': 'none', 'grid-auto-rows': '1px', 'row-gap': '0', 'align-items': 'start', 'align-content': 'start' })) style(common, property, value);
      const paths = new Set(roots);
      for (const record of list) for (const entry of record.entries) {
        if (!common.contains(entry.node)) continue;
        const gridItem = extensionGridItem(entry, common);
        for (let node = gridItem.parentElement; node && node !== common; node = node.parentElement) paths.add(node);
      }
      for (const root of roots) for (const node of root.querySelectorAll('.extension_container:empty')) style(node, 'display', 'none');
      for (const node of paths) {
        attr(node, 'data-stt-extension-path', '');
        style(node, 'display', 'contents');
        style(node, 'padding', '0');
        style(node, 'margin', '0');
        style(node, 'border', '0');
        style(node, 'background', 'transparent');
      }
      let passedRows = false;
      for (const child of common.children) {
        if (paths.has(child) || list.some(r => r.entries.some(e => e.node === child))) { passedRows = true; continue; }
        style(child, 'grid-column', '1 / -1');
        style(child, 'order', passedRows ? '100000' : '-1');
      }
      list.forEach((r, i) => r.entries.forEach(e => {
        attr(extensionGridItem(e, common), 'data-stt-extension-item', '');
        style(e.titleRoot, 'order', String(i + 10));
        style(e.node, 'order', String(i + 10));
        style(extensionGridItem(e, common), 'order', String(i + 10));
      }));
      const items = [...new Set(list.flatMap(record => record.entries.map(entry => extensionGridItem(entry, common))))];
      extensionLayout = layoutExtensionColumns(common, items, paths, gap);
    } else if (area === 'messages') list.forEach((r, i) => r.entries.forEach(e => style(e.node, 'order', String(i + 1))));
  }

  // A layout read after a write forces a full style recalc (tens of ms with a large theme),
  // so everything needed is read up front, before any write.
  let rowFontSizes = new Map();
  let extensionGap = null;
  function measureBeforeApply(settings) {
    rowFontSizes = new Map();
    extensionGap = null;
    const icons = [];
    for (const area of AREA_IDS) {
      if (!areaInUse(area, settings)) continue;
      for (const record of records[area]) {
        const icon = settings.areas[area].items[record.key]?.icon;
        if (icon && icon !== 'none') icons.push(icon);
      }
    }
    resolveFaces(icons);
    for (const area of ['wand', 'extensions']) {
      if (!areaInUse(area, settings)) continue;
      for (const record of records[area]) for (const entry of record.entries) {
        const row = entry.titleRoot;
        if (row && !rowFontSizes.has(row)) rowFontSizes.set(row, parseFloat(host.getComputedStyle(row).fontSize) || 16);
      }
    }
    if (areaInUse('extensions', settings) && settings.areas.extensions.order.length) {
      const common = extensionBoundary(extensionRootList());
      if (common && common !== doc.body && common !== doc.documentElement) extensionGap = Math.max(0, Math.ceil(parseFloat(host.getComputedStyle(common).rowGap) || 0));
    }
  }

  function applyAll() {
    const settings = appliedSettings();
    measureBeforeApply(settings);
    for (const area of AREA_IDS) {
      // The panel collects every area so it can list them, but an untouched
      // area must still leave the page exactly as ST rendered it.
      if (!areaInUse(area, settings)) continue;
      for (const record of records[area]) {
        const config = appliedSettings().areas[area].items[record.key] || {};
        for (const entry of record.entries) applyEntry(record, entry, config);
      }
      applyOrder(area);
    }
    inputLayoutController.sync(settings, ordered('input', settings));
  }

  // Full comparison runs only after a DOM change; things that can change without one
  // (e.g. buttons hidden by theme CSS) are rechecked every few ticks.
  const POLL_BACKSTOP_TICKS = 5;
  function enablePolling() {
    if (pollingTimer || dead) return;
    if (!pollWatcher && host.MutationObserver && doc.body) {
      // A newly added message gets an immediate check (some render without any event).
      pollWatcher = new host.MutationObserver(records => {
        // Ignore message text changes (streaming): otherwise every tick during generation ran a full comparison.
        if (records.every(record => {
          const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
          return !!target?.closest?.('.mes_text, .mes_reasoning');
        })) return;
        pollDirty = true;
        homeController.ensure();   // Cheap: looks up the home panel only
        topbarFold.check();
        if (pollSoon || panel) return;
        for (const record of records) for (const node of record.addedNodes) {
          if (node.nodeType === 1 && (node.matches('.mes, .mes_buttons') || node.querySelector?.('.mes_buttons'))) {
            pollSoon = host.setTimeout(() => { pollSoon = null; pollTick(); }, 60);
            return;
          }
        }
      });
      pollWatcher.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'id', 'data-i18n', 'title', 'disabled', 'src', 'data-icon', 'data-state', 'data-status', 'aria-hidden', 'aria-busy'] });
    }
    pollingTimer = host.setInterval(pollTick, 650);
  }
  function pollTick() {
    if (doc.hidden || dead) return;
    if (!panel) inputTextController.sync(appliedSettings().inputText);
    if (layoutMobileState !== null && mobileLayout() !== layoutMobileState && !panel) { refresh(false); return; }
    beginPass();
    if (panel) { qrController.sync(appliedSettings().qr); return; }
    if (pollWatcher && !pollDirty && ++pollQuiet < POLL_BACKSTOP_TICKS) return;
    pollDirty = false; pollQuiet = 0;
    qrController.sync(appliedSettings().qr);
    const snapshot = snapshotSources();
    if (sameSnapshot(snapshot, sourceSnapshot)) { if (wandDrifted()) refresh(false); return; }
    if (snapshot.rest === sourceSnapshot.rest && applyMessageDelta()) sourceSnapshot = snapshot;
    else refresh(false);
  }

  const STATE_CLASSES = /(?:^|\s)(?:fa-(?:circle-)?chevron-(?:up|down)|openDrawer|closedDrawer|openIcon|closedIcon|up|down|open|closed)(?=\s|$)/g;
  const stableClass = node => classOf(node).replace(STATE_CLASSES, ' ').replace(/\s+/g, ' ').trim();

  function snapshotSources() {
    const id = node => { if (!nodeIds.has(node)) nodeIds.set(node, nextNodeId++); return nodeIds.get(node); };
    const rest = [JSON.stringify(disabledExtensions())];
    const composer = doc.getElementById('nonQRFormItems');
    rest.push('input-layout', ...['send_form', 'nonQRFormItems', 'send_textarea', 'stt-input-spacer']
      .map(name => { const node = doc.getElementById(name); return node ? String(id(node)) : ''; }),
      composer?.getAttribute('data-stt-input-layout') || '', String(doc.getElementById('stt-input-spacer')?.parentElement === composer));
    // The wand menu is captured structurally rather than as markup: opening it
    // only flips the menu's own inline display/classes, and treating that as a
    // change tore the whole customisation down and rebuilt it mid-animation.
    const wandMenu = areaInUse('wand') ? doc.getElementById('extensionsMenu') : null;
    if (wandMenu) {
      rest.push('wand', String(id(wandMenu)));
      for (const node of wandMenu.querySelectorAll('*')) {
        rest.push(String(id(node)), node.tagName, node.id || '', stableClass(node), node.getAttribute('data-i18n') || '', node.style.display || '', node.hidden ? '1' : '');
      }
      rest.push(wandMenu.textContent.replace(/\s+/g, ' ').trim().slice(0, 1000));
    }
    // Structural only, like the wand menu: opening a drawer swaps openIcon /
    // closedIcon and must not cost a rebuild, but a top bar that finishes
    // rendering late has to be noticed by the poll.
    const topbarRoot = areaInUse('topbar') ? (doc.getElementById('top-settings-holder') || doc.getElementById('top-bar')) : null;
    if (topbarRoot) {
      rest.push('topbar', String(id(topbarRoot)), String(topbarRoot.childElementCount));
      for (const child of topbarRoot.children) {
        rest.push(String(id(child)), child.id || '', stableClass(child), child.hidden ? '1' : '');
        const handle = topbarHandle(child);
        for (const node of [handle, ...handle.querySelectorAll('i,span,div,svg')]) {
          if (node.hasAttribute('data-stt-owned')) continue;
          rest.push(String(id(node)), node.tagName, stableClass(node));
        }
      }
    }
    // One shallow input snapshot, for wrapped and directly docked controls.
    // Serializing whole wrappers included badge counters and the provider's
    // own order. That triggered rollback/reapply, which in turn made the
    // provider remount and reset order again (the 1.1.1 left/right loop).
    for (const root of [doc.getElementById('leftSendForm'), doc.getElementById('rightSendForm')]) {
      if (!root) continue;
      rest.push('input-group', String(id(root)), stableClass(root), root.style.cssText,
        root.hidden ? '1' : '', root.getAttribute('aria-hidden') || '');
    }
    for (const { node, root } of inputButtonSources()) {
      rest.push('input-button', String(id(root)), String(id(node)), node.tagName, node.id || '',
        stableClass(node), inputSourceStyle(node), node.hidden ? '1' : '',
        node.getAttribute('title') || '', node.getAttribute('data-state') || '', node.getAttribute('data-status') || '',
        node.getAttribute('aria-hidden') || '', node.getAttribute('aria-busy') || '', node.hasAttribute('disabled') ? '1' : '');
      for (const icon of node.querySelectorAll(INPUT_SOURCE_ICONS)) {
        if (icon.closest(OWN)) continue;
        rest.push(String(id(icon)), icon.tagName, stableClass(icon), icon.style.cssText,
          icon.getAttribute('data-icon') || '', (icon.getAttribute('src') || '').replace(/[?&]t=\d+/g, ''));
      }
    }
    const panelRoot = areaInUse('extensions') ? extensionPanelRoot() : null;
    if (panelRoot) {
      const visited = new Set();
      for (const header of panelRoot.querySelectorAll('.inline-drawer-header,.inline-drawer-toggle,summary')) {
        if (header.closest('.inline-drawer-content') || header.closest(OWN)) continue;
        rest.push(String(id(header)), header.textContent.replace(/\s+/g, ' ').trim().slice(0, 200));
        for (const node of header.querySelectorAll('*')) rest.push(String(id(node)), node.tagName, stableClass(node));
        for (let node = header.parentElement; node && node !== panelRoot; node = node.parentElement) {
          if (visited.has(node)) break;
          visited.add(node);
          rest.push(String(id(node)), node.id || '', stableClass(node), node.hidden ? '1' : '', node.style.display || '');
        }
      }
    }
    const rows = areaInUse('messages') ? [...messageButtonRows()] : [];
    const digests = new WeakMap();
    const chat = [String(rows.length)];
    for (const row of rows) {
      const children = row.children;
      let digest = `${id(row)}:${children.length}`;
      for (let i = 0; i < children.length; i++) digest += '\u0000' + classOf(children[i]);
      digests.set(row, digest);
      chat.push(digest);
    }
    scanDigests = digests;
    scanRoots = rows;
    return { chat: chat.join('\n'), rest: rest.join('\n') };
  }

  function applyMessageDelta() {
    const settings = appliedSettings();
    const list = ordered('messages', settings);
    if (!list.length) return false;
    const targets = new Map(list.map((record, index) => [record.key, { record, order: index + 1 }]));
    const ordering = settings.areas.messages.order.length > 0;
    const pending = [];
    for (const root of scanRoots) {
      const applied = messageDigests.get(root);
      if (applied !== undefined && applied === scanDigests.get(root)) continue;
      const items = [];
      for (const child of root.children) {
        if (child.matches('style,script') || child.hasAttribute('data-stt-message-button')) continue;
        if ((child.closest(OWN) && child.id !== 'stt-open-wand') || !available(child, root)) continue;
        const target = targets.get(stableKey(child, 'messages', root));
        if (!target) return false;
        // Read everything now, before any row is written: each read after a write is a forced style recalc.
        const info = labelInfo(child, 'messages');
        const icons = originalIcons(info.titleRoot);
        items.push({ child, target, info, icons });
      }
      pending.push({ root, items });
    }
    for (const { root, items } of pending) {
      for (const { child, target, info, icons } of items) {
        const icon = icons[0] || null;
        const state = dynamicInfo(child, info, 'messages', target.record.key, icon);
        const entry = { node: child, container: root, side: '', ...info, icon, icons, state };
        target.record.entries.push(entry);
        target.record.state.dynamic ||= state.dynamic;
        target.record.state.busy ||= state.busy;
        applyEntry(target.record, entry, settings.areas.messages.items[target.record.key] || {});
        if (ordering) style(child, 'order', String(target.order));
      }
      messageDigests.set(root, scanDigests.get(root));
    }
    return true;
  }

  // Some message buttons come in mutually exclusive pairs (exclude / include a
  // message, for example): ST flips which one is display:none, but our own
  // layout rule is !important and keeps the outgoing one on screen until the
  // next full pass, so both glyphs show side by side for a moment. Drop our
  // marker, let ST's own rule decide again, then apply whatever became visible.
  function revalidateMessageRow(root) {
    if (dead || !ready || refreshing || !root.isConnected) return;
    if (panel) { schedule(); return; }
    const marked = [];
    for (const child of root.children) if (child.hasAttribute('data-stt-message-button')) { marked.push(child); child.removeAttribute('data-stt-message-button'); }
    let changed = false;
    for (const child of marked) {
      if (host.getComputedStyle(child).display === 'none') changed = true;
      else child.setAttribute('data-stt-message-button', '');
    }
    if (!changed) for (const child of root.children) {
      if (child.hasAttribute('data-stt-message-button') || child.matches('style,script')) continue;
      if (child.closest(OWN) && child.id !== 'stt-open-wand') continue;
      if (host.getComputedStyle(child).display !== 'none') { changed = true; break; }
    }
    if (!changed) return;
    messageDigests.delete(root);
    beginPass();
    let snapshot;
    try { snapshot = snapshotSources(); } catch { schedule(); return; }
    if (snapshot.rest !== sourceSnapshot.rest) { schedule(); return; }
    let handled = false;
    try { handled = applyMessageDelta(); }
    catch (error) { console.warn('[ST Tailor] Message row update failed', error); handled = false; }
    if (handled) sourceSnapshot = snapshot; else schedule();
  }

  function onMessageButtonClick(event) {
    if (!areaInUse('messages')) return;
    const row = event.target?.closest?.('.extraMesButtons');
    if (!row) return;
    for (const timer of rowTimers) host.clearTimeout(timer);
    rowTimers = [60, 320].map(delay => host.setTimeout(() => revalidateMessageRow(row), delay));
  }

  // Change detection watches ST's DOM, never our own markers, so it cannot see
  // that the wand lost its customisation while ST's markup stayed put. Every
  // applied wand row carries data-stt-menu-row, which makes drift cheap to spot.
  function wandDrifted() {
    if (!areaInUse('wand')) return false;
    const menu = doc.getElementById('extensionsMenu');
    if (!menu) return false;
    const settings = appliedSettings();
    if (records.wand.length) {
      if (settings.areas.wand.order.length && !menu.hasAttribute('data-stt-ordered-menu')) return true;
      for (const record of records.wand) for (const entry of record.entries) {
        if (!entry.node.isConnected || !entry.titleRoot.hasAttribute('data-stt-menu-row')) return true;
      }
    }
    // An entry the user customised that is on screen now but was never
    // collected: it was not visible during the last scan (a slow phone opens
    // the menu long after boot), and the menu opening is deliberately not
    // treated as a change, so nothing else would ever notice it.
    const wanted = new Set([...settings.areas.wand.order, ...Object.keys(settings.areas.wand.items)]);
    if (!wanted.size) return false;
    const known = new Set();
    for (const record of records.wand) for (const entry of record.entries) known.add(entry.node);
    const missing = node => node.id && wanted.has(`id:${node.id}`) && !known.has(node)
      && !node.matches('style,script,hr') && available(node, menu);
    for (const child of menu.children) {
      if (child.matches('.extension_container')) {
        for (const row of child.children) if (missing(row)) return true;
        continue;
      }
      if (missing(child)) return true;
    }
    return false;
  }

  function refreshMessages(retry = 0) {
    if (dead || !ready) return;
    host.clearTimeout(messageTimer); messageTimer = null;
    if (panel || refreshing || refreshTimer) { schedule(); return; }
    beginPass();
    let snapshot;
    try { snapshot = snapshotSources(); } catch { schedule(); return; }
    if (sameSnapshot(snapshot, sourceSnapshot)) {
      if (retry < 2) messageTimer = host.setTimeout(() => { messageTimer = null; refreshMessages(retry + 1); }, 150);
      return;
    }
    if (snapshot.rest !== sourceSnapshot.rest) { schedule(); return; }
    let handled = false;
    try { handled = applyMessageDelta(); }
    catch (error) { console.warn('[ST Tailor] Incremental message update failed', error); handled = false; }
    if (handled) sourceSnapshot = snapshot; else schedule();
  }

  function refresh(render = true, everything = false) {
    if (dead || !ready || refreshing) return;
    refreshing = true;
    beginPass();
    host.clearTimeout(messageTimer); messageTimer = null;
    wandObserver?.disconnect();
    try {
      // The wand menu may not have existed when start() ran, and ST can replace
      // it outright; re-assert our entry instead of losing it for the session.
      installEntryPoints();
      rollback();
      // Sync the QR bar first: in toggle mode it creates the toggle button, and
      // collect() has to see it to treat it as a placeable input button.
      qrController.sync(appliedSettings().qr);
      collect(everything || !!panel);
      applyIconStyle(liveSettings().iconStyle);
      const live = liveSettings();
      fontController.sync(live.fonts);
      homeController.sync(live.home, live.fonts);
      topbarFold.sync(live.topbarFold);
      inputTextController.sync(live.inputText);
      const signature = faceSignatureNow();
      if (signature !== faceSignature) { faces.clear(); faceSignature = signature; }
      iconThemeKey();   // Baseline for the theme-change check on settings-saved events
      applyAll();
      if (panel && render) {
        const fingerprint = JSON.stringify(AREA_IDS.map(a => records[a].map(r => [r.key, r.name, r.state])));
        if (fingerprint !== previousFingerprint) renderList(!records[selectedArea]?.some(r => r.key === selectedKey));
        previousFingerprint = fingerprint;
      } else previousFingerprint = '';
      sourceSnapshot = snapshotSources();
      messageDigests = scanDigests;
    } catch (error) {
      console.error('[ST Tailor] Refresh failed', error);
      report('일부 항목을 적용하지 못했습니다. 목록 새로고침을 눌러 주세요.', true);
      // rollback() already stripped everything. The snapshot only tracks ST's
      // own DOM, so leaving it as-is would read as "nothing changed" and the
      // poll would never retry. Force the next tick to try again.
      sourceSnapshot = { chat: '', rest: '' };
    }
    finally {
      refreshing = false;
      const wand = doc.getElementById('extensionsMenu');
      if (wand) wandObserver?.observe(wand, { childList: true, subtree: true, attributes: true, characterData: true });
      enablePolling();
    }
  }

  function schedule() {
    if (dead || refreshTimer) return;
    refreshTimer = host.setTimeout(() => { refreshTimer = null; refresh(); }, 120);
  }

  let returnFocus = null;
  function button(label, action, attrs = {}) {
    const node = element('button', { type: 'button', ...attrs }, label);
    node.addEventListener('click', action);
    return node;
  }

  function actionButton(label, icon, action, extraClass = '') {
    const control = button('', action, { class: `stt-action ${extraClass}`.trim(), 'aria-label': label, title: label });
    control.append(element('span', { class: 'stt-action-icon', 'aria-hidden': 'true' }, icon), element('span', { class: 'stt-action-text' }, label));
    return control;
  }

  // tip() hints stay behind an (i) toggle that also opens by touch/keyboard; plain-string hints are always shown.
  const tip = text => ({ tip: text });
  // ⓘ opens a speech bubble on click/tap/Enter (never hover-only); one bubble at a time.
  // The bubble lives on the panel itself, so it is not clipped by scrolling cards.
  function infoToggle(label, text) {
    const toggle = button('', event => {
      event.preventDefault(); event.stopPropagation();
      const open = toggle.getAttribute('aria-expanded') === 'true';
      closeTips();
      if (!open) openTip(toggle, text);
    }, { class: 'stt-info', 'aria-label': `${label} 설명`, 'aria-expanded': 'false' });
    toggle.append(iconPreview('fa-solid fa-circle-info'));
    return toggle;
  }
  function closeTips() {
    if (!panel) return;
    for (const pop of panel.querySelectorAll('.stt-tip-pop')) pop.remove();
    for (const trigger of panel.querySelectorAll('.stt-info[aria-expanded="true"]')) { trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-describedby'); }
  }
  function placeTip(pop, trigger) {
    const box = panel.getBoundingClientRect(), at = trigger.getBoundingClientRect();
    const margin = 12, gap = 8;
    const width = pop.offsetWidth, height = pop.offsetHeight;
    const center = at.left + at.width / 2 - box.left;
    const left = Math.max(margin, Math.min(center - 22, box.width - width - margin));
    const below = at.bottom - box.top + gap;
    const above = at.top - box.top - gap - height;
    const flip = below + height > box.height - margin && above >= margin;
    pop.classList.toggle('stt-tip-above', flip);
    // !important: the panel resets every element with `all: revert !important`.
    pop.style.setProperty('left', `${left}px`, 'important');
    pop.style.setProperty('top', `${flip ? above : below}px`, 'important');
    pop.style.setProperty('--stt-arrow-x', `${Math.max(12, Math.min(center - left, width - 12))}px`);
  }
  function openTip(trigger, text) {
    if (!panel) return;
    const pop = element('div', { class: 'stt-tip-pop', role: 'tooltip', id: 'stt-tip' }, text);
    pop.sttTrigger = trigger;
    panel.append(pop);
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-describedby', pop.id);
    placeTip(pop, trigger);
  }
  // Outside click / Escape closes; a scroll keeps the bubble on its ⓘ until the ⓘ scrolls out of view.
  function bindTips(root) {
    root.addEventListener('click', event => { if (!event.target.closest?.('.stt-tip-pop, .stt-info')) closeTips(); });
    root.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !root.querySelector('.stt-tip-pop')) return;
      const trigger = root.querySelector('.stt-info[aria-expanded="true"]');
      event.preventDefault(); event.stopPropagation();
      closeTips(); trigger?.focus();
    }, true);
    root.addEventListener('scroll', event => {
      const pop = root.querySelector('.stt-tip-pop');
      if (!pop || event.target.closest?.('.stt-tip-pop')) return;
      const trigger = pop.sttTrigger, area = event.target instanceof host.Element ? event.target.getBoundingClientRect() : null;
      const at = trigger?.getBoundingClientRect();
      if (!trigger?.isConnected || (area && event.target.contains(trigger) && (at.bottom < area.top || at.top > area.bottom))) { closeTips(); return; }
      placeTip(pop, trigger);
    }, true);
  }
  function labelLine(label, hint) {
    const line = element('span', { class: 'stt-label-line' }, label);
    if (!hint?.tip) return { line, below: hint ? element('small', {}, hint) : null };
    line.append(infoToggle(label, hint.tip));
    return { line, below: null };
  }

  function checkbox(label, checked, change, hint = '') {
    const wrapper = element('label', { class: 'stt-check' });
    const text = element('span', { class: 'stt-check-text' });
    const { line, below } = labelLine(label, hint);
    text.append(line);
    if (below) text.append(below);
    const input = element('input', { type: 'checkbox', role: 'switch' }); input.checked = checked;
    input.addEventListener('change', () => change(input.checked));
    wrapper.append(text, input); return wrapper;
  }

  function field(label, control, hint = '') {
    const wrapper = element('label', { class: 'stt-field' });
    const { line, below } = labelLine(label, hint);
    line.classList.add('stt-field-label');
    wrapper.append(line, control);
    if (below) wrapper.append(below);
    return wrapper;
  }

  // options: [id, name] or { group, options } (rendered as an optgroup)
  function select(options, value, change, label) {
    const node = element('select', { 'aria-label': label });
    const add = (parent, [id, name]) => parent.append(element('option', { value: id }, name));
    for (const entry of options) {
      if (Array.isArray(entry)) { add(node, entry); continue; }
      const group = element('optgroup', { label: entry.group });
      for (const option of entry.options) add(group, option);
      node.append(group);
    }
    node.value = value;
    node.addEventListener('change', () => change(node.value)); return node;
  }
  const FONT_LANGS = [['ko', '한국어'], ['en', '영어'], ['ja', '일본어'], ['zh', '중국어']];
  function fontOptions() {
    const faces = Object.entries(FONT_FACES);
    const groups = FONT_LANGS.map(([lang, group]) => ({ group, options: faces.filter(([, f]) => (f.lang || 'ko') === lang).map(([id, f]) => [id, f.name]) }));
    if (draft.fonts.custom.length) groups.push({ group: '직접 등록', options: draft.fonts.custom.map(f => [CUSTOM_PREFIX + f.name, f.name]) });
    return [['', THEME_AS_IS], ...groups];
  }
  // Loads only the chosen font; preloading the whole list would be heavy.
  function fontSample(id, text) {
    const sample = element('span', { class: 'stt-font-sample', 'aria-hidden': 'true' }, text);
    const css = element('style');
    const show = value => {
      const known = value && (value.startsWith(CUSTOM_PREFIX) ? draft.fonts.custom.some(f => CUSTOM_PREFIX + f.name === value) : FONT_FACES[value]);
      css.textContent = known ? fontController.fontCss([value], draft.fonts.custom).join('\n') : '';
      if (known) sample.style.setProperty('--stt-sample-font', fontController.stack(value));
      else sample.style.removeProperty('--stt-sample-font');
    };
    show(id);
    sample.append(css);
    return { node: sample, show };
  }

  function patchItem(key, patch) {
    if (!draft) return;
    const items = draft.areas[selectedArea].items;
    items[key] = { ...items[key], ...patch };
    if (compactPanel() && panel?.querySelector('[data-stt-detail]')?.contains(doc.activeElement)) {
      const row = [...panel.querySelectorAll('[data-key]')].find(n => n.dataset.key === key);
      const record = records[selectedArea].find(r => r.key === key);
      if (row && record) row.querySelector('strong').textContent = items[key].alias || record.name;
    } else renderList(false);
  }

  function reorder(key, beforeKey) {
    if (!draft || selectedArea === 'topbar' || key === beforeKey || !key) return;
    const order = ordered(selectedArea, draft).map(r => r.key).filter(k => k !== key);
    const index = beforeKey ? order.indexOf(beforeKey) : order.length;
    if (index < 0) return;
    order.splice(index, 0, key);
    draft.areas[selectedArea].order = [...order, ...draft.areas[selectedArea].order.filter(k => !order.includes(k))];
    renderList(); renderDetail();
  }

  function move(key, delta) {
    const order = ordered(selectedArea, draft).map(r => r.key);
    const index = order.indexOf(key);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= order.length) return;
    reorder(key, delta < 0 ? order[next] : order[next + 1]);
  }

  function iconPreview(value, original) {
    const actual = value || original;
    const node = element('span', { class: 'stt-icon-preview', 'aria-hidden': 'true' });
    const blank = () => { node.classList.add('stt-icon-blank'); return node; };
    if (actual === 'none') return blank();
    if (actual) {
      const [prefix, name] = actual.split(' ');
      const face = iconFace(prefix, name);
      if (!face?.glyph) return blank();
      node.textContent = face.glyph;
      node.style.setProperty('font-family', face?.font || fontFamilies[prefix] || fontFamilies['fa-solid'], 'important');
      node.style.setProperty('font-weight', face?.weight || (prefix === 'fa-solid' ? '900' : '400'), 'important');
      if (!face) node.title = '현재 ST에서 글꼴 정보를 찾지 못한 원본 아이콘';
    } else return blank();
    return node;
  }

  function renderList(updateDetail = true) {
    if (!panel || !draft) return;
    for (const tab of panel.querySelectorAll('[data-stt-tab]')) {
      const id = tab.dataset.sttTab;
      tab.setAttribute('aria-selected', String(id === selectedArea));
      tab.replaceChildren(iconPreview(TAB_ICONS[id]), element('span', { class: 'stt-tab-label' }, areaLabel(id)));
      if (!FORM_TABS.has(id)) tab.append(element('span', { class: 'stt-tab-count' }, String(records[id].length)));
      tab.dataset.sttOff = String(!!draft.off?.[id]);
      tab.title = draft.off?.[id] ? '꺼 둔 탭' : '';
    }
    updateTabFade();
    if (FORM_TABS.has(selectedArea)) return;
    const list = panel.querySelector('[data-stt-list]');
    const scroll = list.scrollTop;
    const detail = panel.querySelector('[data-stt-detail]');
    if (list.contains(detail)) panel.querySelector('.stt-editor').append(detail);
    list.replaceChildren();
    const items = ordered(selectedArea, draft).filter(r => `${r.name} ${draft.areas[selectedArea].items[r.key]?.alias || ''}`.toLowerCase().includes(query.toLowerCase()));
    if (!records[selectedArea].some(r => r.key === selectedKey)) selectedKey = items[0]?.key || null;
    if (!items.length) list.append(element('div', { class: 'stt-empty' }, query ? '검색 결과가 없습니다.' : '표시할 항목이 없습니다.'));
    resolveFaces(['fa-solid fa-icons', ...items.map(record => draft.areas[selectedArea].items[record.key]?.icon || record.originalIcon)].filter(Boolean));
    for (const record of items) {
      const config = draft.areas[selectedArea].items[record.key] || {};
      const displayName = NAMED_AREAS.has(selectedArea) && config.alias ? config.alias : record.name;
      const row = element('div', { class: 'stt-row', role: 'button', tabindex: '0', 'data-key': record.key, 'aria-pressed': String(selectedKey === record.key && (!compactPanel() || expandedKey === record.key)), 'aria-label': `${displayName} 편집`, draggable: selectedArea !== 'topbar' ? 'true' : 'false' });
      const choose = () => { expandedKey = compactPanel() && expandedKey === record.key ? null : record.key; selectedKey = record.key; renderList(false); renderDetail(); };
      row.addEventListener('click', choose);
      row.addEventListener('keydown', event => {
        if (event.target !== row) return;
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); }
        if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); move(record.key, event.key === 'ArrowUp' ? -1 : 1); }
      });
      row.addEventListener('dragstart', event => { event.dataTransfer.setData('text/st-tailor', record.key); event.dataTransfer.effectAllowed = 'move'; try { const r = row.getBoundingClientRect(); event.dataTransfer.setDragImage(row, Math.min(event.clientX - r.left, r.width), Math.min(event.clientY - r.top, r.height)); } catch (_) {} });
      row.addEventListener('dragover', event => { if ([...event.dataTransfer.types].includes('text/st-tailor')) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; const rect = row.getBoundingClientRect(); const after = event.clientY >= rect.top + rect.height / 2; row.classList.toggle('stt-drop', !after); row.classList.toggle('stt-drop-after', after); } });
      row.addEventListener('dragleave', () => row.classList.remove('stt-drop', 'stt-drop-after'));
      row.addEventListener('dragend', () => panel?.querySelectorAll('.stt-drop,.stt-drop-after').forEach(n => n.classList.remove('stt-drop', 'stt-drop-after')));
      row.addEventListener('drop', event => {
        event.preventDefault();
        const key = event.dataTransfer.getData('text/st-tailor');
        if (key === record.key || !records[selectedArea].some(r => r.key === key)) return;
        const rect = row.getBoundingClientRect();
        const order = ordered(selectedArea, draft).map(r => r.key).filter(k => k !== key);
        const before = event.clientY >= rect.top + rect.height / 2 ? order[order.indexOf(record.key) + 1] : record.key;
        reorder(key, before);
      });
      const copy = element('span', { class: 'stt-row-copy' });
      copy.append(element('strong', {}, displayName));
      const description = [NAMED_AREAS.has(selectedArea) && config.alias ? record.name : '', config.hidden ? '숨김' : '', record.state.dynamic ? '상태 표시' : ''].filter(Boolean).join(' · ');
      if (description) copy.append(element('small', {}, description));
      const hidden = record.protected
        ? element('span', { class: 'stt-row-locked', title: record.area === 'wand' ? '설정창 열기' : '필수 입력창 버튼' }, '숨김 불가')
        : button(config.hidden ? '복구' : '숨기기', event => { event.stopPropagation(); patchItem(record.key, { hidden: !config.hidden }); if (record.key === selectedKey) renderDetail(); }, { class: 'stt-row-hide', 'aria-label': `${record.name} ${config.hidden ? '숨기기 해제' : '숨기기'}` });
      row.append(element('span', { class: 'stt-grip', 'aria-hidden': 'true' }, '⠿'), iconPreview(config.icon, record.originalIcon), copy, hidden);
      list.append(row);
    }
    list.scrollTop = scroll;
    if (updateDetail) renderDetail();
    positionDetail();
  }

  function updateTabFade() {
    const tabs = panel?.querySelector('.stt-tabs');
    if (!tabs) return;
    const overflow = tabs.scrollWidth > tabs.clientWidth + 1;
    tabs.style.setProperty('--stt-tabs-left', overflow && tabs.scrollLeft > 1 ? '14px' : '0px');
    tabs.style.setProperty('--stt-tabs-right', overflow && tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 1 ? '28px' : '0px');
  }

  function positionDetail() {
    if (!panel) return;
    closeTips();
    updateTabFade();
    const detail = panel.querySelector('[data-stt-detail]');
    const row = [...panel.querySelectorAll('[data-key]')].find(n => n.dataset.key === expandedKey);
    const compact = compactPanel();
    detail.hidden = FORM_TABS.has(selectedArea) || (compact && !row);
    if (compact && row) { if (row.nextElementSibling !== detail) row.after(detail); }
    else if (detail.parentElement !== panel.querySelector('.stt-editor')) panel.querySelector('.stt-editor').append(detail);
    for (const item of panel.querySelectorAll('[data-key]')) {
      if (compact) item.setAttribute('aria-expanded', String(item.dataset.key === expandedKey));
      else item.removeAttribute('aria-expanded');
    }
  }

  function colorField(value, change) {
    const wrapper = element('div', { class: 'stt-color-control' });
    const input = element('input', { type: 'color', value: value || '#666666', 'aria-label': '사용자 색상' });
    const text = element('span', { class: 'stt-color-value' }, value || '기본 색상');
    const reset = button('기본', () => { text.textContent = '기본 색상'; reset.hidden = true; change(''); }, { title: '기본 색상으로' });
    reset.hidden = !value;
    input.addEventListener('input', () => { text.textContent = input.value; reset.hidden = false; change(input.value); });
    wrapper.append(input, text, reset); return wrapper;
  }

  function renderDetail() {
    if (!panel || !draft || FORM_TABS.has(selectedArea)) return;
    positionDetail();
    const detail = panel.querySelector('[data-stt-detail]');
    detail.replaceChildren();
    const record = records[selectedArea].find(r => r.key === selectedKey);
    if (!record) { detail.append(element('div', { class: 'stt-empty' }, '편집할 항목을 선택해 주세요.')); return; }
    const config = draft.areas[selectedArea].items[record.key] || {};
    const patch = values => patchItem(record.key, values);
    const heading = element('div', { class: 'stt-detail-heading' });
    const displayName = NAMED_AREAS.has(selectedArea) && config.alias ? config.alias : record.name;
    heading.append(iconPreview(config.icon, record.originalIcon), element('h3', {}, displayName));
    detail.append(heading);
    if (config.alias) detail.append(element('p', { class: 'stt-original' }, `원래 이름 · ${record.name}`));
    if (selectedArea !== 'topbar') {
      const actions = element('div', { class: 'stt-inline-actions' });
      actions.append(actionButton('위로', '↑', () => move(record.key, -1)), actionButton('아래로', '↓', () => move(record.key, 1)), actionButton('항목 초기화', '↺', () => {
        delete draft.areas[selectedArea].items[record.key];
        draft.areas[selectedArea].order = draft.areas[selectedArea].order.filter(k => k !== record.key);
        renderList();
      }, 'stt-reset'));
      heading.append(actions);
    }
    if (NAMED_AREAS.has(selectedArea)) {
      const alias = element('input', { type: 'text', maxlength: '100', placeholder: record.name, value: config.alias || '', 'aria-label': '표시 이름' });
      alias.addEventListener('input', () => patch({ alias: alias.value.trim() }));
      detail.append(field('표시 이름', alias, '비우면 기본 이름'));
    }
    const iconControl = element('div', { class: 'stt-icon-control' });
    const allowNoIcon = selectedArea !== 'topbar';
    const mode = config.icon === 'none' ? (allowNoIcon ? 'none' : '') : config.icon ? 'custom' : '';
    const iconModes = [['', THEME_AS_IS], ['custom', '아이콘 선택']];
    if (allowNoIcon) iconModes.push(['none', '아이콘 없음']);
    const modeSelect = select(iconModes, mode, value => {
      if (value === 'custom') {
        const [prefix, name] = (record.originalIcon || '').split(' ');
        patch({ icon: catalogs[prefix]?.has(name) ? record.originalIcon : 'fa-solid fa-scissors' });
      }
      else patch({ icon: value });
      renderDetail();
    }, '아이콘');
    iconControl.append(modeSelect);
    detail.append(field('아이콘', iconControl));
    if (mode === 'custom') {
      const picker = element('div', { class: 'stt-picker' });
      const requestedPrefix = (config.icon || '').split(' ')[0] || 'fa-solid';
      const prefix = catalogs[requestedPrefix]?.size ? requestedPrefix : 'fa-solid';
      let pickerPrefix = prefix;
      const search = element('input', { type: 'search', placeholder: '아이콘 검색 · magic, crown, dragon', 'aria-label': '아이콘 검색' });
      const grid = element('div', { class: 'stt-icon-grid' });
      
      const styleOptions = [['fa-solid', 'Solid'], ['fa-regular', 'Regular'], ['fa-brands', 'Brands'], ['ph', 'Phosphor']].filter(([id]) => catalogs[id]?.size);
      // The catalogue holds ~2000 glyphs; render in batches so opening the
      // picker on a phone stays instant instead of building every tile at once.
      const BATCH = 120;
      let shown = BATCH;
      const draw = () => {
        grid.replaceChildren();
        const active = catalogs[pickerPrefix] || new Map();
        const query = search.value.trim().toLowerCase().replace(/^(?:fa|ph)-/, '');
        const matches = [...active.keys()].filter(n => n.includes(query)).sort((a, b) => {
          const rank = name => name.slice(3).startsWith(query) ? 0 : 1;
          return rank(a) - rank(b) || a.localeCompare(b);
        });
        if (pickerPrefix !== 'ph') resolveFaces(matches.slice(0, shown).map(name => `${pickerPrefix} ${name}`));
        for (const name of matches.slice(0, shown)) {
          const value = `${pickerPrefix} ${name}`;
          const tile = button('', () => { patch({ icon: value }); for (const child of grid.children) child.setAttribute('aria-pressed', String(child.title === value)); }, { title: value, 'aria-label': value, 'aria-pressed': String(config.icon === value) });
          tile.append(iconPreview(value)); grid.append(tile);
        }
        if (!matches.length) grid.append(element('small', { class: 'stt-icon-empty' }, `${pickerPrefix.replace('fa-', '')} 글꼴이 현재 ST에 로드되어 있지 않거나 일치하는 아이콘이 없습니다.`));
        more.hidden = matches.length <= shown;
        more.textContent = `아이콘 ${matches.length - shown}개 더 보기`;
      };
      const more = button('', () => { shown += BATCH * 4; draw(); }, { class: 'stt-icon-more' });
      search.addEventListener('input', () => { shown = BATCH; draw(); });
      if (styleOptions.length > 1) picker.append(select(styleOptions, prefix, value => { pickerPrefix = value; shown = BATCH; draw(); }, '아이콘 스타일'));
      picker.append(search, grid, more);
      draw(); detail.append(picker);
    }
    // Top-bar entries are protected and expose icon editing only. The generic
    // position/visibility/state controls below made it look as if the top-bar
    // layout could be changed.
    if (selectedArea === 'topbar') return;
    if (selectedArea !== 'input' && selectedArea !== 'topbar') {
      detail.append(field('색상', colorField(config.color, value => patch({ color: value }))));
      if (selectedArea !== 'messages') detail.append(field('색상 적용', select([['both', '이름과 아이콘'], ['label', '이름'], ['icon', '아이콘']], config.colorTarget || 'both', value => patch({ colorTarget: value }), '색상 적용')));
      if (selectedArea === 'extensions') detail.append(field('글자 굵기', select([['bold', '굵게'], ['normal', '얇게']], config.fontWeight || 'bold', value => patch({ fontWeight: value }), '글자 굵기')));
    } else {
      detail.append(field('위치', select([['', `기본 위치 · ${record.side === 'left' ? '왼쪽' : '오른쪽'}`], ['left', '입력창 왼쪽'], ['right', '입력창 오른쪽']], config.side || '', value => patch({ side: value }), '위치')));
      detail.append(field('색상', colorField(config.color, value => patch({ color: value })), tip('비우면 아래 공통 색상을 따릅니다')));
    }
    if (record.protected) detail.append(element('p', { class: 'stt-locked-note' }, record.area === 'wand' ? '설정창을 여는 항목은 숨길 수 없습니다.' : record.area === 'topbar' ? '상단바 메뉴는 아이콘만 바꿀 수 있습니다.' : '필수 입력창 버튼이라 숨길 수 없습니다.'));

    if (selectedArea === 'extensions' && config.alias) {
      detail.append(checkbox('버전·배지 등 원래 부가 장식 숨기기', config.hideDecorations !== false, value => patch({ hideDecorations: value })));
    }
    if (record.state.dynamic) {
      const state = element('details', { class: 'stt-state' });
      state.append(element('summary', {}, '상태 표시 설정'));
      state.append(element('p', {}, record.state.split ? '이름과 분리된 상태 문구는 그대로 유지합니다.' : record.state.known ? '기능의 상태 표시를 확인한 항목입니다.' : '실행 중 표시가 바뀌는 항목입니다. 원래 표시를 유지할 수 있습니다.'));
      if (record.state.changed.label && !record.state.split) state.append(checkbox('변하는 원래 문구 유지', config.preserveLabel !== false, value => patch({ preserveLabel: value })));
      state.append(checkbox('상태 아이콘 유지', config.preserveIcon !== false, value => patch({ preserveIcon: value })), checkbox('상태 색상 유지', config.preserveColor !== false, value => patch({ preserveColor: value })));
      detail.append(state);
    }
  }

  function renderInputLayout(container) {
    const box = element('section', { class: 'stt-common', 'data-stt-layout-settings': '' });
    const heading = element('div', { class: 'stt-common-heading' });
    heading.append(element('h3', {}, '입력창 배치'), actionButton('입력창 배치 초기화', '↺', () => {
      draft.inputLayout = defaults().inputLayout; draft.inputLayoutMobile = null; renderPanelBody();
    }, 'stt-reset'));
    box.append(heading);
    const separate = !!draft.inputLayoutMobile;
    box.append(checkbox('모바일은 따로 설정', separate, value => {
      draft.inputLayoutMobile = value ? { ...draft.inputLayout } : null;
      renderPanelBody();
    }, tip('화면 폭 1000px 이하')));
    // PC and mobile side by side, so enabling separate settings doesn't lengthen this block and push the editor down.
    const grid = element('div', { class: separate ? 'stt-layout-grid stt-layout-split' : 'stt-layout-grid' });
    const column = (config, title) => {
      const col = element('div', { class: 'stt-layout-col' });
      if (title) col.append(element('h4', { class: 'stt-layout-title' }, title));
      const prefix = title ? `${title} · ` : '';
      const position = select([['top', '위 · 입력칸 위 / 버튼 아래'], ['bottom', '아래 · 버튼 위 / 입력칸 아래']], config.position, value => {
        config.position = value; update();
      }, `${prefix}두 줄일 때 입력칸 위치`);
      const rows = select([['theme', THEME_AS_IS], ['single', '한 줄'], ['double', '두 줄']], config.rows, value => {
        config.rows = value; update();
      }, `${prefix}입력창 줄 구성`);
      const positionField = field('두 줄일 때 입력칸 위치', position);
      function update() { positionField.hidden = config.rows !== 'double'; }
      update();
      col.append(field('줄 구성', rows, title ? '' : tip('테마 그대로여도 버튼 순서 · 좌우 위치는 적용됩니다')), positionField);
      return col;
    };
    grid.append(column(draft.inputLayout, separate ? 'PC' : ''));
    if (separate) grid.append(column(draft.inputLayoutMobile, '모바일'));
    box.append(grid);
    container.append(box);
  }

  function renderInputStyle(container) {
    if (selectedArea !== 'input') return;
    const duo = element('div', { class: 'stt-duo' });
    container.append(duo);
    container = duo;
    renderInputLayout(container);
    const box = element('section', { class: 'stt-common' });
    const heading = element('div', { class: 'stt-common-heading' });
    heading.append(element('h3', {}, '입력창 버튼 공통 모양'), actionButton('공통 모양 초기화', '↺', () => { draft.inputStyle = defaults().inputStyle; renderPanelBody(); }, 'stt-reset'));
    box.append(heading);
    const controls = element('div', { class: 'stt-common-fields' });
    // Current sizes: measured once when the panel opens, from the first visible input button.
    const sample = [...doc.querySelectorAll('#leftSendForm > *, #rightSendForm > *')]
      .find(node => node.id !== 'send_but' && node.id !== 'mes_stop' && node.id !== 'options_button' && node.getBoundingClientRect().width);
    const now = sample ? { iconSize: Math.round(parseFloat(host.getComputedStyle(sample).fontSize)), buttonSize: Math.round(sample.getBoundingClientRect().width) } : {};
    for (const [key, label, min, max] of [['iconSize', '아이콘 크기', 12, 48], ['buttonSize', '버튼 영역 크기', 24, 80]]) {
      const input = element('input', { type: 'number', min, max, placeholder: '기본', value: draft.inputStyle[key] ?? '', 'aria-label': label });
      input.addEventListener('input', () => { if (!input.validity.valid && input.value) return; draft.inputStyle[key] = numberValue(input.value, min, max); });
      controls.append(field(`${label} · px`, input, now[key] ? `지금 ${now[key]}px` : ''));
    }
    // Empty gap keeps the theme's; the shown current value is the distance between the two leftmost visible buttons.
    const shown = [...doc.querySelectorAll('#send_form #nonQRFormItems *')].filter(node => node.matches('[id]:not(#send_textarea)') && node.closest('#leftSendForm, #rightSendForm') && node.parentElement.matches('#leftSendForm, #rightSendForm') && node.getBoundingClientRect().width)
      .map(node => node.getBoundingClientRect()).sort((x, y) => x.left - y.left);
    const nowGap = shown.length > 1 ? Math.max(0, Math.round(shown[1].left - shown[0].right)) : null;
    const gapInput = element('input', { type: 'number', min: 0, max: 24, placeholder: '테마', value: draft.inputStyle.gap ?? '', 'aria-label': '아이콘 사이 간격' });
    gapInput.addEventListener('input', () => { if (!gapInput.validity.valid && gapInput.value) return; draft.inputStyle.gap = numberValue(gapInput.value, 0, 24); });
    controls.append(field('아이콘 사이 간격 · px', gapInput, nowGap !== null ? `지금 ${nowGap}px · 비우면 테마 그대로` : '비우면 테마 그대로'));
    controls.append(field('공통 색상', colorField(draft.inputStyle.color, value => { draft.inputStyle.color = value; })));
    box.append(controls);
    container.append(box);
    renderInputText(container);
  }

  // Composer placeholder text ("Type a message…")
  function renderInputText(container) {
    const config = draft.inputText;
    const box = element('section', { class: 'stt-common stt-duo-wide' });
    const title = element('h3', {}, '입력창 안내 문구');
    const what = element('span', {}, ' · 입력칸의 \u2018Type a message…\u2019 자리');
    for (const [property, value] of [['font-weight', '400'], ['font-size', '.8em'], ['opacity', '.65']]) what.style.setProperty(property, value, 'important');
    title.append(what);
    box.append(title);
    const grid = element('div', { class: 'stt-form-grid' });
    const text = element('input', { type: 'text', maxlength: '200', placeholder: '예: 오늘은 무슨 이야기를 할까요?', value: config.text, 'aria-label': '입력창 안내 문구' });
    text.addEventListener('input', () => { config.text = text.value; previewDraft(); });
    const textField = field('문구', text, tip('API 연결이 안 됐을 때의 안내는 그대로 보입니다'));
    const sync = () => { textField.hidden = config.mode !== 'custom'; };
    const modeField = field('표시', select([['default', '실리태번 그대로'], ['hide', '숨기기'], ['custom', '직접 쓰기']], config.mode, value => { config.mode = value; sync(); previewDraft(); }, '입력창 안내 문구 표시'));
    grid.append(modeField, textField);
    sync();
    box.append(grid);
    container.append(box);
  }

  function renderQrSettings(container) {
    const box = element('section', { class: 'stt-common' });
    const config = draft.qr;
    box.append(element('h3', {}, '입력창 위 QR 바'));
    const grid = element('div', { class: 'stt-form-grid' });
    grid.append(
      field('표시 방식', select([['always','항상 표시'],['focus','입력창 포커스 시 표시'],['toggle','접이식 바']], config.mode, value => { config.mode = value; }, 'QR 표시 방식')),
      field('행 구성', select([['single','전체 한 줄'],['sets','세트별 한 줄']], config.layout, value => { config.layout = value; }, 'QR 행 구성')),
      field('버튼 정렬', select([['left','왼쪽'],['center','가운데'],['right','오른쪽']], config.align, value => { config.align = value; }, 'QR 버튼 정렬')),
      field('버튼 모양', select([['theme', THEME_AS_IS],['pill','알약'],['rounded','둥근 사각'],['plain','배경·테두리 없음']], config.style, value => { config.style = value; }, 'QR 버튼 모양')));
    box.append(grid);
    container.append(box);
  }

  function renderHomeSettings(container) {
    const home = draft.home, config = home.clock;
    const preview = previewDraft;
    // Full-width sections split into left (toggle/basics) and right (details); they stack when narrow.
    const columns = section => {
      const grid = element('div', { class: 'stt-home-cols' });
      const left = element('div'), right = element('div');
      grid.append(left, right); section.append(grid);
      return [left, right];
    };
    const box = element('section', { class: 'stt-common' });
    box.append(element('h3', {}, '시계'));
    const [clockLeft, clockRight] = columns(box);
    clockRight.className = 'stt-sub-narrow';
    const clockBasics = element('div', { class: 'stt-sub' });
    const syncClock = () => { clockBasics.hidden = clockRight.hidden = !config.enabled; };
    clockLeft.append(checkbox('현재 시각 보이기', config.enabled, value => { config.enabled = value; syncClock(); preview(); }), clockBasics);
    clockBasics.append(checkbox('시계 아래 날짜 · 요일 보이기', config.date, value => { config.date = value; preview(); }));
    const label = element('input', { type: 'text', maxlength: '40', value: config.label, placeholder: '비우면 문구 없음', 'aria-label': '시계 위 문구' });
    label.addEventListener('input', () => { config.label = label.value; preview(); });
    clockBasics.append(field('시계 위 문구', label));
    clockBasics.append(field('시간 표시', select([['24', '24시간 (예: 21:07)'], ['12', '12시간 (예: 09:07 PM)']], config.hour12 ? '12' : '24', value => { config.hour12 = value === '12'; preview(); }, '시간 표시 방식')));
    const clockSample = fontSample(config.font, '12:34  0123456789');
    const clockFont = field('숫자 글꼴', select(fontOptions(), config.font, value => { config.font = value; clockSample.show(value); preview(); }, '시계 숫자 글꼴'));
    clockFont.append(clockSample.node);
    clockRight.append(clockFont);
    const clockSlider = (key, title, min, max, step, fallback, unit) => {
      const row = element('div', { class: 'stt-font-slider' });
      const range = element('input', { type: 'range', min, max, step, value: config[key], 'aria-label': `시계 ${title}` });
      const shown = element('span', { class: 'stt-font-value' }, `${config[key]}${unit}`);
      const sync = () => { shown.textContent = `${config[key]}${unit}`; range.style.setProperty('--stt-fill', `${(range.value - min) / (max - min) * 100}%`); reset.toggleAttribute('data-idle', config[key] === fallback); };
      range.addEventListener('input', () => { config[key] = Number(range.value); sync(); preview(); });
      const reset = button('↺', () => { config[key] = fallback; range.value = fallback; sync(); preview(); }, { 'aria-label': `시계 ${title} 되돌리기`, title: '기본값' });
      sync();
      row.append(element('span', {}, title), range, shown, reset);
      return row;
    };
    clockRight.append(clockSlider('size', '크기', 50, 200, 5, 100, '%'), clockSlider('top', '위 여백', 0, 80, 2, 20, 'px'), clockSlider('bottom', '아래 여백', 0, 80, 2, 8, 'px'));
    syncClock();
    container.append(box);
    const side = element('section', { class: 'stt-common' });
    side.append(element('h3', {}, '캐릭터 바로가기'));
    const [search, favorites] = columns(side);
    search.append(checkbox('홈에서 캐릭터 검색', home.search, value => { home.search = value; preview(); }, tip('누르면 바로 대화 열기')));
    const favStyle = element('div', { class: 'stt-sub' });
    favStyle.append(field('즐겨찾기 모양', select([['circle', '동그란 사진'], ['card', '세로 카드']], home.favorites.style, value => { home.favorites.style = value; preview(); }, '즐겨찾기 모양')));
    const syncFav = () => { favStyle.hidden = !home.favorites.enabled; };
    favorites.append(checkbox('즐겨찾기한 캐릭터 보이기', home.favorites.enabled, value => { home.favorites.enabled = value; syncFav(); preview(); }), favStyle);
    syncFav();
    container.append(side);
    const hiding = element('section', { class: 'stt-common' });
    hiding.append(element('h3', {}, '홈에서 숨기기'));
    const [hideLeft, hideRight] = columns(hiding);
    hideLeft.append(checkbox('실리태번 아이콘 · 버전 글자', home.hide.version, value => { home.hide.version = value; preview(); }));
    hideLeft.append(checkbox('Docs · GitHub · Discord 링크', home.hide.links, value => { home.hide.links = value; preview(); }));
    hideRight.append(checkbox('Temporary Chat 버튼', home.hide.temporary, value => { home.hide.temporary = value; preview(); }));
    hideRight.append(checkbox('어시스턴트 메시지', home.hide.assistant, value => { home.hide.assistant = value; preview(); }, tip('홈 아래의 인사 · 안내 메시지')));
    container.append(hiding);
    // Recent chats: hide entirely, or set fold/count here when SillyTavern's own buttons (gear, fold) are hidden.
    const recent = element('section', { class: 'stt-common' });
    recent.append(element('h3', {}, '최근 채팅 (Recent Chats)'));
    const [recentLeft, recentRight] = columns(recent);
    let syncCounts = () => {};
    recentLeft.append(checkbox('최근 채팅 숨기기', home.hide.recent, value => { home.hide.recent = value; syncCounts(); preview(); }, tip('제목 · 목록 · 버튼 모두')));
    if (recentSupported !== false && recentDraft) {
      const counts = element('div', { class: 'stt-recent-counts' });
      const settingsToggle = checkbox('설정(⚙) · 접기 버튼 숨기기', home.hide.settings, value => { home.hide.settings = value; syncCounts(); preview(); }, tip('숨기면 접기와 개수를 여기서 정합니다'));
      syncCounts = () => { settingsToggle.hidden = home.hide.recent; counts.hidden = home.hide.recent || !home.hide.settings; };
      const value = recentDraft.value;
      counts.append(checkbox('최근 채팅 목록 접기', value.folded, folded => { value.folded = folded; showFolded(folded); }));
      for (const [key, label] of [['max', '최근 대화 최대 개수'], ['collapsed', '더 보기 전 보이는 개수']]) {
        const input = element('input', { type: 'number', min: 1, max: RECENT_LIMIT, step: 1, value: value[key], 'aria-label': label });
        input.addEventListener('input', () => { const n = numberValue(input.value, 1, RECENT_LIMIT); if (n !== null) value[key] = n; });
        counts.append(field(label, input));
      }
      counts.append(element('small', {}, '실리태번 ⚙ · 접기 버튼과 같은 값 · 개수는 저장하면 적용'));
      recentLeft.append(settingsToggle);
      recentRight.append(counts);
      syncCounts();
    }
    container.append(recent);
  }

  function renderTopbarFold(container) {
    const box = element('section', { class: 'stt-common' });
    const config = draft.topbarFold;
    box.append(element('h3', {}, '상단바 접기'));
    const grid = element('div', { class: 'stt-form-grid' });
    const lookField = field('접혔을 때 표시', select([['handle', '막대 (기본)'], ['dots', '점 세 개'], ['shadow', '위쪽 그림자']], config.look, value => { config.look = value; previewDraft(); }, '접혔을 때 표시'));
    const chatOnlyBox = checkbox('채팅방에서만 접기', config.chatOnly, value => { config.chatOnly = value; previewDraft(); }, tip('홈 화면에서는 상단바를 그대로 둡니다'));
    const hoverBox = checkbox('PC에서 마우스를 위에 올리면 자동 펼치기', config.hover, value => { config.hover = value; previewDraft(); }, tip('상단바 아래로 벗어나면 다시 접힘'));
    const colorBox = field('표시 색', colorField(config.color, value => { config.color = value; previewDraft(); }));
    colorBox.style.setProperty('grid-column', '1 / -1', 'important');
    const syncLook = () => { lookField.hidden = colorBox.hidden = chatOnlyBox.hidden = config.mode === 'off'; hoverBox.hidden = config.mode !== 'all'; };
    grid.append(
      field('적용 화면', select([['off', '사용 안 함'], ['narrow', '모바일 화면에서만'], ['all', '모든 화면']], config.mode, value => { config.mode = value; syncLook(); previewDraft(); }, '상단바 접기 적용 화면'),
        '맨 위를 누르면 펼치고, 바깥을 누르면 접힙니다.'),
      lookField, chatOnlyBox, hoverBox, colorBox);
    syncLook();
    box.append(grid);
    container.append(box);
  }

  function renderMessageOptions(container) {
    const box = element('section', { class: 'stt-common' });
    box.append(element('h3', {}, '메시지 편집'));
    box.append(checkbox('메시지 편집창 자동 포커싱 금지', draft.editAutoFocus === false, value => { draft.editAutoFocus = !value; }, tip('모바일에서 편집을 눌러도 키보드가 바로 뜨지 않습니다')));
    container.append(box);
  }

  function renderFontSettings(container) {
    const duo = element('div', { class: 'stt-duo' });
    // The panel sets its own font, so sync it with the page on every preview.
    const preview = () => {
      previewDraft();   // Also updates the clock when it uses a custom font
      panel?.style.setProperty('--stt-ui-font', host.getComputedStyle(doc.body).fontFamily);
    };
    const families = fontOptions();
    const show = {
      size: v => `${v}%`, lineHeight: v => `${v}%`,
      stroke: v => v === null ? '테마 그대로' : v === 0 ? '없음' : `${(v / 10).toFixed(1)}px`,
      spacing: v => v === null ? '테마 그대로' : `${v > 0 ? '+' : ''}${(v / 100).toFixed(2)}em`,
      fade: v => v ? `${v}%` : '그대로',
    };
    // Slider + current value + reset to theme
    const slider = (config, key, label, title, changed = () => {}) => {
      const [min, max] = FONT_LIMITS[key];
      const fallback = { ...markStyle(), ...fontDefaults() }[key];
      const row = element('div', { class: 'stt-font-slider' });
      const range = element('input', { type: 'range', min, max, step: ['size', 'lineHeight', 'fade'].includes(key) ? 5 : 1, value: config[key] ?? (key === 'stroke' ? 0 : fallback ?? 0), 'aria-label': `${title} ${label}` });
      const value = element('span', { class: 'stt-font-value' }, show[key](config[key]));
      const fill = () => range.style.setProperty('--stt-fill', `${(range.value - min) / (max - min) * 100}%`);
      fill();
      const idle = () => reset.toggleAttribute('data-idle', (config[key] ?? null) === (fallback ?? null));
      const reset = button('↺', () => { config[key] = fallback; range.value = fallback ?? 0; fill(); value.textContent = show[key](fallback); idle(); preview(); changed(); }, { 'aria-label': `${title} ${label} 되돌리기`, title: '테마 그대로' });
      range.addEventListener('input', () => { fill(); config[key] = Number(range.value); value.textContent = show[key](config[key]); idle(); preview(); changed(); });
      idle();
      row.append(element('span', {}, label), range, value, reset);
      return row;
    };
    for (const [group, title] of [['ui', 'UI 글꼴'], ['chat', '메시지 글꼴']]) {
      const config = draft.fonts[group];
      const box = element('section', { class: 'stt-common' });
      const heading = element('div', { class: 'stt-common-heading' });
      heading.append(element('h3', {}, title), actionButton(`${title} 초기화`, '↺', () => { draft.fonts[group] = fontDefaults(); preview(); renderPanelBody(); }, 'stt-reset'));
      box.append(heading);
      const sample = fontSample(config.family, '가나다라 마바사 · Aa Bb Cc 123 · あいう');
      const family = field('기본 글꼴', select(families, config.family, value => { config.family = value; sample.show(value); preview(); }, `${title} 기본 글꼴`));
      family.append(sample.node);
      box.append(family);
      // Per-language fonts are collapsed since few use them; a • by the title marks that one is set.
      const langs = element('div', { class: 'stt-font-langs' });
      const langsBody = element('div', { class: 'stt-font-langs-body', id: `stt-font-langs-${group}` });
      const langsSet = () => FONT_LANG_ORDER.some(lang => config.langs[lang]);
      const langsToggle = button('', () => {
        if (expandedLangs.has(group)) expandedLangs.delete(group); else expandedLangs.add(group);
        syncLangs();
      }, { class: 'stt-font-langs-toggle', 'aria-controls': langsBody.id });
      const syncLangs = () => {
        const open = expandedLangs.has(group);
        langsToggle.setAttribute('aria-expanded', String(open));
        langsToggle.textContent = langsSet() ? '언어별 글꼴 •' : '언어별 글꼴';
        langsToggle.title = langsSet() ? '고른 글꼴이 있음' : '영어 · 일본어 · 중국어 글자에만 다른 글꼴';
        langsBody.hidden = !open;
      };
      langs.append(langsToggle, langsBody);
      const langFamilies = [['', '기본 글꼴 그대로'], ...families.slice(1)];
      for (const [lang, label, text] of [['en', '영어', 'Aa Bb Cc 123 · “Hello”'], ['ja', '일본어', 'あいう アイウ 日本語'], ['zh', '중국어', '中文字体 · 汉字 漢字']]) {
        const langSample = fontSample(config.langs[lang], text);
        const row = element('div', { class: 'stt-font-lang' });
        row.append(element('span', {}, label), select(langFamilies, config.langs[lang], value => { config.langs[lang] = value; langSample.show(value); preview(); syncLangs(); }, `${title} ${label} 글꼴`), langSample.node);
        langsBody.append(row);
      }
      langsBody.append(element('small', { class: 'stt-font-note' }, '그 언어 글자에만 씁니다. 일본어와 중국어를 둘 다 고르면 한자는 일본어 글꼴로 나옵니다.'));
      syncLangs();
      for (const [key, label] of [['size', '크기'], ['stroke', '굵기'], ['lineHeight', '행간'], ['spacing', '자간']]) box.append(slider(config, key, label, title));
      box.append(langs);
      duo.append(box);
    }
    container.append(duo);
    // Partial fonts: built-in rules (quotes, corner brackets) plus custom open/close pairs.
    // The last column is reserved only when a custom rule (with a delete button) exists; otherwise the adjust button sits at the right edge.
    const marksBox = element('section', { class: draft.fonts.marks.some(m => m.open) ? 'stt-common stt-font-marks-custom' : 'stt-common' });
    const marksTitle = element('h3', { class: 'stt-label-line' }, '부분 글꼴');
    const marksInfo = infoToggle('부분 글꼴', '메시지 본문에만 적용됩니다. 규칙은 여는 글자와 닫는 글자(예: 【 】)로 추가하고, 줄바꿈(엔터) 없이 이어진 글 안에서만 찾습니다. 화면에서 자동으로 넘어간 줄은 상관없습니다.');
    marksTitle.append(marksInfo);
    marksBox.append(marksTitle);
    for (const mark of draft.fonts.marks) {
      const preset = MARK_PRESETS.find(p => p.id === mark.id);
      const label = preset ? preset.name : `${mark.open} … ${mark.close}`;
      const row = element('div', { class: 'stt-font-mark' });
      const name = element('span', {}, label);
      if (preset) name.append(element('small', {}, preset.sample));
      const open = expandedMarks.has(mark.id);
      const tuned = () => MARK_ADJUST.some(key => mark[key] !== markStyle()[key]);
      const adjust = button(tuned() ? '조정 •' : '조정', () => { if (open) expandedMarks.delete(mark.id); else expandedMarks.add(mark.id); renderPanelBody(); },
        { class: 'stt-font-mark-toggle', 'aria-expanded': String(open), 'aria-label': `${label} 크기 · 굵기 · 자간 · 투명도 조정`, title: tuned() ? '조정한 값이 있음' : '크기 · 굵기 · 자간 · 투명도' });
      row.append(name, select(families, mark.family, value => { mark.family = value; preview(); }, `${label} 글꼴`), adjust);
      if (!preset) row.append(button('×', () => { draft.fonts.marks = draft.fonts.marks.filter(m => m !== mark); expandedMarks.delete(mark.id); preview(); renderPanelBody(); }, { 'aria-label': `${label} 규칙 삭제`, title: '삭제' }));
      marksBox.append(row);
      if (open) {
        const sliders = element('div', { class: 'stt-font-mark-adjust' });
        const showTuned = () => { adjust.textContent = tuned() ? '조정 •' : '조정'; adjust.title = tuned() ? '조정한 값이 있음' : '크기 · 굵기 · 자간 · 투명도'; };
        for (const [key, title] of [['size', '크기'], ['stroke', '굵기'], ['spacing', '자간'], ['fade', '투명도']]) sliders.append(slider(mark, key, title, label, showTuned));
        marksBox.append(sliders);
      }
    }
    const openInput = element('input', { type: 'text', maxlength: '4', placeholder: '여는 글자', 'aria-label': '여는 글자' });
    const closeInput = element('input', { type: 'text', maxlength: '4', placeholder: '닫는 글자', 'aria-label': '닫는 글자' });
    const addRule = button('규칙 추가', () => {
      const open = markChars(openInput.value), close = markChars(closeInput.value);
      if (!open || !close) { report('여는 글자와 닫는 글자를 모두 적어 주세요.', true); return; }
      const custom = draft.fonts.marks.filter(m => m.open);
      if (custom.some(m => m.open === open && m.close === close)) { report('이미 있는 규칙입니다.', true); return; }
      if (custom.length >= MAX_MARK_RULES) { report(`직접 추가한 규칙은 ${MAX_MARK_RULES}개까지입니다.`, true); return; }
      draft.fonts.marks.push({ id: `u${Date.now().toString(36)}`, open, close, ...markStyle() });
      renderPanelBody();
    });
    const adder = element('div', { class: 'stt-font-mark-add' });
    adder.append(openInput, closeInput, addRule);
    marksBox.append(adder);
    container.append(marksBox);
    // Accepts @font-face code from web font sites, a Google Fonts <link>, a CSS URL or a font file URL.
    const box = element('section', { class: 'stt-common' });
    box.append(element('h3', {}, '웹폰트 직접 등록'));
    const name = element('input', { type: 'text', maxlength: '60', placeholder: '글꼴 이름 (코드에 있으면 비워도 됨)', 'aria-label': '등록할 글꼴 이름' });
    const code = element('textarea', { class: 'stt-font-code', rows: '3', placeholder: '@font-face 코드 · 구글 폰트 <link> · CSS 주소 · .woff2 주소', 'aria-label': '웹폰트 코드 또는 주소' });
    const add = button('등록', () => {
      const entry = parseCustomFont(name.value, code.value);
      if (!entry) { report('글꼴 코드나 주소를 읽지 못했습니다. https 주소만 쓸 수 있고, 주소만 넣을 땐 이름도 적어 주세요.', true); return; }
      if (draft.fonts.custom.length >= MAX_CUSTOM_FONTS && !draft.fonts.custom.some(f => f.name === entry.name)) { report(`직접 등록은 ${MAX_CUSTOM_FONTS}개까지입니다.`, true); return; }
      draft.fonts.custom = [...draft.fonts.custom.filter(f => f.name !== entry.name), entry];
      renderPanelBody();
    }, { class: 'stt-primary' });
    const top = element('div', { class: 'stt-font-register' });
    top.append(name, add);
    box.append(code, top);
    if (draft.fonts.custom.length) {
      const list = element('div', { class: 'stt-font-chips', role: 'list', 'aria-label': '등록한 글꼴' });
      for (const entry of draft.fonts.custom) {
        const chip = element('span', { class: 'stt-font-chip', role: 'listitem' });
        const remove = button('×', () => {
          draft.fonts.custom = draft.fonts.custom.filter(f => f !== entry);
          for (const group of FONT_GROUPS) {
            const fonts = draft.fonts[group];
            if (fonts.family === CUSTOM_PREFIX + entry.name) fonts.family = '';
            for (const lang of FONT_LANG_ORDER) if (fonts.langs[lang] === CUSTOM_PREFIX + entry.name) fonts.langs[lang] = '';
          }
          for (const mark of draft.fonts.marks) if (mark.family === CUSTOM_PREFIX + entry.name) mark.family = '';
          if (draft.home.clock.font === CUSTOM_PREFIX + entry.name) draft.home.clock.font = '';
          preview(); renderPanelBody();
        }, { 'aria-label': `${entry.name} 삭제`, title: '삭제' });
        chip.append(element('span', {}, entry.name), remove);
        list.append(chip);
      }
      box.append(list);
    }
    container.append(box);
  }


  // ── Preview: collapsible block at the top of a tab, drawn only while open ──
  // Draws a simple mock instead of cloning the real page (order, icons, colors, layout).
  // Only the theme's text/background/border colors are borrowed; the font sample ignores the theme.
  const PREVIEW_SAMPLES = [
    ['ko', '한국어', [
      '그녀는 창문을 열며 잠시 바깥을 내다보았다. 밤사이 내린 비가 그친 골목은 아직 젖어 있었고, 가로등 불빛이 물웅덩이마다 흔들렸다. *어디선가 빵 굽는 냄새가 희미하게 실려 왔다.*',
      '“오늘은 조금 늦게 나가도 괜찮겠지.” 그녀가 혼잣말처럼 중얼거리자, 등 뒤에서 낮은 목소리가 대답했다. 「그 말, 어제도 했던 것 같은데.」 그는 **식탁 위의 열쇠**를 집어 들며 웃었다.',
    ]],
    ['en', 'English', [
      'She opened the window and looked out for a moment. The alley was still wet from the night’s rain, and the streetlights trembled in every puddle. *Somewhere, the faint smell of fresh bread drifted in.*',
      '“I think it’s fine if I leave a little late today,” she murmured, half to herself. A low voice answered from behind her. 「You said that yesterday, too.」 He picked up **the keys on the table** and smiled.',
    ]],
    ['ja', '日本語', [
      '彼女は窓を開けて、しばらく外を眺めていた。夜のうちに降った雨はやみ、路地はまだ濡れていて、街灯の光が水たまりごとに揺れていた。*どこからか、パンを焼く匂いがかすかに漂ってきた。*',
      '「今日は少し遅く出ても大丈夫よね。」彼女が独り言のようにつぶやくと、背後から低い声が答えた。“それ、昨日も言ってた気がするけど。”彼は**テーブルの上の鍵**を手に取って笑った。',
    ]],
    ['zh', '中文', [
      '她推开窗户，望着外面出了一会儿神。夜里下的雨已经停了，小巷还湿漉漉的，路灯的光在每个水洼里轻轻摇晃。*不知从哪里飘来淡淡的面包香。*',
      '“今天晚一点出门应该也没关系吧。”她像自言自语般低声说道，身后传来一个低沉的声音。「这句话你昨天好像也说过。」他拿起**桌上的钥匙**，笑了笑。',
    ]],
  ];
  const PREVIEW_PANEL_CSS = `
#stt-panel#stt-panel#stt-panel .stt-preview { flex: none !important; margin: 0 0 14px !important; border: 1px solid var(--stt-border) !important; border-radius: 14px !important; overflow: hidden !important; }
#stt-panel#stt-panel#stt-panel .stt-preview-head { display: flex !important; align-items: center !important; gap: 8px !important; }
#stt-panel#stt-panel#stt-panel button.stt-preview-toggle { flex: 1 1 auto !important; justify-content: flex-start !important; min-height: 40px !important; padding: 0 14px !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; font-size: .9em !important; }
#stt-panel#stt-panel#stt-panel button.stt-preview-toggle::after { content: "" !important; width: 7px !important; height: 7px !important; margin-left: 4px !important; border-right: 2px solid currentColor !important; border-bottom: 2px solid currentColor !important; transform: rotate(-45deg) !important; opacity: .6 !important; transition: transform .15s !important; }
#stt-panel#stt-panel#stt-panel button.stt-preview-toggle[aria-expanded="true"]::after { transform: rotate(45deg) translate(-2px, -2px) !important; }
#stt-panel#stt-panel#stt-panel button.stt-preview-toggle:is(:hover, :focus-visible) { background: var(--stt-wash) !important; }
#stt-panel#stt-panel#stt-panel .stt-preview-lang:not([hidden]) { display: flex !important; align-items: center !important; gap: 2px !important; padding-right: 8px !important; }
#stt-panel#stt-panel#stt-panel .stt-preview-lang > span { min-width: 4.5em !important; text-align: center !important; font-size: .86em !important; font-weight: 600 !important; }
#stt-panel#stt-panel#stt-panel .stt-preview-lang > button { width: 30px !important; min-width: 30px !important; min-height: 30px !important; padding: 0 !important; }
#stt-panel#stt-panel#stt-panel .stt-preview-body { display: flex !important; flex-direction: column !important; gap: 10px !important; max-height: 340px !important; overflow: auto !important; padding: 14px !important; border-top: 1px solid var(--stt-border) !important; }
#stt-panel#stt-panel#stt-panel .stt-preview-body[hidden] { display: none !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-note { margin: 0 !important; color: var(--stt-muted) !important; font-size: .82em !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-label { margin: 0 0 -4px !important; color: var(--stt-muted) !important; font-size: .76em !important; font-weight: 600 !important; }
/* A translucent theme background is layered over a base color matched to its brightness */
#stt-panel#stt-panel#stt-panel .stt-pv-stage { display: flex !important; align-items: center !important; gap: 6px !important; flex-wrap: wrap !important; padding: 10px 12px !important; border: 1px solid var(--stt-pv-line) !important; border-radius: 12px !important; background: linear-gradient(var(--stt-pv-tint), var(--stt-pv-tint)), var(--stt-pv-base) !important; color: var(--stt-pv-fg) !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-stage.stt-pv-center { justify-content: center !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-stage .stt-icon-preview { width: auto !important; min-width: 1.25em !important; color: inherit !important; background: none !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; flex: none !important; width: var(--stt-pv-size, 30px) !important; height: var(--stt-pv-size, 30px) !important; font-size: var(--stt-pv-icon, 15px) !important; border-radius: 8px !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-btn .stt-icon-preview { font-size: inherit !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-field { flex: 1 1 120px !important; min-width: 80px !important; height: 30px !important; border-radius: 8px !important; border: 1px dashed color-mix(in srgb, var(--stt-pv-fg) 30%, transparent) !important; color: color-mix(in srgb, var(--stt-pv-fg) 55%, transparent) !important; font-size: .78em !important; display: flex !important; align-items: center !important; padding: 0 10px !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-rowbreak { flex-basis: 100% !important; height: 0 !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-gap { flex: 1 1 auto !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-chip { display: inline-block !important; max-width: 7em !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; font-size: 10px !important; line-height: 1.2 !important; padding: 2px 5px !important; border: 1px solid color-mix(in srgb, var(--stt-pv-fg) 35%, transparent) !important; border-radius: 5px !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-btn:has(.stt-pv-chip) { width: auto !important; }
@media (min-width: 701px) { #stt-panel#stt-panel#stt-panel .stt-pv-list.stt-pv-cols { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; align-items: start !important; column-gap: 18px !important; row-gap: 2px !important; } #stt-panel#stt-panel#stt-panel .stt-pv-cols > .stt-pv-item + .stt-pv-item { border-top: 0 !important; } }
#stt-panel#stt-panel#stt-panel .stt-pv-list { display: flex !important; flex-direction: column !important; align-items: stretch !important; gap: 2px !important; }
/* Fixed height: on mobile WebKit, rows containing icon-font glyphs can grow taller */
#stt-panel#stt-panel#stt-panel .stt-pv-item { display: flex !important; align-items: center !important; gap: 10px !important; height: 34px !important; padding: 0 10px !important; border-radius: 8px !important; font-size: .9em !important; overflow: hidden !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-item > * { flex: none !important; max-height: 34px !important; line-height: 1.25 !important; white-space: nowrap !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-item > span:last-child { flex: 1 1 auto !important; min-width: 0 !important; overflow: hidden !important; text-overflow: ellipsis !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-item + .stt-pv-item { border-top: 1px solid color-mix(in srgb, var(--stt-pv-line) 70%, transparent) !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-qr { display: flex !important; flex-wrap: wrap !important; gap: 6px !important; width: 100% !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-qr > span { padding: 4px 10px !important; font-size: .82em !important; white-space: nowrap !important; border: 1px solid color-mix(in srgb, var(--stt-pv-fg) 35%, transparent) !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-qr[data-style="pill"] > span { border-radius: 999px !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-qr[data-style="rounded"] > span { border-radius: 7px !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-qr[data-style="plain"] > span { border-color: transparent !important; background: none !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-qr[data-style="theme"] > span { border-radius: 4px !important; background: color-mix(in srgb, var(--stt-pv-fg) 10%, transparent) !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-home { display: flex !important; flex-direction: column !important; align-items: center !important; gap: 10px !important; width: 100% !important; text-align: center !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-clock-label { font-size: .7em !important; letter-spacing: .3em !important; opacity: .7 !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-clock-time { font-size: calc(40px * var(--stt-pv-scale, 1)) !important; line-height: 1 !important; font-variant-numeric: tabular-nums !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-clock-date { font-size: .75em !important; opacity: .75 !important; letter-spacing: .1em !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-search { width: min(100%, 300px) !important; height: 28px !important; border: 1px solid var(--stt-pv-line) !important; border-radius: 999px !important; font-size: .75em !important; display: flex !important; align-items: center !important; padding: 0 12px !important; opacity: .8 !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-favs { display: flex !important; gap: 10px !important; justify-content: center !important; flex-wrap: wrap !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-fav { width: 38px !important; height: 38px !important; border-radius: 50% !important; object-fit: cover !important; object-position: center top !important; background: color-mix(in srgb, var(--stt-pv-fg) 15%, transparent) !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-favs[data-style="card"] .stt-pv-fav { width: 44px !important; height: 58px !important; border-radius: 8px !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-fold { position: relative !important; height: 46px !important; padding: 0 !important; overflow: hidden !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-text { padding: 14px 16px !important; border: 1px solid var(--stt-border) !important; border-radius: 12px !important; background: var(--stt-wash) !important; }
/* The panel-wide font rule hits every element, so samples inherit from their wrapper (partial fonts are set inline and still win) */
#stt-panel#stt-panel#stt-panel :is(.stt-pv-text, .stt-pv-ui-line) :is(p, strong, em, span) { font-family: inherit !important; font-size: inherit !important; letter-spacing: inherit !important; -webkit-text-stroke: inherit !important; line-height: inherit !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-text p { margin: 0 0 .8em !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-text p:last-child { margin-bottom: 0 !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-ui-line { display: flex !important; align-items: center !important; gap: 10px !important; flex-wrap: wrap !important; }
#stt-panel#stt-panel#stt-panel .stt-pv-ui-line > span { padding: 5px 12px !important; border: 1px solid var(--stt-border) !important; border-radius: 8px !important; background: var(--stt-wash) !important; }
`;
  let preview = null, previewOpen = false, previewTimer = null, previewLang = 0;
  function createPreview() {
    const box = element('section', { class: 'stt-preview' });
    const head = element('div', { class: 'stt-preview-head' });
    const toggle = button('미리보기', () => { previewOpen = !previewOpen; syncPreviewOpen(); }, { class: 'stt-preview-toggle', 'aria-expanded': 'false' });
    const lang = element('div', { class: 'stt-preview-lang', role: 'group', 'aria-label': '예시문 언어' });
    const label = element('span', { 'aria-live': 'polite' });
    const step = d => { previewLang = (previewLang + d + PREVIEW_SAMPLES.length) % PREVIEW_SAMPLES.length; renderPreview(); };
    lang.append(button('‹', () => step(-1), { 'aria-label': '이전 언어' }), label, button('›', () => step(1), { 'aria-label': '다음 언어' }));
    head.append(toggle, lang);
    const body = element('div', { class: 'stt-preview-body' });
    box.append(head, body);
    preview = { box, toggle, lang, label, body };
    syncPreviewOpen();
    return box;
  }
  function syncPreviewOpen() {
    if (!preview) return;
    preview.toggle.setAttribute('aria-expanded', String(previewOpen));
    preview.body.hidden = !previewOpen;
    if (!previewOpen) { preview.lang.hidden = true; preview.body.replaceChildren(); return; }
    renderPreview();
  }
  function schedulePreview(event) {
    if (!previewOpen || !panel || preview?.box.contains(event?.target)) return;
    host.clearTimeout(previewTimer);
    previewTimer = host.setTimeout(() => { previewTimer = null; renderPreview(); }, 120);
  }
  function parseRgb(value) {
    const n = (value.match(/[\d.]+/g) || []).map(Number);
    return n.length >= 3 ? { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 } : null;
  }
  // A translucent background is layered over a base matched to the text color's brightness.
  function stageColors() {
    const probe = doc.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden';
    doc.body.append(probe);
    const read = name => { probe.style.color = `var(${name})`; return host.getComputedStyle(probe).color; };
    const fg = read('--SmartThemeBodyColor'), tint = read('--SmartThemeBlurTintColor'), line = read('--SmartThemeBorderColor');
    probe.remove();
    const f = parseRgb(fg) || { r: 220, g: 220, b: 220 };
    const lightText = (0.2126 * f.r + 0.7152 * f.g + 0.0722 * f.b) / 255 > 0.5;
    return { '--stt-pv-fg': fg, '--stt-pv-tint': tint, '--stt-pv-line': line, '--stt-pv-base': lightText ? '#1b1b1d' : '#f4f4f2' };
  }
  function stage(extraClass = '') {
    const node = element('div', { class: `stt-pv-stage ${extraClass}`.trim() });
    for (const [name, value] of Object.entries(preview.colors)) node.style.setProperty(name, value);
    return node;
  }
  // Reads the unsaved draft, not the applied settings.
  function draftItems(area) {
    const settings = effective(draft);
    return ordered(area, settings).map(record => ({ record, config: settings.areas[area].items[record.key] || {} })).filter(({ config }) => !config.hidden);
  }
  // Original icons that aren't icon-font glyphs (images, custom shapes) can't be copied, so a small name chip stands in.
  function pvIcon(record, config, fallbackColor = '') {
    let icon = iconPreview(config.icon, record.originalIcon);
    if (icon.classList.contains('stt-icon-blank') && config.icon !== 'none') icon = element('span', { class: 'stt-pv-chip', title: record.name }, record.name);
    const color = config.color || fallbackColor;
    if (color && (config.colorTarget || 'both') !== 'label') icon.style.setProperty('color', color, 'important');
    return icon;
  }
  function pvLabel(record, config, area) {
    const span = element('span', {}, NAMED_AREAS.has(area) && config.alias ? config.alias : record.name);
    if (config.color && (config.colorTarget || 'both') !== 'icon') span.style.setProperty('color', config.color, 'important');
    if (area === 'extensions') span.style.setProperty('font-weight', config.fontWeight === 'normal' ? '400' : '700', 'important');
    return span;
  }
  const pvNote = text => element('p', { class: 'stt-pv-note' }, text);
  const pvLabelLine = text => element('p', { class: 'stt-pv-label' }, text);
  function previewIconRow(area, center = true) {
    const row = stage(center ? 'stt-pv-center' : '');
    const items = draftItems(area);
    for (const { record, config } of items) {
      const btn = element('span', { class: 'stt-pv-btn', title: record.name });
      btn.append(pvIcon(record, config));
      row.append(btn);
    }
    if (!items.length) row.append(pvNote('보이는 항목이 없습니다.'));
    return row;
  }
  function previewMenu(area) {
    const list = stage(area === 'extensions' ? 'stt-pv-list stt-pv-cols' : 'stt-pv-list');
    const items = draftItems(area);
    for (const { record, config } of items.slice(0, 30)) {
      const row = element('div', { class: 'stt-pv-item' });
      if (area !== 'extensions' || config.icon) row.append(pvIcon(record, config));
      row.append(pvLabel(record, config, area));
      list.append(row);
    }
    if (!items.length) list.append(pvNote('보이는 항목이 없습니다.'));
    return list;
  }
  function previewInput() {
    const settings = effective(draft);
    const mobile = compactPanel() && settings.inputLayoutMobile;
    const layout = mobile || settings.inputLayout;
    const bar = stage();
    const style = settings.inputStyle;
    if (style.buttonSize) bar.style.setProperty('--stt-pv-size', `${style.buttonSize}px`);
    if (style.iconSize) bar.style.setProperty('--stt-pv-icon', `${style.iconSize}px`);
    if (style.gap !== null) bar.style.setProperty('column-gap', `${style.gap}px`, 'important');
    const button = ({ record, config }) => {
      const btn = element('span', { class: 'stt-pv-btn', title: record.name });
      btn.append(pvIcon(record, config, style.color));
      return btn;
    };
    const items = draftItems('input');
    const left = items.filter(({ record, config }) => (config.side || record.side) !== 'right').map(button);
    const right = items.filter(({ record, config }) => (config.side || record.side) === 'right').map(button);
    const field = element('span', { class: 'stt-pv-field' }, '입력칸');
    if (layout.rows === 'double') {
      const gap = element('span', { class: 'stt-pv-gap' });
      if (layout.position === 'bottom') bar.append(...left, gap, ...right, element('span', { class: 'stt-pv-rowbreak' }), field);
      else bar.append(field, element('span', { class: 'stt-pv-rowbreak' }), ...left, gap, ...right);
      field.style.setProperty('flex-basis', '100%', 'important');
    } else bar.append(...left, field, ...right);
    const out = [bar];
    if (layout.rows === 'theme') out.push(pvNote('줄 구성은 테마 그대로 · 순서와 좌우 위치만 바뀝니다.'));
    return out;
  }
  function previewQr() {
    const qr = effective(draft).qr;
    const bar = stage();
    const found = [...doc.querySelectorAll('#qr--bar .qr--buttons')].filter(n => !n.querySelector('.qr--buttons'))
      .map(set => [...set.querySelectorAll('.qr--button')].map(b => (b.querySelector('.qr--button-label')?.textContent || b.textContent || '').trim()).filter(Boolean)).filter(set => set.length);
    const sets = found.length ? found : [['인사', '계속', '요약'], ['장면 전환', '묘사']];
    const rows = qr.layout === 'sets' ? sets : [sets.flat()];
    for (const labels of rows) {
      const row = element('div', { class: 'stt-pv-qr', 'data-style': qr.style });
      row.style.setProperty('justify-content', qr.align === 'left' ? 'flex-start' : qr.align === 'right' ? 'flex-end' : 'center', 'important');
      for (const text of labels.slice(0, 12)) row.append(element('span', {}, text));
      bar.append(row);
    }
    return bar;
  }
  function previewHome() {
    const home = effective(draft).home, clock = home.clock;
    const box = stage();
    const wrap = element('div', { class: 'stt-pv-home' });
    if (clock.enabled) {
      const now = new Date(); let h = now.getHours(); const m = String(now.getMinutes()).padStart(2, '0');
      let ampm = ''; if (clock.hour12) { ampm = h < 12 ? ' AM' : ' PM'; h = h % 12 || 12; }
      if (clock.label) wrap.append(element('div', { class: 'stt-pv-clock-label' }, clock.label));
      const time = element('div', { class: 'stt-pv-clock-time' }, `${String(h).padStart(2, '0')}:${m}${ampm}`);
      time.style.setProperty('--stt-pv-scale', String(clock.size / 100));
      if (clock.font) time.style.setProperty('font-family', fontController.stack(clock.font), 'important');
      wrap.append(time);
      if (clock.date) wrap.append(element('div', { class: 'stt-pv-clock-date' }, `${now.getMonth() + 1}월 ${now.getDate()}일 · ${'일월화수목금토'[now.getDay()]}`));
    }
    if (home.search) wrap.append(element('div', { class: 'stt-pv-search' }, '캐릭터 검색'));
    if (home.favorites.enabled) {
      const favs = element('div', { class: 'stt-pv-favs', 'data-style': home.favorites.style });
      const ctx = context();
      const list = (ctx?.characters || []).filter(c => c?.fav === true || c?.fav === 'true' || c?.data?.extensions?.fav).slice(0, 6);
      const thumb = file => ctx?.getThumbnailUrl ? ctx.getThumbnailUrl('avatar', file) : `/thumbnail?type=avatar&file=${encodeURIComponent(file)}`;
      for (const ch of list.length ? list : [{}, {}, {}]) {
        const img = element(ch.avatar ? 'img' : 'span', { class: 'stt-pv-fav', alt: '' });
        if (ch.avatar) { img.src = thumb(ch.avatar); img.loading = 'lazy'; }
        favs.append(img);
      }
      wrap.append(favs);
    }
    if (!wrap.childElementCount) wrap.append(pvNote('시계 · 캐릭터 바로가기가 꺼져 있습니다.'));
    box.append(wrap);
    return [box];
  }
  function previewTopbar() {
    const out = [pvLabelLine('펼친 상단바'), previewIconRow('topbar')];
    const fold = effective(draft).topbarFold;
    if (fold.mode !== 'off') {
      out.push(pvLabelLine('접혔을 때'));
      const strip = stage('stt-pv-fold');
      strip.style.setProperty('--stt-fold-ink', fold.color || foldInkFor(preview.colors['--stt-pv-tint']));
      const mock = element('span', { class: 'stt-topbar-fold', 'data-look': fold.look, 'aria-expanded': 'false', 'aria-hidden': 'true' });
      mock.append(element('span'));
      strip.append(mock);
      out.push(strip);
    }
    return out;
  }
  // Font sample: ignores the theme and applies only font, size, line height, weight, spacing and partial fonts.
  function previewFonts() {
    const fonts = effective(draft).fonts;
    const [lang, , paragraphs] = PREVIEW_SAMPLES[previewLang];
    // Theme fonts measured with our fonts off, so a changed UI font doesn't bleed into the chat sample.
    const theme = fontController.themeFamilies();
    const themeChat = theme.chatFamily, themeUi = theme.uiFamily;
    const familyOf = (group, theme) => {
      const id = (lang !== 'ko' && group.langs?.[lang]) || group.family;
      return id ? fontController.stack(id) : theme;
    };
    const apply = (node, group, theme, baseSize, baseLine) => {
      node.style.setProperty('font-family', familyOf(group, theme), 'important');
      node.style.setProperty('font-size', `${baseSize * group.size / 100}px`, 'important');
      if (baseLine) node.style.setProperty('line-height', String(baseLine * group.lineHeight / 100), 'important');
      if (group.stroke !== null) node.style.setProperty('-webkit-text-stroke', `${group.stroke / 10}px currentColor`, 'important');
      if (group.spacing !== null) node.style.setProperty('letter-spacing', `${group.spacing / 100}em`, 'important');
    };
    const ui = element('div', { class: 'stt-pv-ui-line' });
    ui.append(element('span', {}, 'UI 글꼴 · 설정 · 메뉴'), element('span', {}, 'Aa 가나다 あいう 漢字'));
    apply(ui, fonts.ui, themeUi, 14, 0);
    const text = element('div', { class: 'stt-pv-text' });
    apply(text, fonts.chat, themeChat, 15, 1.7);
    const marks = fonts.marks.filter(markUsed);
    const custom = marks.filter(m => m.open);
    const quote = marks.find(m => m.id === 'quote'), corner = marks.find(m => m.id === 'corner');
    const markOf = token => token.startsWith('「') || token.startsWith('『') ? corner
      : /^[“"]/.test(token) ? quote : custom.find(m => token.startsWith(m.open) && token.endsWith(m.close));
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp([`“[^”\\n]*”`, `"[^"\\n]*"`, `「[^」\\n]*」`, `『[^』\\n]*』`, ...custom.map(m => `${esc(m.open)}[^\\n]+?${esc(m.close)}`)].join('|'), 'g');
    const inline = (parent, source) => {
      // Only **bold** and *italic* are parsed.
      for (const part of source.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)) {
        if (!part) continue;
        if (part.startsWith('**')) { const b = element('strong'); markRun(b, part.slice(2, -2)); parent.append(b); }
        else if (part.startsWith('*')) { const i = element('em'); markRun(i, part.slice(1, -1)); parent.append(i); }
        else markRun(parent, part);
      }
    };
    const markRun = (parent, source) => {
      let last = 0;
      for (const m of source.matchAll(pattern)) {
        if (m.index > last) parent.append(source.slice(last, m.index));
        const mark = markOf(m[0]);
        const span = element('span', {}, m[0]);
        if (mark) {
          if (mark.family) span.style.setProperty('font-family', fontController.stack(mark.family), 'important');
          if (mark.size !== 100) span.style.setProperty('font-size', `${mark.size / 100}em`, 'important');
          if (mark.stroke !== null) span.style.setProperty('-webkit-text-stroke', `${mark.stroke / 10}px currentColor`, 'important');
          if (mark.spacing !== null) span.style.setProperty('letter-spacing', `${mark.spacing / 100}em`, 'important');
          if (mark.fade > 0) span.style.setProperty('opacity', String((100 - mark.fade) / 100), 'important');
        }
        parent.append(span);
        last = m.index + m[0].length;
      }
      if (last < source.length) parent.append(source.slice(last));
    };
    for (const source of paragraphs) { const p = element('p'); inline(p, source); text.append(p); }
    if (custom.length) { const p = element('p'); inline(p, custom.map(m => `${m.open}${lang === 'ko' ? '직접 정한 규칙' : 'custom rule'}${m.close}`).join(' ')); text.append(p); }
    return [ui, text];
  }
  function renderPreview() {
    if (!preview || !previewOpen || !panel || !draft) return;
    preview.lang.hidden = selectedArea !== 'fonts';
    preview.label.textContent = PREVIEW_SAMPLES[previewLang][1];
    preview.colors = stageColors();
    let nodes = [];
    try {
      if (selectedArea === 'fonts') nodes = previewFonts();
      else if (selectedArea === 'home') nodes = previewHome();
      else if (selectedArea === 'topbar') nodes = previewTopbar();
      else if (selectedArea === 'input') nodes = previewInput();
      else if (selectedArea === 'qr') nodes = [previewQr()];
      else if (selectedArea === 'messages') nodes = [previewIconRow('messages', false)];
      else if (selectedArea === 'wand' || selectedArea === 'extensions') nodes = [previewMenu(selectedArea)];
    } catch (error) {
      console.warn('[ST Tailor] Preview failed', error);
      nodes = [pvNote('미리보기를 그리지 못했습니다.')];
    }
    if (draft.disabled) nodes.unshift(pvNote('재단사 전체가 꺼져 있어 실제 화면에는 적용되지 않습니다.'));
    else if (draft.off?.[selectedArea]) nodes.unshift(pvNote('이 탭은 꺼져 있어 실제 화면에는 적용되지 않습니다.'));
    preview.body.replaceChildren(...nodes);
  }

  function renderPanelBody() {
    if (!panel) return;
    closeTips();
    const content = panel.querySelector('.stt-content');
    const switched = content.dataset.sttArea !== selectedArea;
    if (switched) content.dataset.sttArea = selectedArea;
    const common = panel.querySelector('[data-stt-common]'); common.replaceChildren();
    const live = panel.querySelector('[data-stt-live]'); if (live) live.textContent = '';
    if (draft.disabled) common.append(element('p', { class: 'stt-off-note', role: 'note' }, '재단사 전체가 꺼져 있습니다. 설정은 그대로 남아 있고, 다시 켜고 저장하면 적용됩니다.'));
    else if (draft.off?.[selectedArea]) common.append(element('p', { class: 'stt-off-note', role: 'note' }, '이 탭은 꺼져 있습니다. 설정은 그대로 남아 있고, 다시 켜면 적용됩니다.'));
    renderAreaToggle();
    renderInputStyle(common);
    if (selectedArea === 'messages') renderMessageOptions(common);
    if (selectedArea === 'topbar') renderTopbarFold(common);
    for (const node of panel.querySelectorAll('.stt-toolbar,.stt-editor')) node.hidden = FORM_TABS.has(selectedArea);
    if (selectedArea === 'qr') renderQrSettings(common);
    if (selectedArea === 'fonts') renderFontSettings(common);
    if (selectedArea === 'home') renderHomeSettings(common);
    renderList();
    if (FORM_TABS.has(selectedArea)) positionDetail();
    if (switched) renderPreview();
    if (switched) {
      // A scrolled, long tab must not lend its offset to the new (shorter) tab.
      // Reset after rendering so the browser sees the new scroll extent. Do not
      // reset during ordinary field edits, and never scroll the page or tab bar.
      for (const node of [content, panel.querySelector('[data-stt-list]'), panel.querySelector('[data-stt-detail]'), panel]) {
        if (node) node.scrollTop = 0;
      }
    }
  }

  function closePanel(save = false) {
    if (!panel) return;
    preview = null; host.clearTimeout(previewTimer); previewTimer = null;
    if (save) {
      try { const value = normalize(draft); persist(value); saved = value; }
      catch (error) { report(error.message, true); return; }
      if (recentDraft) void writeRecentCounts(recentDraft);
    } else if (recentDraft) showFolded(recentDraft.base.folded);
    recentDraft = null;
    const revertStyle = !save && draft && (effective(draft).iconStyle || 'auto') !== (appliedSettings().iconStyle || 'auto');
    const old = panel; panel = null; draft = null; styleToggle = null; areaToggle = null;
    if (typeof old.close === 'function' && old.open) old.close();
    old.remove(); created.delete(old);
    if (save || revertStyle) refresh(false);
    else { const applied = appliedSettings(); fontController.sync(applied.fonts); homeController.sync(applied.home, applied.fonts); topbarFold.sync(applied.topbarFold); inputTextController.sync(applied.inputText); }
    if (returnFocus?.isConnected) returnFocus.focus?.();
  }

  let styleToggle = null;
  // Per-area toggle pauses the area's changes without clearing its settings (applies on save; fonts and home preview live).
  let areaToggle = null;
  const areaLabel = id => id === 'home' ? '홈 화면' : id === 'qr' ? 'QR 바' : id === 'fonts' ? '글꼴' : AREAS[id];
  function renderAreaToggle() {
    if (!areaToggle || !draft) return;
    const off = !!draft.off?.[selectedArea];
    areaToggle.textContent = off ? '이 탭 켜기' : '이 탭 끄기';
    areaToggle.setAttribute('aria-pressed', String(off));
    areaToggle.title = off ? `${areaLabel(selectedArea)}: 꺼 둔 설정을 다시 적용` : `${areaLabel(selectedArea)}: 설정은 그대로 두고 잠시 끄기`;
  }
  function toggleArea() {
    if (!draft) return;
    const off = { ...(draft.off || {}) };
    if (off[selectedArea]) delete off[selectedArea]; else off[selectedArea] = true;
    draft.off = off;
    if (selectedArea === 'fonts' || selectedArea === 'home') previewDraft();
    renderPanelBody();
  }
  function renderStyleToggle() {
    if (!styleToggle || !draft) return;
    const mode = draft.iconStyle || 'auto';
    const label = `아이콘 모양 · ${ICON_STYLE_LABELS[mode]}`;
    // Sample glyph in the current style (Font Awesome icons / Phosphor shapes).
    const sample = iconPreview('fa-solid fa-icons');
    const text = element('span', { class: 'stt-style-text' });
    text.append(element('span', { class: 'stt-style-long' }, label), element('span', { class: 'stt-style-short' }, `아이콘 · ${ICON_STYLE_SHORT[mode]}`));
    styleToggle.replaceChildren(sample, text);
    styleToggle.setAttribute('aria-label', label);
    styleToggle.title = `${label} — 실리태번 아이콘 모양만 바꿉니다. 누를 때마다 테마 따름 → Font Awesome → Phosphor (저장하면 고정, 취소하면 원래대로)`;
  }
  function cycleIconStyle() {
    if (!draft) return;
    const now = ICON_STYLES.indexOf(draft.iconStyle || 'auto');
    draft.iconStyle = ICON_STYLES[(now + 1) % ICON_STYLES.length];
    refresh(false);
    renderPanelBody();
    renderStyleToggle();
  }

  function openPanel() {
    if (!ready || dead) return;
    if (panel) { panel.querySelector('input')?.focus(); return; }
    refresh(false, true); draft = clone(saved); recentDraft = { base: readRecentCounts() }; recentDraft.value = { ...recentDraft.base }; selectedArea = 'home'; selectedKey = null; expandedKey = null; query = ''; returnFocus = doc.activeElement;
    panel = own(element('dialog', { id: 'stt-panel', 'aria-labelledby': 'stt-panel-title', 'aria-modal': 'true', tabindex: '-1' }));
    panel.style.setProperty('--stt-ui-font', host.getComputedStyle(doc.body).fontFamily);
    const header = element('header', { class: 'stt-header' });
    const brand = element('div', { class: 'stt-brand' });
    const logo = element('span', { class: 'stt-logo', 'aria-hidden': 'true' });
    logo.append(iconPreview('fa-solid fa-scissors'));
    const heading = element('div'); heading.append(element('h2', { id: 'stt-panel-title' }, '실리태번 재단사'), element('span', { class: 'stt-version' }, VERSION));
    brand.append(logo, heading);
    styleToggle = button('', cycleIconStyle, { class: 'stt-style-toggle' });
    // Master toggle pauses applying without clearing settings (fonts, home and top-bar fold preview live; the rest applies on save).
    // Styled like the per-tab toggle: subtle while on, orange while off.
    const master = button('', () => { draft.disabled = !draft.disabled; syncMaster(); previewDraft(); renderPanelBody(); }, { class: 'stt-master' });
    const syncMaster = () => {
      const off = !!draft.disabled;
      const label = off ? '재단사 전체 켜기' : '재단사 전체 끄기';
      master.replaceChildren(iconPreview('fa-solid fa-power-off'), element('span', { class: 'stt-master-text' }, off ? '전체 켜기' : '전체 끄기'));
      master.setAttribute('aria-pressed', String(off));
      master.setAttribute('aria-label', label);
      master.title = off ? '재단사가 꺼져 있습니다 · 누르면 다시 켬 (저장하면 적용)' : '설정은 그대로 두고 재단사 전체를 잠시 끔 (저장하면 적용)';
    };
    syncMaster();
    header.append(brand, styleToggle, master);
    renderStyleToggle();
    panel.append(header);
    const tabs = element('nav', { class: 'stt-tabs', role: 'tablist', 'aria-label': '편집 탭' });
    const reveal = tab => {
      const bar = tabs.getBoundingClientRect(), box = tab.getBoundingClientRect();
      if (box.left < bar.left) tabs.scrollBy({ left: box.left - bar.left - 12, behavior: 'smooth' });
      else if (box.right > bar.right) tabs.scrollBy({ left: box.right - bar.right + 12, behavior: 'smooth' });
    };
    for (const id of TAB_IDS) tabs.append(button(areaLabel(id), event => { reveal(event.currentTarget); selectedArea = id; selectedKey = null; expandedKey = null; query = ''; panel.querySelector('[data-stt-search]').value = ''; renderPanelBody(); }, { role: 'tab', 'data-stt-tab': id, 'aria-selected': String(id === selectedArea) }));
    tabs.addEventListener('scroll', updateTabFade, { passive: true });
    panel.append(tabs);
    const content = element('div', { class: 'stt-content' });
    content.append(createPreview(), element('div', { 'data-stt-common': '' }));
    const toolbar = element('div', { class: 'stt-toolbar' });
    const search = element('input', { type: 'search', placeholder: '이름으로 항목 찾기', 'data-stt-search': '', 'aria-label': '항목 검색', value: query });
    search.addEventListener('input', () => { query = search.value; renderList(false); });
    toolbar.append(search, button('목록 새로고침', () => { loadIcons(); refresh(false); renderPanelBody(); }));
    const editor = element('div', { class: 'stt-editor' });
    editor.append(toolbar, element('div', { class: 'stt-list', 'data-stt-list': '', 'aria-label': '편집할 항목' }), element('section', { class: 'stt-detail', 'data-stt-detail': '', 'aria-label': '선택한 항목 설정' }));
    content.append(editor); panel.append(content);
    const footer = element('footer', { class: 'stt-footer' });
    const utilities = element('div', { class: 'stt-utilities' });
    // Reset needs a second press within 3 s; the button label confirms instead of a dialog.
    let resetArmed = 0;
    const resetAll = button('전체 초기화', () => {
      if (!resetArmed) {
        resetAll.textContent = '다시 눌러 확인'; resetAll.setAttribute('data-armed', '');
        resetArmed = host.setTimeout(() => { resetArmed = 0; resetAll.textContent = '전체 초기화'; resetAll.removeAttribute('data-armed'); }, 3000);
        return;
      }
      host.clearTimeout(resetArmed); resetArmed = 0;
      resetAll.textContent = '전체 초기화'; resetAll.removeAttribute('data-armed');
      draft = defaults(); previewDraft(); renderPanelBody();
    }, { class: 'stt-danger' });
    areaToggle = button('', toggleArea, { class: 'stt-area-toggle' });
    utilities.append(areaToggle, button('이 탭 초기화', () => {
      if (selectedArea === 'qr') draft.qr = defaults().qr;
      else if (selectedArea === 'home') { draft.home = defaults().home; previewDraft(); }
      else if (selectedArea === 'fonts') {
        if (draft.home.clock.font.startsWith(CUSTOM_PREFIX)) draft.home.clock.font = '';
        draft.fonts = defaults().fonts; previewDraft();
      }
      else draft.areas[selectedArea] = defaults().areas[selectedArea];
      if (selectedArea === 'input') { draft.inputStyle = defaults().inputStyle; draft.inputLayout = defaults().inputLayout; draft.inputLayoutMobile = null; }
      renderPanelBody();
    }), resetAll);
    const save = element('div', { class: 'stt-save-actions' });
    save.append(button('취소', () => closePanel(false)), button('저장 후 닫기', () => closePanel(true), { class: 'stt-primary' }));
    footer.append(utilities, save); panel.append(element('p', { class: 'stt-live', 'data-stt-live': '', role: 'status', 'aria-live': 'polite' }), footer);
    bindTips(panel);
    panel.addEventListener('cancel', event => { event.preventDefault(); closePanel(false); });
    const dialog = panel;
    panel.addEventListener('close', () => { if (panel === dialog) closePanel(false); });
    doc.body.append(panel);
    if (typeof panel.showModal === 'function') panel.showModal(); else panel.setAttribute('open', '');
    // Capture phase: list buttons stop propagation. The preview runs slightly later, so it reads the updated draft.
    for (const type of ['input', 'change', 'click', 'drop', 'keyup']) panel.addEventListener(type, schedulePreview, true);
    renderPanelBody();
    if (!compactPanel() && !search.closest('[hidden]')) search.focus(); else panel.focus();
  }

  function installEntryPoints() {
    const wand = doc.getElementById('extensionsMenu');
    if (wand && !doc.getElementById('stt-open-wand')) {
      const button = own(element('div', { id: 'stt-open-wand', class: 'list-group-item flex-container flexGap5 interactable', role: 'button', tabindex: '0', title: '실리태번 재단사 열기' }));
      button.append(element('i', { class: 'fa-solid fa-scissors', 'aria-hidden': 'true' }), element('span', {}, '실리태번 재단사'));
      button.addEventListener('click', openPanel);
      button.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(); } });
      wand.append(button);
    }
  }

  function dispose() {
    if (dead) return;
    dead = true;
    wandObserver?.disconnect();
    host.clearTimeout(initTimer); host.clearTimeout(refreshTimer); host.clearTimeout(fontTimer); host.clearInterval(pollingTimer); host.clearTimeout(pollSoon); pollWatcher?.disconnect(); pollWatcher = null;
    host.cancelAnimationFrame(wandFrame); host.clearTimeout(wandTimer); host.clearTimeout(messageTimer);
    wandFrame = 0; wandTimer = null; messageTimer = null;
    for (const timer of rowTimers) host.clearTimeout(timer);
    rowTimers = [];
    for (const unsubscribe of unsubscribers) { try { unsubscribe(); } catch {  } }
    unsubscribers = [];
    inputLayoutController.dispose();
    qrController.dispose();
    fontController.dispose();
    homeController.dispose();
    topbarFold.dispose();
    inputTextController.dispose();
    rollback();
    for (const node of created) node.remove();
    panel?.remove(); panel = null;
    if (host[GLOBAL] === api) delete host[GLOBAL];
    window.removeEventListener('pagehide', dispose);
  }

  let initAttempts = 0;
  function start() {
    if (dead) return;
    if (!doc.body || !context()) {
      // Every tick spent waiting for ST is a tick of ST's own menus on screen
      // before the customisation lands, so poll tightly for the first second
      // and only then back off.
      initTimer = host.setTimeout(start, initAttempts++ < 40 ? 25 : 250);
      return;
    }
    // With both builds installed only the extension runs; they share settings storage.
    if (KIND === 'script' && host[GLOBAL]?.kind === 'extension') {
      dead = true;
      console.info('[ST Tailor] 확장판이 실행 중이라 스크립트판은 동작하지 않습니다.');
      return;
    }
    host[GLOBAL]?.dispose?.();
    host[GLOBAL] = api;
    saved = readSettings();
    const stylesheet = own(element('style', { id: 'stt-style' })); stylesheet.textContent = PANEL_CSS + FONT_PANEL_CSS + PREVIEW_PANEL_CSS + FOLD_INDICATOR_CSS + foldMockCss(); doc.head.append(stylesheet);
    loadIcons(true, true);
    host.addEventListener('resize', positionDetail);
    unsubscribers.push(() => host.removeEventListener('resize', positionDetail));
    doc.addEventListener('click', onMessageButtonClick, true);
    // Skip the single focus() SillyTavern calls on the message editor right after the edit button is pressed.
    // It must be blocked before focus lands: blurring afterwards can leave iOS with a viewport shrunk for a keyboard that never shows.
    // Tapping the field directly isn't a focus() call, so the keyboard still opens then.
    let skipEditFocus = 0;
    const textareaProto = host.HTMLTextAreaElement?.prototype;
    const nativeFocus = textareaProto?.focus;
    if (nativeFocus) {
      const guardedFocus = function (...args) {
        if (this.id === 'curEditTextarea' && Date.now() < skipEditFocus) { skipEditFocus = 0; return; }
        return nativeFocus.apply(this, args);
      };
      textareaProto.focus = guardedFocus;
      unsubscribers.push(() => { if (textareaProto.focus === guardedFocus) textareaProto.focus = nativeFocus; });
    }
    const onEditClick = event => {
      if (appliedSettings().editAutoFocus === false && event.target.closest?.('.mes_edit')) skipEditFocus = Date.now() + 1500;
    };
    doc.addEventListener('click', onEditClick, true);
    unsubscribers.push(() => doc.removeEventListener('click', onEditClick, true));
    unsubscribers.push(() => doc.removeEventListener('click', onMessageButtonClick, true));
    ready = true;
    checkRecentSupport();
    settleUntil = Date.now() + SETTLE_BOOT_MS;
    // requestAnimationFrame stalls while the page isn't painting (a busy phone, scrolling,
    // returning to the tab), which could leave the original wand menu on screen until a
    // later frame. Pair it with a timer so the check always lands.
    const runWandCheck = () => {
      host.cancelAnimationFrame(wandFrame);
      host.clearTimeout(wandTimer);
      wandFrame = 0; wandTimer = null;
      if (dead || refreshing) return;
      beginPass();
      if (wandDrifted() || !sameSnapshot(snapshotSources(), sourceSnapshot)) refresh(false);
    };
    // The fade-in rewrites only the menu's own style every frame; ignore it unless display changed.
    let wandDisplay = null;
    if (host.MutationObserver) wandObserver = new host.MutationObserver(records => {
      const menu = doc.getElementById('extensionsMenu');
      if (menu && records.every(record => record.type === 'attributes' && record.attributeName === 'style' && record.target === menu)) {
        if (menu.style.display === wandDisplay) return;
        wandDisplay = menu.style.display;
      }
      if (dead || refreshing || wandFrame || wandTimer) return;
      wandFrame = host.requestAnimationFrame(runWandCheck);
      wandTimer = host.setTimeout(runWandCheck, 120);
    });
    installEntryPoints(); installPlatformUi(); refresh();
    const layoutQuery = host.matchMedia?.(MOBILE_LAYOUT_QUERY);
    if (layoutQuery?.addEventListener) {
      const onLayoutQuery = () => schedule();
      layoutQuery.addEventListener('change', onLayoutQuery);
      unsubscribers.push(() => layoutQuery.removeEventListener('change', onLayoutQuery));
    }
    fontTimer = host.setTimeout(() => { if (!dead) loadIcons(false); }, 1500);
    // Fired on every settings save; skip the full reapply when theme, menu and buttons are unchanged.
    const onSettingsUpdated = () => {
      if (dead || !ready) return;
      if (!refreshing && !refreshTimer) {
        try {
          beginPass();
          const themeVersion = iconThemeVersion;
          iconThemeKey();
          if (themeVersion === iconThemeVersion && faceSignatureNow() === faceSignature && !wandDrifted() && sameSnapshot(snapshotSources(), sourceSnapshot)) {
            fontController.sync(liveSettings().fonts);
            return;
          }
        } catch { /* fall through to a full refresh */ }
      }
      schedule();
    };
    const ctx = context();
    for (const name of ['CHARACTER_EDITED', 'CHARACTER_DELETED', 'CHARACTER_RENAMED', 'CHARACTER_PAGE_LOADED']) {
      const type = ctx.event_types?.[name];
      const handler = () => host.setTimeout(() => homeController.favoritesChanged(), 50);
      if (type && ctx.eventSource?.on) { ctx.eventSource.on(type, handler); unsubscribers.push(() => ctx.eventSource.removeListener?.(type, handler)); }
    }
    const MESSAGE_EVENTS = new Set(['USER_MESSAGE_RENDERED', 'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'GENERATION_STARTED', 'GENERATION_ENDED']);
    for (const name of ['APP_READY', 'CHAT_CHANGED', 'USER_MESSAGE_RENDERED', 'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'SETTINGS_UPDATED', 'GENERATION_STARTED', 'GENERATION_ENDED']) {
      const type = ctx.event_types?.[name];
      const handler = MESSAGE_EVENTS.has(name) ? () => { refreshMessages(); fontController.sync(liveSettings().fonts); }
        : name === 'CHAT_CHANGED' || name === 'APP_READY'
          ? () => { settleUntil = Math.max(settleUntil, Date.now() + SETTLE_ENTRY_MS); schedule(); }
          : onSettingsUpdated;
      if (type && ctx.eventSource?.on) { ctx.eventSource.on(type, handler); unsubscribers.push(() => ctx.eventSource.removeListener?.(type, handler)); }
    }
    if (ctx.SlashCommandParser?.addCommandObject && ctx.SlashCommand?.fromProps && !ctx.SlashCommandParser.commands?.['st-tailor']) {
      const command = ctx.SlashCommand.fromProps({ name: 'st-tailor', callback: () => { openPanel(); return ''; }, helpString: '실리태번 재단사 설정창을 엽니다.' });
      ctx.SlashCommandParser.addCommandObject(command);
      unsubscribers.push(() => { if (ctx.SlashCommandParser.commands?.['st-tailor'] === command) delete ctx.SlashCommandParser.commands['st-tailor']; });
    }
  }

  const api = {
    version: VERSION, kind: KIND, open: () => openPanel(), refresh: () => refresh(true, true), dispose,
    getSettings: () => clone(editableSettings()),
    getItems: area => (records[area] || []).map(r => ({ key: r.key, name: r.name, side: r.side, state: clone(r.state), originalIcon: r.originalIcon })),
    importSettings: raw => { const value = normalize(raw); if (draft) { draft = value; renderPanelBody(); } else { persist(value); saved = value; refresh(); } },
  };
  window.addEventListener('pagehide', dispose, { once: true });
  start();
})();
