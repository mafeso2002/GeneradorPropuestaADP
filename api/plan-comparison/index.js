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

module.exports = async function (context, req) {
  const flowUrl = process.env.POWER_AUTOMATE_PLAN_COMPARISON_URL || process.env.POWER_AUTOMATE_AI_SUMMARY_URL;

  if (!flowUrl) {
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        configured: false,
        fallbackRequired: true,
        message: "POWER_AUTOMATE_PLAN_COMPARISON_URL o POWER_AUTOMATE_AI_SUMMARY_URL no esta configurada en Azure Static Web Apps.",
        summary: ""
      }
    };
    return;
  }

  const payload = req.body;
  if (!payload || typeof payload !== "object" || !payload.proposal || !payload.answers) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { error: "Payload para comparacion de planes invalido." }
    };
    return;
  }

  const enrichedPayload = {
    ...payload,
    aiInstructions: {
      ...(payload.aiInstructions || {}),
      task: "Comparar comercialmente el plan recomendado contra el plan alternativo. No generar roadmap ni resumen ejecutivo general.",
      scopeRules: "Comparar usando primaryPlan.scope, primaryPlan.duration, primaryPlan.adoptionWaveModel, alternativePlan.scope, alternativePlan.duration y alternativePlan.adoptionWaveModel. Si alguno usa olas, explicar impacto en calendario, cantidad de usuarios, esfuerzo y precio por ola; no comparar solo por nombre de plan.",
      responseFormat: "Responder Markdown con secciones: ## Comparacion comercial, ## Que gana el cliente, ## Riesgos de elegir el menor o mayor, ## Cuando conviene cambiar, ## Recomendacion para el comercial. No inventar precios ni informacion externa. Mantener duracion, alcance y modelo de olas exactamente como fueron enviados."
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

  const summary = findText(responseBody);

  context.res = {
    status: flowResponse.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
    body: flowResponse.ok
      ? {
          summary,
          fallbackRequired: !summary,
          message: summary ? "" : "El Flow respondió, pero no devolvió una comparación utilizable.",
          source: process.env.POWER_AUTOMATE_PLAN_COMPARISON_URL ? "Power Automate Plan Comparison" : "Power Automate AI",
          raw: responseBody
        }
      : {
          error: responseBody.error || responseText || `Power Automate respondio ${flowResponse.status}`
        }
  };
};
