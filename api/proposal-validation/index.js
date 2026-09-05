function findText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(findText).find(Boolean) || "";
  if (typeof value !== "object") return "";

  const preferredKeys = [
    "markdownSummary",
    "summary",
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

function validationToMarkdown(validation) {
  if (!validation || typeof validation !== "object") return "";
  const lines = [];
  lines.push("## Diagnóstico de consistencia");
  lines.push(validation.statusLabel || validation.status || "Validación generada");
  if (validation.planComment) {
    lines.push("## Plan recomendado");
    lines.push(validation.planComment);
  }
  if (Array.isArray(validation.missingQuestions) && validation.missingQuestions.length) {
    lines.push("## Preguntas faltantes");
    validation.missingQuestions.forEach((item) => lines.push(`- ${item}`));
  }
  if (validation.addonReview && typeof validation.addonReview === "object") {
    lines.push("## Add-ons");
    ["keep", "remove", "add"].forEach((key) => {
      const values = Array.isArray(validation.addonReview[key]) ? validation.addonReview[key] : [];
      if (values.length) lines.push(`- ${key}: ${values.join(", ")}`);
    });
  }
  if (Array.isArray(validation.risks) && validation.risks.length) {
    lines.push("## Riesgos comerciales");
    validation.risks.forEach((item) => lines.push(`- ${item}`));
  }
  if (validation.commercialRecommendation) {
    lines.push("## Recomendación final para el comercial");
    lines.push(validation.commercialRecommendation);
  }
  return lines.join("\n");
}

function isValidationObject(value) {
  if (!value || typeof value !== "object") return false;
  return Boolean(
    value.status ||
    value.statusLabel ||
    value.planDecision ||
    value.planComment ||
    value.markdownSummary ||
    value.addonReview ||
    value.commercialRecommendation ||
    (Array.isArray(value.missingQuestions) && value.missingQuestions.length) ||
    (Array.isArray(value.risks) && value.risks.length)
  );
}

module.exports = async function (context, req) {
  const flowUrl = process.env.POWER_AUTOMATE_AI_SUMMARY_URL;

  if (!flowUrl) {
    context.res = {
      status: 501,
      headers: { "Content-Type": "application/json" },
      body: {
        error: "POWER_AUTOMATE_AI_SUMMARY_URL no esta configurada en Azure Static Web Apps."
      }
    };
    return;
  }

  const payload = req.body;
  if (!payload || typeof payload !== "object" || !payload.proposal || !payload.answers) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { error: "Payload para validacion IA invalido." }
    };
    return;
  }

  const enrichedPayload = {
    ...payload,
    aiInstructions: {
      ...(payload.aiInstructions || {}),
      task: "Validar el diagnostico comercial y la consistencia de la propuesta. No generar resumen ejecutivo ni texto para cliente.",
      responseFormat: "Responder en JSON valido con: status ('consistent', 'review' o 'risky'), statusLabel, planDecision ('mantener', 'cambiar' o 'validar alternativa'), planComment, missingQuestions (maximo 3), addonReview { keep, remove, add }, risks y commercialRecommendation. Tambien incluir markdownSummary con el mismo contenido en Markdown. No modificar automaticamente nada; solo recomendar."
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
  const parsedCandidate = extractJsonObject(text) || extractJsonObject(responseText) || (responseBody && typeof responseBody === "object" ? responseBody.validation : null);
  const parsed = isValidationObject(parsedCandidate) ? parsedCandidate : null;
  const summary = parsed
    ? (parsed.markdownSummary || validationToMarkdown(parsed))
    : text;

  context.res = {
    status: flowResponse.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
    body: flowResponse.ok
      ? {
          summary,
          validation: parsed && typeof parsed === "object" ? parsed : null,
          raw: responseBody
        }
      : {
          error: responseBody.error || responseText || `Power Automate respondio ${flowResponse.status}`
        }
  };
};
