// This code implements the `-sMODULARIZE` settings by taking the generated
// JS program code (INNER_JS_CODE) and wrapping it in a factory function.

// When targeting node and ES6 we use `await import ..` in the generated code
// so the outer function needs to be marked as async.
async function Module(moduleArg = {}) {
  var moduleRtn;

// include: shell.js
// include: minimum_runtime_check.js
(function() {
  // "30.0.0" -> 300000
  function humanReadableVersionToPacked(str) {
    str = str.split('-')[0]; // Remove any trailing part from e.g. "12.53.3-alpha"
    var vers = str.split('.').slice(0, 3);
    while(vers.length < 3) vers.push('00');
    vers = vers.map((n, i, arr) => n.padStart(2, '0'));
    return vers.join('');
  }
  // 300000 -> "30.0.0"
  var packedVersionToHumanReadable = n => [n / 10000 | 0, (n / 100 | 0) % 100, n % 100].join('.');

  var TARGET_NOT_SUPPORTED = 2147483647;

  // Note: We use a typeof check here instead of optional chaining using
  // globalThis because older browsers might not have globalThis defined.
  var currentNodeVersion = typeof process !== 'undefined' && process.versions?.node ? humanReadableVersionToPacked(process.versions.node) : TARGET_NOT_SUPPORTED;
  if (currentNodeVersion < TARGET_NOT_SUPPORTED) {
    throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');
  }
  if (currentNodeVersion < 2147483647) {
    throw new Error(`This emscripten-generated code requires node v${ packedVersionToHumanReadable(2147483647) } (detected v${packedVersionToHumanReadable(currentNodeVersion)})`);
  }

  var userAgent = typeof navigator !== 'undefined' && navigator.userAgent;
  if (!userAgent) {
    return;
  }

  var currentSafariVersion = userAgent.includes("Safari/") && !userAgent.includes("Chrome/") && userAgent.match(/Version\/(\d+\.?\d*\.?\d*)/) ? humanReadableVersionToPacked(userAgent.match(/Version\/(\d+\.?\d*\.?\d*)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentSafariVersion < TARGET_NOT_SUPPORTED) {
    throw new Error(`This page was compiled without support for Safari browser. Pass -sMIN_SAFARI_VERSION=${currentSafariVersion} or lower to enable support for this browser.`);
  }
  if (currentSafariVersion < 2147483647) {
    throw new Error(`This emscripten-generated code requires Safari v${ packedVersionToHumanReadable(2147483647) } (detected v${currentSafariVersion})`);
  }

  var currentFirefoxVersion = userAgent.match(/Firefox\/(\d+(?:\.\d+)?)/) ? parseFloat(userAgent.match(/Firefox\/(\d+(?:\.\d+)?)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentFirefoxVersion < 129) {
    throw new Error(`This emscripten-generated code requires Firefox v129 (detected v${currentFirefoxVersion})`);
  }

  var currentChromeVersion = userAgent.match(/Chrome\/(\d+(?:\.\d+)?)/) ? parseFloat(userAgent.match(/Chrome\/(\d+(?:\.\d+)?)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentChromeVersion < 128) {
    throw new Error(`This emscripten-generated code requires Chrome v128 (detected v${currentChromeVersion})`);
  }
})();

// end include: minimum_runtime_check.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(moduleArg) => Promise<Module>
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = moduleArg;

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = !!globalThis.window;
var ENVIRONMENT_IS_WORKER = !!globalThis.WorkerGlobalScope;
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = globalThis.process?.versions?.node && globalThis.process?.type != 'renderer';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)


var arguments_ = [];
var thisProgram = './this.program';
var quit_ = (status, toThrow) => {
  throw toThrow;
};

var _scriptName = import.meta.url;

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var readAsync, readBinary;

if (ENVIRONMENT_IS_SHELL) {

} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  try {
    scriptDirectory = new URL('.', _scriptName).href; // includes trailing slash
  } catch {
    // Must be a `blob:` or `data:` URL (e.g. `blob:http://site.com/etc/etc`), we cannot
    // infer anything from them.
  }

  if (!(globalThis.window || globalThis.WorkerGlobalScope)) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  {
// include: web_or_worker_shell_read.js
readAsync = async (url) => {
    assert(!isFileURI(url), "readAsync does not work with file:// URLs");
    var response = await fetch(url, { credentials: 'same-origin' });
    if (response.ok) {
      return response.arrayBuffer();
    }
    throw new Error(response.status + ' : ' + response.url);
  };
// end include: web_or_worker_shell_read.js
  }
} else
{
  throw new Error('environment detection error');
}

var out = console.log.bind(console);
var err = console.error.bind(console);

var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var FETCHFS = 'FETCHFS is no longer included by default; build with -lfetchfs.js';
var ICASEFS = 'ICASEFS is no longer included by default; build with -licasefs.js';
var JSFILEFS = 'JSFILEFS is no longer included by default; build with -ljsfilefs.js';
var OPFS = 'OPFS is no longer included by default; build with -lopfs.js';

var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';

// perform assertions in shell.js after we set up out() and err(), as otherwise
// if an assertion fails it cannot print the message

assert(!ENVIRONMENT_IS_WORKER, 'worker environment detected but not enabled at build time.  Add `worker` to `-sENVIRONMENT` to enable.');

assert(!ENVIRONMENT_IS_NODE, 'node environment detected but not enabled at build time.  Add `node` to `-sENVIRONMENT` to enable.');

assert(!ENVIRONMENT_IS_SHELL, 'shell environment detected but not enabled at build time.  Add `shell` to `-sENVIRONMENT` to enable.');

// end include: shell.js

// include: preamble.js
// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

var wasmBinary;

if (!globalThis.WebAssembly) {
  err('no native wasm support detected');
}

// Wasm globals

//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

// In STRICT mode, we only define assert() when ASSERTIONS is set.  i.e. we
// don't define it at all in release modes.  This matches the behaviour of
// MINIMAL_RUNTIME.
// TODO(sbc): Make this the default even without STRICT enabled.
/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed' + (text ? ': ' + text : ''));
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */
var isFileURI = (filename) => filename.startsWith('file://');

// include: runtime_common.js
// include: runtime_stack_check.js
// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // If the stack ends at address zero we write our cookies 4 bytes into the
  // stack.  This prevents interference with SAFE_HEAP and ASAN which also
  // monitor writes to address zero.
  if (max == 0) {
    max += 4;
  }
  // The stack grow downwards towards _emscripten_stack_get_end.
  // We write cookies to the final two words in the stack and detect if they are
  // ever overwritten.
  HEAPU32[((max)/4)] = 0x02135467;
  HEAPU32[(((max)+(4))/4)] = 0x89BACDFE;
  // Also test the global address 0 for integrity.
  HEAPU32[((0)/4)] = 1668509029;
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  // See writeStackCookie().
  if (max == 0) {
    max += 4;
  }
  var cookie1 = HEAPU32[((max)/4)];
  var cookie2 = HEAPU32[(((max)+(4))/4)];
  if (cookie1 != 0x02135467 || cookie2 != 0x89BACDFE) {
    abort(`Stack overflow! Stack cookie has been overwritten at ${ptrToString(max)}, expected hex dwords 0x89BACDFE and 0x2135467, but received ${ptrToString(cookie2)} ${ptrToString(cookie1)}`);
  }
  // Also test the global address 0 for integrity.
  if (HEAPU32[((0)/4)] != 0x63736d65 /* 'emsc' */) {
    abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
  }
}
// end include: runtime_stack_check.js
// include: runtime_exceptions.js
// Base Emscripten EH error class
class EmscriptenEH {}

class EmscriptenSjLj extends EmscriptenEH {}

// end include: runtime_exceptions.js
// include: runtime_debug.js
var runtimeDebug = true; // Switch to false at runtime to disable logging at the right times

// Used by XXXXX_DEBUG settings to output debug messages.
function dbg(...args) {
  if (!runtimeDebug && typeof runtimeDebug != 'undefined') return;
  // TODO(sbc): Make this configurable somehow.  Its not always convenient for
  // logging to show up as warnings.
  console.warn(...args);
}

// Endianness check
(() => {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) abort('Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)');
})();

function consumedModuleProp(prop) {
  if (!Object.getOwnPropertyDescriptor(Module, prop)) {
    Object.defineProperty(Module, prop, {
      configurable: true,
      set() {
        abort(`Attempt to set \`Module.${prop}\` after it has already been processed.  This can happen, for example, when code is injected via '--post-js' rather than '--pre-js'`);

      }
    });
  }
}

function makeInvalidEarlyAccess(name) {
  return () => assert(false, `call to '${name}' via reference taken before Wasm module initialization`);

}

function ignoredModuleProp(prop) {
  if (Object.getOwnPropertyDescriptor(Module, prop)) {
    abort(`\`Module.${prop}\` was supplied but \`${prop}\` not included in INCOMING_MODULE_JS_API`);
  }
}

// forcing the filesystem exports a few things by default
function isExportedByForceFilesystem(name) {
  return name === 'FS_createPath' ||
         name === 'FS_createDataFile' ||
         name === 'FS_createPreloadedFile' ||
         name === 'FS_preloadFile' ||
         name === 'FS_unlink' ||
         name === 'addRunDependency' ||
         // The old FS has some functionality that WasmFS lacks.
         name === 'FS_createLazyFile' ||
         name === 'FS_createDevice' ||
         name === 'removeRunDependency';
}

function missingLibrarySymbol(sym) {

  // Any symbol that is not included from the JS library is also (by definition)
  // not exported on the Module object.
  unexportedRuntimeSymbol(sym);
}

function unexportedRuntimeSymbol(sym) {
  if (!Object.getOwnPropertyDescriptor(Module, sym)) {
    Object.defineProperty(Module, sym, {
      configurable: true,
      get() {
        var msg = `'${sym}' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)`;
        if (isExportedByForceFilesystem(sym)) {
          msg += '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
        }
        abort(msg);
      },
    });
  }
}

// end include: runtime_debug.js
var readyPromiseResolve, readyPromiseReject;

// Memory management

var runtimeInitialized = false;



function updateMemoryViews() {
  var b = wasmMemory.buffer;
  HEAP8 = new Int8Array(b);
  HEAP16 = new Int16Array(b);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(b);
  HEAPU16 = new Uint16Array(b);
  HEAP32 = new Int32Array(b);
  HEAPU32 = new Uint32Array(b);
  HEAPF32 = new Float32Array(b);
  HEAPF64 = new Float64Array(b);
  HEAP64 = new BigInt64Array(b);
  HEAPU64 = new BigUint64Array(b);
}

// include: memoryprofiler.js
// end include: memoryprofiler.js
// end include: runtime_common.js
assert(globalThis.Int32Array && globalThis.Float64Array && Int32Array.prototype.subarray && Int32Array.prototype.set,
       'JS engine does not provide full typed array support');

function preRun() {
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  consumedModuleProp('preRun');
  // Begin ATPRERUNS hooks
  callRuntimeCallbacks(onPreRuns);
  // End ATPRERUNS hooks
}

function initRuntime() {
  assert(!runtimeInitialized);
  runtimeInitialized = true;

  checkStackCookie();

  // No ATINITS hooks

  wasmExports['__wasm_call_ctors']();

  // No ATPOSTCTORS hooks
}

function postRun() {
  checkStackCookie();
   // PThreads reuse the runtime from the main thread.

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  consumedModuleProp('postRun');

  // Begin ATPOSTRUNS hooks
  callRuntimeCallbacks(onPostRuns);
  // End ATPOSTRUNS hooks
}

/**
 * @param {string|number=} what
 */
function abort(what) {
  Module['onAbort']?.(what);

  what = `Aborted(${what})`;
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);

  ABORT = true;

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.

  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // definition for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  /** @suppress {checkTypes} */
  var e = new WebAssembly.RuntimeError(what);

  readyPromiseReject?.(e);
  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// show errors on likely calls to FS when it was not included
function fsMissing() {
  abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with -sFORCE_FILESYSTEM');
}
var FS = {
  init: fsMissing,
  createDataFile: fsMissing,
  createPreloadedFile: fsMissing,
  createLazyFile: fsMissing,
  open: fsMissing,
  mkdev: fsMissing,
  registerDevice:  fsMissing,
  analyzePath: fsMissing,
  ErrnoError: fsMissing,
};


function createExportWrapper(name, nargs) {
  return (...args) => {
    assert(runtimeInitialized, `native function \`${name}\` called before runtime initialization`);
    var f = wasmExports[name];
    assert(f, `exported native function \`${name}\` not found`);
    // Only assert for too many arguments. Too few can be valid since the missing arguments will be zero filled.
    assert(args.length <= nargs, `native function \`${name}\` called with ${args.length} args but expects ${nargs}`);
    return f(...args);
  };
}

var wasmBinaryFile;

function findWasmBinary() {

  if (Module['locateFile']) {
    return locateFile('native-study-runtime.wasm');
  }

  // Use bundler-friendly `new URL(..., import.meta.url)` pattern; works in browsers too.
  return new URL('native-study-runtime.wasm', import.meta.url).href;

}

function getBinarySync(file) {
  if (file == wasmBinaryFile && wasmBinary) {
    return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
    return readBinary(file);
  }
  // Throwing a plain string here, even though it not normally advisable since
  // this gets turning into an `abort` in instantiateArrayBuffer.
  throw 'both async and sync fetching of the wasm failed';
}

async function getWasmBinary(binaryFile) {
  // If we don't have the binary yet, load it asynchronously using readAsync.
  if (!wasmBinary) {
    // Fetch the binary using readAsync
    try {
      var response = await readAsync(binaryFile);
      return new Uint8Array(response);
    } catch {
      // Fall back to getBinarySync below;
    }
  }

  // Otherwise, getBinarySync should be able to get it synchronously
  return getBinarySync(binaryFile);
}

