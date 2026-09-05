# Diseñador de Propuestas de Adopción

Aplicación HTML para que equipos comerciales y preventa de Possumus releven necesidades de adopción con un cliente y generen una propuesta recomendada.

## Uso

Abrir `index.html` en el navegador. El flujo guía la selección de contexto, alcance, readiness, dolores, add-ons y genera una propuesta exportable a PDF.

## Handoff con Power Automate

La app publica una API `POST /api/handoff` para reenviar el payload de la propuesta a Power Automate sin exponer la URL del Flow en el HTML público.

Configurar en Azure Static Web Apps una variable de aplicación llamada `POWER_AUTOMATE_HANDOFF_URL` con la URL del trigger HTTP del Flow.
