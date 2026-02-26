(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // src/utils/color.ts
  function rgbaToHex(color) {
    if (typeof color === "string" && color.startsWith("#")) return color;
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    const a = color.a !== void 0 ? Math.round(color.a * 255) : 255;
    const hex = [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return a === 255 ? `#${hex}` : `#${hex}${a.toString(16).padStart(2, "0")}`;
  }
  var init_color = __esm({
    "src/utils/color.ts"() {
    }
  });

  // src/utils/filter-node.ts
  var filter_node_exports = {};
  __export(filter_node_exports, {
    filterFigmaNode: () => filterFigmaNode
  });
  function filterFigmaNode(node, depth2 = -1, currentDepth = 0) {
    if (node.type === "VECTOR") {
      return { id: node.id, name: node.name, type: node.type };
    }
    const filtered = {
      id: node.id,
      name: node.name,
      type: node.type
    };
    if (currentDepth === 0) {
      if (node.parentId) filtered.parentId = node.parentId;
      if (node.parentName) filtered.parentName = node.parentName;
      if (node.parentType) filtered.parentType = node.parentType;
    }
    if (node.fills && node.fills.length > 0) {
      filtered.fills = node.fills.map((fill) => {
        const f = __spreadValues({}, fill);
        delete f.boundVariables;
        delete f.imageRef;
        if (f.gradientStops) {
          f.gradientStops = f.gradientStops.map((stop) => {
            const s = __spreadValues({}, stop);
            if (s.color) s.color = rgbaToHex(s.color);
            delete s.boundVariables;
            return s;
          });
        }
        if (f.color) f.color = rgbaToHex(f.color);
        return f;
      });
    }
    if (node.strokes && node.strokes.length > 0) {
      filtered.strokes = node.strokes.map((stroke) => {
        const s = __spreadValues({}, stroke);
        delete s.boundVariables;
        if (s.color) s.color = rgbaToHex(s.color);
        return s;
      });
    }
    if (node.cornerRadius !== void 0) filtered.cornerRadius = node.cornerRadius;
    if (node.absoluteBoundingBox) filtered.absoluteBoundingBox = node.absoluteBoundingBox;
    if (node.characters !== void 0) filtered.characters = node.characters;
    if (node.componentId) filtered.componentId = node.componentId;
    if (node.style) {
      filtered.style = {
        fontFamily: node.style.fontFamily,
        fontStyle: node.style.fontStyle,
        fontWeight: node.style.fontWeight,
        fontSize: node.style.fontSize,
        textAlignHorizontal: node.style.textAlignHorizontal,
        letterSpacing: node.style.letterSpacing,
        lineHeightPx: node.style.lineHeightPx
      };
    }
    if (node.effects && node.effects.length > 0) filtered.effects = node.effects;
    if (node.layoutMode !== void 0) filtered.layoutMode = node.layoutMode;
    if (node.itemSpacing !== void 0) filtered.itemSpacing = node.itemSpacing;
    if (node.paddingLeft !== void 0) {
      filtered.padding = {
        left: node.paddingLeft,
        right: node.paddingRight,
        top: node.paddingTop,
        bottom: node.paddingBottom
      };
    }
    if (node.opacity !== void 0 && node.opacity !== 1) filtered.opacity = node.opacity;
    if (node.visible !== void 0) filtered.visible = node.visible;
    if (node.constraints) filtered.constraints = node.constraints;
    if (node.children) {
      if (depth2 >= 0 && currentDepth >= depth2) {
        filtered.children = node.children.map((child) => ({
          id: child.id,
          name: child.name,
          type: child.type
        }));
      } else {
        filtered.children = node.children.map((child) => filterFigmaNode(child, depth2, currentDepth + 1));
      }
    }
    return filtered;
  }
  var init_filter_node = __esm({
    "src/utils/filter-node.ts"() {
      init_color();
    }
  });

  // src/utils/base64.ts
  var base64_exports = {};
  __export(base64_exports, {
    customBase64Encode: () => customBase64Encode
  });
  function customBase64Encode(bytes) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let base64 = "";
    const byteLength = bytes.byteLength;
    const byteRemainder = byteLength % 3;
    const mainLength = byteLength - byteRemainder;
    for (let i = 0; i < mainLength; i += 3) {
      const chunk = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
      base64 += chars[(chunk & 16515072) >> 18] + chars[(chunk & 258048) >> 12] + chars[(chunk & 4032) >> 6] + chars[chunk & 63];
    }
    if (byteRemainder === 1) {
      const chunk = bytes[mainLength];
      base64 += chars[(chunk & 252) >> 2] + chars[(chunk & 3) << 4] + "==";
    } else if (byteRemainder === 2) {
      const chunk = bytes[mainLength] << 8 | bytes[mainLength + 1];
      base64 += chars[(chunk & 64512) >> 10] + chars[(chunk & 1008) >> 4] + chars[(chunk & 15) << 2] + "=";
    }
    return base64;
  }
  var init_base64 = __esm({
    "src/utils/base64.ts"() {
    }
  });

  // src/tools/helpers.ts
  var helpers_exports = {};
  __export(helpers_exports, {
    appendToParent: () => appendToParent,
    batchHandler: () => batchHandler,
    nodeSnapshot: () => nodeSnapshot,
    solidPaint: () => solidPaint
  });
  function nodeSnapshot(id, depth2) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(id);
      if (!node) return null;
      if (!("exportAsync" in node)) return { id: node.id, name: node.name, type: node.type };
      const response = yield node.exportAsync({ format: "JSON_REST_V1" });
      const filtered = filterFigmaNode(response.document, depth2);
      if (filtered && node.parent) {
        filtered.parentId = node.parent.id;
        filtered.parentName = node.parent.name;
        filtered.parentType = node.parent.type;
      }
      return filtered;
    });
  }
  function batchHandler(params, fn) {
    return __async(this, null, function* () {
      const items = params.items || [params];
      const depth2 = params.depth;
      const results = [];
      for (const item of items) {
        try {
          let result = yield fn(item);
          if (depth2 !== void 0 && (result == null ? void 0 : result.id)) {
            const snapshot = yield nodeSnapshot(result.id, depth2);
            if (snapshot) result = __spreadValues(__spreadValues({}, result), snapshot);
          }
          if (result && typeof result === "object" && Object.keys(result).length === 0) {
            results.push("ok");
          } else {
            results.push(result);
          }
        } catch (e) {
          results.push({ error: e.message });
        }
      }
      return { results };
    });
  }
  function appendToParent(node, parentId2) {
    return __async(this, null, function* () {
      if (parentId2) {
        const parent = yield figma.getNodeByIdAsync(parentId2);
        if (!parent) throw new Error(`Parent not found: ${parentId2}`);
        if (!("appendChild" in parent))
          throw new Error(`Parent does not support children: ${parentId2}. Only FRAME, COMPONENT, GROUP, SECTION, and PAGE nodes can have children.`);
        parent.appendChild(node);
        return parent;
      }
      figma.currentPage.appendChild(node);
      return null;
    });
  }
  function solidPaint(c) {
    var _a, _b, _c, _d;
    return { type: "SOLID", color: { r: (_a = c.r) != null ? _a : 0, g: (_b = c.g) != null ? _b : 0, b: (_c = c.b) != null ? _c : 0 }, opacity: (_d = c.a) != null ? _d : 1 };
  }
  var init_helpers = __esm({
    "src/tools/helpers.ts"() {
      init_filter_node();
    }
  });

  // src/utils/figma-helpers.ts
  var figma_helpers_exports = {};
  __export(figma_helpers_exports, {
    appendToParentOrPage: () => appendToParentOrPage,
    applyDeferredFill: () => applyDeferredFill,
    delay: () => delay,
    generateCommandId: () => generateCommandId,
    getFontStyle: () => getFontStyle,
    getNode: () => getNode,
    getParentNode: () => getParentNode,
    sendProgressUpdate: () => sendProgressUpdate,
    setCharacters: () => setCharacters,
    solidPaint: () => solidPaint2
  });
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function generateCommandId() {
    return "cmd_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  function sendProgressUpdate(commandId, commandType, status, progress, totalItems, processedItems, message, payload = null) {
    const update = {
      type: "command_progress",
      commandId,
      commandType,
      status,
      progress,
      totalItems,
      processedItems,
      message,
      timestamp: Date.now()
    };
    if (payload) {
      if (payload.currentChunk !== void 0 && payload.totalChunks !== void 0) {
        update.currentChunk = payload.currentChunk;
        update.totalChunks = payload.totalChunks;
        update.chunkSize = payload.chunkSize;
      }
      update.payload = payload;
    }
    figma.ui.postMessage(update);
    return update;
  }
  function solidPaint2(color) {
    var _a, _b, _c, _d;
    return {
      type: "SOLID",
      color: {
        r: (_a = color.r) != null ? _a : 0,
        g: (_b = color.g) != null ? _b : 0,
        b: (_c = color.b) != null ? _c : 0
      },
      opacity: (_d = color.a) != null ? _d : 1
    };
  }
  function getNode(nodeId2) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(nodeId2);
      if (!node) throw new Error(`Node not found: ${nodeId2}`);
      return node;
    });
  }
  function getParentNode(parentId2) {
    return __async(this, null, function* () {
      const node = yield getNode(parentId2);
      if (!("appendChild" in node)) {
        throw new Error(`Node does not support children: ${parentId2}`);
      }
      return node;
    });
  }
  function appendToParentOrPage(node, parentId2) {
    return __async(this, null, function* () {
      if (parentId2) {
        const parent = yield getParentNode(parentId2);
        parent.appendChild(node);
      } else {
        figma.currentPage.appendChild(node);
      }
    });
  }
  function applyDeferredFill(node, deferH, deferV) {
    if (deferH) {
      try {
        node.layoutSizingHorizontal = "FILL";
      } catch (_) {
      }
    }
    if (deferV) {
      try {
        node.layoutSizingVertical = "FILL";
      } catch (_) {
      }
    }
  }
  function uniqBy(arr, predicate) {
    const cb = typeof predicate === "function" ? predicate : (o) => o[predicate];
    return [
      ...arr.reduce((map, item) => {
        const key = item === null || item === void 0 ? item : cb(item);
        map.has(key) || map.set(key, item);
        return map;
      }, /* @__PURE__ */ new Map()).values()
    ];
  }
  function setCharactersStrict(node, characters, fallbackFont) {
    return __async(this, null, function* () {
      const fontHashTree = {};
      for (let i = 1; i < node.characters.length; i++) {
        const startIdx = i - 1;
        const startCharFont = node.getRangeFontName(startIdx, i);
        const startVal = `${startCharFont.family}::${startCharFont.style}`;
        while (i < node.characters.length) {
          i++;
          const charFont = node.getRangeFontName(i - 1, i);
          if (startVal !== `${charFont.family}::${charFont.style}`) break;
        }
        fontHashTree[`${startIdx}_${i}`] = startVal;
      }
      yield figma.loadFontAsync(fallbackFont);
      node.fontName = fallbackFont;
      node.characters = characters;
      yield Promise.all(
        Object.keys(fontHashTree).map((range) => __async(this, null, function* () {
          const [start, end] = range.split("_");
          const [family, style] = fontHashTree[range].split("::");
          const matchedFont = { family, style };
          yield figma.loadFontAsync(matchedFont);
          return node.setRangeFontName(Number(start), Number(end), matchedFont);
        }))
      );
      return true;
    });
  }
  function getDelimiterPos(str, delimiter, startIdx = 0, endIdx = str.length) {
    const indices = [];
    let temp = startIdx;
    for (let i = startIdx; i < endIdx; i++) {
      if (str[i] === delimiter && i + startIdx !== endIdx && temp !== i + startIdx) {
        indices.push([temp, i + startIdx]);
        temp = i + startIdx + 1;
      }
    }
    if (temp !== endIdx) indices.push([temp, endIdx]);
    return indices;
  }
  function buildLinearOrder(node) {
    const fontTree = [];
    const newLinesPos = getDelimiterPos(node.characters, "\n");
    newLinesPos.forEach(([nlStart, nlEnd]) => {
      const nlFont = node.getRangeFontName(nlStart, nlEnd);
      if (nlFont === figma.mixed) {
        const spacesPos = getDelimiterPos(node.characters, " ", nlStart, nlEnd);
        spacesPos.forEach(([spStart, spEnd]) => {
          const spFont = node.getRangeFontName(spStart, spEnd);
          fontTree.push({ start: spStart, delimiter: " ", family: spFont.family, style: spFont.style });
        });
      } else {
        fontTree.push({ start: nlStart, delimiter: "\n", family: nlFont.family, style: nlFont.style });
      }
    });
    return fontTree.sort((a, b) => a.start - b.start).map(({ family, style, delimiter }) => ({ family, style, delimiter }));
  }
  function setCharactersSmart(node, characters, fallbackFont) {
    return __async(this, null, function* () {
      const rangeTree = buildLinearOrder(node);
      const fontsToLoad = uniqBy(rangeTree, ({ family, style }) => `${family}::${style}`).map(
        ({ family, style }) => ({ family, style })
      );
      yield Promise.all([...fontsToLoad, fallbackFont].map((f) => figma.loadFontAsync(f)));
      node.fontName = fallbackFont;
      node.characters = characters;
      let prevPos = 0;
      rangeTree.forEach(({ family, style, delimiter }) => {
        if (prevPos < node.characters.length) {
          const delimPos = node.characters.indexOf(delimiter, prevPos);
          const endPos = delimPos > prevPos ? delimPos : node.characters.length;
          node.setRangeFontName(prevPos, endPos, { family, style });
          prevPos = endPos + 1;
        }
      });
      return true;
    });
  }
  function getFontStyle(weight) {
    switch (weight) {
      case 100:
        return "Thin";
      case 200:
        return "Extra Light";
      case 300:
        return "Light";
      case 400:
        return "Regular";
      case 500:
        return "Medium";
      case 600:
        return "Semi Bold";
      case 700:
        return "Bold";
      case 800:
        return "Extra Bold";
      case 900:
        return "Black";
      default:
        return "Regular";
    }
  }
  var setCharacters;
  var init_figma_helpers = __esm({
    "src/utils/figma-helpers.ts"() {
      setCharacters = (node, characters, options) => __async(void 0, null, function* () {
        const fallbackFont = (options == null ? void 0 : options.fallbackFont) || { family: "Inter", style: "Regular" };
        try {
          if (node.fontName === figma.mixed) {
            if ((options == null ? void 0 : options.smartStrategy) === "prevail") {
              const fontHashTree = {};
              for (let i = 1; i < node.characters.length; i++) {
                const charFont = node.getRangeFontName(i - 1, i);
                const key = `${charFont.family}::${charFont.style}`;
                fontHashTree[key] = (fontHashTree[key] || 0) + 1;
              }
              const prevailed = Object.entries(fontHashTree).sort((a, b) => b[1] - a[1])[0];
              const [family, style] = prevailed[0].split("::");
              const prevailedFont = { family, style };
              yield figma.loadFontAsync(prevailedFont);
              node.fontName = prevailedFont;
            } else if ((options == null ? void 0 : options.smartStrategy) === "strict") {
              return setCharactersStrict(node, characters, fallbackFont);
            } else if ((options == null ? void 0 : options.smartStrategy) === "experimental") {
              return setCharactersSmart(node, characters, fallbackFont);
            } else {
              const firstCharFont = node.getRangeFontName(0, 1);
              yield figma.loadFontAsync(firstCharFont);
              node.fontName = firstCharFont;
            }
          } else {
            yield figma.loadFontAsync(node.fontName);
          }
        } catch (e) {
          yield figma.loadFontAsync(fallbackFont);
          node.fontName = fallbackFont;
        }
        try {
          node.characters = characters;
          return true;
        } catch (e) {
          return false;
        }
      });
    }
  });

  // node_modules/zod/lib/index.mjs
  var util;
  (function(util2) {
    util2.assertEqual = (val) => val;
    function assertIs(_arg) {
    }
    util2.assertIs = assertIs;
    function assertNever(_x) {
      throw new Error();
    }
    util2.assertNever = assertNever;
    util2.arrayToEnum = (items) => {
      const obj = {};
      for (const item of items) {
        obj[item] = item;
      }
      return obj;
    };
    util2.getValidEnumValues = (obj) => {
      const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
      const filtered = {};
      for (const k of validKeys) {
        filtered[k] = obj[k];
      }
      return util2.objectValues(filtered);
    };
    util2.objectValues = (obj) => {
      return util2.objectKeys(obj).map(function(e) {
        return obj[e];
      });
    };
    util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
      const keys = [];
      for (const key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          keys.push(key);
        }
      }
      return keys;
    };
    util2.find = (arr, checker) => {
      for (const item of arr) {
        if (checker(item))
          return item;
      }
      return void 0;
    };
    util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
      return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
    }
    util2.joinValues = joinValues;
    util2.jsonStringifyReplacer = (_, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    };
  })(util || (util = {}));
  var objectUtil;
  (function(objectUtil2) {
    objectUtil2.mergeShapes = (first, second) => {
      return __spreadValues(__spreadValues({}, first), second);
    };
  })(objectUtil || (objectUtil = {}));
  var ZodParsedType = util.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set"
  ]);
  var getParsedType = (data) => {
    const t = typeof data;
    switch (t) {
      case "undefined":
        return ZodParsedType.undefined;
      case "string":
        return ZodParsedType.string;
      case "number":
        return isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
      case "boolean":
        return ZodParsedType.boolean;
      case "function":
        return ZodParsedType.function;
      case "bigint":
        return ZodParsedType.bigint;
      case "symbol":
        return ZodParsedType.symbol;
      case "object":
        if (Array.isArray(data)) {
          return ZodParsedType.array;
        }
        if (data === null) {
          return ZodParsedType.null;
        }
        if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
          return ZodParsedType.promise;
        }
        if (typeof Map !== "undefined" && data instanceof Map) {
          return ZodParsedType.map;
        }
        if (typeof Set !== "undefined" && data instanceof Set) {
          return ZodParsedType.set;
        }
        if (typeof Date !== "undefined" && data instanceof Date) {
          return ZodParsedType.date;
        }
        return ZodParsedType.object;
      default:
        return ZodParsedType.unknown;
    }
  };
  var ZodIssueCode = util.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite"
  ]);
  var quotelessJson = (obj) => {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(/"([^"]+)":/g, "$1:");
  };
  var ZodError = class extends Error {
    constructor(issues) {
      super();
      this.issues = [];
      this.addIssue = (sub) => {
        this.issues = [...this.issues, sub];
      };
      this.addIssues = (subs = []) => {
        this.issues = [...this.issues, ...subs];
      };
      const actualProto = new.target.prototype;
      if (Object.setPrototypeOf) {
        Object.setPrototypeOf(this, actualProto);
      } else {
        this.__proto__ = actualProto;
      }
      this.name = "ZodError";
      this.issues = issues;
    }
    get errors() {
      return this.issues;
    }
    format(_mapper) {
      const mapper = _mapper || function(issue) {
        return issue.message;
      };
      const fieldErrors = { _errors: [] };
      const processError = (error) => {
        for (const issue of error.issues) {
          if (issue.code === "invalid_union") {
            issue.unionErrors.map(processError);
          } else if (issue.code === "invalid_return_type") {
            processError(issue.returnTypeError);
          } else if (issue.code === "invalid_arguments") {
            processError(issue.argumentsError);
          } else if (issue.path.length === 0) {
            fieldErrors._errors.push(mapper(issue));
          } else {
            let curr = fieldErrors;
            let i = 0;
            while (i < issue.path.length) {
              const el = issue.path[i];
              const terminal = i === issue.path.length - 1;
              if (!terminal) {
                curr[el] = curr[el] || { _errors: [] };
              } else {
                curr[el] = curr[el] || { _errors: [] };
                curr[el]._errors.push(mapper(issue));
              }
              curr = curr[el];
              i++;
            }
          }
        }
      };
      processError(this);
      return fieldErrors;
    }
    toString() {
      return this.message;
    }
    get message() {
      return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
      return this.issues.length === 0;
    }
    flatten(mapper = (issue) => issue.message) {
      const fieldErrors = {};
      const formErrors = [];
      for (const sub of this.issues) {
        if (sub.path.length > 0) {
          fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
          fieldErrors[sub.path[0]].push(mapper(sub));
        } else {
          formErrors.push(mapper(sub));
        }
      }
      return { formErrors, fieldErrors };
    }
    get formErrors() {
      return this.flatten();
    }
  };
  ZodError.create = (issues) => {
    const error = new ZodError(issues);
    return error;
  };
  var errorMap = (issue, _ctx) => {
    let message;
    switch (issue.code) {
      case ZodIssueCode.invalid_type:
        if (issue.received === ZodParsedType.undefined) {
          message = "Required";
        } else {
          message = `Expected ${issue.expected}, received ${issue.received}`;
        }
        break;
      case ZodIssueCode.invalid_literal:
        message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
        break;
      case ZodIssueCode.unrecognized_keys:
        message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
        break;
      case ZodIssueCode.invalid_union:
        message = `Invalid input`;
        break;
      case ZodIssueCode.invalid_union_discriminator:
        message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
        break;
      case ZodIssueCode.invalid_enum_value:
        message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
        break;
      case ZodIssueCode.invalid_arguments:
        message = `Invalid function arguments`;
        break;
      case ZodIssueCode.invalid_return_type:
        message = `Invalid function return type`;
        break;
      case ZodIssueCode.invalid_date:
        message = `Invalid date`;
        break;
      case ZodIssueCode.invalid_string:
        if (typeof issue.validation === "object") {
          if ("includes" in issue.validation) {
            message = `Invalid input: must include "${issue.validation.includes}"`;
            if (typeof issue.validation.position === "number") {
              message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
            }
          } else if ("startsWith" in issue.validation) {
            message = `Invalid input: must start with "${issue.validation.startsWith}"`;
          } else if ("endsWith" in issue.validation) {
            message = `Invalid input: must end with "${issue.validation.endsWith}"`;
          } else {
            util.assertNever(issue.validation);
          }
        } else if (issue.validation !== "regex") {
          message = `Invalid ${issue.validation}`;
        } else {
          message = "Invalid";
        }
        break;
      case ZodIssueCode.too_small:
        if (issue.type === "array")
          message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
        else if (issue.type === "string")
          message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
        else if (issue.type === "number")
          message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
        else if (issue.type === "date")
          message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
        else
          message = "Invalid input";
        break;
      case ZodIssueCode.too_big:
        if (issue.type === "array")
          message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
        else if (issue.type === "string")
          message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
        else if (issue.type === "number")
          message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
        else if (issue.type === "bigint")
          message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
        else if (issue.type === "date")
          message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
        else
          message = "Invalid input";
        break;
      case ZodIssueCode.custom:
        message = `Invalid input`;
        break;
      case ZodIssueCode.invalid_intersection_types:
        message = `Intersection results could not be merged`;
        break;
      case ZodIssueCode.not_multiple_of:
        message = `Number must be a multiple of ${issue.multipleOf}`;
        break;
      case ZodIssueCode.not_finite:
        message = "Number must be finite";
        break;
      default:
        message = _ctx.defaultError;
        util.assertNever(issue);
    }
    return { message };
  };
  var overrideErrorMap = errorMap;
  function setErrorMap(map) {
    overrideErrorMap = map;
  }
  function getErrorMap() {
    return overrideErrorMap;
  }
  var makeIssue = (params) => {
    const { data, path, errorMaps, issueData } = params;
    const fullPath = [...path, ...issueData.path || []];
    const fullIssue = __spreadProps(__spreadValues({}, issueData), {
      path: fullPath
    });
    let errorMessage = "";
    const maps = errorMaps.filter((m) => !!m).slice().reverse();
    for (const map of maps) {
      errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
    }
    return __spreadProps(__spreadValues({}, issueData), {
      path: fullPath,
      message: issueData.message || errorMessage
    });
  };
  var EMPTY_PATH = [];
  function addIssueToContext(ctx, issueData) {
    const issue = makeIssue({
      issueData,
      data: ctx.data,
      path: ctx.path,
      errorMaps: [
        ctx.common.contextualErrorMap,
        ctx.schemaErrorMap,
        getErrorMap(),
        errorMap
        // then global default map
      ].filter((x) => !!x)
    });
    ctx.common.issues.push(issue);
  }
  var ParseStatus = class _ParseStatus {
    constructor() {
      this.value = "valid";
    }
    dirty() {
      if (this.value === "valid")
        this.value = "dirty";
    }
    abort() {
      if (this.value !== "aborted")
        this.value = "aborted";
    }
    static mergeArray(status, results) {
      const arrayValue = [];
      for (const s of results) {
        if (s.status === "aborted")
          return INVALID;
        if (s.status === "dirty")
          status.dirty();
        arrayValue.push(s.value);
      }
      return { status: status.value, value: arrayValue };
    }
    static mergeObjectAsync(status, pairs) {
      return __async(this, null, function* () {
        const syncPairs = [];
        for (const pair of pairs) {
          syncPairs.push({
            key: yield pair.key,
            value: yield pair.value
          });
        }
        return _ParseStatus.mergeObjectSync(status, syncPairs);
      });
    }
    static mergeObjectSync(status, pairs) {
      const finalObject = {};
      for (const pair of pairs) {
        const { key, value } = pair;
        if (key.status === "aborted")
          return INVALID;
        if (value.status === "aborted")
          return INVALID;
        if (key.status === "dirty")
          status.dirty();
        if (value.status === "dirty")
          status.dirty();
        if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
          finalObject[key.value] = value.value;
        }
      }
      return { status: status.value, value: finalObject };
    }
  };
  var INVALID = Object.freeze({
    status: "aborted"
  });
  var DIRTY = (value) => ({ status: "dirty", value });
  var OK = (value) => ({ status: "valid", value });
  var isAborted = (x) => x.status === "aborted";
  var isDirty = (x) => x.status === "dirty";
  var isValid = (x) => x.status === "valid";
  var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
  var errorUtil;
  (function(errorUtil2) {
    errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
    errorUtil2.toString = (message) => typeof message === "string" ? message : message === null || message === void 0 ? void 0 : message.message;
  })(errorUtil || (errorUtil = {}));
  var ParseInputLazyPath = class {
    constructor(parent, value, path, key) {
      this._cachedPath = [];
      this.parent = parent;
      this.data = value;
      this._path = path;
      this._key = key;
    }
    get path() {
      if (!this._cachedPath.length) {
        if (this._key instanceof Array) {
          this._cachedPath.push(...this._path, ...this._key);
        } else {
          this._cachedPath.push(...this._path, this._key);
        }
      }
      return this._cachedPath;
    }
  };
  var handleResult = (ctx, result) => {
    if (isValid(result)) {
      return { success: true, data: result.value };
    } else {
      if (!ctx.common.issues.length) {
        throw new Error("Validation failed but no issues detected.");
      }
      return {
        success: false,
        get error() {
          if (this._error)
            return this._error;
          const error = new ZodError(ctx.common.issues);
          this._error = error;
          return this._error;
        }
      };
    }
  };
  function processCreateParams(params) {
    if (!params)
      return {};
    const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
    if (errorMap2 && (invalid_type_error || required_error)) {
      throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap2)
      return { errorMap: errorMap2, description };
    const customMap = (iss, ctx) => {
      if (iss.code !== "invalid_type")
        return { message: ctx.defaultError };
      if (typeof ctx.data === "undefined") {
        return { message: required_error !== null && required_error !== void 0 ? required_error : ctx.defaultError };
      }
      return { message: invalid_type_error !== null && invalid_type_error !== void 0 ? invalid_type_error : ctx.defaultError };
    };
    return { errorMap: customMap, description };
  }
  var ZodType = class {
    constructor(def) {
      this.spa = this.safeParseAsync;
      this._def = def;
      this.parse = this.parse.bind(this);
      this.safeParse = this.safeParse.bind(this);
      this.parseAsync = this.parseAsync.bind(this);
      this.safeParseAsync = this.safeParseAsync.bind(this);
      this.spa = this.spa.bind(this);
      this.refine = this.refine.bind(this);
      this.refinement = this.refinement.bind(this);
      this.superRefine = this.superRefine.bind(this);
      this.optional = this.optional.bind(this);
      this.nullable = this.nullable.bind(this);
      this.nullish = this.nullish.bind(this);
      this.array = this.array.bind(this);
      this.promise = this.promise.bind(this);
      this.or = this.or.bind(this);
      this.and = this.and.bind(this);
      this.transform = this.transform.bind(this);
      this.brand = this.brand.bind(this);
      this.default = this.default.bind(this);
      this.catch = this.catch.bind(this);
      this.describe = this.describe.bind(this);
      this.pipe = this.pipe.bind(this);
      this.readonly = this.readonly.bind(this);
      this.isNullable = this.isNullable.bind(this);
      this.isOptional = this.isOptional.bind(this);
    }
    get description() {
      return this._def.description;
    }
    _getType(input) {
      return getParsedType(input.data);
    }
    _getOrReturnCtx(input, ctx) {
      return ctx || {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      };
    }
    _processInputParams(input) {
      return {
        status: new ParseStatus(),
        ctx: {
          common: input.parent.common,
          data: input.data,
          parsedType: getParsedType(input.data),
          schemaErrorMap: this._def.errorMap,
          path: input.path,
          parent: input.parent
        }
      };
    }
    _parseSync(input) {
      const result = this._parse(input);
      if (isAsync(result)) {
        throw new Error("Synchronous parse encountered promise.");
      }
      return result;
    }
    _parseAsync(input) {
      const result = this._parse(input);
      return Promise.resolve(result);
    }
    parse(data, params) {
      const result = this.safeParse(data, params);
      if (result.success)
        return result.data;
      throw result.error;
    }
    safeParse(data, params) {
      var _a;
      const ctx = {
        common: {
          issues: [],
          async: (_a = params === null || params === void 0 ? void 0 : params.async) !== null && _a !== void 0 ? _a : false,
          contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap
        },
        path: (params === null || params === void 0 ? void 0 : params.path) || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      const result = this._parseSync({ data, path: ctx.path, parent: ctx });
      return handleResult(ctx, result);
    }
    parseAsync(data, params) {
      return __async(this, null, function* () {
        const result = yield this.safeParseAsync(data, params);
        if (result.success)
          return result.data;
        throw result.error;
      });
    }
    safeParseAsync(data, params) {
      return __async(this, null, function* () {
        const ctx = {
          common: {
            issues: [],
            contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap,
            async: true
          },
          path: (params === null || params === void 0 ? void 0 : params.path) || [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
        const result = yield isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult);
        return handleResult(ctx, result);
      });
    }
    refine(check, message) {
      const getIssueProperties = (val) => {
        if (typeof message === "string" || typeof message === "undefined") {
          return { message };
        } else if (typeof message === "function") {
          return message(val);
        } else {
          return message;
        }
      };
      return this._refinement((val, ctx) => {
        const result = check(val);
        const setError = () => ctx.addIssue(__spreadValues({
          code: ZodIssueCode.custom
        }, getIssueProperties(val)));
        if (typeof Promise !== "undefined" && result instanceof Promise) {
          return result.then((data) => {
            if (!data) {
              setError();
              return false;
            } else {
              return true;
            }
          });
        }
        if (!result) {
          setError();
          return false;
        } else {
          return true;
        }
      });
    }
    refinement(check, refinementData) {
      return this._refinement((val, ctx) => {
        if (!check(val)) {
          ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
          return false;
        } else {
          return true;
        }
      });
    }
    _refinement(refinement) {
      return new ZodEffects({
        schema: this,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect: { type: "refinement", refinement }
      });
    }
    superRefine(refinement) {
      return this._refinement(refinement);
    }
    optional() {
      return ZodOptional.create(this, this._def);
    }
    nullable() {
      return ZodNullable.create(this, this._def);
    }
    nullish() {
      return this.nullable().optional();
    }
    array() {
      return ZodArray.create(this, this._def);
    }
    promise() {
      return ZodPromise.create(this, this._def);
    }
    or(option) {
      return ZodUnion.create([this, option], this._def);
    }
    and(incoming) {
      return ZodIntersection.create(this, incoming, this._def);
    }
    transform(transform) {
      return new ZodEffects(__spreadProps(__spreadValues({}, processCreateParams(this._def)), {
        schema: this,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect: { type: "transform", transform }
      }));
    }
    default(def) {
      const defaultValueFunc = typeof def === "function" ? def : () => def;
      return new ZodDefault(__spreadProps(__spreadValues({}, processCreateParams(this._def)), {
        innerType: this,
        defaultValue: defaultValueFunc,
        typeName: ZodFirstPartyTypeKind.ZodDefault
      }));
    }
    brand() {
      return new ZodBranded(__spreadValues({
        typeName: ZodFirstPartyTypeKind.ZodBranded,
        type: this
      }, processCreateParams(this._def)));
    }
    catch(def) {
      const catchValueFunc = typeof def === "function" ? def : () => def;
      return new ZodCatch(__spreadProps(__spreadValues({}, processCreateParams(this._def)), {
        innerType: this,
        catchValue: catchValueFunc,
        typeName: ZodFirstPartyTypeKind.ZodCatch
      }));
    }
    describe(description) {
      const This = this.constructor;
      return new This(__spreadProps(__spreadValues({}, this._def), {
        description
      }));
    }
    pipe(target) {
      return ZodPipeline.create(this, target);
    }
    readonly() {
      return ZodReadonly.create(this);
    }
    isOptional() {
      return this.safeParse(void 0).success;
    }
    isNullable() {
      return this.safeParse(null).success;
    }
  };
  var cuidRegex = /^c[^\s-]{8,}$/i;
  var cuid2Regex = /^[a-z][a-z0-9]*$/;
  var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;
  var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
  var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_+-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
  var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
  var emojiRegex;
  var ipv4Regex = /^(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))$/;
  var ipv6Regex = /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/;
  var datetimeRegex = (args) => {
    if (args.precision) {
      if (args.offset) {
        return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{${args.precision}}(([+-]\\d{2}(:?\\d{2})?)|Z)$`);
      } else {
        return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{${args.precision}}Z$`);
      }
    } else if (args.precision === 0) {
      if (args.offset) {
        return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(([+-]\\d{2}(:?\\d{2})?)|Z)$`);
      } else {
        return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$`);
      }
    } else {
      if (args.offset) {
        return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(([+-]\\d{2}(:?\\d{2})?)|Z)$`);
      } else {
        return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$`);
      }
    }
  };
  function isValidIP(ip, version) {
    if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
      return true;
    }
    if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
      return true;
    }
    return false;
  }
  var ZodString = class _ZodString extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = String(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.string) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(
          ctx2,
          {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.string,
            received: ctx2.parsedType
          }
          //
        );
        return INVALID;
      }
      const status = new ParseStatus();
      let ctx = void 0;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.length < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.length > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "length") {
          const tooBig = input.data.length > check.value;
          const tooSmall = input.data.length < check.value;
          if (tooBig || tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            if (tooBig) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "string",
                inclusive: true,
                exact: true,
                message: check.message
              });
            } else if (tooSmall) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "string",
                inclusive: true,
                exact: true,
                message: check.message
              });
            }
            status.dirty();
          }
        } else if (check.kind === "email") {
          if (!emailRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "email",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "emoji") {
          if (!emojiRegex) {
            emojiRegex = new RegExp(_emojiRegex, "u");
          }
          if (!emojiRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "emoji",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "uuid") {
          if (!uuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "uuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid") {
          if (!cuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid2") {
          if (!cuid2Regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid2",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "ulid") {
          if (!ulidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "ulid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "url") {
          try {
            new URL(input.data);
          } catch (_a) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "url",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "regex") {
          check.regex.lastIndex = 0;
          const testResult = check.regex.test(input.data);
          if (!testResult) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "regex",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "trim") {
          input.data = input.data.trim();
        } else if (check.kind === "includes") {
          if (!input.data.includes(check.value, check.position)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { includes: check.value, position: check.position },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "toLowerCase") {
          input.data = input.data.toLowerCase();
        } else if (check.kind === "toUpperCase") {
          input.data = input.data.toUpperCase();
        } else if (check.kind === "startsWith") {
          if (!input.data.startsWith(check.value)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { startsWith: check.value },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "endsWith") {
          if (!input.data.endsWith(check.value)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { endsWith: check.value },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "datetime") {
          const regex = datetimeRegex(check);
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "datetime",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "ip") {
          if (!isValidIP(input.data, check.version)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "ip",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    _regex(regex, validation, message) {
      return this.refinement((data) => regex.test(data), __spreadValues({
        validation,
        code: ZodIssueCode.invalid_string
      }, errorUtil.errToObj(message)));
    }
    _addCheck(check) {
      return new _ZodString(__spreadProps(__spreadValues({}, this._def), {
        checks: [...this._def.checks, check]
      }));
    }
    email(message) {
      return this._addCheck(__spreadValues({ kind: "email" }, errorUtil.errToObj(message)));
    }
    url(message) {
      return this._addCheck(__spreadValues({ kind: "url" }, errorUtil.errToObj(message)));
    }
    emoji(message) {
      return this._addCheck(__spreadValues({ kind: "emoji" }, errorUtil.errToObj(message)));
    }
    uuid(message) {
      return this._addCheck(__spreadValues({ kind: "uuid" }, errorUtil.errToObj(message)));
    }
    cuid(message) {
      return this._addCheck(__spreadValues({ kind: "cuid" }, errorUtil.errToObj(message)));
    }
    cuid2(message) {
      return this._addCheck(__spreadValues({ kind: "cuid2" }, errorUtil.errToObj(message)));
    }
    ulid(message) {
      return this._addCheck(__spreadValues({ kind: "ulid" }, errorUtil.errToObj(message)));
    }
    ip(options) {
      return this._addCheck(__spreadValues({ kind: "ip" }, errorUtil.errToObj(options)));
    }
    datetime(options) {
      var _a;
      if (typeof options === "string") {
        return this._addCheck({
          kind: "datetime",
          precision: null,
          offset: false,
          message: options
        });
      }
      return this._addCheck(__spreadValues({
        kind: "datetime",
        precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
        offset: (_a = options === null || options === void 0 ? void 0 : options.offset) !== null && _a !== void 0 ? _a : false
      }, errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)));
    }
    regex(regex, message) {
      return this._addCheck(__spreadValues({
        kind: "regex",
        regex
      }, errorUtil.errToObj(message)));
    }
    includes(value, options) {
      return this._addCheck(__spreadValues({
        kind: "includes",
        value,
        position: options === null || options === void 0 ? void 0 : options.position
      }, errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)));
    }
    startsWith(value, message) {
      return this._addCheck(__spreadValues({
        kind: "startsWith",
        value
      }, errorUtil.errToObj(message)));
    }
    endsWith(value, message) {
      return this._addCheck(__spreadValues({
        kind: "endsWith",
        value
      }, errorUtil.errToObj(message)));
    }
    min(minLength, message) {
      return this._addCheck(__spreadValues({
        kind: "min",
        value: minLength
      }, errorUtil.errToObj(message)));
    }
    max(maxLength, message) {
      return this._addCheck(__spreadValues({
        kind: "max",
        value: maxLength
      }, errorUtil.errToObj(message)));
    }
    length(len, message) {
      return this._addCheck(__spreadValues({
        kind: "length",
        value: len
      }, errorUtil.errToObj(message)));
    }
    /**
     * @deprecated Use z.string().min(1) instead.
     * @see {@link ZodString.min}
     */
    nonempty(message) {
      return this.min(1, errorUtil.errToObj(message));
    }
    trim() {
      return new _ZodString(__spreadProps(__spreadValues({}, this._def), {
        checks: [...this._def.checks, { kind: "trim" }]
      }));
    }
    toLowerCase() {
      return new _ZodString(__spreadProps(__spreadValues({}, this._def), {
        checks: [...this._def.checks, { kind: "toLowerCase" }]
      }));
    }
    toUpperCase() {
      return new _ZodString(__spreadProps(__spreadValues({}, this._def), {
        checks: [...this._def.checks, { kind: "toUpperCase" }]
      }));
    }
    get isDatetime() {
      return !!this._def.checks.find((ch) => ch.kind === "datetime");
    }
    get isEmail() {
      return !!this._def.checks.find((ch) => ch.kind === "email");
    }
    get isURL() {
      return !!this._def.checks.find((ch) => ch.kind === "url");
    }
    get isEmoji() {
      return !!this._def.checks.find((ch) => ch.kind === "emoji");
    }
    get isUUID() {
      return !!this._def.checks.find((ch) => ch.kind === "uuid");
    }
    get isCUID() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid");
    }
    get isCUID2() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid2");
    }
    get isULID() {
      return !!this._def.checks.find((ch) => ch.kind === "ulid");
    }
    get isIP() {
      return !!this._def.checks.find((ch) => ch.kind === "ip");
    }
    get minLength() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxLength() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
  };
  ZodString.create = (params) => {
    var _a;
    return new ZodString(__spreadValues({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodString,
      coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false
    }, processCreateParams(params)));
  };
  function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = parseInt(step.toFixed(decCount).replace(".", ""));
    return valInt % stepInt / Math.pow(10, decCount);
  }
  var ZodNumber = class _ZodNumber extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
      this.step = this.multipleOf;
    }
    _parse(input) {
      if (this._def.coerce) {
        input.data = Number(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.number) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.number,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      let ctx = void 0;
      const status = new ParseStatus();
      for (const check of this._def.checks) {
        if (check.kind === "int") {
          if (!util.isInteger(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: "integer",
              received: "float",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "number",
              inclusive: check.inclusive,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "number",
              inclusive: check.inclusive,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (floatSafeRemainder(input.data, check.value) !== 0) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "finite") {
          if (!Number.isFinite(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_finite,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new _ZodNumber(__spreadProps(__spreadValues({}, this._def), {
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      }));
    }
    _addCheck(check) {
      return new _ZodNumber(__spreadProps(__spreadValues({}, this._def), {
        checks: [...this._def.checks, check]
      }));
    }
    int(message) {
      return this._addCheck({
        kind: "int",
        message: errorUtil.toString(message)
      });
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    finite(message) {
      return this._addCheck({
        kind: "finite",
        message: errorUtil.toString(message)
      });
    }
    safe(message) {
      return this._addCheck({
        kind: "min",
        inclusive: true,
        value: Number.MIN_SAFE_INTEGER,
        message: errorUtil.toString(message)
      })._addCheck({
        kind: "max",
        inclusive: true,
        value: Number.MAX_SAFE_INTEGER,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
    get isInt() {
      return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
    }
    get isFinite() {
      let max = null, min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
          return true;
        } else if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        } else if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return Number.isFinite(min) && Number.isFinite(max);
    }
  };
  ZodNumber.create = (params) => {
    return new ZodNumber(__spreadValues({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodNumber,
      coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false
    }, processCreateParams(params)));
  };
  var ZodBigInt = class _ZodBigInt extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
    }
    _parse(input) {
      if (this._def.coerce) {
        input.data = BigInt(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.bigint) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.bigint,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      let ctx = void 0;
      const status = new ParseStatus();
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              type: "bigint",
              minimum: check.value,
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              type: "bigint",
              maximum: check.value,
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (input.data % check.value !== BigInt(0)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new _ZodBigInt(__spreadProps(__spreadValues({}, this._def), {
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      }));
    }
    _addCheck(check) {
      return new _ZodBigInt(__spreadProps(__spreadValues({}, this._def), {
        checks: [...this._def.checks, check]
      }));
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
  };
  ZodBigInt.create = (params) => {
    var _a;
    return new ZodBigInt(__spreadValues({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodBigInt,
      coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false
    }, processCreateParams(params)));
  };
  var ZodBoolean = class extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = Boolean(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.boolean) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.boolean,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodBoolean.create = (params) => {
    return new ZodBoolean(__spreadValues({
      typeName: ZodFirstPartyTypeKind.ZodBoolean,
      coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false
    }, processCreateParams(params)));
  };
  var ZodDate = class _ZodDate extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = new Date(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.date) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.date,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      if (isNaN(input.data.getTime())) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_date
        });
        return INVALID;
      }
      const status = new ParseStatus();
      let ctx = void 0;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.getTime() < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              message: check.message,
              inclusive: true,
              exact: false,
              minimum: check.value,
              type: "date"
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.getTime() > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              message: check.message,
              inclusive: true,
              exact: false,
              maximum: check.value,
              type: "date"
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return {
        status: status.value,
        value: new Date(input.data.getTime())
      };
    }
    _addCheck(check) {
      return new _ZodDate(__spreadProps(__spreadValues({}, this._def), {
        checks: [...this._def.checks, check]
      }));
    }
    min(minDate, message) {
      return this._addCheck({
        kind: "min",
        value: minDate.getTime(),
        message: errorUtil.toString(message)
      });
    }
    max(maxDate, message) {
      return this._addCheck({
        kind: "max",
        value: maxDate.getTime(),
        message: errorUtil.toString(message)
      });
    }
    get minDate() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min != null ? new Date(min) : null;
    }
    get maxDate() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max != null ? new Date(max) : null;
    }
  };
  ZodDate.create = (params) => {
    return new ZodDate(__spreadValues({
      checks: [],
      coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
      typeName: ZodFirstPartyTypeKind.ZodDate
    }, processCreateParams(params)));
  };
  var ZodSymbol = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.symbol) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.symbol,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodSymbol.create = (params) => {
    return new ZodSymbol(__spreadValues({
      typeName: ZodFirstPartyTypeKind.ZodSymbol
    }, processCreateParams(params)));
  };
  var ZodUndefined = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.undefined,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodUndefined.create = (params) => {
    return new ZodUndefined(__spreadValues({
      typeName: ZodFirstPartyTypeKind.ZodUndefined
    }, processCreateParams(params)));
  };
  var ZodNull = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.null) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.null,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodNull.create = (params) => {
    return new ZodNull(__spreadValues({
      typeName: ZodFirstPartyTypeKind.ZodNull
    }, processCreateParams(params)));
  };
  var ZodAny = class extends ZodType {
    constructor() {
      super(...arguments);
      this._any = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  };
  ZodAny.create = (params) => {
    return new ZodAny(__spreadValues({
      typeName: ZodFirstPartyTypeKind.ZodAny
    }, processCreateParams(params)));
  };
  var ZodUnknown = class extends ZodType {
    constructor() {
      super(...arguments);
      this._unknown = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  };
  ZodUnknown.create = (params) => {
    return new ZodUnknown(__spreadValues({
      typeName: ZodFirstPartyTypeKind.ZodUnknown
    }, processCreateParams(params)));
  };
  var ZodNever = class extends ZodType {
    _parse(input) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.never,
        received: ctx.parsedType
      });
      return INVALID;
    }
  };
  ZodNever.create = (params) => {
    return new ZodNever(__spreadValues({
      typeName: ZodFirstPartyTypeKind.ZodNever
    }, processCreateParams(params)));
  };
  var ZodVoid = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.void,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodVoid.create = (params) => {
    return new ZodVoid(__spreadValues({
      typeName: ZodFirstPartyTypeKind.ZodVoid
    }, processCreateParams(params)));
  };
  var ZodArray = class _ZodArray extends ZodType {
    _parse(input) {
      const { ctx, status } = this._processInputParams(input);
      const def = this._def;
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (def.exactLength !== null) {
        const tooBig = ctx.data.length > def.exactLength.value;
        const tooSmall = ctx.data.length < def.exactLength.value;
        if (tooBig || tooSmall) {
          addIssueToContext(ctx, {
            code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
            minimum: tooSmall ? def.exactLength.value : void 0,
            maximum: tooBig ? def.exactLength.value : void 0,
            type: "array",
            inclusive: true,
            exact: true,
            message: def.exactLength.message
          });
          status.dirty();
        }
      }
      if (def.minLength !== null) {
        if (ctx.data.length < def.minLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minLength.value,
            type: "array",
            inclusive: true,
            exact: false,
            message: def.minLength.message
          });
          status.dirty();
        }
      }
      if (def.maxLength !== null) {
        if (ctx.data.length > def.maxLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxLength.value,
            type: "array",
            inclusive: true,
            exact: false,
            message: def.maxLength.message
          });
          status.dirty();
        }
      }
      if (ctx.common.async) {
        return Promise.all([...ctx.data].map((item, i) => {
          return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        })).then((result2) => {
          return ParseStatus.mergeArray(status, result2);
        });
      }
      const result = [...ctx.data].map((item, i) => {
        return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      });
      return ParseStatus.mergeArray(status, result);
    }
    get element() {
      return this._def.type;
    }
    min(minLength, message) {
      return new _ZodArray(__spreadProps(__spreadValues({}, this._def), {
        minLength: { value: minLength, message: errorUtil.toString(message) }
      }));
    }
    max(maxLength, message) {
      return new _ZodArray(__spreadProps(__spreadValues({}, this._def), {
        maxLength: { value: maxLength, message: errorUtil.toString(message) }
      }));
    }
    length(len, message) {
      return new _ZodArray(__spreadProps(__spreadValues({}, this._def), {
        exactLength: { value: len, message: errorUtil.toString(message) }
      }));
    }
    nonempty(message) {
      return this.min(1, message);
    }
  };
  ZodArray.create = (schema, params) => {
    return new ZodArray(__spreadValues({
      type: schema,
      minLength: null,
      maxLength: null,
      exactLength: null,
      typeName: ZodFirstPartyTypeKind.ZodArray
    }, processCreateParams(params)));
  };
  function deepPartialify(schema) {
    if (schema instanceof ZodObject) {
      const newShape = {};
      for (const key in schema.shape) {
        const fieldSchema = schema.shape[key];
        newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
      }
      return new ZodObject(__spreadProps(__spreadValues({}, schema._def), {
        shape: () => newShape
      }));
    } else if (schema instanceof ZodArray) {
      return new ZodArray(__spreadProps(__spreadValues({}, schema._def), {
        type: deepPartialify(schema.element)
      }));
    } else if (schema instanceof ZodOptional) {
      return ZodOptional.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodNullable) {
      return ZodNullable.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodTuple) {
      return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
    } else {
      return schema;
    }
  }
  var ZodObject = class _ZodObject extends ZodType {
    constructor() {
      super(...arguments);
      this._cached = null;
      this.nonstrict = this.passthrough;
      this.augment = this.extend;
    }
    _getCached() {
      if (this._cached !== null)
        return this._cached;
      const shape = this._def.shape();
      const keys = util.objectKeys(shape);
      return this._cached = { shape, keys };
    }
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.object) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      const { status, ctx } = this._processInputParams(input);
      const { shape, keys: shapeKeys } = this._getCached();
      const extraKeys = [];
      if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
        for (const key in ctx.data) {
          if (!shapeKeys.includes(key)) {
            extraKeys.push(key);
          }
        }
      }
      const pairs = [];
      for (const key of shapeKeys) {
        const keyValidator = shape[key];
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
      if (this._def.catchall instanceof ZodNever) {
        const unknownKeys = this._def.unknownKeys;
        if (unknownKeys === "passthrough") {
          for (const key of extraKeys) {
            pairs.push({
              key: { status: "valid", value: key },
              value: { status: "valid", value: ctx.data[key] }
            });
          }
        } else if (unknownKeys === "strict") {
          if (extraKeys.length > 0) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.unrecognized_keys,
              keys: extraKeys
            });
            status.dirty();
          }
        } else if (unknownKeys === "strip") ;
        else {
          throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
        }
      } else {
        const catchall = this._def.catchall;
        for (const key of extraKeys) {
          const value = ctx.data[key];
          pairs.push({
            key: { status: "valid", value: key },
            value: catchall._parse(
              new ParseInputLazyPath(ctx, value, ctx.path, key)
              //, ctx.child(key), value, getParsedType(value)
            ),
            alwaysSet: key in ctx.data
          });
        }
      }
      if (ctx.common.async) {
        return Promise.resolve().then(() => __async(this, null, function* () {
          const syncPairs = [];
          for (const pair of pairs) {
            const key = yield pair.key;
            syncPairs.push({
              key,
              value: yield pair.value,
              alwaysSet: pair.alwaysSet
            });
          }
          return syncPairs;
        })).then((syncPairs) => {
          return ParseStatus.mergeObjectSync(status, syncPairs);
        });
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get shape() {
      return this._def.shape();
    }
    strict(message) {
      errorUtil.errToObj;
      return new _ZodObject(__spreadValues(__spreadProps(__spreadValues({}, this._def), {
        unknownKeys: "strict"
      }), message !== void 0 ? {
        errorMap: (issue, ctx) => {
          var _a, _b, _c, _d;
          const defaultError = (_c = (_b = (_a = this._def).errorMap) === null || _b === void 0 ? void 0 : _b.call(_a, issue, ctx).message) !== null && _c !== void 0 ? _c : ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: (_d = errorUtil.errToObj(message).message) !== null && _d !== void 0 ? _d : defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}));
    }
    strip() {
      return new _ZodObject(__spreadProps(__spreadValues({}, this._def), {
        unknownKeys: "strip"
      }));
    }
    passthrough() {
      return new _ZodObject(__spreadProps(__spreadValues({}, this._def), {
        unknownKeys: "passthrough"
      }));
    }
    // const AugmentFactory =
    //   <Def extends ZodObjectDef>(def: Def) =>
    //   <Augmentation extends ZodRawShape>(
    //     augmentation: Augmentation
    //   ): ZodObject<
    //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
    //     Def["unknownKeys"],
    //     Def["catchall"]
    //   > => {
    //     return new ZodObject({
    //       ...def,
    //       shape: () => ({
    //         ...def.shape(),
    //         ...augmentation,
    //       }),
    //     }) as any;
    //   };
    extend(augmentation) {
      return new _ZodObject(__spreadProps(__spreadValues({}, this._def), {
        shape: () => __spreadValues(__spreadValues({}, this._def.shape()), augmentation)
      }));
    }
    /**
     * Prior to zod@1.0.12 there was a bug in the
     * inferred type of merged objects. Please
     * upgrade if you are experiencing issues.
     */
    merge(merging) {
      const merged = new _ZodObject({
        unknownKeys: merging._def.unknownKeys,
        catchall: merging._def.catchall,
        shape: () => __spreadValues(__spreadValues({}, this._def.shape()), merging._def.shape()),
        typeName: ZodFirstPartyTypeKind.ZodObject
      });
      return merged;
    }
    // merge<
    //   Incoming extends AnyZodObject,
    //   Augmentation extends Incoming["shape"],
    //   NewOutput extends {
    //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
    //       ? Augmentation[k]["_output"]
    //       : k extends keyof Output
    //       ? Output[k]
    //       : never;
    //   },
    //   NewInput extends {
    //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
    //       ? Augmentation[k]["_input"]
    //       : k extends keyof Input
    //       ? Input[k]
    //       : never;
    //   }
    // >(
    //   merging: Incoming
    // ): ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"],
    //   NewOutput,
    //   NewInput
    // > {
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    setKey(key, schema) {
      return this.augment({ [key]: schema });
    }
    // merge<Incoming extends AnyZodObject>(
    //   merging: Incoming
    // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
    // ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"]
    // > {
    //   // const mergedShape = objectUtil.mergeShapes(
    //   //   this._def.shape(),
    //   //   merging._def.shape()
    //   // );
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    catchall(index) {
      return new _ZodObject(__spreadProps(__spreadValues({}, this._def), {
        catchall: index
      }));
    }
    pick(mask) {
      const shape = {};
      util.objectKeys(mask).forEach((key) => {
        if (mask[key] && this.shape[key]) {
          shape[key] = this.shape[key];
        }
      });
      return new _ZodObject(__spreadProps(__spreadValues({}, this._def), {
        shape: () => shape
      }));
    }
    omit(mask) {
      const shape = {};
      util.objectKeys(this.shape).forEach((key) => {
        if (!mask[key]) {
          shape[key] = this.shape[key];
        }
      });
      return new _ZodObject(__spreadProps(__spreadValues({}, this._def), {
        shape: () => shape
      }));
    }
    /**
     * @deprecated
     */
    deepPartial() {
      return deepPartialify(this);
    }
    partial(mask) {
      const newShape = {};
      util.objectKeys(this.shape).forEach((key) => {
        const fieldSchema = this.shape[key];
        if (mask && !mask[key]) {
          newShape[key] = fieldSchema;
        } else {
          newShape[key] = fieldSchema.optional();
        }
      });
      return new _ZodObject(__spreadProps(__spreadValues({}, this._def), {
        shape: () => newShape
      }));
    }
    required(mask) {
      const newShape = {};
      util.objectKeys(this.shape).forEach((key) => {
        if (mask && !mask[key]) {
          newShape[key] = this.shape[key];
        } else {
          const fieldSchema = this.shape[key];
          let newField = fieldSchema;
          while (newField instanceof ZodOptional) {
            newField = newField._def.innerType;
          }
          newShape[key] = newField;
        }
      });
      return new _ZodObject(__spreadProps(__spreadValues({}, this._def), {
        shape: () => newShape
      }));
    }
    keyof() {
      return createZodEnum(util.objectKeys(this.shape));
    }
  };
  ZodObject.create = (shape, params) => {
    return new ZodObject(__spreadValues({
      shape: () => shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject
    }, processCreateParams(params)));
  };
  ZodObject.strictCreate = (shape, params) => {
    return new ZodObject(__spreadValues({
      shape: () => shape,
      unknownKeys: "strict",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject
    }, processCreateParams(params)));
  };
  ZodObject.lazycreate = (shape, params) => {
    return new ZodObject(__spreadValues({
      shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject
    }, processCreateParams(params)));
  };
  var ZodUnion = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const options = this._def.options;
      function handleResults(results) {
        for (const result of results) {
          if (result.result.status === "valid") {
            return result.result;
          }
        }
        for (const result of results) {
          if (result.result.status === "dirty") {
            ctx.common.issues.push(...result.ctx.common.issues);
            return result.result;
          }
        }
        const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return Promise.all(options.map((option) => __async(this, null, function* () {
          const childCtx = __spreadProps(__spreadValues({}, ctx), {
            common: __spreadProps(__spreadValues({}, ctx.common), {
              issues: []
            }),
            parent: null
          });
          return {
            result: yield option._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx
            }),
            ctx: childCtx
          };
        }))).then(handleResults);
      } else {
        let dirty = void 0;
        const issues = [];
        for (const option of options) {
          const childCtx = __spreadProps(__spreadValues({}, ctx), {
            common: __spreadProps(__spreadValues({}, ctx.common), {
              issues: []
            }),
            parent: null
          });
          const result = option._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          });
          if (result.status === "valid") {
            return result;
          } else if (result.status === "dirty" && !dirty) {
            dirty = { result, ctx: childCtx };
          }
          if (childCtx.common.issues.length) {
            issues.push(childCtx.common.issues);
          }
        }
        if (dirty) {
          ctx.common.issues.push(...dirty.ctx.common.issues);
          return dirty.result;
        }
        const unionErrors = issues.map((issues2) => new ZodError(issues2));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
    }
    get options() {
      return this._def.options;
    }
  };
  ZodUnion.create = (types, params) => {
    return new ZodUnion(__spreadValues({
      options: types,
      typeName: ZodFirstPartyTypeKind.ZodUnion
    }, processCreateParams(params)));
  };
  var getDiscriminator = (type) => {
    if (type instanceof ZodLazy) {
      return getDiscriminator(type.schema);
    } else if (type instanceof ZodEffects) {
      return getDiscriminator(type.innerType());
    } else if (type instanceof ZodLiteral) {
      return [type.value];
    } else if (type instanceof ZodEnum) {
      return type.options;
    } else if (type instanceof ZodNativeEnum) {
      return Object.keys(type.enum);
    } else if (type instanceof ZodDefault) {
      return getDiscriminator(type._def.innerType);
    } else if (type instanceof ZodUndefined) {
      return [void 0];
    } else if (type instanceof ZodNull) {
      return [null];
    } else {
      return null;
    }
  };
  var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const discriminator = this.discriminator;
      const discriminatorValue = ctx.data[discriminator];
      const option = this.optionsMap.get(discriminatorValue);
      if (!option) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union_discriminator,
          options: Array.from(this.optionsMap.keys()),
          path: [discriminator]
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return option._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      } else {
        return option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      }
    }
    get discriminator() {
      return this._def.discriminator;
    }
    get options() {
      return this._def.options;
    }
    get optionsMap() {
      return this._def.optionsMap;
    }
    /**
     * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
     * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
     * have a different value for each object in the union.
     * @param discriminator the name of the discriminator property
     * @param types an array of object schemas
     * @param params
     */
    static create(discriminator, options, params) {
      const optionsMap = /* @__PURE__ */ new Map();
      for (const type of options) {
        const discriminatorValues = getDiscriminator(type.shape[discriminator]);
        if (!discriminatorValues) {
          throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
        }
        for (const value of discriminatorValues) {
          if (optionsMap.has(value)) {
            throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
          }
          optionsMap.set(value, type);
        }
      }
      return new _ZodDiscriminatedUnion(__spreadValues({
        typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
        discriminator,
        options,
        optionsMap
      }, processCreateParams(params)));
    }
  };
  function mergeValues(a, b) {
    const aType = getParsedType(a);
    const bType = getParsedType(b);
    if (a === b) {
      return { valid: true, data: a };
    } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
      const bKeys = util.objectKeys(b);
      const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
      const newObj = __spreadValues(__spreadValues({}, a), b);
      for (const key of sharedKeys) {
        const sharedValue = mergeValues(a[key], b[key]);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newObj[key] = sharedValue.data;
      }
      return { valid: true, data: newObj };
    } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
      if (a.length !== b.length) {
        return { valid: false };
      }
      const newArray = [];
      for (let index = 0; index < a.length; index++) {
        const itemA = a[index];
        const itemB = b[index];
        const sharedValue = mergeValues(itemA, itemB);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newArray.push(sharedValue.data);
      }
      return { valid: true, data: newArray };
    } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
      return { valid: true, data: a };
    } else {
      return { valid: false };
    }
  }
  var ZodIntersection = class extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const handleParsed = (parsedLeft, parsedRight) => {
        if (isAborted(parsedLeft) || isAborted(parsedRight)) {
          return INVALID;
        }
        const merged = mergeValues(parsedLeft.value, parsedRight.value);
        if (!merged.valid) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_intersection_types
          });
          return INVALID;
        }
        if (isDirty(parsedLeft) || isDirty(parsedRight)) {
          status.dirty();
        }
        return { status: status.value, value: merged.data };
      };
      if (ctx.common.async) {
        return Promise.all([
          this._def.left._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }),
          this._def.right._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          })
        ]).then(([left, right]) => handleParsed(left, right));
      } else {
        return handleParsed(this._def.left._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }), this._def.right._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }));
      }
    }
  };
  ZodIntersection.create = (left, right, params) => {
    return new ZodIntersection(__spreadValues({
      left,
      right,
      typeName: ZodFirstPartyTypeKind.ZodIntersection
    }, processCreateParams(params)));
  };
  var ZodTuple = class _ZodTuple extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (ctx.data.length < this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: this._def.items.length,
          inclusive: true,
          exact: false,
          type: "array"
        });
        return INVALID;
      }
      const rest = this._def.rest;
      if (!rest && ctx.data.length > this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: this._def.items.length,
          inclusive: true,
          exact: false,
          type: "array"
        });
        status.dirty();
      }
      const items = [...ctx.data].map((item, itemIndex) => {
        const schema = this._def.items[itemIndex] || this._def.rest;
        if (!schema)
          return null;
        return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
      }).filter((x) => !!x);
      if (ctx.common.async) {
        return Promise.all(items).then((results) => {
          return ParseStatus.mergeArray(status, results);
        });
      } else {
        return ParseStatus.mergeArray(status, items);
      }
    }
    get items() {
      return this._def.items;
    }
    rest(rest) {
      return new _ZodTuple(__spreadProps(__spreadValues({}, this._def), {
        rest
      }));
    }
  };
  ZodTuple.create = (schemas, params) => {
    if (!Array.isArray(schemas)) {
      throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    }
    return new ZodTuple(__spreadValues({
      items: schemas,
      typeName: ZodFirstPartyTypeKind.ZodTuple,
      rest: null
    }, processCreateParams(params)));
  };
  var ZodRecord = class _ZodRecord extends ZodType {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const pairs = [];
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      for (const key in ctx.data) {
        pairs.push({
          key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
          value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key))
        });
      }
      if (ctx.common.async) {
        return ParseStatus.mergeObjectAsync(status, pairs);
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get element() {
      return this._def.valueType;
    }
    static create(first, second, third) {
      if (second instanceof ZodType) {
        return new _ZodRecord(__spreadValues({
          keyType: first,
          valueType: second,
          typeName: ZodFirstPartyTypeKind.ZodRecord
        }, processCreateParams(third)));
      }
      return new _ZodRecord(__spreadValues({
        keyType: ZodString.create(),
        valueType: first,
        typeName: ZodFirstPartyTypeKind.ZodRecord
      }, processCreateParams(second)));
    }
  };
  var ZodMap = class extends ZodType {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.map) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.map,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      const pairs = [...ctx.data.entries()].map(([key, value], index) => {
        return {
          key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
          value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
        };
      });
      if (ctx.common.async) {
        const finalMap = /* @__PURE__ */ new Map();
        return Promise.resolve().then(() => __async(this, null, function* () {
          for (const pair of pairs) {
            const key = yield pair.key;
            const value = yield pair.value;
            if (key.status === "aborted" || value.status === "aborted") {
              return INVALID;
            }
            if (key.status === "dirty" || value.status === "dirty") {
              status.dirty();
            }
            finalMap.set(key.value, value.value);
          }
          return { status: status.value, value: finalMap };
        }));
      } else {
        const finalMap = /* @__PURE__ */ new Map();
        for (const pair of pairs) {
          const key = pair.key;
          const value = pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      }
    }
  };
  ZodMap.create = (keyType, valueType, params) => {
    return new ZodMap(__spreadValues({
      valueType,
      keyType,
      typeName: ZodFirstPartyTypeKind.ZodMap
    }, processCreateParams(params)));
  };
  var ZodSet = class _ZodSet extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.set) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.set,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const def = this._def;
      if (def.minSize !== null) {
        if (ctx.data.size < def.minSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minSize.value,
            type: "set",
            inclusive: true,
            exact: false,
            message: def.minSize.message
          });
          status.dirty();
        }
      }
      if (def.maxSize !== null) {
        if (ctx.data.size > def.maxSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxSize.value,
            type: "set",
            inclusive: true,
            exact: false,
            message: def.maxSize.message
          });
          status.dirty();
        }
      }
      const valueType = this._def.valueType;
      function finalizeSet(elements2) {
        const parsedSet = /* @__PURE__ */ new Set();
        for (const element of elements2) {
          if (element.status === "aborted")
            return INVALID;
          if (element.status === "dirty")
            status.dirty();
          parsedSet.add(element.value);
        }
        return { status: status.value, value: parsedSet };
      }
      const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
      if (ctx.common.async) {
        return Promise.all(elements).then((elements2) => finalizeSet(elements2));
      } else {
        return finalizeSet(elements);
      }
    }
    min(minSize, message) {
      return new _ZodSet(__spreadProps(__spreadValues({}, this._def), {
        minSize: { value: minSize, message: errorUtil.toString(message) }
      }));
    }
    max(maxSize, message) {
      return new _ZodSet(__spreadProps(__spreadValues({}, this._def), {
        maxSize: { value: maxSize, message: errorUtil.toString(message) }
      }));
    }
    size(size, message) {
      return this.min(size, message).max(size, message);
    }
    nonempty(message) {
      return this.min(1, message);
    }
  };
  ZodSet.create = (valueType, params) => {
    return new ZodSet(__spreadValues({
      valueType,
      minSize: null,
      maxSize: null,
      typeName: ZodFirstPartyTypeKind.ZodSet
    }, processCreateParams(params)));
  };
  var ZodFunction = class _ZodFunction extends ZodType {
    constructor() {
      super(...arguments);
      this.validate = this.implement;
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.function) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.function,
          received: ctx.parsedType
        });
        return INVALID;
      }
      function makeArgsIssue(args, error) {
        return makeIssue({
          data: args,
          path: ctx.path,
          errorMaps: [
            ctx.common.contextualErrorMap,
            ctx.schemaErrorMap,
            getErrorMap(),
            errorMap
          ].filter((x) => !!x),
          issueData: {
            code: ZodIssueCode.invalid_arguments,
            argumentsError: error
          }
        });
      }
      function makeReturnsIssue(returns, error) {
        return makeIssue({
          data: returns,
          path: ctx.path,
          errorMaps: [
            ctx.common.contextualErrorMap,
            ctx.schemaErrorMap,
            getErrorMap(),
            errorMap
          ].filter((x) => !!x),
          issueData: {
            code: ZodIssueCode.invalid_return_type,
            returnTypeError: error
          }
        });
      }
      const params = { errorMap: ctx.common.contextualErrorMap };
      const fn = ctx.data;
      if (this._def.returns instanceof ZodPromise) {
        const me = this;
        return OK(function(...args) {
          return __async(this, null, function* () {
            const error = new ZodError([]);
            const parsedArgs = yield me._def.args.parseAsync(args, params).catch((e) => {
              error.addIssue(makeArgsIssue(args, e));
              throw error;
            });
            const result = yield Reflect.apply(fn, this, parsedArgs);
            const parsedReturns = yield me._def.returns._def.type.parseAsync(result, params).catch((e) => {
              error.addIssue(makeReturnsIssue(result, e));
              throw error;
            });
            return parsedReturns;
          });
        });
      } else {
        const me = this;
        return OK(function(...args) {
          const parsedArgs = me._def.args.safeParse(args, params);
          if (!parsedArgs.success) {
            throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
          }
          const result = Reflect.apply(fn, this, parsedArgs.data);
          const parsedReturns = me._def.returns.safeParse(result, params);
          if (!parsedReturns.success) {
            throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
          }
          return parsedReturns.data;
        });
      }
    }
    parameters() {
      return this._def.args;
    }
    returnType() {
      return this._def.returns;
    }
    args(...items) {
      return new _ZodFunction(__spreadProps(__spreadValues({}, this._def), {
        args: ZodTuple.create(items).rest(ZodUnknown.create())
      }));
    }
    returns(returnType) {
      return new _ZodFunction(__spreadProps(__spreadValues({}, this._def), {
        returns: returnType
      }));
    }
    implement(func) {
      const validatedFunc = this.parse(func);
      return validatedFunc;
    }
    strictImplement(func) {
      const validatedFunc = this.parse(func);
      return validatedFunc;
    }
    static create(args, returns, params) {
      return new _ZodFunction(__spreadValues({
        args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
        returns: returns || ZodUnknown.create(),
        typeName: ZodFirstPartyTypeKind.ZodFunction
      }, processCreateParams(params)));
    }
  };
  var ZodLazy = class extends ZodType {
    get schema() {
      return this._def.getter();
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const lazySchema = this._def.getter();
      return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
    }
  };
  ZodLazy.create = (getter, params) => {
    return new ZodLazy(__spreadValues({
      getter,
      typeName: ZodFirstPartyTypeKind.ZodLazy
    }, processCreateParams(params)));
  };
  var ZodLiteral = class extends ZodType {
    _parse(input) {
      if (input.data !== this._def.value) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_literal,
          expected: this._def.value
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
    get value() {
      return this._def.value;
    }
  };
  ZodLiteral.create = (value, params) => {
    return new ZodLiteral(__spreadValues({
      value,
      typeName: ZodFirstPartyTypeKind.ZodLiteral
    }, processCreateParams(params)));
  };
  function createZodEnum(values, params) {
    return new ZodEnum(__spreadValues({
      values,
      typeName: ZodFirstPartyTypeKind.ZodEnum
    }, processCreateParams(params)));
  }
  var ZodEnum = class _ZodEnum extends ZodType {
    _parse(input) {
      if (typeof input.data !== "string") {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (this._def.values.indexOf(input.data) === -1) {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get options() {
      return this._def.values;
    }
    get enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Values() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    extract(values) {
      return _ZodEnum.create(values);
    }
    exclude(values) {
      return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)));
    }
  };
  ZodEnum.create = createZodEnum;
  var ZodNativeEnum = class extends ZodType {
    _parse(input) {
      const nativeEnumValues = util.getValidEnumValues(this._def.values);
      const ctx = this._getOrReturnCtx(input);
      if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (nativeEnumValues.indexOf(input.data) === -1) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get enum() {
      return this._def.values;
    }
  };
  ZodNativeEnum.create = (values, params) => {
    return new ZodNativeEnum(__spreadValues({
      values,
      typeName: ZodFirstPartyTypeKind.ZodNativeEnum
    }, processCreateParams(params)));
  };
  var ZodPromise = class extends ZodType {
    unwrap() {
      return this._def.type;
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.promise,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
      return OK(promisified.then((data) => {
        return this._def.type.parseAsync(data, {
          path: ctx.path,
          errorMap: ctx.common.contextualErrorMap
        });
      }));
    }
  };
  ZodPromise.create = (schema, params) => {
    return new ZodPromise(__spreadValues({
      type: schema,
      typeName: ZodFirstPartyTypeKind.ZodPromise
    }, processCreateParams(params)));
  };
  var ZodEffects = class extends ZodType {
    innerType() {
      return this._def.schema;
    }
    sourceType() {
      return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const effect = this._def.effect || null;
      const checkCtx = {
        addIssue: (arg) => {
          addIssueToContext(ctx, arg);
          if (arg.fatal) {
            status.abort();
          } else {
            status.dirty();
          }
        },
        get path() {
          return ctx.path;
        }
      };
      checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
      if (effect.type === "preprocess") {
        const processed = effect.transform(ctx.data, checkCtx);
        if (ctx.common.issues.length) {
          return {
            status: "dirty",
            value: ctx.data
          };
        }
        if (ctx.common.async) {
          return Promise.resolve(processed).then((processed2) => {
            return this._def.schema._parseAsync({
              data: processed2,
              path: ctx.path,
              parent: ctx
            });
          });
        } else {
          return this._def.schema._parseSync({
            data: processed,
            path: ctx.path,
            parent: ctx
          });
        }
      }
      if (effect.type === "refinement") {
        const executeRefinement = (acc) => {
          const result = effect.refinement(acc, checkCtx);
          if (ctx.common.async) {
            return Promise.resolve(result);
          }
          if (result instanceof Promise) {
            throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
          }
          return acc;
        };
        if (ctx.common.async === false) {
          const inner = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          executeRefinement(inner.value);
          return { status: status.value, value: inner.value };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
            if (inner.status === "aborted")
              return INVALID;
            if (inner.status === "dirty")
              status.dirty();
            return executeRefinement(inner.value).then(() => {
              return { status: status.value, value: inner.value };
            });
          });
        }
      }
      if (effect.type === "transform") {
        if (ctx.common.async === false) {
          const base = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (!isValid(base))
            return base;
          const result = effect.transform(base.value, checkCtx);
          if (result instanceof Promise) {
            throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
          }
          return { status: status.value, value: result };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
            if (!isValid(base))
              return base;
            return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({ status: status.value, value: result }));
          });
        }
      }
      util.assertNever(effect);
    }
  };
  ZodEffects.create = (schema, effect, params) => {
    return new ZodEffects(__spreadValues({
      schema,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect
    }, processCreateParams(params)));
  };
  ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
    return new ZodEffects(__spreadValues({
      schema,
      effect: { type: "preprocess", transform: preprocess },
      typeName: ZodFirstPartyTypeKind.ZodEffects
    }, processCreateParams(params)));
  };
  var ZodOptional = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.undefined) {
        return OK(void 0);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodOptional.create = (type, params) => {
    return new ZodOptional(__spreadValues({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodOptional
    }, processCreateParams(params)));
  };
  var ZodNullable = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.null) {
        return OK(null);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodNullable.create = (type, params) => {
    return new ZodNullable(__spreadValues({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodNullable
    }, processCreateParams(params)));
  };
  var ZodDefault = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      let data = ctx.data;
      if (ctx.parsedType === ZodParsedType.undefined) {
        data = this._def.defaultValue();
      }
      return this._def.innerType._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    removeDefault() {
      return this._def.innerType;
    }
  };
  ZodDefault.create = (type, params) => {
    return new ZodDefault(__spreadValues({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodDefault,
      defaultValue: typeof params.default === "function" ? params.default : () => params.default
    }, processCreateParams(params)));
  };
  var ZodCatch = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const newCtx = __spreadProps(__spreadValues({}, ctx), {
        common: __spreadProps(__spreadValues({}, ctx.common), {
          issues: []
        })
      });
      const result = this._def.innerType._parse({
        data: newCtx.data,
        path: newCtx.path,
        parent: __spreadValues({}, newCtx)
      });
      if (isAsync(result)) {
        return result.then((result2) => {
          return {
            status: "valid",
            value: result2.status === "valid" ? result2.value : this._def.catchValue({
              get error() {
                return new ZodError(newCtx.common.issues);
              },
              input: newCtx.data
            })
          };
        });
      } else {
        return {
          status: "valid",
          value: result.status === "valid" ? result.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      }
    }
    removeCatch() {
      return this._def.innerType;
    }
  };
  ZodCatch.create = (type, params) => {
    return new ZodCatch(__spreadValues({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodCatch,
      catchValue: typeof params.catch === "function" ? params.catch : () => params.catch
    }, processCreateParams(params)));
  };
  var ZodNaN = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.nan) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.nan,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
  };
  ZodNaN.create = (params) => {
    return new ZodNaN(__spreadValues({
      typeName: ZodFirstPartyTypeKind.ZodNaN
    }, processCreateParams(params)));
  };
  var BRAND = Symbol("zod_brand");
  var ZodBranded = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const data = ctx.data;
      return this._def.type._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    unwrap() {
      return this._def.type;
    }
  };
  var ZodPipeline = class _ZodPipeline extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.common.async) {
        const handleAsync = () => __async(this, null, function* () {
          const inResult = yield this._def.in._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inResult.status === "aborted")
            return INVALID;
          if (inResult.status === "dirty") {
            status.dirty();
            return DIRTY(inResult.value);
          } else {
            return this._def.out._parseAsync({
              data: inResult.value,
              path: ctx.path,
              parent: ctx
            });
          }
        });
        return handleAsync();
      } else {
        const inResult = this._def.in._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return {
            status: "dirty",
            value: inResult.value
          };
        } else {
          return this._def.out._parseSync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      }
    }
    static create(a, b) {
      return new _ZodPipeline({
        in: a,
        out: b,
        typeName: ZodFirstPartyTypeKind.ZodPipeline
      });
    }
  };
  var ZodReadonly = class extends ZodType {
    _parse(input) {
      const result = this._def.innerType._parse(input);
      if (isValid(result)) {
        result.value = Object.freeze(result.value);
      }
      return result;
    }
  };
  ZodReadonly.create = (type, params) => {
    return new ZodReadonly(__spreadValues({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodReadonly
    }, processCreateParams(params)));
  };
  var custom = (check, params = {}, fatal) => {
    if (check)
      return ZodAny.create().superRefine((data, ctx) => {
        var _a, _b;
        if (!check(data)) {
          const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
          const _fatal = (_b = (_a = p.fatal) !== null && _a !== void 0 ? _a : fatal) !== null && _b !== void 0 ? _b : true;
          const p2 = typeof p === "string" ? { message: p } : p;
          ctx.addIssue(__spreadProps(__spreadValues({ code: "custom" }, p2), { fatal: _fatal }));
        }
      });
    return ZodAny.create();
  };
  var late = {
    object: ZodObject.lazycreate
  };
  var ZodFirstPartyTypeKind;
  (function(ZodFirstPartyTypeKind2) {
    ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
    ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
    ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
    ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
    ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
    ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
  })(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
  var instanceOfType = (cls, params = {
    message: `Input not instance of ${cls.name}`
  }) => custom((data) => data instanceof cls, params);
  var stringType = ZodString.create;
  var numberType = ZodNumber.create;
  var nanType = ZodNaN.create;
  var bigIntType = ZodBigInt.create;
  var booleanType = ZodBoolean.create;
  var dateType = ZodDate.create;
  var symbolType = ZodSymbol.create;
  var undefinedType = ZodUndefined.create;
  var nullType = ZodNull.create;
  var anyType = ZodAny.create;
  var unknownType = ZodUnknown.create;
  var neverType = ZodNever.create;
  var voidType = ZodVoid.create;
  var arrayType = ZodArray.create;
  var objectType = ZodObject.create;
  var strictObjectType = ZodObject.strictCreate;
  var unionType = ZodUnion.create;
  var discriminatedUnionType = ZodDiscriminatedUnion.create;
  var intersectionType = ZodIntersection.create;
  var tupleType = ZodTuple.create;
  var recordType = ZodRecord.create;
  var mapType = ZodMap.create;
  var setType = ZodSet.create;
  var functionType = ZodFunction.create;
  var lazyType = ZodLazy.create;
  var literalType = ZodLiteral.create;
  var enumType = ZodEnum.create;
  var nativeEnumType = ZodNativeEnum.create;
  var promiseType = ZodPromise.create;
  var effectsType = ZodEffects.create;
  var optionalType = ZodOptional.create;
  var nullableType = ZodNullable.create;
  var preprocessType = ZodEffects.createWithPreprocess;
  var pipelineType = ZodPipeline.create;
  var ostring = () => stringType().optional();
  var onumber = () => numberType().optional();
  var oboolean = () => booleanType().optional();
  var coerce = {
    string: (arg) => ZodString.create(__spreadProps(__spreadValues({}, arg), { coerce: true })),
    number: (arg) => ZodNumber.create(__spreadProps(__spreadValues({}, arg), { coerce: true })),
    boolean: (arg) => ZodBoolean.create(__spreadProps(__spreadValues({}, arg), {
      coerce: true
    })),
    bigint: (arg) => ZodBigInt.create(__spreadProps(__spreadValues({}, arg), { coerce: true })),
    date: (arg) => ZodDate.create(__spreadProps(__spreadValues({}, arg), { coerce: true }))
  };
  var NEVER = INVALID;
  var z = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    defaultErrorMap: errorMap,
    setErrorMap,
    getErrorMap,
    makeIssue,
    EMPTY_PATH,
    addIssueToContext,
    ParseStatus,
    INVALID,
    DIRTY,
    OK,
    isAborted,
    isDirty,
    isValid,
    isAsync,
    get util() {
      return util;
    },
    get objectUtil() {
      return objectUtil;
    },
    ZodParsedType,
    getParsedType,
    ZodType,
    ZodString,
    ZodNumber,
    ZodBigInt,
    ZodBoolean,
    ZodDate,
    ZodSymbol,
    ZodUndefined,
    ZodNull,
    ZodAny,
    ZodUnknown,
    ZodNever,
    ZodVoid,
    ZodArray,
    ZodObject,
    ZodUnion,
    ZodDiscriminatedUnion,
    ZodIntersection,
    ZodTuple,
    ZodRecord,
    ZodMap,
    ZodSet,
    ZodFunction,
    ZodLazy,
    ZodLiteral,
    ZodEnum,
    ZodNativeEnum,
    ZodPromise,
    ZodEffects,
    ZodTransformer: ZodEffects,
    ZodOptional,
    ZodNullable,
    ZodDefault,
    ZodCatch,
    ZodNaN,
    BRAND,
    ZodBranded,
    ZodPipeline,
    ZodReadonly,
    custom,
    Schema: ZodType,
    ZodSchema: ZodType,
    late,
    get ZodFirstPartyTypeKind() {
      return ZodFirstPartyTypeKind;
    },
    coerce,
    any: anyType,
    array: arrayType,
    bigint: bigIntType,
    boolean: booleanType,
    date: dateType,
    discriminatedUnion: discriminatedUnionType,
    effect: effectsType,
    "enum": enumType,
    "function": functionType,
    "instanceof": instanceOfType,
    intersection: intersectionType,
    lazy: lazyType,
    literal: literalType,
    map: mapType,
    nan: nanType,
    nativeEnum: nativeEnumType,
    never: neverType,
    "null": nullType,
    nullable: nullableType,
    number: numberType,
    object: objectType,
    oboolean,
    onumber,
    optional: optionalType,
    ostring,
    pipeline: pipelineType,
    preprocess: preprocessType,
    promise: promiseType,
    record: recordType,
    set: setType,
    strictObject: strictObjectType,
    string: stringType,
    symbol: symbolType,
    transformer: effectsType,
    tuple: tupleType,
    "undefined": undefinedType,
    union: unionType,
    unknown: unknownType,
    "void": voidType,
    NEVER,
    ZodIssueCode,
    quotelessJson,
    ZodError
  });

  // src/tools/document.ts
  function getDocumentInfo() {
    return __async(this, null, function* () {
      return {
        name: figma.root.name,
        currentPageId: figma.currentPage.id,
        pages: figma.root.children.map((p) => ({ id: p.id, name: p.name }))
      };
    });
  }
  function getCurrentPage() {
    return __async(this, null, function* () {
      yield figma.currentPage.loadAsync();
      const page = figma.currentPage;
      return {
        id: page.id,
        name: page.name,
        children: page.children.map((node) => ({ id: node.id, name: node.name, type: node.type }))
      };
    });
  }
  function getPages() {
    return __async(this, null, function* () {
      return {
        currentPageId: figma.currentPage.id,
        pages: figma.root.children.map((p) => ({ id: p.id, name: p.name }))
      };
    });
  }
  function setCurrentPage(params) {
    return __async(this, null, function* () {
      let page;
      if (params.pageId) {
        page = yield figma.getNodeByIdAsync(params.pageId);
        if (!page || page.type !== "PAGE") throw new Error(`Page not found: ${params.pageId}`);
      } else if (params.pageName) {
        const name = params.pageName.toLowerCase();
        page = figma.root.children.find((p) => p.name.toLowerCase() === name);
        if (!page) page = figma.root.children.find((p) => p.name.toLowerCase().includes(name));
        if (!page) throw new Error(`Page not found: ${params.pageName}`);
      }
      yield figma.setCurrentPageAsync(page);
      return { id: page.id, name: page.name };
    });
  }
  function createPage(params) {
    return __async(this, null, function* () {
      const name = (params == null ? void 0 : params.name) || "New Page";
      const page = figma.createPage();
      page.name = name;
      return { id: page.id };
    });
  }
  function renamePage(params) {
    return __async(this, null, function* () {
      if (!(params == null ? void 0 : params.newName)) throw new Error("Missing newName parameter");
      let page;
      if (params.pageId) {
        page = yield figma.getNodeByIdAsync(params.pageId);
        if (!page || page.type !== "PAGE") throw new Error(`Page not found: ${params.pageId}`);
      } else {
        page = figma.currentPage;
      }
      page.name = params.newName;
      return "ok";
    });
  }
  var figmaHandlers = {
    get_document_info: getDocumentInfo,
    get_current_page: getCurrentPage,
    get_pages: getPages,
    set_current_page: setCurrentPage,
    create_page: createPage,
    rename_page: renamePage
  };

  // src/utils/coercion.ts
  var flexBool = (inner) => z.preprocess((v) => {
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
    return v;
  }, inner);
  var flexJson = (inner) => z.preprocess((v) => {
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch (e) {
        return v;
      }
    }
    return v;
  }, inner);
  var flexNum = (inner) => z.preprocess((v) => {
    if (typeof v === "string") {
      const n = Number(v);
      if (!isNaN(n) && v.trim() !== "") return n;
    }
    return v;
  }, inner);

  // src/tools/selection.ts
  function getSelection() {
    return __async(this, null, function* () {
      return {
        selectionCount: figma.currentPage.selection.length,
        selection: figma.currentPage.selection.map((node) => ({
          id: node.id,
          name: node.name,
          type: node.type,
          visible: node.visible
        }))
      };
    });
  }
  function readMyDesign(params) {
    return __async(this, null, function* () {
      const sel = figma.currentPage.selection;
      if (sel.length === 0) {
        return { selectionCount: 0, _hint: "Nothing selected. Use set_selection to select nodes first, or use get_node_info with specific node IDs." };
      }
      const { filterFigmaNode: filterFigmaNode2 } = yield Promise.resolve().then(() => (init_filter_node(), filter_node_exports));
      const depth2 = params == null ? void 0 : params.depth;
      const nodes = yield Promise.all(
        sel.map((node) => figma.getNodeByIdAsync(node.id))
      );
      const validNodes = nodes.filter((n) => n !== null);
      const responses = yield Promise.all(
        validNodes.map((node) => __async(this, null, function* () {
          const response = yield node.exportAsync({ format: "JSON_REST_V1" });
          return {
            nodeId: node.id,
            document: filterFigmaNode2(response.document, depth2 !== void 0 ? depth2 : -1)
          };
        }))
      );
      return { selectionCount: responses.length, nodes: responses };
    });
  }
  function setSelection(params) {
    return __async(this, null, function* () {
      const nodeIds2 = params == null ? void 0 : params.nodeIds;
      if (!nodeIds2 || !Array.isArray(nodeIds2) || nodeIds2.length === 0) {
        throw new Error("Missing or empty nodeIds");
      }
      const nodes = [];
      const notFound = [];
      for (const id of nodeIds2) {
        const node = yield figma.getNodeByIdAsync(id);
        if (node) nodes.push(node);
        else notFound.push(id);
      }
      if (nodes.length === 0) throw new Error(`No valid nodes found: ${nodeIds2.join(", ")}`);
      figma.currentPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
      return {
        count: nodes.length,
        selectedNodes: nodes.map((n) => ({ name: n.name, id: n.id })),
        notFoundIds: notFound.length > 0 ? notFound : void 0
      };
    });
  }
  function zoomIntoView(params) {
    return __async(this, null, function* () {
      var _a;
      if (!((_a = params == null ? void 0 : params.nodeIds) == null ? void 0 : _a.length)) throw new Error("Missing nodeIds");
      const nodes = [];
      const notFound = [];
      for (const id of params.nodeIds) {
        const node = yield figma.getNodeByIdAsync(id);
        if (node) nodes.push(node);
        else notFound.push(id);
      }
      if (nodes.length === 0) throw new Error("None of the specified nodes were found");
      figma.viewport.scrollAndZoomIntoView(nodes);
      return {
        viewportCenter: figma.viewport.center,
        viewportZoom: figma.viewport.zoom,
        nodeCount: nodes.length,
        notFound: notFound.length > 0 ? notFound : void 0
      };
    });
  }
  function setViewport(params) {
    return __async(this, null, function* () {
      if (!params) throw new Error("Missing parameters");
      if (params.center) figma.viewport.center = { x: params.center.x, y: params.center.y };
      if (params.zoom !== void 0) figma.viewport.zoom = params.zoom;
      return { center: figma.viewport.center, zoom: figma.viewport.zoom, bounds: figma.viewport.bounds };
    });
  }
  var figmaHandlers2 = {
    get_selection: getSelection,
    read_my_design: readMyDesign,
    set_selection: setSelection,
    // Legacy aliases for backward compat
    set_focus: (params) => __async(void 0, null, function* () {
      return setSelection({ nodeIds: [params.nodeId] });
    }),
    set_selections: setSelection,
    zoom_into_view: zoomIntoView,
    set_viewport: setViewport
  };

  // src/tools/node-info.ts
  init_filter_node();
  function pickFields(node, keep) {
    if (!node || typeof node !== "object") return node;
    const out = {};
    for (const key of Object.keys(node)) {
      if (keep.has(key)) {
        out[key] = key === "children" && Array.isArray(node.children) ? node.children.map((c) => pickFields(c, keep)) : node[key];
      }
    }
    return out;
  }
  function getNodeInfo(params) {
    return __async(this, null, function* () {
      const nodeIds2 = params.nodeIds || (params.nodeId ? [params.nodeId] : []);
      const depth2 = params.depth;
      const fields = params.fields;
      const keep = (fields == null ? void 0 : fields.length) ? /* @__PURE__ */ new Set([...fields, "id", "name", "type", "children", "parentId", "parentName", "parentType"]) : null;
      const results = yield Promise.all(
        nodeIds2.map((nodeId2) => __async(this, null, function* () {
          const node = yield figma.getNodeByIdAsync(nodeId2);
          if (!node) return { nodeId: nodeId2, error: `Node not found: ${nodeId2}` };
          const response = yield node.exportAsync({ format: "JSON_REST_V1" });
          let filtered = filterFigmaNode(response.document, depth2 !== void 0 ? depth2 : -1);
          if (filtered && node.parent) {
            filtered.parentId = node.parent.id;
            filtered.parentName = node.parent.name;
            filtered.parentType = node.parent.type;
          }
          if (filtered && node.type === "INSTANCE") {
            try {
              const main = yield node.getMainComponentAsync();
              if (main) {
                filtered.componentId = main.id;
                filtered.componentName = main.name;
              }
            } catch (e) {
            }
          }
          if (keep && filtered) filtered = pickFields(filtered, keep);
          return filtered;
        }))
      );
      return { results };
    });
  }
  function getNodeCss(params) {
    return __async(this, null, function* () {
      if (!(params == null ? void 0 : params.nodeId)) throw new Error("Missing nodeId");
      const node = yield figma.getNodeByIdAsync(params.nodeId);
      if (!node) throw new Error(`Node not found: ${params.nodeId}`);
      if (!("getCSSAsync" in node)) throw new Error("Node does not support CSS export");
      const css = yield node.getCSSAsync();
      return { id: node.id, name: node.name, css };
    });
  }
  function searchNodes(params) {
    return __async(this, null, function* () {
      if (!params) throw new Error("Missing parameters");
      let scopeNode;
      if (params.scopeNodeId) {
        scopeNode = yield figma.getNodeByIdAsync(params.scopeNodeId);
        if (!scopeNode) throw new Error(`Scope node not found: ${params.scopeNodeId}`);
      } else {
        yield figma.currentPage.loadAsync();
        scopeNode = figma.currentPage;
      }
      if (!("findAll" in scopeNode)) throw new Error("Scope node does not support searching");
      let results;
      if (params.types && !params.query) {
        results = scopeNode.findAllWithCriteria({ types: params.types });
      } else {
        results = scopeNode.findAll((node) => {
          var _a;
          if (((_a = params.types) == null ? void 0 : _a.length) && !params.types.includes(node.type)) return false;
          if (params.query) {
            const q = params.query.toLowerCase();
            return params.caseSensitive ? node.name.includes(params.query) : node.name.toLowerCase().includes(q);
          }
          return true;
        });
      }
      const totalCount = results.length;
      const limit = params.limit || 50;
      const offset = params.offset || 0;
      results = results.slice(offset, offset + limit);
      return {
        totalCount,
        returned: results.length,
        offset,
        limit,
        results: results.map((node) => {
          const entry = { id: node.id, name: node.name, type: node.type };
          if (node.parent) {
            entry.parentId = node.parent.id;
            entry.parentName = node.parent.name;
          }
          if ("absoluteBoundingBox" in node && node.absoluteBoundingBox) {
            entry.bounds = node.absoluteBoundingBox;
          } else if ("x" in node) {
            entry.x = node.x;
            entry.y = node.y;
            if ("width" in node) {
              entry.width = node.width;
              entry.height = node.height;
            }
          }
          return entry;
        })
      };
    });
  }
  function exportNodeAsImage(params) {
    return __async(this, null, function* () {
      const { customBase64Encode: customBase64Encode2 } = yield Promise.resolve().then(() => (init_base64(), base64_exports));
      const { nodeId: nodeId2, scale = 1 } = params || {};
      const format = params.format || "PNG";
      if (!nodeId2) throw new Error("Missing nodeId");
      const node = yield figma.getNodeByIdAsync(nodeId2);
      if (!node) throw new Error(`Node not found: ${nodeId2}`);
      if (!("exportAsync" in node)) throw new Error(`Node does not support export: ${nodeId2}`);
      const bytes = yield node.exportAsync({
        format,
        constraint: { type: "SCALE", value: scale }
      });
      const mimeMap = {
        PNG: "image/png",
        JPG: "image/jpeg",
        SVG: "image/svg+xml",
        PDF: "application/pdf"
      };
      return {
        nodeId: nodeId2,
        format,
        scale,
        mimeType: mimeMap[format] || "application/octet-stream",
        imageData: customBase64Encode2(bytes)
      };
    });
  }
  var figmaHandlers3 = {
    get_node_info: getNodeInfo,
    // Legacy single-node alias
    get_nodes_info: (params) => __async(void 0, null, function* () {
      return getNodeInfo({ nodeIds: params.nodeIds, depth: params.depth });
    }),
    get_node_css: getNodeCss,
    search_nodes: searchNodes,
    export_node_as_image: exportNodeAsImage
  };

  // src/tools/schemas.ts
  var nodeId = z.string().describe("Node ID");
  var nodeIds = flexJson(z.array(z.string())).describe("Array of node IDs");
  var parentId = z.string().optional().describe("Parent node ID. Omit to place on current page.");
  var depth = z.coerce.number().optional().describe("Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited.");
  var xPos = z.coerce.number().optional().describe("X position (default: 0)");
  var yPos = z.coerce.number().optional().describe("Y position (default: 0)");
  function parseHex(hex) {
    const m = hex.match(/^#?([0-9a-f]{3,8})$/i);
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    if (h.length !== 6 && h.length !== 8) return null;
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    if (h.length === 8) return { r, g, b, a: parseInt(h.slice(6, 8), 16) / 255 };
    return { r, g, b };
  }
  var colorRgba = z.preprocess((v) => {
    var _a;
    if (typeof v === "string") return (_a = parseHex(v)) != null ? _a : v;
    return v;
  }, z.object({
    r: z.coerce.number().min(0).max(1),
    g: z.coerce.number().min(0).max(1),
    b: z.coerce.number().min(0).max(1),
    a: z.coerce.number().min(0).max(1).optional()
  }));
  var effectEntry = z.object({
    type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]),
    color: flexJson(colorRgba.optional()),
    offset: flexJson(z.object({ x: z.coerce.number(), y: z.coerce.number() }).optional()),
    radius: z.coerce.number(),
    spread: z.coerce.number().optional(),
    visible: flexBool(z.boolean().optional()),
    blendMode: z.string().optional()
  });

  // src/tools/create-shape.ts
  init_helpers();
  var rectItem = z.object({
    name: z.string().optional().describe("Name (default: 'Rectangle')"),
    x: xPos,
    y: yPos,
    width: z.coerce.number().optional().describe("Width (default: 100)"),
    height: z.coerce.number().optional().describe("Height (default: 100)"),
    parentId
  });
  var ellipseItem = z.object({
    name: z.string().optional().describe("Layer name (default: 'Ellipse')"),
    x: xPos,
    y: yPos,
    width: z.coerce.number().optional().describe("Width (default: 100)"),
    height: z.coerce.number().optional().describe("Height (default: 100)"),
    parentId
  });
  var lineItem = z.object({
    name: z.string().optional().describe("Layer name (default: 'Line')"),
    x: xPos,
    y: yPos,
    length: z.coerce.number().optional().describe("Length (default: 100)"),
    rotation: z.coerce.number().optional().describe("Rotation in degrees (default: 0)"),
    parentId
  });
  var sectionItem = z.object({
    name: z.string().optional().describe("Name (default: 'Section')"),
    x: xPos,
    y: yPos,
    width: z.coerce.number().optional().describe("Width (default: 500)"),
    height: z.coerce.number().optional().describe("Height (default: 500)"),
    parentId
  });
  var svgItem = z.object({
    svg: z.string().describe("SVG markup string"),
    name: z.string().optional().describe("Layer name (default: 'SVG')"),
    x: xPos,
    y: yPos,
    parentId
  });
  var boolOpItem = z.object({
    nodeIds: flexJson(z.array(z.string())).describe("Array of node IDs (min 2)"),
    operation: z.enum(["UNION", "INTERSECT", "SUBTRACT", "EXCLUDE"]).describe("Boolean operation type"),
    name: z.string().optional().describe("Name for the result. Omit to auto-generate.")
  });
  function createSingleRect(p) {
    return __async(this, null, function* () {
      var _a, _b, _c, _d;
      const rect = figma.createRectangle();
      rect.x = (_a = p.x) != null ? _a : 0;
      rect.y = (_b = p.y) != null ? _b : 0;
      rect.resize((_c = p.width) != null ? _c : 100, (_d = p.height) != null ? _d : 100);
      rect.name = p.name || "Rectangle";
      yield appendToParent(rect, p.parentId);
      return { id: rect.id };
    });
  }
  function createSingleEllipse(p) {
    return __async(this, null, function* () {
      var _a, _b, _c, _d;
      const el = figma.createEllipse();
      el.x = (_a = p.x) != null ? _a : 0;
      el.y = (_b = p.y) != null ? _b : 0;
      el.resize((_c = p.width) != null ? _c : 100, (_d = p.height) != null ? _d : 100);
      if (p.name) el.name = p.name;
      yield appendToParent(el, p.parentId);
      return { id: el.id };
    });
  }
  function createSingleLine(p) {
    return __async(this, null, function* () {
      var _a, _b, _c;
      const line = figma.createLine();
      line.x = (_a = p.x) != null ? _a : 0;
      line.y = (_b = p.y) != null ? _b : 0;
      line.resize((_c = p.length) != null ? _c : 100, 0);
      if (p.rotation) line.rotation = p.rotation;
      if (p.name) line.name = p.name;
      line.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
      yield appendToParent(line, p.parentId);
      return { id: line.id };
    });
  }
  function createSingleSection(p) {
    return __async(this, null, function* () {
      var _a, _b, _c, _d;
      const section = figma.createSection();
      section.x = (_a = p.x) != null ? _a : 0;
      section.y = (_b = p.y) != null ? _b : 0;
      section.resizeWithoutConstraints((_c = p.width) != null ? _c : 500, (_d = p.height) != null ? _d : 500);
      section.name = p.name || "Section";
      yield appendToParent(section, p.parentId);
      return { id: section.id };
    });
  }
  function createSingleSvg(p) {
    return __async(this, null, function* () {
      var _a, _b;
      const node = figma.createNodeFromSvg(p.svg);
      node.x = (_a = p.x) != null ? _a : 0;
      node.y = (_b = p.y) != null ? _b : 0;
      if (p.name) node.name = p.name;
      yield appendToParent(node, p.parentId);
      return { id: node.id, type: node.type };
    });
  }
  function createSingleBoolOp(p) {
    return __async(this, null, function* () {
      var _a;
      if (!((_a = p.nodeIds) == null ? void 0 : _a.length) || p.nodeIds.length < 2) throw new Error("Need at least 2 nodes");
      const nodes = [];
      for (const id of p.nodeIds) {
        const node = yield figma.getNodeByIdAsync(id);
        if (!node) throw new Error(`Node not found: ${id}`);
        nodes.push(node);
      }
      const boolOp = figma.createBooleanOperation();
      boolOp.booleanOperation = p.operation;
      for (const node of nodes) boolOp.appendChild(node.clone());
      if (p.name) boolOp.name = p.name;
      return { id: boolOp.id };
    });
  }
  var figmaHandlers4 = {
    create_rectangle: (p) => batchHandler(p, createSingleRect),
    create_ellipse: (p) => batchHandler(p, createSingleEllipse),
    create_line: (p) => batchHandler(p, createSingleLine),
    create_section: (p) => batchHandler(p, createSingleSection),
    create_node_from_svg: (p) => batchHandler(p, createSingleSvg),
    create_boolean_operation: (p) => batchHandler(p, createSingleBoolOp)
  };

  // src/tools/create-frame.ts
  init_helpers();
  var frameItem = z.object({
    name: z.string().optional().describe("Frame name (default: 'Frame')"),
    x: xPos,
    y: yPos,
    width: z.coerce.number().optional().describe("Width (default: 100)"),
    height: z.coerce.number().optional().describe("Height (default: 100)"),
    parentId,
    fillColor: flexJson(colorRgba.optional()).describe('Fill color. Hex "#FF0000" or {r,g,b,a?} 0-1. Default: no fill (empty fills array).'),
    strokeColor: flexJson(colorRgba.optional()).describe('Stroke color. Hex "#FF0000" or {r,g,b,a?} 0-1. Default: none.'),
    strokeWeight: z.coerce.number().positive().optional().describe("Stroke weight (default: 1)"),
    cornerRadius: z.coerce.number().min(0).optional().describe("Corner radius (default: 0)"),
    layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Auto-layout direction (default: NONE)"),
    layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap (default: NO_WRAP)"),
    paddingTop: z.coerce.number().optional().describe("Top padding (default: 0)"),
    paddingRight: z.coerce.number().optional().describe("Right padding (default: 0)"),
    paddingBottom: z.coerce.number().optional().describe("Bottom padding (default: 0)"),
    paddingLeft: z.coerce.number().optional().describe("Left padding (default: 0)"),
    primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional(),
    counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional(),
    layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional(),
    layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional(),
    itemSpacing: z.coerce.number().optional().describe("Spacing between children (default: 0)"),
    // Style/variable references
    fillStyleName: z.string().optional().describe("Apply a fill paint style by name (case-insensitive). Omit to skip."),
    strokeStyleName: z.string().optional().describe("Apply a stroke paint style by name. Omit to skip."),
    fillVariableId: z.string().optional().describe("Bind a color variable to the fill. Creates a solid fill and binds the variable to fills/0/color."),
    strokeVariableId: z.string().optional().describe("Bind a color variable to the stroke. Creates a solid stroke and binds the variable to strokes/0/color.")
  });
  var autoLayoutItem = z.object({
    nodeIds: flexJson(z.array(z.string())).describe("Array of node IDs to wrap"),
    name: z.string().optional().describe("Frame name (default: 'Auto Layout')"),
    layoutMode: z.enum(["HORIZONTAL", "VERTICAL"]).optional().describe("Direction (default: VERTICAL)"),
    itemSpacing: z.coerce.number().optional().describe("Spacing between children (default: 0)"),
    paddingTop: z.coerce.number().optional().describe("Top padding (default: 0)"),
    paddingRight: z.coerce.number().optional().describe("Right padding (default: 0)"),
    paddingBottom: z.coerce.number().optional().describe("Bottom padding (default: 0)"),
    paddingLeft: z.coerce.number().optional().describe("Left padding (default: 0)"),
    primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional(),
    counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional(),
    layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional(),
    layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional(),
    layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional()
  });
  function colorConflictHints(prop, variableId, styleName, color, tokenized) {
    const sources = [variableId && "VariableId", styleName && "StyleName", color && "Color"].filter(Boolean);
    if (sources.length > 1) {
      const used = variableId ? "VariableId" : styleName ? "StyleName" : "Color";
      const ignored = sources.filter((s) => s !== used);
      return [`Multiple ${prop} sources \u2014 used ${prop}${used}, ignored ${ignored.map((s) => prop + s).join(", ")}. Pass only one: ${prop}VariableId (variable token), ${prop}StyleName (paint style), or ${prop}Color (one-off).`];
    }
    if (sources.length === 1 && color && !tokenized) {
      return [`Hardcoded ${prop} color. Use ${prop}StyleName to apply a paint style, or ${prop}VariableId to bind a color variable. Only use ${prop}Color for one-off colors not in your design system.`];
    }
    return [];
  }
  function resolveStyleId(name, styleType) {
    return __async(this, null, function* () {
      var _a;
      if (styleType === "paint") {
        const styles = yield figma.getLocalPaintStylesAsync();
        const exact = styles.find((s) => s.name === name);
        if (exact) return exact.id;
        const fuzzy = styles.find((s) => s.name.toLowerCase().includes(name.toLowerCase()));
        return (_a = fuzzy == null ? void 0 : fuzzy.id) != null ? _a : null;
      }
      return null;
    });
  }
  function createSingleFrame(p) {
    return __async(this, null, function* () {
      const {
        x = 0,
        y = 0,
        width = 100,
        height = 100,
        name = "Frame",
        parentId: parentId2,
        fillColor,
        strokeColor,
        strokeWeight,
        cornerRadius,
        layoutMode = "NONE",
        layoutWrap = "NO_WRAP",
        paddingTop = 0,
        paddingRight = 0,
        paddingBottom = 0,
        paddingLeft = 0,
        primaryAxisAlignItems = "MIN",
        counterAxisAlignItems = "MIN",
        layoutSizingHorizontal = "FIXED",
        layoutSizingVertical = "FIXED",
        itemSpacing = 0,
        fillStyleName,
        strokeStyleName,
        fillVariableId,
        strokeVariableId
      } = p;
      const frame = figma.createFrame();
      frame.x = x;
      frame.y = y;
      frame.resize(width, height);
      frame.name = name;
      frame.fills = [];
      if (cornerRadius !== void 0) frame.cornerRadius = cornerRadius;
      const deferH = parentId2 && layoutSizingHorizontal === "FILL";
      const deferV = parentId2 && layoutSizingVertical === "FILL";
      if (layoutMode !== "NONE") {
        frame.layoutMode = layoutMode;
        frame.layoutWrap = layoutWrap;
        frame.paddingTop = paddingTop;
        frame.paddingRight = paddingRight;
        frame.paddingBottom = paddingBottom;
        frame.paddingLeft = paddingLeft;
        frame.primaryAxisAlignItems = primaryAxisAlignItems;
        frame.counterAxisAlignItems = counterAxisAlignItems;
        frame.layoutSizingHorizontal = deferH ? "FIXED" : layoutSizingHorizontal;
        frame.layoutSizingVertical = deferV ? "FIXED" : layoutSizingVertical;
        frame.itemSpacing = itemSpacing;
      }
      let fillTokenized = false;
      if (fillVariableId) {
        const v = yield figma.variables.getVariableByIdAsync(fillVariableId);
        if (v) {
          frame.fills = [solidPaint(fillColor || { r: 0, g: 0, b: 0 })];
          const bound = figma.variables.setBoundVariableForPaint(frame.fills[0], "color", v);
          frame.fills = [bound];
          fillTokenized = true;
        }
      } else if (fillStyleName) {
        const sid = yield resolveStyleId(fillStyleName, "paint");
        if (sid) {
          yield frame.setFillStyleIdAsync(sid);
          fillTokenized = true;
        }
      } else if (fillColor) {
        frame.fills = [solidPaint(fillColor)];
      }
      let strokeTokenized = false;
      if (strokeVariableId) {
        const v = yield figma.variables.getVariableByIdAsync(strokeVariableId);
        if (v) {
          frame.strokes = [solidPaint(strokeColor || { r: 0, g: 0, b: 0 })];
          const bound = figma.variables.setBoundVariableForPaint(frame.strokes[0], "color", v);
          frame.strokes = [bound];
          strokeTokenized = true;
        }
      } else if (strokeStyleName) {
        const sid = yield resolveStyleId(strokeStyleName, "paint");
        if (sid) {
          yield frame.setStrokeStyleIdAsync(sid);
          strokeTokenized = true;
        }
      } else if (strokeColor) {
        frame.strokes = [solidPaint(strokeColor)];
      }
      if (strokeWeight !== void 0) frame.strokeWeight = strokeWeight;
      const parent = yield appendToParent(frame, parentId2);
      if (parent) {
        if (deferH) {
          try {
            frame.layoutSizingHorizontal = "FILL";
          } catch (e) {
          }
        }
        if (deferV) {
          try {
            frame.layoutSizingVertical = "FILL";
          } catch (e) {
          }
        }
      }
      const result = { id: frame.id };
      const hints = [];
      hints.push(...colorConflictHints("fill", fillVariableId, fillStyleName, fillColor, fillTokenized));
      hints.push(...colorConflictHints("stroke", strokeVariableId, strokeStyleName, strokeColor, strokeTokenized));
      if (hints.length > 0) {
        hints.push("Run lint_node after building to catch these patterns across your design.");
        result._hint = hints.join(" ");
      }
      return result;
    });
  }
  function createSingleAutoLayout(p) {
    return __async(this, null, function* () {
      var _a, _b, _c, _d, _e, _f;
      if (!((_a = p.nodeIds) == null ? void 0 : _a.length)) throw new Error("Missing nodeIds");
      const nodes = [];
      for (const id of p.nodeIds) {
        const node = yield figma.getNodeByIdAsync(id);
        if (!node) throw new Error(`Node not found: ${id}`);
        nodes.push(node);
      }
      const originalParent = nodes[0].parent || figma.currentPage;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        if ("x" in n && "y" in n && "width" in n && "height" in n) {
          const nx = n.x, ny = n.y, nw = n.width, nh = n.height;
          if (nx < minX) minX = nx;
          if (ny < minY) minY = ny;
          if (nx + nw > maxX) maxX = nx + nw;
          if (ny + nh > maxY) maxY = ny + nh;
        }
      }
      const frame = figma.createFrame();
      frame.name = p.name || "Auto Layout";
      frame.fills = [];
      if (minX !== Infinity) {
        frame.x = minX;
        frame.y = minY;
        frame.resize(maxX - minX, maxY - minY);
      }
      if ("appendChild" in originalParent) originalParent.appendChild(frame);
      for (const node of nodes) frame.appendChild(node);
      frame.layoutMode = p.layoutMode || "VERTICAL";
      frame.itemSpacing = (_b = p.itemSpacing) != null ? _b : 0;
      frame.paddingTop = (_c = p.paddingTop) != null ? _c : 0;
      frame.paddingRight = (_d = p.paddingRight) != null ? _d : 0;
      frame.paddingBottom = (_e = p.paddingBottom) != null ? _e : 0;
      frame.paddingLeft = (_f = p.paddingLeft) != null ? _f : 0;
      if (p.primaryAxisAlignItems) frame.primaryAxisAlignItems = p.primaryAxisAlignItems;
      if (p.counterAxisAlignItems) frame.counterAxisAlignItems = p.counterAxisAlignItems;
      frame.layoutSizingHorizontal = p.layoutSizingHorizontal || "HUG";
      frame.layoutSizingVertical = p.layoutSizingVertical || "HUG";
      if (p.layoutWrap) frame.layoutWrap = p.layoutWrap;
      return { id: frame.id };
    });
  }
  var figmaHandlers5 = {
    create_frame: (p) => batchHandler(p, createSingleFrame),
    create_auto_layout: (p) => batchHandler(p, createSingleAutoLayout)
  };

  // src/tools/create-text.ts
  init_helpers();
  var textItem = z.object({
    text: z.string().describe("Text content"),
    name: z.string().optional().describe("Layer name (default: text content)"),
    x: xPos,
    y: yPos,
    fontSize: z.coerce.number().optional().describe("Font size (default: 14)"),
    fontWeight: z.coerce.number().optional().describe("Font weight: 100-900 (default: 400)"),
    fontColor: flexJson(colorRgba.optional()).describe('Font color. Hex "#000000" or {r,g,b,a?} 0-1. Default: black.'),
    fontColorVariableId: z.string().optional().describe("Bind a color variable to the text fill instead of hardcoded fontColor."),
    parentId,
    textStyleId: z.string().optional().describe("Text style ID to apply (overrides fontSize/fontWeight). Omit to skip."),
    textStyleName: z.string().optional().describe("Text style name (case-insensitive match). Omit to skip."),
    layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing. FILL auto-sets textAutoResize to HEIGHT."),
    layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: HUG)"),
    textAutoResize: z.enum(["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]).optional().describe("Text auto-resize behavior (default: WIDTH_AND_HEIGHT when FILL)")
  });
  function getFontStyle2(weight) {
    const map = {
      100: "Thin",
      200: "Extra Light",
      300: "Light",
      400: "Regular",
      500: "Medium",
      600: "Semi Bold",
      700: "Bold",
      800: "Extra Bold",
      900: "Black"
    };
    return map[weight] || "Regular";
  }
  function createTextBatch(params) {
    return __async(this, null, function* () {
      var _a, _b, _c, _d, _e, _f;
      const items = params.items || [params];
      const depth2 = params.depth;
      const fontKeys = /* @__PURE__ */ new Set();
      for (const p of items) {
        const style = getFontStyle2(p.fontWeight || 400);
        fontKeys.add(`Inter::${style}`);
      }
      const styleNames = /* @__PURE__ */ new Set();
      for (const p of items) {
        if (p.textStyleName && !p.textStyleId) styleNames.add(p.textStyleName);
      }
      let textStyles = null;
      if (styleNames.size > 0) {
        textStyles = yield figma.getLocalTextStylesAsync();
      }
      const resolvedTextStyleMap = /* @__PURE__ */ new Map();
      for (const p of items) {
        let sid = p.textStyleId;
        if (!sid && p.textStyleName && textStyles) {
          const exact = textStyles.find((s) => s.name === p.textStyleName);
          if (exact) sid = exact.id;
          else {
            const fuzzy = textStyles.find((s) => s.name.toLowerCase().includes(p.textStyleName.toLowerCase()));
            if (fuzzy) sid = fuzzy.id;
          }
        }
        if (sid && !resolvedTextStyleMap.has(sid)) {
          const s = yield figma.getStyleByIdAsync(sid);
          if ((s == null ? void 0 : s.type) === "TEXT") {
            resolvedTextStyleMap.set(sid, s);
            const fn = s.fontName;
            if (fn) fontKeys.add(`${fn.family}::${fn.style}`);
          }
        }
      }
      yield Promise.all(
        [...fontKeys].map((key) => {
          const [family, style] = key.split("::");
          return figma.loadFontAsync({ family, style });
        })
      );
      const { setCharacters: setCharacters2 } = yield Promise.resolve().then(() => (init_figma_helpers(), figma_helpers_exports));
      const results = [];
      for (const p of items) {
        try {
          const {
            x = 0,
            y = 0,
            text = "Text",
            fontSize = 14,
            fontWeight = 400,
            fontColor,
            fontColorVariableId,
            name = "",
            parentId: parentId2,
            textStyleId,
            textStyleName,
            layoutSizingHorizontal,
            layoutSizingVertical,
            textAutoResize
          } = p;
          const textNode = figma.createText();
          textNode.x = x;
          textNode.y = y;
          textNode.name = name || text;
          const style = getFontStyle2(fontWeight);
          textNode.fontName = { family: "Inter", style };
          textNode.fontSize = parseInt(String(fontSize));
          yield setCharacters2(textNode, text);
          let colorTokenized = false;
          const fc = fontColor || { r: 0, g: 0, b: 0, a: 1 };
          textNode.fills = [{
            type: "SOLID",
            color: { r: (_a = fc.r) != null ? _a : 0, g: (_b = fc.g) != null ? _b : 0, b: (_c = fc.b) != null ? _c : 0 },
            opacity: (_d = fc.a) != null ? _d : 1
          }];
          if (fontColorVariableId) {
            const v = yield figma.variables.getVariableByIdAsync(fontColorVariableId);
            if (v) {
              const bound = figma.variables.setBoundVariableForPaint(textNode.fills[0], "color", v);
              textNode.fills = [bound];
              colorTokenized = true;
            }
          }
          let resolvedStyleId = textStyleId;
          if (!resolvedStyleId && textStyleName && textStyles) {
            const exact = textStyles.find((s) => s.name === textStyleName);
            if (exact) resolvedStyleId = exact.id;
            else {
              const fuzzy = textStyles.find((s) => s.name.toLowerCase().includes(textStyleName.toLowerCase()));
              if (fuzzy) resolvedStyleId = fuzzy.id;
            }
          }
          if (resolvedStyleId) {
            const cached = resolvedTextStyleMap.get(resolvedStyleId);
            if (cached) yield textNode.setTextStyleIdAsync(cached.id);
          }
          yield appendToParent(textNode, parentId2);
          if (textAutoResize) {
            textNode.textAutoResize = textAutoResize;
          } else if (layoutSizingHorizontal === "FILL" || layoutSizingHorizontal === "FIXED") {
            textNode.textAutoResize = "HEIGHT";
          }
          if (layoutSizingHorizontal) {
            try {
              textNode.layoutSizingHorizontal = layoutSizingHorizontal;
            } catch (e) {
            }
          }
          if (layoutSizingVertical) {
            try {
              textNode.layoutSizingVertical = layoutSizingVertical;
            } catch (e) {
            }
          }
          let result = { id: textNode.id };
          if (depth2 !== void 0) {
            const { nodeSnapshot: nodeSnapshot2 } = yield Promise.resolve().then(() => (init_helpers(), helpers_exports));
            const snapshot = yield nodeSnapshot2(textNode.id, depth2);
            if (snapshot) result = __spreadValues(__spreadValues({}, result), snapshot);
          }
          const hints = [];
          if (fontColor && fontColorVariableId) {
            hints.push("Multiple font color sources \u2014 used fontColorVariableId, ignored fontColor. Pass only one: fontColorVariableId (variable token) or fontColor (one-off).");
          } else if (fontColor && !colorTokenized) {
            const isNeutral = fontColor.r === 0 && fontColor.g === 0 && fontColor.b === 0 || fontColor.r === 1 && fontColor.g === 1 && fontColor.b === 1;
            const parent = textNode.parent;
            const parentHasBoundFill = parent && "boundVariables" in parent && ((_f = (_e = parent.boundVariables) == null ? void 0 : _e.fills) == null ? void 0 : _f.length) > 0;
            if (!(isNeutral && parentHasBoundFill)) {
              hints.push("Hardcoded font color. Use fontColorVariableId to bind a color variable. Only use fontColor for one-off colors not in your design system.");
            }
          }
          if (textStyleName && textStyleId) {
            hints.push("Both textStyleName and textStyleId provided \u2014 used textStyleId. Pass only one: textStyleName (by name lookup) or textStyleId (direct ID).");
          } else if (!resolvedStyleId) {
            hints.push("No text style applied. Use textStyleName to apply a text style that controls fontSize, fontWeight, and lineHeight together.");
          }
          if (hints.length > 0) {
            hints.push("Run lint_node after building to catch these patterns across your design.");
            result._hint = hints.join(" ");
          }
          results.push(result);
        } catch (e) {
          results.push({ error: e.message });
        }
      }
      return { results };
    });
  }
  var figmaHandlers6 = {
    create_text: createTextBatch
  };

  // src/tools/modify-node.ts
  init_helpers();
  var moveItem = z.object({
    nodeId,
    x: z.coerce.number().describe("New X"),
    y: z.coerce.number().describe("New Y")
  });
  var resizeItem = z.object({
    nodeId,
    width: z.coerce.number().positive().describe("New width"),
    height: z.coerce.number().positive().describe("New height")
  });
  var deleteItem = z.object({
    nodeId: z.string().describe("Node ID to delete")
  });
  var cloneItem = z.object({
    nodeId: z.string().describe("Node ID to clone"),
    parentId: z.string().optional().describe("Parent for the clone (e.g. a page ID). Defaults to same parent as original."),
    x: z.coerce.number().optional().describe("New X for clone. Omit to keep original position."),
    y: z.coerce.number().optional().describe("New Y for clone. Omit to keep original position.")
  });
  var insertItem = z.object({
    parentId: z.string().describe("Parent node ID"),
    childId: z.string().describe("Child node ID to move"),
    index: z.coerce.number().optional().describe("Index to insert at (0=first). Omit to append.")
  });
  function moveSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!("x" in node)) throw new Error(`Node does not support position: ${p.nodeId}`);
      node.x = p.x;
      node.y = p.y;
      return {};
    });
  }
  function resizeSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if ("resize" in node) node.resize(p.width, p.height);
      else if ("resizeWithoutConstraints" in node) node.resizeWithoutConstraints(p.width, p.height);
      else throw new Error(`Node does not support resize: ${p.nodeId}`);
      return {};
    });
  }
  function deleteSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      node.remove();
      return {};
    });
  }
  function cloneSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      const clone = node.clone();
      if (p.x !== void 0 && "x" in clone) {
        clone.x = p.x;
        clone.y = p.y;
      }
      if (p.parentId) {
        const parent = yield figma.getNodeByIdAsync(p.parentId);
        if (!parent || !("appendChild" in parent)) throw new Error(`Invalid parent: ${p.parentId}`);
        parent.appendChild(clone);
      } else if (node.parent) {
        node.parent.appendChild(clone);
      } else {
        figma.currentPage.appendChild(clone);
      }
      return { id: clone.id };
    });
  }
  function insertSingle(p) {
    return __async(this, null, function* () {
      const parent = yield figma.getNodeByIdAsync(p.parentId);
      if (!parent) throw new Error(`Parent not found: ${p.parentId}`);
      if (!("insertChild" in parent)) throw new Error(`Parent does not support children: ${p.parentId}. Only FRAME, COMPONENT, GROUP, SECTION, and PAGE nodes can have children.`);
      const child = yield figma.getNodeByIdAsync(p.childId);
      if (!child) throw new Error(`Child not found: ${p.childId}`);
      if (p.index !== void 0) parent.insertChild(p.index, child);
      else parent.appendChild(child);
      return {};
    });
  }
  var figmaHandlers7 = {
    move_node: (p) => batchHandler(p, moveSingle),
    resize_node: (p) => batchHandler(p, resizeSingle),
    delete_node: (p) => batchHandler(p, deleteSingle),
    // Legacy alias
    delete_multiple_nodes: (p) => __async(void 0, null, function* () {
      return batchHandler({ items: (p.nodeIds || []).map((id) => ({ nodeId: id })) }, deleteSingle);
    }),
    clone_node: (p) => batchHandler(p, cloneSingle),
    insert_child: (p) => batchHandler(p, insertSingle)
  };

  // src/tools/fill-stroke.ts
  init_helpers();
  var fillItem = z.object({
    nodeId,
    color: flexJson(colorRgba.optional()).describe('Fill color. Hex "#FF0000" or {r,g,b,a?} 0-1. Ignored when styleName is set.'),
    styleName: z.string().optional().describe("Apply fill paint style by name instead of color. Omit to use color.")
  });
  var strokeItem = z.object({
    nodeId,
    color: flexJson(colorRgba.optional()).describe('Stroke color. Hex "#FF0000" or {r,g,b,a?} 0-1. Ignored when styleName is set.'),
    strokeWeight: z.coerce.number().positive().optional().describe("Stroke weight (default: 1)"),
    styleName: z.string().optional().describe("Apply stroke paint style by name instead of color. Omit to use color.")
  });
  var cornerItem = z.object({
    nodeId,
    radius: z.coerce.number().min(0).describe("Corner radius"),
    corners: flexJson(z.array(flexBool(z.boolean())).length(4).optional()).describe("Which corners to round [topLeft, topRight, bottomRight, bottomLeft]. Default: all corners [true,true,true,true].")
  });
  var opacityItem = z.object({
    nodeId,
    opacity: z.coerce.number().min(0).max(1).describe("Opacity (0-1)")
  });
  function resolveStyle(name) {
    return __async(this, null, function* () {
      const styles = yield figma.getLocalPaintStylesAsync();
      const exact = styles.find((s) => s.name === name);
      if (exact) return { id: exact.id, name: exact.name };
      const fuzzy = styles.find((s) => s.name.toLowerCase().includes(name.toLowerCase()));
      return fuzzy ? { id: fuzzy.id, name: fuzzy.name } : null;
    });
  }
  function setFillSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!("fills" in node)) throw new Error(`Node does not support fills: ${p.nodeId}`);
      if (p.styleName && p.color) {
        const match = yield resolveStyle(p.styleName);
        if (match) {
          yield node.setFillStyleIdAsync(match.id);
          return { matchedStyle: match.name, _hint: "Both styleName and color provided \u2014 used styleName, ignored color. Pass only one: styleName (paint style) or color (one-off)." };
        } else throw new Error(`Fill style not found: "${p.styleName}"`);
      } else if (p.styleName) {
        const match = yield resolveStyle(p.styleName);
        if (match) {
          yield node.setFillStyleIdAsync(match.id);
          return { matchedStyle: match.name };
        } else throw new Error(`Fill style not found: "${p.styleName}"`);
      } else if (p.color) {
        const { r = 0, g = 0, b = 0, a = 1 } = p.color;
        node.fills = [{ type: "SOLID", color: { r, g, b }, opacity: a }];
        return { _hint: "Hardcoded fill color. Use styleName to apply a paint style, or use set_variable_binding to bind a color variable after creation." };
      }
      return {};
    });
  }
  function setStrokeSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!("strokes" in node)) throw new Error(`Node does not support strokes: ${p.nodeId}`);
      const result = {};
      if (p.styleName && p.color) {
        const match = yield resolveStyle(p.styleName);
        if (match) {
          yield node.setStrokeStyleIdAsync(match.id);
          result.matchedStyle = match.name;
          result._hint = "Both styleName and color provided \u2014 used styleName, ignored color. Pass only one: styleName (paint style) or color (one-off).";
        } else throw new Error(`Stroke style not found: "${p.styleName}"`);
      } else if (p.styleName) {
        const match = yield resolveStyle(p.styleName);
        if (match) {
          yield node.setStrokeStyleIdAsync(match.id);
          result.matchedStyle = match.name;
        } else throw new Error(`Stroke style not found: "${p.styleName}"`);
      } else if (p.color) {
        const { r = 0, g = 0, b = 0, a = 1 } = p.color;
        node.strokes = [{ type: "SOLID", color: { r, g, b }, opacity: a }];
        result._hint = "Hardcoded stroke color. Use styleName to apply a paint style, or use set_variable_binding to bind a color variable after creation.";
      }
      if (p.strokeWeight !== void 0 && "strokeWeight" in node) node.strokeWeight = p.strokeWeight;
      return result;
    });
  }
  function setCornerSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!("cornerRadius" in node)) throw new Error(`Node does not support corner radius: ${p.nodeId}`);
      const corners = p.corners || [true, true, true, true];
      if ("topLeftRadius" in node && Array.isArray(corners) && corners.length === 4) {
        if (corners[0]) node.topLeftRadius = p.radius;
        if (corners[1]) node.topRightRadius = p.radius;
        if (corners[2]) node.bottomRightRadius = p.radius;
        if (corners[3]) node.bottomLeftRadius = p.radius;
      } else {
        node.cornerRadius = p.radius;
      }
      return {};
    });
  }
  function setOpacitySingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!("opacity" in node)) throw new Error(`Node does not support opacity`);
      node.opacity = p.opacity;
      return {};
    });
  }
  var figmaHandlers8 = {
    set_fill_color: (p) => batchHandler(p, setFillSingle),
    set_stroke_color: (p) => batchHandler(p, setStrokeSingle),
    set_corner_radius: (p) => batchHandler(p, setCornerSingle),
    set_opacity: (p) => batchHandler(p, setOpacitySingle)
  };

  // src/tools/layout.ts
  init_helpers();
  var layoutModeItem = z.object({
    nodeId,
    layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).describe("Layout mode"),
    layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap (default: NO_WRAP)")
  });
  var paddingItem = z.object({
    nodeId,
    paddingTop: z.coerce.number().optional().describe("Top padding (default: unchanged)"),
    paddingRight: z.coerce.number().optional().describe("Right padding (default: unchanged)"),
    paddingBottom: z.coerce.number().optional().describe("Bottom padding (default: unchanged)"),
    paddingLeft: z.coerce.number().optional().describe("Left padding (default: unchanged)")
  });
  var axisAlignItem = z.object({
    nodeId,
    primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment"),
    counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment")
  });
  var layoutSizingItem = z.object({
    nodeId,
    layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional(),
    layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional()
  });
  var itemSpacingItem = z.object({
    nodeId,
    itemSpacing: z.coerce.number().optional().describe("Distance between children. Default: unchanged."),
    counterAxisSpacing: z.coerce.number().optional().describe("Distance between wrapped rows/columns (WRAP only). Default: unchanged.")
  });
  var LAYOUT_TYPES = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE"];
  function setLayoutModeSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!LAYOUT_TYPES.includes(node.type)) throw new Error(`Node type ${node.type} does not support layoutMode`);
      node.layoutMode = p.layoutMode;
      if (p.layoutMode !== "NONE" && p.layoutWrap) node.layoutWrap = p.layoutWrap;
      return {};
    });
  }
  function setPaddingSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!LAYOUT_TYPES.includes(node.type)) throw new Error(`Node type ${node.type} does not support padding`);
      if (node.layoutMode === "NONE") throw new Error("Padding requires auto-layout (layoutMode !== NONE)");
      if (p.paddingTop !== void 0) node.paddingTop = p.paddingTop;
      if (p.paddingRight !== void 0) node.paddingRight = p.paddingRight;
      if (p.paddingBottom !== void 0) node.paddingBottom = p.paddingBottom;
      if (p.paddingLeft !== void 0) node.paddingLeft = p.paddingLeft;
      return {};
    });
  }
  function setAxisAlignSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!LAYOUT_TYPES.includes(node.type)) throw new Error(`Node type ${node.type} does not support axis alignment`);
      if (node.layoutMode === "NONE") throw new Error("Axis alignment requires auto-layout");
      if (p.primaryAxisAlignItems !== void 0) node.primaryAxisAlignItems = p.primaryAxisAlignItems;
      if (p.counterAxisAlignItems !== void 0) node.counterAxisAlignItems = p.counterAxisAlignItems;
      return {};
    });
  }
  function setLayoutSizingSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (p.layoutSizingHorizontal !== void 0) node.layoutSizingHorizontal = p.layoutSizingHorizontal;
      if (p.layoutSizingVertical !== void 0) node.layoutSizingVertical = p.layoutSizingVertical;
      return {};
    });
  }
  function setItemSpacingSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!LAYOUT_TYPES.includes(node.type)) throw new Error(`Node type ${node.type} does not support item spacing`);
      if (node.layoutMode === "NONE") throw new Error("Item spacing requires auto-layout");
      if (p.itemSpacing !== void 0) node.itemSpacing = p.itemSpacing;
      if (p.counterAxisSpacing !== void 0) {
        if (node.layoutWrap !== "WRAP") throw new Error("counterAxisSpacing requires layoutWrap=WRAP");
        node.counterAxisSpacing = p.counterAxisSpacing;
      }
      return {};
    });
  }
  var figmaHandlers9 = {
    set_layout_mode: (p) => batchHandler(p, setLayoutModeSingle),
    set_padding: (p) => batchHandler(p, setPaddingSingle),
    set_axis_align: (p) => batchHandler(p, setAxisAlignSingle),
    set_layout_sizing: (p) => batchHandler(p, setLayoutSizingSingle),
    set_item_spacing: (p) => batchHandler(p, setItemSpacingSingle)
  };

  // src/tools/effects.ts
  init_helpers();
  var effectItem = z.object({
    nodeId,
    effects: flexJson(z.array(effectEntry).optional()).describe("Array of effect objects. Ignored when effectStyleName is set."),
    effectStyleName: z.string().optional().describe("Apply an effect style by name (case-insensitive). Omit to use raw effects.")
  });
  var constraintItem = z.object({
    nodeId,
    horizontal: z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]),
    vertical: z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"])
  });
  var exportSettingEntry = z.object({
    format: z.enum(["PNG", "JPG", "SVG", "PDF"]),
    suffix: z.string().optional(),
    contentsOnly: flexBool(z.boolean().optional()),
    constraint: flexJson(z.object({
      type: z.enum(["SCALE", "WIDTH", "HEIGHT"]),
      value: z.coerce.number()
    }).optional())
  });
  var exportSettingsItem = z.object({
    nodeId,
    settings: flexJson(z.array(exportSettingEntry)).describe("Export settings array")
  });
  var nodePropertiesItem = z.object({
    nodeId,
    properties: flexJson(z.record(z.unknown())).describe("Key-value properties to set")
  });
  function setEffectsSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!("effects" in node)) throw new Error(`Node does not support effects: ${p.nodeId}`);
      const result = {};
      if (p.effectStyleName) {
        const styles = yield figma.getLocalEffectStylesAsync();
        const exact = styles.find((s) => s.name === p.effectStyleName);
        const match = exact || styles.find((s) => s.name.toLowerCase().includes(p.effectStyleName.toLowerCase()));
        if (!match) throw new Error(`Effect style not found: "${p.effectStyleName}"`);
        yield node.setEffectStyleIdAsync(match.id);
        result.matchedStyle = match.name;
        if (p.effects) result._hint = "Both effectStyleName and effects provided \u2014 used effectStyleName, ignored effects. Pass only one.";
      } else if (p.effects) {
        const mapped = p.effects.map((e) => {
          var _a, _b, _c, _d, _e, _f, _g;
          const eff = { type: e.type, radius: e.radius, visible: (_a = e.visible) != null ? _a : true };
          if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") eff.blendMode = e.blendMode || "NORMAL";
          if (e.color) eff.color = { r: (_b = e.color.r) != null ? _b : 0, g: (_c = e.color.g) != null ? _c : 0, b: (_d = e.color.b) != null ? _d : 0, a: (_e = e.color.a) != null ? _e : 1 };
          if (e.offset) eff.offset = { x: (_f = e.offset.x) != null ? _f : 0, y: (_g = e.offset.y) != null ? _g : 0 };
          if (e.spread !== void 0) eff.spread = e.spread;
          return eff;
        });
        node.effects = mapped;
        result._hint = "Hardcoded effects. Use effectStyleName to apply an effect style for design system consistency.";
      }
      return result;
    });
  }
  function setConstraintsSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!("constraints" in node)) throw new Error(`Node does not support constraints: ${p.nodeId}`);
      node.constraints = { horizontal: p.horizontal, vertical: p.vertical };
      return {};
    });
  }
  function setExportSettingsSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!("exportSettings" in node)) throw new Error(`Node does not support exportSettings: ${p.nodeId}`);
      node.exportSettings = p.settings;
      return {};
    });
  }
  function setNodePropertiesSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      for (const [key, value] of Object.entries(p.properties)) {
        if (key in node) node[key] = value;
      }
      return {};
    });
  }
  var figmaHandlers10 = {
    set_effects: (p) => batchHandler(p, setEffectsSingle),
    set_constraints: (p) => batchHandler(p, setConstraintsSingle),
    set_export_settings: (p) => batchHandler(p, setExportSettingsSingle),
    set_node_properties: (p) => batchHandler(p, setNodePropertiesSingle)
  };

  // src/tools/text.ts
  init_helpers();
  var textContentItem = z.object({
    nodeId: z.string().describe("Text node ID"),
    text: z.string().describe("New text content")
  });
  var textPropsItem = z.object({
    nodeId: z.string().describe("Text node ID"),
    fontSize: z.coerce.number().optional().describe("Font size"),
    fontWeight: z.coerce.number().optional().describe("Font weight: 100-900"),
    fontColor: flexJson(colorRgba.optional()).describe('Font color. Hex "#000" or {r,g,b,a?} 0-1.'),
    textStyleId: z.string().optional().describe("Text style ID to apply (overrides font props)"),
    textStyleName: z.string().optional().describe("Text style name (case-insensitive match)"),
    textAutoResize: z.enum(["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]).optional(),
    layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional(),
    layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional()
  });
  var scanTextItem = z.object({
    nodeId,
    limit: z.coerce.number().optional().describe("Max text nodes to return (default: 50)"),
    includePath: flexBool(z.boolean().optional()).describe("Include ancestor path strings (default: true). Set false to reduce payload."),
    includeGeometry: flexBool(z.boolean().optional()).describe("Include absoluteX/absoluteY/width/height (default: true). Set false to reduce payload.")
  });
  function setTextContentBatch(params) {
    return __async(this, null, function* () {
      const items = params.items || [params];
      const depth2 = params.depth;
      const resolved = [];
      const errors = /* @__PURE__ */ new Map();
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        const node = yield figma.getNodeByIdAsync(p.nodeId);
        if (!node) {
          errors.set(i, `Node not found: ${p.nodeId}`);
          continue;
        }
        if (node.type !== "TEXT") {
          errors.set(i, `Node is not a text node: ${p.nodeId}`);
          continue;
        }
        resolved.push({ node, text: p.text });
      }
      const fontsToLoad = /* @__PURE__ */ new Map();
      const fallback = { family: "Inter", style: "Regular" };
      fontsToLoad.set("Inter::Regular", fallback);
      for (const { node } of resolved) {
        const fn = node.fontName;
        if (fn !== figma.mixed && fn) {
          const key = `${fn.family}::${fn.style}`;
          fontsToLoad.set(key, fn);
        }
      }
      yield Promise.all([...fontsToLoad.values()].map((f) => figma.loadFontAsync(f)));
      const { setCharacters: setCharacters2 } = yield Promise.resolve().then(() => (init_figma_helpers(), figma_helpers_exports));
      const results = [];
      let resolvedIdx = 0;
      for (let i = 0; i < items.length; i++) {
        if (errors.has(i)) {
          results.push({ error: errors.get(i) });
          continue;
        }
        const { node, text } = resolved[resolvedIdx++];
        try {
          yield setCharacters2(node, text);
          let result = "ok";
          if (depth2 !== void 0) {
            const { nodeSnapshot: nodeSnapshot2 } = yield Promise.resolve().then(() => (init_helpers(), helpers_exports));
            const snapshot = yield nodeSnapshot2(node.id, depth2);
            if (snapshot) result = snapshot;
          }
          results.push(result);
        } catch (e) {
          results.push({ error: e.message });
        }
      }
      return { results };
    });
  }
  function setTextPropertiesBatch(params) {
    return __async(this, null, function* () {
      var _a, _b, _c, _d;
      const items = params.items || [params];
      const depth2 = params.depth;
      const resolved = [];
      const errors = /* @__PURE__ */ new Map();
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        const node = yield figma.getNodeByIdAsync(p.nodeId);
        if (!node) {
          errors.set(i, `Node not found: ${p.nodeId}`);
          continue;
        }
        if (node.type !== "TEXT") {
          errors.set(i, `Not a text node: ${p.nodeId}`);
          continue;
        }
        resolved.push({ node, props: p });
      }
      const fontsToLoad = /* @__PURE__ */ new Map();
      for (const { node, props } of resolved) {
        const fn = node.fontName;
        if (fn !== figma.mixed && fn) {
          fontsToLoad.set(`${fn.family}::${fn.style}`, fn);
        }
        if (props.fontWeight !== void 0) {
          const style = getFontStyle3(props.fontWeight);
          const family = fn !== figma.mixed && fn ? fn.family : "Inter";
          fontsToLoad.set(`${family}::${style}`, { family, style });
        }
      }
      yield Promise.all([...fontsToLoad.values()].map((f) => figma.loadFontAsync(f)));
      let textStyles = null;
      const styleNames = /* @__PURE__ */ new Set();
      for (const { props } of resolved) {
        if (props.textStyleName && !props.textStyleId) styleNames.add(props.textStyleName);
      }
      if (styleNames.size > 0) textStyles = yield figma.getLocalTextStylesAsync();
      const results = [];
      let resolvedIdx = 0;
      for (let i = 0; i < items.length; i++) {
        if (errors.has(i)) {
          results.push({ error: errors.get(i) });
          continue;
        }
        const { node, props } = resolved[resolvedIdx++];
        try {
          let resolvedStyleId = props.textStyleId;
          if (!resolvedStyleId && props.textStyleName && textStyles) {
            const exact = textStyles.find((s) => s.name === props.textStyleName);
            if (exact) resolvedStyleId = exact.id;
            else {
              const fuzzy = textStyles.find((s) => s.name.toLowerCase().includes(props.textStyleName.toLowerCase()));
              if (fuzzy) resolvedStyleId = fuzzy.id;
            }
          }
          if (resolvedStyleId) {
            const s = yield figma.getStyleByIdAsync(resolvedStyleId);
            if ((s == null ? void 0 : s.type) === "TEXT") yield node.setTextStyleIdAsync(s.id);
          } else {
            if (props.fontWeight !== void 0) {
              const family = node.fontName !== figma.mixed && node.fontName ? node.fontName.family : "Inter";
              node.fontName = { family, style: getFontStyle3(props.fontWeight) };
            }
            if (props.fontSize !== void 0) node.fontSize = props.fontSize;
          }
          if (props.fontColor) {
            node.fills = [{
              type: "SOLID",
              color: { r: (_a = props.fontColor.r) != null ? _a : 0, g: (_b = props.fontColor.g) != null ? _b : 0, b: (_c = props.fontColor.b) != null ? _c : 0 },
              opacity: (_d = props.fontColor.a) != null ? _d : 1
            }];
          }
          if (props.textAutoResize) node.textAutoResize = props.textAutoResize;
          if (props.layoutSizingHorizontal) {
            try {
              node.layoutSizingHorizontal = props.layoutSizingHorizontal;
            } catch (e) {
            }
          }
          if (props.layoutSizingVertical) {
            try {
              node.layoutSizingVertical = props.layoutSizingVertical;
            } catch (e) {
            }
          }
          let result = "ok";
          if (depth2 !== void 0) {
            const { nodeSnapshot: nodeSnapshot2 } = yield Promise.resolve().then(() => (init_helpers(), helpers_exports));
            const snapshot = yield nodeSnapshot2(node.id, depth2);
            if (snapshot) result = snapshot;
          }
          const hints = [];
          if (props.textStyleName && props.textStyleId) {
            hints.push("Both textStyleName and textStyleId provided \u2014 used textStyleId. Pass only one: textStyleName (by name lookup) or textStyleId (direct ID).");
          } else if (!resolvedStyleId && (props.fontSize !== void 0 || props.fontWeight !== void 0)) {
            hints.push("Manual font properties set. Use textStyleName to apply a text style that controls fontSize, fontWeight, and lineHeight together.");
          }
          if (props.fontColor) {
            hints.push("Hardcoded font color. Use set_variable_binding to bind a color variable to the text fill, or apply a paint style via apply_style_to_node. Only use fontColor for one-off colors not in your design system.");
          }
          if (hints.length > 0) {
            hints.push("Run lint_node after building to catch these patterns across your design.");
            if (typeof result === "string") result = { status: result };
            result._hint = hints.join(" ");
          }
          results.push(result);
        } catch (e) {
          results.push({ error: e.message });
        }
      }
      return { results };
    });
  }
  function getFontStyle3(weight) {
    const map = {
      100: "Thin",
      200: "Extra Light",
      300: "Light",
      400: "Regular",
      500: "Medium",
      600: "Semi Bold",
      700: "Bold",
      800: "Extra Bold",
      900: "Black"
    };
    return map[weight] || "Regular";
  }
  function scanTextSingle(p) {
    return __async(this, null, function* () {
      var _a;
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      const limit = (_a = p.limit) != null ? _a : 50;
      const opts = { includePath: p.includePath !== false, includeGeometry: p.includeGeometry !== false };
      const textNodes = [];
      yield collectTextNodes(node, [], [], 0, textNodes, limit, opts);
      const truncated = textNodes.length >= limit;
      return { nodeId: p.nodeId, count: textNodes.length, truncated, textNodes };
    });
  }
  function collectTextNodes(node, namePath, idPath, depth2, out, limit, opts) {
    return __async(this, null, function* () {
      var _a, _b, _c;
      if (out.length >= limit) return;
      if (node.visible === false) return;
      const names = [...namePath, node.name || `Unnamed ${node.type}`];
      const ids = [...idPath, node.id];
      if (node.type === "TEXT") {
        let fontFamily = "", fontStyle = "";
        if (node.fontName && typeof node.fontName === "object") {
          if ("family" in node.fontName) fontFamily = node.fontName.family;
          if ("style" in node.fontName) fontStyle = node.fontName.style;
        }
        const entry = {
          id: node.id,
          name: node.name || "Text",
          characters: node.characters,
          fontSize: typeof node.fontSize === "number" ? node.fontSize : 0,
          fontFamily,
          fontStyle
        };
        if (opts.includeGeometry) {
          const bounds = (_a = node.absoluteBoundingBox) != null ? _a : node.absoluteRenderBounds;
          entry.absoluteX = bounds ? bounds.x : null;
          entry.absoluteY = bounds ? bounds.y : null;
          entry.width = bounds ? bounds.width : (_b = node.width) != null ? _b : 0;
          entry.height = bounds ? bounds.height : (_c = node.height) != null ? _c : 0;
        }
        if (opts.includePath) {
          entry.path = names.join(" > ");
          entry.pathIds = ids.join(" > ");
          entry.depth = depth2;
        }
        out.push(entry);
      }
      if ("children" in node) {
        for (const child of node.children) {
          if (out.length >= limit) break;
          yield collectTextNodes(child, names, ids, depth2 + 1, out, limit, opts);
        }
      }
    });
  }
  function setMultipleTextContentsFigma(params) {
    return __async(this, null, function* () {
      const items = params.text || params.items || [];
      return setTextContentBatch({ items, depth: params.depth });
    });
  }
  var figmaHandlers11 = {
    set_text_content: setTextContentBatch,
    set_text_properties: setTextPropertiesBatch,
    scan_text_nodes: (p) => batchHandler(p, scanTextSingle),
    // Legacy alias
    set_multiple_text_contents: setMultipleTextContentsFigma
  };

  // src/tools/fonts.ts
  function getAvailableFonts(params) {
    return __async(this, null, function* () {
      const fonts = yield figma.listAvailableFontsAsync();
      let result = fonts;
      if (params == null ? void 0 : params.query) {
        const q = params.query.toLowerCase();
        result = fonts.filter((f) => f.fontName.family.toLowerCase().includes(q));
      }
      const familyMap = {};
      for (const f of result) {
        const fam = f.fontName.family;
        if (!familyMap[fam]) familyMap[fam] = [];
        familyMap[fam].push(f.fontName.style);
      }
      return {
        count: Object.keys(familyMap).length,
        fonts: Object.entries(familyMap).map(([family, styles]) => ({ family, styles }))
      };
    });
  }
  var figmaHandlers12 = {
    get_available_fonts: getAvailableFonts
  };

  // src/tools/components.ts
  init_helpers();
  var componentItem = z.object({
    name: z.string().describe("Component name"),
    x: xPos,
    y: yPos,
    width: z.coerce.number().optional().describe("Width (default: 100)"),
    height: z.coerce.number().optional().describe("Height (default: 100)"),
    parentId,
    fillColor: flexJson(colorRgba.optional()).describe('Fill color. Hex "#FF0000" or {r,g,b,a?} 0-1. Omit for no fill.'),
    fillStyleName: z.string().optional().describe("Apply a fill paint style by name (case-insensitive)."),
    fillVariableId: z.string().optional().describe("Bind a color variable to the fill."),
    strokeColor: flexJson(colorRgba.optional()).describe('Stroke color. Hex "#FF0000" or {r,g,b,a?} 0-1. Omit for no stroke.'),
    strokeStyleName: z.string().optional().describe("Apply a stroke paint style by name."),
    strokeVariableId: z.string().optional().describe("Bind a color variable to the stroke."),
    strokeWeight: z.coerce.number().positive().optional().describe("Stroke weight (default: 1)"),
    cornerRadius: z.coerce.number().optional().describe("Corner radius (default: 0)"),
    layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Layout direction (default: NONE)"),
    layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap behavior (default: NO_WRAP)"),
    paddingTop: z.coerce.number().optional().describe("Top padding (default: 0)"),
    paddingRight: z.coerce.number().optional().describe("Right padding (default: 0)"),
    paddingBottom: z.coerce.number().optional().describe("Bottom padding (default: 0)"),
    paddingLeft: z.coerce.number().optional().describe("Left padding (default: 0)"),
    primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment (default: MIN)"),
    counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment (default: MIN)"),
    layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing (default: FIXED)"),
    layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: FIXED)"),
    itemSpacing: z.coerce.number().optional().describe("Spacing between children (default: 0)")
  });
  var fromNodeItem = z.object({
    nodeId
  });
  var combineItem = z.object({
    componentIds: flexJson(z.array(z.string())).describe("Component IDs to combine (min 2)"),
    name: z.string().optional().describe("Name for the component set. Omit to auto-generate.")
  });
  var propItem = z.object({
    componentId: z.string().describe("Component node ID"),
    propertyName: z.string().describe("Property name"),
    type: z.enum(["BOOLEAN", "TEXT", "INSTANCE_SWAP", "VARIANT"]).describe("Property type"),
    defaultValue: flexBool(z.union([z.string(), z.boolean()])).describe("Default value (string for TEXT/VARIANT, boolean for BOOLEAN)"),
    preferredValues: flexJson(z.array(z.object({
      type: z.enum(["COMPONENT", "COMPONENT_SET"]),
      key: z.string()
    })).optional()).describe("Preferred values for INSTANCE_SWAP type. Omit for none.")
  });
  var instanceItem = z.object({
    componentId: z.string().describe("Component or component set ID"),
    variantProperties: flexJson(z.record(z.string()).optional()).describe('Pick variant by properties, e.g. {"Style":"Secondary","Size":"Large"}. Ignored for plain COMPONENT IDs.'),
    x: z.coerce.number().optional().describe("X position. Omit to keep default."),
    y: z.coerce.number().optional().describe("Y position. Omit to keep default."),
    parentId
  });
  function colorConflictHints2(prop, variableId, styleName, color, tokenized) {
    const sources = [variableId && "VariableId", styleName && "StyleName", color && "Color"].filter(Boolean);
    if (sources.length > 1) {
      const used = variableId ? "VariableId" : styleName ? "StyleName" : "Color";
      const ignored = sources.filter((s) => s !== used);
      return [`Multiple ${prop} sources \u2014 used ${prop}${used}, ignored ${ignored.map((s) => prop + s).join(", ")}. Pass only one: ${prop}VariableId (variable token), ${prop}StyleName (paint style), or ${prop}Color (one-off).`];
    }
    if (sources.length === 1 && color && !tokenized) {
      return [`Hardcoded ${prop} color. Use ${prop}StyleName to apply a paint style, or ${prop}VariableId to bind a color variable. Only use ${prop}Color for one-off colors not in your design system.`];
    }
    return [];
  }
  function resolveStyleId2(name) {
    return __async(this, null, function* () {
      var _a;
      const styles = yield figma.getLocalPaintStylesAsync();
      const exact = styles.find((s) => s.name === name);
      if (exact) return exact.id;
      const fuzzy = styles.find((s) => s.name.toLowerCase().includes(name.toLowerCase()));
      return (_a = fuzzy == null ? void 0 : fuzzy.id) != null ? _a : null;
    });
  }
  function bindFillVariable(node, variableId, fallbackColor) {
    return __async(this, null, function* () {
      const v = yield figma.variables.getVariableByIdAsync(variableId);
      if (!v) return false;
      node.fills = [solidPaint(fallbackColor || { r: 0, g: 0, b: 0 })];
      const bound = figma.variables.setBoundVariableForPaint(node.fills[0], "color", v);
      node.fills = [bound];
      return true;
    });
  }
  function bindStrokeVariable(node, variableId, fallbackColor) {
    return __async(this, null, function* () {
      const v = yield figma.variables.getVariableByIdAsync(variableId);
      if (!v) return false;
      node.strokes = [solidPaint(fallbackColor || { r: 0, g: 0, b: 0 })];
      const bound = figma.variables.setBoundVariableForPaint(node.strokes[0], "color", v);
      node.strokes = [bound];
      return true;
    });
  }
  function createComponentSingle(p) {
    return __async(this, null, function* () {
      if (!p.name) throw new Error("Missing name");
      const {
        x = 0,
        y = 0,
        width = 100,
        height = 100,
        name,
        parentId: parentId2,
        fillColor,
        fillStyleName,
        fillVariableId,
        strokeColor,
        strokeStyleName,
        strokeVariableId,
        strokeWeight,
        cornerRadius,
        layoutMode = "NONE",
        layoutWrap = "NO_WRAP",
        paddingTop = 0,
        paddingRight = 0,
        paddingBottom = 0,
        paddingLeft = 0,
        primaryAxisAlignItems = "MIN",
        counterAxisAlignItems = "MIN",
        layoutSizingHorizontal = "FIXED",
        layoutSizingVertical = "FIXED",
        itemSpacing = 0
      } = p;
      const deferH = parentId2 && layoutSizingHorizontal === "FILL";
      const deferV = parentId2 && layoutSizingVertical === "FILL";
      const comp = figma.createComponent();
      comp.name = name;
      comp.x = x;
      comp.y = y;
      comp.resize(width, height);
      comp.fills = [];
      if (layoutMode !== "NONE") {
        comp.layoutMode = layoutMode;
        comp.layoutWrap = layoutWrap;
        comp.paddingTop = paddingTop;
        comp.paddingRight = paddingRight;
        comp.paddingBottom = paddingBottom;
        comp.paddingLeft = paddingLeft;
        comp.primaryAxisAlignItems = primaryAxisAlignItems;
        comp.counterAxisAlignItems = counterAxisAlignItems;
        comp.layoutSizingHorizontal = deferH ? "FIXED" : layoutSizingHorizontal;
        comp.layoutSizingVertical = deferV ? "FIXED" : layoutSizingVertical;
        comp.itemSpacing = itemSpacing;
      }
      let fillTokenized = false;
      if (fillVariableId) {
        fillTokenized = yield bindFillVariable(comp, fillVariableId, fillColor);
      } else if (fillStyleName) {
        const sid = yield resolveStyleId2(fillStyleName);
        if (sid) {
          yield comp.setFillStyleIdAsync(sid);
          fillTokenized = true;
        }
      } else if (fillColor) {
        comp.fills = [solidPaint(fillColor)];
      }
      let strokeTokenized = false;
      if (strokeVariableId) {
        strokeTokenized = yield bindStrokeVariable(comp, strokeVariableId, strokeColor);
      } else if (strokeStyleName) {
        const sid = yield resolveStyleId2(strokeStyleName);
        if (sid) {
          yield comp.setStrokeStyleIdAsync(sid);
          strokeTokenized = true;
        }
      } else if (strokeColor) {
        comp.strokes = [solidPaint(strokeColor)];
      }
      if (strokeWeight !== void 0) comp.strokeWeight = strokeWeight;
      if (cornerRadius !== void 0) comp.cornerRadius = cornerRadius;
      const parent = yield appendToParent(comp, parentId2);
      if (parent) {
        if (deferH) {
          try {
            comp.layoutSizingHorizontal = "FILL";
          } catch (e) {
          }
        }
        if (deferV) {
          try {
            comp.layoutSizingVertical = "FILL";
          } catch (e) {
          }
        }
      }
      const result = { id: comp.id };
      const hints = [];
      hints.push(...colorConflictHints2("fill", fillVariableId, fillStyleName, fillColor, fillTokenized));
      hints.push(...colorConflictHints2("stroke", strokeVariableId, strokeStyleName, strokeColor, strokeTokenized));
      if (!name.includes("=")) hints.push("Name lacks Property=Value pattern. Add it before combine_as_variants if you plan to create variants.");
      if (hints.length > 0) {
        hints.push("Run lint_node after building to catch these patterns across your design.");
        result._hint = hints.join(" ");
      }
      return result;
    });
  }
  function fromNodeSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!("parent" in node) || !node.parent) throw new Error("Node has no parent");
      const parent = node.parent;
      const index = parent.children.indexOf(node);
      const comp = figma.createComponent();
      comp.name = node.name;
      if ("width" in node && "height" in node) comp.resize(node.width, node.height);
      if ("x" in node && "y" in node) {
        comp.x = node.x;
        comp.y = node.y;
      }
      const clone = node.clone();
      clone.x = 0;
      clone.y = 0;
      comp.appendChild(clone);
      parent.insertChild(index, comp);
      node.remove();
      return { id: comp.id };
    });
  }
  function combineSingle(p) {
    return __async(this, null, function* () {
      var _a;
      if (!((_a = p.componentIds) == null ? void 0 : _a.length) || p.componentIds.length < 2) throw new Error("Need at least 2 components");
      const comps = [];
      for (const id of p.componentIds) {
        const node = yield figma.getNodeByIdAsync(id);
        if (!node) throw new Error(`Component not found: ${id}`);
        if (node.type !== "COMPONENT") throw new Error(`Node ${id} is not a COMPONENT`);
        comps.push(node);
      }
      const parent = comps[0].parent && comps.every((c) => c.parent === comps[0].parent) ? comps[0].parent : figma.currentPage;
      const set = figma.combineAsVariants(comps, parent);
      if (p.name) set.name = p.name;
      return { id: set.id };
    });
  }
  function addPropSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.componentId);
      if (!node) throw new Error(`Node not found: ${p.componentId}`);
      if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") throw new Error(`Node ${p.componentId} is a ${node.type}, not a COMPONENT or COMPONENT_SET. Property definitions can only be added to COMPONENT_SET nodes (or standalone COMPONENT nodes not inside a set).`);
      node.addComponentProperty(p.propertyName, p.type, p.defaultValue);
      return {};
    });
  }
  function instanceSingle(p) {
    return __async(this, null, function* () {
      var _a;
      let node = yield figma.getNodeByIdAsync(p.componentId);
      if (!node) throw new Error(`Component not found: ${p.componentId}`);
      if (node.type === "COMPONENT_SET") {
        if (!((_a = node.children) == null ? void 0 : _a.length)) throw new Error("Component set has no variants");
        if (p.variantProperties && typeof p.variantProperties === "object") {
          const match = node.children.find((child) => {
            if (child.type !== "COMPONENT" || !child.variantProperties) return false;
            return Object.entries(p.variantProperties).every(
              ([k, v]) => child.variantProperties[k] === v
            );
          });
          if (match) node = match;
          else throw new Error(`No variant matching ${JSON.stringify(p.variantProperties)} in ${node.name}`);
        } else {
          node = node.defaultVariant || node.children[0];
        }
      }
      if (node.type !== "COMPONENT") throw new Error(`Not a component: ${node.type}`);
      const inst = node.createInstance();
      if (p.x !== void 0) inst.x = p.x;
      if (p.y !== void 0) inst.y = p.y;
      if (p.parentId) {
        const parent = yield figma.getNodeByIdAsync(p.parentId);
        if (parent && "appendChild" in parent) parent.appendChild(inst);
      }
      return { id: inst.id, componentId: node.id };
    });
  }
  function getLocalComponentsFigma(params) {
    return __async(this, null, function* () {
      yield figma.loadAllPagesAsync();
      const setsOnly = params == null ? void 0 : params.setsOnly;
      const types = setsOnly ? ["COMPONENT_SET"] : ["COMPONENT", "COMPONENT_SET"];
      let components = figma.root.findAllWithCriteria({ types });
      if (params == null ? void 0 : params.query) {
        const f = params.query.toLowerCase();
        components = components.filter((c) => c.name.toLowerCase().includes(f));
      }
      const total = components.length;
      const limit = (params == null ? void 0 : params.limit) || 100;
      const offset = (params == null ? void 0 : params.offset) || 0;
      components = components.slice(offset, offset + limit);
      return {
        totalCount: total,
        returned: components.length,
        offset,
        limit,
        components: components.map((c) => {
          const e = { id: c.id, name: c.name, type: c.type };
          if (c.type === "COMPONENT_SET" && "children" in c) e.variantCount = c.children.length;
          if (c.description) e.description = c.description;
          let p = c.parent;
          while (p && p.type !== "PAGE") p = p.parent;
          if (p) {
            e.pageId = p.id;
            e.pageName = p.name;
          }
          return e;
        })
      };
    });
  }
  function getComponentByIdFigma(params) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(params.componentId);
      if (!node) throw new Error(`Component not found: ${params.componentId}`);
      if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") throw new Error(`Not a component: ${node.type}`);
      const r = { id: node.id, name: node.name, type: node.type };
      if ("description" in node) r.description = node.description;
      if (node.parent) {
        r.parentId = node.parent.id;
        r.parentName = node.parent.name;
      }
      if ("componentPropertyDefinitions" in node) r.propertyDefinitions = node.componentPropertyDefinitions;
      if (node.type === "COMPONENT_SET" && "variantGroupProperties" in node) r.variantGroupProperties = node.variantGroupProperties;
      if (node.type === "COMPONENT" && "variantProperties" in node) r.variantProperties = node.variantProperties;
      if ("children" in node && node.children) {
        if (node.type === "COMPONENT_SET") {
          r.variantCount = node.children.length;
          if (params.includeChildren) r.children = node.children.map((c) => ({ id: c.id, name: c.name, type: c.type }));
        } else {
          r.children = node.children.map((c) => ({ id: c.id, name: c.name, type: c.type }));
        }
      }
      return r;
    });
  }
  function getInstanceOverridesFigma(params) {
    return __async(this, null, function* () {
      let inst = null;
      if (params == null ? void 0 : params.instanceNodeId) {
        inst = yield figma.getNodeByIdAsync(params.instanceNodeId);
        if (!inst) throw new Error(`Instance not found: ${params.instanceNodeId}`);
        if (inst.type !== "INSTANCE") throw new Error("Node is not an instance");
      } else {
        const sel = figma.currentPage.selection.filter((n) => n.type === "INSTANCE");
        if (!sel.length) throw new Error("No instance selected");
        inst = sel[0];
      }
      const overrides = inst.overrides || [];
      const main = yield inst.getMainComponentAsync();
      return {
        mainComponentId: main == null ? void 0 : main.id,
        overrides: overrides.map((o) => ({ id: o.id, fields: o.overriddenFields }))
      };
    });
  }
  var figmaHandlers13 = {
    create_component: (p) => batchHandler(p, createComponentSingle),
    create_component_from_node: (p) => batchHandler(p, fromNodeSingle),
    combine_as_variants: (p) => batchHandler(p, combineSingle),
    add_component_property: (p) => batchHandler(p, addPropSingle),
    create_instance_from_local: (p) => batchHandler(p, instanceSingle),
    search_components: getLocalComponentsFigma,
    get_component_by_id: getComponentByIdFigma,
    get_instance_overrides: getInstanceOverridesFigma
  };

  // src/tools/styles.ts
  init_helpers();
  var paintStyleItem = z.object({
    name: z.string().describe("Style name"),
    color: flexJson(colorRgba).describe('Color. Hex "#FF0000" or {r,g,b,a?} 0-1.')
  });
  var textStyleItem = z.object({
    name: z.string().describe("Style name"),
    fontFamily: z.string().describe("Font family"),
    fontStyle: z.string().optional().describe("Font style (default: Regular)"),
    fontSize: z.coerce.number().describe("Font size"),
    lineHeight: flexNum(z.union([
      z.number(),
      z.object({ value: z.coerce.number(), unit: z.enum(["PIXELS", "PERCENT", "AUTO"]) })
    ]).optional()).describe("Line height \u2014 number (px) or {value, unit}. Default: auto."),
    letterSpacing: flexNum(z.union([
      z.number(),
      z.object({ value: z.coerce.number(), unit: z.enum(["PIXELS", "PERCENT"]) })
    ]).optional()).describe("Letter spacing \u2014 number (px) or {value, unit}. Default: 0."),
    textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional(),
    textDecoration: z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional()
  });
  var effectStyleItem = z.object({
    name: z.string().describe("Style name"),
    effects: flexJson(z.array(effectEntry)).describe("Array of effects")
  });
  var applyStyleItem = z.object({
    nodeId,
    styleId: z.string().optional().describe("Style ID. Provide either styleId or styleName."),
    styleName: z.string().optional().describe("Style name (case-insensitive substring match). Provide either styleId or styleName."),
    styleType: z.preprocess((v) => typeof v === "string" ? v.toLowerCase() : v, z.enum(["fill", "stroke", "text", "effect"])).describe("Type of style: fill, stroke, text, or effect (case-insensitive)")
  });
  function cleanStyleId(id) {
    return id.replace(/,$/, "");
  }
  function ensureStyleId(id) {
    return id.startsWith("S:") && !id.endsWith(",") ? id + "," : id;
  }
  function getStylesFigma() {
    return __async(this, null, function* () {
      const [colors, texts, effects, grids] = yield Promise.all([
        figma.getLocalPaintStylesAsync(),
        figma.getLocalTextStylesAsync(),
        figma.getLocalEffectStylesAsync(),
        figma.getLocalGridStylesAsync()
      ]);
      return {
        colors: colors.map((s) => ({ id: cleanStyleId(s.id), name: s.name })),
        texts: texts.map((s) => ({ id: cleanStyleId(s.id), name: s.name })),
        effects: effects.map((s) => ({ id: cleanStyleId(s.id), name: s.name })),
        grids: grids.map((s) => ({ id: cleanStyleId(s.id), name: s.name }))
      };
    });
  }
  function rgbaToHex2(color) {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    const a = color.a !== void 0 ? Math.round(color.a * 255) : 255;
    if (a === 255) return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
    return `#${[r, g, b, a].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  }
  function getStyleByIdFigma(params) {
    return __async(this, null, function* () {
      const style = yield figma.getStyleByIdAsync(ensureStyleId(params.styleId));
      if (!style) throw new Error(`Style not found: ${params.styleId}`);
      const r = { id: cleanStyleId(style.id), name: style.name, type: style.type };
      if (style.type === "PAINT") {
        r.paints = style.paints.map((p) => {
          const paint = __spreadValues({}, p);
          if (paint.color) paint.color = rgbaToHex2(paint.color);
          return paint;
        });
      } else if (style.type === "TEXT") {
        const ts = style;
        r.fontSize = ts.fontSize;
        r.fontName = ts.fontName;
        r.letterSpacing = ts.letterSpacing;
        r.lineHeight = ts.lineHeight;
        r.textCase = ts.textCase;
        r.textDecoration = ts.textDecoration;
      } else if (style.type === "EFFECT") {
        r.effects = style.effects;
      }
      return r;
    });
  }
  function removeStyleFigma(params) {
    return __async(this, null, function* () {
      const style = yield figma.getStyleByIdAsync(ensureStyleId(params.styleId));
      if (!style) throw new Error(`Style not found: ${params.styleId}`);
      style.remove();
      return "ok";
    });
  }
  function createPaintStyleSingle(p) {
    return __async(this, null, function* () {
      const style = figma.createPaintStyle();
      style.name = p.name;
      const { r, g, b, a = 1 } = p.color;
      style.paints = [{ type: "SOLID", color: { r, g, b }, opacity: a }];
      return { id: cleanStyleId(style.id) };
    });
  }
  function createTextStyleSingle(p) {
    return __async(this, null, function* () {
      const style = figma.createTextStyle();
      style.name = p.name;
      const fontStyle = p.fontStyle || "Regular";
      yield figma.loadFontAsync({ family: p.fontFamily, style: fontStyle });
      style.fontName = { family: p.fontFamily, style: fontStyle };
      style.fontSize = p.fontSize;
      if (p.lineHeight !== void 0) {
        if (typeof p.lineHeight === "number") style.lineHeight = { value: p.lineHeight, unit: "PIXELS" };
        else if (p.lineHeight.unit === "AUTO") style.lineHeight = { unit: "AUTO" };
        else style.lineHeight = { value: p.lineHeight.value, unit: p.lineHeight.unit };
      }
      if (p.letterSpacing !== void 0) {
        if (typeof p.letterSpacing === "number") style.letterSpacing = { value: p.letterSpacing, unit: "PIXELS" };
        else style.letterSpacing = { value: p.letterSpacing.value, unit: p.letterSpacing.unit };
      }
      if (p.textCase) style.textCase = p.textCase;
      if (p.textDecoration) style.textDecoration = p.textDecoration;
      return { id: cleanStyleId(style.id) };
    });
  }
  function createEffectStyleSingle(p) {
    return __async(this, null, function* () {
      const style = figma.createEffectStyle();
      style.name = p.name;
      style.effects = p.effects.map((e) => {
        var _a, _b;
        const eff = { type: e.type, radius: e.radius, visible: (_a = e.visible) != null ? _a : true };
        if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") eff.blendMode = e.blendMode || "NORMAL";
        if (e.color) eff.color = { r: e.color.r, g: e.color.g, b: e.color.b, a: (_b = e.color.a) != null ? _b : 1 };
        if (e.offset) eff.offset = { x: e.offset.x, y: e.offset.y };
        if (e.spread !== void 0) eff.spread = e.spread;
        return eff;
      });
      return { id: cleanStyleId(style.id) };
    });
  }
  function applyStyleSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      let styleId = p.styleId ? ensureStyleId(p.styleId) : null;
      let matchedStyle;
      if (!styleId && p.styleName) {
        const [paints, texts, effects] = yield Promise.all([
          figma.getLocalPaintStylesAsync(),
          figma.getLocalTextStylesAsync(),
          figma.getLocalEffectStylesAsync()
        ]);
        const all = [...paints, ...texts, ...effects];
        const exact = all.find((s) => s.name === p.styleName);
        if (exact) {
          styleId = exact.id;
          matchedStyle = exact.name;
        } else {
          const fuzzy = all.find((s) => s.name.toLowerCase().includes(p.styleName.toLowerCase()));
          if (!fuzzy) throw new Error(`Style not found: "${p.styleName}"`);
          styleId = fuzzy.id;
          matchedStyle = fuzzy.name;
        }
      }
      switch (p.styleType) {
        case "fill":
          yield node.setFillStyleIdAsync(styleId);
          break;
        case "stroke":
          yield node.setStrokeStyleIdAsync(styleId);
          break;
        case "text":
          yield node.setTextStyleIdAsync(styleId);
          break;
        case "effect":
          yield node.setEffectStyleIdAsync(styleId);
          break;
        default:
          throw new Error(`Unknown style type: ${p.styleType}`);
      }
      const result = { styleId: cleanStyleId(styleId) };
      if (matchedStyle) result.matchedStyle = matchedStyle;
      if (p.styleId && p.styleName) {
        result._hint = "Both styleId and styleName provided \u2014 used styleId. Pass only one: styleName (by name lookup) or styleId (direct ID).";
      }
      return result;
    });
  }
  var figmaHandlers14 = {
    get_styles: getStylesFigma,
    get_style_by_id: getStyleByIdFigma,
    remove_style: removeStyleFigma,
    create_paint_style: (p) => batchHandler(p, createPaintStyleSingle),
    create_text_style: (p) => batchHandler(p, createTextStyleSingle),
    create_effect_style: (p) => batchHandler(p, createEffectStyleSingle),
    apply_style_to_node: (p) => batchHandler(p, applyStyleSingle)
  };

  // src/tools/variables.ts
  var collectionItem = z.object({
    name: z.string().describe("Collection name")
  });
  var variableItem = z.object({
    collectionId: z.string().describe("Variable collection ID"),
    name: z.string().describe("Variable name"),
    resolvedType: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).describe("Variable type")
  });
  var setValueItem = z.object({
    variableId: z.string().describe("Variable ID (use full ID from create_variable response, e.g. VariableID:1:6)"),
    modeId: z.string().describe("Mode ID"),
    value: flexJson(z.union([
      z.number(),
      z.string(),
      z.boolean(),
      z.object({ r: z.coerce.number(), g: z.coerce.number(), b: z.coerce.number(), a: z.coerce.number().optional() })
    ])).describe("Value: number, string, boolean, or {r,g,b,a} color")
  });
  var bindingItem = z.object({
    nodeId: z.string().describe("Node ID"),
    field: z.string().describe("Property field (e.g., 'opacity', 'fills/0/color')"),
    variableId: z.string().describe("Variable ID (use full ID from create_variable response, e.g. VariableID:1:6)")
  });
  var addModeItem = z.object({
    collectionId: z.string().describe("Collection ID"),
    name: z.string().describe("Mode name")
  });
  var renameModeItem = z.object({
    collectionId: z.string().describe("Collection ID"),
    modeId: z.string().describe("Mode ID"),
    name: z.string().describe("New name")
  });
  var removeModeItem = z.object({
    collectionId: z.string().describe("Collection ID"),
    modeId: z.string().describe("Mode ID")
  });
  var setExplicitModeItem = z.object({
    nodeId,
    collectionId: z.string().describe("Variable collection ID"),
    modeId: z.string().describe("Mode ID to pin (e.g. Dark mode)")
  });
  function createCollectionSingle(p) {
    return __async(this, null, function* () {
      const collection = figma.variables.createVariableCollection(p.name);
      return { id: collection.id, modes: collection.modes, defaultModeId: collection.defaultModeId };
    });
  }
  function createVariableSingle(p) {
    return __async(this, null, function* () {
      const collection = yield figma.variables.getVariableCollectionByIdAsync(p.collectionId);
      if (!collection) throw new Error(`Collection not found: ${p.collectionId}`);
      const variable = figma.variables.createVariable(p.name, collection, p.resolvedType);
      return { id: variable.id };
    });
  }
  function setValueSingle(p) {
    return __async(this, null, function* () {
      var _a;
      const variable = yield figma.variables.getVariableByIdAsync(p.variableId);
      if (!variable) throw new Error(`Variable not found: ${p.variableId}`);
      let value = p.value;
      if (typeof value === "object" && value !== null && "r" in value) {
        value = { r: value.r, g: value.g, b: value.b, a: (_a = value.a) != null ? _a : 1 };
      }
      variable.setValueForMode(p.modeId, value);
      return {};
    });
  }
  function getLocalVariablesFigma(params) {
    return __async(this, null, function* () {
      let variables = (params == null ? void 0 : params.type) ? yield figma.variables.getLocalVariablesAsync(params.type) : yield figma.variables.getLocalVariablesAsync();
      if (params == null ? void 0 : params.collectionId) variables = variables.filter((v) => v.variableCollectionId === params.collectionId);
      const includeValues = (params == null ? void 0 : params.includeValues) === true;
      return {
        variables: variables.map((v) => {
          const entry = { id: v.id, name: v.name, resolvedType: v.resolvedType, variableCollectionId: v.variableCollectionId };
          if (includeValues) entry.valuesByMode = v.valuesByMode;
          return entry;
        })
      };
    });
  }
  function getLocalCollectionsFigma() {
    return __async(this, null, function* () {
      const collections = yield figma.variables.getLocalVariableCollectionsAsync();
      return {
        collections: collections.map((c) => ({ id: c.id, name: c.name, modes: c.modes, defaultModeId: c.defaultModeId, variableIds: c.variableIds }))
      };
    });
  }
  function getVariableByIdFigma(params) {
    return __async(this, null, function* () {
      const v = yield figma.variables.getVariableByIdAsync(params.variableId);
      if (!v) throw new Error(`Variable not found: ${params.variableId}`);
      return { id: v.id, name: v.name, resolvedType: v.resolvedType, variableCollectionId: v.variableCollectionId, valuesByMode: v.valuesByMode, description: v.description, scopes: v.scopes };
    });
  }
  function getCollectionByIdFigma(params) {
    return __async(this, null, function* () {
      const c = yield figma.variables.getVariableCollectionByIdAsync(params.collectionId);
      if (!c) throw new Error(`Collection not found: ${params.collectionId}`);
      return { id: c.id, name: c.name, modes: c.modes, defaultModeId: c.defaultModeId, variableIds: c.variableIds };
    });
  }
  function setBindingSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      const variable = yield figma.variables.getVariableByIdAsync(p.variableId);
      if (!variable) throw new Error(`Variable not found: ${p.variableId}`);
      const paintMatch = p.field.match(/^(fills|strokes)\/(\d+)\/color$/);
      if (paintMatch) {
        const prop = paintMatch[1];
        const index = parseInt(paintMatch[2], 10);
        if (!(prop in node)) throw new Error(`Node does not have ${prop}`);
        const paints = node[prop].slice();
        if (index >= paints.length) throw new Error(`${prop} index ${index} out of range`);
        const newPaint = figma.variables.setBoundVariableForPaint(paints[index], "color", variable);
        paints[index] = newPaint;
        node[prop] = paints;
      } else if ("setBoundVariable" in node) {
        node.setBoundVariable(p.field, variable);
      } else {
        throw new Error("Node does not support variable binding");
      }
      return {};
    });
  }
  function addModeSingle(p) {
    return __async(this, null, function* () {
      const c = yield figma.variables.getVariableCollectionByIdAsync(p.collectionId);
      if (!c) throw new Error(`Collection not found: ${p.collectionId}`);
      const modeId = c.addMode(p.name);
      return { modeId, modes: c.modes };
    });
  }
  function renameModeSingle(p) {
    return __async(this, null, function* () {
      const c = yield figma.variables.getVariableCollectionByIdAsync(p.collectionId);
      if (!c) throw new Error(`Collection not found: ${p.collectionId}`);
      c.renameMode(p.modeId, p.name);
      return { modes: c.modes };
    });
  }
  function removeModeSingle(p) {
    return __async(this, null, function* () {
      const c = yield figma.variables.getVariableCollectionByIdAsync(p.collectionId);
      if (!c) throw new Error(`Collection not found: ${p.collectionId}`);
      c.removeMode(p.modeId);
      return { modes: c.modes };
    });
  }
  function setExplicitModeSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!("setExplicitVariableModeForCollection" in node)) throw new Error(`Node does not support explicit variable modes: ${p.nodeId}`);
      node.setExplicitVariableModeForCollection(p.collectionId, p.modeId);
      return {};
    });
  }
  function getNodeVariablesFigma(params) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(params.nodeId);
      if (!node) throw new Error(`Node not found: ${params.nodeId}`);
      const result = { nodeId: params.nodeId };
      if ("boundVariables" in node) {
        const bv = node.boundVariables;
        if (bv && typeof bv === "object") {
          const bindings = {};
          for (const [key, val] of Object.entries(bv)) {
            if (Array.isArray(val)) {
              bindings[key] = val.map((v) => (v == null ? void 0 : v.id) ? { variableId: v.id, field: v.field } : v);
            } else if (val && typeof val === "object" && val.id) {
              bindings[key] = { variableId: val.id, field: val.field };
            }
          }
          result.boundVariables = bindings;
        }
      }
      if ("explicitVariableModes" in node) {
        result.explicitVariableModes = node.explicitVariableModes;
      }
      return result;
    });
  }
  function batchHandler3(params, fn) {
    return __async(this, null, function* () {
      const items = params.items || [params];
      const results = [];
      for (const item of items) {
        try {
          const r = yield fn(item);
          results.push(r && typeof r === "object" && Object.keys(r).length === 0 ? "ok" : r);
        } catch (e) {
          results.push({ error: e.message });
        }
      }
      return { results };
    });
  }
  var figmaHandlers15 = {
    create_variable_collection: (p) => batchHandler3(p, createCollectionSingle),
    create_variable: (p) => batchHandler3(p, createVariableSingle),
    set_variable_value: (p) => batchHandler3(p, setValueSingle),
    get_local_variables: getLocalVariablesFigma,
    get_local_variable_collections: getLocalCollectionsFigma,
    get_variable_by_id: getVariableByIdFigma,
    get_variable_collection_by_id: getCollectionByIdFigma,
    set_variable_binding: (p) => batchHandler3(p, setBindingSingle),
    add_mode: (p) => batchHandler3(p, addModeSingle),
    rename_mode: (p) => batchHandler3(p, renameModeSingle),
    remove_mode: (p) => batchHandler3(p, removeModeSingle),
    set_explicit_variable_mode: (p) => batchHandler3(p, setExplicitModeSingle),
    get_node_variables: getNodeVariablesFigma
  };

  // src/tools/lint.ts
  init_helpers();
  var lintRules = z.enum([
    "no-autolayout",
    // Frames with >1 child and no auto-layout
    "shape-instead-of-frame",
    // Shapes used where FRAME should be
    "hardcoded-color",
    // Fills/strokes not using styles
    "no-text-style",
    // Text nodes without text style
    "fixed-in-autolayout",
    // Fixed-size children in auto-layout parents
    "default-name",
    // Nodes with default/unnamed names
    "empty-container",
    // Frames/components with layout but no children
    "stale-text-name",
    // Text nodes where layer name diverges from content
    "all"
    // Run all rules
  ]);
  function lintNodeHandler(params) {
    return __async(this, null, function* () {
      var _a, _b;
      const ruleSet = new Set((params == null ? void 0 : params.rules) || ["all"]);
      const runAll = ruleSet.has("all");
      const maxDepth = (_a = params == null ? void 0 : params.maxDepth) != null ? _a : 10;
      const maxFindings = (_b = params == null ? void 0 : params.maxFindings) != null ? _b : 50;
      let root;
      if (params == null ? void 0 : params.nodeId) {
        const node = yield figma.getNodeByIdAsync(params.nodeId);
        if (!node) throw new Error(`Node not found: ${params.nodeId}`);
        root = node;
      } else {
        const sel = figma.currentPage.selection;
        if (sel.length === 0) throw new Error("Nothing selected and no nodeId provided");
        root = sel.length === 1 ? sel[0] : figma.currentPage;
      }
      let localPaintStyleIds = /* @__PURE__ */ new Set();
      let localTextStyleIds = /* @__PURE__ */ new Set();
      if (runAll || ruleSet.has("hardcoded-color")) {
        const paints = yield figma.getLocalPaintStylesAsync();
        localPaintStyleIds = new Set(paints.map((s) => s.id));
      }
      if (runAll || ruleSet.has("no-text-style")) {
        const texts = yield figma.getLocalTextStylesAsync();
        localTextStyleIds = new Set(texts.map((s) => s.id));
      }
      const issues = [];
      const ctx = { runAll, ruleSet, maxDepth, maxFindings, localPaintStyleIds, localTextStyleIds, hasPaintStyles: localPaintStyleIds.size > 0, hasTextStyles: localTextStyleIds.size > 0 };
      yield walkNode(root, 0, issues, ctx);
      const truncated = issues.length >= maxFindings;
      const grouped = {};
      for (const issue of issues) {
        if (!grouped[issue.rule]) grouped[issue.rule] = [];
        grouped[issue.rule].push(issue);
      }
      const categories = [];
      for (const [rule, ruleIssues] of Object.entries(grouped)) {
        categories.push({
          rule,
          count: ruleIssues.length,
          fix: FIX_INSTRUCTIONS[rule] || "Review and fix manually.",
          nodes: ruleIssues.map((i) => {
            const entry = { id: i.nodeId, name: i.nodeName };
            if (i.extra) Object.assign(entry, i.extra);
            return entry;
          })
        });
      }
      const result = { nodeId: root.id, nodeName: root.name, categories };
      if (truncated) {
        result._hint = `Capped at ${maxFindings} findings. Fix these first, then re-lint.`;
      }
      return result;
    });
  }
  var FIX_INSTRUCTIONS = {
    "no-autolayout": "Use lint_fix_autolayout or set_layout_mode to add auto-layout to these frames.",
    "shape-instead-of-frame": "Use lint_fix_replace_shape_with_frame to convert these shapes to frames with children.",
    "hardcoded-color": "Use set_fill_color with styleName to apply a paint style, or set_variable_binding to bind to a color variable.",
    "no-text-style": 'Use apply_style_to_node with styleType:"text" and styleName, or set_variable_binding to bind text properties to variables.',
    "fixed-in-autolayout": "Use set_layout_sizing to set FILL or HUG instead of FIXED sizing.",
    "default-name": "Use set_node_properties to give descriptive names.",
    "empty-container": "These frames or components have auto-layout but no children. Delete them or add content.",
    "stale-text-name": "These text nodes have layer names that don't match their content. Use set_node_properties to rename, or leave if intentional."
  };
  function walkNode(node, depth2, issues, ctx) {
    return __async(this, null, function* () {
      var _a, _b;
      if (issues.length >= ctx.maxFindings) return;
      if (depth2 > ctx.maxDepth) return;
      if (ctx.runAll || ctx.ruleSet.has("no-autolayout")) {
        if (isFrame(node) && node.layoutMode === "NONE" && "children" in node) {
          const childCount = node.children.length;
          if (childCount > 1) {
            const direction = detectLayoutDirection(node);
            issues.push({ rule: "no-autolayout", nodeId: node.id, nodeName: node.name, extra: { suggestedDirection: direction } });
            if (issues.length >= ctx.maxFindings) return;
          }
        }
      }
      if (ctx.runAll || ctx.ruleSet.has("shape-instead-of-frame")) {
        if (isShape(node) && node.parent && "children" in node.parent) {
          const siblings = node.parent.children;
          const bounds = getAbsoluteBounds(node);
          if (bounds) {
            const overlapping = siblings.filter((s) => {
              if (s.id === node.id) return false;
              const sb = getAbsoluteBounds(s);
              if (!sb) return false;
              return sb.x >= bounds.x && sb.y >= bounds.y && sb.x + sb.width <= bounds.x + bounds.width && sb.y + sb.height <= bounds.y + bounds.height;
            });
            if (overlapping.length > 0) {
              issues.push({ rule: "shape-instead-of-frame", nodeId: node.id, nodeName: node.name, extra: { overlappingIds: overlapping.map((s) => s.id) } });
              if (issues.length >= ctx.maxFindings) return;
            }
          }
        }
      }
      if ((ctx.runAll || ctx.ruleSet.has("hardcoded-color")) && ctx.hasPaintStyles) {
        if ("fills" in node && "fillStyleId" in node) {
          const fills = node.fills;
          const fillStyleId = node.fillStyleId;
          const hasFillVar = ((_b = (_a = node.boundVariables) == null ? void 0 : _a.fills) == null ? void 0 : _b.length) > 0;
          if (fills && Array.isArray(fills) && fills.length > 0 && fills[0].type === "SOLID") {
            if (!hasFillVar && (!fillStyleId || fillStyleId === "" || fillStyleId === figma.mixed)) {
              issues.push({ rule: "hardcoded-color", nodeId: node.id, nodeName: node.name });
              if (issues.length >= ctx.maxFindings) return;
            }
          }
        }
      }
      if ((ctx.runAll || ctx.ruleSet.has("no-text-style")) && ctx.hasTextStyles) {
        if (node.type === "TEXT") {
          const textStyleId = node.textStyleId;
          const hasTextVar = node.boundVariables && Object.keys(node.boundVariables).length > 0;
          if (!hasTextVar && (!textStyleId || textStyleId === "" || textStyleId === figma.mixed)) {
            issues.push({ rule: "no-text-style", nodeId: node.id, nodeName: node.name });
            if (issues.length >= ctx.maxFindings) return;
          }
        }
      }
      if (ctx.runAll || ctx.ruleSet.has("fixed-in-autolayout")) {
        if (isFrame(node) && node.layoutMode !== "NONE" && "children" in node) {
          for (const child of node.children) {
            if (issues.length >= ctx.maxFindings) break;
            if (!("layoutSizingHorizontal" in child)) continue;
            if (child.layoutSizingHorizontal === "FIXED" && child.layoutSizingVertical === "FIXED") {
              issues.push({ rule: "fixed-in-autolayout", nodeId: child.id, nodeName: child.name, extra: { parentId: node.id, axis: node.layoutMode === "HORIZONTAL" ? "horizontal" : "vertical" } });
            }
          }
          if (issues.length >= ctx.maxFindings) return;
        }
      }
      if (ctx.runAll || ctx.ruleSet.has("default-name")) {
        const defaultNames = ["Frame", "Rectangle", "Ellipse", "Line", "Text", "Group", "Component", "Instance", "Section", "Vector"];
        const isDefault = defaultNames.some((d) => node.name === d || /^.+ \d+$/.test(node.name) && node.name.startsWith(d));
        if (isDefault && node.type !== "PAGE") {
          issues.push({ rule: "default-name", nodeId: node.id, nodeName: node.name });
          if (issues.length >= ctx.maxFindings) return;
        }
      }
      if (ctx.runAll || ctx.ruleSet.has("empty-container")) {
        if (isFrame(node) && "children" in node && node.children.length === 0) {
          issues.push({ rule: "empty-container", nodeId: node.id, nodeName: node.name });
          if (issues.length >= ctx.maxFindings) return;
        }
      }
      if (ctx.runAll || ctx.ruleSet.has("stale-text-name")) {
        if (node.type === "TEXT") {
          const chars = node.characters;
          if (chars && node.name && node.name !== chars && node.name !== chars.slice(0, node.name.length)) {
            issues.push({ rule: "stale-text-name", nodeId: node.id, nodeName: node.name, extra: { characters: chars.slice(0, 60) } });
            if (issues.length >= ctx.maxFindings) return;
          }
        }
      }
      if ("children" in node) {
        for (const child of node.children) {
          if (issues.length >= ctx.maxFindings) break;
          yield walkNode(child, depth2 + 1, issues, ctx);
        }
      }
    });
  }
  function isFrame(node) {
    return node.type === "FRAME" || node.type === "COMPONENT" || node.type === "COMPONENT_SET";
  }
  var SHAPE_TYPES = /* @__PURE__ */ new Set(["RECTANGLE", "ELLIPSE", "POLYGON", "STAR", "VECTOR", "LINE"]);
  function isShape(node) {
    return SHAPE_TYPES.has(node.type);
  }
  function getAbsoluteBounds(node) {
    if ("absoluteBoundingBox" in node && node.absoluteBoundingBox) {
      return node.absoluteBoundingBox;
    }
    if ("x" in node && "width" in node) {
      return { x: node.x, y: node.y, width: node.width, height: node.height };
    }
    return null;
  }
  function detectLayoutDirection(frame) {
    const children = frame.children;
    if (children.length < 2) return "VERTICAL";
    let xVariance = 0;
    let yVariance = 0;
    for (let i = 1; i < children.length; i++) {
      xVariance += Math.abs(children[i].x - children[i - 1].x);
      yVariance += Math.abs(children[i].y - children[i - 1].y);
    }
    return yVariance >= xVariance ? "VERTICAL" : "HORIZONTAL";
  }
  function fixAutolayoutSingle(p) {
    return __async(this, null, function* () {
      const node = yield figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!isFrame(node)) throw new Error(`Node ${p.nodeId} is ${node.type}, not a FRAME`);
      if (node.layoutMode !== "NONE") return { skipped: true, reason: "Already has auto-layout" };
      const direction = p.layoutMode || detectLayoutDirection(node);
      node.layoutMode = direction;
      if (p.itemSpacing !== void 0) {
        node.itemSpacing = p.itemSpacing;
      }
      return { layoutMode: direction };
    });
  }
  function fixShapeToFrameSingle(p) {
    return __async(this, null, function* () {
      const shape = yield figma.getNodeByIdAsync(p.nodeId);
      if (!shape) throw new Error(`Node not found: ${p.nodeId}`);
      if (!isShape(shape)) throw new Error(`Node ${p.nodeId} is ${shape.type}, not a shape (RECTANGLE, ELLIPSE, etc.)`);
      const parent = shape.parent;
      if (!parent || !("children" in parent)) throw new Error(`Shape has no valid parent`);
      const s = shape;
      const frame = figma.createFrame();
      frame.name = s.name || "Container";
      frame.x = s.x;
      frame.y = s.y;
      frame.resize(s.width, s.height);
      if (s.fills) frame.fills = s.fills;
      if (s.strokes) frame.strokes = s.strokes;
      if (s.strokeWeight !== void 0) frame.strokeWeight = s.strokeWeight;
      if (s.strokeAlign) frame.strokeAlign = s.strokeAlign;
      if (s.opacity !== void 0) frame.opacity = s.opacity;
      if (s.cornerRadius !== void 0 && s.cornerRadius !== figma.mixed) {
        frame.cornerRadius = s.cornerRadius;
      } else if ("topLeftRadius" in s) {
        frame.topLeftRadius = s.topLeftRadius;
        frame.topRightRadius = s.topRightRadius;
        frame.bottomRightRadius = s.bottomRightRadius;
        frame.bottomLeftRadius = s.bottomLeftRadius;
      }
      if (s.effects) frame.effects = s.effects;
      if (s.blendMode) frame.blendMode = s.blendMode;
      frame.clipsContent = true;
      const shapeIndex = parent.children.indexOf(shape);
      parent.insertChild(shapeIndex, frame);
      const adoptChildren = p.adoptChildren !== false;
      const adopted = [];
      if (adoptChildren) {
        const shapeBounds = { x: s.x, y: s.y, width: s.width, height: s.height };
        const siblings = parent.children;
        const toAdopt = [];
        for (const sib of siblings) {
          if (sib.id === shape.id || sib.id === frame.id) continue;
          if (!("x" in sib) || !("width" in sib)) continue;
          const sx = sib.x, sy = sib.y;
          const sw = sib.width, sh = sib.height;
          if (sx >= shapeBounds.x && sy >= shapeBounds.y && sx + sw <= shapeBounds.x + shapeBounds.width && sy + sh <= shapeBounds.y + shapeBounds.height) {
            toAdopt.push(sib);
          }
        }
        for (const child of toAdopt) {
          child.x -= frame.x;
          child.y -= frame.y;
          frame.appendChild(child);
          adopted.push(child.id);
        }
      }
      shape.remove();
      return { id: frame.id, adoptedChildren: adopted };
    });
  }
  var figmaHandlers16 = {
    lint_node: lintNodeHandler,
    lint_fix_autolayout: (p) => batchHandler(p, fixAutolayoutSingle),
    lint_fix_replace_shape_with_frame: (p) => batchHandler(p, fixShapeToFrameSingle)
  };

  // src/tools/figma-registry.ts
  var allFigmaHandlers = __spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues({}, figmaHandlers), figmaHandlers2), figmaHandlers3), figmaHandlers4), figmaHandlers5), figmaHandlers6), figmaHandlers7), figmaHandlers8), figmaHandlers9), figmaHandlers10), figmaHandlers11), figmaHandlers12), figmaHandlers13), figmaHandlers14), figmaHandlers15), figmaHandlers16);

  // src/cursor_mcp_plugin/code.ts
  var state = {
    serverPort: 3055,
    channelName: ""
  };
  figma.showUI(__html__, { width: 350, height: 600 });
  figma.clientStorage.getAsync("settings").then((saved) => {
    if (saved) {
      if (saved.serverPort) state.serverPort = saved.serverPort;
      if (saved.channelName) state.channelName = saved.channelName;
      figma.ui.postMessage({ type: "restore-settings", serverPort: state.serverPort, channelName: state.channelName });
    }
  });
  var SKIP_FOCUS = /* @__PURE__ */ new Set([
    "join",
    "set_selection",
    "set_viewport",
    "zoom_into_view",
    "set_focus",
    "set_current_page",
    "create_page",
    "rename_page",
    "delete_node",
    "get_document_info",
    "get_current_page",
    "get_pages",
    "get_selection",
    "read_my_design",
    "get_node_info",
    "get_node_css",
    "get_available_fonts",
    "get_component_by_id",
    "get_instance_overrides",
    "get_styles",
    "get_style_by_id",
    "get_local_variables",
    "get_local_variable_collections",
    "get_variable_by_id",
    "get_variable_collection_by_id",
    "search_nodes",
    "search_components",
    "scan_text_nodes",
    "export_node_as_image",
    "lint_node",
    "get_node_variables"
  ]);
  function extractNodeIds(result, params) {
    const ids = [];
    if ((result == null ? void 0 : result.id) && typeof result.id === "string") ids.push(result.id);
    if (Array.isArray(result == null ? void 0 : result.results)) {
      for (const r of result.results) {
        if ((r == null ? void 0 : r.id) && typeof r.id === "string") ids.push(r.id);
      }
    }
    if (ids.length === 0 && Array.isArray(params == null ? void 0 : params.items)) {
      for (const item of params.items) {
        if ((item == null ? void 0 : item.nodeId) && typeof item.nodeId === "string") ids.push(item.nodeId);
      }
    }
    return ids;
  }
  function autoFocus(nodeIds2) {
    return __async(this, null, function* () {
      const nodes = [];
      for (const id of nodeIds2) {
        const node = yield figma.getNodeByIdAsync(id);
        if (node && "x" in node) nodes.push(node);
      }
      if (nodes.length > 0) {
        figma.currentPage.selection = nodes;
        figma.viewport.scrollAndZoomIntoView(nodes);
      }
    });
  }
  figma.ui.onmessage = (msg) => __async(void 0, null, function* () {
    switch (msg.type) {
      case "update-settings":
        updateSettings(msg);
        break;
      case "notify":
        figma.notify(msg.message);
        break;
      case "close-plugin":
        figma.closePlugin();
        break;
      case "execute-command":
        try {
          const result = yield handleCommand(msg.command, msg.params);
          figma.ui.postMessage({
            type: "command-result",
            id: msg.id,
            result
          });
          if (!SKIP_FOCUS.has(msg.command)) {
            const ids = extractNodeIds(result, msg.params);
            if (ids.length > 0) autoFocus(ids).catch(() => {
            });
          }
        } catch (error) {
          figma.ui.postMessage({
            type: "command-error",
            id: msg.id,
            error: error.message || "Error executing command"
          });
        }
        break;
    }
  });
  figma.on("run", ({ command }) => {
    figma.ui.postMessage({ type: "auto-connect" });
  });
  function updateSettings(settings) {
    if (settings.serverPort) {
      state.serverPort = settings.serverPort;
    }
    if (settings.channelName !== void 0) {
      state.channelName = settings.channelName;
    }
    figma.clientStorage.setAsync("settings", {
      serverPort: state.serverPort,
      channelName: state.channelName
    });
  }
  function handleCommand(command, params) {
    return __async(this, null, function* () {
      const handler = allFigmaHandlers[command];
      if (handler) {
        return yield handler(params);
      }
      throw new Error(`Unknown command: ${command}`);
    });
  }
})();
