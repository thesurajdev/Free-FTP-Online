const LANGUAGE_MAP = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  md: "markdown",
  markdown: "markdown",
  html: "html",
  css: "css",
  scss: "scss",
  php: "php",
  txt: "plaintext",
};

export function extname(filePath = "") {
  const name = filePath.split("/").pop() || "";
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

export function languageFromPath(filePath = "") {
  const ext = extname(filePath);
  return LANGUAGE_MAP[ext] || "plaintext";
}

export function basename(filePath = "") {
  if (!filePath || filePath === "/") return "/";
  const parts = filePath.split("/").filter(Boolean);
  return parts[parts.length - 1] || "/";
}

export function dirname(filePath = "") {
  if (!filePath || filePath === "/") return "/";
  const parts = filePath.split("/").filter(Boolean);
  parts.pop();
  return `/${parts.join("/")}` || "/";
}

export function joinPath(...segments) {
  const value = segments
    .flat()
    .filter(Boolean)
    .join("/")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/");

  return value.startsWith("/") ? value : `/${value}`;
}
