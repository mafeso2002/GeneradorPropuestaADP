# Diseñador de Propuestas de Adopción

Aplicación HTML para que equipos comerciales y preventa de Possumus releven necesidades de adopción con un cliente y generen una propuesta recomendada.

## Uso

Abrir `index.html` en el navegador. El flujo guía la selección de contexto, alcance, readiness, dolores, add-ons y genera una propuesta exportable a PDF.

## Handoff con Power Automate

La app publica una API `POST /api/handoff` para reenviar el payload de la propuesta a Power Automate sin exponer la URL del Flow en el HTML público.

Configurar en Azure Static Web Apps una variable de aplicación llamada `POWER_AUTOMATE_HANDOFF_URL` con la URL del trigger HTTP del Flow.

## Modelo de decisión

La recomendación se calcula con un scoring ponderado. La app mantiene un plan principal para que el comercial tenga una salida clara, pero agrega una etiqueta de confianza. Si la confianza no es alta, muestra alternativas posibles para validar con preventa/adopción antes de cerrar el alcance.

Variables decisoras principales: objetivo comercial, licenciamiento Copilot, uso semanal real de Copilot, madurez Microsoft 365, casos de uso concretos, necesidad de agentes, alcance/escala, gobierno/COE, sponsor y acompañamiento esperado. Las preguntas operativas y logísticas siguen alimentando argumentos, add-ons, handoff y resumen IA.

La pantalla de add-ons muestra el plan probable y separa los módulos entre sugeridos para el caso, disponibles para ampliar alcance, ya incluidos en el plan y no disponibles por licenciamiento. Esto evita cotizar como adicional una actividad que ya forma parte del plan base.

## Resumen ejecutivo con IA

La app publica una API `POST /api/ai-summary` para pedir a Power Automate un resumen ejecutivo comercial generado con IA. Antes de invocar el Flow, la API intenta detectar el sitio oficial probable de la empresa, leer paginas publicas relevantes y enriquecer el payload con actividad, productos/servicios y canales publicos. Si no encuentra datos confiables, informa esa situacion en el payload para que la IA no invente informacion externa.

Configurar en Azure Static Web Apps una variable de aplicación llamada `POWER_AUTOMATE_AI_SUMMARY_URL` con la URL del trigger HTTP del Flow de IA. El Flow debe devolver JSON con la forma `{ "summary": "..." }`. Para que el frontend lo muestre mejor, conviene que el resumen venga en Markdown con secciones `## Contexto de la empresa`, `## Lectura comercial`, `## Recomendacion Possumus` y `## Argumentos para la reunion`.
