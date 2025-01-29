// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function (modules, entry, mainEntry, parcelRequireName, globalName) {
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

  var cache = previousRequire.cache || {};
  // Do not use `require` to prevent Webpack from trying to bundle this call
  var nodeRequire =
    typeof module !== 'undefined' &&
    typeof module.require === 'function' &&
    module.require.bind(module);

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
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
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [
      function (require, module) {
        module.exports = exports;
      },
      {},
    ];
  };

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

      // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }
})({"1Fqy1":[function(require,module,exports,__globalThis) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SECURE = false;
var HMR_ENV_HASH = "d6ea1d42532a7575";
var HMR_USE_SSE = false;
module.bundle.HMR_BUNDLE_ID = "bed887d14d6bcbeb";
"use strict";
/* global HMR_HOST, HMR_PORT, HMR_ENV_HASH, HMR_SECURE, HMR_USE_SSE, chrome, browser, __parcel__import__, __parcel__importScripts__, ServiceWorkerGlobalScope */ /*::
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
var checkedAssets /*: {|[string]: boolean|} */ , disposedAssets /*: {|[string]: boolean|} */ , assetsToDispose /*: Array<[ParcelRequire, string]> */ , assetsToAccept /*: Array<[ParcelRequire, string]> */ ;
function getHostname() {
    return HMR_HOST || (location.protocol.indexOf('http') === 0 ? location.hostname : 'localhost');
}
function getPort() {
    return HMR_PORT || location.port;
}
// eslint-disable-next-line no-redeclare
var parent = module.bundle.parent;
if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== 'undefined') {
    var hostname = getHostname();
    var port = getPort();
    var protocol = HMR_SECURE || location.protocol == 'https:' && ![
        'localhost',
        '127.0.0.1',
        '0.0.0.0'
    ].includes(hostname) ? 'wss' : 'ws';
    var ws;
    if (HMR_USE_SSE) ws = new EventSource('/__parcel_hmr');
    else try {
        ws = new WebSocket(protocol + '://' + hostname + (port ? ':' + port : '') + '/');
    } catch (err) {
        if (err.message) console.error(err.message);
        ws = {};
    }
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
    // $FlowFixMe
    ws.onmessage = async function(event /*: {data: string, ...} */ ) {
        checkedAssets = {} /*: {|[string]: boolean|} */ ;
        disposedAssets = {} /*: {|[string]: boolean|} */ ;
        assetsToAccept = [];
        assetsToDispose = [];
        var data /*: HMRMessage */  = JSON.parse(event.data);
        if (data.type === 'reload') fullReload();
        else if (data.type === 'update') {
            // Remove error overlay if there is one
            if (typeof document !== 'undefined') removeErrorOverlay();
            let assets = data.assets.filter((asset)=>asset.envHash === HMR_ENV_HASH);
            // Handle HMR Update
            let handled = assets.every((asset)=>{
                return asset.type === 'css' || asset.type === 'js' && hmrAcceptCheck(module.bundle.root, asset.id, asset.depsByBundle);
            });
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
<a href="/__parcel_launch_editor?file=${encodeURIComponent(frame.location)}" style="text-decoration: underline; color: #888" onclick="fetch(this.href); return false">${frame.location}</a>
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
    if ('reload' in location) location.reload();
    else if (extCtx && extCtx.runtime && extCtx.runtime.reload) extCtx.runtime.reload();
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
    if (cssTimeout) return;
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
    if (hmrAcceptCheckOne(bundle, id, depsByBundle)) return true;
    // Traverse parents breadth first. All possible ancestries must accept the HMR update, or we'll reload.
    let parents = getParents(module.bundle.root, id);
    let accepted = false;
    while(parents.length > 0){
        let v = parents.shift();
        let a = hmrAcceptCheckOne(v[0], v[1], null);
        if (a) // If this parent accepts, stop traversing upward, but still consider siblings.
        accepted = true;
        else {
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
        if (!bundle.parent) return true;
        return hmrAcceptCheck(bundle.parent, id, depsByBundle);
    }
    if (checkedAssets[id]) return true;
    checkedAssets[id] = true;
    var cached = bundle.cache[id];
    assetsToDispose.push([
        bundle,
        id
    ]);
    if (!cached || cached.hot && cached.hot._acceptCallbacks.length) {
        assetsToAccept.push([
            bundle,
            id
        ]);
        return true;
    }
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

},{}],"gLLPy":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
var _phaser = require("phaser");
var _phaserDefault = parcelHelpers.interopDefault(_phaser);
var _worldMapPng = require("../assets/worldMap.png");
var _worldMapPngDefault = parcelHelpers.interopDefault(_worldMapPng);
var _blackPng = require("../assets/black.png");
var _blackPngDefault = parcelHelpers.interopDefault(_blackPng);
var _grayPng = require("../assets/gray.png");
var _grayPngDefault = parcelHelpers.interopDefault(_grayPng);
var _greenPng = require("../assets/green.png");
var _greenPngDefault = parcelHelpers.interopDefault(_greenPng);
var _purplePng = require("../assets/purple.png");
var _purplePngDefault = parcelHelpers.interopDefault(_purplePng);
var _hammerPng = require("../assets/hammer.png");
var _hammerPngDefault = parcelHelpers.interopDefault(_hammerPng);
var _grassPng = require("../assets/grass.png");
var _grassPngDefault = parcelHelpers.interopDefault(_grassPng);
var _mapJs = require("./map.js");
var _turretJs = require("./Turret.js");
var _navmesh = require("navmesh");
var _constants = require("./constants");
var _itemTabJs = require("./itemTab.js");
var _playerJs = require("./Player.js");
var _projectileJs = require("./Projectile.js");
var _playerPng = require("../assets/Players/player.png");
var _playerPngDefault = parcelHelpers.interopDefault(_playerPng);
const screenH = window.innerHeight;
const screenW = window.innerWidth;
class mapView extends (0, _phaserDefault.default).Scene {
    constructor(){
        super('mapView');
        (0, _mapJs.Map).scene = this;
        (0, _turretJs.Turret).scene = this;
        this.gridPlace = false;
        this.selectMode = true;
    }
    preload() {
        this.load.spritesheet('player', (0, _playerPngDefault.default), {
            frameWidth: 20,
            frameHeight: 28
        });
        this.load.image('barrier', (0, _grayPngDefault.default)); // Load a barrier image
        this.load.image('worldMap', (0, _worldMapPngDefault.default));
        this.load.image('cube', (0, _blackPngDefault.default)); // Make sure the path and filename are correct
        this.load.image('selected', (0, _greenPngDefault.default));
        this.load.image('leader', (0, _purplePngDefault.default));
        this.load.image('hammer', (0, _hammerPngDefault.default));
        this.load.image('grass', (0, _grassPngDefault.default));
        (0, _itemTabJs.itemTab).preload(this);
        (0, _projectileJs.Projectile).init(this);
    }
    create() {
        (0, _playerJs.Player).init(this);
        let grid = (0, _constants.create2DArray)((0, _constants.WORLD_DIMENSION), (0, _constants.WORLD_DIMENSION));
        (0, _mapJs.Map).grid = grid;
        // Map.grid = [[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],
        // [1,1,1,1,1,1,1],[1,1,1,1,1,1,1],
        // [1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1]]
        (0, _mapJs.Map).initMap();
        (0, _mapJs.Map).mapFromData((0, _mapJs.Map).grid);
        // Player.addPlayer(10,10,1)
        this.cursors = this.input.keyboard.createCursorKeys();
        // Add collision between the cube and the barriers
        // this.physics.add.collider(characters, Map.barrier);
        this.physics.add.collider((0, _playerJs.Player).characters, (0, _playerJs.Player).characters, (0, _playerJs.Player).handlePlayerCollision);
        this.physics.add.collider((0, _playerJs.Player).characters, (0, _projectileJs.Projectile).projectileGroup, (0, _playerJs.Player).handleCollision, null, this);
        this.cursors = this.input.keyboard.createCursorKeys();
        // Variable to store the current text object
        let currentText;
        // Variable to store the current text objects
        let selectionCountText;
        this.registry.set('image', 'init');
        this.registry.events.on('changedata-image', (parent, value)=>{
            console.log(`Registry key 'image' updated to value:`, value);
            const item = (0, _itemTabJs.itemTab).itemValues(value);
            if (item.spread) this.gridPlace = true;
            else if (item == (0, _constants.TILE_TYPES).turret) (0, _turretJs.Turret).placeItem(item);
            else (0, _mapJs.Map).placeItem(item);
        });
        // Store references to keys
        this.keys = this.input.keyboard.addKeys({
            up: (0, _phaserDefault.default).Input.Keyboard.KeyCodes.W,
            down: (0, _phaserDefault.default).Input.Keyboard.KeyCodes.S,
            left: (0, _phaserDefault.default).Input.Keyboard.KeyCodes.A,
            right: (0, _phaserDefault.default).Input.Keyboard.KeyCodes.D,
            arrowUp: (0, _phaserDefault.default).Input.Keyboard.KeyCodes.UP,
            arrowDown: (0, _phaserDefault.default).Input.Keyboard.KeyCodes.DOWN,
            arrowLeft: (0, _phaserDefault.default).Input.Keyboard.KeyCodes.LEFT,
            arrowRight: (0, _phaserDefault.default).Input.Keyboard.KeyCodes.RIGHT
        });
        this.input.keyboard.on('keydown-ESC', ()=>{
            this.selectMode = true;
            if (this.gridPlace) this.gridPlace = false;
            else if ((0, _turretJs.Turret).isPlacing) {
                (0, _turretJs.Turret).isPlacing = false;
                (0, _turretJs.Turret).topItem.destroy();
                (0, _turretJs.Turret).baseItem.destroy();
            } else {
                (0, _mapJs.Map).isPlacing = false; // Exit placing mode
                (0, _mapJs.Map).placingItem.destroy(); // Clear placing item
            }
            (0, _mapJs.Map).navMesh = new (0, _navmesh.NavMesh)((0, _navmesh.buildPolysFromGridMap)((0, _mapJs.Map).navGrid, (0, _constants.SQUARESIZE), (0, _constants.SQUARESIZE), undefined, 0));
        });
        this.graphics = this.add.graphics(); // Graphics object for drawing the selection outline
        this.startCell = null; // Start cell (grid coordinates)
        this.endCell = null; // End cell (grid coordinates)
        // Add a mouse click listener
        this.input.on('pointerdown', (pointer)=>{
            if ((0, _mapJs.Map).isPlacing && (0, _mapJs.Map).placingItem) {
                const items = (0, _itemTabJs.itemTab).itemValues(this.registry.get('image'));
                (0, _mapJs.Map).handleMapClick(pointer, items);
                if (!(0, _mapJs.Map).placingItem.blocked) (0, _mapJs.Map).placeItem(items);
            } else if ((0, _turretJs.Turret).isPlacing) {
                const items = (0, _itemTabJs.itemTab).itemValues(this.registry.get('image'));
                (0, _turretJs.Turret).handleMapClick(pointer, items);
                if (!(0, _turretJs.Turret).placeItem.blocked) (0, _turretJs.Turret).placeItem(items);
            } else if ((this.gridPlace || this.selectMode) && pointer.button == 2) {
                const gridX = Math.floor(pointer.worldX / (0, _constants.SQUARESIZE));
                const gridY = Math.floor(pointer.worldY / (0, _constants.SQUARESIZE));
                this.pointerMoving = true;
                // Set the starting cell for selection
                this.startCell = {
                    x: gridX,
                    y: gridY
                };
                this.endCell = {
                    x: gridX,
                    y: gridY
                };
            } else if (this.breakItems.text != 'Place') {
                let x = pointer.worldX;
                let y = pointer.worldY;
                let posX = Math.floor(x / (0, _constants.SQUARESIZE));
                let posY = Math.floor(y / (0, _constants.SQUARESIZE));
                // Remove the previous text if it exists
                if (currentText) currentText.destroy();
                if (selectionCountText) selectionCountText.destroy();
                // Add the position text
                currentText = this.add.text(this.cameras.main.width - 120, 10, `(${posX}, ${posY})`, {
                    fontSize: '16px',
                    fill: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 3
                }).setScrollFactor(0) // Stick to camera
                .setDepth((0, _constants.UIDEPTH));
                // Add the selection count text
                selectionCountText = this.add.text(this.cameras.main.width - 150, 30, `Selected: ${(0, _playerJs.Player).selected.length}`, {
                    fontSize: '16px',
                    fill: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 3
                }).setScrollFactor(0) // Stick to camera
                .setDepth((0, _constants.UIDEPTH));
                (0, _playerJs.Player).selected.forEach((troop, index)=>{
                    if (!troop.active) {
                        (0, _playerJs.Player).selected.splice(index, 1);
                        return;
                    }
                    troop.state = (0, _constants.CONTROL_STATES).USER_MODE;
                    let troopX = Math.floor(troop.body.x / (0, _constants.SQUARESIZE));
                    let troopY = Math.floor(troop.body.y / (0, _constants.SQUARESIZE));
                    if ((0, _mapJs.Map).grid[troopY][troopX] == 0) console.log("Start pos is at blocked grid");
                    else if ((0, _mapJs.Map).grid[posY][posX] == 0) console.log("end pos is at blocked grid");
                    (0, _playerJs.Player).moveTo(troop, (0, _mapJs.Map).navMesh.findPath({
                        x: troop.body.x,
                        y: troop.body.y
                    }, {
                        x: x,
                        y: y
                    }));
                });
            }
        });
        this.input.on('pointermove', (pointer)=>this.onPointerMove(pointer, (0, _constants.SQUARESIZE)));
        this.input.on('pointerup', ()=>this.onPointerUp());
        this.sceneButtons();
    }
    handleKeyboardCameraMovement() {
        const camera = this.cameras.main;
        const speed = 10; // Camera movement speed
        const { width, height } = camera;
        // Check keyboard inputs for WASD or arrow keys
        if (this.keys.up.isDown || this.keys.arrowUp.isDown) camera.scrollY -= speed; // Move up
        if (this.keys.down.isDown || this.keys.arrowDown.isDown) camera.scrollY += speed; // Move down
        if (this.keys.left.isDown || this.keys.arrowLeft.isDown) camera.scrollX -= speed; // Move left
        if (this.keys.right.isDown || this.keys.arrowRight.isDown) camera.scrollX += speed; // Move right
    // Clamp camera position to world bounds
    // camera.scrollX = Phaser.Math.Clamp(camera.scrollX, 0, WORLD_DIMENSION * SQUARESIZE - width);
    // camera.scrollY = Phaser.Math.Clamp(camera.scrollY, 0, WORLD_DIMENSION * SQUARESIZE - height);
    }
    onPointerMove(pointer) {
        if (this.startCell) {
            const gridX = Math.floor(pointer.worldX / (0, _constants.SQUARESIZE));
            const gridY = Math.floor(pointer.worldY / (0, _constants.SQUARESIZE));
            // Update the end cell for selection
            this.endCell = {
                x: gridX,
                y: gridY
            };
            if ((0, _mapJs.Map).checkSpreadPosition(this.startCell.x, this.startCell.y, this.endCell.x, this.endCell.y)) this.drawSelectionOutline("0xff0000");
            else // Visualize the current selection
            this.drawSelectionOutline("0x00ff00");
        }
    }
    onPointerUp() {
        this.graphics.clear();
        if (!this.gridPlace) (0, _playerJs.Player).handlePlayerSelect();
        else if (this.startCell && this.endCell) // Get all selected grid cells
        this.getSelectedCells();
        this.startCell = null;
        this.endCell = null;
    }
    drawSelectionOutline(color) {
        this.graphics.clear(); // Clear previous drawings
        this.graphics.lineStyle(2, color, 1); // black outline with thickness
        const minX = Math.min(this.startCell.x, this.endCell.x);
        const maxX = Math.max(this.startCell.x, this.endCell.x);
        const minY = Math.min(this.startCell.y, this.endCell.y);
        const maxY = Math.max(this.startCell.y, this.endCell.y);
        const rectX = minX * (0, _constants.SQUARESIZE);
        const rectY = minY * (0, _constants.SQUARESIZE);
        const rectWidth = (maxX - minX + 1) * (0, _constants.SQUARESIZE);
        const rectHeight = (maxY - minY + 1) * (0, _constants.SQUARESIZE);
        this.graphics.setDepth((0, _constants.UIDEPTH));
        this.graphics.strokeRect(rectX, rectY, rectWidth, rectHeight); // Draw the rectangle
    }
    getSelectedCells() {
        const minX = Math.min(this.startCell.x, this.endCell.x);
        const maxX = Math.max(this.startCell.x, this.endCell.x);
        const minY = Math.min(this.startCell.y, this.endCell.y);
        const maxY = Math.max(this.startCell.y, this.endCell.y);
        const item = (0, _itemTabJs.itemTab).itemValues(this.registry.get('image'));
        item.lenX = maxX - minX;
        item.lenY = maxY - minY;
        (0, _mapJs.Map).addSpreadItem(minX, minY, item);
    }
    sceneButtons() {
        const camera = this.cameras.main;
        // Add the top bar
        const topBar = this.add.rectangle(0, 0, camera.width, 50, 0x808080, 0.5) // Gray and transparent
        .setOrigin(0, 0).setScrollFactor(0) // Sticks to the camera
        .setDepth((0, _constants.UIDEPTH) - 1);
        // Add the bottom bar
        const bottomBar = this.add.rectangle(0, camera.height - 50, camera.width, 50, 0x000000, 1) // Opaque black
        .setOrigin(0, 0).setScrollFactor(0) // Sticks to the camera
        .setDepth((0, _constants.UIDEPTH) - 1);
        // Add "Layout" button
        const itemTab = this.add.text(10, camera.height - 40, 'Layout', {
            fontSize: '24px',
            fill: '#ffffff'
        }).setInteractive().setScrollFactor(0) // Sticks to the camera
        .setDepth((0, _constants.UIDEPTH)).on('pointerdown', ()=>{
            this.selectMode = false;
            this.input.stopPropagation();
            this.gridPlace = false;
            this.scene.switch('itemTab');
        });
        itemTab.setStroke('#000000', 3);
        // Add "Delete/Place" button
        this.breakItems = this.add.text(120, camera.height - 40, 'Delete', {
            fontSize: '24px',
            fill: '#ffffff'
        }).setInteractive().setScrollFactor(0) // Sticks to the camera
        .setDepth((0, _constants.UIDEPTH)).on('pointerdown', ()=>{
            if (this.breakItems.text === 'Delete') {
                this.selectMode = false;
                this.breakItems.setText('Place');
                this.input.setDefaultCursor('none');
                this.customCursor = this.add.sprite(0, 0, 'hammer').setDepth((0, _constants.UIDEPTH) + 1).setScrollFactor(0); // Stick cursor to camera
                this.input.on('pointermove', (pointer)=>{
                    if (this.customCursor) this.customCursor.setPosition(pointer.worldX, pointer.worldY);
                });
            } else if (this.breakItems.text === 'Place') {
                this.selectMode = true;
                this.breakItems.setText('Delete');
                this.input.setDefaultCursor('default');
                if (this.customCursor) {
                    this.customCursor.destroy();
                    this.customCursor = null;
                }
            }
        });
        this.breakItems.setStroke('#000000', 3);
        // Automatically scale the bars if the window resizes
        this.scale.on('resize', (gameSize)=>{
            const { width, height } = gameSize;
            topBar.setSize(width, 50);
            bottomBar.setSize(width, 100).setY(height - 100);
        });
        // Add Save and Load Buttons
        const buttonWidth = 80;
        const buttonHeight = 30;
        const buttonMargin = 10;
        // Save Button
        const saveButton = this.add.graphics();
        saveButton.fillStyle(0x00ff00, 1); // Green fill
        saveButton.fillRoundedRect(buttonMargin, buttonMargin, buttonWidth, buttonHeight, 10); // Rounded rectangle
        saveButton.setScrollFactor(0).setDepth((0, _constants.UIDEPTH));
        // Add Save Text
        const saveText = this.add.text(buttonMargin + buttonWidth / 2, buttonMargin + buttonHeight / 2, 'Save', {
            fontSize: '16px',
            fill: '#000000',
            align: 'center'
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth((0, _constants.UIDEPTH));
        // Make Save Button Interactive
        const saveButtonHitArea = new (0, _phaserDefault.default).Geom.Rectangle(buttonMargin, buttonMargin, buttonWidth, buttonHeight);
        saveButton.setInteractive(saveButtonHitArea, (0, _phaserDefault.default).Geom.Rectangle.Contains);
        saveButton.on('pointerdown', ()=>{
            console.log('Save button clicked');
            // Convert Map.grid to a JSON string and copy it to clipboard
            const gridData = JSON.stringify((0, _mapJs.Map).grid);
            navigator.clipboard.writeText(gridData).then(()=>{
                this.showSaveNotification();
            }).catch((err)=>{
                console.error('Failed to copy grid to clipboard:', err);
            });
        });
        // Load Button
        const loadButton = this.add.graphics();
        loadButton.fillStyle(0x0000ff, 1); // Blue fill
        loadButton.fillRoundedRect(buttonMargin + buttonWidth + buttonMargin, buttonMargin, buttonWidth, buttonHeight, 10); // Rounded rectangle
        loadButton.setScrollFactor(0).setDepth((0, _constants.UIDEPTH));
        // Add Load Text
        const loadText = this.add.text(buttonMargin + buttonWidth * 1.5 + buttonMargin, buttonMargin + buttonHeight / 2, 'Load', {
            fontSize: '16px',
            fill: '#000000',
            align: 'center'
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth((0, _constants.UIDEPTH));
        // Make Load Button Interactive
        const loadButtonHitArea = new (0, _phaserDefault.default).Geom.Rectangle(buttonMargin + buttonWidth + buttonMargin, buttonMargin, buttonWidth, buttonHeight);
        loadButton.setInteractive(loadButtonHitArea, (0, _phaserDefault.default).Geom.Rectangle.Contains);
        // Load Button
        loadButton.on('pointerdown', ()=>{
            console.log('Load button clicked');
            // Create a prompt to paste the grid data
            const gridData = prompt('Paste your grid data here (JSON format):');
            if (gridData) try {
                // Parse the JSON string and update Map.grid
                const newGrid = JSON.parse(gridData);
                // Ensure the new grid is a valid 2D array
                if (Array.isArray(newGrid) && newGrid.every((row)=>Array.isArray(row))) {
                    (0, _mapJs.Map).grid = newGrid; // Update the grid
                    (0, _mapJs.Map).reDraw(); // Redraw the map
                    console.log('Grid successfully loaded and redrawn.');
                } else alert('Invalid grid format. Ensure it is a 2D array.');
            } catch (err) {
                alert(`Error parsing grid data: ${err.message}`);
                console.error('Failed to load grid:', err);
            }
        });
    }
    update() {
        (0, _playerJs.Player).update();
        (0, _turretJs.Turret).update();
        this.handleKeyboardCameraMovement();
    }
    showSaveNotification() {
        const text = this.add.text(this.cameras.main.width / 2, -50, "World data saved \uD83C\uDF0D", {
            fontSize: "32px",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 4,
            fontStyle: "bold"
        }).setOrigin(0.5, 0.5) // Center the text
        .setDepth(1000); // Ensure it's on top
        // Tween: Drop down slightly, then bounce back up
        this.tweens.add({
            targets: text,
            y: 60,
            duration: 600,
            ease: "Bounce.easeOut",
            yoyo: true,
            onComplete: ()=>{
                // Remove the text after a delay
                this.time.delayedCall(1000, ()=>{
                    text.destroy();
                });
            }
        });
    }
}
const config = {
    type: (0, _phaserDefault.default).WEBGL,
    width: screenW,
    height: screenH,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: [
        mapView,
        (0, _itemTabJs.itemTab)
    ]
};
const gameInstance = new (0, _phaserDefault.default).Game(config);

},{"phaser":"9U0wC","../assets/worldMap.png":"kRx32","../assets/black.png":"cg0Cj","../assets/gray.png":"eM8y1","../assets/green.png":"gGGwa","../assets/purple.png":"1BK6P","../assets/hammer.png":"fRDhD","../assets/grass.png":"9C4QU","./map.js":"dx2Y6","./Turret.js":"462Be","navmesh":"6tF63","./constants":"3huJa","./itemTab.js":"5vBbV","./Player.js":"lmXUp","./Projectile.js":"ezU16","../assets/Players/player.png":"31Gol","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"kRx32":[function(require,module,exports,__globalThis) {
module.exports = require("1d90bcb02eb0d15").getBundleURL('gnRNX') + "worldMap.c10533c8.png" + "?" + Date.now();

},{"1d90bcb02eb0d15":"lgJ39"}],"cg0Cj":[function(require,module,exports,__globalThis) {
module.exports = require("add05d44ac8c6a8b").getBundleURL('gnRNX') + "black.42cbf515.png" + "?" + Date.now();

},{"add05d44ac8c6a8b":"lgJ39"}],"eM8y1":[function(require,module,exports,__globalThis) {
module.exports = require("e28db918dbf8150").getBundleURL('gnRNX') + "gray.4e27bb93.png" + "?" + Date.now();

},{"e28db918dbf8150":"lgJ39"}],"gGGwa":[function(require,module,exports,__globalThis) {
module.exports = require("9b74470ee1104f2c").getBundleURL('gnRNX') + "green.73e290ab.png" + "?" + Date.now();

},{"9b74470ee1104f2c":"lgJ39"}],"1BK6P":[function(require,module,exports,__globalThis) {
module.exports = require("ce3444d4569ec74f").getBundleURL('gnRNX') + "purple.92141a65.png" + "?" + Date.now();

},{"ce3444d4569ec74f":"lgJ39"}],"fRDhD":[function(require,module,exports,__globalThis) {
module.exports = require("b1bb3c005d672fd").getBundleURL('gnRNX') + "hammer.7623ecce.png" + "?" + Date.now();

},{"b1bb3c005d672fd":"lgJ39"}],"9C4QU":[function(require,module,exports,__globalThis) {
module.exports = require("7167b78d79599497").getBundleURL('gnRNX') + "grass.9122fc28.png" + "?" + Date.now();

},{"7167b78d79599497":"lgJ39"}],"5vBbV":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "itemTab", ()=>itemTab);
var _phaser = require("phaser");
var _phaserDefault = parcelHelpers.interopDefault(_phaser);
var _constants = require("./constants");
var _sandPng = require("../assets/sand.png");
var _sandPngDefault = parcelHelpers.interopDefault(_sandPng);
var _flowerPng = require("../assets/flower.png");
var _flowerPngDefault = parcelHelpers.interopDefault(_flowerPng);
var _pinePng = require("../assets/pine.png");
var _pinePngDefault = parcelHelpers.interopDefault(_pinePng);
var _rockPng = require("../assets/rock.png");
var _rockPngDefault = parcelHelpers.interopDefault(_rockPng);
var _brickPng = require("../assets/wall/brick.png");
var _brickPngDefault = parcelHelpers.interopDefault(_brickPng);
var _dirtImgPng = require("../assets/Dirt/dirtImg.png");
var _dirtImgPngDefault = parcelHelpers.interopDefault(_dirtImgPng);
var _turretBasePng = require("../assets/turretBase.png");
var _turretBasePngDefault = parcelHelpers.interopDefault(_turretBasePng);
var _turretPng = require("../assets/turret.png");
var _turretPngDefault = parcelHelpers.interopDefault(_turretPng);
var _wallPng = require("../assets/wall/Wall.png");
var _wallPngDefault = parcelHelpers.interopDefault(_wallPng);
var _twallPng = require("../assets/wall/TWall.png");
var _twallPngDefault = parcelHelpers.interopDefault(_twallPng);
var _bwallPng = require("../assets/wall/BWall.png");
var _bwallPngDefault = parcelHelpers.interopDefault(_bwallPng);
var _rwallPng = require("../assets/wall/RWall.png");
var _rwallPngDefault = parcelHelpers.interopDefault(_rwallPng);
var _lwallPng = require("../assets/wall/LWall.png");
var _lwallPngDefault = parcelHelpers.interopDefault(_lwallPng);
var _trcwallPng = require("../assets/wall/TRCWall.png");
var _trcwallPngDefault = parcelHelpers.interopDefault(_trcwallPng);
var _brcwallPng = require("../assets/wall/BRCWall.png");
var _brcwallPngDefault = parcelHelpers.interopDefault(_brcwallPng);
var _tlcwallPng = require("../assets/wall/TLCWall.png");
var _tlcwallPngDefault = parcelHelpers.interopDefault(_tlcwallPng);
var _blcwallPng = require("../assets/wall/BLCWall.png");
var _blcwallPngDefault = parcelHelpers.interopDefault(_blcwallPng);
var _dirtPng = require("../assets/Dirt/Dirt.png");
var _dirtPngDefault = parcelHelpers.interopDefault(_dirtPng);
var _tdirtPng = require("../assets/Dirt/TDirt.png");
var _tdirtPngDefault = parcelHelpers.interopDefault(_tdirtPng);
var _bdirtPng = require("../assets/Dirt/BDirt.png");
var _bdirtPngDefault = parcelHelpers.interopDefault(_bdirtPng);
var _rdirtPng = require("../assets/Dirt/RDirt.png");
var _rdirtPngDefault = parcelHelpers.interopDefault(_rdirtPng);
var _ldirtPng = require("../assets/Dirt/LDirt.png");
var _ldirtPngDefault = parcelHelpers.interopDefault(_ldirtPng);
var _trcdirtPng = require("../assets/Dirt/TRCDirt.png");
var _trcdirtPngDefault = parcelHelpers.interopDefault(_trcdirtPng);
var _brcdirtPng = require("../assets/Dirt/BRCDirt.png");
var _brcdirtPngDefault = parcelHelpers.interopDefault(_brcdirtPng);
var _tlcdirtPng = require("../assets/Dirt/TLCDirt.png");
var _tlcdirtPngDefault = parcelHelpers.interopDefault(_tlcdirtPng);
var _blcdirtPng = require("../assets/Dirt/BLCDirt.png");
var _blcdirtPngDefault = parcelHelpers.interopDefault(_blcdirtPng);
var _waterImgPng = require("../assets/water/waterImg.png");
var _waterImgPngDefault = parcelHelpers.interopDefault(_waterImgPng);
var _waterPng = require("../assets/water/water.png");
var _waterPngDefault = parcelHelpers.interopDefault(_waterPng);
var _twaterPng = require("../assets/water/TWater.png");
var _twaterPngDefault = parcelHelpers.interopDefault(_twaterPng);
var _bwaterPng = require("../assets/water/BWater.png");
var _bwaterPngDefault = parcelHelpers.interopDefault(_bwaterPng);
var _rwaterPng = require("../assets/water/RWater.png");
var _rwaterPngDefault = parcelHelpers.interopDefault(_rwaterPng);
var _lwaterPng = require("../assets/water/LWater.png");
var _lwaterPngDefault = parcelHelpers.interopDefault(_lwaterPng);
var _trcwaterPng = require("../assets/water/TRCWater.png");
var _trcwaterPngDefault = parcelHelpers.interopDefault(_trcwaterPng);
var _brcwaterPng = require("../assets/water/BRCWater.png");
var _brcwaterPngDefault = parcelHelpers.interopDefault(_brcwaterPng);
var _tlcwaterPng = require("../assets/water/TLCWater.png");
var _tlcwaterPngDefault = parcelHelpers.interopDefault(_tlcwaterPng);
var _blcwaterPng = require("../assets/water/BLCWater.png");
var _blcwaterPngDefault = parcelHelpers.interopDefault(_blcwaterPng);
var _playerImgPng = require("../assets/Players/playerImg.png");
var _playerImgPngDefault = parcelHelpers.interopDefault(_playerImgPng);
class itemTab extends (0, _phaserDefault.default).Scene {
    constructor(){
        super('itemTab');
        this.numItems = 9;
    }
    preload() {}
    static preload(scene) {
        scene.load.image('image1', (0, _sandPngDefault.default)); // Make sure the path and filename are correct
        scene.load.image('image2', (0, _rockPngDefault.default));
        scene.load.image('image3', (0, _flowerPngDefault.default));
        scene.load.image('image4', (0, _brickPngDefault.default));
        scene.load.image('image5', (0, _dirtImgPngDefault.default));
        scene.load.image('image6', (0, _pinePngDefault.default));
        scene.load.image('image7', (0, _turretBasePngDefault.default));
        scene.load.image('image7a', (0, _turretPngDefault.default));
        scene.load.image('image8', (0, _waterImgPngDefault.default)); //water image
        scene.load.image('image9', (0, _playerImgPngDefault.default)); //water image
        scene.load.image('wall', (0, _wallPngDefault.default));
        scene.load.image('tWall', (0, _twallPngDefault.default)); // Top wall
        scene.load.image('bWall', (0, _bwallPngDefault.default)); // Bottom wall
        scene.load.image('rWall', (0, _rwallPngDefault.default)); // Right wall
        scene.load.image('lWall', (0, _lwallPngDefault.default)); // Left wall
        scene.load.image('trcWall', (0, _trcwallPngDefault.default)); // Top-right corner wall
        scene.load.image('brcWall', (0, _brcwallPngDefault.default)); // Bottom-right corner wall
        scene.load.image('tlcWall', (0, _tlcwallPngDefault.default)); // Top-left corner wall
        scene.load.image('blcWall', (0, _blcwallPngDefault.default)); // Bottom-left corner wall
        scene.load.image('Dirt', (0, _dirtPngDefault.default));
        scene.load.image('tDirt', (0, _tdirtPngDefault.default)); // Top Dirt
        scene.load.image('bDirt', (0, _bdirtPngDefault.default)); // Bottom Dirt
        scene.load.image('rDirt', (0, _rdirtPngDefault.default)); // Right Dirt
        scene.load.image('lDirt', (0, _ldirtPngDefault.default)); // Left Dirt
        scene.load.image('trcDirt', (0, _trcdirtPngDefault.default)); // Top-right corner Dirt
        scene.load.image('brcDirt', (0, _brcdirtPngDefault.default)); // Bottom-right corner Dirt
        scene.load.image('tlcDirt', (0, _tlcdirtPngDefault.default)); // Top-left corner Dirt
        scene.load.image('blcDirt', (0, _blcdirtPngDefault.default)); // Bottom-left corner Dirt
        scene.load.spritesheet('water', (0, _waterPngDefault.default), {
            frameWidth: 16,
            frameHeight: 16
        });
        scene.load.spritesheet('twater', (0, _twaterPngDefault.default), {
            frameWidth: 16,
            frameHeight: 16
        }); // Top Water
        scene.load.spritesheet('bwater', (0, _bwaterPngDefault.default), {
            frameWidth: 16,
            frameHeight: 16
        }); // Bottom Water
        scene.load.spritesheet('rwater', (0, _rwaterPngDefault.default), {
            frameWidth: 16,
            frameHeight: 16
        }); // Right Water
        scene.load.spritesheet('lwater', (0, _lwaterPngDefault.default), {
            frameWidth: 16,
            frameHeight: 16
        }); // Left Water
        scene.load.spritesheet('trcwater', (0, _trcwaterPngDefault.default), {
            frameWidth: 16,
            frameHeight: 16
        }); // Top-right corner Water
        scene.load.spritesheet('brcwater', (0, _brcwaterPngDefault.default), {
            frameWidth: 16,
            frameHeight: 16
        }); // Bottom-right corner Water
        scene.load.spritesheet('tlcwater', (0, _tlcwaterPngDefault.default), {
            frameWidth: 16,
            frameHeight: 16
        }); // Top-left corner Water
        scene.load.spritesheet('blcwater', (0, _blcwaterPngDefault.default), {
            frameWidth: 16,
            frameHeight: 16
        }); // Bottom-left corner Water
    }
    create() {
        this.createAnim('water');
        this.createAnim('twater');
        this.createAnim('bwater');
        this.createAnim('rwater');
        this.createAnim('lwater');
        this.createAnim('trcwater');
        this.createAnim('brcwater');
        this.createAnim('tlcwater');
        this.createAnim('blcwater');
        // Create a container for the dialog box
        const dialogContainer = this.add.container(0, 0);
        const dialogWidth = 800;
        const dialogHeight = 800;
        // Add a background for the dialog
        const dialogBackground = this.add.rectangle(0, 0, dialogWidth, dialogHeight, 0x222222).setOrigin(0).setInteractive(); // Make the background interactive for scrolling
        dialogContainer.add(dialogBackground);
        // Create a content container to hold the images
        const contentContainer = this.add.container(0, 0);
        // Add images to the content container
        const imageSpacing = 100; // Spacing between images
        for(let i = 0; i < 10; i++){
            let y = i * imageSpacing + 80;
            let x = 80;
            if (y > 700) {
                y %= 700;
                x += 150;
            }
            const image = this.add.image(x, y, `image${i % this.numItems + 1}`).setInteractive().setName(`image${i % this.numItems + 1}`);
            // Add selection behavior
            image.on('pointerdown', ()=>{
                this.input.stopPropagation();
                this.registry.set('image', image.name);
                this.scene.switch('mapView');
            });
            // Add to content container
            contentContainer.add(image);
        }
        // Add the content container to the dialog
        dialogContainer.add(contentContainer);
        // Mask the content
        const maskShape = this.add.graphics().fillRect(0, 0, dialogWidth, dialogHeight);
        const mask = maskShape.createGeometryMask();
        contentContainer.setMask(mask);
        // Enable scrolling
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY)=>{
            const newY = (0, _phaserDefault.default).Math.Clamp(contentContainer.y - deltaY, -(contentContainer.height - dialogHeight), 0);
            contentContainer.setY(newY);
        });
        this.sceneButtons();
    }
    sceneButtons() {
        // Add a button or event to switch back to SceneA
        const main = this.add.text(10, this.cameras.main.height - 40, 'Main', {
            fontSize: '24px',
            fill: '#00ff00'
        }).setInteractive().on('pointerdown', ()=>{
            this.scene.selectMode = true;
            this.input.stopPropagation();
            this.scene.switch('mapView');
        });
        main.depth = (0, _constants.UIDEPTH);
    }
    createAnim(key) {
        this.anims.create({
            key: key,
            frames: this.anims.generateFrameNumbers(key, {
                start: 0,
                end: 2
            }),
            frameRate: 2,
            repeat: -1
        });
    }
    static itemValues(value) {
        switch(value){
            case 'image1':
                return (0, _constants.TILE_TYPES).sand;
            case 'image2':
                return {
                    grid: 2,
                    lenX: 3,
                    lenY: 3,
                    block: false,
                    depth: (0, _constants.FLOORDEPTH),
                    value: 'image2',
                    spread: false
                };
            case 'image3':
                return (0, _constants.TILE_TYPES).grass;
            case 'image4':
                return (0, _constants.TILE_TYPES).stone;
            case 'image5':
                return (0, _constants.TILE_TYPES).dirt;
            case 'image6':
                return (0, _constants.TILE_TYPES).pine;
            case 'image7':
                return (0, _constants.TILE_TYPES).turret;
            case 'image8':
                return (0, _constants.TILE_TYPES).water;
            case 'image9':
                return (0, _constants.TILE_TYPES).player;
            default:
                break;
        }
    }
}

},{"phaser":"9U0wC","./constants":"3huJa","../assets/sand.png":"iSD1q","../assets/flower.png":"e9z1g","../assets/pine.png":"3qsOW","../assets/rock.png":"gwiwS","../assets/wall/brick.png":"ishfD","../assets/Dirt/dirtImg.png":"6LBkA","../assets/turretBase.png":"6Firb","../assets/turret.png":"5t7JE","../assets/wall/Wall.png":"eJaL6","../assets/wall/TWall.png":"9BkUy","../assets/wall/BWall.png":"8V8mP","../assets/wall/RWall.png":"inSzB","../assets/wall/LWall.png":"iOWHM","../assets/wall/TRCWall.png":"hQ5ac","../assets/wall/BRCWall.png":"kihZc","../assets/wall/TLCWall.png":"fXOeD","../assets/wall/BLCWall.png":"9rB5f","../assets/Dirt/Dirt.png":"7ECKi","../assets/Dirt/TDirt.png":"fdLDd","../assets/Dirt/BDirt.png":"7QdIS","../assets/Dirt/RDirt.png":"kTZ2p","../assets/Dirt/LDirt.png":"azmbf","../assets/Dirt/TRCDirt.png":"14Tid","../assets/Dirt/BRCDirt.png":"lMPQM","../assets/Dirt/TLCDirt.png":"kIb41","../assets/Dirt/BLCDirt.png":"9pJi7","../assets/water/waterImg.png":"evniQ","../assets/water/water.png":"lnJKd","../assets/water/TWater.png":"cwoAu","../assets/water/BWater.png":"8pdOw","../assets/water/RWater.png":"kU53G","../assets/water/LWater.png":"lRrXh","../assets/water/TRCWater.png":"lyxh7","../assets/water/BRCWater.png":"aMqEU","../assets/water/TLCWater.png":"GDf6t","../assets/water/BLCWater.png":"4wOV7","../assets/Players/playerImg.png":"rBCtd","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"iSD1q":[function(require,module,exports,__globalThis) {
module.exports = require("2ee9f5635a5f947a").getBundleURL('gnRNX') + "sand.a5ab8848.png" + "?" + Date.now();

},{"2ee9f5635a5f947a":"lgJ39"}],"e9z1g":[function(require,module,exports,__globalThis) {
module.exports = require("ee9f975f1a0e25b9").getBundleURL('gnRNX') + "flower.641f1c48.png" + "?" + Date.now();

},{"ee9f975f1a0e25b9":"lgJ39"}],"3qsOW":[function(require,module,exports,__globalThis) {
module.exports = require("60cee8d3ddbc884c").getBundleURL('gnRNX') + "pine.0072b100.png" + "?" + Date.now();

},{"60cee8d3ddbc884c":"lgJ39"}],"gwiwS":[function(require,module,exports,__globalThis) {
module.exports = require("9da9540e141ad92a").getBundleURL('gnRNX') + "rock.24ae3a8c.png" + "?" + Date.now();

},{"9da9540e141ad92a":"lgJ39"}],"ishfD":[function(require,module,exports,__globalThis) {
module.exports = require("db2e8b3d20462a1f").getBundleURL('gnRNX') + "brick.3d2baa78.png" + "?" + Date.now();

},{"db2e8b3d20462a1f":"lgJ39"}],"6LBkA":[function(require,module,exports,__globalThis) {
module.exports = require("8e78501eeeb288d1").getBundleURL('gnRNX') + "dirtImg.4aa52516.png" + "?" + Date.now();

},{"8e78501eeeb288d1":"lgJ39"}],"6Firb":[function(require,module,exports,__globalThis) {
module.exports = require("1ea4b928a98ec4d").getBundleURL('gnRNX') + "turretBase.02ae028f.png" + "?" + Date.now();

},{"1ea4b928a98ec4d":"lgJ39"}],"5t7JE":[function(require,module,exports,__globalThis) {
module.exports = require("e57597930fb4f435").getBundleURL('gnRNX') + "turret.bf1bd5eb.png" + "?" + Date.now();

},{"e57597930fb4f435":"lgJ39"}],"eJaL6":[function(require,module,exports,__globalThis) {
module.exports = require("40d5287bd5d8b67c").getBundleURL('gnRNX') + "Wall.b49d660d.png" + "?" + Date.now();

},{"40d5287bd5d8b67c":"lgJ39"}],"9BkUy":[function(require,module,exports,__globalThis) {
module.exports = require("c144dc0cf1ad5d44").getBundleURL('gnRNX') + "TWall.ecd7291a.png" + "?" + Date.now();

},{"c144dc0cf1ad5d44":"lgJ39"}],"8V8mP":[function(require,module,exports,__globalThis) {
module.exports = require("4c5436f1e35362ea").getBundleURL('gnRNX') + "BWall.53b07a4c.png" + "?" + Date.now();

},{"4c5436f1e35362ea":"lgJ39"}],"inSzB":[function(require,module,exports,__globalThis) {
module.exports = require("f5f030e1c8726bf3").getBundleURL('gnRNX') + "RWall.99911b28.png" + "?" + Date.now();

},{"f5f030e1c8726bf3":"lgJ39"}],"iOWHM":[function(require,module,exports,__globalThis) {
module.exports = require("a6f46fb8cc9fb0df").getBundleURL('gnRNX') + "LWall.02fb8454.png" + "?" + Date.now();

},{"a6f46fb8cc9fb0df":"lgJ39"}],"hQ5ac":[function(require,module,exports,__globalThis) {
module.exports = require("b590684b4d506097").getBundleURL('gnRNX') + "TRCWall.e7bdbff4.png" + "?" + Date.now();

},{"b590684b4d506097":"lgJ39"}],"kihZc":[function(require,module,exports,__globalThis) {
module.exports = require("864a45dba536bdd0").getBundleURL('gnRNX') + "BRCWall.d0355cca.png" + "?" + Date.now();

},{"864a45dba536bdd0":"lgJ39"}],"fXOeD":[function(require,module,exports,__globalThis) {
module.exports = require("ccb102f1a85512c1").getBundleURL('gnRNX') + "TLCWall.49f7d0b2.png" + "?" + Date.now();

},{"ccb102f1a85512c1":"lgJ39"}],"9rB5f":[function(require,module,exports,__globalThis) {
module.exports = require("1675a8f114c4d30f").getBundleURL('gnRNX') + "BLCWall.3526c11c.png" + "?" + Date.now();

},{"1675a8f114c4d30f":"lgJ39"}],"7ECKi":[function(require,module,exports,__globalThis) {
module.exports = require("ac7dcb16f5c5a04b").getBundleURL('gnRNX') + "Dirt.d85109c8.png" + "?" + Date.now();

},{"ac7dcb16f5c5a04b":"lgJ39"}],"fdLDd":[function(require,module,exports,__globalThis) {
module.exports = require("8d4738ed99d6fffa").getBundleURL('gnRNX') + "TDirt.5c2280bc.png" + "?" + Date.now();

},{"8d4738ed99d6fffa":"lgJ39"}],"7QdIS":[function(require,module,exports,__globalThis) {
module.exports = require("94e4094d72d5a9c").getBundleURL('gnRNX') + "BDirt.390e98f9.png" + "?" + Date.now();

},{"94e4094d72d5a9c":"lgJ39"}],"kTZ2p":[function(require,module,exports,__globalThis) {
module.exports = require("24d24eac1215bc25").getBundleURL('gnRNX') + "RDirt.3f9f53fa.png" + "?" + Date.now();

},{"24d24eac1215bc25":"lgJ39"}],"azmbf":[function(require,module,exports,__globalThis) {
module.exports = require("91be917aa87e09c9").getBundleURL('gnRNX') + "LDirt.7cf1fc99.png" + "?" + Date.now();

},{"91be917aa87e09c9":"lgJ39"}],"14Tid":[function(require,module,exports,__globalThis) {
module.exports = require("bc006411f951ca07").getBundleURL('gnRNX') + "TRCDirt.5a6b8ba2.png" + "?" + Date.now();

},{"bc006411f951ca07":"lgJ39"}],"lMPQM":[function(require,module,exports,__globalThis) {
module.exports = require("671cc5e12e1bdd22").getBundleURL('gnRNX') + "BRCDirt.fa28492f.png" + "?" + Date.now();

},{"671cc5e12e1bdd22":"lgJ39"}],"kIb41":[function(require,module,exports,__globalThis) {
module.exports = require("2ca57ba559b3aad6").getBundleURL('gnRNX') + "TLCDirt.eff450b2.png" + "?" + Date.now();

},{"2ca57ba559b3aad6":"lgJ39"}],"9pJi7":[function(require,module,exports,__globalThis) {
module.exports = require("7526add23a9235ad").getBundleURL('gnRNX') + "BLCDirt.b4f97185.png" + "?" + Date.now();

},{"7526add23a9235ad":"lgJ39"}],"evniQ":[function(require,module,exports,__globalThis) {
module.exports = require("70375abba9d3ac6c").getBundleURL('gnRNX') + "waterImg.f90bf3a7.png" + "?" + Date.now();

},{"70375abba9d3ac6c":"lgJ39"}],"lnJKd":[function(require,module,exports,__globalThis) {
module.exports = require("2e75f2b1fb841214").getBundleURL('gnRNX') + "water.75e5ff26.png" + "?" + Date.now();

},{"2e75f2b1fb841214":"lgJ39"}],"cwoAu":[function(require,module,exports,__globalThis) {
module.exports = require("4f0de19b29a5e212").getBundleURL('gnRNX') + "TWater.cb3bb2c9.png" + "?" + Date.now();

},{"4f0de19b29a5e212":"lgJ39"}],"8pdOw":[function(require,module,exports,__globalThis) {
module.exports = require("2e09ff91a089a224").getBundleURL('gnRNX') + "BWater.edfca25a.png" + "?" + Date.now();

},{"2e09ff91a089a224":"lgJ39"}],"kU53G":[function(require,module,exports,__globalThis) {
module.exports = require("91d23e1526f69a7d").getBundleURL('gnRNX') + "RWater.a44b9ad2.png" + "?" + Date.now();

},{"91d23e1526f69a7d":"lgJ39"}],"lRrXh":[function(require,module,exports,__globalThis) {
module.exports = require("489e312c989f138a").getBundleURL('gnRNX') + "LWater.77531a77.png" + "?" + Date.now();

},{"489e312c989f138a":"lgJ39"}],"lyxh7":[function(require,module,exports,__globalThis) {
module.exports = require("b6a33cabaf290ec6").getBundleURL('gnRNX') + "TRCWater.f9f91f61.png" + "?" + Date.now();

},{"b6a33cabaf290ec6":"lgJ39"}],"aMqEU":[function(require,module,exports,__globalThis) {
module.exports = require("38be1ad954499cbf").getBundleURL('gnRNX') + "BRCWater.af8cc45a.png" + "?" + Date.now();

},{"38be1ad954499cbf":"lgJ39"}],"GDf6t":[function(require,module,exports,__globalThis) {
module.exports = require("d77725b76a3b724").getBundleURL('gnRNX') + "TLCWater.6e0eaecd.png" + "?" + Date.now();

},{"d77725b76a3b724":"lgJ39"}],"4wOV7":[function(require,module,exports,__globalThis) {
module.exports = require("2d7b64c32069714b").getBundleURL('gnRNX') + "BLCWater.c9bfab41.png" + "?" + Date.now();

},{"2d7b64c32069714b":"lgJ39"}],"rBCtd":[function(require,module,exports,__globalThis) {
module.exports = require("3ae73beae0f46c1c").getBundleURL('gnRNX') + "playerImg.fa0ba507.png" + "?" + Date.now();

},{"3ae73beae0f46c1c":"lgJ39"}],"31Gol":[function(require,module,exports,__globalThis) {
module.exports = require("bdf9f8aa9ae28e56").getBundleURL('gnRNX') + "player.96bd2956.png" + "?" + Date.now();

},{"bdf9f8aa9ae28e56":"lgJ39"}]},["1Fqy1","gLLPy"], "gLLPy", "parcelRequire94c2")

//# sourceMappingURL=index.4d6bcbeb.js.map
