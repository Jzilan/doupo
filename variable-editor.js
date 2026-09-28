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
