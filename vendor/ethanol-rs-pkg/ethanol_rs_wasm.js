/* @ts-self-types="./ethanol_rs_wasm.d.ts" */

/**
 * Calculate BAC from a set of drinks.
 *
 * # Parameters
 * - `drinks`: JSON array of drink objects
 * - `profile`: JSON object with user profile
 * - `formula`: "widmark" or "watson"
 *
 * # Returns
 * BAC as a number (e.g., 0.08 for 0.08%)
 * @param {any} drinks
 * @param {any} profile
 * @param {any} formula
 * @returns {number}
 */
function calculateBAC(drinks, profile, formula) {
    const ret = wasm.calculateBAC(drinks, profile, formula);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0];
}
exports.calculateBAC = calculateBAC;

/**
 * Calculate complete BAC snapshot.
 *
 * # Parameters
 * - `drinks`: JSON array of drink objects
 * - `profile`: JSON object with user profile
 * - `formula`: "widmark" or "watson"
 * - `sweetSpotMin`: Minimum BAC for sweet spot (e.g., 0.06)
 * - `sweetSpotMax`: Maximum BAC for sweet spot (e.g., 0.09)
 *
 * # Returns
 * Snapshot object with bac, trajectory, zone, and time_to_sober_secs
 * @param {any} drinks
 * @param {any} profile
 * @param {any} formula
 * @param {number} sweet_spot_min
 * @param {number} sweet_spot_max
 * @returns {any}
 */
