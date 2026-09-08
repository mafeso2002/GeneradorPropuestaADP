function isValidClientProposalId(value) {
  return /^[a-f0-9-]{32,80}$/i.test(String(value || ""));
}

module.exports = async function (context) {
  const id = context.bindingData && context.bindingData.id;

  if (!isValidClientProposalId(id)) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: { error: "ID de propuesta cliente invalido." }
    };
    return;
  }

  if (!context.bindings.proposalBlob) {
    context.res = {
      status: 404,
      headers: { "Content-Type": "application/json" },
      body: { error: "Propuesta cliente no encontrada." }
    };
    return;
  }

  let snapshot;
  try {
    snapshot = typeof context.bindings.proposalBlob === "string"
      ? JSON.parse(context.bindings.proposalBlob)
      : context.bindings.proposalBlob;
  } catch (error) {
    context.log.error(`Client proposal ${id} could not be parsed: ${error && error.message}`);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { error: "No se pudo leer la propuesta cliente." }
    };
    return;
  }

  context.res = {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: snapshot
  };
};
