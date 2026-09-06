# Resumen técnico · Generador de Propuestas de Adopción

Versión documentada: **MVP 0.9.1**
Última actualización funcional: **2026-09-06**
Aplicación publicada: <https://proud-stone-0a0431210.3.azurestaticapps.net/>

## 1. Objetivo de la aplicación

La aplicación permite que un comercial o preventa de Possumus releve información de un cliente y genere una propuesta de adopción Microsoft 365 / Copilot con:

- plan recomendado;
- confianza del diagnóstico;
- add-ons sugeridos;
- resumen económico;
- propuesta final;
- PDF comercial;
- handoff a Power Automate;
- capacidades asistidas con IA para validación, resumen, roadmap y comparación de planes.

## 2. Arquitectura general

La solución está desarrollada como una **webapp estática** con lógica principal en `index.html`, publicada en **Azure Static Web Apps**.

Componentes:

| Componente | Uso |
| --- | --- |
| `index.html` | Frontend completo: wizard, scoring, UI, PDF, payloads y consumo de APIs |
| `api/*` | Azure Functions HTTP para desacoplar Power Automate del HTML público |
| `README.md` | Documentación operativa de endpoints y variables |
| `TECHNICAL_OVERVIEW.md` | Documento técnico para revisión con liderazgo técnico |

No hay framework frontend ni build step obligatorio. La app corre como HTML/CSS/JavaScript vanilla.

## 3. Flujo comercial

1. El comercial carga compañía y fecha estimada.
2. Completa un wizard de diagnóstico:
   - contexto del cliente;
   - alcance de usuarios;
   - readiness y oportunidad;
   - diagnóstico operativo Microsoft 365;
   - dolores de comunicación, reuniones, creación/análisis y automatización;
   - Copilot Cowork;
   - logística y medición;
   - add-ons sugeridos.
3. La app calcula un plan recomendado mediante scoring.
4. El comercial puede validar el diagnóstico con IA.
5. Se genera la propuesta final con:
   - plan recomendado;
   - selección manual de plan principal cuando hay alternativas;
   - razones de recomendación;
   - confianza;
   - resumen económico;
   - add-ons;
   - roadmap visual;
   - resumen IA;
   - comparación IA contra alternativas, si existen.
6. La propuesta puede exportarse a PDF o enviarse como handoff a Power Automate.

## 4. Modelo de decisión

La recomendación del plan se calcula en `planDecision()` con un scoring ponderado.

Planes disponibles:

| Plan | Enfoque |
| --- | --- |
| Plan 0 · Envisioning IA | Exploración, business case y primeros casos de IA |
| Plan 1 · Productividad Digital | Ordenar hábitos Microsoft 365, colaboración, documentos y tareas |
| Plan 2 · IA aplicada al trabajo | Activar uso y ROI de Microsoft 365 Copilot |
| Plan 3 · Productividad Digital + Microsoft 365 Copilot | Programa integral con cambio, adopción e IA |

Variables principales del scoring:

- objetivo comercial;
- licenciamiento Copilot;
- uso semanal real de Copilot;
- madurez Microsoft 365;
- casos de uso identificados;
- interés en agentes;
- escala;
- sponsor;
- gobierno/datos/seguridad;
- acompañamiento esperado;
- señales operativas de orden digital.

El algoritmo devuelve:

- plan recomendado;
- porcentaje de confianza;
- nivel de confianza;
- razones principales;
- alternativas cercanas cuando la decisión no es obvia.

## 4.1 Selección comercial de plan principal

La app separa la recomendación algorítmica de la versión final que el comercial decide presentar:

| Concepto | Campo / uso |
| --- | --- |
| Plan original sugerido por algoritmo | `planDecision().recommendedKey` |
| Plan principal seleccionado | `selectedProposalPlanKey()` |
| Override manual | `state.overridePlanKey` |
| Trazabilidad en handoff | `algorithmRecommendedPlanKey`, `selectedPlanKey`, `planWasChangedByCommercial` |

Si hay alternativas, el comercial puede promover una alternativa con **Usar como principal**. La propuesta final, el PDF y el handoff se recalculan con ese plan seleccionado. En la vista interna queda visible el plan original y el plan final seleccionado; para el cliente se mantiene una propuesta limpia con un único plan principal.

La reversión se hace con **Volver al plan original**.

## 5. Add-ons y precios

Los add-ons se definen en `addOnCatalog()`.

Estados posibles:

| Estado | Significado |
| --- | --- |
| Sugerido | Aplica por las respuestas del diagnóstico |
| Disponible | Puede sumarse comercialmente |
| Incluido | Ya forma parte del plan base y no debería cotizarse aparte |
| No disponible | Requiere Microsoft 365 Copilot y el cliente no tiene licencia/trial |

Los precios pueden venir de Dataverse mediante Power Automate o usar fallback local.

Tabla Dataverse esperada:

- Display name: `PreciosAddonsAdopcion`
- Logical name: `pss_PreciosAddonsAdopcion`
- Entity set: `pss_preciosaddonsadopcions`
- Entorno: **Possumus - Desarrollo**

Endpoint frontend:

- `GET /api/addon-prices`

Variable Azure:

