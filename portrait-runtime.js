(() => {
  'use strict';
  const fallback = __PORTRAIT_MANIFEST__;
  let manifest = fallback;
  const bases = ['https://raw.githubusercontent.com/Jzilan/doupo/main/', 'https://cdn.jsdelivr.net/gh/Jzilan/doupo@main/'];
  const normal = name => String(name || '').normalize('NFC').replace(/[\s\u200B-\u200D\uFEFF]/gu, '').trim();
  const canonical = name => manifest.aliases[normal(name)] || normal(name);
  const list = name => manifest.characters[canonical(name)] || [];
  const key = name => 'doupo-portrait-v1:' + canonical(name);
  const choices = new Map();
  const index = name => { let n = choices.get(key(name)) || 0; try { n = Number(localStorage.getItem(key(name))) || n; } catch (_) {} return Math.max(0, n) % Math.max(1, list(name).length); };
  const path = name => list(name)[index(name)] || '';
  const url = name => path(name) ? bases[0] + path(name) : '';
  function paint(img, name) {
    const file = path(name);
    img.dataset.portraitName = name;
    if (!file) { img.hidden = true; img.removeAttribute('src'); return; }
    if (img.dataset.portraitPath === file) return;
    img.dataset.portraitPath = file;
    img.hidden = false;
    img.alt = name + '立绘';
    img.loading = 'lazy';
    img.decoding = 'async';
    let attempt = 0;
    img.onerror = () => {
      if (++attempt < bases.length) img.src = bases[attempt] + file;
      else { img.hidden = true; img.dispatchEvent(new CustomEvent('portrait-failed', { bubbles: true })); }
    };
    img.src = bases[0] + file;
  }
  function refresh() {
    document.querySelectorAll('img[data-portrait-name]').forEach(img => paint(img, img.dataset.portraitName));
    document.querySelectorAll('[data-portrait-gallery]').forEach(node => {
      const name = node.dataset.portraitGallery;
      node.querySelector('[data-portrait-count]').textContent = (index(name) + 1) + ' / ' + list(name).length;
    });
    window.dispatchEvent(new Event('doupo-portrait-change'));
  }
  function select(name, step) {
    const count = list(name).length;
    if (!count) return;
    const next = (index(name) + step + count) % count;
    choices.set(key(name), next);
    try { localStorage.setItem(key(name), String(next)); } catch (_) {}
    refresh();
  }
  function mount(node, name) {
    if (!node || !list(name).length) return;
    node.dataset.portraitGallery = name;
    node.classList.add('dp-portrait');
    const img = document.createElement('img');
    paint(img, name);
    const nav = document.createElement('div'); nav.className = 'dp-portrait-nav';
    const count = document.createElement('span'); count.dataset.portraitCount = ''; count.setAttribute('aria-live', 'polite');
    count.textContent = (index(name) + 1) + ' / ' + list(name).length;
    for (const [step, label] of [[-1, '上一张'], [1, '下一张']]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = step < 0 ? '‹' : '›';
      button.setAttribute('aria-label', name + label); button.disabled = list(name).length < 2;
      button.addEventListener('click', () => select(name, step));
      if (step < 0) nav.append(button, count); else nav.append(button);
    }
    node.replaceChildren(img, nav);
    node.addEventListener('portrait-failed', () => { count.textContent = '图片暂未加载'; });
  }
  window.addEventListener('storage', event => { if (event.key?.startsWith('doupo-portrait-v1:')) { choices.delete(event.key); refresh(); } });
  window.DoupoPortraits = { canonical, list, url, paint, mount, select };
  (async () => {
    for (const base of bases) {
      try {
        const response = await fetch(base + 'portraits/manifest.json', { signal: AbortSignal.timeout(6000) });
        if (!response.ok) continue;
        const data = await response.json();
        if (data.version !== 1 || !data.characters || !data.aliases) continue;
        const valid = Object.values(data.characters).every(items => Array.isArray(items) && items.length <= 3 && items.every(p => /^portraits\/[a-f0-9-]+\.(png|jpg)$/.test(p)));
        if (!valid) continue;
        manifest = data; refresh(); break;
      } catch (_) {}
    }
  })();
})();