function calculateSnapshot(drinks, profile, formula, sweet_spot_min, sweet_spot_max) {
    const ret = wasm.calculateSnapshot(drinks, profile, formula, sweet_spot_min, sweet_spot_max);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.calculateSnapshot = calculateSnapshot;

/**
 * Calculate BAC trajectory (rising, falling, or stable).
 *
 * # Parameters
 * - `drinks`: JSON array of drink objects
 * - `profile`: JSON object with user profile
 * - `formula`: "widmark" or "watson"
 *
 * # Returns
 * Trajectory object: "rising", "falling", or "stable"
 * @param {any} drinks
 * @param {any} profile
 * @param {any} formula
 * @returns {any}
 */
function calculateTrajectory(drinks, profile, formula) {
    const ret = wasm.calculateTrajectory(drinks, profile, formula);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.calculateTrajectory = calculateTrajectory;

/**
 * Classify a BAC value into a zone.
 *
 * # Parameters
 * - `bac`: BAC level (e.g., 0.08)
 * - `sweetSpotMin`: Minimum BAC for sweet spot
 * - `sweetSpotMax`: Maximum BAC for sweet spot
 *
 * # Returns
 * Zone: "sober", "below_sweet_spot", "sweet_spot", "caution", or "danger"
 * @param {number} bac
 * @param {number} sweet_spot_min
 * @param {number} sweet_spot_max
 * @returns {any}
 */
function classifyZone(bac, sweet_spot_min, sweet_spot_max) {
    const ret = wasm.classifyZone(bac, sweet_spot_min, sweet_spot_max);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.classifyZone = classifyZone;

/**
 * Count drinks still being absorbed.
 *
 * # Parameters
 * - `drinks`: JSON array of drink objects
 *
 * # Returns
 * Number of drinks still absorbing
 * @param {any} drinks
 * @returns {number}
 */
function countAbsorbingDrinks(drinks) {
    const ret = wasm.countAbsorbingDrinks(drinks);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] >>> 0;
}
exports.countAbsorbingDrinks = countAbsorbingDrinks;

/**
 * Create a Drink object.
 *
 * # Parameters
 * - `volumeMl`: Volume in milliliters
 * - `abv`: Alcohol by volume (0.05 for 5%)
 * - `offsetSecs`: Seconds since now at which the user started the drink
 *   (negative for past drinks)
 * - `durationSecs`: How long the drink is/was consumed over, in seconds.
 *   Pass `0` for an instantaneous drink (e.g. a shot).
 * - `stomachState`: "empty", "some_food", or "full"
 * @param {number} volume_ml
 * @param {number} abv
 * @param {number} offset_secs
 * @param {number} duration_secs
 * @param {any} stomach_state
 * @returns {any}
 */
function createDrink(volume_ml, abv, offset_secs, duration_secs, stomach_state) {
    const ret = wasm.createDrink(volume_ml, abv, offset_secs, duration_secs, stomach_state);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.createDrink = createDrink;

/**
 * Create a UserProfile object.
 *
 * # Parameters
 * - `weightKg`: Weight in kilograms
 * - `biologicalSex`: "male", "female", or "other"
 * - `heightCm`: Height in centimeters
 * - `age`: Age in years
 * @param {number} weight_kg
 * @param {any} biological_sex
 * @param {number} height_cm
 * @param {number} age
 * @returns {any}
 */
function createUserProfile(weight_kg, biological_sex, height_cm, age) {
    const ret = wasm.createUserProfile(weight_kg, biological_sex, height_cm, age);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.createUserProfile = createUserProfile;

/**
 * Estimate time to sober (in seconds).
 *
 * # Parameters
 * - `currentBac`: Current BAC level (e.g., 0.08)
 *
 * # Returns
 * Seconds until sober, or null if already sober
 * @param {number} current_bac
 * @returns {number | undefined}
 */
function estimateTimeToSober(current_bac) {
    const ret = wasm.estimateTimeToSober(current_bac);
    return ret[0] === 0 ? undefined : ret[1];
}
exports.estimateTimeToSober = estimateTimeToSober;

/**
 * Generate a BAC curve over a time range.
 *
 * # Parameters
 * - `drinks`: JSON array of drink objects
 * - `profile`: JSON object with user profile
 * - `formula`: "widmark" or "watson"
 * - `fromOffsetSecs`: Start of the curve (seconds offset from t=0)
 * - `toOffsetSecs`: End of the curve (seconds offset from t=0)
 * - `stepSecs`: Step size in seconds
 * - `sweetSpotMin`: Minimum BAC for sweet spot
 * - `sweetSpotMax`: Maximum BAC for sweet spot
 *
 * # Returns
 * Array of CurvePoint objects with offset_secs, bac, and zone
 * @param {any} drinks
 * @param {any} profile
 * @param {any} formula
 * @param {number} from_offset_secs
 * @param {number} to_offset_secs
 * @param {number} step_secs
 * @param {number} sweet_spot_min
 * @param {number} sweet_spot_max
 * @returns {any}
 */
function generateCurve(drinks, profile, formula, from_offset_secs, to_offset_secs, step_secs, sweet_spot_min, sweet_spot_max) {
    const ret = wasm.generateCurve(drinks, profile, formula, from_offset_secs, to_offset_secs, step_secs, sweet_spot_min, sweet_spot_max);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
exports.generateCurve = generateCurve;

/**
 * Estimate minutes until BAC reaches zero, accounting for ongoing absorption.
 *
 * # Parameters
 * - `drinks`: JSON array of drink objects
 * - `profile`: JSON object with user profile
 * - `formula`: "widmark" or "watson"
 *
 * # Returns
 * Minutes until sober (0.0 if already sober)
 * @param {any} drinks
 * @param {any} profile
 * @param {any} formula
 * @returns {number}
 */
function minutesUntilSober(drinks, profile, formula) {
    const ret = wasm.minutesUntilSober(drinks, profile, formula);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0];
}
exports.minutesUntilSober = minutesUntilSober;

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_2e59b1b37a9a34c3: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_Number_e6ffdb596c888833: function(arg0) {
            const ret = Number(arg0);
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_boolean_get_a86c216575a75c30: function(arg0) {
            const v = arg0;
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_debug_string_dd5d2d07ce9e6c57: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_in_4bd7a57e54337366: function(arg0, arg1) {
            const ret = arg0 in arg1;
            return ret;
        },
        __wbg___wbindgen_is_function_49868bde5eb1e745: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_object_40c5a80572e8f9d3: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_b29b5c5a8065ba1a: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_c0cca72b82b86f4d: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_jsval_loose_eq_3a72ae764d46d944: function(arg0, arg1) {
            const ret = arg0 == arg1;
            return ret;
        },
        __wbg___wbindgen_number_get_7579aab02a8a620c: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_914df97fcfa788f2: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_81fc77679af83bc6: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_7f2987183bb62793: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.call(arg1);
            return ret;
        }, arguments); },
        __wbg_done_547d467e97529006: function(arg0) {
            const ret = arg0.done;
            return ret;
        },
        __wbg_entries_616b1a459b85be0b: function(arg0) {
            const ret = Object.entries(arg0);
            return ret;
        },
        __wbg_get_4848e350b40afc16: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_ed0642c4b9d31ddf: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_unchecked_7d7babe32e9e6a54: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_with_ref_key_6412cf3094599694: function(arg0, arg1) {
            const ret = arg0[arg1];
            return ret;
        },
        __wbg_instanceof_ArrayBuffer_ff7c1337a5e3b33a: function(arg0) {
            let result;
            try {
                result = arg0 instanceof ArrayBuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Uint8Array_4b8da683deb25d72: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Uint8Array;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_isArray_db61795ad004c139: function(arg0) {
            const ret = Array.isArray(arg0);
            return ret;
        },
        __wbg_isSafeInteger_ea83862ba994770c: function(arg0) {
            const ret = Number.isSafeInteger(arg0);
            return ret;
        },
        __wbg_iterator_de403ef31815a3e6: function() {
            const ret = Symbol.iterator;
            return ret;
        },
        __wbg_length_0c32cb8543c8e4c8: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_6e821edde497a532: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_new_4f9fafbb3909af72: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_a560378ea1240b14: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbg_new_f3c9df4f38f3f798: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_next_01132ed6134b8ef5: function(arg0) {
            const ret = arg0.next;
            return ret;
        },
        __wbg_next_b3713ec761a9dbfd: function() { return handleError(function (arg0) {
            const ret = arg0.next();
            return ret;
        }, arguments); },
        __wbg_prototypesetcall_3e05eb9545565046: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_6c60b2e8ad0e9383: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_value_7f6052747ccf940f: function(arg0) {
            const ret = arg0.value;
            return ret;
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./ethanol_rs_wasm_bg.js": import0,
    };
}

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
function decodeText(ptr, len) {
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

const wasmPath = `${__dirname}/ethanol_rs_wasm_bg.wasm`;
const wasmBytes = require('fs').readFileSync(wasmPath);
const wasmModule = new WebAssembly.Module(wasmBytes);
let wasm = new WebAssembly.Instance(wasmModule, __wbg_get_imports()).exports;
wasm.__wbindgen_start();
