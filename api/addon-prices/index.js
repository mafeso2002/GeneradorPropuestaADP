function normalizeRow(row) {
  if (!row || typeof row !== "object") return null;
  const boolValue = (value) => value === true || value === "true" || value === "True" || value === "sí" || value === "Si" || value === "si" || value === 1 || value === "1";
  const id = row.addon_id || row.addonId || row.id || row.key || row.crf_addon_id || row.pos_addon_id || row.pss_addon_id;
  if (!id) return null;
  const activeValue = row.active ?? row.activo ?? row.enabled ?? row.pos_activo ?? row.pss_activo ?? true;
  return {
    addon_id: String(id).trim(),
    nombre: row.nombre || row.name || row.Name || row.title || row.pos_nombre || row.pss_nombre || row.pss_Name || "",
    categoria: row.categoria || row.category || row.pos_categoria || row.pss_categoria || "",
    precio_texto: row.precio_texto || row.priceText || row.price || row.pos_precio_texto || row.pss_precio_texto || "A cotizar",
    precio_min_usd: Number(row.precio_min_usd ?? row.priceMinUsd ?? row.minUsd ?? row.pos_precio_min_usd ?? row.pss_precio_min_usd ?? 0) || null,
    precio_max_usd: Number(row.precio_max_usd ?? row.priceMaxUsd ?? row.maxUsd ?? row.pos_precio_max_usd ?? row.pss_precio_max_usd ?? 0) || null,
    requiere_copilot: boolValue(row.requiere_copilot ?? row.requiresCopilot ?? row.pos_requiere_copilot ?? row.pss_requiere_copilot ?? false),
    notas: row.notas || row.notes || row.pos_notas || row.pss_notas || "",
    activo: activeValue === true || activeValue === undefined || activeValue === null ? true : boolValue(activeValue)
  };
}

function findRows(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "object") return [];
  const candidates = [
    value.prices,
    value.addonPrices,
    value.addons,
    value.value,
    value.items,
    value.body,
    value.result
  ];
  for (const candidate of candidates) {
    const rows = findRows(candidate);
    if (rows.length) return rows;
  }
  return [];
}

module.exports = async function (context, req) {
  const flowUrl = process.env.POWER_AUTOMATE_ADDON_PRICES_URL;

  if (!flowUrl) {
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        configured: false,
        prices: [],
        warning: "POWER_AUTOMATE_ADDON_PRICES_URL no esta configurada. Se usaran precios fallback."
      }
    };
    return;
  }

  const flowResponse = await fetch(flowUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "GeneradorPropuestaADP",
      requestedAt: new Date().toISOString()
    })
  });

  const responseText = await flowResponse.text();
  let responseBody;
  try {
    responseBody = JSON.parse(responseText);
  } catch (error) {
    responseBody = { raw: responseText };
  }

  const prices = findRows(responseBody)
    .map(normalizeRow)
    .filter(Boolean);

  context.res = {
    status: flowResponse.ok ? 200 : 502,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: flowResponse.ok
      ? {
          configured: true,
          prices,
          rawCount: prices.length
        }
      : {
          error: responseBody.error || responseText || `Power Automate respondio ${flowResponse.status}`
        }
  };
};
