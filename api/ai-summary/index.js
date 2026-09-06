function cleanText(value, maxLength = 900) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function companyTokens(company) {
  const stopWords = new Set(["sa", "s.a", "srl", "s.r.l", "sas", "grupo", "empresa", "compania", "cia", "the", "de", "del", "la", "el", "los", "las"]);
  return normalize(company)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function domainFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

function isBlockedDomain(url) {
  const domain = domainFromUrl(url);
  return [
    "wikipedia.org",
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "tiktok.com",
    "github.com",
    "mercadolibre.com"
  ].some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
}

function scoreOfficialUrl(url, tokens, sectorTerms = []) {
  const normalizedUrl = normalize(url);
  const domain = normalize(domainFromUrl(url));
  let score = 0;
  tokens.forEach((token) => {
    if (domain.includes(token)) score += 5;
    else if (normalizedUrl.includes(token)) score += 1;
  });
  sectorTerms.forEach((term) => {
    if (domain.includes(term)) score += 3;
    else if (normalizedUrl.includes(term)) score += 1;
  });
  if (isBlockedDomain(url)) score -= 20;
  if (/\/(tag|author|noticias|blog)\//i.test(url)) score -= 3;
  return score;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "GeneradorPropuestaADP/1.0",
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, timeoutMs = 6000) {
  const response = await fetchWithTimeout(url, { headers: { "Accept": "application/json" } }, timeoutMs);
  return await response.json();
}

async function fetchHtml(url, timeoutMs = 7000) {
  const response = await fetchWithTimeout(url, { headers: { "Accept": "text/html,application/xhtml+xml" } }, timeoutMs);
  return {
    url: response.url || url,
    html: await response.text()
  };
}

function decodeDuckDuckGoUrl(value) {
  try {
    const parsed = new URL(value, "https://duckduckgo.com");
    const encoded = parsed.searchParams.get("uddg");
    return encoded ? decodeURIComponent(encoded) : parsed.href;
  } catch (error) {
    return value;
  }
}

function extractSearchUrls(html) {
  const urls = [];
  const regexes = [
    /class="result__a"[^>]+href="([^"]+)"/g,
    /<a[^>]+href="([^"]+)"[^>]*class="[^"]*result__a/g
  ];
  regexes.forEach((regex) => {
    let match;
    while ((match = regex.exec(html))) {
      const url = decodeDuckDuckGoUrl(match[1].replace(/&amp;/g, "&"));
      if (/^https?:\/\//i.test(url)) urls.push(url);
    }
  });
  return urls;
}

function likelySectorTerms(payload) {
  const text = normalize([
    payload.proposal && payload.proposal.company,
    payload.answers && payload.answers.customerContext && payload.answers.customerContext.industry,
    payload.answers && payload.answers.productivity && payload.answers.productivity.communication
  ].filter(Boolean).join(" "));
  if (/seguro|financier|poliza|siniestro/.test(text)) return ["seguro", "seguros", "aseguradora"];
  if (/salud|clinica|paciente/.test(text)) return ["salud", "clinica"];
  if (/retail|commerce|tienda/.test(text)) return ["retail", "tienda"];
  return [];
}

function candidateDomains(tokens, sectorTerms) {
  const joined = tokens.join("");
  const candidates = new Set();
  if (joined) {
    sectorTerms.forEach((term) => {
      if (!joined.includes(term)) {
        [".com", ".com.ar"].forEach((tld) => candidates.add(`https://${joined}${term}${tld}`));
      }
    });
    [".com", ".com.ar", ".com.uy", ".com.br", ".net"].forEach((tld) => candidates.add(`https://${joined}${tld}`));
  }
  return [...candidates];
}

function extractMeta(html, name) {
  const title = cleanText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1], 160);
  const description = cleanText((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) || [])[1], 360);
  const body = cleanText(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " "), 2400);
  return {
    title: title || name,
    description,
    body
  };
}

function extractInternalLinks(html, baseUrl) {
  const base = new URL(baseUrl);
  const links = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) {
    try {
      const url = new URL(match[1].replace(/&amp;/g, "&"), base.href);
      if (url.hostname !== base.hostname) continue;
      url.hash = "";
      const label = cleanText(match[2], 120);
      const searchable = normalize(`${url.pathname} ${label}`);
      if (/(empresa|empresas|producto|productos|persona|personas|contacto|atencion|cliente|clientes|nosotros|quienes|cobertura|coberturas|seguro|seguros|soluciones|servicios)/.test(searchable)) {
        links.push(url.href);
      }
    } catch (error) {
      // Ignore malformed hrefs from third-party sites.
    }
  }
  return [...new Set(links)].slice(0, 5);
}

