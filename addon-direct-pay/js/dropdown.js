// 항목마다 아이콘을 보여 주는 드롭다운. 네이티브 select는 항목에 그림을 못 넣어서 같은 모양(.sel)으로 따로 만든다.
// 사용: Dropdown.create(host, { label, axis, options: [{ v, t, icon }], value, onChange })
// 트리거 글자는 `축 · 값`(예: 유형 · 일반형), 선택 항목이 첫 항목(전체)이 아니면 테두리가 파랗다(.on).
(function (root) {
  'use strict';

  var CARET = '<svg viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 1.5 6 6l4.5-4.5"/></svg>';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function create(host, cfg) {
    var opts = cfg.options;
    var value = cfg.value != null ? cfg.value : opts[0].v;
    var open = false, active = -1;
    var uid = 'dd-' + (host.id || Math.random().toString(36).slice(2, 7));

    var btn = el('button', 'sel dd-btn'); btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', cfg.label || cfg.axis);
    btn.setAttribute('aria-controls', uid);
    var ico = el('span', 'dd-ico'); ico.setAttribute('aria-hidden', 'true');
    var txt = el('span', 'dd-txt');
    var caret = el('span', 'dd-caret'); caret.innerHTML = CARET;
    btn.appendChild(ico); btn.appendChild(txt); btn.appendChild(caret);

    var list = el('ul', 'dd-list'); list.id = uid; list.setAttribute('role', 'listbox'); list.hidden = true;
    var lis = opts.map(function (o, i) {
      var li = el('li', 'dd-opt'); li.setAttribute('role', 'option'); li.id = uid + '-' + i;
      var oi = el('span', 'dd-ico'); oi.setAttribute('aria-hidden', 'true'); if (o.icon) oi.innerHTML = o.icon;
      li.appendChild(oi); li.appendChild(el('span', 'dd-txt', o.t));
      li.addEventListener('click', function () { choose(i); btn.focus(); });
      li.addEventListener('mousemove', function () { setActive(i); });
      list.appendChild(li);
      return li;
    });
    host.classList.add('dd');
    host.appendChild(btn); host.appendChild(list);

    function indexOf(v) { for (var i = 0; i < opts.length; i++) if (opts[i].v === v) return i; return 0; }

    function paint() {
      var i = indexOf(value), o = opts[i];
      txt.textContent = cfg.axis + ' · ' + o.t;
      ico.innerHTML = o.icon || '';
      ico.hidden = !o.icon;
      btn.className = 'sel dd-btn' + (i === 0 ? '' : ' on');
      lis.forEach(function (li, k) { li.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    }
    function setActive(i) {
      active = i;
      lis.forEach(function (li, k) { li.classList.toggle('act', k === i); });
      if (i >= 0) btn.setAttribute('aria-activedescendant', lis[i].id); else btn.removeAttribute('aria-activedescendant');
    }
    function show() { open = true; list.hidden = false; btn.setAttribute('aria-expanded', 'true'); setActive(indexOf(value)); }
    function hide() { open = false; list.hidden = true; btn.setAttribute('aria-expanded', 'false'); setActive(-1); }
    function choose(i) {
      hide();
      if (opts[i].v === value) return;
      value = opts[i].v; paint();
      if (cfg.onChange) cfg.onChange(value);
    }

    btn.addEventListener('click', function () { if (open) hide(); else show(); });
    btn.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        e.preventDefault();
        if (!open) { show(); return; }
        setActive(Math.max(0, Math.min(opts.length - 1, active + (k === 'ArrowDown' ? 1 : -1))));
      } else if ((k === 'Enter' || k === ' ') && open) {
        e.preventDefault(); choose(active < 0 ? indexOf(value) : active);
      } else if (k === 'Escape' && open) {
        e.preventDefault(); hide();
      } else if (k === 'Tab' && open) { hide(); }
    });
    document.addEventListener('click', function (e) { if (open && !host.contains(e.target)) hide(); });

    paint();
    return {
      get value() { return value; },
      setValue: function (v) { value = v; paint(); }
    };
  }

  root.Dropdown = { create: create };
}(typeof window !== 'undefined' ? window : this));
