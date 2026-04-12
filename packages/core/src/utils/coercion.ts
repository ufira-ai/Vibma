import { z } from "zod";

// AI agents (Claude, GPT, etc.) frequently pass numbers as strings
// ("10" instead of 10), booleans as strings ("true" instead of true),
// and objects/arrays as JSON strings. These helpers add resilient
// coercion so tools don't fail on valid-but-mistyped input.

/** Coerce "true"/"false"/"1"/"0" strings to boolean */
export const flexBool = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => {
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
    return v;
  }, inner);

/** Coerce JSON strings to parsed values (for objects/arrays that agents may stringify) */
export const flexJson = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => {
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    }
    return v;
  }, inner);

/**
 * String-array coercion: accept a JSON array, a JSON-encoded array, or a bare
 * string (wrapped into a single-element array). Use for params that are
 * semantically "one or more strings" — e.g. library.get `query`, selection.set
 * `nodeIds`, lint `rules`. Without this, passing `query:"Button"` fails zod
 * validation even though the docs promise "pass a single string or an array".
 */
export const flexStringList = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.startsWith("[")) {
        try { return JSON.parse(trimmed); } catch { /* fall through — treat as bare */ }
      }
      return [v];
    }
    return v;
  }, inner);

/** Coerce numeric strings only when they're valid numbers (safe for use inside unions) */
export const flexNum = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => {
    if (typeof v === "string") {
      const n = Number(v);
      if (!isNaN(n) && v.trim() !== "") return n;
    }
    return v;
  }, inner);