async function instantiateArrayBuffer(binaryFile, imports) {
  try {
    var binary = await getWasmBinary(binaryFile);
    var instance = await WebAssembly.instantiate(binary, imports);
    return instance;
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`);

    // Warn on some common problems.
    if (isFileURI(binaryFile)) {
      err(`warning: Loading from a file URI (${binaryFile}) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`);
    }
    abort(reason);
  }
}

async function instantiateAsync(binary, binaryFile, imports) {
  if (!binary
     ) {
    try {
      var response = fetch(binaryFile, { credentials: 'same-origin' });
      var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
      return instantiationResult;
    } catch (reason) {
      // We expect the most common failure cause to be a bad MIME type for the binary,
      // in which case falling back to ArrayBuffer instantiation should work.
      err(`wasm streaming compile failed: ${reason}`);
      err('falling back to ArrayBuffer instantiation');
      // fall back of instantiateArrayBuffer below
    };
  }
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  // prepare imports
  var imports = {
    'env': wasmImports,
    'wasi_snapshot_preview1': wasmImports,
  };
  return imports;
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    wasmExports = instance.exports;

    wasmExports = applySignatureConversions(wasmExports);

    assignWasmExports(wasmExports);

    updateMemoryViews();

    return wasmExports;
  }

  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above PTHREADS-enabled path.
    return receiveInstance(result['instance']);
  }

  var info = getWasmImports();

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module['instantiateWasm']) {
    return new Promise((resolve, reject) => {
      try {
        Module['instantiateWasm'](info, (inst, mod) => {
          resolve(receiveInstance(inst, mod));
        });
      } catch(e) {
        err(`Module.instantiateWasm callback failed with error: ${e}`);
        reject(e);
      }
    });
  }

  wasmBinaryFile ??= findWasmBinary();
  var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
  var exports = receiveInstantiationResult(result);
  return exports;
}

// end include: preamble.js

// Begin JS library code


  class ExitStatus {
      name = 'ExitStatus';
      constructor(status) {
        this.message = `Program terminated with exit(${status})`;
        this.status = status;
      }
    }

  /** @type {!Int16Array} */
  var HEAP16;

  /** @type {!Int32Array} */
  var HEAP32;

  /** not-@type {!BigInt64Array} */
  var HEAP64;

  /** @type {!Int8Array} */
  var HEAP8;

  /** @type {!Float32Array} */
  var HEAPF32;

  /** @type {!Float64Array} */
  var HEAPF64;

  /** @type {!Uint16Array} */
  var HEAPU16;

  /** @type {!Uint32Array} */
  var HEAPU32;

  /** not-@type {!BigUint64Array} */
  var HEAPU64;

  /** @type {!Uint8Array} */
  var HEAPU8;

  var callRuntimeCallbacks = (callbacks) => {
      while (callbacks.length > 0) {
        // Pass the module as the first argument.
        callbacks.shift()(Module);
      }
    };
  var onPostRuns = [];
  var addOnPostRun = (cb) => onPostRuns.push(cb);

  var onPreRuns = [];
  var addOnPreRun = (cb) => onPreRuns.push(cb);


  
    /**
   * @param {number} ptr
   * @param {string} type
   */
  function getValue(ptr, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': return HEAP8[ptr];
      case 'i8': return HEAP8[ptr];
      case 'i16': return HEAP16[((ptr)/2)];
      case 'i32': return HEAP32[((ptr)/4)];
      case 'i64': return HEAP64[((ptr)/8)];
      case 'float': return HEAPF32[((ptr)/4)];
      case 'double': return HEAPF64[((ptr)/8)];
      case '*': return Number(HEAPU64[((ptr)/8)]);
      default: abort(`invalid type for getValue: ${type}`);
    }
  }

  var noExitRuntime = true;

  function ptrToString(ptr) {
      assert(typeof ptr === 'number', `ptrToString expects a number, got ${typeof ptr}`);
      // Convert to 64-bit unsigned value.  We need to use BigInt here since
      // Number cannot represent the full 64-bit range.
      if (ptr < 0) ptr = 2n**64n + BigInt(ptr);
      return '0x' + ptr.toString(16).padStart(16, '0');
    }

  
    /**
   * @param {number} ptr
   * @param {number} value
   * @param {string} type
   */
  function setValue(ptr, value, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': HEAP8[ptr] = value; break;
      case 'i8': HEAP8[ptr] = value; break;
      case 'i16': HEAP16[((ptr)/2)] = value; break;
      case 'i32': HEAP32[((ptr)/4)] = value; break;
      case 'i64': HEAP64[((ptr)/8)] = BigInt(value); break;
      case 'float': HEAPF32[((ptr)/4)] = value; break;
      case 'double': HEAPF64[((ptr)/8)] = value; break;
      case '*': HEAPU64[((ptr)/8)] = BigInt(value); break;
      default: abort(`invalid type for setValue: ${type}`);
    }
  }

  var stackRestore = (val) => __emscripten_stack_restore(val);

  var stackSave = () => _emscripten_stack_get_current();

  var warnOnce = (text) => {
      warnOnce.shown ||= {};
      if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        err(text);
      }
    };

  

  var INT53_MAX = 9007199254740992;
  
  var INT53_MIN = -9007199254740992;
  var bigintToI53Checked = (num) => (num < INT53_MIN || num > INT53_MAX) ? NaN : Number(num);
  
  var UTF8Decoder = globalThis.TextDecoder && new TextDecoder();
  
  var findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
      var maxIdx = idx + maxBytesToRead;
      if (ignoreNul) return maxIdx;
      // TextDecoder needs to know the byte length in advance, it doesn't stop on
      // null terminator by itself.
      // As a tiny code save trick, compare idx against maxIdx using a negation,
      // so that maxBytesToRead=undefined/NaN means Infinity.
      while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
      return idx;
    };
  
  
    /**
   * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
   * array that contains uint8 values, returns a copy of that string as a
   * Javascript String object.
   * heapOrArray is either a regular array, or a JavaScript typed array view.
   * @param {number=} idx
   * @param {number=} maxBytesToRead
   * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
   * @return {string}
   */
  var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
  
      var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
  
      // When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
      if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
      }
      var str = '';
      while (idx < endPtr) {
        // For UTF8 byte structure, see:
        // http://en.wikipedia.org/wiki/UTF-8#Description
        // https://www.ietf.org/rfc/rfc2279.txt
        // https://tools.ietf.org/html/rfc3629
        var u0 = heapOrArray[idx++];
        if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
        var u1 = heapOrArray[idx++] & 63;
        if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
        var u2 = heapOrArray[idx++] & 63;
        if ((u0 & 0xF0) == 0xE0) {
          u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
        } else {
          if ((u0 & 0xF8) != 0xF0) warnOnce(`Invalid UTF-8 leading byte ${ptrToString(u0)} encountered when deserializing a UTF-8 string in wasm memory to a JS string!`);
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
        }
  
        if (u0 < 0x10000) {
          str += String.fromCharCode(u0);
        } else {
          var ch = u0 - 0x10000;
          str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
        }
      }
      return str;
    };
  
    /**
   * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
   * emscripten HEAP, returns a copy of that string as a Javascript String object.
   *
   * @param {number} ptr
   * @param {number=} maxBytesToRead - An optional length that specifies the
   *   maximum number of bytes to read. You can omit this parameter to scan the
   *   string until the first 0 byte. If maxBytesToRead is passed, and the string
   *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
   *   string will cut short at that byte index.
   * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
   * @return {string}
   */
  var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => {
      assert(typeof ptr == 'number', `UTF8ToString expects a number (got ${typeof ptr})`);
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul) : '';
    };
  function ___assert_fail(condition, filename, line, func) {
    condition = bigintToI53Checked(condition);
    filename = bigintToI53Checked(filename);
    func = bigintToI53Checked(func);
  
  return abort(`Assertion failed: ${UTF8ToString(condition)}, at: ` + [filename ? UTF8ToString(filename) : 'unknown filename', line, func ? UTF8ToString(func) : 'unknown function']);
  }

  var __abort_js = () =>
      abort('native code called abort()');

  var readEmAsmArgsArray = [];
  var readEmAsmArgs = (sigPtr, buf) => {
      // Nobody should have mutated _readEmAsmArgsArray underneath us to be something else than an array.
      assert(Array.isArray(readEmAsmArgsArray));
      // The input buffer is allocated on the stack, so it must be stack-aligned.
      assert(buf % 16 == 0);
      readEmAsmArgsArray.length = 0;
      var ch;
      // Most arguments are i32s, so shift the buffer pointer so it is a plain
      // index into HEAP32.
      while (ch = HEAPU8[sigPtr++]) {
        var chr = String.fromCharCode(ch);
        var validChars = ['d', 'f', 'i', 'p'];
        // In WASM_BIGINT mode we support passing i64 values as bigint.
        validChars.push('j');
        assert(validChars.includes(chr), `Invalid character ${ch}("${chr}") in readEmAsmArgs! Use only [${validChars}], and do not specify "v" for void return argument.`);
        // Floats are always passed as doubles, so all types except for 'i'
        // are 8 bytes and require alignment.
        var wide = (ch != 105);
        buf += wide && (buf % 8) ? 4 : 0;
        readEmAsmArgsArray.push(
          // Special case for pointers under wasm64 or CAN_ADDRESS_2GB mode.
          ch == 112 ? Number(HEAPU64[((buf)/8)]) :
          ch == 106 ? HEAP64[((buf)/8)] :
          ch == 105 ?
            HEAP32[((buf)/4)] :
            HEAPF64[((buf)/8)]
        );
        buf += wide ? 8 : 4;
      }
      return readEmAsmArgsArray;
    };
  var runEmAsmFunction = (code, sigPtr, argbuf) => {
      var args = readEmAsmArgs(sigPtr, argbuf);
      assert(ASM_CONSTS.hasOwnProperty(code), `No EM_ASM constant found at address ${code}.  The loaded WebAssembly file is likely out of sync with the generated JavaScript.`);
      return ASM_CONSTS[code](...args);
    };
  
  function _emscripten_asm_const_int(code, sigPtr, argbuf) {
    code = bigintToI53Checked(code);
    sigPtr = bigintToI53Checked(sigPtr);
    argbuf = bigintToI53Checked(argbuf);
  
  
      return runEmAsmFunction(code, sigPtr, argbuf);
    ;
  }

  var _emscripten_has_asyncify = () => 0;

  var abortOnCannotGrowMemory = (requestedSize) => {
      abort(`Cannot enlarge memory arrays to size ${requestedSize} bytes (OOM). Either (1) compile with -sINITIAL_MEMORY=X with X higher than the current value ${HEAP8.length}, (2) compile with -sALLOW_MEMORY_GROWTH which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with -sABORTING_MALLOC=0`);
    };
  
  function _emscripten_resize_heap(requestedSize) {
    requestedSize = bigintToI53Checked(requestedSize);
  
  
      var oldSize = HEAPU8.length;
      abortOnCannotGrowMemory(requestedSize);
    ;
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  var lengthBytesUTF8 = (str) => {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
        // unit, not a Unicode code point of the character! So decode
        // UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var c = str.charCodeAt(i); // possibly a lead surrogate
        if (c <= 0x7F) {
          len++;
        } else if (c <= 0x7FF) {
          len += 2;
        } else if (c >= 0xD800 && c <= 0xDFFF) {
          len += 4; ++i;
        } else {
          len += 3;
        }
      }
      return len;
    };
  
  var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
      assert(typeof str === 'string', `stringToUTF8Array expects a string (got ${typeof str})`);
      // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
      // undefined and false each don't write out any bytes.
      if (!(maxBytesToWrite > 0))
        return 0;
  
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
      for (var i = 0; i < str.length; ++i) {
        // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
        // and https://www.ietf.org/rfc/rfc2279.txt
        // and https://tools.ietf.org/html/rfc3629
        var u = str.codePointAt(i);
        if (u <= 0x7F) {
          if (outIdx >= endIdx) break;
          heap[outIdx++] = u;
        } else if (u <= 0x7FF) {
          if (outIdx + 1 >= endIdx) break;
          heap[outIdx++] = 0xC0 | (u >> 6);
          heap[outIdx++] = 0x80 | (u & 63);
        } else if (u <= 0xFFFF) {
          if (outIdx + 2 >= endIdx) break;
          heap[outIdx++] = 0xE0 | (u >> 12);
          heap[outIdx++] = 0x80 | ((u >> 6) & 63);
          heap[outIdx++] = 0x80 | (u & 63);
        } else {
          if (outIdx + 3 >= endIdx) break;
          if (u > 0x10FFFF) warnOnce(`Invalid Unicode code point ${ptrToString(u)} encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).`);
          heap[outIdx++] = 0xF0 | (u >> 18);
          heap[outIdx++] = 0x80 | ((u >> 12) & 63);
          heap[outIdx++] = 0x80 | ((u >> 6) & 63);
          heap[outIdx++] = 0x80 | (u & 63);
          // Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
          // We need to manually skip over the second code unit for correct iteration.
          i++;
        }
      }
      // Null-terminate the pointer to the buffer.
      heap[outIdx] = 0;
      return outIdx - startIdx;
    };
  var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
      assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    };
  
  var stackAlloc = (sz) => __emscripten_stack_alloc(sz);
  var stringToUTF8OnStack = (str) => {
      var size = lengthBytesUTF8(str) + 1;
      var ret = stackAlloc(size);
      stringToUTF8(str, ret, size);
      return ret;
    };
  
  
  
  var readI53FromI64 = (ptr) => {
      return HEAPU32[((ptr)/4)] + HEAP32[(((ptr)+(4))/4)] * 4294967296;
    };
  
  var readI53FromU64 = (ptr) => {
      return HEAPU32[((ptr)/4)] + HEAPU32[(((ptr)+(4))/4)] * 4294967296;
    };
  var writeI53ToI64 = (ptr, num) => {
      HEAPU32[((ptr)/4)] = num;
      var lower = HEAPU32[((ptr)/4)];
      HEAPU32[(((ptr)+(4))/4)] = (num - lower)/4294967296;
      var deserialized = (num >= 0) ? readI53FromU64(ptr) : readI53FromI64(ptr);
      var offset = ((ptr)/4);
      if (deserialized != num) warnOnce(`writeI53ToI64() out of range: serialized JS Number ${num} to Wasm heap as bytes lo=${ptrToString(HEAPU32[offset])}, hi=${ptrToString(HEAPU32[offset+1])}, which deserializes back to ${deserialized} instead!`);
    };
  
  
  
  var stringToNewUTF8 = (str) => {
      var size = lengthBytesUTF8(str) + 1;
      var ret = _malloc(size);
      if (ret) stringToUTF8(str, ret, size);
      return ret;
    };
  
  
  
  
  var wasmTableMirror = [];
  
  
  var getWasmTableEntry = (funcPtr) => {
      // Function pointers should show up as numbers, even under wasm64, but
      // we still have some places where bigint values can flow here.
      // https://github.com/emscripten-core/emscripten/issues/18200
      funcPtr = Number(funcPtr);
      var func = wasmTableMirror[funcPtr];
      if (!func) {
        /** @suppress {checkTypes} */
        wasmTableMirror[funcPtr] = func = wasmTable.get(BigInt(funcPtr));
      }
      /** @suppress {checkTypes} */
      assert(wasmTable.get(BigInt(funcPtr)) == func, 'JavaScript-side Wasm function table mirror is out of date!');
      return func;
    };
  
  var WebGPU = {
  Internals:{
  jsObjects:[],
  jsObjectInsert:(ptr, jsObject) => {
          
          WebGPU.Internals.jsObjects[ptr] = jsObject;
        },
  bufferOnUnmaps:[],
  futures:[],
  futureInsert:(futureId, promise) => {
        },
  },
  getJsObject:(ptr) => {
        if (!ptr) return undefined;
        
        assert(ptr in WebGPU.Internals.jsObjects);
        return WebGPU.Internals.jsObjects[ptr];
      },
  importJsAdapter:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateAdapter(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsBindGroup:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateBindGroup(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsBindGroupLayout:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateBindGroupLayout(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsBuffer:(buffer, parentPtr = 0) => {
        // At the moment, we do not allow importing pending buffers.
        assert(buffer.mapState === "unmapped");
        var bufferPtr = _emwgpuImportBuffer(parentPtr);
        WebGPU.Internals.jsObjectInsert(bufferPtr, buffer);
        return bufferPtr;
      },
  importJsCommandBuffer:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateCommandBuffer(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsCommandEncoder:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateCommandEncoder(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsComputePassEncoder:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateComputePassEncoder(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsComputePipeline:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateComputePipeline(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsDevice:(device, parentPtr = 0) => {
        var queuePtr = _emwgpuCreateQueue(parentPtr);
        var devicePtr = _emwgpuCreateDevice(parentPtr, queuePtr);
        WebGPU.Internals.jsObjectInsert(queuePtr, device.queue);
        WebGPU.Internals.jsObjectInsert(devicePtr, device);
        return devicePtr;
      },
  importJsExternalTexture:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateExternalTexture(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsPipelineLayout:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreatePipelineLayout(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsQuerySet:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateQuerySet(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsQueue:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateQueue(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsRenderBundle:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateRenderBundle(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsRenderBundleEncoder:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateRenderBundleEncoder(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsRenderPassEncoder:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateRenderPassEncoder(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsRenderPipeline:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateRenderPipeline(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsSampler:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateSampler(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsShaderModule:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateShaderModule(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsSurface:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateSurface(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsTexture:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateTexture(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  importJsTextureView:(obj, parentPtr = 0) => {
            var ptr = _emwgpuCreateTextureView(parentPtr);
            WebGPU.Internals.jsObjects[ptr] = obj;
            return ptr;
          },
  errorCallback:(callback, type, message, userdata) => {
        var sp = stackSave();
        var messagePtr = stringToUTF8OnStack(message);
        ((a1, a2, a3) => getWasmTableEntry(callback).call(null, a1, BigInt(a2), BigInt(a3)))(type, BigInt(messagePtr), userdata);
        stackRestore(sp);
      },
  iterateExtensions:(root, handlers) => {
        assert(root);
        for (var ptr = Number(HEAPU64[((root)/8)]); ptr;
                 ptr = Number(HEAPU64[((ptr)/8)])) {
          var sType = HEAP32[(((ptr)+(8))/4)];
          // This will crash if there's no handler indicating either a bogus
          // sType, or one we haven't implemented yet.
          var handler = handlers[sType](ptr);
        }
      },
  setStringView:(ptr, data, length) => {
        HEAPU64[((ptr)/8)] = BigInt(data);
        HEAPU64[(((ptr)+(8))/8)] = BigInt(length);
      },
  makeStringFromStringView:(stringViewPtr) => {
        var ptr = Number(HEAPU64[((stringViewPtr)/8)]);
        var length = Number(HEAPU64[(((stringViewPtr)+(8))/8)]);
        // UTF8ToString stops at the first null terminator character in the
        // string regardless of the length.
        return UTF8ToString(ptr, length);
      },
  makeStringFromOptionalStringView:(stringViewPtr) => {
        var ptr = Number(HEAPU64[((stringViewPtr)/8)]);
        var length = Number(HEAPU64[(((stringViewPtr)+(8))/8)]);
        // If we don't have a valid string pointer, just return undefined when
        // optional.
        if (!ptr) {
          if (length === 0) {
            return "";
          }
          return undefined;
        }
        // UTF8ToString stops at the first null terminator character in the
        // string regardless of the length.
        return UTF8ToString(ptr, length);
      },
  makeColor:(ptr) => {
        return {
          "r": HEAPF64[((ptr)/8)],
          "g": HEAPF64[(((ptr)+(8))/8)],
          "b": HEAPF64[(((ptr)+(16))/8)],
          "a": HEAPF64[(((ptr)+(24))/8)],
        };
      },
  makeExtent3D:(ptr) => {
        return {
          "width": HEAPU32[((ptr)/4)],
          "height": HEAPU32[(((ptr)+(4))/4)],
          "depthOrArrayLayers": HEAPU32[(((ptr)+(8))/4)],
        };
      },
  makeOrigin3D:(ptr) => {
        return {
          "x": HEAPU32[((ptr)/4)],
          "y": HEAPU32[(((ptr)+(4))/4)],
          "z": HEAPU32[(((ptr)+(8))/4)],
        };
      },
  makeTexelCopyTextureInfo:(ptr) => {
        assert(ptr);
        return {
          "texture": WebGPU.getJsObject(
            Number(HEAPU64[((ptr)/8)])),
          "mipLevel": HEAPU32[(((ptr)+(8))/4)],
          "origin": WebGPU.makeOrigin3D(ptr + 12),
          "aspect": WebGPU.TextureAspect[HEAP32[(((ptr)+(24))/4)]],
        };
      },
  makeTexelCopyBufferLayout:(ptr) => {
        var bytesPerRow = HEAPU32[(((ptr)+(8))/4)];
        var rowsPerImage = HEAPU32[(((ptr)+(12))/4)];
        return {
          "offset": readI53FromI64(ptr),
          "bytesPerRow": bytesPerRow === 4294967295 ? undefined : bytesPerRow,
          "rowsPerImage": rowsPerImage === 4294967295 ? undefined : rowsPerImage,
        };
      },
  makeTexelCopyBufferInfo:(ptr) => {
        assert(ptr);
        var layoutPtr = ptr + 0;
        var bufferCopyView = WebGPU.makeTexelCopyBufferLayout(layoutPtr);
        bufferCopyView["buffer"] = WebGPU.getJsObject(
          Number(HEAPU64[(((ptr)+(16))/8)]));
        return bufferCopyView;
      },
  makePassTimestampWrites:(ptr) => {
        if (ptr === 0) return undefined;
        return {
          "querySet": WebGPU.getJsObject(
            Number(HEAPU64[(((ptr)+(8))/8)])),
          "beginningOfPassWriteIndex": HEAPU32[(((ptr)+(16))/4)],
          "endOfPassWriteIndex": HEAPU32[(((ptr)+(20))/4)],
        };
      },
  makePipelineConstants:(constantCount, constantsPtr) => {
        if (!constantCount) return;
        var constants = {};
        for (var i = 0; i < constantCount; ++i) {
          var entryPtr = constantsPtr + 32 * i;
          var key = WebGPU.makeStringFromStringView(entryPtr + 8);
          constants[key] = HEAPF64[(((entryPtr)+(24))/8)];
        }
        return constants;
      },
  makePipelineLayout:(layoutPtr) => {
        if (!layoutPtr) return 'auto';
        return WebGPU.getJsObject(layoutPtr);
      },
  makeComputeState:(ptr) => {
        if (!ptr) return undefined;
        assert(ptr);assert(Number(HEAPU64[((ptr)/8)]) === 0);
        var desc = {
          "module": WebGPU.getJsObject(
            Number(HEAPU64[(((ptr)+(8))/8)])),
          "constants": WebGPU.makePipelineConstants(
            Number(HEAPU64[(((ptr)+(32))/8)]),
            Number(HEAPU64[(((ptr)+(40))/8)])),
          "entryPoint": WebGPU.makeStringFromOptionalStringView(
            ptr + 16),
        };
        return desc;
      },
  makeComputePipelineDesc:(descriptor) => {
        assert(descriptor);assert(Number(HEAPU64[((descriptor)/8)]) === 0);
  
        var desc = {
          "label": WebGPU.makeStringFromOptionalStringView(
            descriptor + 8),
          "layout": WebGPU.makePipelineLayout(
            Number(HEAPU64[(((descriptor)+(24))/8)])),
          "compute": WebGPU.makeComputeState(
            descriptor + 32),
        };
        return desc;
      },
  makeRenderPipelineDesc:(descriptor) => {
        assert(descriptor);assert(Number(HEAPU64[((descriptor)/8)]) === 0);
  
        function makePrimitiveState(psPtr) {
          if (!psPtr) return undefined;
          assert(psPtr);assert(Number(HEAPU64[((psPtr)/8)]) === 0);
          return {
            "topology": WebGPU.PrimitiveTopology[HEAP32[(((psPtr)+(8))/4)]],
            "stripIndexFormat": WebGPU.IndexFormat[HEAP32[(((psPtr)+(12))/4)]],
            "frontFace": WebGPU.FrontFace[HEAP32[(((psPtr)+(16))/4)]],
            "cullMode": WebGPU.CullMode[HEAP32[(((psPtr)+(20))/4)]],
            "unclippedDepth": !!(HEAPU32[(((psPtr)+(24))/4)]),
          };
        }
  
        function makeBlendComponent(bdPtr) {
          if (!bdPtr) return undefined;
          return {
            "operation": WebGPU.BlendOperation[HEAP32[((bdPtr)/4)]],
            "srcFactor": WebGPU.BlendFactor[HEAP32[(((bdPtr)+(4))/4)]],
            "dstFactor": WebGPU.BlendFactor[HEAP32[(((bdPtr)+(8))/4)]],
          };
        }
  
        function makeBlendState(bsPtr) {
          if (!bsPtr) return undefined;
          return {
            "alpha": makeBlendComponent(bsPtr + 12),
            "color": makeBlendComponent(bsPtr + 0),
          };
        }
  
        function makeColorState(csPtr) {
          assert(csPtr);assert(Number(HEAPU64[((csPtr)/8)]) === 0);
          var format = WebGPU.TextureFormat[HEAP32[(((csPtr)+(8))/4)]];
          return format ? {
            "format": format,
            "blend": makeBlendState(Number(HEAPU64[(((csPtr)+(16))/8)])),
            "writeMask": HEAPU32[(((csPtr)+(24))/4)],
          } : undefined;
        }
  
        function makeColorStates(count, csArrayPtr) {
          var states = [];
          for (var i = 0; i < count; ++i) {
            states.push(makeColorState(csArrayPtr + 32 * i));
          }
          return states;
        }
  
        function makeStencilStateFace(ssfPtr) {
          assert(ssfPtr);
          return {
            "compare": WebGPU.CompareFunction[HEAP32[((ssfPtr)/4)]],
            "failOp": WebGPU.StencilOperation[HEAP32[(((ssfPtr)+(4))/4)]],
            "depthFailOp": WebGPU.StencilOperation[HEAP32[(((ssfPtr)+(8))/4)]],
            "passOp": WebGPU.StencilOperation[HEAP32[(((ssfPtr)+(12))/4)]],
          };
        }
  
        function makeDepthStencilState(dssPtr) {
          if (!dssPtr) return undefined;
  
          assert(dssPtr);
          return {
            "format": WebGPU.TextureFormat[HEAP32[(((dssPtr)+(8))/4)]],
            "depthWriteEnabled": !!(HEAPU32[(((dssPtr)+(12))/4)]),
            "depthCompare": WebGPU.CompareFunction[HEAP32[(((dssPtr)+(16))/4)]],
            "stencilFront": makeStencilStateFace(dssPtr + 20),
            "stencilBack": makeStencilStateFace(dssPtr + 36),
            "stencilReadMask": HEAPU32[(((dssPtr)+(52))/4)],
            "stencilWriteMask": HEAPU32[(((dssPtr)+(56))/4)],
            "depthBias": HEAP32[(((dssPtr)+(60))/4)],
            "depthBiasSlopeScale": HEAPF32[(((dssPtr)+(64))/4)],
            "depthBiasClamp": HEAPF32[(((dssPtr)+(68))/4)],
          };
        }
  
        function makeVertexAttribute(vaPtr) {
          assert(vaPtr);
          return {
            "format": WebGPU.VertexFormat[HEAP32[(((vaPtr)+(8))/4)]],
            "offset": readI53FromI64((vaPtr)+(16)),
            "shaderLocation": HEAPU32[(((vaPtr)+(24))/4)],
          };
        }
  
        function makeVertexAttributes(count, vaArrayPtr) {
          var vas = [];
          for (var i = 0; i < count; ++i) {
            vas.push(makeVertexAttribute(vaArrayPtr + i * 32));
          }
          return vas;
        }
  
        function makeVertexBuffer(vbPtr) {
          if (!vbPtr) return undefined;
          var stepMode = WebGPU.VertexStepMode[HEAP32[(((vbPtr)+(8))/4)]];
          var attributeCount = Number(HEAPU64[(((vbPtr)+(24))/8)]);
          if (!stepMode && !attributeCount) {
            return null;
          }
          return {
            "arrayStride": readI53FromI64((vbPtr)+(16)),
            "stepMode": stepMode,
            "attributes": makeVertexAttributes(
              attributeCount,
              Number(HEAPU64[(((vbPtr)+(32))/8)])),
          };
        }
  
        function makeVertexBuffers(count, vbArrayPtr) {
          if (!count) return undefined;
  
          var vbs = [];
          for (var i = 0; i < count; ++i) {
            vbs.push(makeVertexBuffer(vbArrayPtr + i * 40));
          }
          return vbs;
        }
  
        function makeVertexState(viPtr) {
          if (!viPtr) return undefined;
          assert(viPtr);assert(Number(HEAPU64[((viPtr)/8)]) === 0);
          var desc = {
            "module": WebGPU.getJsObject(
              Number(HEAPU64[(((viPtr)+(8))/8)])),
            "constants": WebGPU.makePipelineConstants(
              Number(HEAPU64[(((viPtr)+(32))/8)]),
              Number(HEAPU64[(((viPtr)+(40))/8)])),
            "buffers": makeVertexBuffers(
              Number(HEAPU64[(((viPtr)+(48))/8)]),
              Number(HEAPU64[(((viPtr)+(56))/8)])),
            "entryPoint": WebGPU.makeStringFromOptionalStringView(
              viPtr + 16),
            };
          return desc;
        }
  
        function makeMultisampleState(msPtr) {
          if (!msPtr) return undefined;
          assert(msPtr);assert(Number(HEAPU64[((msPtr)/8)]) === 0);
          return {
            "count": HEAPU32[(((msPtr)+(8))/4)],
            "mask": HEAPU32[(((msPtr)+(12))/4)],
            "alphaToCoverageEnabled": !!(HEAPU32[(((msPtr)+(16))/4)]),
          };
        }
  
        function makeFragmentState(fsPtr) {
          if (!fsPtr) return undefined;
          assert(fsPtr);assert(Number(HEAPU64[((fsPtr)/8)]) === 0);
          var desc = {
            "module": WebGPU.getJsObject(
              Number(HEAPU64[(((fsPtr)+(8))/8)])),
            "constants": WebGPU.makePipelineConstants(
              Number(HEAPU64[(((fsPtr)+(32))/8)]),
              Number(HEAPU64[(((fsPtr)+(40))/8)])),
            "targets": makeColorStates(
              Number(HEAPU64[(((fsPtr)+(48))/8)]),
              Number(HEAPU64[(((fsPtr)+(56))/8)])),
            "entryPoint": WebGPU.makeStringFromOptionalStringView(
              fsPtr + 16),
            };
          return desc;
        }
  
        var desc = {
          "label": WebGPU.makeStringFromOptionalStringView(
            descriptor + 8),
          "layout": WebGPU.makePipelineLayout(
            Number(HEAPU64[(((descriptor)+(24))/8)])),
          "vertex": makeVertexState(
            descriptor + 32),
          "primitive": makePrimitiveState(
            descriptor + 96),
          "depthStencil": makeDepthStencilState(
            Number(HEAPU64[(((descriptor)+(128))/8)])),
          "multisample": makeMultisampleState(
            descriptor + 136),
          "fragment": makeFragmentState(
            Number(HEAPU64[(((descriptor)+(160))/8)])),
        };
        return desc;
      },
  fillLimitStruct:(limits, limitsOutPtr) => {
        assert(limitsOutPtr);
        var nextInChainPtr = Number(HEAPU64[((limitsOutPtr)/8)]);
  
        function setLimitValueU32(name, basePtr, limitOffset, fallbackValue = 0) {
          var limitValue = limits[name] ?? fallbackValue;
          HEAPU32[(((basePtr)+(limitOffset))/4)] = limitValue;
        }
        function setLimitValueU64(name, basePtr, limitOffset, fallbackValue = 0) {
          var limitValue = limits[name] ?? fallbackValue;
          // Limits are integer-valued JS `Number`s, so they fit in 'i53'.
          writeI53ToI64((basePtr)+(limitOffset), limitValue);
        }
  
        setLimitValueU32('maxTextureDimension1D',                     limitsOutPtr, 8);
        setLimitValueU32('maxTextureDimension2D',                     limitsOutPtr, 12);
        setLimitValueU32('maxTextureDimension3D',                     limitsOutPtr, 16);
        setLimitValueU32('maxTextureArrayLayers',                     limitsOutPtr, 20);
        setLimitValueU32('maxBindGroups',                             limitsOutPtr, 24);
        setLimitValueU32('maxBindGroupsPlusVertexBuffers',            limitsOutPtr, 28);
        setLimitValueU32('maxBindingsPerBindGroup',                   limitsOutPtr, 32);
        setLimitValueU32('maxDynamicUniformBuffersPerPipelineLayout', limitsOutPtr, 36);
        setLimitValueU32('maxDynamicStorageBuffersPerPipelineLayout', limitsOutPtr, 40);
        setLimitValueU32('maxSampledTexturesPerShaderStage',          limitsOutPtr, 44);
        setLimitValueU32('maxSamplersPerShaderStage',                 limitsOutPtr, 48);
        setLimitValueU32('maxStorageBuffersPerShaderStage',           limitsOutPtr, 52);
        setLimitValueU32('maxStorageTexturesPerShaderStage',          limitsOutPtr, 56);
        setLimitValueU32('maxUniformBuffersPerShaderStage',           limitsOutPtr, 60);
        setLimitValueU32('minUniformBufferOffsetAlignment',           limitsOutPtr, 80);
        setLimitValueU32('minStorageBufferOffsetAlignment',           limitsOutPtr, 84);
        setLimitValueU64('maxUniformBufferBindingSize',               limitsOutPtr, 64);
        setLimitValueU64('maxStorageBufferBindingSize',               limitsOutPtr, 72);
        setLimitValueU32('maxVertexBuffers',                          limitsOutPtr, 88);
        setLimitValueU64('maxBufferSize',                             limitsOutPtr, 96);
        setLimitValueU32('maxVertexAttributes',                       limitsOutPtr, 104);
        setLimitValueU32('maxVertexBufferArrayStride',                limitsOutPtr, 108);
        setLimitValueU32('maxInterStageShaderVariables',              limitsOutPtr, 112);
        setLimitValueU32('maxColorAttachments',                       limitsOutPtr, 116);
        setLimitValueU32('maxColorAttachmentBytesPerSample',          limitsOutPtr, 120);
        setLimitValueU32('maxComputeWorkgroupStorageSize',            limitsOutPtr, 124);
        setLimitValueU32('maxComputeInvocationsPerWorkgroup',         limitsOutPtr, 128);
        setLimitValueU32('maxComputeWorkgroupSizeX',                  limitsOutPtr, 132);
        setLimitValueU32('maxComputeWorkgroupSizeY',                  limitsOutPtr, 136);
        setLimitValueU32('maxComputeWorkgroupSizeZ',                  limitsOutPtr, 140);
        setLimitValueU32('maxComputeWorkgroupsPerDimension',          limitsOutPtr, 144);
        // Note this limit is new and won't be present in all browsers for a while. Fall back to 0.
        setLimitValueU32('maxImmediateSize',                          limitsOutPtr, 148);
  
        if (nextInChainPtr !== 0) {
          var sType = HEAP32[(((nextInChainPtr)+(8))/4)];
          assert(sType === 15);
          assert(0 === Number(HEAPU64[((nextInChainPtr)/8)]));
          var compatibilityModeLimitsPtr = nextInChainPtr;
          assert(compatibilityModeLimitsPtr);assert(Number(HEAPU64[((compatibilityModeLimitsPtr)/8)]) === 0);
  
          // Note these limits are new and won't be present in all browsers for a while. Fall back to exposing the PerShaderStage limit.
          setLimitValueU32('maxStorageBuffersInVertexStage',    compatibilityModeLimitsPtr, 16,    limits.maxStorageBuffersPerShaderStage);
          setLimitValueU32('maxStorageBuffersInFragmentStage',  compatibilityModeLimitsPtr, 24,  limits.maxStorageBuffersPerShaderStage);
          setLimitValueU32('maxStorageTexturesInVertexStage',   compatibilityModeLimitsPtr, 20,   limits.maxStorageTexturesPerShaderStage);
          setLimitValueU32('maxStorageTexturesInFragmentStage', compatibilityModeLimitsPtr, 28, limits.maxStorageTexturesPerShaderStage);
        }
      },
  fillAdapterInfoStruct:(info, infoStruct) => {
        assert(infoStruct);assert(Number(HEAPU64[((infoStruct)/8)]) === 0);
  
        // Populate subgroup limits.
        HEAPU32[(((infoStruct)+(88))/4)] = info.subgroupMinSize;
        HEAPU32[(((infoStruct)+(92))/4)] = info.subgroupMaxSize;
  
        // Append all the strings together to condense into a single malloc.
        var strs = info.vendor + info.architecture + info.device + info.description;
        var strPtr = stringToNewUTF8(strs);
  
        var vendorLen = lengthBytesUTF8(info.vendor);
        WebGPU.setStringView(infoStruct + 8, strPtr, vendorLen);
        strPtr += vendorLen;
  
        var architectureLen = lengthBytesUTF8(info.architecture);
        WebGPU.setStringView(infoStruct + 24, strPtr, architectureLen);
        strPtr += architectureLen;
  
        var deviceLen = lengthBytesUTF8(info.device);
        WebGPU.setStringView(infoStruct + 40, strPtr, deviceLen);
        strPtr += deviceLen;
  
        var descriptionLen = lengthBytesUTF8(info.description);
        WebGPU.setStringView(infoStruct + 56, strPtr, descriptionLen);
        strPtr += descriptionLen;
  
        HEAP32[(((infoStruct)+(72))/4)] = 2;
        var adapterType = info.isFallbackAdapter ? 3 : 4;
        HEAP32[(((infoStruct)+(76))/4)] = adapterType;
        HEAPU32[(((infoStruct)+(80))/4)] = 0;
        HEAPU32[(((infoStruct)+(84))/4)] = 0;
      },
  AddressMode:[,"clamp-to-edge","repeat","mirror-repeat"],
  BlendFactor:[,"zero","one","src","one-minus-src","src-alpha","one-minus-src-alpha","dst","one-minus-dst","dst-alpha","one-minus-dst-alpha","src-alpha-saturated","constant","one-minus-constant","src1","one-minus-src1","src1-alpha","one-minus-src1-alpha"],
  BlendOperation:[,"add","subtract","reverse-subtract","min","max"],
  BufferBindingType:[,,"uniform","storage","read-only-storage"],
  BufferMapState:[,"unmapped","pending","mapped"],
  CompareFunction:[,"never","less","equal","less-equal","greater","not-equal","greater-equal","always"],
  CompilationInfoRequestStatus:[,"success","callback-cancelled"],
  ComponentSwizzle:[,"0","1","r","g","b","a"],
  CompositeAlphaMode:[,"opaque","premultiplied","unpremultiplied","inherit"],
  CullMode:[,"none","front","back"],
  ErrorFilter:[,"validation","out-of-memory","internal"],
  FeatureLevel:[,"compatibility","core"],
  FeatureName:{
  1:"core-features-and-limits",
  2:"depth-clip-control",
  3:"depth32float-stencil8",
  4:"texture-compression-bc",
  5:"texture-compression-bc-sliced-3d",
  6:"texture-compression-etc2",
  7:"texture-compression-astc",
  8:"texture-compression-astc-sliced-3d",
  9:"timestamp-query",
  10:"indirect-first-instance",
  11:"shader-f16",
  12:"rg11b10ufloat-renderable",
  13:"bgra8unorm-storage",
  14:"float32-filterable",
  15:"float32-blendable",
  16:"clip-distances",
  17:"dual-source-blending",
  18:"subgroups",
  19:"texture-formats-tier1",
  20:"texture-formats-tier2",
  21:"primitive-index",
  22:"texture-component-swizzle",
  23:"subgroup-size-control",
  327692:"chromium-experimental-unorm16-texture-formats",
  327729:"chromium-experimental-multi-draw-indirect",
  },
  FilterMode:[,"nearest","linear"],
  FrontFace:[,"ccw","cw"],
  IndexFormat:[,"uint16","uint32"],
  InstanceFeatureName:[,"timed-wait-any","shader-source-spirv","multiple-devices-per-adapter"],
  LoadOp:[,"load","clear"],
  MipmapFilterMode:[,"nearest","linear"],
  OptionalBool:["false","true",],
  PowerPreference:[,"low-power","high-performance"],
  PredefinedColorSpace:[,"srgb","display-p3"],
  PrimitiveTopology:[,"point-list","line-list","line-strip","triangle-list","triangle-strip"],
  QueryType:[,"occlusion","timestamp"],
  SamplerBindingType:[,,"filtering","non-filtering","comparison"],
  Status:[,"success","error"],
  StencilOperation:[,"keep","zero","replace","invert","increment-clamp","decrement-clamp","increment-wrap","decrement-wrap"],
  StorageTextureAccess:[,,"write-only","read-only","read-write"],
  StoreOp:[,"store","discard"],
  SurfaceGetCurrentTextureStatus:[,"success-optimal","success-suboptimal","timeout","outdated","lost","error"],
  TextureAspect:[,"all","stencil-only","depth-only"],
  TextureDimension:[,"1d","2d","3d"],
  TextureFormat:[,"r8unorm","r8snorm","r8uint","r8sint","r16unorm","r16snorm","r16uint","r16sint","r16float","rg8unorm","rg8snorm","rg8uint","rg8sint","r32float","r32uint","r32sint","rg16unorm","rg16snorm","rg16uint","rg16sint","rg16float","rgba8unorm","rgba8unorm-srgb","rgba8snorm","rgba8uint","rgba8sint","bgra8unorm","bgra8unorm-srgb","rgb10a2uint","rgb10a2unorm","rg11b10ufloat","rgb9e5ufloat","rg32float","rg32uint","rg32sint","rgba16unorm","rgba16snorm","rgba16uint","rgba16sint","rgba16float","rgba32float","rgba32uint","rgba32sint","stencil8","depth16unorm","depth24plus","depth24plus-stencil8","depth32float","depth32float-stencil8","bc1-rgba-unorm","bc1-rgba-unorm-srgb","bc2-rgba-unorm","bc2-rgba-unorm-srgb","bc3-rgba-unorm","bc3-rgba-unorm-srgb","bc4-r-unorm","bc4-r-snorm","bc5-rg-unorm","bc5-rg-snorm","bc6h-rgb-ufloat","bc6h-rgb-float","bc7-rgba-unorm","bc7-rgba-unorm-srgb","etc2-rgb8unorm","etc2-rgb8unorm-srgb","etc2-rgb8a1unorm","etc2-rgb8a1unorm-srgb","etc2-rgba8unorm","etc2-rgba8unorm-srgb","eac-r11unorm","eac-r11snorm","eac-rg11unorm","eac-rg11snorm","astc-4x4-unorm","astc-4x4-unorm-srgb","astc-5x4-unorm","astc-5x4-unorm-srgb","astc-5x5-unorm","astc-5x5-unorm-srgb","astc-6x5-unorm","astc-6x5-unorm-srgb","astc-6x6-unorm","astc-6x6-unorm-srgb","astc-8x5-unorm","astc-8x5-unorm-srgb","astc-8x6-unorm","astc-8x6-unorm-srgb","astc-8x8-unorm","astc-8x8-unorm-srgb","astc-10x5-unorm","astc-10x5-unorm-srgb","astc-10x6-unorm","astc-10x6-unorm-srgb","astc-10x8-unorm","astc-10x8-unorm-srgb","astc-10x10-unorm","astc-10x10-unorm-srgb","astc-12x10-unorm","astc-12x10-unorm-srgb","astc-12x12-unorm","astc-12x12-unorm-srgb"],
  TextureSampleType:[,,"float","unfilterable-float","depth","sint","uint"],
  TextureViewDimension:[,"1d","2d","2d-array","cube","cube-array","3d"],
  ToneMappingMode:[,"standard","extended"],
  VertexFormat:[,"uint8","uint8x2","uint8x4","sint8","sint8x2","sint8x4","unorm8","unorm8x2","unorm8x4","snorm8","snorm8x2","snorm8x4","uint16","uint16x2","uint16x4","sint16","sint16x2","sint16x4","unorm16","unorm16x2","unorm16x4","snorm16","snorm16x2","snorm16x4","float16","float16x2","float16x4","float32","float32x2","float32x3","float32x4","uint32","uint32x2","uint32x3","uint32x4","sint32","sint32x2","sint32x3","sint32x4","unorm10-10-10-2","unorm8x4-bgra"],
  VertexStepMode:[,"vertex","instance"],
  WGSLLanguageFeatureName:[,"readonly_and_readwrite_storage_textures","packed_4x8_integer_dot_product","unrestricted_pointer_parameters","pointer_composite_access","uniform_buffer_standard_layout","subgroup_id","texture_and_sampler_let","subgroup_uniformity","texture_formats_tier1","linear_indexing","immediate_address_space"],
  };
  
  var emwgpuStringToInt_DeviceLostReason = {
              'undefined': 1,  // For older browsers
              'unknown': 1,
              'destroyed': 2,
          };
  
  var handleException = (e) => {
      // Certain exception types we do not treat as errors since they are used for
      // internal control flow.
      // 1. ExitStatus, which is thrown by exit()
      // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
      //    that wish to return to JS event loop.
      if (e instanceof ExitStatus || e == 'unwind') {
        return EXITSTATUS;
      }
      checkStackCookie();
      if (e instanceof WebAssembly.RuntimeError) {
        if (_emscripten_stack_get_current() <= 0) {
          err('Stack overflow detected.  You can try increasing -sSTACK_SIZE (currently set to 65536)');
        }
      }
      quit_(1, e);
    };
  
  
  var runtimeKeepaliveCounter = 0;
  var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;
  var _proc_exit = (code) => {
      EXITSTATUS = code;
      if (!keepRuntimeAlive()) {
        Module['onExit']?.(code);
        ABORT = true;
      }
      quit_(code, new ExitStatus(code));
    };
  
  
  /** @param {boolean|number=} implicit */
  var exitJS = (status, implicit) => {
      EXITSTATUS = status;
  
      checkUnflushedContent();
  
      // if exit() was called explicitly, warn the user if the runtime isn't actually being shut down
      if (keepRuntimeAlive() && !implicit) {
        var msg = `program exited (with status: ${status}), but keepRuntimeAlive() is set (counter=${runtimeKeepaliveCounter}) due to an async operation, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)`;
        readyPromiseReject?.(msg);
        err(msg);
      }
  
      _proc_exit(status);
    };
  var _exit = exitJS;
  
  
  var maybeExit = () => {
      if (!keepRuntimeAlive()) {
        try {
          _exit(EXITSTATUS);
        } catch (e) {
          handleException(e);
        }
      }
    };
  var callUserCallback = (func) => {
      if (ABORT) {
        err('user callback triggered after runtime exited or application aborted.  Ignoring.');
        return;
      }
      try {
        return func();
      } catch (e) {
        handleException(e);
      } finally {
        maybeExit();
      }
    };
  
  
  
  function _emwgpuAdapterRequestDevice(adapterPtr, futureId, deviceLostFutureId, devicePtr, queuePtr, descriptor) {
    adapterPtr = bigintToI53Checked(adapterPtr);
    futureId = bigintToI53Checked(futureId);
    deviceLostFutureId = bigintToI53Checked(deviceLostFutureId);
    devicePtr = bigintToI53Checked(devicePtr);
    queuePtr = bigintToI53Checked(queuePtr);
    descriptor = bigintToI53Checked(descriptor);
  
  
      var adapter = WebGPU.getJsObject(adapterPtr);
  
      var desc = {};
      if (descriptor) {
        assert(descriptor);assert(Number(HEAPU64[((descriptor)/8)]) === 0);
        var requiredFeatureCount = Number(HEAPU64[(((descriptor)+(24))/8)]);
        if (requiredFeatureCount) {
          var requiredFeaturesPtr = Number(HEAPU64[(((descriptor)+(32))/8)]);
          // requiredFeaturesPtr is a pointer to an array of FeatureName which is an enum of size uint32_t
          desc["requiredFeatures"] = Array.from(HEAPU32.subarray((((requiredFeaturesPtr)/4)), ((requiredFeaturesPtr + requiredFeatureCount * 4)/4)),
            (feature) => WebGPU.FeatureName[feature]);
        }
        var limitsPtr = Number(HEAPU64[(((descriptor)+(40))/8)]);
        if (limitsPtr) {
          assert(limitsPtr);
          var nextInChainPtr = Number(HEAPU64[((limitsPtr)/8)]);
          var requiredLimits = {};
          function setLimitU32IfDefined(name, basePtr, limitOffset, ignoreIfZero = false) {
            var ptr = basePtr + limitOffset;
            var value = HEAPU32[((ptr)/4)];
            if (value != 4294967295 && (!ignoreIfZero || value != 0)) {
              requiredLimits[name] = value;
            }
          }
          function setLimitU64IfDefined(name, basePtr, limitOffset) {
            var ptr = basePtr + limitOffset;
            // Handle WGPU_LIMIT_U64_UNDEFINED.
            var limitPart1 = HEAPU32[((ptr)/4)];
            var limitPart2 = HEAPU32[(((ptr)+(4))/4)];
            if (limitPart1 != 0xFFFFFFFF || limitPart2 != 0xFFFFFFFF) {
              requiredLimits[name] = readI53FromI64(ptr);
            }
          }
  
          setLimitU32IfDefined("maxTextureDimension1D",                     limitsPtr, 8);
          setLimitU32IfDefined("maxTextureDimension2D",                     limitsPtr, 12);
          setLimitU32IfDefined("maxTextureDimension3D",                     limitsPtr, 16);
          setLimitU32IfDefined("maxTextureArrayLayers",                     limitsPtr, 20);
          setLimitU32IfDefined("maxBindGroups",                             limitsPtr, 24);
          setLimitU32IfDefined('maxBindGroupsPlusVertexBuffers',            limitsPtr, 28);
          setLimitU32IfDefined('maxBindingsPerBindGroup',                   limitsPtr, 32);
          setLimitU32IfDefined("maxDynamicUniformBuffersPerPipelineLayout", limitsPtr, 36);
          setLimitU32IfDefined("maxDynamicStorageBuffersPerPipelineLayout", limitsPtr, 40);
          setLimitU32IfDefined("maxSampledTexturesPerShaderStage",          limitsPtr, 44);
          setLimitU32IfDefined("maxSamplersPerShaderStage",                 limitsPtr, 48);
          setLimitU32IfDefined("maxStorageBuffersPerShaderStage",           limitsPtr, 52);
          setLimitU32IfDefined("maxStorageTexturesPerShaderStage",          limitsPtr, 56);
          setLimitU32IfDefined("maxUniformBuffersPerShaderStage",           limitsPtr, 60);
          setLimitU32IfDefined("minUniformBufferOffsetAlignment",           limitsPtr, 80);
          setLimitU32IfDefined("minStorageBufferOffsetAlignment",           limitsPtr, 84);
          setLimitU64IfDefined("maxUniformBufferBindingSize",               limitsPtr, 64);
          setLimitU64IfDefined("maxStorageBufferBindingSize",               limitsPtr, 72);
          setLimitU32IfDefined("maxVertexBuffers",                          limitsPtr, 88);
          setLimitU64IfDefined("maxBufferSize",                             limitsPtr, 96);
          setLimitU32IfDefined("maxVertexAttributes",                       limitsPtr, 104);
          setLimitU32IfDefined("maxVertexBufferArrayStride",                limitsPtr, 108);
          setLimitU32IfDefined("maxInterStageShaderVariables",              limitsPtr, 112);
          setLimitU32IfDefined("maxColorAttachments",                       limitsPtr, 116);
          setLimitU32IfDefined("maxColorAttachmentBytesPerSample",          limitsPtr, 120);
          setLimitU32IfDefined("maxComputeWorkgroupStorageSize",            limitsPtr, 124);
          setLimitU32IfDefined("maxComputeInvocationsPerWorkgroup",         limitsPtr, 128);
          setLimitU32IfDefined("maxComputeWorkgroupSizeX",                  limitsPtr, 132);
          setLimitU32IfDefined("maxComputeWorkgroupSizeY",                  limitsPtr, 136);
          setLimitU32IfDefined("maxComputeWorkgroupSizeZ",                  limitsPtr, 140);
          setLimitU32IfDefined("maxComputeWorkgroupsPerDimension",          limitsPtr, 144);
          // Not present in all browsers. If the app requested 0, avoid passing it through so it won't cause an error.
          setLimitU32IfDefined("maxImmediateSize",                          limitsPtr, 148, true);
  
          if (nextInChainPtr !== 0) {
            var sType = HEAP32[(((nextInChainPtr)+(8))/4)];
            assert(sType === 15);
            assert(0 === Number(HEAPU64[((nextInChainPtr)/8)]));
            var compatibilityModeLimitsPtr = nextInChainPtr;
            assert(compatibilityModeLimitsPtr);assert(Number(HEAPU64[((compatibilityModeLimitsPtr)/8)]) === 0);
            // If not present in the browser, don't request these, otherwise they'll cause an error.
            // (Technically, if any of these is higher than the PerShaderStage equivalent, we should
            // raise the PerShaderStage limit instead, but that's complex and apps should be able to
            // deal with that themselves.)
            if ('maxStorageBuffersInVertexStage' in GPUSupportedLimits.prototype) {
              setLimitU32IfDefined('maxStorageBuffersInVertexStage',    compatibilityModeLimitsPtr, 16);
              setLimitU32IfDefined('maxStorageTexturesInVertexStage',   compatibilityModeLimitsPtr, 20);
              setLimitU32IfDefined('maxStorageBuffersInFragmentStage',  compatibilityModeLimitsPtr, 24);
              setLimitU32IfDefined('maxStorageTexturesInFragmentStage', compatibilityModeLimitsPtr, 28);
            }
          }
  
          desc["requiredLimits"] = requiredLimits;
        }
  
        var defaultQueuePtr = Number(HEAPU64[(((descriptor)+(48))/8)]);
        if (defaultQueuePtr) {
          var defaultQueueDesc = {
            "label": WebGPU.makeStringFromOptionalStringView(
              defaultQueuePtr + 8),
          };
          desc["defaultQueue"] = defaultQueueDesc;
        }
        desc["label"] = WebGPU.makeStringFromOptionalStringView(
          descriptor + 8
        );
      }
  
       // requestDevice
      WebGPU.Internals.futureInsert(futureId, adapter.requestDevice(desc).then((device) => {
         // requestDevice fulfilled
        callUserCallback(() => {
          WebGPU.Internals.jsObjectInsert(queuePtr, device.queue);
          WebGPU.Internals.jsObjectInsert(devicePtr, device);
  
          devicePtr = BigInt(devicePtr);
  
          // Set up device lost promise resolution.
          assert(deviceLostFutureId);
          // Don't keepalive here, because this isn't guaranteed to ever happen.
          WebGPU.Internals.futureInsert(deviceLostFutureId, device.lost.then((info) => {
            // If the runtime has exited, avoid calling callUserCallback as it
            // will print an error (e.g. if the device got freed during shutdown).
            callUserCallback(() => {
              // Unset the uncaptured error handler.
              device.onuncapturederror = (ev) => {};
              var sp = stackSave();
              var messagePtr = stringToUTF8OnStack(info.message);
              _emwgpuOnDeviceLostCompleted(deviceLostFutureId, emwgpuStringToInt_DeviceLostReason[info.reason],
                BigInt(messagePtr));
              stackRestore(sp);
            });
          }));
  
          // Set up uncaptured error handlers.
          assert(typeof GPUValidationError != 'undefined');
          assert(typeof GPUOutOfMemoryError != 'undefined');
          assert(typeof GPUInternalError != 'undefined');
          device.onuncapturederror = (ev) => {
              var type = 5;
              if (ev.error instanceof GPUValidationError) type = 2;
              else if (ev.error instanceof GPUOutOfMemoryError) type = 3;
              else if (ev.error instanceof GPUInternalError) type = 4;
              var sp = stackSave();
              var messagePtr = stringToUTF8OnStack(ev.error.message);
              _emwgpuOnUncapturedError(BigInt(devicePtr), type, BigInt(messagePtr));
              stackRestore(sp);
          };
  
          _emwgpuOnRequestDeviceCompleted(futureId, 1,
            BigInt(devicePtr), 0n);
        });
      }, (ex) => {
         // requestDevice rejected
        callUserCallback(() => {
          var sp = stackSave();
          var messagePtr = stringToUTF8OnStack(ex.message);
          _emwgpuOnRequestDeviceCompleted(futureId, 3,
            BigInt(devicePtr), BigInt(messagePtr));
          if (deviceLostFutureId) {
            _emwgpuOnDeviceLostCompleted(deviceLostFutureId, 4,
              BigInt(messagePtr));
          }
          stackRestore(sp);
        });
      }));
    ;
  }

  
  
  function _emwgpuBufferDestroy(bufferPtr) {
    bufferPtr = bigintToI53Checked(bufferPtr);
  
  
      var buffer = WebGPU.getJsObject(bufferPtr);
      var onUnmap = WebGPU.Internals.bufferOnUnmaps[bufferPtr];
      if (onUnmap) {
        for (var i = 0; i < onUnmap.length; ++i) {
          onUnmap[i]();
        }
        delete WebGPU.Internals.bufferOnUnmaps[bufferPtr];
      }
  
      buffer.destroy();
    ;
  }

  
  
  function _emwgpuDelete(ptr) {
    ptr = bigintToI53Checked(ptr);
  
  
      delete WebGPU.Internals.jsObjects[ptr];
    ;
  }

  
  
  function _emwgpuDeviceCreateBuffer(devicePtr, descriptor, bufferPtr) {
    devicePtr = bigintToI53Checked(devicePtr);
    descriptor = bigintToI53Checked(descriptor);
    bufferPtr = bigintToI53Checked(bufferPtr);
  
  
      assert(descriptor);assert(Number(HEAPU64[((descriptor)/8)]) === 0);
  
      var mappedAtCreation = !!(HEAPU32[(((descriptor)+(40))/4)]);
  
      var desc = {
        "label": WebGPU.makeStringFromOptionalStringView(
          descriptor + 8),
        "usage": HEAPU32[(((descriptor)+(24))/4)],
        "size": readI53FromI64((descriptor)+(32)),
        "mappedAtCreation": mappedAtCreation,
      };
  
      var device = WebGPU.getJsObject(devicePtr);
      var buffer;
      try {
        buffer = device.createBuffer(desc);
      } catch (ex) {
        // The only exception should be RangeError if mapping at creation ran out of memory.
        assert(ex instanceof RangeError);
        assert(mappedAtCreation);
        err('createBuffer threw:', ex);
        return false;
      }
      WebGPU.Internals.jsObjectInsert(bufferPtr, buffer);
      if (mappedAtCreation) {
        WebGPU.Internals.bufferOnUnmaps[bufferPtr] = [];
      }
      return true;
    ;
  }

  
  
  function _emwgpuDeviceCreateShaderModule(devicePtr, descriptor, shaderModulePtr) {
    devicePtr = bigintToI53Checked(devicePtr);
    descriptor = bigintToI53Checked(descriptor);
    shaderModulePtr = bigintToI53Checked(shaderModulePtr);
  
  
      assert(descriptor);
      var nextInChainPtr = Number(HEAPU64[((descriptor)/8)]);
      assert(nextInChainPtr !== 0);
      var sType = HEAP32[(((nextInChainPtr)+(8))/4)];
  
      var desc = {
        "label": WebGPU.makeStringFromOptionalStringView(
          descriptor + 8),
        "code": "",
      };
  
      switch (sType) {
        case 2: {
          desc["code"] = WebGPU.makeStringFromStringView(
            nextInChainPtr + 16
          );
          break;
        }
        default: abort('unrecognized ShaderModule sType');
      }
  
      var device = WebGPU.getJsObject(devicePtr);
      WebGPU.Internals.jsObjectInsert(shaderModulePtr, device.createShaderModule(desc));
    ;
  }

  
  var _emwgpuDeviceDestroy = (devicePtr) => {
      const device = WebGPU.getJsObject(devicePtr);
      // Remove the onuncapturederror handler which holds a pointer to the WGPUDevice.
      device.onuncapturederror = null;
      device.destroy()
    };

  
  var emwgpuStringToInt_PreferredFormat = {
              'rgba8unorm': 22,
              'bgra8unorm': 27,
          };
  
  
  var _emwgpuGetPreferredFormat = () => {
      var format = navigator.gpu.getPreferredCanvasFormat();
      return emwgpuStringToInt_PreferredFormat[format];
    };

  
  
  
  
  function _emwgpuInstanceRequestAdapter(instancePtr, futureId, options, adapterPtr) {
    instancePtr = bigintToI53Checked(instancePtr);
    futureId = bigintToI53Checked(futureId);
    options = bigintToI53Checked(options);
    adapterPtr = bigintToI53Checked(adapterPtr);
  
  
      var opts;
      if (options) {
        assert(options);
        opts = {
          "featureLevel": WebGPU.FeatureLevel[HEAP32[(((options)+(8))/4)]],
          "powerPreference": WebGPU.PowerPreference[HEAP32[(((options)+(12))/4)]],
          "forceFallbackAdapter":
            !!(HEAPU32[(((options)+(16))/4)]),
        };
  
        var nextInChainPtr = Number(HEAPU64[((options)/8)]);
        if (nextInChainPtr !== 0) {
          var sType = HEAP32[(((nextInChainPtr)+(8))/4)];
          assert(sType === 11);
          assert(0 === Number(HEAPU64[((nextInChainPtr)/8)]));
          var webxrOptions = nextInChainPtr;
          assert(webxrOptions);assert(Number(HEAPU64[((webxrOptions)/8)]) === 0);
          opts.xrCompatible = !!(HEAPU32[(((webxrOptions)+(16))/4)]);
        }
      }
  
      if (!('gpu' in navigator)) {
        var sp = stackSave();
        var messagePtr = stringToUTF8OnStack('WebGPU not available on this browser (navigator.gpu is not available)');
        _emwgpuOnRequestAdapterCompleted(futureId, 3,
          BigInt(adapterPtr), BigInt(messagePtr));
        stackRestore(sp);
        return;
      }
  
       // requestAdapter
      WebGPU.Internals.futureInsert(futureId, navigator.gpu.requestAdapter(opts).then((adapter) => {
         // requestAdapter fulfilled
        callUserCallback(() => {
          if (adapter) {
            WebGPU.Internals.jsObjectInsert(adapterPtr, adapter);
            _emwgpuOnRequestAdapterCompleted(futureId, 1,
              BigInt(adapterPtr), 0n);
          } else {
            var sp = stackSave();
            var messagePtr = stringToUTF8OnStack('WebGPU not available on this browser (requestAdapter returned null)');
            _emwgpuOnRequestAdapterCompleted(futureId, 3,
              BigInt(adapterPtr), BigInt(messagePtr));
            stackRestore(sp);
          }
        });
      }, (ex) => {
         // requestAdapter rejected
        callUserCallback(() => {
          var sp = stackSave();
          var messagePtr = stringToUTF8OnStack(ex.message);
          _emwgpuOnRequestAdapterCompleted(futureId, 4,
            BigInt(adapterPtr), BigInt(messagePtr));
          stackRestore(sp);
        });
      }));
    ;
  }

  var SYSCALLS = {
  varargs:undefined,
  getStr(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },
  };
  var _fd_close = (fd) => {
      abort('fd_close called without SYSCALLS_REQUIRE_FILESYSTEM');
    };

  function _fd_seek(fd, offset, whence, newOffset) {
    offset = bigintToI53Checked(offset);
    newOffset = bigintToI53Checked(newOffset);
  
  
      return 70;
    ;
  }

  var printCharBuffers = [null,[],[]];
  
  var printChar = (stream, curr) => {
      var buffer = printCharBuffers[stream];
      assert(buffer);
      if (curr === 0 || curr === 10) {
        (stream === 1 ? out : err)(UTF8ArrayToString(buffer));
        buffer.length = 0;
      } else {
        buffer.push(curr);
      }
    };
  
  var flush_NO_FILESYSTEM = () => {
      // flush anything remaining in the buffers during shutdown
      _fflush(0);
      if (printCharBuffers[1].length) printChar(1, 10);
      if (printCharBuffers[2].length) printChar(2, 10);
    };
  
  
  
  function _fd_write(fd, iov, iovcnt, pnum) {
    iov = bigintToI53Checked(iov);
    iovcnt = bigintToI53Checked(iovcnt);
    pnum = bigintToI53Checked(pnum);
  
  
      // hack to support printf in SYSCALLS_REQUIRE_FILESYSTEM=0
      var num = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = Number(HEAPU64[((iov)/8)]);
        var len = Number(HEAPU64[(((iov)+(8))/8)]);
        iov += 16;
        for (var j = 0; j < len; j++) {
          printChar(fd, HEAPU8[ptr+j]);
        }
        num += len;
      }
      HEAPU64[((pnum)/8)] = BigInt(num);
      return 0;
    ;
  }

  
  
  
  var _wgpuCommandEncoderBeginRenderPass = function(encoderPtr, descriptor) {
    encoderPtr = bigintToI53Checked(encoderPtr);
    descriptor = bigintToI53Checked(descriptor);
  
  var ret = (() => { 
      assert(descriptor);
  
      function makeColorAttachment(caPtr) {
        var viewPtr = Number(HEAPU64[(((caPtr)+(8))/8)]);
        if (viewPtr === 0) {
          // Null `view` means no attachment in this slot.
          return undefined;
        }
  
        var depthSlice = HEAPU32[(((caPtr)+(16))/4)];
        if (depthSlice == 0xFFFFFFFF) depthSlice = undefined;
  
        return {
          "view": WebGPU.getJsObject(viewPtr),
          "depthSlice": depthSlice,
          "resolveTarget": WebGPU.getJsObject(
            Number(HEAPU64[(((caPtr)+(24))/8)])),
          "clearValue": WebGPU.makeColor(caPtr + 40),
          "loadOp": WebGPU.LoadOp[HEAP32[(((caPtr)+(32))/4)]],
          "storeOp": WebGPU.StoreOp[HEAP32[(((caPtr)+(36))/4)]],
        };
      }
  
      function makeColorAttachments(count, caPtr) {
        var attachments = [];
        for (var i = 0; i < count; ++i) {
          attachments.push(makeColorAttachment(caPtr + 72 * i));
        }
        return attachments;
      }
  
      function makeDepthStencilAttachment(dsaPtr) {
        if (dsaPtr === 0) return undefined;
  
        return {
          "view": WebGPU.getJsObject(
            Number(HEAPU64[(((dsaPtr)+(8))/8)])),
          "depthClearValue": HEAPF32[(((dsaPtr)+(24))/4)],
          "depthLoadOp": WebGPU.LoadOp[HEAP32[(((dsaPtr)+(16))/4)]],
          "depthStoreOp": WebGPU.StoreOp[HEAP32[(((dsaPtr)+(20))/4)]],
          "depthReadOnly": !!(HEAPU32[(((dsaPtr)+(28))/4)]),
          "stencilClearValue": HEAPU32[(((dsaPtr)+(40))/4)],
          "stencilLoadOp": WebGPU.LoadOp[HEAP32[(((dsaPtr)+(32))/4)]],
          "stencilStoreOp": WebGPU.StoreOp[HEAP32[(((dsaPtr)+(36))/4)]],
          "stencilReadOnly": !!(HEAPU32[(((dsaPtr)+(44))/4)]),
        };
      }
  
      function makeRenderPassDescriptor(descriptor) {
        assert(descriptor);
        var nextInChainPtr = Number(HEAPU64[((descriptor)/8)]);
  
        var maxDrawCount = undefined;
        if (nextInChainPtr !== 0) {
          var sType = HEAP32[(((nextInChainPtr)+(8))/4)];
          assert(sType === 3);
          assert(0 === Number(HEAPU64[((nextInChainPtr)/8)]));
          var renderPassMaxDrawCount = nextInChainPtr;
          assert(renderPassMaxDrawCount);assert(Number(HEAPU64[((renderPassMaxDrawCount)/8)]) === 0);
          // Note: The user could have passed a really huge value here, which is technically valid in
          // C but will not be allowed by WebGPU in JS because of [EnforceRange]. We intentionally
          // ignore that case because it's not useful - apps can just pick a smaller maxDrawCount.
          maxDrawCount = readI53FromI64((renderPassMaxDrawCount)+(16));
        }
  
        var desc = {
          "label": WebGPU.makeStringFromOptionalStringView(
            descriptor + 8),
          "colorAttachments": makeColorAttachments(
            Number(HEAPU64[(((descriptor)+(24))/8)]),
            Number(HEAPU64[(((descriptor)+(32))/8)])),
          "depthStencilAttachment": makeDepthStencilAttachment(
            Number(HEAPU64[(((descriptor)+(40))/8)])),
          "occlusionQuerySet": WebGPU.getJsObject(
            Number(HEAPU64[(((descriptor)+(48))/8)])),
          "timestampWrites": WebGPU.makePassTimestampWrites(
            Number(HEAPU64[(((descriptor)+(56))/8)])),
          "maxDrawCount": maxDrawCount,
        };
        return desc;
      }
  
      var desc = makeRenderPassDescriptor(descriptor);
  
      var commandEncoder = WebGPU.getJsObject(encoderPtr);
      var ptr = _emwgpuCreateRenderPassEncoder(0n);
      WebGPU.Internals.jsObjectInsert(ptr, commandEncoder.beginRenderPass(desc));
      return ptr;
     })();
  return BigInt(ret);
  };

  
  
  
  var _wgpuCommandEncoderFinish = function(encoderPtr, descriptor) {
    encoderPtr = bigintToI53Checked(encoderPtr);
    descriptor = bigintToI53Checked(descriptor);
  
  var ret = (() => { 
      // TODO: Use the descriptor.
      var commandEncoder = WebGPU.getJsObject(encoderPtr);
      var ptr = _emwgpuCreateCommandBuffer(0n);
      WebGPU.Internals.jsObjectInsert(ptr, commandEncoder.finish());
      return ptr;
     })();
  return BigInt(ret);
  };

  
  
  
  var _wgpuDeviceCreateBindGroup = function(devicePtr, descriptor) {
    devicePtr = bigintToI53Checked(devicePtr);
    descriptor = bigintToI53Checked(descriptor);
  
  var ret = (() => { 
      assert(descriptor);assert(Number(HEAPU64[((descriptor)/8)]) === 0);
  
      function makeEntry(entryPtr) {
        assert(entryPtr);
  
        var bufferPtr = Number(HEAPU64[(((entryPtr)+(16))/8)]);
        var samplerPtr = Number(HEAPU64[(((entryPtr)+(40))/8)]);
        var textureViewPtr = Number(HEAPU64[(((entryPtr)+(48))/8)]);
        var externalTexturePtr = 0;
        WebGPU.iterateExtensions(entryPtr, {
          14: (ptr) => {
            externalTexturePtr = Number(HEAPU64[(((ptr)+(16))/8)]);
          },
        });
        assert((bufferPtr !== 0) + (samplerPtr !== 0) + (textureViewPtr !== 0) + (externalTexturePtr !== 0) === 1);
  
        var resource;
        if (bufferPtr) {
          // Note the sentinel UINT64_MAX will be read as -1.
          var size = readI53FromI64((entryPtr)+(32));
          if (size == -1) size = undefined;
  
          resource = {
            "buffer": WebGPU.getJsObject(bufferPtr),
            "offset": readI53FromI64((entryPtr)+(24)),
            "size": size,
          };
        } else {
          resource = WebGPU.getJsObject(samplerPtr || textureViewPtr || externalTexturePtr);
        }
        return {
          "binding": HEAPU32[(((entryPtr)+(8))/4)],
          "resource": resource,
        };
      }
  
      function makeEntries(count, entriesPtrs) {
        var entries = [];
        for (var i = 0; i < count; ++i) {
          entries.push(makeEntry(entriesPtrs +
              56 * i));
        }
        return entries;
      }
  
      var desc = {
        "label": WebGPU.makeStringFromOptionalStringView(
          descriptor + 8),
        "layout": WebGPU.getJsObject(
          Number(HEAPU64[(((descriptor)+(24))/8)])),
        "entries": makeEntries(
          Number(HEAPU64[(((descriptor)+(32))/8)]),
          Number(HEAPU64[(((descriptor)+(40))/8)])
        ),
      };
  
      var device = WebGPU.getJsObject(devicePtr);
      var ptr = _emwgpuCreateBindGroup(0n);
      WebGPU.Internals.jsObjectInsert(ptr, device.createBindGroup(desc));
      return ptr;
     })();
  return BigInt(ret);
  };

  
  
  
  var _wgpuDeviceCreateBindGroupLayout = function(devicePtr, descriptor) {
    devicePtr = bigintToI53Checked(devicePtr);
    descriptor = bigintToI53Checked(descriptor);
  
  var ret = (() => { 
      assert(descriptor);assert(Number(HEAPU64[((descriptor)/8)]) === 0);
  
      function makeBufferEntry(substructPtr) {
        var typeInt =
          HEAPU32[(((substructPtr)+(8))/4)];
        if (!typeInt) return undefined;
  
        return {
          "type": WebGPU.BufferBindingType[typeInt],
          "hasDynamicOffset":
            !!(HEAPU32[(((substructPtr)+(12))/4)]),
          "minBindingSize":
            readI53FromI64((substructPtr)+(16)),
        };
      }
  
      function makeSamplerEntry(substructPtr) {
        var typeInt =
          HEAPU32[(((substructPtr)+(8))/4)];
        if (!typeInt) return undefined;
  
        return {
          "type": WebGPU.SamplerBindingType[typeInt],
        };
      }
  
      function makeTextureEntry(substructPtr) {
        var sampleTypeInt =
          HEAPU32[(((substructPtr)+(8))/4)];
        if (!sampleTypeInt) return undefined;
  
        return {
          "sampleType": WebGPU.TextureSampleType[sampleTypeInt],
          "viewDimension": WebGPU.TextureViewDimension[HEAP32[(((substructPtr)+(12))/4)]],
          "multisampled":
            !!(HEAPU32[(((substructPtr)+(16))/4)]),
        };
      }
  
      function makeStorageTextureEntry(substructPtr) {
        var accessInt =
          HEAPU32[(((substructPtr)+(8))/4)]
        if (!accessInt) return undefined;
  
        return {
          "access": WebGPU.StorageTextureAccess[accessInt],
          "format": WebGPU.TextureFormat[HEAP32[(((substructPtr)+(12))/4)]],
          "viewDimension": WebGPU.TextureViewDimension[HEAP32[(((substructPtr)+(16))/4)]],
        };
      }
  
      function makeEntry(entryPtr) {
        assert(entryPtr);
        // bindingArraySize is not specced and thus not implemented yet. We don't pass it through
        // because if we did, then existing apps using this version of the bindings could break when
        // browsers start accepting bindingArraySize.
        var bindingArraySize = HEAPU32[(((entryPtr)+(24))/4)];
        assert(bindingArraySize == 0 || bindingArraySize == 1);
  
        var entry = {
          "binding":
            HEAPU32[(((entryPtr)+(8))/4)],
          "visibility":
            HEAPU32[(((entryPtr)+(16))/4)],
          "buffer": makeBufferEntry(entryPtr + 32),
          "sampler": makeSamplerEntry(entryPtr + 56),
          "texture": makeTextureEntry(entryPtr + 72),
          "storageTexture": makeStorageTextureEntry(entryPtr + 96),
        };
        WebGPU.iterateExtensions(entryPtr, {
          13: (ptr) => {
            entry["externalTexture"] = {};
          },
        });
        return entry;
      }
  
      function makeEntries(count, entriesPtrs) {
        var entries = [];
        for (var i = 0; i < count; ++i) {
          entries.push(makeEntry(entriesPtrs +
              120 * i));
        }
        return entries;
      }
  
      var desc = {
        "label": WebGPU.makeStringFromOptionalStringView(
          descriptor + 8),
        "entries": makeEntries(
          Number(HEAPU64[(((descriptor)+(24))/8)]),
          Number(HEAPU64[(((descriptor)+(32))/8)])
        ),
      };
  
      var device = WebGPU.getJsObject(devicePtr);
      var ptr = _emwgpuCreateBindGroupLayout(0n);
      WebGPU.Internals.jsObjectInsert(ptr, device.createBindGroupLayout(desc));
      return ptr;
     })();
  return BigInt(ret);
  };

  
  
  
  var _wgpuDeviceCreateCommandEncoder = function(devicePtr, descriptor) {
    devicePtr = bigintToI53Checked(devicePtr);
    descriptor = bigintToI53Checked(descriptor);
  
  var ret = (() => { 
      var desc;
      if (descriptor) {
        assert(descriptor);assert(Number(HEAPU64[((descriptor)/8)]) === 0);
        desc = {
          "label": WebGPU.makeStringFromOptionalStringView(
            descriptor + 8),
        };
      }
      var device = WebGPU.getJsObject(devicePtr);
      var ptr = _emwgpuCreateCommandEncoder(0n);
      WebGPU.Internals.jsObjectInsert(ptr, device.createCommandEncoder(desc));
      return ptr;
     })();
  return BigInt(ret);
  };

  
  
  
  var _wgpuDeviceCreatePipelineLayout = function(devicePtr, descriptor) {
    devicePtr = bigintToI53Checked(devicePtr);
    descriptor = bigintToI53Checked(descriptor);
  
  var ret = (() => { 
      assert(descriptor);assert(Number(HEAPU64[((descriptor)/8)]) === 0);
      var bglCount = Number(HEAPU64[(((descriptor)+(24))/8)]);
      var bglPtr = Number(HEAPU64[(((descriptor)+(32))/8)]);
      var bgls = [];
      for (var i = 0; i < bglCount; ++i) {
        bgls.push(WebGPU.getJsObject(
          Number(HEAPU64[(((bglPtr)+(8 * i))/8)])));
      }
      var desc = {
        "label": WebGPU.makeStringFromOptionalStringView(
          descriptor + 8),
        "bindGroupLayouts": bgls,
        "immediateSize": HEAPU32[(((descriptor)+(40))/4)],
      };
  
      var device = WebGPU.getJsObject(devicePtr);
      var ptr = _emwgpuCreatePipelineLayout(0n);
      WebGPU.Internals.jsObjectInsert(ptr, device.createPipelineLayout(desc));
      return ptr;
     })();
  return BigInt(ret);
  };

  
  
  
  var _wgpuDeviceCreateRenderPipeline = function(devicePtr, descriptor) {
    devicePtr = bigintToI53Checked(devicePtr);
    descriptor = bigintToI53Checked(descriptor);
  
  var ret = (() => { 
      var desc = WebGPU.makeRenderPipelineDesc(descriptor);
      var device = WebGPU.getJsObject(devicePtr);
      var ptr = _emwgpuCreateRenderPipeline(0n);
      WebGPU.Internals.jsObjectInsert(ptr, device.createRenderPipeline(desc));
      return ptr;
     })();
  return BigInt(ret);
  };

  
  
  
  var _wgpuDeviceCreateTexture = function(devicePtr, descriptor) {
    devicePtr = bigintToI53Checked(devicePtr);
    descriptor = bigintToI53Checked(descriptor);
  
  var ret = (() => { 
      assert(descriptor);
      var nextInChainPtr = Number(HEAPU64[((descriptor)/8)]);
  
      var textureBindingViewDimension;
      if (nextInChainPtr !== 0) {
        var sType = HEAP32[(((nextInChainPtr)+(8))/4)];
        assert(sType === 16);
        assert(0 === Number(HEAPU64[((nextInChainPtr)/8)]));
        var textureBindingViewDimensionDescriptor = nextInChainPtr;
        assert(textureBindingViewDimensionDescriptor);assert(Number(HEAPU64[((textureBindingViewDimensionDescriptor)/8)]) === 0);
        textureBindingViewDimension = WebGPU.TextureViewDimension[HEAP32[(((textureBindingViewDimensionDescriptor)+(16))/4)]];
      }
  
      var desc = {
        "label": WebGPU.makeStringFromOptionalStringView(
          descriptor + 8),
        "size": WebGPU.makeExtent3D(descriptor + 36),
        "mipLevelCount": HEAPU32[(((descriptor)+(52))/4)],
        "sampleCount": HEAPU32[(((descriptor)+(56))/4)],
        "dimension": WebGPU.TextureDimension[HEAP32[(((descriptor)+(32))/4)]],
        "format": WebGPU.TextureFormat[HEAP32[(((descriptor)+(48))/4)]],
        "usage": HEAPU32[(((descriptor)+(24))/4)],
        "textureBindingViewDimension": textureBindingViewDimension,
      };
  
      var viewFormatCount = Number(HEAPU64[(((descriptor)+(64))/8)]);
      if (viewFormatCount) {
        var viewFormatsPtr = Number(HEAPU64[(((descriptor)+(72))/8)]);
        // viewFormatsPtr pointer to an array of TextureFormat which is an enum of size uint32_t
        desc['viewFormats'] = Array.from(HEAP32.subarray((((viewFormatsPtr)/4)), ((viewFormatsPtr + viewFormatCount * 4)/4)),
          format => WebGPU.TextureFormat[format]);
      }
  
      var device = WebGPU.getJsObject(devicePtr);
      var ptr = _emwgpuCreateTexture(0n);
      WebGPU.Internals.jsObjectInsert(ptr, device.createTexture(desc));
      return ptr;
     })();
  return BigInt(ret);
  };

  var maybeCStringToJsString = (cString) => {
      // "cString > 2" checks if the input is a number, and isn't of the special
      // values we accept here, EMSCRIPTEN_EVENT_TARGET_* (which map to 0, 1, 2).
      // In other words, if cString > 2 then it's a pointer to a valid place in
      // memory, and points to a C string.
      return cString > 2 ? UTF8ToString(cString) : cString;
    };
  
  /** @type {Object} */
  var specialHTMLTargets = [0, document, window];
  var findEventTarget = (target) => {
      target = maybeCStringToJsString(target);
      var domElement = specialHTMLTargets[target] || document.querySelector(target);
      return domElement;
    };
  var findCanvasEventTarget = findEventTarget;
  
  
  
  
  var _wgpuInstanceCreateSurface = function(instancePtr, descriptor) {
    instancePtr = bigintToI53Checked(instancePtr);
    descriptor = bigintToI53Checked(descriptor);
  
  var ret = (() => { 
      assert(descriptor);
      var nextInChainPtr = Number(HEAPU64[((descriptor)/8)]);
      assert(nextInChainPtr !== 0);
      assert(262144 ===
        HEAP32[(((nextInChainPtr)+(8))/4)]);
      var sourceCanvasHTMLSelector = nextInChainPtr;
  
      assert(sourceCanvasHTMLSelector);assert(Number(HEAPU64[((sourceCanvasHTMLSelector)/8)]) === 0);
      var selectorPtr = Number(HEAPU64[(((sourceCanvasHTMLSelector)+(16))/8)]);
      assert(selectorPtr);
      var canvas = findCanvasEventTarget(selectorPtr);
      var context = canvas.getContext('webgpu');
      assert(context);
      if (!context) return 0n;
  
      context.surfaceLabelWebGPU = WebGPU.makeStringFromOptionalStringView(
        descriptor + 8
      );
  
      var ptr = _emwgpuCreateSurface(0n);
      WebGPU.Internals.jsObjectInsert(ptr, context);
      return ptr;
     })();
  return BigInt(ret);
  };

  
  
  var _wgpuQueueSubmit = function(queuePtr, commandCount, commands) {
    queuePtr = bigintToI53Checked(queuePtr);
    commandCount = bigintToI53Checked(commandCount);
    commands = bigintToI53Checked(commands);
  
  
      assert(commands % 4 === 0);
      var queue = WebGPU.getJsObject(queuePtr);
      var cmds = Array.from(HEAP64.subarray((((commands)/8)), ((commands + commandCount * 8)/8)),
        (id) => WebGPU.getJsObject(id));
      queue.submit(cmds);
    ;
  };

  
  
  function _wgpuQueueWriteBuffer(queuePtr, bufferPtr, bufferOffset, data, size) {
    queuePtr = bigintToI53Checked(queuePtr);
    bufferPtr = bigintToI53Checked(bufferPtr);
    bufferOffset = bigintToI53Checked(bufferOffset);
    data = bigintToI53Checked(data);
    size = bigintToI53Checked(size);
  
  
      var queue = WebGPU.getJsObject(queuePtr);
      var buffer = WebGPU.getJsObject(bufferPtr);
      // There is a size limitation for ArrayBufferView. Work around by passing in a subarray
      // instead of the whole heap. crbug.com/1201109
      var subarray = HEAPU8.subarray(data, data + size);
      queue.writeBuffer(buffer, bufferOffset, subarray, 0, size);
    ;
  }

  
  
  function _wgpuQueueWriteTexture(queuePtr, destinationPtr, data, dataSize, dataLayoutPtr, writeSizePtr) {
    queuePtr = bigintToI53Checked(queuePtr);
    destinationPtr = bigintToI53Checked(destinationPtr);
    data = bigintToI53Checked(data);
    dataSize = bigintToI53Checked(dataSize);
    dataLayoutPtr = bigintToI53Checked(dataLayoutPtr);
    writeSizePtr = bigintToI53Checked(writeSizePtr);
  
  
      var queue = WebGPU.getJsObject(queuePtr);
  
      var destination = WebGPU.makeTexelCopyTextureInfo(destinationPtr);
      var dataLayout = WebGPU.makeTexelCopyBufferLayout(dataLayoutPtr);
      var writeSize = WebGPU.makeExtent3D(writeSizePtr);
      // This subarray isn't strictly necessary, but helps work around an issue
      // where Chromium makes a copy of the entire heap. crbug.com/1134457
      var subarray = HEAPU8.subarray(data, data + dataSize);
      queue.writeTexture(destination, subarray, dataLayout, writeSize);
    ;
  }

  
  
  function _wgpuRenderPassEncoderDraw(passPtr, vertexCount, instanceCount, firstVertex, firstInstance) {
    passPtr = bigintToI53Checked(passPtr);
  
  
      assert(vertexCount >= 0);
      assert(instanceCount >= 0);
      firstVertex >>>= 0;
      firstInstance >>>= 0;
      var pass = WebGPU.getJsObject(passPtr);
      pass.draw(vertexCount, instanceCount, firstVertex, firstInstance);
    ;
  }

  
  
  function _wgpuRenderPassEncoderEnd(encoderPtr) {
    encoderPtr = bigintToI53Checked(encoderPtr);
  
  
      var encoder = WebGPU.getJsObject(encoderPtr);
      encoder.end();
    ;
  }

  
  
  function _wgpuRenderPassEncoderSetBindGroup(passPtr, groupIndex, groupPtr, dynamicOffsetCount, dynamicOffsetsPtr) {
    passPtr = bigintToI53Checked(passPtr);
    groupPtr = bigintToI53Checked(groupPtr);
    dynamicOffsetCount = bigintToI53Checked(dynamicOffsetCount);
    dynamicOffsetsPtr = bigintToI53Checked(dynamicOffsetsPtr);
  
  
      assert(groupIndex >= 0);
      var pass = WebGPU.getJsObject(passPtr);
      var group = WebGPU.getJsObject(groupPtr);
      if (dynamicOffsetCount == 0) {
        pass.setBindGroup(groupIndex, group);
      } else {
        pass.setBindGroup(groupIndex, group, HEAPU32, ((dynamicOffsetsPtr)/4), dynamicOffsetCount);
      }
    ;
  }

  
  
  function _wgpuRenderPassEncoderSetPipeline(passPtr, pipelinePtr) {
    passPtr = bigintToI53Checked(passPtr);
    pipelinePtr = bigintToI53Checked(pipelinePtr);
  
  
      var pass = WebGPU.getJsObject(passPtr);
      var pipeline = WebGPU.getJsObject(pipelinePtr);
      pass.setPipeline(pipeline);
    ;
  }

  
  
  function _wgpuSurfaceConfigure(surfacePtr, config) {
    surfacePtr = bigintToI53Checked(surfacePtr);
    config = bigintToI53Checked(config);
  
  
      assert(config);
      var context = WebGPU.getJsObject(surfacePtr);
  
      var presentMode = HEAPU32[(((config)+(60))/4)];
      assert(presentMode === 1 ||
             presentMode === 0);
  
      var canvasSize = [
        HEAPU32[(((config)+(32))/4)],
        HEAPU32[(((config)+(36))/4)]
      ];
  
      if (canvasSize[0] !== 0) {
        context["canvas"]["width"] = canvasSize[0];
      }
  
      if (canvasSize[1] !== 0) {
        context["canvas"]["height"] = canvasSize[1];
      }
  
      var configuration = {
        "device": WebGPU.getJsObject(Number(HEAPU64[(((config)+(8))/8)])),
        "format": WebGPU.TextureFormat[HEAP32[(((config)+(16))/4)]],
        "usage": HEAPU32[(((config)+(24))/4)],
        "alphaMode": WebGPU.CompositeAlphaMode[HEAP32[(((config)+(56))/4)]],
      };
  
      var viewFormatCount = Number(HEAPU64[(((config)+(40))/8)]);
      if (viewFormatCount) {
        var viewFormatsPtr = Number(HEAPU64[(((config)+(48))/8)]);
        // viewFormatsPtr pointer to an array of TextureFormat which is an enum of size uint32_t
        configuration['viewFormats'] = Array.from(HEAP32.subarray((((viewFormatsPtr)/4)), ((viewFormatsPtr + viewFormatCount * 4)/4)),
          format => WebGPU.TextureFormat[format]);
      }
  
      {
        var nextInChainPtr = Number(HEAPU64[((config)/8)]);
  
        if (nextInChainPtr !== 0) {
          var sType = HEAP32[(((nextInChainPtr)+(8))/4)];
          assert(sType === 10);
          assert(0 === Number(HEAPU64[((nextInChainPtr)/8)]));
          var surfaceColorManagement = nextInChainPtr;
          assert(surfaceColorManagement);assert(Number(HEAPU64[((surfaceColorManagement)/8)]) === 0);
          configuration.colorSpace = WebGPU.PredefinedColorSpace[HEAP32[(((surfaceColorManagement)+(16))/4)]];
          configuration.toneMapping = {
            mode: WebGPU.ToneMappingMode[HEAP32[(((surfaceColorManagement)+(20))/4)]],
          };
        }
      }
  
      context.configure(configuration);
    ;
  }

  
  
  
  function _wgpuSurfaceGetCurrentTexture(surfacePtr, surfaceTexturePtr) {
    surfacePtr = bigintToI53Checked(surfacePtr);
    surfaceTexturePtr = bigintToI53Checked(surfaceTexturePtr);
  
  
      assert(surfaceTexturePtr);
      var context = WebGPU.getJsObject(surfacePtr);
  
      try {
        var texturePtr = _emwgpuCreateTexture(0n);
        WebGPU.Internals.jsObjectInsert(texturePtr, context.getCurrentTexture());
        HEAPU64[(((surfaceTexturePtr)+(8))/8)] = BigInt(texturePtr);
        HEAP32[(((surfaceTexturePtr)+(16))/4)] = 1;
      } catch (ex) {
        err(`wgpuSurfaceGetCurrentTexture() failed: ${ex}`);
        HEAPU64[(((surfaceTexturePtr)+(8))/8)] = 0n;
        HEAP32[(((surfaceTexturePtr)+(16))/4)] = 6;
      }
    ;
  }

  
  
  function _wgpuSurfaceUnconfigure(surfacePtr) {
    surfacePtr = bigintToI53Checked(surfacePtr);
  
  
      var context = WebGPU.getJsObject(surfacePtr);
      context.unconfigure();
    ;
  }

  
  
  
  var _wgpuTextureCreateView = function(texturePtr, descriptor) {
    texturePtr = bigintToI53Checked(texturePtr);
    descriptor = bigintToI53Checked(descriptor);
  
  var ret = (() => { 
      var desc;
      if (descriptor) {
        var swizzle;
        var nextInChainPtr = Number(HEAPU64[((descriptor)/8)]);
        if (nextInChainPtr !== 0) {
          var sType = HEAP32[(((nextInChainPtr)+(8))/4)];
          assert(sType === 12);
          assert(0 === Number(HEAPU64[((nextInChainPtr)/8)]));
          var swizzleDescriptor = nextInChainPtr;
          assert(swizzleDescriptor);assert(Number(HEAPU64[((swizzleDescriptor)/8)]) === 0);
          var swizzlePtr = swizzleDescriptor + 16;
          var r = WebGPU.ComponentSwizzle[HEAP32[((swizzlePtr)/4)]] || 'r';
          var g = WebGPU.ComponentSwizzle[HEAP32[(((swizzlePtr)+(4))/4)]] || 'g';
          var b = WebGPU.ComponentSwizzle[HEAP32[(((swizzlePtr)+(8))/4)]] || 'b';
          var a = WebGPU.ComponentSwizzle[HEAP32[(((swizzlePtr)+(12))/4)]] || 'a';
          swizzle = `${r}${g}${b}${a}`;
        }
  
        var mipLevelCount = HEAPU32[(((descriptor)+(36))/4)];
        var arrayLayerCount = HEAPU32[(((descriptor)+(44))/4)];
        desc = {
          "label": WebGPU.makeStringFromOptionalStringView(
            descriptor + 8),
          "format": WebGPU.TextureFormat[HEAP32[(((descriptor)+(24))/4)]],
          "dimension": WebGPU.TextureViewDimension[HEAP32[(((descriptor)+(28))/4)]],
          "baseMipLevel": HEAPU32[(((descriptor)+(32))/4)],
          "mipLevelCount": mipLevelCount === 4294967295 ? undefined : mipLevelCount,
          "baseArrayLayer": HEAPU32[(((descriptor)+(40))/4)],
          "arrayLayerCount": arrayLayerCount === 4294967295 ? undefined : arrayLayerCount,
          "aspect": WebGPU.TextureAspect[HEAP32[(((descriptor)+(48))/4)]],
          "usage": HEAPU32[(((descriptor)+(56))/4)],
          "swizzle": swizzle,
        };
      }
  
      var texture = WebGPU.getJsObject(texturePtr);
      var ptr = _emwgpuCreateTextureView(0n);
      WebGPU.Internals.jsObjectInsert(ptr, texture.createView(desc));
      return ptr;
     })();
  return BigInt(ret);
  };

  
  
  function _wgpuTextureDestroy(texturePtr) {
    texturePtr = bigintToI53Checked(texturePtr);
  
  
      WebGPU.getJsObject(texturePtr).destroy();
    ;
  }


// End JS library code

// include: postlibrary.js
// This file is included after the automatically-generated JS library code
// but before the wasm module is created.

{

  // Begin ATMODULES hooks
  if (Module['noExitRuntime']) noExitRuntime = Module['noExitRuntime'];
if (Module['print']) out = Module['print'];
if (Module['printErr']) err = Module['printErr'];
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];

Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;

  // End ATMODULES hooks

  checkIncomingModuleAPI();

  if (Module['arguments']) arguments_ = Module['arguments'];
  if (Module['thisProgram']) thisProgram = Module['thisProgram'];

  // Assertions on removed incoming Module JS APIs.
  assert(typeof Module['memoryInitializerPrefixURL'] == 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['pthreadMainPrefixURL'] == 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['cdInitializerPrefixURL'] == 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['filePackagePrefixURL'] == 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['read'] == 'undefined', 'Module.read option was removed');
  assert(typeof Module['readAsync'] == 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
  assert(typeof Module['readBinary'] == 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
  assert(typeof Module['setWindowTitle'] == 'undefined', 'Module.setWindowTitle option was removed (modify emscripten_set_window_title in JS)');
  assert(typeof Module['TOTAL_MEMORY'] == 'undefined', 'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY');
  assert(typeof Module['ENVIRONMENT'] == 'undefined', 'Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)');
  assert(typeof Module['STACK_SIZE'] == 'undefined', 'STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time')
  // If memory is defined in wasm, the user can't provide it, or set INITIAL_MEMORY
  assert(typeof Module['wasmMemory'] == 'undefined', 'Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally');
  assert(typeof Module['INITIAL_MEMORY'] == 'undefined', 'Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically');

  if (Module['preInit']) {
    if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
    while (Module['preInit'].length > 0) {
      Module['preInit'].shift()();
    }
  }
  consumedModuleProp('preInit');
}

// Begin runtime exports
  Module['UTF8ToString'] = UTF8ToString;
  var missingLibrarySymbols = [
  'writeI53ToI64Clamped',
  'writeI53ToI64Signaling',
  'writeI53ToU64Clamped',
  'writeI53ToU64Signaling',
  'convertI32PairToI53',
  'convertI32PairToI53Checked',
  'convertU32PairToI53',
  'getTempRet0',
  'setTempRet0',
  'createNamedFunction',
  'zeroMemory',
  'getHeapMax',
  'growMemory',
  'withStackSave',
  'strError',
  'inetPton4',
  'inetNtop4',
  'inetPton6',
  'inetNtop6',
  'readSockaddr',
  'writeSockaddr',
  'runMainThreadEmAsm',
  'jstoi_q',
  'getExecutableName',
  'autoResumeAudioContext',
  'getDynCaller',
  'dynCall',
  'runtimeKeepalivePush',
  'runtimeKeepalivePop',
  'asyncLoad',
  'asmjsMangle',
  'alignMemory',
  'mmapAlloc',
  'HandleAllocator',
  'getUniqueRunDependency',
  'addRunDependency',
  'removeRunDependency',
  'addOnInit',
  'addOnPostCtor',
  'addOnPreMain',
  'addOnExit',
  'STACK_SIZE',
  'STACK_ALIGN',
  'POINTER_SIZE',
  'ASSERTIONS',
  'ccall',
  'cwrap',
  'convertJsFunctionToWasm',
  'getEmptyTableSlot',
  'updateTableMap',
  'getFunctionAddress',
  'addFunction',
  'removeFunction',
  'intArrayFromString',
  'intArrayToString',
  'AsciiToString',
  'stringToAscii',
  'UTF16ToString',
  'stringToUTF16',
  'lengthBytesUTF16',
  'UTF32ToString',
  'stringToUTF32',
  'lengthBytesUTF32',
  'writeArrayToMemory',
  'registerKeyEventCallback',
  'getBoundingClientRect',
  'fillMouseEventData',
  'registerMouseEventCallback',
  'registerWheelEventCallback',
  'registerUiEventCallback',
  'registerFocusEventCallback',
  'fillDeviceOrientationEventData',
  'registerDeviceOrientationEventCallback',
  'fillDeviceMotionEventData',
  'registerDeviceMotionEventCallback',
  'screenOrientation',
  'fillOrientationChangeEventData',
  'registerOrientationChangeEventCallback',
  'fillFullscreenChangeEventData',
  'registerFullscreenChangeEventCallback',
  'JSEvents_requestFullscreen',
  'JSEvents_resizeCanvasForFullscreen',
  'registerRestoreOldStyle',
  'hideEverythingExceptGivenElement',
  'restoreHiddenElements',
  'setLetterbox',
  'softFullscreenResizeWebGLRenderTarget',
  'doRequestFullscreen',
  'fillPointerlockChangeEventData',
  'registerPointerlockChangeEventCallback',
  'registerPointerlockErrorEventCallback',
  'requestPointerLock',
  'fillVisibilityChangeEventData',
  'registerVisibilityChangeEventCallback',
  'registerTouchEventCallback',
  'fillGamepadEventData',
  'registerGamepadEventCallback',
  'registerBeforeUnloadEventCallback',
  'fillBatteryEventData',
  'registerBatteryEventCallback',
  'setCanvasElementSize',
  'getCanvasElementSize',
  'jsStackTrace',
  'getCallstack',
  'convertPCtoSourceLocation',
  'getEnvStrings',
  'checkWasiClock',
  'wasiRightsToMuslOFlags',
  'wasiOFlagsToMuslOFlags',
  'initRandomFill',
  'randomFill',
  'safeSetTimeout',
  'setImmediateWrapped',
  'safeRequestAnimationFrame',
  'clearImmediateWrapped',
  'registerPostMainLoop',
  'registerPreMainLoop',
  'getPromise',
  'makePromise',
  'idsToPromises',
  'makePromiseCallback',
  'ExceptionInfo',
  'findMatchingCatch',
  'incrementUncaughtExceptionCount',
  'decrementUncaughtExceptionCount',
  'Browser_asyncPrepareDataCounter',
  'isLeapYear',
  'ydayFromDate',
  'arraySum',
  'addDays',
  'getSocketFromFD',
  'getSocketAddress',
  'FS_createPreloadedFile',
  'FS_preloadFile',
  'FS_modeStringToFlags',
  'FS_getMode',
  'FS_fileDataToTypedArray',
  'FS_stdin_getChar',
  'FS_mkdirTree',
  '_setNetworkCallback',
  'heapObjectForWebGLType',
  'toTypedArrayIndex',
  'webgl_enable_ANGLE_instanced_arrays',
  'webgl_enable_OES_vertex_array_object',
  'webgl_enable_WEBGL_draw_buffers',
  'webgl_enable_WEBGL_multi_draw',
  'webgl_enable_EXT_polygon_offset_clamp',
  'webgl_enable_EXT_clip_control',
  'webgl_enable_WEBGL_polygon_mode',
  'emscriptenWebGLGet',
  'computeUnpackAlignedImageSize',
  'colorChannelsInGlTextureFormat',
  'emscriptenWebGLGetTexPixelData',
  'emscriptenWebGLGetUniform',
  'webglGetUniformLocation',
  'webglPrepareUniformLocationsBeforeFirstUse',
  'webglGetLeftBracePos',
  'emscriptenWebGLGetVertexAttrib',
  '__glGetActiveAttribOrUniform',
  'writeGLArray',
  'registerWebGlEventCallback',
  'runAndAbortIfError',
  'ALLOC_NORMAL',
  'ALLOC_STACK',
  'allocate',
  'writeStringToMemory',
  'writeAsciiToMemory',
  'allocateUTF8',
  'allocateUTF8OnStack',
  'demangle',
  'stackTrace',
  'getNativeTypeSize',
];
missingLibrarySymbols.forEach(missingLibrarySymbol)

  var unexportedSymbols = [
  'run',
  'out',
  'err',
  'callMain',
  'abort',
  'wasmExports',
  'writeStackCookie',
  'checkStackCookie',
  'writeI53ToI64',
  'readI53FromI64',
  'readI53FromU64',
  'INT53_MAX',
  'INT53_MIN',
  'bigintToI53Checked',
  'HEAP8',
  'HEAP16',
  'HEAPU16',
  'HEAP32',
  'HEAPU32',
  'HEAPF32',
  'HEAPF64',
  'HEAP64',
  'HEAPU64',
  'stackSave',
  'stackRestore',
  'stackAlloc',
  'ptrToString',
  'exitJS',
  'abortOnCannotGrowMemory',
  'ENV',
  'ERRNO_CODES',
  'DNS',
  'Protocols',
  'Sockets',
  'timers',
  'warnOnce',
  'readEmAsmArgsArray',
  'readEmAsmArgs',
  'runEmAsmFunction',
  'handleException',
  'keepRuntimeAlive',
  'callUserCallback',
  'maybeExit',
  'wasmTable',
  'wasmMemory',
  'noExitRuntime',
  'addOnPreRun',
  'addOnPostRun',
  'freeTableIndexes',
  'functionsInTableMap',
  'setValue',
  'getValue',
  'PATH',
  'PATH_FS',
  'UTF8Decoder',
  'UTF8ArrayToString',
  'stringToUTF8Array',
  'stringToUTF8',
  'lengthBytesUTF8',
  'UTF16Decoder',
  'stringToNewUTF8',
  'stringToUTF8OnStack',
  'JSEvents',
  'specialHTMLTargets',
  'maybeCStringToJsString',
  'findEventTarget',
  'findCanvasEventTarget',
  'currentFullscreenStrategy',
  'restoreOldWindowedStyle',
  'UNWIND_CACHE',
  'ExitStatus',
  'flush_NO_FILESYSTEM',
  'emSetImmediate',
  'emClearImmediate_deps',
  'emClearImmediate',
  'promiseMap',
  'uncaughtExceptionCount',
  'exceptionCaught',
  'Browser',
  'requestFullscreen',
  'requestFullScreen',
  'setCanvasSize',
  'getUserMedia',
  'createContext',
  'getPreloadedImageData__data',
  'wget',
  'MONTH_DAYS_REGULAR',
  'MONTH_DAYS_LEAP',
  'MONTH_DAYS_REGULAR_CUMULATIVE',
  'MONTH_DAYS_LEAP_CUMULATIVE',
  'SYSCALLS',
  'preloadPlugins',
  'FS_stdin_getChar_buffer',
  'FS_unlink',
  'FS_createPath',
  'FS_createDevice',
  'FS_readFile',
  'FS',
  'FS_root',
  'FS_mounts',
  'FS_devices',
  'FS_streams',
  'FS_nextInode',
  'FS_nameTable',
  'FS_currentPath',
  'FS_initialized',
  'FS_ignorePermissions',
  'FS_filesystems',
  'FS_syncFSRequests',
  'FS_lookupPath',
  'FS_getPath',
  'FS_hashName',
  'FS_hashAddNode',
  'FS_hashRemoveNode',
  'FS_lookupNode',
  'FS_createNode',
  'FS_destroyNode',
  'FS_isRoot',
  'FS_isMountpoint',
  'FS_isFile',
  'FS_isDir',
  'FS_isLink',
  'FS_isChrdev',
  'FS_isBlkdev',
  'FS_isFIFO',
  'FS_isSocket',
  'FS_flagsToPermissionString',
  'FS_nodePermissions',
  'FS_mayLookup',
  'FS_mayCreate',
  'FS_mayDelete',
  'FS_mayOpen',
  'FS_checkOpExists',
  'FS_nextfd',
  'FS_getStreamChecked',
  'FS_getStream',
  'FS_createStream',
  'FS_closeStream',
  'FS_dupStream',
  'FS_doSetAttr',
  'FS_chrdev_stream_ops',
  'FS_major',
  'FS_minor',
  'FS_makedev',
  'FS_registerDevice',
  'FS_getDevice',
  'FS_getMounts',
  'FS_syncfs',
  'FS_mount',
  'FS_unmount',
  'FS_lookup',
  'FS_mknod',
  'FS_statfs',
  'FS_statfsStream',
  'FS_statfsNode',
  'FS_create',
  'FS_mkdir',
  'FS_mkdev',
  'FS_symlink',
  'FS_rename',
  'FS_rmdir',
  'FS_readdir',
  'FS_readlink',
  'FS_stat',
  'FS_fstat',
  'FS_lstat',
  'FS_doChmod',
  'FS_chmod',
  'FS_lchmod',
  'FS_fchmod',
  'FS_doChown',
  'FS_chown',
  'FS_lchown',
  'FS_fchown',
  'FS_doTruncate',
  'FS_truncate',
  'FS_ftruncate',
  'FS_utime',
  'FS_open',
  'FS_close',
  'FS_isClosed',
  'FS_llseek',
  'FS_read',
  'FS_write',
  'FS_mmap',
  'FS_msync',
  'FS_ioctl',
  'FS_writeFile',
  'FS_cwd',
  'FS_chdir',
  'FS_createDefaultDirectories',
  'FS_createDefaultDevices',
  'FS_createSpecialDirectories',
  'FS_createStandardStreams',
  'FS_staticInit',
  'FS_init',
  'FS_quit',
  'FS_findObject',
  'FS_analyzePath',
  'FS_createFile',
  'FS_createDataFile',
  'FS_forceLoadFile',
  'FS_createLazyFile',
  'MEMFS',
  'TTY',
  'PIPEFS',
  'SOCKFS',
  'tempFixedLengthArray',
  'miniTempWebGLFloatBuffers',
  'miniTempWebGLIntBuffers',
  'GL',
  'AL',
  'GLUT',
  'EGL',
  'GLEW',
  'IDBStore',
  'SDL',
  'SDL_gfx',
  'print',
  'printErr',
  'jstoi_s',
  'WebGPU',
  'emwgpuStringToInt_BufferMapState',
  'emwgpuStringToInt_CompilationMessageType',
  'emwgpuStringToInt_DeviceLostReason',
  'emwgpuStringToInt_FeatureName',
  'emwgpuStringToInt_PreferredFormat',
];
unexportedSymbols.forEach(unexportedRuntimeSymbol);

  // End runtime exports
  // Begin JS library exports
  // End JS library exports

// end include: postlibrary.js

function checkIncomingModuleAPI() {
  ignoredModuleProp('fetchSettings');
  ignoredModuleProp('logReadFiles');
  ignoredModuleProp('loadSplitModule');
  ignoredModuleProp('onMalloc');
  ignoredModuleProp('onRealloc');
  ignoredModuleProp('onFree');
  ignoredModuleProp('onSbrkGrow');
}
var ASM_CONSTS = {
  73120: ($0) => { Module['onNrxFailure']?.(UTF8ToString(Number($0))); }
};

// Imports from the Wasm binary.
var _nrx_source_ptr = Module['_nrx_source_ptr'] = makeInvalidEarlyAccess('_nrx_source_ptr');
var _nrx_mask_ptr = Module['_nrx_mask_ptr'] = makeInvalidEarlyAccess('_nrx_mask_ptr');
var _nrx_shader_ptr = Module['_nrx_shader_ptr'] = makeInvalidEarlyAccess('_nrx_shader_ptr');
var _nrx_uniform_ptr = Module['_nrx_uniform_ptr'] = makeInvalidEarlyAccess('_nrx_uniform_ptr');
var _nrx_error_ptr = Module['_nrx_error_ptr'] = makeInvalidEarlyAccess('_nrx_error_ptr');
var _nrx_state = Module['_nrx_state'] = makeInvalidEarlyAccess('_nrx_state');
var _nrx_submissions = Module['_nrx_submissions'] = makeInvalidEarlyAccess('_nrx_submissions');
var _nrx_init = Module['_nrx_init'] = makeInvalidEarlyAccess('_nrx_init');
var _nrx_publish = Module['_nrx_publish'] = makeInvalidEarlyAccess('_nrx_publish');
var _nrx_draw = Module['_nrx_draw'] = makeInvalidEarlyAccess('_nrx_draw');
var _nrx_dispose = Module['_nrx_dispose'] = makeInvalidEarlyAccess('_nrx_dispose');
var _emwgpuCreateBindGroup = makeInvalidEarlyAccess('_emwgpuCreateBindGroup');
var _emwgpuCreateBindGroupLayout = makeInvalidEarlyAccess('_emwgpuCreateBindGroupLayout');
var _emwgpuCreateCommandBuffer = makeInvalidEarlyAccess('_emwgpuCreateCommandBuffer');
var _emwgpuCreateCommandEncoder = makeInvalidEarlyAccess('_emwgpuCreateCommandEncoder');
var _emwgpuCreateComputePassEncoder = makeInvalidEarlyAccess('_emwgpuCreateComputePassEncoder');
var _emwgpuCreateComputePipeline = makeInvalidEarlyAccess('_emwgpuCreateComputePipeline');
var _emwgpuCreateExternalTexture = makeInvalidEarlyAccess('_emwgpuCreateExternalTexture');
var _emwgpuCreatePipelineLayout = makeInvalidEarlyAccess('_emwgpuCreatePipelineLayout');
var _emwgpuCreateQuerySet = makeInvalidEarlyAccess('_emwgpuCreateQuerySet');
var _emwgpuCreateRenderBundle = makeInvalidEarlyAccess('_emwgpuCreateRenderBundle');
var _emwgpuCreateRenderBundleEncoder = makeInvalidEarlyAccess('_emwgpuCreateRenderBundleEncoder');
var _emwgpuCreateRenderPassEncoder = makeInvalidEarlyAccess('_emwgpuCreateRenderPassEncoder');
var _emwgpuCreateRenderPipeline = makeInvalidEarlyAccess('_emwgpuCreateRenderPipeline');
var _emwgpuCreateSampler = makeInvalidEarlyAccess('_emwgpuCreateSampler');
var _emwgpuCreateSurface = makeInvalidEarlyAccess('_emwgpuCreateSurface');
var _emwgpuCreateTexture = makeInvalidEarlyAccess('_emwgpuCreateTexture');
var _emwgpuCreateTextureView = makeInvalidEarlyAccess('_emwgpuCreateTextureView');
var _emwgpuCreateAdapter = makeInvalidEarlyAccess('_emwgpuCreateAdapter');
var _emwgpuImportBuffer = makeInvalidEarlyAccess('_emwgpuImportBuffer');
var _emwgpuCreateDevice = makeInvalidEarlyAccess('_emwgpuCreateDevice');
var _emwgpuCreateQueue = makeInvalidEarlyAccess('_emwgpuCreateQueue');
var _emwgpuCreateShaderModule = makeInvalidEarlyAccess('_emwgpuCreateShaderModule');
var _emwgpuOnCompilationInfoCompleted = makeInvalidEarlyAccess('_emwgpuOnCompilationInfoCompleted');
var _emwgpuOnCreateComputePipelineCompleted = makeInvalidEarlyAccess('_emwgpuOnCreateComputePipelineCompleted');
var _emwgpuOnCreateRenderPipelineCompleted = makeInvalidEarlyAccess('_emwgpuOnCreateRenderPipelineCompleted');
var _emwgpuOnDeviceLostCompleted = makeInvalidEarlyAccess('_emwgpuOnDeviceLostCompleted');
var _emwgpuOnMapAsyncCompleted = makeInvalidEarlyAccess('_emwgpuOnMapAsyncCompleted');
var _emwgpuOnPopErrorScopeCompleted = makeInvalidEarlyAccess('_emwgpuOnPopErrorScopeCompleted');
var _emwgpuOnRequestAdapterCompleted = makeInvalidEarlyAccess('_emwgpuOnRequestAdapterCompleted');
var _emwgpuOnRequestDeviceCompleted = makeInvalidEarlyAccess('_emwgpuOnRequestDeviceCompleted');
var _emwgpuOnWorkDoneCompleted = makeInvalidEarlyAccess('_emwgpuOnWorkDoneCompleted');
var _emwgpuOnUncapturedError = makeInvalidEarlyAccess('_emwgpuOnUncapturedError');
var _free = makeInvalidEarlyAccess('_free');
var _fflush = makeInvalidEarlyAccess('_fflush');
var _strerror = makeInvalidEarlyAccess('_strerror');
var _emscripten_stack_get_end = makeInvalidEarlyAccess('_emscripten_stack_get_end');
var _emscripten_stack_get_base = makeInvalidEarlyAccess('_emscripten_stack_get_base');
var _malloc = makeInvalidEarlyAccess('_malloc');
var _memalign = makeInvalidEarlyAccess('_memalign');
var _emscripten_stack_init = makeInvalidEarlyAccess('_emscripten_stack_init');
var _emscripten_stack_get_free = makeInvalidEarlyAccess('_emscripten_stack_get_free');
var __emscripten_stack_restore = makeInvalidEarlyAccess('__emscripten_stack_restore');
var __emscripten_stack_alloc = makeInvalidEarlyAccess('__emscripten_stack_alloc');
var _emscripten_stack_get_current = makeInvalidEarlyAccess('_emscripten_stack_get_current');
var memory = makeInvalidEarlyAccess('memory');
var __indirect_function_table = makeInvalidEarlyAccess('__indirect_function_table');
var wasmMemory = makeInvalidEarlyAccess('wasmMemory');
var wasmTable = makeInvalidEarlyAccess('wasmTable');

function assignWasmExports(wasmExports) {
  assert(typeof wasmExports['nrx_source_ptr'] != 'undefined', 'missing Wasm export: nrx_source_ptr');
  assert(typeof wasmExports['nrx_mask_ptr'] != 'undefined', 'missing Wasm export: nrx_mask_ptr');
  assert(typeof wasmExports['nrx_shader_ptr'] != 'undefined', 'missing Wasm export: nrx_shader_ptr');
  assert(typeof wasmExports['nrx_uniform_ptr'] != 'undefined', 'missing Wasm export: nrx_uniform_ptr');
  assert(typeof wasmExports['nrx_error_ptr'] != 'undefined', 'missing Wasm export: nrx_error_ptr');
  assert(typeof wasmExports['nrx_state'] != 'undefined', 'missing Wasm export: nrx_state');
  assert(typeof wasmExports['nrx_submissions'] != 'undefined', 'missing Wasm export: nrx_submissions');
  assert(typeof wasmExports['nrx_init'] != 'undefined', 'missing Wasm export: nrx_init');
  assert(typeof wasmExports['nrx_publish'] != 'undefined', 'missing Wasm export: nrx_publish');
  assert(typeof wasmExports['nrx_draw'] != 'undefined', 'missing Wasm export: nrx_draw');
  assert(typeof wasmExports['nrx_dispose'] != 'undefined', 'missing Wasm export: nrx_dispose');
  assert(typeof wasmExports['emwgpuCreateBindGroup'] != 'undefined', 'missing Wasm export: emwgpuCreateBindGroup');
  assert(typeof wasmExports['emwgpuCreateBindGroupLayout'] != 'undefined', 'missing Wasm export: emwgpuCreateBindGroupLayout');
  assert(typeof wasmExports['emwgpuCreateCommandBuffer'] != 'undefined', 'missing Wasm export: emwgpuCreateCommandBuffer');
  assert(typeof wasmExports['emwgpuCreateCommandEncoder'] != 'undefined', 'missing Wasm export: emwgpuCreateCommandEncoder');
  assert(typeof wasmExports['emwgpuCreateComputePassEncoder'] != 'undefined', 'missing Wasm export: emwgpuCreateComputePassEncoder');
  assert(typeof wasmExports['emwgpuCreateComputePipeline'] != 'undefined', 'missing Wasm export: emwgpuCreateComputePipeline');
  assert(typeof wasmExports['emwgpuCreateExternalTexture'] != 'undefined', 'missing Wasm export: emwgpuCreateExternalTexture');
  assert(typeof wasmExports['emwgpuCreatePipelineLayout'] != 'undefined', 'missing Wasm export: emwgpuCreatePipelineLayout');
  assert(typeof wasmExports['emwgpuCreateQuerySet'] != 'undefined', 'missing Wasm export: emwgpuCreateQuerySet');
  assert(typeof wasmExports['emwgpuCreateRenderBundle'] != 'undefined', 'missing Wasm export: emwgpuCreateRenderBundle');
  assert(typeof wasmExports['emwgpuCreateRenderBundleEncoder'] != 'undefined', 'missing Wasm export: emwgpuCreateRenderBundleEncoder');
  assert(typeof wasmExports['emwgpuCreateRenderPassEncoder'] != 'undefined', 'missing Wasm export: emwgpuCreateRenderPassEncoder');
  assert(typeof wasmExports['emwgpuCreateRenderPipeline'] != 'undefined', 'missing Wasm export: emwgpuCreateRenderPipeline');
  assert(typeof wasmExports['emwgpuCreateSampler'] != 'undefined', 'missing Wasm export: emwgpuCreateSampler');
  assert(typeof wasmExports['emwgpuCreateSurface'] != 'undefined', 'missing Wasm export: emwgpuCreateSurface');
  assert(typeof wasmExports['emwgpuCreateTexture'] != 'undefined', 'missing Wasm export: emwgpuCreateTexture');
  assert(typeof wasmExports['emwgpuCreateTextureView'] != 'undefined', 'missing Wasm export: emwgpuCreateTextureView');
  assert(typeof wasmExports['emwgpuCreateAdapter'] != 'undefined', 'missing Wasm export: emwgpuCreateAdapter');
  assert(typeof wasmExports['emwgpuImportBuffer'] != 'undefined', 'missing Wasm export: emwgpuImportBuffer');
  assert(typeof wasmExports['emwgpuCreateDevice'] != 'undefined', 'missing Wasm export: emwgpuCreateDevice');
  assert(typeof wasmExports['emwgpuCreateQueue'] != 'undefined', 'missing Wasm export: emwgpuCreateQueue');
  assert(typeof wasmExports['emwgpuCreateShaderModule'] != 'undefined', 'missing Wasm export: emwgpuCreateShaderModule');
  assert(typeof wasmExports['emwgpuOnCompilationInfoCompleted'] != 'undefined', 'missing Wasm export: emwgpuOnCompilationInfoCompleted');
  assert(typeof wasmExports['emwgpuOnCreateComputePipelineCompleted'] != 'undefined', 'missing Wasm export: emwgpuOnCreateComputePipelineCompleted');
  assert(typeof wasmExports['emwgpuOnCreateRenderPipelineCompleted'] != 'undefined', 'missing Wasm export: emwgpuOnCreateRenderPipelineCompleted');
  assert(typeof wasmExports['emwgpuOnDeviceLostCompleted'] != 'undefined', 'missing Wasm export: emwgpuOnDeviceLostCompleted');
  assert(typeof wasmExports['emwgpuOnMapAsyncCompleted'] != 'undefined', 'missing Wasm export: emwgpuOnMapAsyncCompleted');
  assert(typeof wasmExports['emwgpuOnPopErrorScopeCompleted'] != 'undefined', 'missing Wasm export: emwgpuOnPopErrorScopeCompleted');
  assert(typeof wasmExports['emwgpuOnRequestAdapterCompleted'] != 'undefined', 'missing Wasm export: emwgpuOnRequestAdapterCompleted');
  assert(typeof wasmExports['emwgpuOnRequestDeviceCompleted'] != 'undefined', 'missing Wasm export: emwgpuOnRequestDeviceCompleted');
  assert(typeof wasmExports['emwgpuOnWorkDoneCompleted'] != 'undefined', 'missing Wasm export: emwgpuOnWorkDoneCompleted');
  assert(typeof wasmExports['emwgpuOnUncapturedError'] != 'undefined', 'missing Wasm export: emwgpuOnUncapturedError');
  assert(typeof wasmExports['free'] != 'undefined', 'missing Wasm export: free');
  assert(typeof wasmExports['fflush'] != 'undefined', 'missing Wasm export: fflush');
  assert(typeof wasmExports['strerror'] != 'undefined', 'missing Wasm export: strerror');
  assert(typeof wasmExports['emscripten_stack_get_end'] != 'undefined', 'missing Wasm export: emscripten_stack_get_end');
  assert(typeof wasmExports['emscripten_stack_get_base'] != 'undefined', 'missing Wasm export: emscripten_stack_get_base');
  assert(typeof wasmExports['malloc'] != 'undefined', 'missing Wasm export: malloc');
  assert(typeof wasmExports['memalign'] != 'undefined', 'missing Wasm export: memalign');
  assert(typeof wasmExports['emscripten_stack_init'] != 'undefined', 'missing Wasm export: emscripten_stack_init');
  assert(typeof wasmExports['emscripten_stack_get_free'] != 'undefined', 'missing Wasm export: emscripten_stack_get_free');
  assert(typeof wasmExports['_emscripten_stack_restore'] != 'undefined', 'missing Wasm export: _emscripten_stack_restore');
  assert(typeof wasmExports['_emscripten_stack_alloc'] != 'undefined', 'missing Wasm export: _emscripten_stack_alloc');
  assert(typeof wasmExports['emscripten_stack_get_current'] != 'undefined', 'missing Wasm export: emscripten_stack_get_current');
  assert(typeof wasmExports['memory'] != 'undefined', 'missing Wasm export: memory');
  assert(typeof wasmExports['__indirect_function_table'] != 'undefined', 'missing Wasm export: __indirect_function_table');
  _nrx_source_ptr = Module['_nrx_source_ptr'] = createExportWrapper('nrx_source_ptr', 0);
  _nrx_mask_ptr = Module['_nrx_mask_ptr'] = createExportWrapper('nrx_mask_ptr', 0);
  _nrx_shader_ptr = Module['_nrx_shader_ptr'] = createExportWrapper('nrx_shader_ptr', 0);
  _nrx_uniform_ptr = Module['_nrx_uniform_ptr'] = createExportWrapper('nrx_uniform_ptr', 0);
  _nrx_error_ptr = Module['_nrx_error_ptr'] = createExportWrapper('nrx_error_ptr', 0);
  _nrx_state = Module['_nrx_state'] = createExportWrapper('nrx_state', 0);
  _nrx_submissions = Module['_nrx_submissions'] = createExportWrapper('nrx_submissions', 0);
  _nrx_init = Module['_nrx_init'] = createExportWrapper('nrx_init', 0);
  _nrx_publish = Module['_nrx_publish'] = createExportWrapper('nrx_publish', 2);
  _nrx_draw = Module['_nrx_draw'] = createExportWrapper('nrx_draw', 2);
  _nrx_dispose = Module['_nrx_dispose'] = createExportWrapper('nrx_dispose', 0);
  _emwgpuCreateBindGroup = createExportWrapper('emwgpuCreateBindGroup', 1);
  _emwgpuCreateBindGroupLayout = createExportWrapper('emwgpuCreateBindGroupLayout', 1);
  _emwgpuCreateCommandBuffer = createExportWrapper('emwgpuCreateCommandBuffer', 1);
  _emwgpuCreateCommandEncoder = createExportWrapper('emwgpuCreateCommandEncoder', 1);
  _emwgpuCreateComputePassEncoder = createExportWrapper('emwgpuCreateComputePassEncoder', 1);
  _emwgpuCreateComputePipeline = createExportWrapper('emwgpuCreateComputePipeline', 1);
  _emwgpuCreateExternalTexture = createExportWrapper('emwgpuCreateExternalTexture', 1);
  _emwgpuCreatePipelineLayout = createExportWrapper('emwgpuCreatePipelineLayout', 1);
  _emwgpuCreateQuerySet = createExportWrapper('emwgpuCreateQuerySet', 1);
  _emwgpuCreateRenderBundle = createExportWrapper('emwgpuCreateRenderBundle', 1);
  _emwgpuCreateRenderBundleEncoder = createExportWrapper('emwgpuCreateRenderBundleEncoder', 1);
  _emwgpuCreateRenderPassEncoder = createExportWrapper('emwgpuCreateRenderPassEncoder', 1);
  _emwgpuCreateRenderPipeline = createExportWrapper('emwgpuCreateRenderPipeline', 1);
  _emwgpuCreateSampler = createExportWrapper('emwgpuCreateSampler', 1);
  _emwgpuCreateSurface = createExportWrapper('emwgpuCreateSurface', 1);
  _emwgpuCreateTexture = createExportWrapper('emwgpuCreateTexture', 1);
  _emwgpuCreateTextureView = createExportWrapper('emwgpuCreateTextureView', 1);
  _emwgpuCreateAdapter = createExportWrapper('emwgpuCreateAdapter', 1);
  _emwgpuImportBuffer = createExportWrapper('emwgpuImportBuffer', 1);
  _emwgpuCreateDevice = createExportWrapper('emwgpuCreateDevice', 2);
  _emwgpuCreateQueue = createExportWrapper('emwgpuCreateQueue', 1);
  _emwgpuCreateShaderModule = createExportWrapper('emwgpuCreateShaderModule', 1);
  _emwgpuOnCompilationInfoCompleted = createExportWrapper('emwgpuOnCompilationInfoCompleted', 3);
  _emwgpuOnCreateComputePipelineCompleted = createExportWrapper('emwgpuOnCreateComputePipelineCompleted', 4);
  _emwgpuOnCreateRenderPipelineCompleted = createExportWrapper('emwgpuOnCreateRenderPipelineCompleted', 4);
  _emwgpuOnDeviceLostCompleted = createExportWrapper('emwgpuOnDeviceLostCompleted', 3);
  _emwgpuOnMapAsyncCompleted = createExportWrapper('emwgpuOnMapAsyncCompleted', 3);
  _emwgpuOnPopErrorScopeCompleted = createExportWrapper('emwgpuOnPopErrorScopeCompleted', 4);
  _emwgpuOnRequestAdapterCompleted = createExportWrapper('emwgpuOnRequestAdapterCompleted', 4);
  _emwgpuOnRequestDeviceCompleted = createExportWrapper('emwgpuOnRequestDeviceCompleted', 4);
  _emwgpuOnWorkDoneCompleted = createExportWrapper('emwgpuOnWorkDoneCompleted', 2);
  _emwgpuOnUncapturedError = createExportWrapper('emwgpuOnUncapturedError', 3);
  _free = createExportWrapper('free', 1);
  _fflush = createExportWrapper('fflush', 1);
  _strerror = createExportWrapper('strerror', 1);
  _emscripten_stack_get_end = wasmExports['emscripten_stack_get_end'];
  _emscripten_stack_get_base = wasmExports['emscripten_stack_get_base'];
  _malloc = createExportWrapper('malloc', 1);
  _memalign = createExportWrapper('memalign', 2);
  _emscripten_stack_init = wasmExports['emscripten_stack_init'];
  _emscripten_stack_get_free = wasmExports['emscripten_stack_get_free'];
  __emscripten_stack_restore = wasmExports['_emscripten_stack_restore'];
  __emscripten_stack_alloc = wasmExports['_emscripten_stack_alloc'];
  _emscripten_stack_get_current = wasmExports['emscripten_stack_get_current'];
  memory = wasmMemory = wasmExports['memory'];
  __indirect_function_table = wasmTable = wasmExports['__indirect_function_table'];
}

var wasmImports = {
  /** @export */
  __assert_fail: ___assert_fail,
  /** @export */
  _abort_js: __abort_js,
  /** @export */
  emscripten_asm_const_int: _emscripten_asm_const_int,
  /** @export */
  emscripten_has_asyncify: _emscripten_has_asyncify,
  /** @export */
  emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */
  emwgpuAdapterRequestDevice: _emwgpuAdapterRequestDevice,
  /** @export */
  emwgpuBufferDestroy: _emwgpuBufferDestroy,
  /** @export */
  emwgpuDelete: _emwgpuDelete,
  /** @export */
  emwgpuDeviceCreateBuffer: _emwgpuDeviceCreateBuffer,
  /** @export */
  emwgpuDeviceCreateShaderModule: _emwgpuDeviceCreateShaderModule,
  /** @export */
  emwgpuDeviceDestroy: _emwgpuDeviceDestroy,
  /** @export */
  emwgpuGetPreferredFormat: _emwgpuGetPreferredFormat,
  /** @export */
  emwgpuInstanceRequestAdapter: _emwgpuInstanceRequestAdapter,
  /** @export */
  fd_close: _fd_close,
  /** @export */
  fd_seek: _fd_seek,
  /** @export */
  fd_write: _fd_write,
  /** @export */
  wgpuCommandEncoderBeginRenderPass: _wgpuCommandEncoderBeginRenderPass,
  /** @export */
  wgpuCommandEncoderFinish: _wgpuCommandEncoderFinish,
  /** @export */
  wgpuDeviceCreateBindGroup: _wgpuDeviceCreateBindGroup,
  /** @export */
  wgpuDeviceCreateBindGroupLayout: _wgpuDeviceCreateBindGroupLayout,
  /** @export */
  wgpuDeviceCreateCommandEncoder: _wgpuDeviceCreateCommandEncoder,
  /** @export */
  wgpuDeviceCreatePipelineLayout: _wgpuDeviceCreatePipelineLayout,
  /** @export */
  wgpuDeviceCreateRenderPipeline: _wgpuDeviceCreateRenderPipeline,
  /** @export */
  wgpuDeviceCreateTexture: _wgpuDeviceCreateTexture,
  /** @export */
  wgpuInstanceCreateSurface: _wgpuInstanceCreateSurface,
  /** @export */
  wgpuQueueSubmit: _wgpuQueueSubmit,
  /** @export */
  wgpuQueueWriteBuffer: _wgpuQueueWriteBuffer,
  /** @export */
  wgpuQueueWriteTexture: _wgpuQueueWriteTexture,
  /** @export */
  wgpuRenderPassEncoderDraw: _wgpuRenderPassEncoderDraw,
  /** @export */
  wgpuRenderPassEncoderEnd: _wgpuRenderPassEncoderEnd,
  /** @export */
  wgpuRenderPassEncoderSetBindGroup: _wgpuRenderPassEncoderSetBindGroup,
  /** @export */
  wgpuRenderPassEncoderSetPipeline: _wgpuRenderPassEncoderSetPipeline,
  /** @export */
  wgpuSurfaceConfigure: _wgpuSurfaceConfigure,
  /** @export */
  wgpuSurfaceGetCurrentTexture: _wgpuSurfaceGetCurrentTexture,
  /** @export */
  wgpuSurfaceUnconfigure: _wgpuSurfaceUnconfigure,
  /** @export */
  wgpuTextureCreateView: _wgpuTextureCreateView,
  /** @export */
  wgpuTextureDestroy: _wgpuTextureDestroy
};


// Argument name here must shadow the `wasmExports` global so
// that it is recognised by metadce and minify-import-export-names
// passes.
function applySignatureConversions(wasmExports) {
  // First, make a copy of the incoming exports object
  wasmExports = Object.assign({}, wasmExports);
  var makeWrapper__p = (f) => (a0) => f(BigInt(a0));
  var makeWrapper_p_ = (f) => (a0) => Number(f(a0));
  var makeWrapper_p = (f) => () => Number(f());
  var makeWrapper_pp = (f) => (a0) => Number(f(BigInt(a0)));
  var makeWrapper_ppp = (f) => (a0, a1) => Number(f(BigInt(a0), BigInt(a1)));

  wasmExports['free'] = makeWrapper__p(wasmExports['free']);
  wasmExports['fflush'] = makeWrapper__p(wasmExports['fflush']);
  wasmExports['strerror'] = makeWrapper_p_(wasmExports['strerror']);
  wasmExports['emscripten_stack_get_end'] = makeWrapper_p(wasmExports['emscripten_stack_get_end']);
  wasmExports['emscripten_stack_get_base'] = makeWrapper_p(wasmExports['emscripten_stack_get_base']);
  wasmExports['malloc'] = makeWrapper_pp(wasmExports['malloc']);
  wasmExports['memalign'] = makeWrapper_ppp(wasmExports['memalign']);
  wasmExports['_emscripten_stack_restore'] = makeWrapper__p(wasmExports['_emscripten_stack_restore']);
  wasmExports['_emscripten_stack_alloc'] = makeWrapper_pp(wasmExports['_emscripten_stack_alloc']);
  wasmExports['emscripten_stack_get_current'] = makeWrapper_p(wasmExports['emscripten_stack_get_current']);
  return wasmExports;
}


// include: postamble.js
// === Auto-generated postamble setup entry stuff ===

var calledRun;

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  _emscripten_stack_init();
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  writeStackCookie();
}

function run() {

  stackCheckInit();

  preRun();

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    assert(!calledRun);
    calledRun = true;
    Module['calledRun'] = true;

    if (ABORT) return;

    initRuntime();

    readyPromiseResolve?.(Module);
    Module['onRuntimeInitialized']?.();
    consumedModuleProp('onRuntimeInitialized');

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(() => {
      setTimeout(() => Module['setStatus'](''), 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
  checkStackCookie();
}

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = (x) => {
    has = true;
  }
  try { // it doesn't matter if it fails
    flush_NO_FILESYSTEM();
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.');
    warnOnce('(this may also be due to not including full filesystem support - try building with -sFORCE_FILESYSTEM)');
  }
}

var wasmExports;

// In modularize mode the generated code is within a factory function so we
// can use await here (since it's not top-level-await).
wasmExports = await (createWasm());

run();

// end include: postamble.js

// include: postamble_modularize.js
// In MODULARIZE mode we wrap the generated code in a factory function
// and return either the Module itself, or a promise of the module.
//
// We assign to the `moduleRtn` global here and configure closure to see
// this as an extern so it won't get minified.

if (runtimeInitialized)  {
  moduleRtn = Module;
} else {
  // Set up the promise that indicates the Module is initialized
  moduleRtn = new Promise((resolve, reject) => {
    readyPromiseResolve = resolve;
    readyPromiseReject = reject;
  });
}

// Assertion for attempting to access module properties on the incoming
// moduleArg.  In the past we used this object as the prototype of the module
// and assigned properties to it, but now we return a distinct object.  This
// keeps the instance private until it is ready (i.e the promise has been
// resolved).
for (const prop of Object.keys(Module)) {
  if (!(prop in moduleArg)) {
    Object.defineProperty(moduleArg, prop, {
      configurable: true,
      get() {
        abort(`Access to module property ('${prop}') is no longer possible via the module constructor argument; Instead, use the result of the module constructor.`)
      }
    });
  }
}
// end include: postamble_modularize.js



  return moduleRtn;
}

// Export using a UMD style export, or ES6 exports if selected
export default Module;

