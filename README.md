# Diseñador de Propuestas de Adopción

Aplicación HTML para que equipos comerciales y preventa de Possumus releven necesidades de adopción con un cliente y generen una propuesta recomendada.

## Uso

Abrir `index.html` en el navegador. El flujo guía la selección de contexto, alcance, readiness, dolores, add-ons y genera una propuesta exportable a PDF.

## Handoff con Power Automate

La app publica una API `POST /api/handoff` para reenviar el payload de la propuesta a Power Automate sin exponer la URL del Flow en el HTML público.

Configurar en Azure Static Web Apps una variable de aplicación llamada `POWER_AUTOMATE_HANDOFF_URL` con la URL del trigger HTTP del Flow.

## Resumen ejecutivo con IA

La app publica una API `POST /api/ai-summary` para pedir a Power Automate un resumen ejecutivo comercial generado con IA. Antes de invocar el Flow, la API intenta detectar el sitio oficial probable de la empresa, leer paginas publicas relevantes y enriquecer el payload con actividad, productos/servicios y canales publicos. Si no encuentra datos confiables, informa esa situacion en el payload para que la IA no invente informacion externa.

Configurar en Azure Static Web Apps una variable de aplicación llamada `POWER_AUTOMATE_AI_SUMMARY_URL` con la URL del trigger HTTP del Flow de IA. El Flow debe devolver JSON con la forma `{ "summary": "..." }`. Para que el frontend lo muestre mejor, conviene que el resumen venga en Markdown con secciones `## Contexto de la empresa`, `## Lectura comercial`, `## Recomendacion Possumus` y `## Argumentos para la reunion`.
