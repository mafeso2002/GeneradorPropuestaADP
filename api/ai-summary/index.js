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
      body: { error: "Payload para resumen IA invalido." }
    };
    return;
  }

  const flowResponse = await fetch(flowUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const responseText = await flowResponse.text();
  let responseBody;
  try {
    responseBody = JSON.parse(responseText);
  } catch (error) {
    responseBody = { summary: responseText };
  }

  function findSummary(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      return value.map(findSummary).find(Boolean) || "";
    }
    if (typeof value !== "object") return "";

    const preferredKeys = [
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
      const found = findSummary(value[key]);
      if (found) return found;
    }

    return Object.values(value)
      .map(findSummary)
      .filter((item) => item && item.length > 30)
      .sort((a, b) => b.length - a.length)[0] || "";
  }

  const summary = findSummary(responseBody);

  context.res = {
    status: flowResponse.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
    body: flowResponse.ok
      ? {
          summary: typeof summary === "string" ? summary : JSON.stringify(summary),
          raw: responseBody
        }
      : {
          error: responseBody.error || responseText || `Power Automate respondio ${flowResponse.status}`
        }
  };
};
