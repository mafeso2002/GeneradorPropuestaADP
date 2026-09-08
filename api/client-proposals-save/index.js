const { isPayloadTooLarge } = require("../shared/flow-utils");

function isValidClientProposalId(value) {
  return /^[a-f0-9-]{32,80}$/i.test(String(value || ""));
}

module.exports = async function (context, req) {
  const id = context.bindingData && context.bindingData.id;
  const payload = req.body;

  if (!isValidClientProposalId(id)) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { error: "ID de propuesta cliente invalido." }
    };
    return;
  }

  if (!payload || typeof payload !== "object" || !payload.state || typeof payload.state !== "object" || Array.isArray(payload.state)) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { error: "Snapshot de propuesta invalido." }
    };
    return;
  }

  if (isPayloadTooLarge(payload, 1048576)) {
    context.res = {
      status: 413,
      headers: { "Content-Type": "application/json" },
      body: { error: "El snapshot de la propuesta es demasiado grande." }
    };
    return;
  }

  const snapshot = {
    id,
    version: payload.version || "",
    createdAt: payload.createdAt || new Date().toISOString(),
    state: payload.state
  };

  context.bindings.proposalBlob = JSON.stringify(snapshot);
  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: { ok: true, id, createdAt: snapshot.createdAt }
  };
};