- `POWER_AUTOMATE_ADDON_PRICES_URL`

## 6. Capacidades de IA

La app usa IA de forma asistida y consultiva. La IA no modifica automáticamente respuestas estructuradas salvo que el comercial aplique una acción explícita.

### 6.1 Validación IA del diagnóstico

Endpoint:

- `POST /api/proposal-validation`

Uso:

- revisa consistencia entre respuestas, plan recomendado, confianza y add-ons;
- detecta contradicciones comerciales;
- sugiere preguntas faltantes;
- recomienda mantener, revisar o ajustar la propuesta.

Fallback:

- si Power Automate no está configurado o falla, se usa `fallbackValidation()` para no bloquear el flujo comercial.

### 6.2 Resumen ejecutivo con IA

Endpoint:

- `POST /api/ai-summary`

Uso:

- genera lectura comercial;
- estima presupuesto si el comercial lo habilita;
- busca contexto público de la empresa;
- prioriza sitio oficial probable;
- evita inventar información cuando no hay fuentes confiables.

Variable Azure:

- `POWER_AUTOMATE_AI_SUMMARY_URL`

### 6.3 Roadmap personalizado con IA

Endpoint:

- `POST /api/ai-roadmap`

Uso:

- personaliza etapas del roadmap según diagnóstico, industria, área, modalidad, add-ons y fecha de inicio;
- devuelve etapas con actividades, responsable sugerido, entregable y riesgo;
- se muestra como roadmap visual tipo timeline/Gantt;
- puede alternarse entre roadmap original y roadmap personalizado.

Variables Azure:

- `POWER_AUTOMATE_AI_ROADMAP_URL`
- fallback: `POWER_AUTOMATE_AI_SUMMARY_URL`

### 6.4 Comparador de planes con IA

Endpoint:

- `POST /api/plan-comparison`

Uso:

- compara plan recomendado vs alternativa;
- explica diferencias de alcance, precio y riesgo;
- ayuda al comercial a justificar si conviene subir o bajar de plan.

Variables Azure:

- `POWER_AUTOMATE_PLAN_COMPARISON_URL`
- fallback: `POWER_AUTOMATE_AI_SUMMARY_URL`

## 7. Power Automate

Power Automate se usa como capa de integración para:

- enviar handoff comercial;
- consultar Dataverse;
- ejecutar IA;
- desacoplar URLs sensibles del HTML público.

Endpoints implementados:

| Endpoint | Variable Azure | Función |
| --- | --- | --- |
| `/api/handoff` | `POWER_AUTOMATE_HANDOFF_URL` | Enviar propuesta/handoff |
| `/api/addon-prices` | `POWER_AUTOMATE_ADDON_PRICES_URL` | Leer precios desde Dataverse |
| `/api/ai-summary` | `POWER_AUTOMATE_AI_SUMMARY_URL` | Generar resumen ejecutivo IA |
| `/api/proposal-validation` | `POWER_AUTOMATE_AI_SUMMARY_URL` | Validar diagnóstico con IA |
| `/api/ai-roadmap` | `POWER_AUTOMATE_AI_ROADMAP_URL` | Generar roadmap personalizado |
| `/api/plan-comparison` | `POWER_AUTOMATE_PLAN_COMPARISON_URL` | Comparar planes |

## 8. PDF y handoff

El PDF se genera desde `buildPrintableProposal()` abriendo una ventana imprimible.

Incluye:

- portada;
- presentación Possumus;
- metodología;
- plan recomendado;
- resumen económico;
- add-ons;
- alternativas;
- comparación de planes si fue generada;
- resumen IA si fue generado;
- validación IA si fue generada;
- roadmap visual;
- detalle de etapas.

El handoff se construye en `buildHandoffPayload()` e incluye:

- datos de propuesta;
- plan principal seleccionado;
- plan original sugerido por el algoritmo;
- indicador de cambio manual de plan;
- scoring y confianza;
- add-ons seleccionados;
- total estimado;
- roadmap activo;
- metadata de roadmap IA;
- resumen IA y contexto público detectado;
- validación IA;
- comparaciones de planes vigentes;
- respuestas estructuradas del diagnóstico.

## 9. Botón Dynamics

La pantalla final incluye un botón **Subir a Dynamics**.

Estado actual:

- visible solo en la propuesta final del modo comercial/admin;
- por ahora es un placeholder;
- no ejecuta escritura en Dynamics todavía.

Objetivo futuro:

- crear oportunidad o registro comercial;
- adjuntar propuesta/PDF;
- guardar estado de propuesta;
- vincular add-ons y monto estimado.

## 10. Estado actual del MVP

El MVP ya cubre el ciclo comercial completo:

- relevamiento;
- recomendación;
- validación;
- add-ons;
- pricing;
- propuesta;
- PDF;
- handoff;
- roadmap visual;
- comparador de planes;
- preparación para Dynamics.

Próximos pasos técnicos recomendados:

1. Crear los Flows definitivos para roadmap IA y comparación IA.
2. Configurar variables Azure específicas por endpoint.
3. Conectar el botón Dynamics.
4. Persistir propuestas en Dataverse o Dynamics.
5. Separar `index.html` en módulos si la app sigue creciendo.
