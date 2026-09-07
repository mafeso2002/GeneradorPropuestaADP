async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function (context, req) {
  const flowUrl = process.env.POWER_AUTOMATE_HANDOFF_URL;

  if (!flowUrl) {
    context.res = {
      status: 501,
      headers: { "Content-Type": "application/json" },
      body: {
        error: "POWER_AUTOMATE_HANDOFF_URL no esta configurada en Azure Static Web Apps."
      }
    };
    return;
  }

  const payload = req.body;
  if (!payload || typeof payload !== "object" || !payload.proposal || !payload.answers) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { error: "Payload de handoff invalido." }
    };
    return;
  }

  try {
    const flowResponse = await fetchWithTimeout(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const responseText = await flowResponse.text();

    context.res = {
      status: flowResponse.ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
      body: {
        ok: flowResponse.ok,
        status: flowResponse.status,
        response: responseText.slice(0, 4000)
      }
    };
  } catch (error) {
    context.log.error(`Handoff flow request failed: ${error && error.message}`);
    context.res = {
      status: 502,
      headers: { "Content-Type": "application/json" },
      body: {
        ok: false,
        error: error && error.name === "AbortError"
          ? "El envio a Power Automate excedio el tiempo de espera."
          : "No se pudo contactar a Power Automate para enviar la propuesta."
      }
    };
  }
};
