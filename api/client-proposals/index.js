const { fetchWithTimeout, isPayloadTooLarge } = require("../shared/flow-utils");

function isValidClientProposalId(value) {
  return /^[a-f0-9-]{32,80}$/i.test(String(value || ""));
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

module.exports = async function (context, req) {
  const flowUrl = process.env.POWER_AUTOMATE_CLIENT_PROPOSAL_URL;
  const id = context.bindingData && context.bindingData.id;
  const method = String(req.method || "GET").toUpperCase();

  if (!isValidClientProposalId(id)) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { error: "ID de propuesta cliente invalido." }
    };
    return;
  }

  if (!flowUrl) {
    context.res = {
      status: 501,
      headers: { "Content-Type": "application/json" },
      body: {
        error: "POWER_AUTOMATE_CLIENT_PROPOSAL_URL no esta configurada en Azure Static Web Apps."
      }
    };
    return;
  }

  const requestBody = method === "POST" ? req.body : {};
  if (method === "POST") {
    if (!requestBody || typeof requestBody !== "object" || !requestBody.state || typeof requestBody.state !== "object" || Array.isArray(requestBody.state)) {
      context.res = {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: { error: "Snapshot de propuesta invalido." }
      };
      return;
    }
    if (isPayloadTooLarge(requestBody, 1048576)) {
      context.res = {
        status: 413,
        headers: { "Content-Type": "application/json" },
        body: { error: "El snapshot de la propuesta es demasiado grande." }
      };
      return;
    }
  }

  try {
    const flowResponse = await fetchWithTimeout(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: method === "POST" ? "save" : "get",
        id,
        ...requestBody
      })
    });
    const responseText = await flowResponse.text();
    const parsed = parseJsonSafe(responseText);

    context.res = {
      status: flowResponse.ok ? 200 : 502,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: parsed || {
        ok: flowResponse.ok,
        status: flowResponse.status,
        response: responseText.slice(0, 4000)
      }
    };
  } catch (error) {
    context.log.error(`Client proposal flow request failed: ${error && error.message}`);
    context.res = {
      status: 502,
      headers: { "Content-Type": "application/json" },
      body: {
        ok: false,
        error: error && error.name === "AbortError"
          ? "La persistencia de la propuesta excedio el tiempo de espera."
          : "No se pudo contactar a Power Automate para persistir la propuesta."
      }
    };
  }
};
