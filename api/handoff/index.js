const { fetchWithTimeout, isPayloadTooLarge, hasProposalShape } = require("../shared/flow-utils");

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
  if (!hasProposalShape(payload)) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { error: "Payload de handoff invalido." }
    };
    return;
  }

  if (isPayloadTooLarge(payload)) {
    context.res = {
      status: 413,
      headers: { "Content-Type": "application/json" },
      body: { error: "El contenido de la propuesta es demasiado grande." }
    };
    return;
  }

  // El Flow arma un correo con estos campos; si faltan, Power Automate falla con
  // "field of type 'Null'". Validamos antes de invocarlo para no disparar corridas
  // fallidas (y sus mails de alerta) por payloads incompletos.
  const email = payload.email;
  const hasText = (value) => typeof value === "string" && value.trim().length > 0;
  if (!email || typeof email !== "object" ||
      !hasText(email.from) || !hasText(email.to) || !hasText(email.subject) || !hasText(email.body)) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { error: "Faltan campos del correo (De, Para, Asunto y Cuerpo) para enviar la propuesta." }
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
