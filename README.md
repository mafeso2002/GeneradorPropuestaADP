# Diseñador de Propuestas de Adopción

Aplicación HTML para que equipos comerciales y preventa de Possumus releven necesidades de adopción con un cliente y generen una propuesta recomendada.

## Resumen técnico

Ver `TECHNICAL_OVERVIEW.md` para una descripción técnica del MVP: arquitectura, flujo comercial, scoring, add-ons, IA, Power Automate, Dataverse, PDF, envío de propuesta y preparación para Dynamics.

## Uso

Abrir `index.html` en el navegador. El flujo guía la selección de contexto, alcance, readiness, dolores, add-ons y genera una propuesta exportable a PDF.

## Envío de propuesta con Power Automate

La app publica una API `POST /api/handoff` para reenviar el payload de la propuesta a Power Automate sin exponer la URL del Flow en el HTML público.

Configurar en Azure Static Web Apps una variable de aplicación llamada `POWER_AUTOMATE_HANDOFF_URL` con la URL del trigger HTTP del Flow.

## Precios comerciales desde Dataverse

La app publica una API `GET /api/addon-prices` que consulta Power Automate y reemplaza los precios fallback de add-ons, cargos de modalidad y planes base por valores administrados en Dataverse. Si el Flow o la variable no están configurados, la app conserva los precios fallback hardcodeados en `addOnCatalog()` y `fallbackQuoteForPlan()` (no se muestra "A cotizar" salvo que un precio individual no se pueda interpretar como rango USD).

Configurar en Azure Static Web Apps una variable de aplicación llamada `POWER_AUTOMATE_ADDON_PRICES_URL` con la URL del trigger HTTP del Flow creado en el entorno **Possumus - Desarrollo** (`474ab5eb-a1ed-4530-b1c4-d47edde7c659`).

Tabla Dataverse en **Possumus - Desarrollo**: `PreciosAddonsAdopcion` (`pss_PreciosAddonsAdopcion`).

| Campo | Uso |
| --- | --- |
| `addon_id` | ID técnico usado por la app, por ejemplo `excel-intermediate`, `delivery-onsite`, `delivery-hybrid` o `plan1-small` |
| `nombre` | Nombre visible del add-on |
| `categoria` | Categoría comercial |
| `precio_texto` | Texto comercial, por ejemplo `USD 850 + IVA` |
| `precio_min_usd` | Valor mínimo numérico opcional |
| `precio_max_usd` | Valor máximo numérico opcional |
| `requiere_copilot` | Si requiere Microsoft 365 Copilot |
| `activo` | Permite ocultar/desactivar un add-on |
| `notas` | Condición comercial, por ejemplo `por grupo` |

## Modelo de decisión

La recomendación se calcula con un scoring ponderado. La app mantiene un plan principal para que el comercial tenga una salida clara, pero agrega una etiqueta de confianza. Si la confianza no es alta, muestra alternativas posibles para validar con preventa/adopción antes de cerrar el alcance.

Variables decisoras principales: objetivo comercial, licenciamiento Copilot, uso semanal real de Copilot, madurez Microsoft 365, casos de uso concretos, necesidad de agentes, alcance/escala, gobierno/COE, sponsor y acompañamiento esperado. Las preguntas operativas y logísticas siguen alimentando argumentos, add-ons, propuesta enviada y resumen IA.

Productividad Digital (P1) se posiciona como **programa de adopción Microsoft 365**, no como capacitación puntual. Debe incluir diagnóstico de madurez, comunicación interna, formación aplicada, acompañamiento y medición por ola. Las sesiones de training son un componente del recorrido, pero la propuesta debe vender adopción medible y continuidad.

El inicio del flujo permite cargar un **referente del cliente** opcional (por ejemplo, `Sergio · Operaciones`) y una **ubicación del cliente** opcional. La ubicación parte de `Argentina` por defecto y puede afinarse con provincia/localidad (`San Rafael, Mendoza, Argentina`) para acotar la búsqueda pública usada por la IA.

