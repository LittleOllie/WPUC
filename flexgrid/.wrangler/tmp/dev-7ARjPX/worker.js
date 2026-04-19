var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../../../../usr/local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");

// ../../../../../usr/local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../../../../usr/local/lib/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
if (!("__unenv__" in performance)) {
  const proto = Performance.prototype;
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== "constructor" && !(key in performance)) {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (desc) {
        Object.defineProperty(performance, key, desc);
      }
    }
  }
}
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../../../../../usr/local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../../../../../usr/local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../../../../usr/local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../../../../../usr/local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// ../../../../../usr/local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../../../../../usr/local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// ../../../../../usr/local/lib/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../../../../../usr/local/lib/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// worker.js
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400"
};
var ALCHEMY_HOSTS = {
  eth: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  polygon: "polygon-mainnet.g.alchemy.com",
  apechain: "apechain-mainnet.g.alchemy.com"
};
var MORALIS_APE_CHAIN_FALLBACKS = ["ape", "0x8173", "33139", "apechain", "ape_chain"];
var MORALIS_API_BASE = "https://deep-index.moralis.io/api/v2.2";
var MORALIS_OUTBOUND_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
function getMoralisApeChainCandidates(env2) {
  const o = env2?.MORALIS_APECHAIN_CHAIN;
  const s = o && typeof o === "string" ? o.trim().toLowerCase() : "";
  if (s) {
    return [s, ...MORALIS_APE_CHAIN_FALLBACKS.filter((x) => x !== s)];
  }
  return [...MORALIS_APE_CHAIN_FALLBACKS];
}
__name(getMoralisApeChainCandidates, "getMoralisApeChainCandidates");
async function moralisApeGetParsed(env2, buildUrl, timeoutMs = 3e4, chainCandidatesOverride = null) {
  const cands = Array.isArray(chainCandidatesOverride) ? chainCandidatesOverride : getMoralisApeChainCandidates(env2);
  const headers = getMoralisHeaders(env2);
  let lastErr = "";
  for (const chainParam of cands) {
    const urlStr = buildUrl(chainParam);
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(urlStr, { headers, signal: controller.signal });
      const text = await res.text();
      if (res.status === 401 || res.status === 403) {
        throw new Error(`[Moralis] ${res.status} ${text.slice(0, 600)}`);
      }
      if (res.ok) {
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          throw new Error("[Moralis ApeChain] invalid JSON body");
        }
        console.log("[FlexGrid][ApeChain] Moralis chain resolved:", chainParam);
        return { data, chainParam };
      }
      lastErr = `[Moralis ApeChain] ${res.status} ${text.slice(0, 800)}`;
      console.warn("[FlexGrid][ApeChain] chain candidate failed:", chainParam, "status=", res.status);
    } catch (e) {
      if (String(e?.message || "").startsWith("[Moralis]")) throw e;
      if (e?.name === "AbortError") {
        throw new Error("[Moralis ApeChain] request timed out");
      }
      lastErr = e?.message || String(e);
      console.warn("[FlexGrid][ApeChain] chain candidate error:", chainParam, lastErr);
    } finally {
      clearTimeout(tid);
    }
  }
  throw new Error(lastErr || "[Moralis ApeChain] all chain candidates failed");
}
__name(moralisApeGetParsed, "moralisApeGetParsed");
function moralisWalletNftRows(data) {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.result)) return data.result;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.nft)) return data.nft;
  if (Array.isArray(data.nfts)) return data.nfts;
  if (Array.isArray(data.items)) return data.items;
  return [];
}
__name(moralisWalletNftRows, "moralisWalletNftRows");
function buildMoralisWalletNftUrl(ownerVal, chainParam, cursor, contractAddresses, minimal, apiBase = MORALIS_API_BASE) {
  const u = new URL(`${apiBase}/${encodeURIComponent(ownerVal)}/nft`);
  u.searchParams.set("chain", chainParam);
  u.searchParams.set("format", "decimal");
  u.searchParams.set("limit", "100");
  if (cursor) u.searchParams.set("cursor", cursor);
  if (contractAddresses?.length) {
    for (const a of contractAddresses) u.searchParams.append("token_addresses", a);
  }
  if (!minimal) {
    u.searchParams.set("media_items", "true");
    u.searchParams.set("normalizeMetadata", "true");
  }
  return u.toString();
}
__name(buildMoralisWalletNftUrl, "buildMoralisWalletNftUrl");
function alchemyGetNftsForOwnerUrl(_chain, host, apiKey) {
  return `https://${host}/nft/v3/${apiKey}/getNFTsForOwner`;
}
__name(alchemyGetNftsForOwnerUrl, "alchemyGetNftsForOwnerUrl");
function pickAlchemyApiKeyForChain(env2, chain) {
  const c = String(chain || "").trim().toLowerCase();
  const main = env2.ALCHEMY_API_KEY;
  const mainTrim = main && typeof main === "string" ? main.trim() : "";
  if (c === "apechain") {
    const ape = env2.ALCHEMY_API_KEY_APECHAIN;
    const apeTrim = ape && typeof ape === "string" ? ape.trim() : "";
    return apeTrim || mainTrim || "";
  }
  return mainTrim;
}
__name(pickAlchemyApiKeyForChain, "pickAlchemyApiKeyForChain");
function getMoralisApiKey(env2) {
  const k = env2.MORALIS_API_KEY;
  return k && typeof k === "string" ? k.trim() : "";
}
__name(getMoralisApiKey, "getMoralisApiKey");
function getMoralisHeaders(env2) {
  const apiKey = getMoralisApiKey(env2);
  if (!apiKey) {
    throw new Error("Missing MORALIS_API_KEY (set Cloudflare secret MORALIS_API_KEY for ApeChain).");
  }
  return {
    "X-API-Key": apiKey,
    Accept: "application/json",
    "User-Agent": MORALIS_OUTBOUND_UA
  };
}
__name(getMoralisHeaders, "getMoralisHeaders");
var IPFS_GATEWAYS = [
  "https://dweb.link/ipfs/",
  "https://w3s.link/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/"
];
var ORIGIN_FETCH_CF = {
  cacheEverything: true,
  cacheTtl: 86400
};
var IMAGE_FETCH_TIMEOUT_MS = 8e3;
var IMAGE_HTTP_RETRY_DELAY_MS = 400;
var MAX_IMAGE_BYTES = 45 * 1024 * 1024;
var ALLOWED_IMAGE_TYPES = [
  "image/",
  "application/octet-stream"
  // some IPFS gateways
];
var DEFAULT_IMAGE_CONTENT_TYPE = "image/png";
function imageProxyDebug(env2, message, extra) {
  if (env2?.IMAGE_PROXY_DEBUG !== "1" && env2?.IMAGE_PROXY_DEBUG !== "true") return;
  if (extra !== void 0) console.log("[img]", message, extra);
  else console.log("[img]", message);
}
__name(imageProxyDebug, "imageProxyDebug");
function fullyDecodeUrlParam(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  for (let i = 0; i < 5; i++) {
    try {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    } catch {
      break;
    }
  }
  return s.trim();
}
__name(fullyDecodeUrlParam, "fullyDecodeUrlParam");
function repairBrokenImageUrl(url) {
  if (!url || typeof url !== "string") return url;
  let s = url.trim();
  if (!s) return url;
  if (s.startsWith("//")) s = `https:${s}`;
  s = s.replace(/^https:\/\/{2,}2F(?=[a-zA-Z0-9])/i, "https://");
  s = s.replace(/^http:\/\/{2,}2F(?=[a-zA-Z0-9])/i, "http://");
  s = s.replace(/^https:\/\/{3,}/i, "https://");
  s = s.replace(/^http:\/\/{3,}/i, "http://");
  return s;
}
__name(repairBrokenImageUrl, "repairBrokenImageUrl");
function moralisCoerceUrlString(val) {
  if (val == null) return null;
  if (typeof val === "object" && val) {
    const u = val.url || val.uri || val.gateway || val.cdnUrl;
    if (typeof u === "string" && u.trim()) return repairBrokenImageUrl(u.trim());
    return null;
  }
  if (typeof val !== "string") return null;
  let s = val.trim();
  if (!s || s === "[object Object]") return null;
  if (s.startsWith('"') && s.endsWith('"') || s.startsWith("'") && s.endsWith("'")) {
    try {
      const j = JSON.parse(s);
      if (typeof j === "string") s = j;
      else s = s.slice(1, -1);
    } catch {
      s = s.slice(1, -1);
    }
  }
  s = s.trim();
  return s ? repairBrokenImageUrl(s) : null;
}
__name(moralisCoerceUrlString, "moralisCoerceUrlString");
function moralisTokenUriAsImageCandidate(uri) {
  const s = moralisCoerceUrlString(uri);
  if (!s) return null;
  if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|#|$)/i.test(s)) return s;
  if (/^ipfs:\/\/.+\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|#|$)/i.test(s)) return s;
  return null;
}
__name(moralisTokenUriAsImageCandidate, "moralisTokenUriAsImageCandidate");
function normalizeIPFS(url) {
  if (!url) return null;
  let s = url;
  try {
    s = decodeURIComponent(s);
  } catch {
  }
  if (s.startsWith("ipfs://")) {
    let path = s.slice("ipfs://".length).replace(/^\/+/, "");
    path = path.replace(/^ipfs\//i, "");
    return path || null;
  }
  const match = s.match(/\/ipfs\/(.+)/i);
  if (match) {
    let path = match[1].split("?")[0].split("#")[0];
    try {
      path = decodeURIComponent(path);
    } catch {
    }
    return path.replace(/^\/+/, "") || null;
  }
  try {
    const u = new URL(s);
    if (u.protocol === "http:" || u.protocol === "https:") {
      const host = u.hostname.toLowerCase();
      const sub = host.match(/^([a-zA-Z0-9]{30,})\.ipfs\.(w3s\.link|dweb\.link)$/);
      if (sub) {
        const cid = sub[1];
        const tail = (u.pathname || "").replace(/^\/+/, "").split("?")[0].split("#")[0];
        return tail ? `${cid}/${tail}` : cid;
      }
    }
  } catch {
  }
  return null;
}
__name(normalizeIPFS, "normalizeIPFS");
function sanitizeIpfsPathForGateway(ipfsPath) {
  if (!ipfsPath) return "";
  return String(ipfsPath).replace(/^\/+/, "").trim();
}
__name(sanitizeIpfsPathForGateway, "sanitizeIpfsPathForGateway");
var BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
function headersForImageOrigin(url) {
  const u = String(url || "");
  if (/arweave\.net|ar-io\.dev/i.test(u)) {
    return {
      "User-Agent": BROWSER_UA,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
    };
  }
  if (/\.ipfs\.w3s\.link|\.ipfs\.dweb\.link|\/ipfs\/|ipfs\.io\/ipfs|nftstorage\.link\/ipfs|cloudflare-ipfs/i.test(u)) {
    return {
      "User-Agent": BROWSER_UA,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
    };
  }
  if (/seadn\.io|looksrare|cdn\.blur\.io|openseauserdata\.com/i.test(u)) {
    return {
      "User-Agent": BROWSER_UA,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: "https://opensea.io/"
    };
  }
  return { "User-Agent": "FlexGrid-ImageProxy/2.0" };
}
__name(headersForImageOrigin, "headersForImageOrigin");
async function fetchWithTimeout(resource, timeoutMs = IMAGE_FETCH_TIMEOUT_MS, headerOverrides = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(resource, {
      redirect: "follow",
      headers: {
        ...headersForImageOrigin(resource),
        ...headerOverrides
      },
      signal: controller.signal,
      cf: ORIGIN_FETCH_CF
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}
__name(fetchWithTimeout, "fetchWithTimeout");
function isAcceptableImageResponse(res, { allowUnknownContentType } = {}) {
  if (!res || !res.ok) return false;
  const lenHeader = res.headers.get("Content-Length");
  if (lenHeader) {
    const n = parseInt(lenHeader, 10);
    if (Number.isFinite(n) && n > MAX_IMAGE_BYTES) return false;
  }
  const ct = (res.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (!ct) return !!allowUnknownContentType;
  if (ALLOWED_IMAGE_TYPES.some((p) => ct.startsWith(p))) return true;
  if (allowUnknownContentType && ct === "") return true;
  if (ct.includes("text/html") || ct.includes("application/json")) return false;
  return !!allowUnknownContentType;
}
__name(isAcceptableImageResponse, "isAcceptableImageResponse");
function buildImageProxyResponse(originResponse, contentType) {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Expose-Headers", "Content-Type, Content-Length, Cache-Control");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Content-Type", contentType || DEFAULT_IMAGE_CONTENT_TYPE);
  const len = originResponse.headers.get("Content-Length");
  if (len) headers.set("Content-Length", len);
  return new Response(originResponse.body, {
    status: 200,
    statusText: "OK",
    headers
  });
}
__name(buildImageProxyResponse, "buildImageProxyResponse");
function imageProxyError(status, message) {
  return new Response(message, {
    status,
    headers: {
      ...CORS,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60"
    }
  });
}
__name(imageProxyError, "imageProxyError");
async function fetchIPFS(ipfsPath, env2) {
  const path = sanitizeIpfsPathForGateway(ipfsPath);
  if (!path) return null;
  const tryOnce = /* @__PURE__ */ __name(async () => {
    for (const gateway of IPFS_GATEWAYS) {
      const url = gateway + path;
      try {
        const res2 = await fetchWithTimeout(url, IMAGE_FETCH_TIMEOUT_MS);
        if (isAcceptableImageResponse(res2, { allowUnknownContentType: true })) {
          return res2;
        }
      } catch {
      }
    }
    return null;
  }, "tryOnce");
  let res = await tryOnce();
  if (res) return res;
  await new Promise((r) => setTimeout(r, IMAGE_HTTP_RETRY_DELAY_MS));
  res = await tryOnce();
  return res;
}
__name(fetchIPFS, "fetchIPFS");
async function fetchHttpImage(decodedUrl, env2) {
  const attempts = [
    () => fetchWithTimeout(decodedUrl, IMAGE_FETCH_TIMEOUT_MS),
    async () => {
      await new Promise((r) => setTimeout(r, IMAGE_HTTP_RETRY_DELAY_MS));
      return fetchWithTimeout(decodedUrl, IMAGE_FETCH_TIMEOUT_MS);
    }
  ];
  const relaxCtOnRetry = /seadn\.io|openseauserdata\.com/i.test(decodedUrl);
  for (let i = 0; i < attempts.length; i++) {
    try {
      const res = await attempts[i]();
      const allowUnknown = relaxCtOnRetry && i > 0;
      if (isAcceptableImageResponse(res, { allowUnknownContentType: allowUnknown })) {
        return res;
      }
    } catch {
    }
  }
  return null;
}
__name(fetchHttpImage, "fetchHttpImage");
async function fetchDirectIpfsUrl(decodedUrl, env2) {
  if (!/^https?:\/\//i.test(decodedUrl)) return null;
  const looksIpfs = /\/ipfs\//i.test(decodedUrl) || /\.ipfs\.(w3s\.link|dweb\.link)/i.test(decodedUrl) || /ipfs\.io\/ipfs/i.test(decodedUrl);
  if (!looksIpfs) return null;
  try {
    const res = await fetchWithTimeout(decodedUrl, IMAGE_FETCH_TIMEOUT_MS);
    if (isAcceptableImageResponse(res, { allowUnknownContentType: true })) return res;
  } catch {
  }
  return null;
}
__name(fetchDirectIpfsUrl, "fetchDirectIpfsUrl");
async function handleImageProxy(request, env2, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }
  const urlObj = new URL(request.url);
  const rawParam = urlObj.searchParams.get("url");
  if (!rawParam || !String(rawParam).trim()) {
    return imageProxyError(400, "Missing url");
  }
  let decodedUrl = fullyDecodeUrlParam(rawParam);
  if (!decodedUrl) {
    return imageProxyError(400, "Invalid url");
  }
  decodedUrl = repairBrokenImageUrl(decodedUrl);
  if (/^data:image\//i.test(decodedUrl)) {
    const m = decodedUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i);
    if (m) {
      try {
        const binStr = atob(m[2].replace(/\s/g, ""));
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        return new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type": m[1],
            "Cache-Control": "public, max-age=86400",
            ...CORS
          }
        });
      } catch (e) {
        return imageProxyError(400, "Invalid data URL");
      }
    }
    return imageProxyError(400, "Unsupported data URL (use base64 image/* only)");
  }
  if (/^ar:\/\//i.test(decodedUrl)) {
    const id = decodedUrl.replace(/^ar:\/\//i, "").replace(/^\/+/, "");
    decodedUrl = id ? `https://arweave.net/${id}` : decodedUrl;
  }
  const ipfsPath = normalizeIPFS(decodedUrl);
  imageProxyDebug(env2, "Fetching:", decodedUrl);
  imageProxyDebug(env2, "IPFS path:", ipfsPath);
  let originRes = null;
  if (ipfsPath) {
    originRes = await fetchDirectIpfsUrl(decodedUrl, env2);
    if (!originRes) {
      originRes = await fetchIPFS(ipfsPath, env2);
    }
  } else {
    if (!/^https?:\/\//i.test(decodedUrl)) {
      return imageProxyError(400, "Unsupported URL scheme");
    }
    originRes = await fetchHttpImage(decodedUrl, env2);
  }
  if (!originRes || !originRes.ok) {
    return imageProxyError(404, "Image not found");
  }
  const ct = originRes.headers.get("Content-Type")?.split(";")[0].trim() || DEFAULT_IMAGE_CONTENT_TYPE;
  const out = buildImageProxyResponse(originRes, ct);
  try {
    ctx.waitUntil(cache.put(cacheKey, out.clone()));
  } catch (e) {
    console.warn("[img] cache.put failed:", e?.message || e);
  }
  return out;
}
__name(handleImageProxy, "handleImageProxy");
function corsResponse(body, status = 200, contentType = "application/json") {
  return new Response(body, {
    status,
    headers: { "Content-Type": contentType, ...CORS }
  });
}
__name(corsResponse, "corsResponse");
function tryParseJsonObject(val) {
  if (val == null) return null;
  if (typeof val === "object") return val;
  if (typeof val !== "string") return null;
  const t = val.trim();
  if (!t || t[0] !== "{" && t[0] !== "[") return null;
  try {
    const o = JSON.parse(t);
    return typeof o === "object" && o !== null ? o : null;
  } catch {
    return null;
  }
}
__name(tryParseJsonObject, "tryParseJsonObject");
function mergedTokenMetadata(nft) {
  const m0 = tryParseJsonObject(nft?.metadata) || (typeof nft?.metadata === "object" && nft.metadata ? nft.metadata : {});
  const m1 = tryParseJsonObject(nft?.rawMetadata) || (typeof nft?.rawMetadata === "object" && nft.rawMetadata ? nft.rawMetadata : {});
  const m2 = tryParseJsonObject(nft?.raw?.metadata) || (typeof nft?.raw?.metadata === "object" && nft.raw?.metadata ? nft.raw.metadata : {});
  return { ...m0, ...m1, ...m2 };
}
__name(mergedTokenMetadata, "mergedTokenMetadata");
function collectionOpenSeaImageUrl(nft) {
  const os = nft?.contractMetadata?.openSea || nft?.contractMetadata?.openSeaMetadata || nft?.contract?.openSea || nft?.contract?.openSeaMetadata || nft?.collection?.openSea || nft?.collection?.openSeaMetadata || {};
  const u = os.imageUrl || os.image_url;
  if (typeof u === "string" && u.trim()) return u.trim();
  const colImg = typeof nft?.collection?.imageUrl === "string" && nft.collection.imageUrl.trim() || typeof nft?.collection?.image_url === "string" && nft.collection.image_url.trim() || null;
  return colImg || null;
}
__name(collectionOpenSeaImageUrl, "collectionOpenSeaImageUrl");
function resolveTokenImageUrl(nft, collectionLogo) {
  const merged = mergedTokenMetadata(nft);
  const normLogo = collectionLogo ? String(collectionLogo).trim() : "";
  const tryStr = /* @__PURE__ */ __name((c) => {
    if (c == null) return null;
    const s = repairBrokenImageUrl(String(c).trim());
    if (!s) return null;
    if (normLogo && s === normLogo) return null;
    return s;
  }, "tryStr");
  const rawCandidates = [
    merged.image,
    merged.image_url,
    nft?.raw?.metadata?.image,
    nft?.raw?.metadata?.image_url,
    nft?.media?.[0]?.thumbnail,
    nft?.media?.[0]?.gateway,
    nft?.media?.[0]?.raw
  ];
  for (const c of rawCandidates) {
    if (c == null) continue;
    if (typeof c === "object" && c && typeof c.url === "string") {
      const s2 = tryStr(c.url);
      if (s2) return s2;
      continue;
    }
    const s = tryStr(c);
    if (s) return s;
  }
  const img = nft?.image;
  if (img != null) {
    const u = typeof img === "string" ? img : img?.cachedUrl || img?.pngUrl || img?.thumbnailUrl || img?.originalUrl || "";
    const s = String(u).trim();
    if (s && (!normLogo || s !== normLogo)) return s;
  }
  return null;
}
__name(resolveTokenImageUrl, "resolveTokenImageUrl");
function buildCleanedNft(nft) {
  const collectionLogo = collectionOpenSeaImageUrl(nft);
  const image = resolveTokenImageUrl(nft, collectionLogo);
  const merged = mergedTokenMetadata(nft);
  const meta = { ...merged };
  if (typeof meta.image === "string" && collectionLogo && meta.image.trim() === collectionLogo) {
    delete meta.image;
  }
  if (typeof meta.image_url === "string" && collectionLogo && meta.image_url.trim() === collectionLogo) {
    delete meta.image_url;
  }
  if (image) {
    meta.image = image;
  }
  return {
    ...nft,
    contract: nft.contract || { address: nft.contract?.address },
    contractAddress: nft.contract?.address,
    name: nft.title || nft.metadata?.name || nft.name || "Unknown",
    image: image || null,
    metadata: meta,
    media: nft?.media?.length ? nft.media : image ? [{ gateway: image, raw: image }] : [],
    collection: nft.collection || { name: nft.contractMetadata?.name || "Unknown Collection" },
    contractMetadata: nft.contractMetadata || { name: nft.contractMetadata?.name || "Unknown Collection" },
    tokenId: nft.id?.tokenId ?? nft.tokenId,
    id: nft.id || { tokenId: nft.id?.tokenId ?? nft.tokenId },
    balance: nft.balance ?? "1",
    tokenType: nft.tokenType || nft.id?.tokenMetadata?.tokenType || "ERC721"
  };
}
__name(buildCleanedNft, "buildCleanedNft");
function safeJsonParseMoralis(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
__name(safeJsonParseMoralis, "safeJsonParseMoralis");
function pickBestMoralisImage(nft, metadata, normalized) {
  const mediaRoot = nft?.media;
  const mc = mediaRoot?.media_collection;
  const fromMc = moralisCoerceUrlString(mc?.high?.url) || moralisCoerceUrlString(mc?.medium?.url) || moralisCoerceUrlString(mc?.low?.url) || moralisCoerceUrlString(mc?.thumbnail?.url);
  const fromMediaRoot = moralisCoerceUrlString(mediaRoot?.original_media_url) || moralisCoerceUrlString(mediaRoot?.cached_media_url) || moralisCoerceUrlString(mediaRoot?.media_url) || moralisCoerceUrlString(mediaRoot?.moralis_media_url);
  const fromNorm = moralisCoerceUrlString(normalized?.image) || moralisCoerceUrlString(normalized?.image_url);
  const fromMeta = moralisCoerceUrlString(metadata?.image) || moralisCoerceUrlString(metadata?.image_url);
  const fromTokenUri = moralisTokenUriAsImageCandidate(nft?.token_uri);
  return fromMc || fromMediaRoot || fromNorm || fromMeta || fromTokenUri || null;
}
__name(pickBestMoralisImage, "pickBestMoralisImage");
function moralisMediaToMediaArray(media, rawImg) {
  if (rawImg) return [{ gateway: rawImg, thumbnail: rawImg, raw: rawImg }];
  const mc = media?.media_collection;
  const u = mc?.medium?.url || mc?.high?.url || mc?.low?.url;
  if (u) return [{ gateway: u, thumbnail: u, raw: u }];
  return [];
}
__name(moralisMediaToMediaArray, "moralisMediaToMediaArray");
function moralisRowToPseudoAlchemy(m) {
  const tokenAddress = String(m.token_address || "").trim().toLowerCase();
  const tokenId = String(m.token_id ?? "").trim();
  const metadata = safeJsonParseMoralis(m.metadata);
  const normalized = m.normalized_metadata && typeof m.normalized_metadata === "object" ? m.normalized_metadata : {};
  const mergedMeta = { ...metadata, ...normalized };
  for (const k of ["image", "image_url", "collection_image", "collection_logo"]) {
    const coerced = moralisCoerceUrlString(mergedMeta[k]);
    if (coerced) mergedMeta[k] = coerced;
    else if (mergedMeta[k] != null && typeof mergedMeta[k] === "object") delete mergedMeta[k];
  }
  const rawImg = pickBestMoralisImage(m, metadata, normalized);
  const colName = normalized.collection_name || mergedMeta.collection_name || m.collection_name || m.symbol || mergedMeta.symbol || "Unknown Collection";
  const tokenName = normalized.name || mergedMeta.name || m.name || `#${tokenId}`;
  const collLogo = moralisCoerceUrlString(m.collection_logo) || moralisCoerceUrlString(m.collection_banner_image) || moralisCoerceUrlString(normalized.collection_image) || moralisCoerceUrlString(normalized.collection_logo) || null;
  const tt = String(m.contract_type || "ERC721").toUpperCase() === "ERC1155" ? "ERC1155" : "ERC721";
  const mediaArr = moralisMediaToMediaArray(m.media, rawImg);
  return {
    contract: { address: tokenAddress, name: m.name || colName },
    contractAddress: tokenAddress,
    collection: {
      name: colName,
      address: tokenAddress,
      ...collLogo ? { imageUrl: collLogo } : {}
    },
    contractMetadata: {
      name: colName,
      openSeaMetadata: collLogo ? { imageUrl: collLogo } : {}
    },
    tokenId,
    id: { tokenId, tokenMetadata: { tokenType: tt } },
    tokenType: tt,
    title: tokenName,
    name: tokenName,
    metadata: mergedMeta,
    image: rawImg ? { cachedUrl: rawImg, originalUrl: rawImg, thumbnailUrl: rawImg } : null,
    media: mediaArr.length ? mediaArr : void 0,
    rawMetadata: mergedMeta,
    balance: m.amount != null ? String(m.amount) : "1"
  };
}
__name(moralisRowToPseudoAlchemy, "moralisRowToPseudoAlchemy");
async function fetchMoralisApeChainNFTsFromMoralis(ownerVal, env2, contractAddresses) {
  const all = [];
  let cursor = null;
  let page = 0;
  let lockedChain = null;
  let lockedStrategy = null;
  const MORALIS_API_BASE_LEGACY = "https://deep-index.moralis.io/api/v2";
  do {
    page += 1;
    const chainOpts = lockedChain ? [lockedChain] : null;
    const strategyList = lockedStrategy ? [lockedStrategy] : [
      { minimal: false, base: MORALIS_API_BASE, name: "full-v2.2" },
      { minimal: true, base: MORALIS_API_BASE, name: "minimal-v2.2" },
      { minimal: true, base: MORALIS_API_BASE_LEGACY, name: "minimal-v2" }
    ];
    let pagePack = null;
    let lastPageErr = "";
    for (const st of strategyList) {
      try {
        pagePack = await moralisApeGetParsed(
          env2,
          (chainParam2) => {
            const urlStr = buildMoralisWalletNftUrl(ownerVal, chainParam2, cursor, contractAddresses, st.minimal, st.base);
            console.log("[FlexGrid][ApeChain] Moralis request:", st.name, urlStr);
            return urlStr;
          },
          3e4,
          chainOpts
        );
        lockedStrategy = { minimal: st.minimal, base: st.base, name: st.name };
        if (st.name !== "full-v2.2") {
          console.warn("[FlexGrid][ApeChain] Moralis wallet NFT page used fallback strategy:", st.name);
        }
        break;
      } catch (e) {
        lastPageErr = e?.message || String(e);
        console.warn("[FlexGrid][ApeChain] strategy failed:", st.name, lastPageErr.slice(0, 280));
      }
    }
    if (!pagePack) {
      throw new Error(lastPageErr || "[Moralis ApeChain] all strategies failed for wallet NFT page");
    }
    const { data, chainParam } = pagePack;
    lockedChain = chainParam;
    const pageResults = moralisWalletNftRows(data);
    console.log("[FlexGrid][ApeChain] Moralis page", page, "results:", pageResults.length, "chain=", lockedChain);
    for (const row of pageResults) all.push(row);
    cursor = data.cursor && String(data.cursor).trim() ? String(data.cursor).trim() : null;
  } while (cursor);
  console.log("[FlexGrid][ApeChain] total Moralis rows:", all.length, "owner:", ownerVal);
  return all;
}
__name(fetchMoralisApeChainNFTsFromMoralis, "fetchMoralisApeChainNFTsFromMoralis");
async function fetchAlchemyNftsForOwner(env2, ownerVal, chain, contractAddresses) {
  const apiKey = pickAlchemyApiKeyForChain(env2, chain);
  if (!apiKey) {
    return corsResponse(
      JSON.stringify({
        error: "Missing Alchemy API key. Set ALCHEMY_API_KEY (Cloudflare secret)."
      }),
      503
    );
  }
  const host = ALCHEMY_HOSTS[chain] || ALCHEMY_HOSTS.eth;
  if (!ALCHEMY_HOSTS[chain]) {
    return corsResponse(JSON.stringify({ error: `Unsupported chain for Alchemy: ${chain}` }), 400);
  }
  const baseUrl = alchemyGetNftsForOwnerUrl(chain, host, apiKey);
  const allNFTs = [];
  let pageKey = null;
  console.log("[FlexGrid Worker] NFT fetch (Alchemy)", { chain, host, owner: ownerVal });
  try {
    do {
      const params = new URLSearchParams({
        owner: ownerVal,
        withMetadata: "true",
        pageSize: "100"
      });
      if (pageKey) params.set("pageKey", pageKey);
      params.set("tokenUriTimeoutInMs", "20000");
      if (contractAddresses?.length) {
        contractAddresses.forEach((addr) => params.append("contractAddresses[]", addr));
      }
      const fetchUrl = `${baseUrl}?${params.toString()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25e3);
      const res = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const t = await res.text();
        return corsResponse(JSON.stringify({ error: t || `Alchemy ${res.status}` }), 502);
      }
      const data = await res.json().catch(() => ({}));
      if (data?.error?.message) {
        return corsResponse(JSON.stringify({ error: data.error.message }), 502);
      }
      const nfts = data.ownedNfts || data.nfts || [];
      for (const n of nfts) allNFTs.push(n);
      pageKey = data.pageKey || data.pageToken || null;
      console.log("[FlexGrid Worker] Alchemy NFT page", {
        pageSize: nfts.length,
        totalSoFar: allNFTs.length,
        hasMore: !!pageKey
      });
    } while (pageKey);
    console.log("[FlexGrid Worker] total Alchemy NFTs:", allNFTs.length, "chain:", chain);
    const cleaned = allNFTs.map(buildCleanedNft);
    return corsResponse(JSON.stringify({ nfts: cleaned }));
  } catch (e) {
    const msg = e?.name === "AbortError" ? "Request timed out. Try again with fewer wallets." : e?.message || "NFT fetch failed";
    return corsResponse(JSON.stringify({ error: msg }), 502);
  }
}
__name(fetchAlchemyNftsForOwner, "fetchAlchemyNftsForOwner");
async function handleApiNfts(request, env2) {
  const url = new URL(request.url);
  const owner = url.searchParams.get("owner");
  const chain = String(url.searchParams.get("chain") || "eth").trim().toLowerCase();
  const contractAddressesParam = url.searchParams.get("contractAddresses");
  if (!owner || String(owner).trim() === "") {
    return corsResponse(JSON.stringify({ error: "Missing owner" }), 400);
  }
  const ownerVal = owner.trim().toLowerCase();
  const contractAddresses = contractAddressesParam ? contractAddressesParam.split(",").map((a) => a.trim().toLowerCase()).filter((a) => /^0x[a-f0-9]{40}$/.test(a)) : null;
  console.log("[FlexGrid Worker] /api/nfts chain=", chain, "owner=", ownerVal);
  if (chain === "apechain") {
    const hasMoralis = !!getMoralisApiKey(env2);
    const hasAlchemy = !!pickAlchemyApiKeyForChain(env2, "apechain");
    if (!hasMoralis && !hasAlchemy) {
      return corsResponse(
        JSON.stringify({
          error: "ApeChain needs MORALIS_API_KEY and/or ALCHEMY_API_KEY. Moralis is tried first; if it fails, Alchemy (apechain-mainnet) is used when a key is set."
        }),
        503
      );
    }
    if (hasMoralis) {
      try {
        const rows = await fetchMoralisApeChainNFTsFromMoralis(ownerVal, env2, contractAddresses);
        const cleaned = [];
        for (const row of rows) {
          try {
            const pseudo = moralisRowToPseudoAlchemy(row);
            cleaned.push(buildCleanedNft(pseudo));
          } catch (rowErr) {
            console.warn("[FlexGrid][ApeChain] skip NFT row:", rowErr?.message || rowErr, row?.token_id, row?.token_address);
          }
        }
        const sample = cleaned[0];
        console.log(
          "[FlexGrid][ApeChain] Moralis cleaned sample:",
          sample ? { contract: sample.contractAddress, tokenId: sample.tokenId, hasImage: !!sample.image } : null
        );
        let body;
        try {
          body = JSON.stringify({ nfts: cleaned });
        } catch (serErr) {
          console.error("[FlexGrid][ApeChain] JSON.stringify failed:", serErr?.message || serErr);
          if (!hasAlchemy) {
            return corsResponse(JSON.stringify({ error: "Failed to encode NFT list (unexpected Moralis field types)." }), 502);
          }
          console.warn("[FlexGrid][ApeChain] JSON encode failed; falling back to Alchemy.");
        }
        if (body) {
          return corsResponse(body);
        }
      } catch (e) {
        const msg = e?.message || "ApeChain Moralis fetch failed";
        console.error("[FlexGrid][ApeChain] Moralis error:", msg);
        if (!hasAlchemy) {
          return corsResponse(JSON.stringify({ error: msg.slice(0, 4e3) }), 502);
        }
        console.warn("[FlexGrid][ApeChain] Falling back to Alchemy getNFTsForOwner (ApeChain).");
      }
    }
    return fetchAlchemyNftsForOwner(env2, ownerVal, "apechain", contractAddresses);
  }
  return fetchAlchemyNftsForOwner(env2, ownerVal, chain, contractAddresses);
}
__name(handleApiNfts, "handleApiNfts");
async function handleApiNftMetadata(request, env2) {
  const url = new URL(request.url);
  const contract = url.searchParams.get("contract");
  const tokenId = url.searchParams.get("tokenId");
  const chain = String(url.searchParams.get("chain") || "eth").trim().toLowerCase();
  if (!contract || !tokenId) {
    return corsResponse(JSON.stringify({ error: "Missing contract or tokenId" }), 400);
  }
  if (chain === "apechain") {
    const hasMoralis = !!getMoralisApiKey(env2);
    const hasAlchemy = !!pickAlchemyApiKeyForChain(env2, "apechain");
    if (!hasMoralis && !hasAlchemy) {
      return corsResponse(JSON.stringify({ error: "Missing MORALIS_API_KEY and ALCHEMY_API_KEY for ApeChain metadata." }), 503);
    }
    if (hasMoralis) {
      try {
        const ct = encodeURIComponent(String(contract).trim());
        const tid = encodeURIComponent(String(tokenId).trim());
        const { data: json } = await moralisApeGetParsed(
          env2,
          (chainParam) => {
            const u = new URL(`${MORALIS_API_BASE}/nft/${ct}/${tid}`);
            u.searchParams.set("chain", chainParam);
            u.searchParams.set("format", "decimal");
            u.searchParams.set("media_items", "true");
            u.searchParams.set("normalizeMetadata", "true");
            console.log("[FlexGrid][ApeChain] Moralis NFT metadata:", u.toString());
            return u.toString();
          },
          2e4
        );
        return corsResponse(JSON.stringify(json));
      } catch (e) {
        console.warn("[FlexGrid][ApeChain] Moralis NFT metadata failed:", e?.message || e);
        if (!hasAlchemy) {
          return corsResponse(JSON.stringify({ error: e?.message || "Moralis metadata fetch failed" }), 502);
        }
      }
    }
  }
  const apiKey = pickAlchemyApiKeyForChain(env2, chain);
  if (!apiKey) {
    return corsResponse(JSON.stringify({ error: "Missing Alchemy API key for this chain." }), 503);
  }
  const host = ALCHEMY_HOSTS[chain] || ALCHEMY_HOSTS.eth;
  const metaUrl = `https://${host}/nft/v3/${apiKey}/getNFTMetadata?contractAddress=${encodeURIComponent(contract)}&tokenId=${encodeURIComponent(tokenId)}&refreshCache=false`;
  try {
    const res = await fetch(metaUrl);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || "Metadata error");
    return corsResponse(JSON.stringify(json));
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e?.message || "Metadata fetch failed" }), 502);
  }
}
__name(handleApiNftMetadata, "handleApiNftMetadata");
function pickOpenSeaCollectionLogoFromContractMetadata(data) {
  if (!data || typeof data !== "object") return null;
  const pick = /* @__PURE__ */ __name((obj) => {
    if (!obj || typeof obj !== "object") return null;
    const u = obj.imageUrl || obj.image_url || obj.logo || obj.coverImageUrl || obj.bannerImageUrl;
    const raw = typeof u === "string" && u.trim() ? u.trim() : null;
    return raw ? repairBrokenImageUrl(raw) : null;
  }, "pick");
  return pick(data.openSeaMetadata) || pick(data.openSea) || pick(data.contract?.openSeaMetadata) || pick(data.contract?.openSea) || pick(data.contractMetadata?.openSeaMetadata) || pick(data.contractMetadata?.openSea) || pick(data.contractMetadata) || (typeof data.imageUrl === "string" && data.imageUrl.trim() ? repairBrokenImageUrl(data.imageUrl.trim()) : null) || (typeof data.logoUrl === "string" && data.logoUrl.trim() ? repairBrokenImageUrl(data.logoUrl.trim()) : null) || null;
}
__name(pickOpenSeaCollectionLogoFromContractMetadata, "pickOpenSeaCollectionLogoFromContractMetadata");
function pickLogoFromMoralisContractMeta(json) {
  if (!json || typeof json !== "object") return null;
  const tryPick = /* @__PURE__ */ __name((obj) => {
    if (!obj || typeof obj !== "object") return null;
    const fromNormRoot = obj.normalized_metadata || obj.normalizedMetadata;
    const norm = fromNormRoot && typeof fromNormRoot === "object" ? fromNormRoot : null;
    const fromNorm = norm && (moralisCoerceUrlString(norm.collection_logo) || moralisCoerceUrlString(norm.collection_image) || moralisCoerceUrlString(norm.image) || moralisCoerceUrlString(norm.image_url));
    return fromNorm || moralisCoerceUrlString(obj.logo) || moralisCoerceUrlString(obj.logo_url) || moralisCoerceUrlString(obj.contract_logo) || moralisCoerceUrlString(obj.collection_logo) || moralisCoerceUrlString(obj.collection_banner_image) || moralisCoerceUrlString(obj.collection_banner_image_url) || moralisCoerceUrlString(obj.collection_image) || moralisCoerceUrlString(obj.image_url) || moralisCoerceUrlString(obj.image) || moralisCoerceUrlString(obj.openSeaMetadata?.imageUrl) || moralisCoerceUrlString(obj.openSea?.imageUrl) || pickOpenSeaCollectionLogoFromContractMetadata(obj);
  }, "tryPick");
  let root = json;
  if (Array.isArray(json.result) && json.result.length === 1 && json.result[0] && typeof json.result[0] === "object") {
    root = { ...json, ...json.result[0] };
  } else if (json.result && typeof json.result === "object" && !Array.isArray(json.result)) {
    root = { ...json, ...json.result };
  }
  if (json.data && typeof json.data === "object" && !Array.isArray(json.data)) {
    root = { ...root, ...json.data };
  }
  const direct = tryPick(root);
  if (direct) return direct;
  const metaStr = root.metadata;
  if (typeof metaStr === "string" && metaStr.trim()) {
    const parsed = safeJsonParseMoralis(metaStr);
    const fromStr = tryPick(parsed);
    if (fromStr) return fromStr;
  }
  if (root.metadata && typeof root.metadata === "object") {
    const fromObj = tryPick(root.metadata);
    if (fromObj) return fromObj;
  }
  return pickOpenSeaCollectionLogoFromContractMetadata(json) || pickOpenSeaCollectionLogoFromContractMetadata(root);
}
__name(pickLogoFromMoralisContractMeta, "pickLogoFromMoralisContractMeta");
async function handleApiContractMetadata(request, env2) {
  const url = new URL(request.url);
  const contract = url.searchParams.get("contract");
  const chain = String(url.searchParams.get("chain") || "eth").trim().toLowerCase();
  if (!contract || !/^0x[a-fA-F0-9]{40}$/.test(String(contract).trim())) {
    return corsResponse(JSON.stringify({ error: "Missing or invalid contract" }), 400);
  }
  const addr = String(contract).trim();
  if (chain === "apechain") {
    const hasMoralis = !!getMoralisApiKey(env2);
    const hasAlchemy = !!pickAlchemyApiKeyForChain(env2, "apechain");
    if (!hasMoralis && !hasAlchemy) {
      return corsResponse(JSON.stringify({ error: "Missing MORALIS_API_KEY and ALCHEMY_API_KEY for ApeChain.", rawLogoUrl: null }), 503);
    }
    if (hasMoralis) {
      try {
        const enc = encodeURIComponent(addr);
        const { data: json } = await moralisApeGetParsed(
          env2,
          (chainParam) => {
            const metaUrl2 = new URL(`${MORALIS_API_BASE}/nft/${enc}/metadata`);
            metaUrl2.searchParams.set("chain", chainParam);
            metaUrl2.searchParams.set("normalizeMetadata", "true");
            console.log("[FlexGrid][ApeChain] Moralis contract metadata:", metaUrl2.toString());
            return metaUrl2.toString();
          },
          2e4
        );
        const rawLogoUrl = pickLogoFromMoralisContractMeta(json);
        console.log("[FlexGrid][ApeChain] contract logo resolved:", !!rawLogoUrl, "contract:", addr);
        return corsResponse(JSON.stringify({ rawLogoUrl: rawLogoUrl || null }));
      } catch (e) {
        const msg = e?.name === "AbortError" ? "Moralis contract metadata timed out" : e?.message || "Moralis contract metadata failed";
        console.warn("[FlexGrid][ApeChain] Moralis contract metadata failed:", msg);
        if (!hasAlchemy) {
          return corsResponse(JSON.stringify({ error: msg, rawLogoUrl: null }), 502);
        }
      }
    }
  }
  const apiKey = pickAlchemyApiKeyForChain(env2, chain);
  if (!apiKey) {
    return corsResponse(JSON.stringify({ error: "Missing Alchemy API key for this chain.", rawLogoUrl: null }), 503);
  }
  const host = ALCHEMY_HOSTS[chain] || ALCHEMY_HOSTS.eth;
  const metaUrl = `https://${host}/nft/v3/${apiKey}/getContractMetadata?contractAddress=${encodeURIComponent(addr)}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2e4);
    const res = await fetch(metaUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.message || json?.error?.message || `Alchemy ${res.status}`;
      return corsResponse(JSON.stringify({ error: msg, rawLogoUrl: null }), 502);
    }
    if (json?.error?.message) {
      return corsResponse(JSON.stringify({ error: json.error.message, rawLogoUrl: null }), 502);
    }
    const rawLogoUrl = pickOpenSeaCollectionLogoFromContractMetadata(json);
    return corsResponse(JSON.stringify({ rawLogoUrl }));
  } catch (e) {
    const msg = e?.name === "AbortError" ? "Contract metadata request timed out" : e?.message || "Contract metadata fetch failed";
    return corsResponse(JSON.stringify({ error: msg, rawLogoUrl: null }), 502);
  }
}
__name(handleApiContractMetadata, "handleApiContractMetadata");
var worker_default = {
  async fetch(request, env2, ctx) {
    const url = new URL(request.url);
    const hasMainKey = env2.ALCHEMY_API_KEY && typeof env2.ALCHEMY_API_KEY === "string";
    const hasMoralisKey = getMoralisApiKey(env2);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    const isConfigPath = url.pathname === "/api/config/flex-grid" || url.pathname === "/api/config/flexgrid";
    if (isConfigPath && request.method === "GET") {
      if (!hasMainKey && !hasMoralisKey) {
        return corsResponse(
          JSON.stringify({
            error: "This Worker has no API keys. Set ALCHEMY_API_KEY (ETH/Base/Polygon) and/or MORALIS_API_KEY (ApeChain). For local dev: wrangler secret put \u2026"
          }),
          503
        );
      }
      const origin = `${url.protocol}//${url.host}`;
      return corsResponse(
        JSON.stringify({
          workerUrl: `${origin}/img?url=`,
          network: "eth-mainnet"
        })
      );
    }
    if (url.pathname === "/img" && request.method === "GET") {
      return handleImageProxy(request, env2, ctx);
    }
    if (!hasMainKey && !hasMoralisKey) {
      return corsResponse(JSON.stringify({ error: "Server configuration error. Contact site owner." }), 503);
    }
    if (url.pathname === "/api/nfts" && request.method === "GET") {
      return handleApiNfts(request, env2);
    }
    if (url.pathname === "/api/nft-metadata" && request.method === "GET") {
      return handleApiNftMetadata(request, env2);
    }
    if (url.pathname === "/api/contract-metadata" && request.method === "GET") {
      return handleApiContractMetadata(request, env2);
    }
    return new Response("Not found", { status: 404, headers: CORS });
  }
};

// ../../../../../usr/local/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../usr/local/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-5CFijg/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../../usr/local/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-5CFijg/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
