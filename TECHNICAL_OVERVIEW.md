# Resumen técnico · Generador de Propuestas de Adopción

Versión documentada: **MVP 0.10.8**
Última actualización funcional: **2026-09-07**
Aplicación publicada: <https://proud-stone-0a0431210.3.azurestaticapps.net/>

## 1. Objetivo de la aplicación

La aplicación permite que un comercial o preventa de Possumus releve información de un cliente y genere una propuesta de adopción Microsoft 365 / Copilot con:

- plan recomendado o propuesta directa;
- confianza del diagnóstico;
- add-ons sugeridos;
- resumen económico;
- propuesta final;
- PDF comercial;
- envío de propuesta a Power Automate;
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

1. El comercial elige el modo de trabajo:
   - **Recomendar plan con diagnóstico**;
   - **Crear propuesta directa**.
2. En modo diagnóstico, carga compañía y fecha estimada.
3. Completa un wizard de diagnóstico:
   - contexto del cliente;
   - referente y ubicación del cliente, opcionales, capturados en el inicio;
   - alcance de usuarios;
   - readiness y oportunidad;
   - diagnóstico operativo Microsoft 365;
   - dolores de comunicación, reuniones, creación/análisis y automatización;
   - Copilot Cowork;
   - logística y medición;
   - add-ons sugeridos y adicionales automáticos por modalidad.
4. La app calcula un plan recomendado mediante scoring.
5. El comercial puede validar el diagnóstico con IA.
6. En modo propuesta directa, el comercial carga compañía, fecha y selecciona directamente Plan 0/1/2/3. La app salta a la propuesta final sin scoring visible, sin alternativas y sin comparador.
7. Se genera la propuesta final con:
   - plan recomendado;
   - selección manual de plan principal cuando hay alternativas;
   - razones de recomendación;
   - confianza;
   - resumen económico;
   - add-ons y adicionales de modalidad;
   - roadmap visual;
   - resumen IA;
   - comparación IA contra alternativas, si existen.
8. La propuesta puede exportarse a PDF o enviarse a Power Automate.

## 3.1 Modos de trabajo

| Modo | Uso | Comportamiento |
| --- | --- | --- |
| Diagnóstico guiado | Cuando no está claro qué plan corresponde | Ejecuta wizard, scoring, confianza, alternativas, validación IA, comparador y selección manual de plan principal |
| Propuesta directa | Cuando el comercial ya sabe qué plan presentar | Mini-wizard breve: selecciona plan manualmente, tipo de cliente, alcance/audiencia, entrega y medición; crea la Versión 1 sin alternativas ni scoring visible |

En modo directo se guarda `proposalMode: "direct"` y `directPlanKey`. En modo guiado se guarda `proposalMode: "guided"`.

Pasos del modo directo:

1. Cliente, fecha y plan.
2. Tipo de cliente.
3. Alcance/audiencia.
4. Entrega y medición.

Estos datos no recalculan el plan elegido; solo enriquecen propuesta final, roadmap, PDF y propuesta enviada.

## 4. Modelo de decisión

La recomendación del plan se calcula en `planDecision()` con un scoring ponderado.

Planes disponibles por escalera de progresión comercial:

| Etapa comercial | Nombre visible | Referencia comercial vigente | Enfoque |
| --- | --- | --- | --- |
| Etapa 0 | Productividad Digital | Productividad Digital (P1) | Programa de adopción Microsoft 365: diagnóstico, comunicación, formación aplicada, acompañamiento y medición |
| Etapa 1 | Envisioning IA | Envisioning IA (P0) | Exploración, business case y primeros casos de IA sin Microsoft 365 Copilot completo |
| Etapa 2 | IA aplicada al trabajo | IA aplicada al trabajo (P2) | Activar uso y ROI de Microsoft 365 Copilot |
| Etapa 3 | Productividad Digital + IA | Productividad Digital + Microsoft 365 Copilot (P3) | Programa integral con cambio, adopción, gobierno e IA |

La lógica interna conserva las claves `plan0`, `plan1`, `plan2`, `plan3` para no romper referencias técnicas ni la presentación comercial existente. La UI muestra primero la etapa comercial y debajo la referencia vigente.

