function cleanText(value, maxLength = 900) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

async function fetchJson(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "GeneradorPropuestaADP/1.0"
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getCompanyResearch(company, context) {
  const name = cleanText(company, 120);
  if (!name) {
    return {
      status: "skipped",
      summary: "No se recibio nombre de empresa para buscar contexto publico.",
      sources: []
    };
  }

  const sources = [];
  const errors = [];
  const warn = (message) => {
    if (context.log && typeof context.log.warn === "function") context.log.warn(message);
    else if (typeof context.log === "function") context.log(message);
  };

  try {
    const ddgUrl = `https://api.duckduckgo.com/?${new URLSearchParams({
      q: `${name} empresa`,
      format: "json",
      no_html: "1",
      no_redirect: "1",
      skip_disambig: "1"
    })}`;
    const ddg = await fetchJson(ddgUrl);
    if (ddg.AbstractText) {
      sources.push({
        title: ddg.Heading || name,
        url: ddg.AbstractURL || "",
        snippet: cleanText(ddg.AbstractText)
      });
    }
    const related = Array.isArray(ddg.RelatedTopics) ? ddg.RelatedTopics : [];
    related
      .flatMap((item) => Array.isArray(item.Topics) ? item.Topics : [item])
      .filter((item) => item && item.Text)
      .slice(0, 2)
      .forEach((item) => {
        sources.push({
          title: cleanText(item.Text.split(" - ")[0], 120) || name,
          url: item.FirstURL || "",
          snippet: cleanText(item.Text)
        });
      });
  } catch (error) {
    errors.push(`DuckDuckGo: ${error.message}`);
    warn(`Company research DuckDuckGo failed for "${name}": ${error.message}`);
  }

  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: name,
      format: "json",
      origin: "*",
      srlimit: "1"
    })}`;
    const search = await fetchJson(searchUrl);
    const first = search && search.query && Array.isArray(search.query.search) ? search.query.search[0] : null;
    if (first && first.title) {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(first.title)}`;
      const summary = await fetchJson(summaryUrl);
      if (summary && summary.extract) {
        sources.push({
          title: summary.title || first.title,
          url: summary.content_urls && summary.content_urls.desktop ? summary.content_urls.desktop.page : `https://en.wikipedia.org/wiki/${encodeURIComponent(first.title)}`,
          snippet: cleanText(summary.extract)
        });
      }
    }
  } catch (error) {
    errors.push(`Wikipedia: ${error.message}`);
    warn(`Company research Wikipedia failed for "${name}": ${error.message}`);
  }

  const uniqueSources = sources.filter((source, index, collection) => {
    const key = `${source.title}|${source.url}|${source.snippet}`;
    return collection.findIndex((item) => `${item.title}|${item.url}|${item.snippet}` === key) === index;
  }).slice(0, 4);

  return {
    status: uniqueSources.length ? "found" : "not_found",
    query: name,
    summary: uniqueSources.length
      ? uniqueSources.map((source) => `${source.title}: ${source.snippet}`).join("\n")
      : "No se encontraron datos publicos confiables en la busqueda automatica. No inventar informacion externa.",
    sources: uniqueSources,
    errors
  };
}

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

  const companyResearch = await getCompanyResearch(payload.proposal.company, context);
  const enrichedPayload = {
    ...payload,
    companyResearch,
    aiInstructions: {
      ...(payload.aiInstructions || {}),
      useCompanyResearch: companyResearch.status === "found",
      strictGrounding: "Usar companyResearch solo si tiene fuentes. Si no hay fuentes, no inventar datos externos y basar la recomendacion en answers/proposal.",
      responseFormat: "Devolver texto en Markdown con secciones: ## Perfil del cliente, ## Lectura comercial, ## Recomendacion Possumus, ## Argumentos para la reunion. La ultima seccion debe usar bullets."
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
          companyResearch,
          raw: responseBody
        }
      : {
          error: responseBody.error || responseText || `Power Automate respondio ${flowResponse.status}`
        }
  };
};
