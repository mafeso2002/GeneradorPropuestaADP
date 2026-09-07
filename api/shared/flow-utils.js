// Utilidades compartidas por las Azure Functions del generador de propuestas.
// Centralizadas para evitar copias divergentes entre endpoints (findText, extractJsonObject,
// fetchWithTimeout). Cada función las importa con require("../shared/flow-utils").

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Busca el texto util (markdown/summary) dentro de una respuesta arbitraria de Power Automate.
function findText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(findText).find(Boolean) || "";
  if (typeof value !== "object") return "";

  const preferredKeys = [
    "markdownSummary",
    "summary",
    "comparison",
    "text",
    "output",
    "response",
    "result",
    "predictionOutput",
    "generatedText",
    "answer"
  ];
  for (const key of preferredKeys) {
    const found = findText(value[key]);
    if (found) return found;
  }

  return Object.values(value)
    .map(findText)
    .filter((item) => item && item.length > 30)
    .sort((a, b) => b.length - a.length)[0] || "";
}

// Extrae el primer objeto JSON dentro de un texto (soporta bloques ```json ... ```).
function extractJsonObject(text) {
  const value = String(text || "").trim();
  if (!value) return null;

  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = fenced ? [fenced[1], value] : [value];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      const start = candidate.indexOf("{");
      const end = candidate.lastIndexOf("}");
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(candidate.slice(start, end + 1));
        } catch (innerError) {
          // Continue trying other candidates.
        }
      }
    }
  }
  return null;
}

// Límite defensivo de tamaño de payload: evita reenviar cuerpos enormes a Power Automate
// (endpoints anónimos same-origin; esto acota abuso/DoS y costos de los Flows de IA).
function isPayloadTooLarge(payload, maxBytes = 524288) {
  try {
    return Buffer.byteLength(JSON.stringify(payload || {}), "utf8") > maxBytes;
  } catch (error) {
    return false;
  }
}

module.exports = { fetchWithTimeout, findText, extractJsonObject, isPayloadTooLarge };