P1 se trata como iniciativa de adopción, no como training aislado. El catálogo, la propuesta final, el PDF, el roadmap y las instrucciones de IA deben presentarlo por pilares: diagnóstico de madurez, comunicación y convocatoria, formación aplicada al trabajo real, acompañamiento/refuerzos y medición ejecutiva por ola.

La app incluye guardrails de progresión: si el cliente intenta saltar etapas (por ejemplo, pedir Cowork/agentes sin adopción Copilot, o pedir Copilot sin base Microsoft 365), la propuesta no bloquea la oportunidad pero muestra una lectura comercial con el prerrequisito y el escalón recomendado.

P0 / Envisioning IA queda deliberadamente acotado para preservar su función exploratoria. Sus únicos add-ons seleccionables son **Casos para líderes**, **Readiness técnico** y **Webinar introductorio: Copilot en 30 minutos**. Todo otro módulo aparece como no disponible por alcance; si el cliente lo necesita, corresponde evaluar P1, P2 o P3.

P1 / Productividad Digital también usa add-ons acotados para no duplicar lo que ya cubre el programa base. Solo quedan seleccionables **Readiness técnico**, **Excel intermedio**, **Excel avanzado** y **Módulo a medida de herramienta puntual**. El resto queda no disponible por alcance o como señal para ampliar el programa/cambiar a P2 o P3.

P2 / IA aplicada al trabajo permite solo add-ons de profundización Copilot: **Cowork y Copilot**, **Agents & Cowork**, **Agentes a medida con Copilot Studio**, **Webinar especializado: agentes**, **Webinar especializado: agentes en SharePoint** y **Webinar especializado: notebooks y funcionalidades Copilot**. Casos por rol, Prompt Library, Copilot en Excel y Dashboard se consideran incluidos en el plan base.

P3 / Productividad Digital + IA se modela como programa integral. Todo el catálogo de add-ons queda incluido o absorbido por el alcance base salvo **Cowork y Copilot** y **Agentes a medida con Copilot Studio**, que son los únicos módulos seleccionables/cotizables aparte.

La modalidad **virtual** no genera cargo adicional. Si el comercial selecciona **presencial** o **mixta**, `deliveryChargeItem()` suma automáticamente un cargo operativo de modalidad usando los IDs del catálogo `delivery-onsite` o `delivery-hybrid`. Estos ítems viven en la misma fuente de precios de add-ons para poder administrarlos desde Dataverse, pero no se muestran como módulos funcionales seleccionables.

La industria incluye una opción específica para **Energía, servicios eléctricos y construcción**, útil para clientes con obras, servicios técnicos, compras, documentación operativa, depósito y oficina técnica.

La ubicación del cliente se usa para acotar el enriquecimiento público con IA. Por defecto se prioriza `Argentina`; si el comercial agrega provincia/localidad, por ejemplo `San Rafael, Mendoza, Argentina`, el backend de `api/ai-summary` suma esos términos a la búsqueda y prioriza dominios `.com.ar`/`.ar`.

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
| Propuesta directa | `state.proposalMode === "direct"` y `state.directPlanKey` |
| Trazabilidad en propuesta enviada | `algorithmRecommendedPlanKey`, `selectedPlanKey`, `planWasChangedByCommercial` |

Si hay alternativas, el comercial puede promover una alternativa con **Usar como principal**. La propuesta final, el PDF y la propuesta enviada se recalculan con ese plan seleccionado. En la vista interna queda visible el plan original y el plan final seleccionado; para el cliente se mantiene una propuesta limpia con un único plan principal.

La reversión se hace con **Volver al plan original**.

En propuesta directa, `selectedProposalPlanKey()` devuelve `directPlanKey`; no se muestran controles de alternativas ni confianza algorítmica al cliente.

## 5. Add-ons y precios

Los add-ons se definen en `addOnCatalog()`. Los cargos de modalidad presencial/mixta y los precios base de planes también usan la misma fuente de precios de Dataverse. Los cargos de modalidad se filtran con `selectableAddonCatalog()` para no aparecer como add-ons manuales.

Estados posibles:

