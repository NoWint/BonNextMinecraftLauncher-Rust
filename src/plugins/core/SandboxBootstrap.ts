// src/plugins/core/SandboxBootstrap.ts

/**
 * 注入 iframe srcdoc 的 bootstrap HTML。
 * 此字符串在 iframe 内运行，与主窗口隔离（opaque origin）。
 *
 * 流程：
 * 1. iframe 加载后向 parent 发送 'ready'
 * 2. 接收 'load' 消息，含 pluginSource（插件入口 JS 源码）
 * 3. 创建 Blob URL，用 import() 加载为模块
 * 4. 取 module.default 作为 PluginDefinition
 * 5. 构造代理 PluginContext（所有方法通过 postMessage 调用 host）
 * 6. 调用 definition.activate(proxiedCtx)
 * 7. 发送 'activated' 或 'error'
 * 8. 持续监听 RPC 响应和事件推送
 */
export const SANDBOX_BOOTSTRAP_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>sandbox</title></head>
<body>
<script>
(function() {
  var pendingRpc = new Map(); // id -> {resolve, reject}
  var eventHandlers = new Map(); // event -> Set<handler>

  function send(msg) {
    window.parent.postMessage(msg, '*');
  }

  // 生成唯一 RPC ID
  function genId() {
    return 'rpc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  }

  // 发起 RPC 请求到 host
  function rpc(method, args) {
    return new Promise(function(resolve, reject) {
      var id = genId();
      pendingRpc.set(id, { resolve: resolve, reject: reject });
      send({ kind: 'rpc', id: id, method: method, args: args });
      // 超时 30s
      setTimeout(function() {
        if (pendingRpc.has(id)) {
          pendingRpc.delete(id);
          reject(new Error('RPC timeout: ' + method));
        }
      }, 30000);
    });
  }

  // 构造代理 PluginContext
  function createProxiedContext(pluginId, permissions) {
    return {
      pluginId: pluginId,
      registerRoute: function(path, lazyComponent) {
        // sandbox 插件无法渲染 React 组件到主窗口，只能注册路径占位
        // lazyComponent 是函数，无法跨 iframe 传递，这里只注册路径
        rpc('register-route', [path]);
      },
      addSidebarItem: function(item) {
        rpc('add-sidebar-item', [item]);
      },
      addSettingsSection: function(section) {
        rpc('add-settings-section', [section]);
      },
      addContextMenuItem: function(item) {
        rpc('add-context-menu-item', [item]);
      },
      addInstanceTab: function(tab) {
        rpc('add-instance-tab', [tab]);
      },
      registerTheme: function(theme) {
        rpc('register-theme', [theme]);
      },
      invoke: function(command, args) {
        return rpc('invoke', [command, args]);
      },
      http: {
        get: function(url, options) {
          return rpc('http-get', [url, options]);
        },
        post: function(url, body, options) {
          return rpc('http-post', [url, body, options]);
        }
      },
      fs: {
        readFile: function(path) { return rpc('fs-read', [path]); },
        writeFile: function(path, content) { return rpc('fs-write', [path, content]); },
        readDir: function(path) { return rpc('fs-readdir', [path]); },
        exists: function(path) { return rpc('fs-exists', [path]); }
      },
      events: {
        on: function(event, handler) {
          if (!eventHandlers.has(event)) eventHandlers.set(event, new Set());
          eventHandlers.get(event).add(handler);
          // 通知 host 我们要监听此事件（host 决定是否转发）
          return function() {
            var set = eventHandlers.get(event);
            if (set) { set.delete(handler); }
          };
        },
        emit: function(event, data) {
          rpc('emit-event', [event, data]);
        }
      },
      storage: {
        get: function(key) { return rpc('storage-get', [key]); },
        set: function(key, value) { return rpc('storage-set', [key, value]); },
        delete: function(key) { return rpc('storage-delete', [key]); }
      },
      logger: {
        info: function(msg) { rpc('log-info', [msg]); },
        warn: function(msg) { rpc('log-warn', [msg]); },
        error: function(msg) { rpc('log-error', [msg]); }
      },
      provide: function(serviceId, factory) {
        // factory 无法跨 iframe 传递，sandbox 插件提供的服务只能在 iframe 内使用
        // 通知 host 注册服务元信息（host 记录但不暴露 factory）
        rpc('provide-service', [serviceId]);
      },
      consume: function(serviceId) {
        // sandbox 插件只能消费 host 侧已实例化的服务（返回 JSON 可序列化的快照）
        return rpc('consume-service', [serviceId]);
      },
      requestService: function(serviceId, timeoutMs) {
        return rpc('request-service', [serviceId, timeoutMs]);
      }
    };
  }

  // 监听 host 消息
  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.kind === 'load') {
      loadPlugin(msg.pluginId, msg.pluginSource, msg.permissions);
    } else if (msg.kind === 'rpc-response') {
      var pending = pendingRpc.get(msg.id);
      if (pending) {
        pendingRpc.delete(msg.id);
        if (msg.ok) pending.resolve(msg.result);
        else pending.reject(new Error(msg.error || 'RPC failed'));
      }
    } else if (msg.kind === 'event-push') {
      var handlers = eventHandlers.get(msg.event);
      if (handlers) handlers.forEach(function(h) { try { h(msg.data); } catch(e){ console.error(e); } });
    } else if (msg.kind === 'deactivate') {
      try {
        if (window.__pluginDeactivate) window.__pluginDeactivate();
      } catch(e) { console.error(e); }
      send({ kind: 'deactivated' });
    }
  });

  function loadPlugin(pluginId, source, permissions) {
    try {
      var blob = new Blob([source], { type: 'application/javascript' });
      var url = URL.createObjectURL(blob);
      import(url).then(function(mod) {
        var def = mod.default || mod;
        if (!def || typeof def.activate !== 'function') {
          send({ kind: 'error', message: 'Plugin entry has no valid default export with activate()' });
          return;
        }
        window.__pluginDefinition = def;
        var ctx = createProxiedContext(pluginId, permissions);
        Promise.resolve(def.activate(ctx)).then(function() {
          if (def.deactivate) window.__pluginDeactivate = def.deactivate;
          send({ kind: 'activated' });
        }).catch(function(e) {
          send({ kind: 'error', message: e.message, stack: e.stack });
        });
      }).catch(function(e) {
        send({ kind: 'error', message: 'Failed to import plugin: ' + e.message, stack: e.stack });
      });
    } catch(e) {
      send({ kind: 'error', message: e.message, stack: e.stack });
    }
  }

  // 通知 host 已就绪
  send({ kind: 'ready' });
})();
</script>
</body>
</html>`;