function extractProducts(text) {
  const candidates = [
    "Auto", "Moto", "Hogar", "Personas", "Bolso", "Bicicleta", "Comercio", "Industria",
    "Bodegas", "Oil & Gas", "Coberturas Agricolas", "Coberturas Agrícolas", "Caucion", "Caución",
    "Incendio", "Todo Riesgo Operativo", "Seguro Tecnico", "Seguro Técnico", "Responsabilidad Civil",
    "ART", "Vida", "Salud", "Flota", "Cauciones", "Agro"
  ];
  const normalizedText = normalize(text);
  return [...new Set(candidates.filter((item) => normalizedText.includes(normalize(item))))].slice(0, 12);
}

function extractContacts(text) {
  const phones = [...new Set((text.match(/(?:\+?\d{1,3}[\s.-]?)?(?:0?\d{2,4}[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g) || [])
    .map((item) => cleanText(item, 40))
    .filter((item) => item.replace(/\D/g, "").length >= 8))].slice(0, 4);
  const emails = [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
    .map((item) => item.toLowerCase()))].slice(0, 4);
  return { phones, emails };
}

function buildBusinessContext(name, officialSite, pages) {
  const combinedText = pages.map((page) => `${page.title}. ${page.description}. ${page.body}`).join(" ");
  const products = extractProducts(combinedText);
  const contacts = extractContacts(combinedText);
  const overviewParts = pages
    .map((page) => page.description || page.body)
    .filter(Boolean)
    .map((text) => cleanText(text, 280))
    .slice(0, 3);
  const overview = overviewParts.join(" ");
  const promptLines = [
    `Empresa consultada: ${name}`,
    officialSite ? `Sitio oficial probable: ${officialSite}` : "",
    overview ? `Descripcion/actividad detectada: ${overview}` : "",
    products.length ? `Productos/servicios detectados: ${products.join(", ")}` : "",
    contacts.phones.length ? `Telefonos publicos detectados: ${contacts.phones.join(", ")}` : "",
    contacts.emails.length ? `Emails publicos detectados: ${contacts.emails.join(", ")}` : "",
    "Si no hay datos publicos suficientes sobre tamano, empleados o facturacion, no inferirlos."
  ].filter(Boolean);
  return {
    overview,
    products,
    contacts,
    promptContext: promptLines.join("\n")
  };
}

async function findOfficialSite(name, payload, tokens, sectorTerms, warn) {
  const explicitUrl = payload.proposal && (payload.proposal.companyWebsite || payload.proposal.website || payload.proposal.url);
  if (explicitUrl) return explicitUrl;

  const directCandidates = candidateDomains(tokens, sectorTerms);
  for (const candidate of directCandidates) {
    try {
      const result = await fetchHtml(candidate, 4500);
      return result.url;
    } catch (error) {
      warn(`Direct site candidate failed for "${name}" at ${candidate}: ${error.message}`);
    }
  }

  try {
    const query = `${name} ${sectorTerms.join(" ")} sitio oficial empresa productos contacto`;
    const searchUrl = `https://duckduckgo.com/html/?${new URLSearchParams({ q: query })}`;
    const { html } = await fetchHtml(searchUrl, 7000);
    const urls = extractSearchUrls(html)
      .filter((url) => !isBlockedDomain(url))
      .sort((a, b) => scoreOfficialUrl(b, tokens, sectorTerms) - scoreOfficialUrl(a, tokens, sectorTerms));
    return urls.find((url) => scoreOfficialUrl(url, tokens, sectorTerms) >= 4) || "";
  } catch (error) {
    warn(`Company official-site search failed for "${name}": ${error.message}`);
    return "";
  }
}

async function getCompanyResearch(company, payload, context) {
  const name = cleanText(company, 120);
  if (!name) {
    return {
      status: "skipped",
      summary: "No se recibio nombre de empresa para buscar contexto publico.",
      sources: []
    };
  }

  const tokens = companyTokens(name);
  const sectorTerms = likelySectorTerms(payload);
  const errors = [];
  const warn = (message) => {
    if (context.log && typeof context.log.warn === "function") context.log.warn(message);
    else if (typeof context.log === "function") context.log(message);
  };

  const officialSite = await findOfficialSite(name, payload, tokens, sectorTerms, warn);
  if (!officialSite) {
    return {
      status: "not_found",
      query: name,
      summary: "No se encontro un sitio oficial probable. No inventar informacion externa.",
      sources: [],
      errors
    };
  }

  const pages = [];
  try {
    const home = await fetchHtml(officialSite);
    const homeMeta = extractMeta(home.html, name);
    pages.push({ url: home.url, ...homeMeta });

    const internalLinks = extractInternalLinks(home.html, home.url);
    for (const link of internalLinks) {
      try {
        const page = await fetchHtml(link, 5000);
        pages.push({ url: page.url, ...extractMeta(page.html, name) });
      } catch (error) {
        errors.push(`${link}: ${error.message}`);
        warn(`Company page research failed for "${name}" at ${link}: ${error.message}`);
      }
    }
  } catch (error) {
    errors.push(`${officialSite}: ${error.message}`);
    warn(`Company official-site fetch failed for "${name}" at ${officialSite}: ${error.message}`);
  }

  const usefulPages = pages
    .filter((page) => {
      const searchable = normalize(`${page.title} ${page.description} ${page.body} ${page.url}`);
      return tokens.some((token) => searchable.includes(token)) || sectorTerms.some((term) => searchable.includes(term));
    })
    .slice(0, 5);

  const contextData = buildBusinessContext(name, officialSite, usefulPages);
  const sources = usefulPages.map((page) => ({
    title: page.title || domainFromUrl(page.url) || name,
    url: page.url,
    snippet: cleanText(page.description || page.body, 360)
  }));

  return {
    status: usefulPages.length ? "found" : "not_found",
    query: name,
    officialSite,
    overview: contextData.overview,
    products: contextData.products,
    contacts: contextData.contacts,
    promptContext: contextData.promptContext,
    summary: usefulPages.length
      ? contextData.promptContext
      : "No se pudo extraer informacion util del sitio oficial probable. No inventar informacion externa.",
    sources,
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

  const companyResearch = await getCompanyResearch(payload.proposal.company, payload, context);
  const includeBudgetEstimate = payload.proposal && payload.proposal.budgetEstimateInput
    ? payload.proposal.budgetEstimateInput.includeBudgetEstimate !== false
    : true;
  const responseFormat = includeBudgetEstimate
    ? "Devolver texto en Markdown con secciones: ## Contexto de la empresa, ## Lectura comercial, ## Recomendacion Possumus, ## Estimacion asistida de presupuesto, ## Argumentos para la reunion. En Contexto de la empresa incluir rubro, productos/servicios, escala si esta sustentada y canales/contactos publicos si existen. En Estimacion asistida de presupuesto usar proposal.budgetEstimateInput: si shouldEstimate es false, no cerrar rango y pedir validacion con preventa/adopcion; si es true, indicar rango sugerido, modalidad comercial, supuestos y alertas. No inventar precios cerrados para add-ons a cotizar. La ultima seccion debe usar bullets."
    : "Devolver texto en Markdown con secciones: ## Contexto de la empresa, ## Lectura comercial, ## Recomendacion Possumus, ## Argumentos para la reunion. En Contexto de la empresa incluir rubro, productos/servicios, escala si esta sustentada y canales/contactos publicos si existen. No incluir estimacion de presupuesto porque el comercial la desactivo. La ultima seccion debe usar bullets.";
  const enrichedPayload = {
    ...payload,
    companyResearch,
    aiInstructions: {
      ...(payload.aiInstructions || {}),
      useCompanyResearch: companyResearch.status === "found",
      strictGrounding: "Usar companyResearch solo si status es found y tiene sources del sitio oficial probable. No usar Wikipedia, redes sociales ni fuentes que no coincidan claramente con la empresa. Si no hay datos sobre tamano, empleados, facturacion o contactos comerciales, decir 'no detectado en fuentes publicas' en vez de inventar.",
      responseFormat
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
      "markdownSummary",
      "summary",
      "comparison",
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
