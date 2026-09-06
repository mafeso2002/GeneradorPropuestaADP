function findText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(findText).find(Boolean) || "";
  if (typeof value !== "object") return "";

  const preferredKeys = ["markdownSummary", "summary", "comparison", "text", "output", "response", "result", "predictionOutput", "generatedText", "answer"];
  for (const key of preferredKeys) {
    const found = findText(value[key]);
    if (found) return found;
  }

  return Object.values(value)
    .map(findText)
    .filter((item) => item && item.length > 30)
    .sort((a, b) => b.length - a.length)[0] || "";
}

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

function findRoadmap(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value.items)) return value;
  if (Array.isArray(value.roadmap)) return { ...value, items: value.roadmap };
  if (value.aiRoadmap && Array.isArray(value.aiRoadmap.items)) return value.aiRoadmap;
  for (const child of Object.values(value)) {
    const found = findRoadmap(child);
    if (found) return found;
  }
  return null;
}

module.exports = async function (context, req) {
  const flowUrl = process.env.POWER_AUTOMATE_AI_ROADMAP_URL || process.env.POWER_AUTOMATE_AI_SUMMARY_URL;

  if (!flowUrl) {
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        configured: false,
        fallbackRequired: true,
        message: "POWER_AUTOMATE_AI_ROADMAP_URL o POWER_AUTOMATE_AI_SUMMARY_URL no esta configurada en Azure Static Web Apps.",
        items: []
      }
    };
    return;
  }

  const payload = req.body;
  if (!payload || typeof payload !== "object" || !payload.proposal || !payload.answers) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { error: "Payload para roadmap IA invalido." }
    };
    return;
  }

  const enrichedPayload = {
    ...payload,
    aiInstructions: {
      ...(payload.aiInstructions || {}),
      task: "Personalizar la hoja de ruta comercial y de adopcion para este cliente. No generar resumen ejecutivo ni comparar planes.",
      responseFormat: "Responder un JSON valido con { summary, items }. items debe ser un array de 4 a 6 etapas. Cada etapa debe incluir tag, title, date, desc, tasks (3 a 5 bullets), owner, deliverable, risk e icon. Usar solamente los datos del relevamiento y el roadmap base; no inventar informacion externa."
    }
  };

  const flowResponse = await fetch(flowUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(enrichedPayload)
  });

  const responseText = await flowResponse.text();
  let responseBody;
  try {
    responseBody = JSON.parse(responseText);
  } catch (error) {
    responseBody = { summary: responseText };
  }

  const text = findText(responseBody);
  const parsed = findRoadmap(responseBody) || findRoadmap(extractJsonObject(text)) || findRoadmap(extractJsonObject(responseText));
  const hasItems = parsed && Array.isArray(parsed.items) && parsed.items.length;

  context.res = {
    status: flowResponse.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
    body: flowResponse.ok
      ? {
          summary: parsed && parsed.summary ? parsed.summary : text,
          items: hasItems ? parsed.items : [],
          fallbackRequired: !hasItems,
          message: hasItems ? "" : "El Flow respondió, pero no devolvió etapas de roadmap en JSON.",
          source: process.env.POWER_AUTOMATE_AI_ROADMAP_URL ? "Power Automate AI Roadmap" : "Power Automate AI",
          raw: responseBody
        }
      : {
          error: responseBody.error || responseText || `Power Automate respondio ${flowResponse.status}`
        }
  };
};
