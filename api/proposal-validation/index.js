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

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function fallbackValidation(payload, summary) {
  const proposal = payload.proposal || {};
  const decision = proposal.decision || {};
  const answers = payload.answers || {};
  const qualification = answers.qualification || {};
  const addonStates = payload.validationInstructions && Array.isArray(payload.validationInstructions.addonStates)
    ? payload.validationInstructions.addonStates
    : [];
  const notes = normalizeText(payload.validationNotes);
  const confidence = Number(decision.confidence || 0);
  const risks = [];
  const missingQuestions = [];
  const addonReview = { keep: [], remove: [], add: [] };
  let status = "consistent";
  let planDecision = "mantener";
  let planComment = `El plan recomendado (${proposal.recommendedPlanName || "plan actual"}) es consistente con las señales principales del relevamiento.`;

  if (confidence && confidence < 50) {
    status = "risky";
    planDecision = "validar alternativa";
    risks.push("La confianza del algoritmo es baja; no conviene presentar sin revisión de preventa/adopción.");
  } else if (confidence && confidence < 70) {
    status = "review";
    planDecision = "validar alternativa";
    risks.push("La confianza del algoritmo es media; conviene revisar alternativas antes de cerrar alcance.");
  }

  if (notes.includes("solo") && notes.includes("excel")) {
    status = status === "risky" ? status : "review";
    planComment = "El plan puede mantenerse como referencia, pero el alcance comercial parece más cercano a un módulo focalizado de Excel.";
    missingQuestions.push("¿El cliente espera solo capacitación/adopción de Excel o una adopción Microsoft 365 más amplia?");
    addonStates.forEach((addon) => {
      const title = addon.title || addon.id || "";
      const normalizedTitle = normalizeText(title);
      if (normalizedTitle.includes("excel") && addon.state !== "unavailable") addonReview.keep.push(title);
      if (addon.selected && !normalizedTitle.includes("excel")) addonReview.remove.push(title);
    });
    risks.push("La propuesta puede sobredimensionarse si se incluyen módulos de Teams/SharePoint, cambio o IA cuando el alcance real es solo Excel.");
  }

  if (normalizeText(qualification.agentNeed).includes("activ") && normalizeText(qualification.copilotLicenses).includes("no tiene")) {
    status = "review";
    missingQuestions.push("¿El cliente tiene previsto adquirir Microsoft 365 Copilot antes de trabajar agentes o solo quiere explorar posibilidades?");
    risks.push("Hay interés en agentes, pero no hay licencias Microsoft 365 Copilot confirmadas.");
  }

  if (!missingQuestions.length) {
    missingQuestions.push("¿El alcance esperado es capacitación puntual, adopción por ola o programa integral?");
  }

  const selectedAddons = addonStates.filter((addon) => addon.selected && addon.state !== "unavailable");
  selectedAddons.forEach((addon) => {
    if (!addonReview.remove.includes(addon.title) && !addonReview.keep.includes(addon.title)) addonReview.keep.push(addon.title);
  });

  const statusLabel = status === "consistent"
    ? "Consistente"
    : status === "review"
    ? "Revisar antes de presentar"
    : "Riesgoso";
  const commercialRecommendation = status === "consistent"
    ? "Generar la propuesta con el árbol actual y usar la validación como respaldo comercial."
    : "Validar las preguntas faltantes y ajustar add-ons antes de enviar la propuesta, o generar igual dejando claro el alcance.";

  const validation = {
    status,
    statusLabel,
    planDecision,
    planComment,
    missingQuestions: missingQuestions.slice(0, 3),
    addonReview,
    risks,
    commercialRecommendation,
  };
  const aiComment = summary ? `\n\n## Comentario IA\n${summary}` : "";
  return {
    ...validation,
    markdownSummary: `${validationToMarkdown(validation)}${aiComment}`
  };
}

module.exports = async function (context, req) {
  const flowUrl = process.env.POWER_AUTOMATE_AI_SUMMARY_URL;

  const payload = req.body;
  if (!payload || typeof payload !== "object" || !payload.proposal || !payload.answers) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { error: "Payload para validacion IA invalido." }
    };
    return;
  }

  if (!flowUrl) {
    // Sin Flow configurado usamos el mismo fallback local que aplicamos cuando el Flow
    // responde pero no devuelve un JSON de validacion utilizable, para no bloquear al
    // comercial con un error 501 cuando todavia no se conecto Power Automate.
    const fallback = fallbackValidation(payload, "");
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        summary: fallback.markdownSummary || validationToMarkdown(fallback),
        validation: fallback,
        source: "Fallback local (sin Flow configurado)"
      }
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

  let flowResponse;
  let responseText;
  try {
    flowResponse = await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enrichedPayload)
    });
    responseText = await flowResponse.text();
  } catch (error) {
    // Si la llamada al Flow falla (red, timeout, etc.) igual dejamos al comercial
    // seguir con una validacion local en vez de bloquearlo con un error duro.
    const fallback = fallbackValidation(payload, "");
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        summary: fallback.markdownSummary || validationToMarkdown(fallback),
        validation: fallback,
        source: "Fallback local (el Flow no respondio)"
      }
    };
    return;
  }

  let responseBody;
  try {
    responseBody = JSON.parse(responseText);
  } catch (error) {
    responseBody = { summary: responseText };
  }

  const text = findText(responseBody);
  const parsedCandidate = extractJsonObject(text) || extractJsonObject(responseText) || (responseBody && typeof responseBody === "object" ? responseBody.validation : null);
  const parsed = isValidationObject(parsedCandidate) ? parsedCandidate : null;
  const fallback = parsed ? null : fallbackValidation(payload, text);
  const validation = parsed || fallback;
  const summary = validation
    ? (validation.markdownSummary || validationToMarkdown(validation))
    : text;

  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: {
      summary,
      validation,
      source: flowResponse.ok ? "Power Automate AI" : "Fallback local (el Flow respondio con error)",
      raw: responseBody
    }
  };
};
