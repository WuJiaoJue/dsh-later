/**
 * 悬浮卡片状态行增补单测（issue #4）。
 *
 * 通过 `lib/client.js` 的 `apply` 驱动真实的 `mountSessionPresence`，并用最小
 * fake DOM 模拟宿主结构：
 *  - 会话行：`[role="treeitem"][draggable="true"]`，fiber 上挂 `node.id`；
 *  - 悬浮卡片：`body` 直系 portal，首个子元素为正文根（含状态点行）。
 *
 * 断言验收标准：
 *  1. 有活动定时任务的行，卡片出现定时状态行（条数 + 下次触发时间）；
 *  2. 无定时任务的行，卡片不追加任何节点；
 *  3. 宿主既有状态行原样保留（纯追加，不改写/不重排）。
 * @module tests/hover-card.test
 */
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

/**
 * 最小 DOM 实现：只覆盖 session-presence / apply 用到的 API 面。
 * 刻意不引 jsdom（保持零依赖，与本仓库其余 node --test 单测一致）。
 */
function createDom() {
  class ClassList {
    constructor(el) {
      this.el = el;
      this.set = new Set();
    }
    add(...names) {
      for (const n of names) this.set.add(n);
    }
    contains(name) {
      return this.set.has(name);
    }
    toString() {
      return [...this.set].join(' ');
    }
  }

  class El {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.attributes = new Map();
      this.dataset = {};
      this.parentElement = null;
      this._classList = new ClassList(this);
      this._text = '';
    }
    get classList() {
      return this._classList;
    }
    get className() {
      return this._classList.toString();
    }
    set className(v) {
      this._classList = new ClassList(this);
      for (const n of String(v).split(/\s+/).filter(Boolean)) this._classList.add(n);
    }
    get firstElementChild() {
      return this.children[0] ?? null;
    }
    get lastElementChild() {
      return this.children[this.children.length - 1] ?? null;
    }
    get textContent() {
      return this._text + this.children.map((c) => c.textContent).join('');
    }
    set textContent(v) {
      this._text = String(v);
      this.children = [];
    }
    setAttribute(k, v) {
      this.attributes.set(k, String(v));
    }
    getAttribute(k) {
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }
    hasAttribute(k) {
      return this.attributes.has(k);
    }
    append(...nodes) {
      for (const n of nodes) {
        n.parentElement = this;
        this.children.push(n);
      }
    }
    appendChild(node) {
      this.append(node);
      return node;
    }
    removeChild(node) {
      node.remove();
      return node;
    }
    insertBefore(node, ref) {
      const i = this.children.indexOf(ref);
      node.parentElement = this;
      this.children.splice(i < 0 ? this.children.length : i, 0, node);
      return node;
    }
    get id() {
      return this.getAttribute('id') ?? '';
    }
    set id(v) {
      this.setAttribute('id', v);
    }
    get innerHTML() {
      return this._html ?? '';
    }
    set innerHTML(v) {
      this._html = String(v);
      this.children = [];
      this._text = '';
    }
    get style() {
      this._style = this._style ?? {};
      return this._style;
    }
    set textContent(v) {
      this._text = String(v);
      this.children = [];
    }
    getAttributeNames() {
      return [...this.attributes.keys()];
    }
    after(node) {
      const p = this.parentElement;
      if (p === null) return;
      node.parentElement = p;
      p.children.splice(p.children.indexOf(this) + 1, 0, node);
    }
    remove() {
      const p = this.parentElement;
      if (p === null) return;
      const i = p.children.indexOf(this);
      if (i >= 0) p.children.splice(i, 1);
      this.parentElement = null;
    }
    /** 选择器支持 subset：`.cls` / `tag` / `[k="v"]` / 空格后代 / `:scope >`。 */
    matches(sel) {
      const parts = sel.trim().replace(/^:scope\s*>\s*/, '').split(/\s+/);
      return matchChain(this, parts);
    }
    querySelector(sel) {
      const scopeRel = sel.includes(':scope >');
      const cleaned = sel.replace(/:scope\s*>\s*/, '');
      const search = (node) => {
        for (const c of node.children) {
          if (matchChain(c, cleaned.split(/\s+/))) return c;
          if (!scopeRel || true) {
            const deep = search(c);
            if (deep !== null) return deep;
          }
        }
        return null;
      };
      return search(this);
    }
    querySelectorAll(sel) {
      const out = [];
      const cleaned = sel.replace(/:scope\s*>\s*/, '');
      const parts = cleaned.split(/\s+/);
      const walk = (node) => {
        for (const c of node.children) {
          if (matchChain(c, parts)) out.push(c);
          walk(c);
        }
      };
      walk(this);
      return out;
    }
    contains(other) {
      if (this === other) return true;
      return this.children.some((c) => c.contains(other));
    }
  }

  function matchSimple(el, token) {
    // 支持复合简单选择器（如 [role="treeitem"][draggable="true"] 或 div.cls）。
    const parts = token.match(/\[[^\]]+\]|^[a-zA-Z][\w-]*|\.[\w-]+/g);
    if (parts === null) return false;
    return parts.every((part) => {
      const attr = part.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
      if (attr !== null) {
        const [, k, v] = attr;
        return v === undefined ? el.hasAttribute(k) : el.getAttribute(k) === v;
      }
      if (part.startsWith('.')) return el.classList.contains(part.slice(1));
      return el.tagName === part.toUpperCase();
    });
  }

  function matchChain(el, parts) {
    if (parts.length === 0) return false;
    if (!matchSimple(el, parts[parts.length - 1])) return false;
    let node = el.parentElement;
    for (let i = parts.length - 2; i >= 0; i -= 1) {
      let ok = false;
      while (node !== null) {
        if (matchSimple(node, parts[i])) {
          ok = true;
          node = node.parentElement;
          break;
        }
        node = node.parentElement;
      }
      if (!ok) return false;
    }
    return true;
  }

  const doc = {
    body: new El('body'),
    head: new El('head'),
    visibilityState: 'visible',
    _listeners: new Map(),
    createElement: (tag) => new El(tag),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener(t, fn) {
      this._listeners.set(t, fn);
    },
    removeEventListener(t) {
      this._listeners.delete(t);
    },
  };
  doc.documentElement = new El('html');
  return { doc, El };
}

