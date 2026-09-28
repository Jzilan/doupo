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
