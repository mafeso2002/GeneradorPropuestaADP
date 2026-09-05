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

  const flowResponse = await fetch(flowUrl, {
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
      response: responseText
    }
  };
};