/** 让 bundle 内的 `instanceof HTMLElement` 判定对我们 fake El 生效。 */
function installHtmlElementGlobal(El) {
  const saved = globalThis.HTMLElement;
  globalThis.HTMLElement = El;
  return () => {
    if (saved === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = saved;
  };
}

/** 构造一个带 fiber 的会话行（fiber 上挂 node.id，供反查）。 */
function makeRow(El, sessionId) {
  const row = new El('div');
  row.setAttribute('role', 'treeitem');
  row.setAttribute('draggable', 'true');
  const slot = new El('span');
  row.append(slot);
  // 真实 React 挂的 __reactFiber$* 是可枚举属性（插件用 Object.keys 查找），
  // 因此这里必须是可枚举的，否则与生产行为不符。
  row['__reactFiber$test'] = { memoizedProps: { node: { id: sessionId } } };
  return row;
}

/** 构造与宿主实测结构同形的悬浮卡片（body 直系 portal）。 */
function makeHoverCard(El, body, sessionId) {
  const card = new El('div');
  const content = new El('div');
  const title = new El('div');
  title.textContent = 'sess title';
  const time = new El('div');
  time.textContent = '5h ago';
  const status = new El('div');
  const dot = new El('span');
  dot.setAttribute('aria-hidden', 'true');
  const label = new El('span');
  label.textContent = 'idle';
  status.append(dot, label);
  content.append(title, time, status);
  card.append(content);
  body.append(card);
  card['__reactFiber$test'] = { memoizedProps: { node: { id: sessionId } } };
  return { card, content };
}

/** 装载客户端 bundle：bundle 是浏览器模块加载器格式，这里提供最小 shim。 */
async function loadClientBundle() {
  const src = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  let captured;
  globalThis.window = globalThis.window ?? {};
  globalThis.window.__ModuleLoader__ = {
    load: (def) => {
      captured = def;
    },
  };
  // 执行 bundle：它只调用 window.__ModuleLoader__.load({ id, factory })。
  // eslint-disable-next-line no-new-func
  new Function('window', src)(globalThis.window);
  if (captured === undefined) throw new Error('bundle did not register a module');
  const require = (id) => {
    // 本测只驱动 session-presence 的 DOM 层；React 组件不参与渲染，给最小桩。
    if (id === 'react') {
      return {
        createElement: () => null,
        Fragment: () => null,
        useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
        useEffect: () => {},
        useMemo: (f) => f(),
        useCallback: (f) => f,
        useRef: (v) => ({ current: v }),
        useSyncExternalStore: (_sub, get) => get(),
      };
    }
    if (id === 'react/jsx-runtime' || id === 'react/jsx-dev-runtime') {
      return { jsx: () => null, jsxs: () => null, Fragment: () => null };
    }
    if (id === 'react-dom' || id === 'react-dom/client') {
      return { createPortal: () => null, createRoot: () => ({ render() {}, unmount() {} }) };
    }
    throw new Error(`unexpected host require: ${id}`);
  };
  return captured.factory(require);
}

test('悬浮卡片：有活动定时任务时追加状态行，无任务时不追加', async () => {
  const { doc, El } = createDom();
  const savedDoc = globalThis.document;
  const savedMO = globalThis.MutationObserver;
  const savedWin = globalThis.window;
  globalThis.document = doc;
  // MO 桩：记录回调，供测试显式触发（等效真实 DOM 变更驱动的重扫）。
  let moCallback;
  globalThis.MutationObserver = class {
    constructor(cb) {
      moCallback = cb;
    }
    observe() {}
    disconnect() {
      moCallback = undefined;
    }
  };
  const fireMutation = () => moCallback?.();
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const restoreHTMLElement = installHtmlElementGlobal(El);

  try {
    const mod = await loadClientBundle();
    const SESSION = 'session-abc';

    const stores = {
      byId: {
        [SESSION]: {
          projectionValues: { userSchedules: { schedules: [{ scheduled_at: new Date(Date.now() + 3600_000).toISOString() }] } },
        },
      },
    };
    const sessions = {
      list: { getSnapshot: () => stores, subscribe: () => () => {} },
      refresh: async () => {},
    };

    const disposers = [];
    const ctx = {
      get: (name) => {
        if (name === 'slots') return { register: () => () => {}, inject: (hole, fn) => { try { fn(); } catch { /* 本测不需要插槽 */ } }, subscribe: () => () => {}, entries: () => [], entriesOfSlot: () => [] };
        if (name === 'sessions') return sessions;
        if (name === 'locale') return { getSnapshot: () => ({ active: 'zh' }), subscribe: () => () => {}, register: () => () => {} };
        return undefined;
      },
      effect: (fn) => {
        // apply 的 effect 返回清理函数；收集以便测试结束卸载（清掉 setInterval，
        // 否则 node --test 会因挂起的定时器不退出）。
        const dispose = fn();
        if (typeof dispose === 'function') disposers.push(dispose);
        return () => {};
      },
      on: () => () => {},
    };
    // apply 除 ctx.get('slots') 外还直接访问 ctx.slots（插槽注册）。
    ctx.slots = ctx.get('slots');

    try {
      mod.apply(ctx);

      // 行 + 卡片进入 DOM，然后驱动 mountSessionPresence 注册的扫描。
      const row = makeRow(El, SESSION);
      doc.body.append(row);
      const { content } = makeHoverCard(El, doc.body, SESSION);

      // scan 是防抖的：等待去抖窗口（小于 30s 的 state tick）。
      await new Promise((r) => setTimeout(r, 150));

      const rowsNow = () => content.children.filter((c) => c.classList.contains('ss-hover-status'));

      assert.equal(rowsNow().length, 1, '有任务时应追加恰好一行定时状态');
      const added = rowsNow()[0];
      assert.match(added.textContent, /1/, '状态行应含任务条数');
      // 宿主既有状态行保留（纯追加，不改写/不重排）。
      const idle = content.children.find((c) => c.textContent.includes('idle'));
      assert.ok(idle !== undefined, '宿主既有「空闲」状态行必须原样保留');
      assert.equal(content.children[0].textContent, 'sess title');
      assert.equal(content.children.length, 4, '标题/时间/空闲 + 追加一行');

      // 无任务：清掉任务后重扫 → 追加行应被移除。
      // 生产环境由 MutationObserver / store 订阅触发重扫；本测的 MO 是惰性桩，
      // 故显式发一次 DOM 变更来驱动同一路径（与真实触发等效）。
      stores.byId[SESSION].projectionValues.userSchedules.schedules = [];
      fireMutation();
      await new Promise((r) => setTimeout(r, 150));
      assert.equal(rowsNow().length, 0, '无任务时不应残留追加行');
      assert.equal(content.children.length, 3, '无任务时应恢复为宿主原有三行');
    } finally {
      for (const d of disposers) d();
    }
  } finally {
    restoreHTMLElement();
    globalThis.document = savedDoc;
    globalThis.MutationObserver = savedMO;
    globalThis.window = savedWin;
  }
});

test('悬浮卡片：无 fiber 关联的浮层不被误标', async () => {
  const { doc, El } = createDom();
  const savedDoc = globalThis.document;
  const savedMO = globalThis.MutationObserver;
  const savedWin = globalThis.window;
  globalThis.document = doc;
  // MO 桩：记录回调，供测试显式触发（等效真实 DOM 变更驱动的重扫）。
  let moCallback;
  globalThis.MutationObserver = class {
    constructor(cb) {
      moCallback = cb;
    }
    observe() {}
    disconnect() {
      moCallback = undefined;
    }
  };
  const fireMutation = () => moCallback?.();
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const restoreHTMLElement = installHtmlElementGlobal(El);

  try {
    const mod = await loadClientBundle();
    const stores = {
      byId: {
        'session-x': { projectionValues: { userSchedules: { schedules: [{ scheduled_at: new Date(Date.now() + 3600_000).toISOString() }] } } },
      },
    };
    const sessions = { list: { getSnapshot: () => stores, subscribe: () => () => {} }, refresh: async () => {} };
    const disposers = [];
    const ctx = {
      get: (name) => {
        if (name === 'slots') return { register: () => () => {}, inject: (hole, fn) => { try { fn(); } catch { /* 本测不需要插槽 */ } }, subscribe: () => () => {}, entries: () => [], entriesOfSlot: () => [] };
        if (name === 'sessions') return sessions;
        if (name === 'locale') return { getSnapshot: () => ({ active: 'zh' }), subscribe: () => () => {}, register: () => () => {} };
        return undefined;
      },
      effect: (fn) => {
        const dispose = fn();
        if (typeof dispose === 'function') disposers.push(dispose);
        return () => {};
      },
      on: () => () => {},
    };
    // apply 除 ctx.get('slots') 外还直接访问 ctx.slots（插槽注册）。
    ctx.slots = ctx.get('slots');

    try {
      mod.apply(ctx);

      // 一个结构类似但没有 fiber 的浮层：必须安静跳过（绝不误标）。
      const card = new El('div');
      const content = new El('div');
      const status = new El('div');
      const dot = new El('span');
      dot.setAttribute('aria-hidden', 'true');
      const lbl = new El('span');
      lbl.textContent = 'idle';
      status.append(dot, lbl);
      content.append(status);
      card.append(content);
      doc.body.append(card);

      await new Promise((r) => setTimeout(r, 150));
      assert.equal(content.children.filter((c) => c.classList.contains('ss-hover-status')).length, 0);
    } finally {
      for (const d of disposers) d();
    }
  } finally {
    restoreHTMLElement();
    globalThis.document = savedDoc;
    globalThis.MutationObserver = savedMO;
    globalThis.window = savedWin;
  }
});
