// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function (
  modules,
  entry,
  mainEntry,
  parcelRequireName,
  externals,
  distDir,
  publicUrl,
  devServer
) {
  /* eslint-disable no-undef */
  var globalObject =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : {};
  /* eslint-enable no-undef */

  // Save the require from previous bundle to this closure if any
  var previousRequire =
    typeof globalObject[parcelRequireName] === 'function' &&
    globalObject[parcelRequireName];

  var importMap = previousRequire.i || {};
  var cache = previousRequire.cache || {};
  // Do not use `require` to prevent Webpack from trying to bundle this call
  var nodeRequire =
    typeof module !== 'undefined' &&
    typeof module.require === 'function' &&
    module.require.bind(module);

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        if (externals[name]) {
          return externals[name];
        }
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire =
          typeof globalObject[parcelRequireName] === 'function' &&
          globalObject[parcelRequireName];
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error("Cannot find module '" + name + "'");
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = (cache[name] = new newRequire.Module(name));

      modules[name][0].call(
        module.exports,
        localRequire,
        module,
        module.exports,
        globalObject
      );
    }

    return cache[name].exports;

    function localRequire(x) {
      var res = localRequire.resolve(x);
      return res === false ? {} : newRequire(res);
    }

    function resolve(x) {
      var id = modules[name][1][x];
      return id != null ? id : x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.require = nodeRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.distDir = distDir;
  newRequire.publicUrl = publicUrl;
  newRequire.devServer = devServer;
  newRequire.i = importMap;
  newRequire.register = function (id, exports) {
    modules[id] = [
      function (require, module) {
        module.exports = exports;
      },
      {},
    ];
  };

  // Only insert newRequire.load when it is actually used.
  // The code in this file is linted against ES5, so dynamic import is not allowed.
  // INSERT_LOAD_HERE

  Object.defineProperty(newRequire, 'root', {
    get: function () {
      return globalObject[parcelRequireName];
    },
  });

  globalObject[parcelRequireName] = newRequire;

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  if (mainEntry) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(mainEntry);

    // CommonJS
    if (typeof exports === 'object' && typeof module !== 'undefined') {
      module.exports = mainExports;

      // RequireJS
    } else if (typeof define === 'function' && define.amd) {
      define(function () {
        return mainExports;
      });
    }
  }
})({"12lyG":[function(require,module,exports,__globalThis) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SERVER_PORT = 1234;
var HMR_SECURE = false;
var HMR_ENV_HASH = "439701173a9199ea";
var HMR_USE_SSE = false;
module.bundle.HMR_BUNDLE_ID = "0ebcf2973cc398da";
"use strict";
/* global HMR_HOST, HMR_PORT, HMR_SERVER_PORT, HMR_ENV_HASH, HMR_SECURE, HMR_USE_SSE, chrome, browser, __parcel__import__, __parcel__importScripts__, ServiceWorkerGlobalScope */ /*::
import type {
  HMRAsset,
  HMRMessage,
} from '@parcel/reporter-dev-server/src/HMRServer.js';
interface ParcelRequire {
  (string): mixed;
  cache: {|[string]: ParcelModule|};
  hotData: {|[string]: mixed|};
  Module: any;
  parent: ?ParcelRequire;
  isParcelRequire: true;
  modules: {|[string]: [Function, {|[string]: string|}]|};
  HMR_BUNDLE_ID: string;
  root: ParcelRequire;
}
interface ParcelModule {
  hot: {|
    data: mixed,
    accept(cb: (Function) => void): void,
    dispose(cb: (mixed) => void): void,
    // accept(deps: Array<string> | string, cb: (Function) => void): void,
    // decline(): void,
    _acceptCallbacks: Array<(Function) => void>,
    _disposeCallbacks: Array<(mixed) => void>,
  |};
}
interface ExtensionContext {
  runtime: {|
    reload(): void,
    getURL(url: string): string;
    getManifest(): {manifest_version: number, ...};
  |};
}
declare var module: {bundle: ParcelRequire, ...};
declare var HMR_HOST: string;
declare var HMR_PORT: string;
declare var HMR_SERVER_PORT: string;
declare var HMR_ENV_HASH: string;
declare var HMR_SECURE: boolean;
declare var HMR_USE_SSE: boolean;
declare var chrome: ExtensionContext;
declare var browser: ExtensionContext;
declare var __parcel__import__: (string) => Promise<void>;
declare var __parcel__importScripts__: (string) => Promise<void>;
declare var globalThis: typeof self;
declare var ServiceWorkerGlobalScope: Object;
*/ var OVERLAY_ID = '__parcel__error__overlay__';
var OldModule = module.bundle.Module;
function Module(moduleName) {
    OldModule.call(this, moduleName);
    this.hot = {
        data: module.bundle.hotData[moduleName],
        _acceptCallbacks: [],
        _disposeCallbacks: [],
        accept: function(fn) {
            this._acceptCallbacks.push(fn || function() {});
        },
        dispose: function(fn) {
            this._disposeCallbacks.push(fn);
        }
    };
    module.bundle.hotData[moduleName] = undefined;
}
module.bundle.Module = Module;
module.bundle.hotData = {};
var checkedAssets /*: {|[string]: boolean|} */ , disposedAssets /*: {|[string]: boolean|} */ , assetsToDispose /*: Array<[ParcelRequire, string]> */ , assetsToAccept /*: Array<[ParcelRequire, string]> */ , bundleNotFound = false;
function getHostname() {
    return HMR_HOST || (typeof location !== 'undefined' && location.protocol.indexOf('http') === 0 ? location.hostname : 'localhost');
}
function getPort() {
    return HMR_PORT || (typeof location !== 'undefined' ? location.port : HMR_SERVER_PORT);
}
// eslint-disable-next-line no-redeclare
let WebSocket = globalThis.WebSocket;
if (!WebSocket && typeof module.bundle.root === 'function') try {
    // eslint-disable-next-line no-global-assign
    WebSocket = module.bundle.root('ws');
} catch  {
// ignore.
}
var hostname = getHostname();
var port = getPort();
var protocol = HMR_SECURE || typeof location !== 'undefined' && location.protocol === 'https:' && ![
    'localhost',
    '127.0.0.1',
    '0.0.0.0'
].includes(hostname) ? 'wss' : 'ws';
// eslint-disable-next-line no-redeclare
var parent = module.bundle.parent;
if (!parent || !parent.isParcelRequire) {
    // Web extension context
    var extCtx = typeof browser === 'undefined' ? typeof chrome === 'undefined' ? null : chrome : browser;
    // Safari doesn't support sourceURL in error stacks.
    // eval may also be disabled via CSP, so do a quick check.
    var supportsSourceURL = false;
    try {
        (0, eval)('throw new Error("test"); //# sourceURL=test.js');
    } catch (err) {
        supportsSourceURL = err.stack.includes('test.js');
    }
    var ws;
    if (HMR_USE_SSE) ws = new EventSource('/__parcel_hmr');
    else try {
        // If we're running in the dev server's node runner, listen for messages on the parent port.
        let { workerData, parentPort } = module.bundle.root('node:worker_threads') /*: any*/ ;
        if (workerData !== null && workerData !== void 0 && workerData.__parcel) {
            parentPort.on('message', async (message)=>{
                try {
                    await handleMessage(message);
                    parentPort.postMessage('updated');
                } catch  {
                    parentPort.postMessage('restart');
                }
            });
            // After the bundle has finished running, notify the dev server that the HMR update is complete.
            queueMicrotask(()=>parentPort.postMessage('ready'));
        }
    } catch  {
        if (typeof WebSocket !== 'undefined') try {
            ws = new WebSocket(protocol + '://' + hostname + (port ? ':' + port : '') + '/');
        } catch (err) {
            // Ignore cloudflare workers error.
            if (err.message && !err.message.includes('Disallowed operation called within global scope')) console.error(err.message);
        }
    }
    if (ws) {
        // $FlowFixMe
        ws.onmessage = async function(event /*: {data: string, ...} */ ) {
            var data /*: HMRMessage */  = JSON.parse(event.data);
            await handleMessage(data);
        };
        if (ws instanceof WebSocket) {
            ws.onerror = function(e) {
                if (e.message) console.error(e.message);
            };
            ws.onclose = function() {
                console.warn("[parcel] \uD83D\uDEA8 Connection to the HMR server was lost");
            };
        }
    }
}
async function handleMessage(data /*: HMRMessage */ ) {
    checkedAssets = {} /*: {|[string]: boolean|} */ ;
    disposedAssets = {} /*: {|[string]: boolean|} */ ;
    assetsToAccept = [];
    assetsToDispose = [];
    bundleNotFound = false;
    if (data.type === 'reload') fullReload();
    else if (data.type === 'update') {
        // Remove error overlay if there is one
        if (typeof document !== 'undefined') removeErrorOverlay();
        let assets = data.assets;
        // Handle HMR Update
        let handled = assets.every((asset)=>{
            return asset.type === 'css' || asset.type === 'js' && hmrAcceptCheck(module.bundle.root, asset.id, asset.depsByBundle);
        });
        // Dispatch a custom event in case a bundle was not found. This might mean
        // an asset on the server changed and we should reload the page. This event
        // gives the client an opportunity to refresh without losing state
        // (e.g. via React Server Components). If e.preventDefault() is not called,
        // we will trigger a full page reload.
        if (handled && bundleNotFound && assets.some((a)=>a.envHash !== HMR_ENV_HASH) && typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') handled = !window.dispatchEvent(new CustomEvent('parcelhmrreload', {
            cancelable: true
        }));
        if (handled) {
            console.clear();
            // Dispatch custom event so other runtimes (e.g React Refresh) are aware.
            if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent('parcelhmraccept'));
            await hmrApplyUpdates(assets);
            hmrDisposeQueue();
            // Run accept callbacks. This will also re-execute other disposed assets in topological order.
            let processedAssets = {};
            for(let i = 0; i < assetsToAccept.length; i++){
                let id = assetsToAccept[i][1];
                if (!processedAssets[id]) {
                    hmrAccept(assetsToAccept[i][0], id);
                    processedAssets[id] = true;
                }
            }
        } else fullReload();
    }
    if (data.type === 'error') {
        // Log parcel errors to console
        for (let ansiDiagnostic of data.diagnostics.ansi){
            let stack = ansiDiagnostic.codeframe ? ansiDiagnostic.codeframe : ansiDiagnostic.stack;
            console.error("\uD83D\uDEA8 [parcel]: " + ansiDiagnostic.message + '\n' + stack + '\n\n' + ansiDiagnostic.hints.join('\n'));
        }
        if (typeof document !== 'undefined') {
            // Render the fancy html overlay
            removeErrorOverlay();
            var overlay = createErrorOverlay(data.diagnostics.html);
            // $FlowFixMe
            document.body.appendChild(overlay);
        }
    }
}
function removeErrorOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        overlay.remove();
        console.log("[parcel] \u2728 Error resolved");
    }
}
function createErrorOverlay(diagnostics) {
    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    let errorHTML = '<div style="background: black; opacity: 0.85; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; font-family: Menlo, Consolas, monospace; z-index: 9999;">';
    for (let diagnostic of diagnostics){
        let stack = diagnostic.frames.length ? diagnostic.frames.reduce((p, frame)=>{
            return `${p}
<a href="${protocol === 'wss' ? 'https' : 'http'}://${hostname}:${port}/__parcel_launch_editor?file=${encodeURIComponent(frame.location)}" style="text-decoration: underline; color: #888" onclick="fetch(this.href); return false">${frame.location}</a>
${frame.code}`;
        }, '') : diagnostic.stack;
        errorHTML += `
      <div>
        <div style="font-size: 18px; font-weight: bold; margin-top: 20px;">
          \u{1F6A8} ${diagnostic.message}
        </div>
        <pre>${stack}</pre>
        <div>
          ${diagnostic.hints.map((hint)=>"<div>\uD83D\uDCA1 " + hint + '</div>').join('')}
        </div>
        ${diagnostic.documentation ? `<div>\u{1F4DD} <a style="color: violet" href="${diagnostic.documentation}" target="_blank">Learn more</a></div>` : ''}
      </div>
    `;
    }
    errorHTML += '</div>';
    overlay.innerHTML = errorHTML;
    return overlay;
}
function fullReload() {
    if (typeof location !== 'undefined' && 'reload' in location) location.reload();
    else if (typeof extCtx !== 'undefined' && extCtx && extCtx.runtime && extCtx.runtime.reload) extCtx.runtime.reload();
    else try {
        let { workerData, parentPort } = module.bundle.root('node:worker_threads') /*: any*/ ;
        if (workerData !== null && workerData !== void 0 && workerData.__parcel) parentPort.postMessage('restart');
    } catch (err) {
        console.error("[parcel] \u26A0\uFE0F An HMR update was not accepted. Please restart the process.");
    }
}
function getParents(bundle, id) /*: Array<[ParcelRequire, string]> */ {
    var modules = bundle.modules;
    if (!modules) return [];
    var parents = [];
    var k, d, dep;
    for(k in modules)for(d in modules[k][1]){
        dep = modules[k][1][d];
        if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) parents.push([
            bundle,
            k
        ]);
    }
    if (bundle.parent) parents = parents.concat(getParents(bundle.parent, id));
    return parents;
}
function updateLink(link) {
    var href = link.getAttribute('href');
    if (!href) return;
    var newLink = link.cloneNode();
    newLink.onload = function() {
        if (link.parentNode !== null) // $FlowFixMe
        link.parentNode.removeChild(link);
    };
    newLink.setAttribute('href', // $FlowFixMe
    href.split('?')[0] + '?' + Date.now());
    // $FlowFixMe
    link.parentNode.insertBefore(newLink, link.nextSibling);
}
var cssTimeout = null;
function reloadCSS() {
    if (cssTimeout || typeof document === 'undefined') return;
    cssTimeout = setTimeout(function() {
        var links = document.querySelectorAll('link[rel="stylesheet"]');
        for(var i = 0; i < links.length; i++){
            // $FlowFixMe[incompatible-type]
            var href /*: string */  = links[i].getAttribute('href');
            var hostname = getHostname();
            var servedFromHMRServer = hostname === 'localhost' ? new RegExp('^(https?:\\/\\/(0.0.0.0|127.0.0.1)|localhost):' + getPort()).test(href) : href.indexOf(hostname + ':' + getPort());
            var absolute = /^https?:\/\//i.test(href) && href.indexOf(location.origin) !== 0 && !servedFromHMRServer;
            if (!absolute) updateLink(links[i]);
        }
        cssTimeout = null;
    }, 50);
}
function hmrDownload(asset) {
    if (asset.type === 'js') {
        if (typeof document !== 'undefined') {
            let script = document.createElement('script');
            script.src = asset.url + '?t=' + Date.now();
            if (asset.outputFormat === 'esmodule') script.type = 'module';
            return new Promise((resolve, reject)=>{
                var _document$head;
                script.onload = ()=>resolve(script);
                script.onerror = reject;
                (_document$head = document.head) === null || _document$head === void 0 || _document$head.appendChild(script);
            });
        } else if (typeof importScripts === 'function') {
            // Worker scripts
            if (asset.outputFormat === 'esmodule') return import(asset.url + '?t=' + Date.now());
            else return new Promise((resolve, reject)=>{
                try {
                    importScripts(asset.url + '?t=' + Date.now());
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        }
    }
}
async function hmrApplyUpdates(assets) {
    global.parcelHotUpdate = Object.create(null);
    let scriptsToRemove;
    try {
        // If sourceURL comments aren't supported in eval, we need to load
        // the update from the dev server over HTTP so that stack traces
        // are correct in errors/logs. This is much slower than eval, so
        // we only do it if needed (currently just Safari).
        // https://bugs.webkit.org/show_bug.cgi?id=137297
        // This path is also taken if a CSP disallows eval.
        if (!supportsSourceURL) {
            let promises = assets.map((asset)=>{
                var _hmrDownload;
                return (_hmrDownload = hmrDownload(asset)) === null || _hmrDownload === void 0 ? void 0 : _hmrDownload.catch((err)=>{
                    // Web extension fix
                    if (extCtx && extCtx.runtime && extCtx.runtime.getManifest().manifest_version == 3 && typeof ServiceWorkerGlobalScope != 'undefined' && global instanceof ServiceWorkerGlobalScope) {
                        extCtx.runtime.reload();
                        return;
                    }
                    throw err;
                });
            });
            scriptsToRemove = await Promise.all(promises);
        }
        assets.forEach(function(asset) {
            hmrApply(module.bundle.root, asset);
        });
    } finally{
        delete global.parcelHotUpdate;
        if (scriptsToRemove) scriptsToRemove.forEach((script)=>{
            if (script) {
                var _document$head2;
                (_document$head2 = document.head) === null || _document$head2 === void 0 || _document$head2.removeChild(script);
            }
        });
    }
}
function hmrApply(bundle /*: ParcelRequire */ , asset /*:  HMRAsset */ ) {
    var modules = bundle.modules;
    if (!modules) return;
    if (asset.type === 'css') reloadCSS();
    else if (asset.type === 'js') {
        let deps = asset.depsByBundle[bundle.HMR_BUNDLE_ID];
        if (deps) {
            if (modules[asset.id]) {
                // Remove dependencies that are removed and will become orphaned.
                // This is necessary so that if the asset is added back again, the cache is gone, and we prevent a full page reload.
                let oldDeps = modules[asset.id][1];
                for(let dep in oldDeps)if (!deps[dep] || deps[dep] !== oldDeps[dep]) {
                    let id = oldDeps[dep];
                    let parents = getParents(module.bundle.root, id);
                    if (parents.length === 1) hmrDelete(module.bundle.root, id);
                }
            }
            if (supportsSourceURL) // Global eval. We would use `new Function` here but browser
            // support for source maps is better with eval.
            (0, eval)(asset.output);
            // $FlowFixMe
            let fn = global.parcelHotUpdate[asset.id];
            modules[asset.id] = [
                fn,
                deps
            ];
        }
        // Always traverse to the parent bundle, even if we already replaced the asset in this bundle.
        // This is required in case modules are duplicated. We need to ensure all instances have the updated code.
        if (bundle.parent) hmrApply(bundle.parent, asset);
    }
}
function hmrDelete(bundle, id) {
    let modules = bundle.modules;
    if (!modules) return;
    if (modules[id]) {
        // Collect dependencies that will become orphaned when this module is deleted.
        let deps = modules[id][1];
        let orphans = [];
        for(let dep in deps){
            let parents = getParents(module.bundle.root, deps[dep]);
            if (parents.length === 1) orphans.push(deps[dep]);
        }
        // Delete the module. This must be done before deleting dependencies in case of circular dependencies.
        delete modules[id];
        delete bundle.cache[id];
        // Now delete the orphans.
        orphans.forEach((id)=>{
            hmrDelete(module.bundle.root, id);
        });
    } else if (bundle.parent) hmrDelete(bundle.parent, id);
}
function hmrAcceptCheck(bundle /*: ParcelRequire */ , id /*: string */ , depsByBundle /*: ?{ [string]: { [string]: string } }*/ ) {
    checkedAssets = {};
    if (hmrAcceptCheckOne(bundle, id, depsByBundle)) return true;
    // Traverse parents breadth first. All possible ancestries must accept the HMR update, or we'll reload.
    let parents = getParents(module.bundle.root, id);
    let accepted = false;
    while(parents.length > 0){
        let v = parents.shift();
        let a = hmrAcceptCheckOne(v[0], v[1], null);
        if (a) // If this parent accepts, stop traversing upward, but still consider siblings.
        accepted = true;
        else if (a !== null) {
            // Otherwise, queue the parents in the next level upward.
            let p = getParents(module.bundle.root, v[1]);
            if (p.length === 0) {
                // If there are no parents, then we've reached an entry without accepting. Reload.
                accepted = false;
                break;
            }
            parents.push(...p);
        }
    }
    return accepted;
}
function hmrAcceptCheckOne(bundle /*: ParcelRequire */ , id /*: string */ , depsByBundle /*: ?{ [string]: { [string]: string } }*/ ) {
    var modules = bundle.modules;
    if (!modules) return;
    if (depsByBundle && !depsByBundle[bundle.HMR_BUNDLE_ID]) {
        // If we reached the root bundle without finding where the asset should go,
        // there's nothing to do. Mark as "accepted" so we don't reload the page.
        if (!bundle.parent) {
            bundleNotFound = true;
            return true;
        }
        return hmrAcceptCheckOne(bundle.parent, id, depsByBundle);
    }
    if (checkedAssets[id]) return null;
    checkedAssets[id] = true;
    var cached = bundle.cache[id];
    if (!cached) return true;
    assetsToDispose.push([
        bundle,
        id
    ]);
    if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
        assetsToAccept.push([
            bundle,
            id
        ]);
        return true;
    }
    return false;
}
function hmrDisposeQueue() {
    // Dispose all old assets.
    for(let i = 0; i < assetsToDispose.length; i++){
        let id = assetsToDispose[i][1];
        if (!disposedAssets[id]) {
            hmrDispose(assetsToDispose[i][0], id);
            disposedAssets[id] = true;
        }
    }
    assetsToDispose = [];
}
function hmrDispose(bundle /*: ParcelRequire */ , id /*: string */ ) {
    var cached = bundle.cache[id];
    bundle.hotData[id] = {};
    if (cached && cached.hot) cached.hot.data = bundle.hotData[id];
    if (cached && cached.hot && cached.hot._disposeCallbacks.length) cached.hot._disposeCallbacks.forEach(function(cb) {
        cb(bundle.hotData[id]);
    });
    delete bundle.cache[id];
}
function hmrAccept(bundle /*: ParcelRequire */ , id /*: string */ ) {
    // Execute the module.
    bundle(id);
    // Run the accept callbacks in the new version of the module.
    var cached = bundle.cache[id];
    if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
        let assetsToAlsoAccept = [];
        cached.hot._acceptCallbacks.forEach(function(cb) {
            let additionalAssets = cb(function() {
                return getParents(module.bundle.root, id);
            });
            if (Array.isArray(additionalAssets) && additionalAssets.length) assetsToAlsoAccept.push(...additionalAssets);
        });
        if (assetsToAlsoAccept.length) {
            let handled = assetsToAlsoAccept.every(function(a) {
                return hmrAcceptCheck(a[0], a[1]);
            });
            if (!handled) return fullReload();
            hmrDisposeQueue();
        }
    }
}

},{}],"6Q7L8":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "create2DArray", ()=>create2DArray);
parcelHelpers.export(exports, "selected", ()=>selected);
parcelHelpers.export(exports, "GRID_HEIGHT", ()=>GRID_HEIGHT);
parcelHelpers.export(exports, "CONTROL_STATES", ()=>CONTROL_STATES);
parcelHelpers.export(exports, "MAX_CROP_GROWTH_STAGE", ()=>MAX_CROP_GROWTH_STAGE);
parcelHelpers.export(exports, "WORLD_DIMENSIONX", ()=>WORLD_DIMENSIONX);
parcelHelpers.export(exports, "WORLD_DIMENSIONY", ()=>WORLD_DIMENSIONY);
parcelHelpers.export(exports, "UIDEPTH", ()=>UIDEPTH);
parcelHelpers.export(exports, "FLOORDEPTH", ()=>FLOORDEPTH);
parcelHelpers.export(exports, "BLOCKDEPTH", ()=>BLOCKDEPTH);
parcelHelpers.export(exports, "SQUARESIZE", ()=>SQUARESIZE);
parcelHelpers.export(exports, "CHUNK_SIZE", ()=>CHUNK_SIZE);
parcelHelpers.export(exports, "EDGE_RATIO", ()=>EDGE_RATIO);
parcelHelpers.export(exports, "TILE_TYPES", ()=>TILE_TYPES);
parcelHelpers.export(exports, "DRAFT_UI_X_SHIFT", ()=>DRAFT_UI_X_SHIFT);
parcelHelpers.export(exports, "teamSetupArray", ()=>teamSetupArray);
parcelHelpers.export(exports, "TILE_ARR", ()=>TILE_ARR);
// --- TILE_MAP (full) ---
parcelHelpers.export(exports, "TILE_MAP", ()=>TILE_MAP);
parcelHelpers.export(exports, "gridPos", ()=>gridPos);
parcelHelpers.export(exports, "distanceBetween", ()=>distanceBetween);
parcelHelpers.export(exports, "handleGridXY", ()=>handleGridXY);
parcelHelpers.export(exports, "showAlert", ()=>showAlert);
parcelHelpers.export(exports, "intDiv", ()=>intDiv);
parcelHelpers.export(exports, "clearTaskPlusTimer", ()=>clearTaskPlusTimer);
parcelHelpers.export(exports, "gridColors", ()=>gridColors);
parcelHelpers.export(exports, "GHOST_ITEM_ICONS", ()=>GHOST_ITEM_ICONS);
parcelHelpers.export(exports, "colorFor", ()=>colorFor);
parcelHelpers.export(exports, "showGhostText", ()=>showGhostText);
parcelHelpers.export(exports, "ENEMY_BUILDING_HOVER_UI", ()=>ENEMY_BUILDING_HOVER_UI);
parcelHelpers.export(exports, "createBubbleText", ()=>createBubbleText);
parcelHelpers.export(exports, "PARCEL", ()=>PARCEL);
parcelHelpers.export(exports, "PRESSURE_CONTRACT", ()=>PRESSURE_CONTRACT);
parcelHelpers.export(exports, "CONTRACT_ECON", ()=>CONTRACT_ECON);
parcelHelpers.export(exports, "getContractStage", ()=>getContractStage);
parcelHelpers.export(exports, "estimatePressureContract", ()=>estimatePressureContract);
parcelHelpers.export(exports, "removeFromArray", ()=>removeFromArray);
parcelHelpers.export(exports, "calcStageScaled", ()=>calcStageScaled);
parcelHelpers.export(exports, "calcContractCost", ()=>calcContractCost);
parcelHelpers.export(exports, "calcPressureBonus", ()=>calcPressureBonus);
parcelHelpers.export(exports, "RESOURCE_PARCEL", ()=>RESOURCE_PARCEL);
var _uiconstants = require("./UI/UIConstants");
var _stageState = require("./parcelController/StageState");
// ---- Contract economy (costs + rewards) ----
// constants.js
var _stageStateJs = require("./parcelController/StageState.js"); // <-- adjust path if needed
function create2DArray(rows, cols) {
    let array = new Array(rows);
    for(let i = 0; i < rows; i++)array[i] = new Array(cols).fill(1);
    return array;
}
let selected = 'image0';
const GRID_HEIGHT = 10;
const CONTROL_STATES = {
    USER_MODE: 0,
    TRACK_MODE: 1,
    ATTACK_MODE: 2,
    FARM_MODE: 3,
    HARVEST_MODE: 4,
    FISH_MODE: 5,
    HEAL_MODE: 6,
    BUILD_MODE_T: 7,
    BUILD_MODE_B: 8,
    DESTROY_MODE: 9,
    SEED_MODE: 10,
    R_FARM_MODE: 11,
    BACK_TO_TOWN: 12,
    TRACK_TARGET: 13,
    SEND_TO_STORAGE: 14,
    WATER_CROPS_MODE: 15,
    GET_WATER_MODE: 16,
    COOK_MODE: 18,
    GET_FROM_STORAGE: 19,
    SEND_TO_OVEN: 20,
    GET_FROM_OVEN: 21,
    GET_BLOCK_RESOURCE: 22,
    SLEEP_MODE: 23,
    GO_HOME_MODE: 24,
    FLEE_MODE: 25,
    HEADING_TO_GUARD: 26,
    FIX_BUILDING: 27,
    SIEGE_MODE: 28,
    DESTROY_MODE_T: 29
};
const MAX_CROP_GROWTH_STAGE = 2; // assuming 0-4 frames
var WORLD_DIMENSIONX = 100;
var WORLD_DIMENSIONY = 100;
const UIDEPTH = 10;
const FLOORDEPTH = 2;
const BLOCKDEPTH = FLOORDEPTH + 1;
const SQUARESIZE = 16;
const CHUNK_SIZE = 60;
const EDGE_RATIO = CHUNK_SIZE / 8;
const TILE_TYPES = {
    grass: {
        name: "grass",
        spread: true,
        block: false,
        complex: false,
        grid: 1,
        depth: FLOORDEPTH
    },
    wall: {
        name: "wall",
        interior: 2,
        sides: {
            up: 3,
            down: 4,
            left: 5,
            right: 6
        },
        corners: {
            topLeft: 7,
            topRight: 8,
            bottomLeft: 9,
            bottomRight: 10
        },
        complex: true,
        price: {
            stone: 1
        },
        spread: true,
        block: true,
        grid: 2,
        depth: BLOCKDEPTH,
        spriteSheet: true,
        lenX: 1,
        lenY: 1,
        // OPTIONAL but recommended: new per-piece assets you mentioned
        // (keeps numeric mapping for grid/TILE_MAP but draw can use assets)
        assets: {
            interior: {
                key: 'wall_interior',
                sheet: false
            },
            edge: {
                key: 'wall_edge',
                sheet: false
            },
            corner: {
                key: 'wall_corner',
                sheet: false
            }
        }
    },
    sand: {
        name: "sand",
        value: 'image1',
        spread: false,
        block: true,
        complex: false,
        grid: 11,
        lenX: 3,
        lenY: 3,
        price: 10,
        depth: BLOCKDEPTH
    },
    pine: {
        name: "pine",
        value: 'pine3',
        price: 50,
        spread: false,
        block: true,
        complex: false,
        grid: 12,
        lenX: 4,
        lenY: 4,
        depth: BLOCKDEPTH + 2,
        resource: (0, _uiconstants.UI_ITEM_TYPES).wood,
        images: [
            'pine1',
            'pine2',
            'pine3'
        ]
    },
    turret: {
        name: "turret",
        value: [
            'image7',
            'image7a'
        ],
        spread: false,
        block: true,
        complex: false,
        grid: 13,
        lenX: 3,
        lenY: 3,
        price: 20000,
        depth: BLOCKDEPTH
    },
    // ── Dirt (complex, numbered + island; draw uses assets, not TILE_ARR) ──
    dirt: {
        name: "dirt",
        spread: true,
        block: false,
        complex: true,
        grid: 14,
        interior: 14,
        island: 15,
        sides: {
            up: 16,
            down: 17,
            left: 18,
            right: 19
        },
        corners: {
            topLeft: 20,
            topRight: 21,
            bottomLeft: 22,
            bottomRight: 23
        },
        depth: FLOORDEPTH,
        assets: {
            interior: {
                key: 'Dirt',
                sheet: false
            },
            island: {
                key: 'dirt_island',
                sheet: false
            },
            edge: {
                key: 'dirt_edge',
                sheet: false
            },
            corner: {
                key: 'dirt_corner',
                sheet: false
            }
        }
    },
    // ── Water (complex, numbered + island; draw uses assets, not TILE_ARR) ──
    water: {
        name: "water",
        spriteSheet: true,
        spread: true,
        block: true,
        complex: true,
        grid: 24,
        interior: 24,
        island: 25,
        sides: {
            up: 26,
            down: 27,
            left: 28,
            right: 29
        },
        corners: {
            topLeft: 30,
            topRight: 31,
            bottomLeft: 32,
            bottomRight: 33
        },
        depth: BLOCKDEPTH,
        assets: {
            interior: {
                key: 'water',
                sheet: true,
                anim: 'water'
            },
            island: {
                key: 'shore_island',
                sheet: true,
                anim: 'shore_island'
            },
            edge: {
                key: 'shore_edge',
                sheet: true,
                anim: 'shore_edge'
            },
            corner: {
                key: 'shore_corner',
                sheet: true,
                anim: 'shore_corner'
            }
        }
    },
    house1: {
        name: "house1",
        value: "house1",
        spriteSheet: false,
        spread: false,
        block: true,
        complex: false,
        grid: 34,
        depth: BLOCKDEPTH,
        lenX: 4,
        lenY: 4,
        cost: {
            wood: 4,
            stone: 4
        }
    },
    house2: {
        name: "house2",
        value: "house2",
        spriteSheet: false,
        spread: false,
        block: true,
        complex: false,
        grid: 35,
        depth: BLOCKDEPTH,
        lenX: 4,
        lenY: 4,
        cost: {
            wood: 4,
            stone: 4
        }
    },
    well: {
        name: "well",
        value: "well",
        spriteSheet: false,
        spread: false,
        block: true,
        complex: false,
        grid: 36,
        depth: BLOCKDEPTH,
        lenX: 4,
        lenY: 4
    },
    // ── Road (NEW: complex, interior/edge/corner/island; interior kept at 37) ──
    road: {
        name: "road",
        spread: true,
        block: false,
        complex: true,
        grid: 37,
        interior: 37,
        island: 48,
        sides: {
            up: 49,
            down: 50,
            left: 51,
            right: 52
        },
        corners: {
            topLeft: 53,
            topRight: 54,
            bottomLeft: 55,
            bottomRight: 56
        },
        depth: FLOORDEPTH,
        assets: {
            interior: {
                key: 'road_interior',
                sheet: false
            },
            island: {
                key: 'road_island',
                sheet: false
            },
            edge: {
                key: 'road_edge',
                sheet: false
            },
            corner: {
                key: 'road_corner',
                sheet: false
            }
        }
    },
    player: {
        name: "player",
        block: true,
        value: 'image9',
        depth: BLOCKDEPTH + 1,
        lenX: 1,
        lenY: 1
    },
    crops: {
        name: "crops",
        block: false,
        value: 'crops',
        spriteSheet: true,
        depth: FLOORDEPTH,
        spread: true,
        complex: false,
        price: 5,
        grid: 38
    },
    grassCrop: {
        name: "grassCrop",
        spread: true,
        block: false,
        complex: false,
        grid: 39,
        depth: FLOORDEPTH,
        interactable: true
    },
    grassBerry: {
        name: "grassBerry",
        spread: true,
        block: false,
        complex: false,
        grid: 40,
        depth: FLOORDEPTH,
        interactable: true
    },
    spawn: {
        name: "spawn",
        value: "spawn",
        spriteSheet: false,
        spread: false,
        block: false,
        complex: false,
        grid: 41,
        depth: BLOCKDEPTH,
        lenX: 4,
        lenY: 4
    },
    clayOven: {
        name: "clayOven",
        value: "clayOven",
        spriteSheet: true,
        spread: false,
        block: true,
        complex: false,
        grid: 42,
        depth: BLOCKDEPTH,
        lenX: 4,
        lenY: 4,
        cost: {
            stone: 4
        }
    },
    storage: {
        name: "storage",
        value: "storage",
        spriteSheet: false,
        spread: false,
        block: true,
        complex: false,
        grid: 43,
        depth: BLOCKDEPTH,
        lenX: 4,
        lenY: 4,
        cost: {
            wood: 4
        }
    },
    grassWood: {
        name: "grassWood",
        spread: true,
        block: false,
        complex: false,
        grid: 44,
        depth: FLOORDEPTH,
        interactable: true
    },
    grassRock: {
        name: "grassRock",
        spread: true,
        block: false,
        complex: false,
        grid: 45,
        depth: FLOORDEPTH,
        interactable: true
    },
    rock: {
        name: "rock",
        value: 'rock3',
        spread: false,
        block: true,
        complex: false,
        grid: 46,
        lenX: 3,
        lenY: 3,
        depth: BLOCKDEPTH + 2,
        resource: (0, _uiconstants.UI_ITEM_TYPES).stone,
        images: [
            'rock1',
            'rock2',
            'rock3'
        ]
    },
    construction: {
        name: "construction",
        value: 'construction',
        spread: false,
        block: true,
        complex: false,
        grid: 47,
        lenX: 4,
        lenY: 4,
        depth: BLOCKDEPTH + 2
    },
    woodWall: {
        name: "woodWall",
        interior: 57,
        sides: {
            up: 58,
            down: 59,
            left: 60,
            right: 61
        },
        corners: {
            topLeft: 62,
            topRight: 63,
            bottomLeft: 64,
            bottomRight: 65
        },
        complex: true,
        price: 5,
        spread: true,
        block: true,
        grid: 57,
        depth: BLOCKDEPTH,
        cost: {
            wood: 1
        },
        spriteSheet: true,
        lenX: 1,
        lenY: 1,
        // OPTIONAL recommended per-piece assets (your new naming scheme)
        assets: {
            interior: {
                key: 'woodWall_interior',
                sheet: false
            },
            edge: {
                key: 'woodWall_edge',
                sheet: false
            },
            corner: {
                key: 'woodWall_corner',
                sheet: false
            }
        }
    },
    // --- DOORS (NOT blocked; spriteSheet w/ 2 frames) ---
    wall_door: {
        value: 'wall_door',
        name: "wall_door",
        grid: 66,
        block: false,
        depth: BLOCKDEPTH,
        lenX: 1,
        lenY: 1,
        spriteSheet: true,
        complex: false,
        price: {
            stone: 1
        }
    },
    woodWall_door: {
        value: 'woodWall_door',
        name: "woodWall_door",
        grid: 67,
        block: false,
        depth: BLOCKDEPTH,
        lenX: 1,
        lenY: 1,
        spriteSheet: true,
        complex: false,
        price: {
            wood: 1
        }
    },
    fort_floor: {
        name: "fort_floor",
        spread: true,
        block: false,
        complex: true,
        grid: 68,
        interior: 68,
        island: 69,
        sides: {
            up: 70,
            down: 71,
            left: 72,
            right: 73
        },
        corners: {
            topLeft: 74,
            topRight: 75,
            bottomLeft: 76,
            bottomRight: 77
        },
        depth: FLOORDEPTH,
        assets: {
            interior: {
                key: 'fort_interior',
                sheet: false
            },
            island: {
                key: 'fort_island',
                sheet: false
            },
            edge: {
                key: 'fort_edge',
                sheet: false
            },
            corner: {
                key: 'fort_corner',
                sheet: false
            }
        }
    },
    tower: {
        name: "tower",
        value: "tower",
        spriteSheet: true,
        spread: false,
        block: true,
        complex: false,
        grid: 78,
        depth: BLOCKDEPTH,
        lenX: 5,
        lenY: 5,
        stayBlocked: true
    },
    // ── Fort enemy buildings (64x64 sheets, 2 frames) ──
    prison: {
        name: "prison",
        value: "prison_closed",
        spriteSheet: true,
        spread: false,
        block: true,
        complex: false,
        grid: 79,
        depth: BLOCKDEPTH,
        lenX: 4,
        lenY: 4,
        maxHealth: 450,
        stayBlocked: true
    },
    bank: {
        name: "bank",
        value: "bank_closed",
        spriteSheet: true,
        spread: false,
        block: true,
        complex: false,
        grid: 80,
        depth: BLOCKDEPTH,
        lenX: 4,
        lenY: 4,
        maxHealth: 500,
        stayBlocked: true
    }
};
const DRAFT_UI_X_SHIFT = 120;
const teamSetupArray = {
    smallTeam: [
        TILE_TYPES.clayOven,
        TILE_TYPES.house2,
        TILE_TYPES.house1,
        TILE_TYPES.storage
    ],
    bigTeam: [
        TILE_TYPES.well,
        TILE_TYPES.house1,
        TILE_TYPES.house2,
        TILE_TYPES.house1,
        TILE_TYPES.house1,
        TILE_TYPES.house2,
        TILE_TYPES.house1,
        TILE_TYPES.house2,
        TILE_TYPES.house1,
        TILE_TYPES.house2,
        TILE_TYPES.house1,
        TILE_TYPES.house1,
        TILE_TYPES.house2,
        TILE_TYPES.house1
    ]
};
const TILE_ARR = [
    0,
    'grass',
    // wall (2..10)
    'wall',
    'tWall',
    'bWall',
    'lWall',
    'rWall',
    'tlcWall',
    'trcWall',
    'blcWall',
    'brcWall',
    'image1',
    'pine3',
    [
        'image7',
        'image7a'
    ],
    // dirt (14..23) — compatibility only (draw uses assets)
    'Dirt',
    'iDirt',
    'tDirt',
    'bDirt',
    'lDirt',
    'rDirt',
    'tlcDirt',
    'trcDirt',
    'blcDirt',
    'brcDirt',
    // water (24..33) — compatibility only (draw uses assets)
    'water',
    'iwater',
    'twater',
    'bwater',
    'lwater',
    'rwater',
    'tlcwater',
    'trcwater',
    'blcwater',
    'brcwater',
    'house1',
    'house2',
    'well',
    // road interior kept as 37 for legacy sampling
    'road_interior',
    'crops',
    'grassCrop',
    'grassBerry',
    'spawn',
    'clayOven',
    'storage',
    'grassWood',
    'grassRock',
    'rock3',
    'construction',
    // road (48..56) — compatibility only (draw uses assets + rotation)
    'road_island',
    'road_edge',
    'road_edge',
    'road_edge',
    'road_edge',
    'road_corner',
    'road_corner',
    'road_corner',
    'road_corner',
    'woodWall',
    'wood_tWall',
    'wood_bWall',
    'wood_lWall',
    'wood_rWall',
    'wood_tlcWall',
    'wood_trcWall',
    'wood_blcWall',
    'wood_brcWall',
    'wall_door',
    'woodWall_door',
    'fort_interior',
    'fort_island',
    'fort_edge',
    'fort_edge',
    'fort_edge',
    'fort_edge',
    'fort_corner',
    'fort_corner',
    'fort_corner',
    'fort_corner',
    'tower',
    'prison_closed',
    'bank_closed'
];
function TILE_MAP(val) {
    if (val == 1) return "grass";
    else if (val >= 2 && val <= 10) return "wall";
    else if (val == 11) return "sand";
    else if (val == 12) return "pine";
    else if (val == 13) return "turret";
    else if (val >= 14 && val <= 23) return "dirt";
    else if (val >= 24 && val <= 33) return "water";
    else if (val == 34) return "house1";
    else if (val == 35) return "house2";
    else if (val == 36) return "well";
    else if (val == 37 || val >= 48 && val <= 56) return "road";
    else if (val == 38) return "crops";
    else if (val == 39) return "grassCrop";
    else if (val == 40) return "grassBerry";
    else if (val == 41) return "spawn";
    else if (val == 42) return "clayOven";
    else if (val == 43) return "storage";
    else if (val == 44) return "grassWood";
    else if (val == 45) return "grassRock";
    else if (val == 46) return "rock";
    else if (val == 47) return "construction";
    else if (val >= 57 && val <= 65) return "woodWall";
    else if (val == 66) return "wall_door";
    else if (val == 67) return "woodWall_door";
    else if (val >= 68 && val <= 77) return "fort_floor";
    else if (val == 78) return "tower";
    else if (val == 79) return "prison";
    else if (val == 80) return "bank";
    return null;
}
function gridPos(x, y) {
    return {
        x: Math.floor(x % WORLD_DIMENSIONX),
        y: Math.floor(y % WORLD_DIMENSIONY)
    };
}
function distanceBetween(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}
function handleGridXY(x, y, itemX, itemY) {
    let finalX, finalY;
    if (itemX % 2 == 1) finalX = x - x % SQUARESIZE + SQUARESIZE / 2;
    else finalX = x - x % SQUARESIZE + SQUARESIZE / 2;
    if (itemY % 2 == 1) finalY = y - y % SQUARESIZE + SQUARESIZE / 2;
    else finalY = y - y % SQUARESIZE + SQUARESIZE / 2;
    return [
        finalX,
        finalY
    ];
}
function showAlert(scene, message, color = '#ffffff', duration = 1000) {
    const alert = scene.add.text(scene.cameras.main.width / 2, 0, message, {
        fontSize: '24px',
        fill: color,
        stroke: '#000000',
        strokeThickness: 3
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(UIDEPTH);
    scene.tweens.add({
        targets: alert,
        y: 50,
        alpha: 0,
        duration: duration,
        ease: 'Cubic.easeOut',
        onComplete: ()=>alert.destroy()
    });
}
function intDiv(n, d) {
    return Math.floor(n / d);
}
function clearTaskPlusTimer(sprite) {
    if (sprite.task) sprite.task = null;
    if (sprite.timer) {
        sprite.timer.remove(false);
        sprite.timer = null;
    }
}
const gridColors = {
    water: 0x3cb8f1,
    wall: 0x808080,
    woodWall: 0x65350f,
    wall_door: 0x5a5a5a,
    woodWall_door: 0x2e1503,
    dirt: 0x4c2b18,
    grass: 0x33cc33,
    house1: 0x8b0000,
    house2: 0x006400,
    road: 0x555555,
    well: 0xADD8E6,
    grassCrop: 0x33cc33,
    grassBerry: 0x33cc33,
    grassWood: 0x33cc33,
    grassRock: 0x33cc33,
    spawn: 0x333333,
    storage: 0x7d4900,
    pine: 0x006400,
    rock: 0x5a682b,
    crops: 0xFCF55F,
    fort_floor: 0x777777
};
const GHOST_ITEM_ICONS = {
    food: "\uD83C\uDF56",
    clean_water: "\uD83D\uDCA7",
    unclean_water: "\uD83D\uDCA7",
    wood: "\uD83C\uDF32",
    stone: "\uD83D\uDDFF",
    crop: "\uD83C\uDF3E",
    seedCrop: "\uD83C\uDF31",
    seedBerry: "\uD83C\uDF52"
};
const colorFor = (cell)=>{
    const type = Array.isArray(cell) ? TILE_MAP(cell[1]) : TILE_MAP(cell);
    return gridColors[type] || 0xffffff;
};
function showGhostText(scene, x, y, text, teamNumber, isCrit = false, isMiss = false, colorGiven = false) {
    let color;
    if (colorGiven) color = colorGiven;
    else if (isMiss) color = '#888888'; // Gray for MISS
    else if (teamNumber === 1) color = '#44ff44'; // Green for player/team 0 hit
    else color = isCrit ? '#ff4444' : '#ffffff'; // Red or white for enemies
    const ghost = scene.add.text(x, y, text, {
        fontSize: '16px',
        fill: color,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 2
    }).setDepth(1000).setOrigin(0.5);
    scene.tweens.add({
        targets: ghost,
        y: y - 20,
        alpha: 0,
        duration: 600,
        onComplete: ()=>ghost.destroy()
    });
    scene.uiCamera.ignore(ghost);
}
const ENEMY_BUILDING_HOVER_UI = {
    // how far above the sprite's TOP the panel sits (bigger = higher)
    PANEL_Y_OFFSET: 0,
    // text offsets *within* the panel (relative to panel center)
    LINE1_DY: -9,
    LINE2_DY: 6
};
function createBubbleText({ scene, target, text, textColor = '#ffffff', bgColor = 'rgba(0,0,0,0.6)', fontSize = 10, duration = 1200, floatOffset = 18, fadeDuration = 350 }) {
    if (!scene || !target) return;
    // Base text (world-space)
    const label = scene.add.text(target.x, target.y - 20, text, {
        fontSize: `${fontSize}px`,
        fontFamily: 'monospace',
        color: textColor,
        stroke: '#000000',
        strokeThickness: 2
    }).setDepth(10000).setOrigin(0.5).setScrollFactor(1, 1); // 🔹 world, not UI
    // Background auto-sized to text
    const padding = 4;
    const bg = scene.add.rectangle(label.x, label.y, label.width + padding * 2, label.height + padding * 2, Phaser.Display.Color.HexStringToColor(bgColor).color, 1).setOrigin(0.5).setDepth(9999).setScrollFactor(1, 1); // 🔹 world, not UI
    // Make sure uiCamera does NOT render these
    if (scene.uiCamera) scene.uiCamera.ignore([
        label,
        bg
    ]);
    const container = {
        label,
        bg,
        target
    };
    // Follow target
    container.update = ()=>{
        if (!container.target || !container.label.active || !container.bg.active) return;
        const newX = container.target.x;
        const newY = container.target.y - floatOffset;
        container.label.x = newX;
        container.label.y = newY;
        container.bg.x = newX;
        container.bg.y = newY;
    };
    scene.events.on('update', container.update);
    // Float then fade
    scene.tweens.add({
        targets: [
            label,
            bg
        ],
        y: label.y - 15,
        duration,
        ease: 'Linear',
        onComplete: ()=>{
            scene.tweens.add({
                targets: [
                    label,
                    bg
                ],
                alpha: 0,
                duration: fadeDuration,
                onComplete: ()=>{
                    label.destroy();
                    bg.destroy();
                    scene.events.off('update', container.update);
                }
            });
        }
    });
    return container;
}
const PARCEL = {
    SIZE: 25,
    // Main island top-left (world is 100x100; main parcel at 37,37 → 25 down/right)
    MAIN_ORIGIN: {
        x: 37,
        y: 37
    },
    // Contract parcels sit one parcel away from main island; add a gap so UI isn't touching
    GAP_TILES: 0,
    // World-space slot layout: W / S / E around the main parcel (N reserved for fort)
    SLOTS: {
        W: {
            dx: -25,
            dy: 0
        },
        S: {
            dx: 0,
            dy: 25
        },
        E: {
            dx: 25,
            dy: 0
        }
    }
};
const PRESSURE_CONTRACT = {
    DIFFICULTY_MIN: 1,
    DIFFICULTY_MAX: 3,
    // how many spawners per difficulty (1..3)
    SPAWNERS_BY_DIFFICULTY: {
        1: 1,
        2: 2,
        3: 3
    },
    // total raiders quota per spawner at stage 1 (scaled with stageIndex later)
    BASE_QUOTA_PER_SPAWNER: 3,
    // spawn interval (ms) drops as stage increases, down to MIN_INTERVAL_MS.
    BASE_INTERVAL_MS: 4000,
    MIN_INTERVAL_MS: 1500,
    INTERVAL_DROP_PER_STAGE_MS: 250
};
const CONTRACT_ECON = {
    STAGE_MULT: 0.25,
    COST_BASE: {
        FARM: 150,
        FOREST: 150,
        ROCK: 125,
        MILITIA: 200,
        PRESSURE: 120
    },
    PRESSURE_PER_DIFFICULTY: 60,
    PRESSURE_BONUS_BASE: 150,
    PRESSURE_BONUS_PER_DIFFICULTY: 75,
    // ✅ deterministic raider pay (matches raider.killReward=40)
    KILL_PAY_BASE: 40
};
function getContractStage(scene) {
    // ✅ preferred: global stage state
    if ((0, _stageStateJs.StageState)?.stageIndex != null) return (0, _stageStateJs.StageState).stageIndex;
    // fallback if you ever run without StageState wired
    if (!scene.contractStage) scene.contractStage = 1;
    return scene.contractStage;
}
function estimatePressureContract(scene, difficulty = 1) {
    const stage = getContractStage(scene);
    const spawners = PRESSURE_CONTRACT.SPAWNERS_BY_DIFFICULTY[difficulty] ?? 1;
    const quotaPerSpawner = PRESSURE_CONTRACT.BASE_QUOTA_PER_SPAWNER + Math.max(0, stage - 1);
    const totalKills = spawners * quotaPerSpawner;
    const cost = calcContractCost(scene, "PRESSURE", difficulty);
    const bonus = calcPressureBonus(scene, difficulty);
    const killPay = CONTRACT_ECON.KILL_PAY_BASE;
    const killTotal = totalKills * killPay;
    const gross = killTotal + bonus;
    const net = gross - cost;
    return {
        stage,
        spawners,
        quotaPerSpawner,
        totalKills,
        killPay,
        killTotal,
        bonus,
        cost,
        gross,
        net
    };
}
function removeFromArray(arr, obj) {
    if (!Array.isArray(arr)) return;
    const i = arr.indexOf(obj);
    if (i !== -1) arr.splice(i, 1);
}
function calcStageScaled(value, stage, mult) {
    const m = 1 + mult * Math.max(0, stage - 1);
    return Math.round(value * m);
}
function calcContractCost(scene, type, difficulty = 1) {
    const stage = getContractStage(scene);
    const base = CONTRACT_ECON.COST_BASE[type] ?? 0;
    let raw = base;
    if (type === "PRESSURE") raw = base + CONTRACT_ECON.PRESSURE_PER_DIFFICULTY * Math.max(1, difficulty);
    return calcStageScaled(raw, stage, CONTRACT_ECON.STAGE_MULT);
}
function calcPressureBonus(scene, difficulty = 1) {
    const stage = getContractStage(scene);
    const raw = CONTRACT_ECON.PRESSURE_BONUS_BASE + CONTRACT_ECON.PRESSURE_BONUS_PER_DIFFICULTY * Math.max(1, difficulty);
    return calcStageScaled(raw, stage, CONTRACT_ECON.STAGE_MULT);
}
const RESOURCE_PARCEL = {
    // how much water "spots" to scatter (percent of tiles)
    WATER_SPOT_PCT: 0.06,
    // min distance from parcel edge to place water so you don’t create open-water borders
    WATER_EDGE_BUFFER: 2
};

},{"./UI/UIConstants":"424Vy","./parcelController/StageState":"3gSPQ","./parcelController/StageState.js":"3gSPQ","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"424Vy":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "UI_ITEM_TYPES", ()=>UI_ITEM_TYPES);
const UI_ITEM_TYPES = {
    unclean_water: {
        name: "unclean_water",
        icon: "uncleanWaterIcon",
        description: "Water from a unclean source, for farming",
        cooksTo: "clean_water",
        label: "Unclean Water",
        stacks: 15
    },
    clean_water: {
        name: "clean_water",
        icon: "waterIcon",
        label: "Clean Water",
        description: "Safe drinking water",
        stacks: 15
    },
    food: {
        name: "food",
        icon: "foodIcon",
        description: "Cooked rations",
        label: "Food",
        stacks: 15
    },
    rawFood: {
        name: "rawFood",
        icon: "foodIcon",
        description: "Uncooked rations",
        label: "Raw Food",
        cooksTo: "food",
        stacks: 15
    },
    wood: {
        name: "wood",
        icon: "woodIcon",
        label: "Wood",
        description: "Basic fuel for ovens",
        stacks: 5
    },
    stone: {
        name: "stone",
        icon: "stoneIcon",
        label: "Stone",
        description: "Construction material",
        stacks: 5
    },
    crop: {
        name: "crop",
        icon: "foodIcon",
        description: "Wheat",
        label: "Crop",
        stacks: 10,
        food: true,
        foodValue: 1
    },
    seedCrop: {
        name: 'seedCrop',
        stacks: 10,
        label: "Crop Seed",
        icon: 'seeds',
        food: false,
        seed: true
    },
    seedBerry: {
        name: 'seedBerry',
        label: "Berry Seed",
        stacks: 10,
        icon: 'berry',
        food: false,
        seed: true
    }
};

},{"@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"jnFvT":[function(require,module,exports,__globalThis) {
exports.interopDefault = function(a) {
    return a && a.__esModule ? a : {
        default: a
    };
};
exports.defineInteropFlag = function(a) {
    Object.defineProperty(a, '__esModule', {
        value: true
    });
};
exports.exportAll = function(source, dest) {
    Object.keys(source).forEach(function(key) {
        if (key === 'default' || key === '__esModule' || Object.prototype.hasOwnProperty.call(dest, key)) return;
        Object.defineProperty(dest, key, {
            enumerable: true,
            get: function() {
                return source[key];
            }
        });
    });
    return dest;
};
exports.export = function(dest, destName, get) {
    Object.defineProperty(dest, destName, {
        enumerable: true,
        get: get
    });
};

},{}],"3gSPQ":[function(require,module,exports,__globalThis) {
// parcelController/StageState.js
// Stage/season progression + north-fort win condition (supports multiple towers)
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "StageState", ()=>StageState);
const StageState = {
    stageIndex: 1,
    seasonIndex: 1,
    STAGES_PER_SEASON: 5,
    // Fort towers that exist in the world (registered by TowerBuilding)
    _fortTowers: new Set(),
    // Fort objective state (per season)
    _fortObjective: {
        active: false,
        seasonIndex: 1,
        requiredCount: 0,
        destroyedSet: new Set(),
        completed: false,
        meta: null
    },
    _listeners: {
        seasonAdvanced: new Set(),
        fortDestroyed: new Set()
    },
    onSeasonAdvanced (fn) {
        if (typeof fn === "function") this._listeners.seasonAdvanced.add(fn);
        return ()=>this._listeners.seasonAdvanced.delete(fn);
    },
    onFortDestroyed (fn) {
        if (typeof fn === "function") this._listeners.fortDestroyed.add(fn);
        return ()=>this._listeners.fortDestroyed.delete(fn);
    },
    // Called by TowerBuilding when a fort objective tower is created
    registerFortTower (towerRef) {
        if (towerRef) this._fortTowers.add(towerRef);
    },
    // Called by TowerBuilding when it is destroyed (optional hygiene)
    unregisterFortTower (towerRef) {
        if (towerRef) this._fortTowers.delete(towerRef);
    },
    advanceStage () {
        this.stageIndex += 1;
    },
    advanceSeason (meta = {}) {
        this.seasonIndex += 1;
        this.stageIndex = 1;
        // Reset objective and tower registry for next season (fresh world)
        this._fortTowers.clear();
        this._fortObjective = {
            active: false,
            seasonIndex: this.seasonIndex,
            requiredCount: 0,
            destroyedSet: new Set(),
            completed: false,
            meta: null
        };
        for (const fn of this._listeners.seasonAdvanced)try {
            fn({
                seasonIndex: this.seasonIndex,
                stageIndex: this.stageIndex,
                ...meta
            });
        } catch (_) {}
    },
    // Call AFTER reward selection to move to next stage/season and reset fort objective state.
    completeFortCycle (meta = {}, opts = {}) {
        const stagesPerSeason = Math.max(1, Number(opts.stagesPerSeason ?? this.STAGES_PER_SEASON) || 5);
        if (this.stageIndex >= stagesPerSeason) this.advanceSeason({
            reason: "fort_defeated",
            ...meta
        });
        else {
            this.stageIndex += 1;
            this._fortTowers.clear();
            this._fortObjective = {
                active: false,
                seasonIndex: this.seasonIndex,
                requiredCount: 0,
                destroyedSet: new Set(),
                completed: false,
                meta: null
            };
        }
        return {
            seasonIndex: this.seasonIndex,
            stageIndex: this.stageIndex
        };
    },
    /**
   * Arm the north-fort objective for the CURRENT season.
   * Call after all fort towers are spawned/created.
   */ setFortObjective (meta = {}) {
        const snapshotCount = Number.isFinite(meta.requiredTowerCount) && meta.requiredTowerCount > 0 ? Math.floor(meta.requiredTowerCount) : this._fortTowers.size > 0 ? this._fortTowers.size : 1;
        this._fortObjective.active = true;
        this._fortObjective.seasonIndex = this.seasonIndex;
        this._fortObjective.requiredCount = snapshotCount;
        this._fortObjective.destroyedSet = new Set();
        this._fortObjective.completed = false;
        this._fortObjective.meta = meta;
    },
    /**
   * Called by TowerBuilding.destroy()
   * Counts down fort towers; only completes when requiredCount reached.
   */ notifyFortTowerDestroyed (towerRef) {
        const obj = this._fortObjective;
        if (!obj.active) return false;
        if (obj.completed) return false;
        // Only count towers that were registered as fort towers
        if (!this._fortTowers.has(towerRef)) return false;
        // Do not double-count
        if (obj.destroyedSet.has(towerRef)) return false;
        obj.destroyedSet.add(towerRef);
        // Not done yet -> just counted
        if (obj.destroyedSet.size < obj.requiredCount) return true;
        // Completed (reward + progression handled by scene callback)
        obj.completed = true;
        for (const fn of this._listeners.fortDestroyed)try {
            fn({
                seasonIndex: this.seasonIndex,
                stageIndex: this.stageIndex,
                meta: obj.meta
            });
        } catch (_) {}
        return true;
    }
};

},{"@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}]},["12lyG","6Q7L8"], "6Q7L8", "parcelRequire5055", {})

//# sourceMappingURL=ProcessV2.3cc398da.js.map
