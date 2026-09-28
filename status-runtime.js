(function () {
    'use strict';
    var root = document.getElementById('doupo-status');
    if (!root || root.dataset.runtimeBound === 'true') return;
    root.dataset.runtimeBound = 'true';

    var expectedKeys = ['主角','装备','储物空间','人物','伴侣','兽宠'];
    var subscribed = new Set();
    var renderTimer = 0;

    function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    function entries(value) { return Object.entries(object(value)); }
    function esc(value) {
      return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function (char) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char];
      });
    }
    function string(value, fallback) {
      if (value === undefined || value === null || value === '') return fallback === undefined ? '—' : fallback;
      return typeof value === 'object' ? (fallback === undefined ? '—' : fallback) : String(value);
    }
    function number(value, fallback) { var result = Number(value); return Number.isFinite(result) ? result : (fallback || 0); }
    function clamp(value) { return Math.max(0, Math.min(100, number(value, 0))); }
    function getPath(source, path, fallback) {
      var cursor = source;
      for (var part of path.split('.')) {
        if (!cursor || typeof cursor !== 'object' || !(part in cursor)) return fallback;
        cursor = cursor[part];
      }
      return cursor === undefined || cursor === null ? fallback : cursor;
    }
    function normalize(raw) {
      if (!raw || typeof raw !== 'object') return null;
      if (raw.stat_data && typeof raw.stat_data === 'object') return raw.stat_data;
      if (raw.data && raw.data.stat_data && typeof raw.data.stat_data === 'object') return raw.data.stat_data;
      if (expectedKeys.some(function (key) { return Object.prototype.hasOwnProperty.call(raw, key); })) return raw;
      return null;
    }
    function sourceWindows() {
      var result = [];
      function add(target) { if (target && !result.includes(target)) result.push(target); }
      add(window);
      try { add(window.parent); } catch (_) {}
      try { add(window.top); } catch (_) {}
      return result;
    }
    function readState() {
      try { return envelope(messageBinding()).stat_data; } catch (_) {}
      for (var target of sourceWindows()) {
        try { if (typeof target.getAllVariables === 'function') { var data = normalize(target.getAllVariables()); if (data) return data; } } catch (_) {}
      }
      return null;
    }
    function sexSymbol(value) {
      var normalized = String(value || '').trim();
      if (normalized === '男' || normalized === '男性' || normalized === '雄') return '♂';
      if (normalized === '女' || normalized === '女性' || normalized === '雌') return '♀';
      return normalized || '—';
    }
    function splitRealm(value) {
      var source = string(value, '斗之气·一段').replace(/[・•]/g, '·').trim();
      var parts = source.split('·').filter(Boolean);
      if (parts.length > 1) return { major:parts[0], minor:parts.slice(1).join('·') };
      var match = source.match(/^(斗之气|斗者|斗师|大斗师|斗灵|斗王|斗皇|斗宗|斗尊|斗圣|斗帝)(.*)$/u);
      return match ? { major:match[1], minor:match[2] || '' } : { major:source, minor:'' };
    }
    function hiddenStatusKey(key) { return key === '炼药师品级' || key === '灵魂境界'; }
    function valuePath(path) { return path ? ' data-value-path="' + esc(JSON.stringify(path)) + '"' + (editor ? ' tabindex="0" title="双击编辑"' : '') : ''; }
    function addControl(path, label) { return editor ? '<button type="button" class="dp-edit-add" data-edit-add="' + esc(JSON.stringify(path)) + '">' + esc(label || '新增字段') + '</button>' : ''; }
    function card(label, value, wide, path) {
      if (hiddenStatusKey(label) || value === undefined && !editor) return '';
      return '<div class="dpst-card' + (wide ? ' wide' : '') + '"' + valuePath(path) + '><div class="dpst-label">' + esc(label) + '</div><div class="dpst-value">' + (value && typeof value === 'object' ? Object.entries(value).filter(function (pair) { return !hiddenStatusKey(pair[0]); }).map(function (pair) { return card(pair[0], pair[1], true, path && path.concat(pair[0])); }).join('') : esc(string(value))) + '</div></div>';
    }
    function progressCard(label, value, path) {
      if (value === undefined && !editor) return '';
      var safe = clamp(value);
      return '<div class="dpst-card"' + valuePath(path) + '><div class="dpst-label">' + esc(label) + '</div><div class="dpst-value">' + safe + ' / 100</div><div class="dpst-progress"><i style="width:' + safe + '%"></i></div></div>';
    }
    function extraCards(value, known, path) { return entries(value).filter(function (pair) { return !known.includes(pair[0]) && !hiddenStatusKey(pair[0]); }).map(function (pair) { return card(pair[0], pair[1], true, path.concat(pair[0])); }).join(''); }
    function sectionTitle(title) { return '<h2 class="dpst-section-title">' + esc(title) + '</h2>'; }
    function empty(label) { return '<div class="dpst-empty">暂无' + esc(label) + '</div>'; }
    function realmText(value) {
      var realm = object(value);
      return string(realm.境界) + ' · 进度 ' + clamp(realm.境界进度) + '/100 · ' + string(realm.斗气属性);
    }
    function realmGauge(value, path) {
      var realm = object(value);
      var progress = clamp(realm.境界进度);
      var split = splitRealm(realm.境界);
      var flame = 'https://cdn.myfollo.xyz/2026/08/24/6a8bf306b0bdc.png';
      return '<div class="dpst-realm-gauge" data-realm-gauge' + valuePath(path) + ' style="--realm-progress:' + (progress * 3.6) + 'deg">' +
        '<span class="dpst-gauge-axis ns"></span><span class="dpst-gauge-axis ew"></span>' +
        '<span class="dpst-gauge-star ne"></span><span class="dpst-gauge-star se"></span><span class="dpst-gauge-star sw"></span><span class="dpst-gauge-star nw"></span>' +
        '<img class="dpst-gauge-node n" src="' + flame + '" alt=""><img class="dpst-gauge-node e" src="' + flame + '" alt=""><img class="dpst-gauge-node s" src="' + flame + '" alt=""><img class="dpst-gauge-node w" src="' + flame + '" alt="">' +
        '<div class="dpst-realm-inner"><span class="dpst-realm-major">' + esc(split.major) + '</span><strong class="dpst-realm-minor">' + esc(split.minor) + '</strong><span class="dpst-realm-rule"></span><span class="dpst-realm-progress-label">境界进度</span><b class="dpst-realm-progress-value">' + progress + '%</b></div></div>';
    }
    function recordKey(scope, name) { return String(scope || '记录') + '::' + String(name || '未命名'); }
    function techniqueRecord(name, value, kind, scope, ownerPath) {
      var info = object(value), path = ownerPath.concat(kind, name);
      var progressKey = kind === '功法' ? '进度' : '熟练度';
      return '<details class="dpst-record" data-record-key="' + esc(recordKey(scope + ':' + kind, name)) + '"><summary' + valuePath(path) + '>' + esc(name) + '<span class="dpst-summary-meta">' + esc(string(info.等阶, '未定')) + ' · ' + esc(string(info.境界, '未定')) + '</span></summary><div class="dpst-record-body"><div class="dpst-grid">' + card('等阶', info.等阶, false, path.concat('等阶')) + card('境界', info.境界, false, path.concat('境界')) + card('属性', info.属性, false, path.concat('属性')) + progressCard(progressKey, info[progressKey], path.concat(progressKey)) + card('效果', info.效果, true, path.concat('效果')) + extraCards(info, ['等阶','境界','属性',progressKey,'效果'], path) + '</div>' + addControl(path) + '</div></details>';
    }
    function techniques(owner, kind, scope, path) {
      path = path || ['主角'];
      var list = entries(object(owner)[kind]);
      return addControl(path.concat(kind), '新增' + kind) + (list.length ? '<div class="dpst-list">' + list.map(function (pair) { return techniqueRecord(pair[0], pair[1], kind, scope || '主角', path); }).join('') + '</div>' : empty(kind));
    }
    function simpleRecordList(source, emptyLabel, fields, scope) {
      var list = entries(source);
      if (!list.length) return empty(emptyLabel) + addControl([scope], '新增' + emptyLabel);
      return addControl([scope], '新增' + emptyLabel) + '<div class="dpst-list">' + list.map(function (pair) {
        var info = object(pair[1]), path = [scope, pair[0]];
        return '<details class="dpst-record" data-record-key="' + esc(recordKey(scope || emptyLabel, pair[0])) + '"><summary' + valuePath(path) + '>' + esc(pair[0]) + '<span class="dpst-summary-meta">' + esc(string(info[fields[0][0]])) + '</span></summary><div class="dpst-record-body"><div class="dpst-grid">' + fields.map(function (field) { return card(field[1], info[field[0]], field[2] === true, path.concat(field[0])); }).join('') + extraCards(info, fields.map(function (field) { return field[0]; }), path) + '</div>' + addControl(path) + '</div></details>';
      }).join('') + '</div>';
    }
    function favorBar(value, path) {
      var safe = clamp(value);
      return '<div class="dpst-favor"' + valuePath(path) + '><span>好感度</span><span class="dpst-favor-track"><i style="width:' + safe + '%"></i></span><b>' + safe + ' / 100</b></div>';
    }
    function personRecord(name, value, kind) {
      var info = object(value), path = [kind, name];
      var fields = [['性别','性别'],['年龄','年龄'],['所在地','所在地'],['在场状态','在场状态'],['关系','关系'],['所属组织','所属组织'],['当前状态','当前状态',true],['外貌','外貌',true],['穿着','穿着',true]];
      var summary = '<div class="dpst-summary-row"><span class="dpst-summary-name">' + esc(name) + '<i class="dpst-summary-gender">' + esc(sexSymbol(info.性别)) + '</i></span><span class="dpst-summary-relation">' + esc(string(info.关系, '关系未定')) + '</span></div><span class="dpst-summary-meta">' + esc(string(info.在场状态, '不在场')) + ' · ' + esc(string(getPath(info, '境界.境界', '境界未定'))) + '</span>' + favorBar(info.好感度, path.concat('好感度'));
      var body = '<div data-person-portrait="' + esc(name) + '"></div><div class="dpst-grid">' + fields.map(function (field) { return card(field[1], info[field[0]], field[2] === true, path.concat(field[0])); }).join('') + card('境界', realmText(info.境界), true, path.concat('境界')) + '</div>';
      body += addControl(path) + '<div class="dpst-grid">' + extraCards(info, fields.map(function (f) { return f[0]; }).concat(['境界','功法','斗技','好感度','内心话','NSFW数据']), path) + '</div>';
      if (kind !== '人物' || root.dataset.personTechniques === 'on') {
        body += '<div class="dpst-subtitle">功法</div>' + techniques(info, '功法', kind + ':' + name, path);
        body += '<div class="dpst-subtitle">斗技</div>' + techniques(info, '斗技', kind + ':' + name, path);
      }
      if (kind === '伴侣') {
        body += '<div class="dpst-subtitle">内心话</div>' + card('内心话', info.内心话, true, path.concat('内心话'));
        var privateInfo = object(info.NSFW数据);
        body += '<details class="dpst-record" data-record-key="' + esc(recordKey(kind + ':' + name, '私密状态')) + '" style="margin-top:10px"><summary>私密状态</summary><div class="dpst-record-body"><div class="dpst-grid">' + ['樱唇','酥胸','小穴','肥臀','后庭','玉足'].map(function (key) { return card(key, privateInfo[key], true, path.concat('NSFW数据', key)); }).join('') + '</div></div></details>';
      }
      return '<details class="dpst-record" data-record-key="' + esc(recordKey(kind, name)) + '"><summary' + valuePath(path) + '>' + summary + '</summary><div class="dpst-record-body">' + body + '</div></details>';
    }
    function peopleList(source, kind) {
      var list = entries(source);
      return addControl([kind], '新增' + kind) + (list.length ? '<div class="dpst-list">' + list.map(function (pair) { return personRecord(pair[0], pair[1], kind); }).join('') + '</div>' : empty(kind));
    }
    function petList(source) {
      var list = entries(source);
      if (!list.length) return empty('兽宠') + addControl(['兽宠'], '新增兽宠');
      return addControl(['兽宠'], '新增兽宠') + '<div class="dpst-list">' + list.map(function (pair) {
        var name = pair[0];
        var info = object(pair[1]), path = ['兽宠', name];
        var summary = '<div class="dpst-summary-row"><span class="dpst-summary-name">' + esc(name) + '<i class="dpst-summary-gender">' + esc(sexSymbol(info.性别)) + '</i></span><span class="dpst-summary-relation">等级 ' + esc(string(info.等级, '未定')) + '</span></div><span class="dpst-summary-meta">' + esc(string(info.血脉, '血脉未定')) + ' · ' + esc(string(info.所在地, '所在地未知')) + '</span>';
        var body = '<div data-person-portrait="' + esc(name) + '"></div><div class="dpst-grid">' + card('性别', info.性别, false, path.concat('性别')) + card('所在地', info.所在地, false, path.concat('所在地')) + card('等级', info.等级, false, path.concat('等级')) + card('血脉', info.血脉, false, path.concat('血脉')) + card('潜力', info.潜力, false, path.concat('潜力')) + card('境界', realmText(info.境界), true, path.concat('境界')) + card('外貌', info.外貌, true, path.concat('外貌')) + card('内心话', info.内心话, true, path.concat('内心话')) + extraCards(info, ['性别','所在地','等级','血脉','潜力','境界','外貌','内心话'], path) + '</div>' + addControl(path);
        return '<details class="dpst-record" data-record-key="' + esc(recordKey('兽宠', name)) + '"><summary' + valuePath(path) + '>' + summary + '</summary><div class="dpst-record-body">' + body + '</div></details>';
      }).join('') + '</div>';
    }
    function setText(selector, value) { var node = root.querySelector(selector); if (node) node.textContent = value; }
    var lastState = '';
    function render() {
      if (editor && editor.active) return;
      var state = editor ? editor.draft : readState();
      var signature = JSON.stringify([state, root.dataset.personTechniques, Boolean(editor)]);
      if (signature === lastState) return;
      lastState = signature;
      root.querySelectorAll('.dp-inline-form').forEach(function (form) { form.remove(); });
      root.dataset.variableState = state ? 'ready' : 'waiting';
      state = state || {};
      var hero = object(state.主角);
      var life = clamp(hero.生命 === undefined ? 0 : hero.生命);
      var qi = clamp(hero.斗气 === undefined ? 0 : hero.斗气);
      setText('[data-name]', string(hero.姓名, '未命名'));
      setText('[data-gender]', sexSymbol(hero.性别));
      setText('[data-life-text]', hero.生命 === undefined ? '—' : life + ' / 100');
      setText('[data-qi-text]', hero.斗气 === undefined ? '—' : qi + ' / 100');
      var lifeBar = root.querySelector('[data-life-bar]');
      var qiBar = root.querySelector('[data-qi-bar]');
      if (lifeBar) lifeBar.style.width = life + '%';
      if (qiBar) qiBar.style.width = qi + '%';
      root.querySelector('[data-panel="主角"]').innerHTML = '<div data-person-portrait="' + esc(string(hero.姓名, '')) + '"></div><div class="dpst-hero-layout">' + realmGauge(hero.境界, ['主角','境界']) + '<div class="dpst-grid">' + card('斗气属性', getPath(hero, '境界.斗气属性', '无'), false, ['主角','境界','斗气属性']) + card('身份', hero.身份, false, ['主角','身份']) + card('所属组织', hero.所属组织, false, ['主角','所属组织']) + card('年龄', hero.年龄, false, ['主角','年龄']) + card('所在地', hero.所在地, false, ['主角','所在地']) + card('当前状态', hero.当前状态, false, ['主角','当前状态']) + card('外貌', hero.外貌, true, ['主角','外貌']) + card('穿着', hero.穿着, true, ['主角','穿着']) + '</div></div>';
      root.querySelector('[data-panel="绝学"]').innerHTML = sectionTitle('功法') + techniques(hero, '功法', '主角') + '<div style="height:18px"></div>' + sectionTitle('斗技') + techniques(hero, '斗技', '主角');
      root.querySelector('[data-panel="装备"]').innerHTML = sectionTitle('装备') + simpleRecordList(state.装备, '装备', [['类别','类别'],['来源','来源'],['能力','能力',true],['简介','简介',true]], '装备');
      root.querySelector('[data-panel="物品"]').innerHTML = sectionTitle('储物空间') + simpleRecordList(state.储物空间, '物品', [['类别','类别'],['等阶','等阶'],['来源','来源'],['简介','简介',true]], '储物空间');
      root.querySelector('[data-panel="人物"]').innerHTML = sectionTitle('人物') + peopleList(state.人物, '人物');
      root.querySelector('[data-panel="伴侣"]').innerHTML = sectionTitle('伴侣') + peopleList(state.伴侣, '伴侣');
      root.querySelector('[data-panel="兽宠"]').innerHTML = sectionTitle('兽宠') + petList(state.兽宠);
      root.querySelector('[data-panel="主角"] .dpst-grid').insertAdjacentHTML('beforeend', extraCards(hero, ['姓名','性别','生命','斗气','境界','功法','斗技','斗气属性','身份','所属组织','年龄','所在地','当前状态','外貌','穿着'], ['主角']) + addControl(['主角']));
      var other = extraCards(state, ['主角','装备','储物空间','人物','伴侣','兽宠','炼丹'], []);
      root.querySelector('[data-panel="其他"]').innerHTML = '<div class="dpst-grid">' + other + '</div>' + addControl([], '新增项目');
      root.querySelector('[data-tab="其他"]').hidden = !other && !editor;
      if (!other && !editor && root.querySelector('[data-tab="其他"]').classList.contains('is-active')) { activate('主角'); save('doupo-status-tab-v4', '主角'); }
      if (storage('doupo-status-avatar-mode-v1', 'none') === 'none' && !DoupoPortraits.url(hero.姓名)) clearAvatarView();
      [['[data-name]','姓名'],['[data-gender]','性别'],['[data-life-text]','生命'],['[data-qi-text]','斗气']].forEach(function (pair) {
        var node = root.querySelector(pair[0]); node.dataset.valuePath = JSON.stringify(['主角', pair[1]]);
        if (editor) { node.tabIndex = 0; node.title = '双击编辑'; } else { node.removeAttribute('tabindex'); node.removeAttribute('title'); }
      });
      restoreOpenRecords();
      root.querySelectorAll('[data-person-portrait]').forEach(function (node) { DoupoPortraits.mount(node, node.dataset.personPortrait); });
      if (storage('doupo-status-avatar-mode-v1', 'none') === 'none' && DoupoPortraits.url(hero.姓名)) { DoupoPortraits.paint(root.querySelector('[data-avatar-image]'), hero.姓名); root.querySelector('[data-avatar-empty]').hidden = true; }
    }
    function storage(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } }
    function save(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
    function openRecordSet() {
      try {
        var parsed = JSON.parse(storage('doupo-status-open-records-v1', '[]'));
        return new Set(Array.isArray(parsed) ? parsed : []);
      } catch (_) { return new Set(); }
    }
    function saveOpenRecord(key, isOpen) {
      if (!key) return;
      var set = openRecordSet();
      if (isOpen) set.add(key); else set.delete(key);
      save('doupo-status-open-records-v1', JSON.stringify(Array.from(set)));
    }
    function restoreOpenRecords() {
      var set = openRecordSet();
      root.querySelectorAll('details[data-record-key]').forEach(function (details) {
        details.open = set.has(details.dataset.recordKey);
      });
    }
    var avatarObjectUrl = '';
    function avatarDatabase() {
      return new Promise(function (resolve, reject) {
        try {
          var request = indexedDB.open('doupo-status-assets-v1', 1);
          request.onupgradeneeded = function () {
            if (!request.result.objectStoreNames.contains('assets')) request.result.createObjectStore('assets');
          };
          request.onsuccess = function () { resolve(request.result); };
          request.onerror = function () { reject(request.error || new Error('头像数据库打开失败')); };
        } catch (error) { reject(error); }
      });
    }
    function avatarDbAction(mode, value) {
      return avatarDatabase().then(function (db) {
        return new Promise(function (resolve, reject) {
          var transaction = db.transaction('assets', mode === 'read' ? 'readonly' : 'readwrite');
          var store = transaction.objectStore('assets');
          var request = mode === 'read' ? store.get('avatar') : mode === 'delete' ? store.delete('avatar') : store.put(value, 'avatar');
          request.onsuccess = function () { resolve(request.result); };
          request.onerror = function () { reject(request.error || new Error('头像数据操作失败')); };
          transaction.oncomplete = function () { try { db.close(); } catch (_) {} };
        });
      });
    }
    function setAvatarStatus(message) { setText('[data-avatar-status]', message || ''); }
    function clearAvatarView() {
      var image = root.querySelector('[data-avatar-image]');
      var emptyState = root.querySelector('[data-avatar-empty]');
      if (avatarObjectUrl) { try { URL.revokeObjectURL(avatarObjectUrl); } catch (_) {} avatarObjectUrl = ''; }
      if (image) { image.removeAttribute('src'); image.hidden = true; }
      if (emptyState) emptyState.hidden = false;
    }
    function showAvatar(source, objectUrl) {
      var image = root.querySelector('[data-avatar-image]');
      var emptyState = root.querySelector('[data-avatar-empty]');
      if (!image || !source) { clearAvatarView(); return; }
      if (avatarObjectUrl && avatarObjectUrl !== source) { try { URL.revokeObjectURL(avatarObjectUrl); } catch (_) {} }
      avatarObjectUrl = objectUrl ? source : '';
      delete image.dataset.portraitName; delete image.dataset.portraitPath; image.onerror = null;
      image.src = source;
      image.hidden = false;
      if (emptyState) emptyState.hidden = true;
    }
    function loadAvatar() {
      var mode = storage('doupo-status-avatar-mode-v1', 'none');
      if (mode === 'url') {
        var value = storage('doupo-status-avatar-url-v1', '');
        if (value) { showAvatar(value, false); return Promise.resolve(); }
      }
      if (mode === 'local') {
        return avatarDbAction('read').then(function (blob) {
          if (blob instanceof Blob) showAvatar(URL.createObjectURL(blob), true);
          else clearAvatarView();
        }).catch(function () { clearAvatarView(); });
      }
      clearAvatarView();
      return Promise.resolve();
    }
    function openAvatarModal() {
      var modal = root.querySelector('[data-avatar-modal]');
      if (!modal) return;
      var input = root.querySelector('[data-avatar-url]');
      if (input) input.value = storage('doupo-status-avatar-url-v1', '');
      setAvatarStatus('');
      modal.hidden = false;
    }
    function closeAvatarModal() {
      var modal = root.querySelector('[data-avatar-modal]');
      if (modal) modal.hidden = true;
    }
    function useLocalAvatar(file) {
      if (!file) return;
      setAvatarStatus('正在保存头像…');
      avatarDbAction('write', file).then(function () {
        save('doupo-status-avatar-mode-v1', 'local');
        showAvatar(URL.createObjectURL(file), true);
        setAvatarStatus('头像已保存');
      }).catch(function (error) { setAvatarStatus('保存失败：' + string(error && error.message, '浏览器存储不可用')); });
    }
    function useUrlAvatar() {
      var input = root.querySelector('[data-avatar-url]');
      var value = input ? input.value.trim() : '';
      if (!value) { setAvatarStatus('请输入图片 URL'); return; }
      save('doupo-status-avatar-url-v1', value);
      save('doupo-status-avatar-mode-v1', 'url');
      showAvatar(value, false);
      setAvatarStatus('URL 头像已应用');
    }
    function clearAvatar() {
      save('doupo-status-avatar-mode-v1', 'none');
      try { localStorage.removeItem('doupo-status-avatar-url-v1'); } catch (_) {}
      avatarDbAction('delete').catch(function () {});
      clearAvatarView();
      setAvatarStatus('头像已清空');
    }
    function applyTheme(value) {
      var theme = value;
      if (value === 'system') {
        try { theme = matchMedia('(prefers-color-scheme:light)').matches ? 'day' : 'night'; } catch (_) { theme = 'night'; }
      }
      root.dataset.theme = theme;
    }
    function applyFontSize(value) {
      var size = Math.max(80, Math.min(140, Number(value) || 100));
      document.documentElement.style.fontSize = (16 * size / 100) + 'px';
      root.dataset.fontSize = String(size);
      var output = root.querySelector('[data-font-output]');
      if (output) output.textContent = size + '%';
    }
    function applyCollapsed(value) {
      root.dataset.collapsed = value === 'on' ? 'on' : 'off';
    }
    function activate(name) {
      root.querySelectorAll('[data-tab]').forEach(function (button) {
        var active = button.dataset.tab === name;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      root.querySelectorAll('[data-panel]').forEach(function (panel) {
        var active = panel.dataset.panel === name;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    }
    function bindInteractions() {
      var active = storage('doupo-status-tab-v4', '主角');
      var theme = storage('doupo-status-theme-v4', 'night');
      var background = storage('doupo-status-bg-v4', 'on');
      var fontSize = storage('doupo-status-font-v1', '100');
      var personTechniques = storage('doupo-status-person-techniques-v1', 'off');
      var collapsed = storage('doupo-status-collapsed-v2', 'on');
      root.dataset.bg = background;
      root.dataset.personTechniques = personTechniques;
      applyTheme(theme);
      applyFontSize(fontSize);
      applyCollapsed(collapsed);
      var themeSelect = root.querySelector('[data-theme-select]');
      var bgSelect = root.querySelector('[data-bg-select]');
      var fontInput = root.querySelector('[data-font-size]');
      var personTechniquesSelect = root.querySelector('[data-person-techniques-select]');
      if (themeSelect) themeSelect.value = theme;
      if (bgSelect) bgSelect.value = background;
      if (fontInput) fontInput.value = fontSize;
      if (personTechniquesSelect) personTechniquesSelect.value = personTechniques;
      activate(active);
      root.addEventListener('click', function (event) {
        var tab = event.target.closest('[data-tab]');
        if (tab && root.contains(tab)) {
          var name = tab.dataset.tab;
          save('doupo-status-tab-v4', name);
          activate(name);
          return;
        }
        var header = event.target.closest('.dpst-head');
        var excludedHeaderControl = event.target.closest('[data-settings-open],[data-avatar-open]');
        if (header && root.contains(header) && !excludedHeaderControl && !editor) {
          var nextCollapsed = root.dataset.collapsed === 'on' ? 'off' : 'on';
          save('doupo-status-collapsed-v2', nextCollapsed);
          applyCollapsed(nextCollapsed);
          return;
        }
        var open = event.target.closest('[data-settings-open]');
        if (open && root.contains(open)) {
          event.stopPropagation();
          root.querySelector('[data-settings-panel]').hidden = false;
          return;
        }
        var close = event.target.closest('[data-settings-close]');
        if (close && root.contains(close)) { root.querySelector('[data-settings-panel]').hidden = true; return; }
        var avatarOpen = event.target.closest('[data-avatar-open]');
        if (avatarOpen && root.contains(avatarOpen)) { openAvatarModal(); return; }
        var avatarClose = event.target.closest('[data-avatar-close]');
        if (avatarClose && root.contains(avatarClose)) { closeAvatarModal(); return; }
        var localAvatar = event.target.closest('[data-avatar-local]');
        if (localAvatar && root.contains(localAvatar)) { root.querySelector('[data-avatar-file]').click(); return; }
        var urlAvatar = event.target.closest('[data-avatar-url-apply]');
        if (urlAvatar && root.contains(urlAvatar)) { useUrlAvatar(); return; }
        var avatarClear = event.target.closest('[data-avatar-clear]');
        if (avatarClear && root.contains(avatarClear)) { clearAvatar(); return; }
        var modal = event.target.closest('[data-avatar-modal]');
        if (modal && event.target === modal) closeAvatarModal();
      });
      root.addEventListener('input', function (event) {
        if (event.target.matches('[data-font-size]')) { save('doupo-status-font-v1', event.target.value); applyFontSize(event.target.value); }
      });
      root.addEventListener('change', function (event) {
        if (event.target.matches('[data-theme-select]')) { save('doupo-status-theme-v4', event.target.value); applyTheme(event.target.value); }
        if (event.target.matches('[data-bg-select]')) { root.dataset.bg = event.target.value; save('doupo-status-bg-v4', event.target.value); }
        if (event.target.matches('[data-person-techniques-select]')) { root.dataset.personTechniques = event.target.value; save('doupo-status-person-techniques-v1', event.target.value); render(); }
        if (event.target.matches('[data-avatar-file]')) { useLocalAvatar(event.target.files && event.target.files[0]); event.target.value = ''; }
      });
      root.addEventListener('toggle', function (event) {
        var details = event.target;
        if (details && details.matches && details.matches('details[data-record-key]')) saveOpenRecord(details.dataset.recordKey, details.open);
      }, true);
    }
    function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 50); }
    function subscribe() {
      sourceWindows().forEach(function (target, index) {
        try {
          if (typeof target.eventOn !== 'function') return;
          var names = [];
          if (target.Mvu && target.Mvu.events) {
            if (target.Mvu.events.VARIABLE_UPDATE_ENDED) names.push(target.Mvu.events.VARIABLE_UPDATE_ENDED);
            if (target.Mvu.events.VARIABLE_INITIALIZED) names.push(target.Mvu.events.VARIABLE_INITIALIZED);
          }
          names.forEach(function (name) {
            var key = index + ':' + String(name);
            if (!name || subscribed.has(key)) return;
            subscribed.add(key);
            try { target.eventOn(name, scheduleRender); } catch (_) {}
          });
        } catch (_) {}
      });
    }
    function hookReadiness() {
      sourceWindows().forEach(function (target) {
        try {
          if (typeof target.waitGlobalInitialized === 'function') {
            Promise.resolve(target.waitGlobalInitialized('Mvu')).then(function () { subscribe(); render(); }).catch(function () {});
          }
        } catch (_) {}
      });
    }

// Runs inside the status runtime; edits stay in a draft until the footer Save is pressed.
    var editor = null;
    function messageBinding() {
      if (typeof window.getCurrentMessageId !== 'function') throw new Error('请在聊天消息中的状态栏打开编辑。');
      var id = window.getCurrentMessageId();
      if (!Number.isInteger(id) || id < 0) throw new Error('无法确定当前消息。');
      var target = sourceWindows().find(function (w) { return w.Mvu && typeof w.Mvu.getMvuData === 'function' && typeof w.Mvu.replaceMvuData === 'function'; });
      if (!target) throw new Error('变量尚未准备好，请稍后再试。');
      var host = sourceWindows().find(function (w) { return w.SillyTavern && typeof w.SillyTavern.getContext === 'function'; });
      var context = host && host.SillyTavern.getContext();
      return { target: target, option: { type: 'message', message_id: id }, chat: host && host.SillyTavern.getCurrentChatId && host.SillyTavern.getCurrentChatId(), swipe: context && context.chat && context.chat[id] ? (context.chat[id].swipe_id || 0) : null };
    }
    function envelope(binding) {
      var data = binding.target.Mvu.getMvuData(binding.option);
      if (!data || !data.stat_data || typeof data.stat_data !== 'object' || Array.isArray(data.stat_data)) throw new Error('这条消息尚未初始化变量，请等待变量更新完成。');
      return JSON.parse(JSON.stringify(data));
    }
    function editGet(value, path) { for (var part of path) { if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) return undefined; value = value[part]; } return value; }
    function editType(value) { return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value; }
    function editorStatus(message) { root.querySelector('[data-edit-status]').textContent = message || ''; }
    function editButton(text, action, attribute) {
      var button = document.createElement('button'); button.type = 'button'; button.textContent = text;
      if (attribute) button.setAttribute(attribute, '');
      button.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); action(); });
      return button;
    }
    function validEditName(name) {
      if (!name.trim() || ['__proto__','prototype','constructor'].includes(name)) throw new Error('请输入有效的名称。');
      if (hiddenStatusKey(name)) throw new Error('此项不在状态栏中显示。');
      return name;
    }
    // Objects and lists use ordinary labelled inputs, never a JSON text area.
    function editField(name, value, fixedName) {
      var row = document.createElement('div'); row.className = 'dp-inline-field';
      var nameLabel = document.createElement('label'); nameLabel.textContent = '名称';
      var key = document.createElement('input'); key.value = name; key.readOnly = fixedName; key.dataset.editKey = ''; nameLabel.append(key);
      var typeLabel = document.createElement('label'); typeLabel.textContent = '类型';
      var type = document.createElement('select'); type.dataset.editType = '';
      [['string','文字'],['number','数字'],['boolean','是 / 否'],['object','分组'],['array','列表'],['null','空值']].forEach(function (pair) { type.add(new Option(pair[1], pair[0])); });
      type.value = value === undefined ? 'string' : editType(value); typeLabel.append(type);
      var body = document.createElement('div'); body.className = 'dp-inline-value';
      row.append(nameLabel, typeLabel, body);
      var collect;
      function draw(current) {
        body.replaceChildren();
        var selected = type.value;
        if (selected === 'object' || selected === 'array') {
          var list = selected === 'array', children = [];
          var group = document.createElement('div'); group.className = 'dp-inline-children'; body.append(group);
          function add(childName, childValue) {
            var child = editField(childName, childValue, list); children.push(child); group.append(child.row);
            child.row.append(editButton('删除此项', function () { child.row.remove(); }, 'data-edit-child-delete'));
          }
          Object.entries(current || {}).filter(function (pair) { return !hiddenStatusKey(pair[0]); }).forEach(function (pair) { add(pair[0], pair[1]); });
          body.append(editButton(list ? '新增一项' : '新增字段', function () { add(list ? String(children.length) : '', ''); }, 'data-edit-child-add'));
          collect = function () {
            var result = list ? [] : {};
            if (!list) Object.entries(current || {}).filter(function (pair) { return hiddenStatusKey(pair[0]); }).forEach(function (pair) { result[pair[0]] = pair[1]; });
            children.filter(function (child) { return group.contains(child.row); }).forEach(function (child) {
              var pair = child.read();
              if (list) result.push(pair.value);
              else { if (Object.hasOwn(result, pair.name)) throw new Error('同名字段已经存在：' + pair.name); result[pair.name] = pair.value; }
            });
            return result;
          };
        } else if (selected === 'null') {
          body.textContent = '未设置'; collect = function () { return null; };
        } else {
          var label = document.createElement('label'); label.textContent = '值';
          var input = document.createElement(selected === 'boolean' ? 'select' : selected === 'number' ? 'input' : 'textarea'); input.dataset.editValue = '';
          if (selected === 'boolean') { input.add(new Option('是', 'true')); input.add(new Option('否', 'false')); input.value = String(Boolean(current)); }
          else if (selected === 'number') { input.type = 'number'; input.step = 'any'; input.value = current === undefined ? '' : String(current); }
          else { input.rows = 3; input.value = current === undefined ? '' : String(current); }
          label.append(input); body.append(label);
          collect = function () {
            if (selected === 'boolean') return input.value === 'true';
            if (selected === 'number') { if (!input.value.trim() || !Number.isFinite(Number(input.value))) throw new Error('请输入有效数字。'); return Number(input.value); }
            return input.value;
          };
        }
      }
      type.addEventListener('change', function () { draw({string:'',number:0,boolean:false,object:{},array:[],null:null}[type.value]); });
      draw(value);
      return { row: row, read: function () { return { name: fixedName ? name : validEditName(key.value), value: collect() }; } };
    }
    function refreshDraft() { lastState = ''; render(); }
    function finishInline(remove) {
      if (!editor || !editor.active) return;
      var active = editor.active, path = active.path;
      var parent = editGet(editor.draft, active.adding ? path : path.slice(0, -1));
      if (!parent || typeof parent !== 'object') throw new Error('所属项目不存在，请退出后重新编辑。');
      var oldKey = path.at(-1);
      if (remove) { if (Array.isArray(parent)) parent.splice(Number(oldKey), 1); else delete parent[oldKey]; }
      else {
        var pair = active.field.read();
        if (!Array.isArray(parent) && (active.adding || pair.name !== oldKey) && Object.hasOwn(parent, pair.name)) throw new Error('同名字段已经存在。');
        if (active.adding && Array.isArray(parent)) parent.push(pair.value);
        else { if (!active.adding && pair.name !== oldKey) delete parent[oldKey]; parent[pair.name] = pair.value; }
      }
      editor.active = null; refreshDraft(); editorStatus('修改尚未保存，请点击左下角“保存”。');
    }
    function beginInline(path, adding) {
      if (!editor || editor.saving) return;
      try {
        finishInline(false);
        var value = editGet(editor.draft, path);
        var parent = adding ? value : editGet(editor.draft, path.slice(0, -1));
        var list = Array.isArray(parent);
        var name = adding ? (list ? String(parent.length) : '') : String(path.at(-1));
        var recordGroup = ['人物','伴侣','兽宠','装备','储物空间','功法','斗技'].includes(path.at(-1));
        var field = editField(name, adding ? (recordGroup ? {} : '') : value, list);
        var form = document.createElement('div'); form.className = 'dp-inline-form'; form.dataset.inlineForm = '';
        var heading = document.createElement('strong'); heading.textContent = adding ? '新增项目' : path.join(' · '); form.append(heading, field.row);
        function attempt(action) { try { action(); } catch (error) { editorStatus(error.message); } }
        var actions = document.createElement('div'); actions.className = 'dp-edit-actions';
        actions.append(editButton('收起编辑', function () { attempt(function () { finishInline(false); }); }, 'data-edit-apply'));
        if (!adding) actions.append(editButton('删除此项', function () { attempt(function () { finishInline(true); }); }, 'data-edit-delete'));
        actions.append(editButton('取消本项', function () { editor.active = null; refreshDraft(); }, 'data-edit-cancel')); form.append(actions);
        var attribute = adding ? 'data-edit-add' : 'data-value-path';
        var node = Array.from(root.querySelectorAll('[' + attribute + ']')).find(function (item) { return item.getAttribute(attribute) === JSON.stringify(path); });
        if (!node) throw new Error('该项暂未显示，请切换到对应标签。');
        if (adding) node.after(form);
        else if (node.tagName === 'SUMMARY') { node.parentElement.open = true; node.parentElement.querySelector('.dpst-record-body').replaceChildren(form); }
        else if (node.closest('.dpst-head')) node.after(form);
        else { node.classList.add('dp-inline-host'); node.replaceChildren(form); }
        editor.active = {path:path.slice(),adding:adding,field:field};
        editorStatus('双击其他方框可继续修改，最后点击左下角“保存”。');
        (form.querySelector('[data-edit-value]') || form.querySelector('input')).focus();
      } catch (error) { editorStatus(error.message); }
    }
    function openVariableEditor() {
      root.querySelector('[data-settings-panel]').hidden = true; applyCollapsed('off');
      root.querySelector('[data-edit-toolbar]').hidden = false;
      if (editor) return;
      try {
        var binding = messageBinding(), data = envelope(binding).stat_data;
        editor = {binding:binding,base:data,draft:JSON.parse(JSON.stringify(data)),active:null,saving:false};
        root.dataset.editing = 'on'; refreshDraft(); editorStatus('双击方框修改；完成后点击左下角“保存”。');
      } catch (error) { editorStatus(error.message); }
    }
    function editChanges(before, after, path, result) {
      if (JSON.stringify(before) === JSON.stringify(after)) return;
      if (editType(before) === 'object' && editType(after) === 'object') {
        Array.from(new Set(Object.keys(before).concat(Object.keys(after)))).forEach(function (key) { editChanges(before[key], after[key], path.concat(key), result); });
      } else result.push({path:path,before:before,after:after});
    }
    async function saveVariable() {
      if (!editor || editor.saving) return;
      var current = editor;
      try {
        finishInline(false);
        var binding = messageBinding();
        if (binding.option.message_id !== editor.binding.option.message_id || binding.chat !== editor.binding.chat || binding.swipe !== editor.binding.swipe) throw new Error('当前消息已改变，请退出后重新编辑。');
        var data = envelope(binding), changes = []; editChanges(editor.base, editor.draft, [], changes);
        changes.forEach(function (change) {
          if (JSON.stringify(editGet(data.stat_data, change.path)) !== JSON.stringify(change.before)) throw new Error('“' + change.path.join(' · ') + '”已被其他操作修改。草稿已保留，请放弃修改后重新读取。');
          var parent = editGet(data.stat_data, change.path.slice(0, -1));
          if (!parent || typeof parent !== 'object') throw new Error('所属项目已变化，请放弃修改后重新读取。');
        });
        changes.forEach(function (change) { var parent = editGet(data.stat_data, change.path.slice(0, -1)), key = change.path.at(-1); if (change.after === undefined) delete parent[key]; else parent[key] = change.after; });
        editor.saving = true; root.querySelector('[data-edit-save]').disabled = true;
        if (changes.length) await binding.target.Mvu.replaceMvuData(data, binding.option);
        editor.base = envelope(binding).stat_data; editor.draft = JSON.parse(JSON.stringify(editor.base));
        refreshDraft(); editorStatus('已保存，变量管理器已同步。');
      } catch (error) { editorStatus(error.message || '保存失败，草稿已保留。'); }
      finally { current.saving = false; root.querySelector('[data-edit-save]').disabled = false; }
    }
    function closeVariableEditor(discard) {
      if (editor && editor.saving) return;
      if (!discard && editor && (editor.active || JSON.stringify(editor.base) !== JSON.stringify(editor.draft))) { editorStatus('还有未保存的修改，请先保存，或点击“放弃修改”。'); return; }
      editor = null; delete root.dataset.editing; root.querySelector('[data-edit-toolbar]').hidden = true; refreshDraft();
    }
    root.addEventListener('dblclick', function (event) {
      if (!editor || event.target.closest('.dp-inline-form')) return;
      var node = event.target.closest('[data-value-path]');
      if (node) { event.preventDefault(); event.stopPropagation(); beginInline(JSON.parse(node.dataset.valuePath), false); }
    });
    root.addEventListener('keydown', function (event) {
      if (editor && event.key === 'Enter' && event.target.hasAttribute('data-value-path')) { event.preventDefault(); beginInline(JSON.parse(event.target.dataset.valuePath), false); }
    });
    root.addEventListener('click', function (event) {
      var add = event.target.closest('[data-edit-add]');
      if (add && editor) { event.preventDefault(); beginInline(JSON.parse(add.dataset.editAdd), true); }
    });
    ['click','dblclick','keydown','input'].forEach(function (type) { root.addEventListener(type, function (event) { if (editor && editor.saving) { event.preventDefault(); event.stopImmediatePropagation(); } }, true); });
    root.querySelector('[data-edit-open]').addEventListener('click', openVariableEditor);
    root.querySelector('[data-edit-save]').addEventListener('click', saveVariable);
    root.querySelector('[data-edit-close]').addEventListener('click', function () { closeVariableEditor(false); });
    root.querySelector('[data-edit-discard]').addEventListener('click', function () { closeVariableEditor(true); });

    bindInteractions();
    loadAvatar().then(function () { lastState = ''; render(); });
    render();
    subscribe();
    hookReadiness();
    [120,350,800,1600,3000].forEach(function (delay) { setTimeout(function () { subscribe(); render(); }, delay); });
    var refreshInterval = setInterval(render, 2000);
    window.addEventListener('pagehide', function () { clearInterval(refreshInterval); clearTimeout(renderTimer); });
    window.addEventListener('doupo-portrait-change', function () { var state=readState(); var name=state && state.主角 && state.主角.姓名; if (name && storage('doupo-status-avatar-mode-v1','none')==='none') DoupoPortraits.paint(root.querySelector('[data-avatar-image]'),name); });
  })();