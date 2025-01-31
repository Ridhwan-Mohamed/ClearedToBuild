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
        this.brushTiles = []; // Array to store affected tiles
        this.isBrushMode = false; // Track if brush mode is active  
        this.isBrushActive = false;
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
        this.brushGraphics = this.add.graphics(); // Graphics for tinting tiles
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
            } else if (this.isBrushMode && pointer.button == 2) {
                this.isBrushActive = true;
                this.brushTiles = [];
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
        // Clamp camera position to avoid accessing invalid indices
        (0, _phaserDefault.default).Math.Clamp(camera.scrollX, -32, (0, _constants.WORLD_DIMENSION) * (0, _constants.SQUARESIZE) - width);
        (0, _phaserDefault.default).Math.Clamp(camera.scrollY, -32, (0, _constants.WORLD_DIMENSION) * (0, _constants.SQUARESIZE) - height);
        // Calculate the center chunk coordinates of the camera
        const centerChunkX = Math.floor(camera.scrollX / (0, _constants.SQUARESIZE));
        const centerChunkY = Math.floor(camera.scrollY / (0, _constants.SQUARESIZE));
        // Initialize old center if not already set
        if (!this.oldMapCenter) this.oldMapCenter = [
            centerChunkX,
            centerChunkY
        ];
        // Check if the camera has deviated from the old center by a chunk size
        const deviationX = Math.abs(centerChunkX - this.oldMapCenter[0]);
        const deviationY = Math.abs(centerChunkY - this.oldMapCenter[1]);
        if (deviationX > (0, _constants.EDGE_RATIO) || deviationY > (0, _constants.EDGE_RATIO)) {
            this.oldMapCenter = [
                centerChunkX,
                centerChunkY
            ]; // Update old center
            (0, _mapJs.Map).reDraw(); // Trigger a redraw
        }
    }
    onPointerMove(pointer) {
        if (this.isBrushMode && this.isBrushActive) {
            const gridX = Math.floor(pointer.worldX / (0, _constants.SQUARESIZE));
            const gridY = Math.floor(pointer.worldY / (0, _constants.SQUARESIZE));
            const alreadyExists = this.brushTiles.some((tile)=>tile.x === gridX && tile.y === gridY);
            if (!alreadyExists) {
                this.brushTiles.push({
                    x: gridX,
                    y: gridY
                });
                this.brushGraphics.fillStyle(0x00ff00, 0.5);
                this.brushGraphics.fillRect(gridX * (0, _constants.SQUARESIZE), gridY * (0, _constants.SQUARESIZE), (0, _constants.SQUARESIZE), (0, _constants.SQUARESIZE)).setDepth((0, _constants.UIDEPTH));
            }
        } else if (this.startCell) {
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
        if (this.isBrushMode && this.isBrushActive) {
            this.isBrushActive = false;
            if (this.brushTiles.length > 0) {
                // Process the tiles
                this.brushTiles.forEach((tile)=>{
                    let item = (0, _itemTabJs.itemTab).itemValues(this.registry.get('image'));
                    (0, _mapJs.Map).addSpreadArr(tile.x, tile.y, item, item.depth) // Customize as needed
                    ;
                });
                this.brushGraphics.clear();
            }
        } else if (!this.gridPlace) (0, _playerJs.Player).handlePlayerSelect();
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
        // Add a button on the bottom bar
        const brushToggleButton = this.add.text(230, window.innerHeight - 40, 'Brush Mode: OFF', {
            fontSize: '24px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setInteractive().on('pointerdown', ()=>{
            if (this.isBrushMode) {
                this.isBrushMode = false;
                this.gridPlace = true;
            } else {
                this.isBrushMode = true;
                this.gridPlace = false;
            }
            brushToggleButton.setText(`Brush Mode: ${this.isBrushMode ? 'ON' : 'OFF'}`);
        });
        // Ensure the button sticks to the bottom bar
        brushToggleButton.setScrollFactor(0);
        brushToggleButton.setDepth((0, _constants.UIDEPTH));
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
                let newGrid = JSON.parse(gridData);
                const copyGrid = structuredClone(newGrid);
                // Ensure the new grid is a valid 2D array
                if (Array.isArray(newGrid) && newGrid.every((row)=>Array.isArray(row))) {
                    (0, _mapJs.Map).grid = newGrid; // Update the grid
                    (0, _mapJs.Map).reDraw(); // Redraw the map
                    (0, _mapJs.Map).grid = copyGrid;
                    newGrid = null;
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
            debug: true
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

},{"7167b78d79599497":"lgJ39"}],"31Gol":[function(require,module,exports,__globalThis) {
module.exports = require("bdf9f8aa9ae28e56").getBundleURL('gnRNX') + "player.96bd2956.png" + "?" + Date.now();

},{"bdf9f8aa9ae28e56":"lgJ39"}]},["1Fqy1","gLLPy"], "gLLPy", "parcelRequire94c2")

//# sourceMappingURL=index.4d6bcbeb.js.map
