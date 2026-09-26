// Installed inside the existing status-bar runtime so it uses the same render function.
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
    function editorTree() {
      var tree = root.querySelector('[data-edit-tree]');
      tree.replaceChildren();
      function button(label, action) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', action); return b; }
      function visit(value, path, parent) {
        var group = value !== null && typeof value === 'object';
        var node = document.createElement(group ? 'details' : 'div'); node.className = 'dp-edit-node';
        var row = document.createElement(group ? 'summary' : 'div'); row.className = 'dp-edit-row';
        var label = document.createElement('span'); label.textContent = path.length ? String(path.at(-1)) : '全部变量'; row.append(label);
        if (!group) { var preview = document.createElement('code'); preview.textContent = String(value); row.append(preview); }
        if (path.length) row.append(button('修改', function (e) { e.stopPropagation(); e.preventDefault(); chooseEdit(path, false); }));
        if (group) row.append(button('新增', function (e) { e.stopPropagation(); e.preventDefault(); chooseEdit(path, true); }));
        node.append(row); parent.append(node);
        if (group) { node.open = path.length < 1; for (var pair of Object.entries(value)) visit(pair[1], path.concat(pair[0]), node); }
      }
      visit(editor.base, [], tree);
    }
    function chooseEdit(path, adding) {
      editor.path = path.slice(); editor.adding = adding;
      var value = editGet(editor.base, path);
      editor.expected = JSON.stringify(value);
      var form = root.querySelector('[data-edit-form]'); form.hidden = false;
      root.querySelector('[data-edit-path]').textContent = path.length ? path.join(' › ') : '全部变量';
      var name = root.querySelector('[data-edit-key]');
      var isArray = Array.isArray(adding ? value : editGet(editor.base, path.slice(0, -1)));
      editor.arrayParent = isArray && !adding ? JSON.stringify(editGet(editor.base, path.slice(0, -1))) : null;
      name.value = adding ? (isArray ? String(value.length) : '') : String(path.at(-1));
      name.readOnly = isArray;
      root.querySelector('[data-edit-type]').value = adding ? 'string' : editType(value);
      root.querySelector('[data-edit-value]').value = adding ? '' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      root.querySelector('[data-edit-delete]').hidden = adding;
      editorStatus(''); form.scrollIntoView({ block: 'nearest' }); name.focus();
    }
    async function openVariableEditor() {
      root.querySelector('[data-settings-panel]').hidden = true;
      applyCollapsed('off');
      var panel = root.querySelector('[data-variable-editor]'); panel.hidden = false;
      root.querySelector('[data-edit-form]').hidden = true;
      try {
        var binding = messageBinding();
        editor = { binding: binding, base: envelope(binding).stat_data };
        editorTree(); editorStatus('修改保存后立即同步本条消息的变量。');
      } catch (error) { editor = null; root.querySelector('[data-edit-tree]').replaceChildren(); editorStatus(error.message); }
    }
    async function saveVariable(remove) {
      if (!editor || !editor.path) return;
      var savingEditor = editor;
      var saveButton = root.querySelector('[data-edit-save]'); var deleteButton = root.querySelector('[data-edit-delete]');
      saveButton.disabled = deleteButton.disabled = true;
      try {
        var binding = messageBinding();
        if (binding.option.message_id !== editor.binding.option.message_id || binding.chat !== editor.binding.chat || binding.swipe !== editor.binding.swipe) throw new Error('当前消息已改变，请重新打开编辑。');
        var data = envelope(binding);
        if (JSON.stringify(editGet(data.stat_data, editor.path)) !== editor.expected) throw new Error('这个变量已被其他操作修改，请点击“重新读取”后再编辑。');
        var path = editor.path, parentPath = editor.adding ? path : path.slice(0, -1);
        var parent = editGet(data.stat_data, parentPath);
        if (!parent || typeof parent !== 'object') throw new Error('所属变量已删除，请重新读取。');
        if (editor.arrayParent !== null && JSON.stringify(parent) !== editor.arrayParent) throw new Error('列表已变化，请重新读取后再编辑。');
        var name = root.querySelector('[data-edit-key]').value;
        if (!name.trim() || ['__proto__','prototype','constructor'].includes(name)) throw new Error('请输入有效的变量名称。');
        var oldKey = path.at(-1);
        if (!remove && (editor.adding || name !== oldKey) && Object.hasOwn(parent, name)) throw new Error('同名变量已经存在。');
        if (remove) {
          if (Array.isArray(parent)) parent.splice(Number(oldKey), 1); else delete parent[oldKey];
        } else {
          var raw = root.querySelector('[data-edit-value]').value, type = root.querySelector('[data-edit-type]').value;
          var value;
          if (type === 'string') value = raw;
          else {
            try { value = JSON.parse(raw); } catch (_) { throw new Error('值的格式不正确：数字、布尔值、数组和对象请使用合法 JSON。'); }
            if (editType(value) !== type || type === 'number' && !Number.isFinite(value)) throw new Error('值与选择的类型不一致。');
          }
          if (Array.isArray(parent) && editor.adding) parent.push(value);
          else { if (!editor.adding && name !== oldKey) delete parent[oldKey]; parent[name] = value; }
        }
        await binding.target.Mvu.replaceMvuData(data, binding.option);
        if (editor === savingEditor && editor.path === path) {
          editor.base = envelope(binding).stat_data;
          editor.path = null; editorTree(); root.querySelector('[data-edit-form]').hidden = true;
          editorStatus(remove ? '已删除，变量管理器会同步更新。' : '已保存，变量管理器会同步更新。');
        }
        lastState = ''; render();
      } catch (error) { editorStatus(error.message || '保存失败，请重试。'); }
      finally { saveButton.disabled = deleteButton.disabled = false; }
    }
    root.querySelector('[data-edit-open]').addEventListener('click', openVariableEditor);
    root.querySelector('[data-edit-reload]').addEventListener('click', openVariableEditor);
    root.querySelector('[data-edit-close]').addEventListener('click', function () { root.querySelector('[data-variable-editor]').hidden = true; editor = null; });
    root.querySelector('[data-edit-cancel]').addEventListener('click', function () { root.querySelector('[data-edit-form]').hidden = true; editor.path = null; });
    root.querySelector('[data-edit-save]').addEventListener('click', function () { saveVariable(false); });
    root.querySelector('[data-edit-delete]').addEventListener('click', function () { saveVariable(true); });