La UI muestra una escalera comercial de progresión, manteniendo las claves técnicas internas existentes:

| Etapa | Referencia comercial |
| --- | --- |
| Etapa 0 | Productividad Digital (P1) |
| Etapa 1 | Envisioning IA (P0) |
| Etapa 2 | IA aplicada al trabajo (P2) |
| Etapa 3 | Productividad Digital + Microsoft 365 Copilot (P3) |

La propuesta incluye guardrails cuando el cliente intenta saltar escalones, por ejemplo pedir Cowork/agentes sin adopción Copilot o pedir Copilot con baja madurez Microsoft 365. La app no bloquea la oportunidad, pero muestra el prerrequisito y el siguiente paso recomendado.

En **P0 / Envisioning IA** los add-ons quedan intencionalmente acotados para no deformar el alcance exploratorio. Solo se pueden agregar **Casos para líderes**, **Readiness técnico** y **Webinar introductorio: Copilot en 30 minutos**. Si el cliente necesita más módulos, la recomendación comercial es cambiar a P1, P2 o P3.

En **P1 / Productividad Digital** los add-ons también quedan simplificados: solo **Readiness técnico**, **Excel intermedio**, **Excel avanzado** y **Módulo a medida de herramienta puntual**. El resto se considera incluido en el programa base, innecesario para este nivel, o señal de que conviene ampliar alcance/cambiar a P2 o P3.

En **P2 / IA aplicada al trabajo** los add-ons se limitan a profundizaciones de Copilot: **Cowork y Copilot**, **Agents & Cowork**, **Agentes a medida con Copilot Studio**, **Webinar especializado: agentes**, **Webinar especializado: agentes en SharePoint** y **Webinar especializado: notebooks y funcionalidades Copilot**. Casos por rol, Prompt Library, Copilot en Excel y Dashboard ya quedan incluidos en el plan base.

En **P3 / Productividad Digital + IA** el programa se considera integral. Todo el catálogo queda incluido o absorbido por el alcance base salvo **Cowork y Copilot** y **Agentes a medida con Copilot Studio**, que son los únicos add-ons cotizables aparte.

La app incluye una industria específica para **Energía, servicios eléctricos y construcción**, pensada para casos con obras, servicios técnicos, oficina técnica, compras, depósito y documentación operativa.

La pantalla de opcionales separa tres conceptos: **componentes incluidos en el plan base**, **opcionales cotizables** y **no aplica para este plan**. Lo incluido no es un add-on por defecto: no se selecciona, no se suma al precio y se muestra solo para aclarar el alcance base.

La modalidad **virtual** queda incluida en el precio base. Si se selecciona **presencial** o **mixta**, la app suma automáticamente un cargo de modalidad desde el mismo catálogo de add-ons (`delivery-onsite` o `delivery-hybrid`). Estos cargos no aparecen como módulos funcionales para seleccionar: se muestran en el resumen económico y pueden administrarse desde Dataverse como cualquier otro precio de referencia.

Los precios base de los planes también pueden administrarse desde la misma tabla usando estos IDs:

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

Cowork se trata como add-on con prerrequisito: solo puede activarse si el cliente tiene Microsoft 365 Copilot activo/trial y un caso concreto para profundizar, o como continuidad posterior a P2. No se ofrece como servicio suelto; se comunica como 3 a 5 sesiones de trabajo guiado. Para escenarios sin licencias o de exploración inicial, la app puede sugerir el **Webinar introductorio: Copilot en 30 minutos**, una entrada liviana de sensibilización con ejemplos generales, moderación y Q&A.

Además, se agregan **Webinars especializados** como add-ons puntuales por tecnología: agentes, agentes en SharePoint, notebooks y funcionalidades específicas de Copilot.

En escenarios de Productividad Digital o baja madurez, la app prioriza primero los add-ons core de ordenamiento/adopción (Teams + SharePoint, documentación, office hours, readiness y champions) y deja webinars como complemento puntual.

El botón global "Ayuda · lógica de decisión" abre una explicación transparente del árbol/scoring, los planes, la confianza, las alternativas y el tratamiento de add-ons.