| Estado | Significado |
| --- | --- |
| Sugerido | Opcional cotizable recomendado por las respuestas del diagnóstico |
| Disponible | Opcional cotizable que puede sumarse comercialmente |
| Incluido | Componente del plan base; no es add-on por defecto, no se selecciona ni se suma al precio |
| No disponible | No aplica para este plan o requiere Microsoft 365 Copilot activo/trial u otro prerrequisito comercial |

Cowork tiene una regla especial: no se ofrece suelto ni reemplaza el plan base. Solo queda seleccionable cuando hay Microsoft 365 Copilot activo/trial y señales mínimas de adopción o casos concretos; se comunica como add-on de 3 a 5 sesiones o como siguiente paso posterior a P2. Para clientes sin licencias o en exploración inicial, se incorporó el **Webinar introductorio: Copilot en 30 minutos** como entrada liviana de sensibilización masiva con ejemplos generales, moderación y Q&A.

También existe la categoría **Webinars especializados** para consumos puntuales por tecnología: agentes, agentes en SharePoint, notebooks y funcionalidades específicas de Copilot. Estos webinars no reemplazan un plan de adopción; ayudan a profundizar un tema cuando el cliente pide mayor detalle sin iniciar un programa completo.

En escenarios de Productividad Digital o baja madurez Microsoft 365, los add-ons se priorizan para mostrar primero ordenamiento y adopción base: Arquitectura Teams + SharePoint, Orden documental y trazabilidad, Office Hours, Readiness y Champions. Los webinars quedan disponibles, pero no desplazan los módulos core de adopción.

Los precios pueden venir de Dataverse mediante Power Automate o usar fallback local. El modelo comercial usa **precio único**: cada plan, add-on o adicional tiene un `precio_texto` visible y un `precio_usd` numérico para sumar el total.

Los planes usan `quoteForPlan()`, que primero busca un precio externo con `planPriceId()` y luego cae a `fallbackQuoteForPlan()` si Dataverse no trae ese ID activo.

IDs de planes base:

| ID | Uso |
| --- | --- |
| `plan0` | P0 / Envisioning IA |
| `plan1-small` | P1 hasta 45 usuarios |
| `plan1-medium` | P1 de 46 a 300 usuarios |
| `plan1-large` | P1 más de 300 usuarios |
| `plan2-small` | P2 hasta 45 usuarios |
| `plan2-medium` | P2 de 46 a 300 usuarios |
| `plan2-large` | P2 más de 300 usuarios |
| `plan3` | P3 / Productividad Digital + IA |

IDs especiales para cargos automáticos de modalidad:

| ID | Uso |
| --- | --- |
| `delivery-onsite` | Se suma cuando la modalidad elegida es presencial |
| `delivery-hybrid` | Se suma cuando la modalidad elegida es mixta |

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

- enviar propuesta comercial;
- consultar Dataverse;
- ejecutar IA;
- desacoplar URLs sensibles del HTML público.

Endpoints implementados:

| Endpoint | Variable Azure | Función |
| --- | --- | --- |
| `/api/handoff` | `POWER_AUTOMATE_HANDOFF_URL` | Enviar propuesta |
| `/api/addon-prices` | `POWER_AUTOMATE_ADDON_PRICES_URL` | Leer precios desde Dataverse |
| `/api/ai-summary` | `POWER_AUTOMATE_AI_SUMMARY_URL` | Generar resumen ejecutivo IA |
| `/api/proposal-validation` | `POWER_AUTOMATE_AI_SUMMARY_URL` | Validar diagnóstico con IA |
| `/api/ai-roadmap` | `POWER_AUTOMATE_AI_ROADMAP_URL` | Generar roadmap personalizado |
| `/api/plan-comparison` | `POWER_AUTOMATE_PLAN_COMPARISON_URL` | Comparar planes |

## 8. PDF y envío de propuesta

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

La propuesta enviada se construye en `buildHandoffPayload()` e incluye:

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
- envío de propuesta;
- roadmap visual;
- comparador de planes;
- preparación para Dynamics.

Próximos pasos técnicos recomendados:

1. Crear los Flows definitivos para roadmap IA y comparación IA.
2. Configurar variables Azure específicas por endpoint.
3. Conectar el botón Dynamics.
4. Persistir propuestas en Dataverse o Dynamics.
5. Separar `index.html` en módulos si la app sigue creciendo.
