// GSLabIt fork: thin i18n. The English UI string is the key, so upstream code
// keeps working untouched and a string nobody translated yet falls back to
// English. Interpolation: t("Delete {name}?", { name }).
import { IT } from "./locales";

export type Lang = "it" | "en";

function detect(): Lang {
  try {
    const saved = localStorage.getItem("op_lang");
    if (saved === "it" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("en") ? "en" : "it";
}

export const lang: Lang = detect();
export const locale = lang === "it" ? "it-IT" : "en-US";

export function t(s: string, vars?: Record<string, string | number>): string {
  const out = lang === "it" ? (IT[s] ?? s) : s;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}