## Validación IA del diagnóstico

La app publica una API `POST /api/proposal-validation` que reutiliza el Flow de IA para auditar la consistencia comercial antes de generar la propuesta. La validación no cambia respuestas automáticamente: el comercial puede editar respuestas, aplicar add-ons sugeridos o ignorar la validación y generar la propuesta con el árbol actual.

La validación recibe plan recomendado, confianza, alternativas, respuestas, add-ons sugeridos/incluidos/no disponibles y notas comerciales libres. Devuelve estado de consistencia, preguntas faltantes, riesgos, revisión de add-ons y recomendación final para el comercial.

## Resumen ejecutivo con IA

La app publica una API `POST /api/ai-summary` para pedir a Power Automate un resumen ejecutivo comercial generado con IA. Antes de invocar el Flow, la API intenta detectar el sitio oficial probable de la empresa, leer paginas publicas relevantes y enriquecer el payload con actividad, productos/servicios y canales publicos. Si no encuentra datos confiables, informa esa situacion en el payload para que la IA no invente informacion externa.

La búsqueda pública prioriza Argentina por defecto: intenta dominios `.com.ar`/`.ar`, suma términos geográficos del campo `clientLocation` y los pasa al Flow como `companyResearch.searchScope`. Esto ayuda a evitar confundir clientes argentinos con empresas homónimas de otros países.

Configurar en Azure Static Web Apps una variable de aplicación llamada `POWER_AUTOMATE_AI_SUMMARY_URL` con la URL del trigger HTTP del Flow de IA. El Flow debe devolver JSON con la forma `{ "summary": "..." }`. Para que el frontend lo muestre mejor, conviene que el resumen venga en Markdown con secciones `## Contexto de la empresa`, `## Lectura comercial`, `## Recomendacion Possumus`, `## Estimacion asistida de presupuesto` y `## Argumentos para la reunion`.

La estimación asistida puede activarse o desactivarse desde el bloque "Resumen con IA". Usa el rango base del plan, confianza del algoritmo, alcance, modalidad, madurez, licencias y add-ons. Si la confianza es baja, la IA no debe cerrar rango y debe pedir validación con preventa/adopción.

## Roadmap personalizado con IA

La app publica una API `POST /api/ai-roadmap` para generar una hoja de ruta personalizada a partir del plan recomendado, diagnóstico, industria, área, madurez, licencias, add-ons, modalidad y fecha de inicio. El resultado reemplaza la hoja de ruta base en la propuesta, el PDF y la propuesta enviada.

Configurar en Azure Static Web Apps una variable de aplicación llamada `POWER_AUTOMATE_AI_ROADMAP_URL` con la URL del trigger HTTP del Flow. Si no está configurada, la API reutiliza `POWER_AUTOMATE_AI_SUMMARY_URL`. Si no hay Flow disponible, el frontend genera una versión personalizada local para no bloquear la propuesta.

El Flow debe devolver JSON con la forma `{ "summary": "...", "items": [...] }`. Cada item debería incluir `tag`, `title`, `date`, `desc`, `tasks`, `owner`, `deliverable`, `risk` e `icon`.

## Comparador de planes con IA

La app publica una API `POST /api/plan-comparison` para comparar el plan recomendado contra una alternativa cercana. El botón aparece en la sección "También podría aplicar" cuando el scoring detecta alternativas. La comparación se guarda en la propuesta, el PDF y la propuesta enviada.

Configurar en Azure Static Web Apps una variable de aplicación llamada `POWER_AUTOMATE_PLAN_COMPARISON_URL` con la URL del trigger HTTP del Flow. Si no está configurada, la API reutiliza `POWER_AUTOMATE_AI_SUMMARY_URL`. Si el Flow no devuelve una comparación utilizable, el frontend genera una comparación local para no bloquear al comercial.

El Flow debe devolver Markdown con diferencias de alcance, precio, valor para el cliente, riesgos de elegir el plan menor/mayor, condiciones para cambiar y recomendación final para el comercial.
