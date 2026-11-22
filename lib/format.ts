const LANGUAGES: Record<string, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  ja: "Japanese",
  de: "German",
  hi: "Hindi",
  ru: "Russian",
  ko: "Korean",
  zh: "Chinese",
  pt: "Portuguese",
  cn: "Cantonese",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
  nl: "Dutch",
  pl: "Polish",
  tr: "Turkish",
  ar: "Arabic",
  th: "Thai",
  fa: "Persian",
  ta: "Tamil",
  te: "Telugu",
  ml: "Malayalam",
};

export function posterUrl(path: string, size: "w342" | "w500" | "w780" | "w1280" = "w342") {
  if (!path) return "";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function formatRuntime(runtime: number) {
  if (!runtime) return "";
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatVotes(votes: number) {
  if (votes >= 1_000_000) return `${(votes / 1_000_000).toFixed(1)}m ratings`;
  if (votes >= 10_000) return `${Math.round(votes / 1000)}k ratings`;
  if (votes >= 1000) return `${(votes / 1000).toFixed(1)}k ratings`;
  return `${votes} ratings`;
}

export function languageName(code: string) {
  return LANGUAGES[code] ?? code.toUpperCase();
}

export function castLine(names: string[], limit = 4) {
  const line = names.slice(0, limit).join(" · ");
  return line || "Cast not listed";
}
