const { fetchWithTimeout, findText, extractJsonObject, isPayloadTooLarge, hasProposalShape } = require("../shared/flow-utils");

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
  if (!hasProposalShape(payload)) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { error: "Payload para roadmap IA invalido." }
    };
    return;
  }

  if (isPayloadTooLarge(payload)) {
    context.res = {
      status: 413,
      headers: { "Content-Type": "application/json" },
      body: { fallbackRequired: true, items: [], error: "El contenido de la propuesta es demasiado grande." }
    };
    return;
  }

  const enrichedPayload = {
    ...payload,
    aiInstructions: {
      ...(payload.aiInstructions || {}),
      task: "Personalizar la hoja de ruta comercial y de adopcion para este cliente. No generar resumen ejecutivo ni comparar planes. Si payload.aiInstructions.commercialInstructions trae indicaciones del comercial, aplicarlas siempre que no contradigan duracion, alcance, olas, progresion ni el plan seleccionado.",
      timelineRules: "Respetar estrictamente proposal.roadmapStartDate, proposal.recommendedPlanDuration, proposal.recommendedPlanScope, proposal.adoptionWaveModel, proposal.progressionGuidance y proposal.templateRoadmap. Si existe roadmapStartDate, usar esa fecha como inicio real del roadmap aunque proposal.startDate sea distinta. Si existe adoptionWaveModel, el roadmap debe mantener ese esquema de olas, cantidad de olas, duracion y segmentacion; no reemplazarlo por un calendario generico. Si existe progressionGuidance, ordenar el roadmap para cubrir prerrequisitos o escalones previos antes de actividades avanzadas.",
      responseFormat: "Responder un JSON valido con { summary, items }. summary debe explicar en 1 o 2 frases que cambio respecto del roadmap base y, si hubo commercialInstructions, como se aplicaron. items debe ser un array de 4 a 6 etapas. Cada etapa debe incluir tag, title, date, desc, tasks (3 a 5 bullets), owner, deliverable, risk e icon. Usar solamente los datos del relevamiento y el roadmap base; no inventar informacion externa. Las fechas, tags y descripciones deben quedar alineadas con las olas, alcance y progresion enviados. Si el plan es P1/Productividad Digital, no reducirlo a capacitacion: incluir diagnostico, comunicacion, formacion aplicada, acompanamiento y medicion."
    }
  };

  try {
    const flowResponse = await fetchWithTimeout(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enrichedPayload)
    }, 60000);

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
            source: process.env.POWER_AUTOMATE_AI_ROADMAP_URL ? "Power Automate AI Roadmap" : "Power Automate AI"
          }
        : {
            error: (responseBody && responseBody.error) || `Power Automate respondio ${flowResponse.status}`
          }
    };
  } catch (error) {
    context.log.error(`AI roadmap flow request failed: ${error && error.message}`);
    context.res = {
      status: 502,
      headers: { "Content-Type": "application/json" },
      body: {
        fallbackRequired: true,
        items: [],
        error: error && error.name === "AbortError"
          ? "La generacion de roadmap excedio el tiempo de espera."
          : "No se pudo contactar a Power Automate para el roadmap."
      }
    };
  }
};
