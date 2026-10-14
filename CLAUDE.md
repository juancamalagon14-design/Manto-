# Manto 2.0 — instrucciones del proyecto

Plataforma insurtech de seguros de mascotas para Colombia. Backend NestJS 10 con DDD,
frontend Next.js 14 con Tailwind, PostgreSQL 16.

Idioma de trabajo y de toda la interfaz: **español colombiano**.

---

> **MANDATO SUPREMO (MUST):**  
> **SIEMPRE DEBEN DESPLEGARSE LOS SUBAGENTES QUE SEAN REQUERIDOS PARA CUALQUIER MODIFICACIÓN.**  
> Ningún cambio a código, esquemas de BD, tarifas, contratos o configuraciones puede realizarse de forma monolítica o directa sin convocar y desplegar los subagentes especializados correspondientes a cada dominio y cerrar obligatoriamente con la auditoría de `manto-qa-security`.

---

## Análisis previo obligatorio: Reglas de Orquestación

**Toda tarea que requiera desarrollo, arquitectura, tarificación, flujos o persistencia debe analizarse en primera instancia bajo las Reglas Maestras de Orquestación ([`docs/REGLAS_ORQUESTACION_AGENTES.md`](file:///e:/Manto%202.0/docs/REGLAS_ORQUESTACION_AGENTES.md)).**

Antes de tocar código:
1. **Identificar el dominio y agente titular:** Asignar la tarea al agente correspondiente (`manto-backend`, `manto-ux`, `manto-pricing`, `manto-ai`, `manto-claims`, `manto-orchestrator`).
2. **Consultar la Matriz de Autonomía:** Verificar si la acción requiere **aprobación humana explícita** (modificar tablas actuariales, SMLMV, esquemas de BD, supresión de datos) o si es autónoma.
3. **Verificar Doctrinas Inquebrantables:**
   - La IA nunca calcula primas, no decide elegibilidad ni aprueba reembolsos (motor determinista en servidor).
   - RCE Ley 1801 de 50 SMLMV obligatoria e inevadible para razas especiales.
   - Dinero en COP siempre tipado `ColombianPeso` (sin flotantes; cadenas de dígitos en `jsonb`).
   - Ley 1581 (Habeas Data): datos personales en columnas dedicadas, nunca enterrados en `jsonb`.
4. **Respetar la Cadena Estándar:** Análisis Previo → Desarrollo por Agente Titular → Auditoría Obligatoria (`manto-qa-security`) → Registro y Trazabilidad.

---

## Revisión de QA obligatoria

**Todo cambio que toque archivos se cierra con una revisión de `manto-qa-security`.**

Aplica a la sesión principal y a cualquier subagente. Antes de reportar el trabajo como
terminado, invoca `manto-qa-security` con el tool `Agent` y pásale: qué cambiaste archivo por
archivo, qué garantía podría haberse roto, cómo reproducirlo, y qué pruebas corriste.

Ese agente arranca en frío y no ve la conversación: el prompt tiene que bastarse solo.

Incorpora lo que devuelva antes de responder. Si descartas un hallazgo, di por qué. Si es real
y no lo arreglas en este turno, decláralo como deuda abierta.

**Excepción única:** trabajo de solo lectura —consultas, análisis, explicaciones, búsquedas—
que no modificó ningún archivo.

---

## Los agentes

Están en `.claude/agents/`, con copia de referencia en `docs/agentes/claude-code/`.
Si editas uno, actualiza las dos ubicaciones.

| Agente | Cuándo |
|---|---|
| `manto-orchestrator` | Arquitectura global, límites entre dominios, ADRs estratégicos, resolución de conflictos |
| `manto-software-architect` | Diseño de arquitecturas modulares (Clean/Hexagonal), esquemas DDL SQL, máquinas de estado finitas, contratos OpenAPI/DTOs y límites no funcionales (<400ms, idempotencia). No implementa código de negocio ni frontend |
| `manto-tech-lead` | Desglose técnico de requerimientos, orquestación de desarrolladores (backend/frontend/qa), code review estricto, principio Backend-First y control de placeholders |
| `manto-ux` | Flujos, pantallas, design system, micro-copia |
| `manto-ux-research` | Investigación competitiva, análisis de journeys (Lemonade, etc.), benchmark UX/UI y traducción a requerimientos para Manto |
| `manto-backend` | Módulos NestJS, DTOs, repositorios, integración frontend-API |
| `manto-pricing` | Factores actuariales, razas, amparos, deducibles, Ley 1801 |
| `manto-ai` | Gemini, visión, máquina de estados conversacional de Nuquí |
| `manto-claims` | FNOL, STP, CUFE DIAN, reembolsos, Bre-B y MercadoPago |
| `manto-qa-security` | Revisión, pruebas adversarias, OWASP API |
| `manto-frontmatter` | Crear o corregir definiciones de agentes |

Fronteras que se solapan:
- `manto-orchestrator` decide **el qué y dónde vive** (visión global de CTO, bounded contexts, ADRs estratégicos), mientras que `manto-software-architect` diseña **el cómo estructural y formal** (diagramas de componentes, esquemas DDL, máquinas de estado, especificaciones DTO y SLAs no funcionales).
- `manto-software-architect` diseña **la solución formal**, mientras que `manto-tech-lead` orquesta **la ejecución técnica** (desglose en tareas atómicas, delegación a backend/frontend/qa, code review y bloqueo de violaciones contractuales).
- `manto-pricing` decide **cuánto vale**, `manto-backend` decide **cómo se expone**.
- `manto-ux-research` investiga la competencia y extrae requerimientos, `manto-ux` diseña las pantallas, flujos y micro-copia propios de Manto.

---

## Reglas del dominio que no se negocian

**Una prima debe ser reproducible y auditable** ante la Superintendencia Financiera. Un solo
motor determinista, del lado servidor. Nada de segundos caminos de cálculo.

**La IA nunca es autoridad de suscripción.** Gemini redacta, interpreta y normaliza. No calcula
primas, no aprueba reembolsos, no decide elegibilidad. El precio llega ya resuelto del motor.

**Ley 1801 de 2016.** Las razas de manejo especial llevan RCE de 50 SMLMV forzada por el motor
de cálculo, no por validación de entrada. Es inevadible por diseño.

**Edad asegurable de nuevo ingreso: 2 a 144 meses.**

**Dinero en COP** con el tipo nominal `ColombianPeso` de `common/types/money.ts`. Nunca `number`
suelto ni aritmética flotante sobre pesos.

**Habeas Data, Ley 1581 de 2012.** Las fotos se procesan solo para clasificación biológica.

**El logotipo se usa tal cual** desde `public/brand/manto-logo-color.png`. Nunca redibujado,
reconstruido en SVG ni sustituido.

**El código manda sobre la documentación** donde diverjan. Señala la divergencia, no la
resuelvas en silencio.

---

## Nombres propios

**Nuquí 🐾** cotiza. **Sué ⚡** maneja reembolsos y pagos. Úsalos por su nombre.

Vocabulario con el cliente: *tu aporte por evento* (no "deducible"), *reembolso veterinario*
(no "siniestro"), *cuota mensual* (no "prima"), *días para activación de cobertura* (no
"carencia"). El diccionario completo está en `docs/agentes/ux/UX_COPY.md`.

---

## Deuda abierta

La intervención del 15 de septiembre de 2026 cerró los seis puntos que había aquí
(dos cotizadores, `PITBULL`, tres modelos de precio, `safeFetch` silencioso, `chatLog`
huérfano, catálogos duplicados). El detalle está en el proyecto de Claude, documento
`INTERVENCION_NUQUI_UNICO_COTIZADOR.md`, que también lista la deuda que quedó viva.

Lo que sigue abierto y no se debe construir encima sin mencionarlo:

1. **Prima de la RCE de Ley 1801 sin recalibrar.** El valor asegurado subió de
   $65.000.000 a $87.545.250 (50 SMLMV vigentes) y la prima sigue en $15.000/mes.
   La tasa sobre límite bajó de 0,25% a 0,19%.
2. **`SMLMV_COP` se actualiza cada enero.** Está en `pricing.constants.ts` y de ella
   depende el monto del amparo obligatorio. Quedarse corto es incumplir el mínimo legal.
3. **El descuento del 5% por múltiples mascotas no es ganable todavía:** falta el flujo
   de alta de la segunda mascota. Nuquí lo promete para ese momento y envía
   `petsInPolicy: 1` mientras la operación cubra una sola.
4. **`GENDER_FACTORS` al 3% sin siniestralidad propia.** Está marcado como provisional.
5. **Sin prima mínima técnica**, y los add-ons llevan prima plana sin factor de edad,
   raza ni tamaño.
6. **Derecho de supresión (Ley 1581, art. 8 lit. e): implementado en los
   repositorios, sin exponer todavía.** `suprimirDatosPersonales` existe en los
   tres repositorios de Postgres y está probado: una cotización sin póliza se
   borra entera, una póliza se anonimiza conservando prima y amparos (hay deber
   legal de conservar el expediente), y la llave Bre-B del siniestro se vacía.
   Falta **exponerlo**, y no se expone antes de que exista autenticación: un
   endpoint de supresión sin identificar a quien lo pide es peor que no tenerlo.
   Los datos personales van en columnas y no dentro de `jsonb` justamente para
   que esto sea posible.
7. **`next/font/google` se resuelve al compilar.** Si el entorno de construcción no
   alcanza `fonts.googleapis.com`, el build falla. Conviene vendorizar Poppins.
8. **Pasos 1 y 2 del chat** (cuenta y verificación por correo) esperan Entra External ID.
   **Google Places** para la dirección y el **límite anual elegible** siguen pendientes.

## Cómo no volver a romper el frontend

`frontend/postcss.config.mjs` es lo que conecta Tailwind al pipeline de Next. No existía,
y por eso ninguna clase de utilidad había funcionado nunca: el sitio se servía sin estilos.

Para comprobarlo: `npm run build` y revisar `.next/static/css/*.css`. Si ahí aparece el
texto `@tailwind`, Tailwind no corrió y el archivo pesará ~1 KB en vez de ~30 KB.

## Persistencia

PostgreSQL 16 sin ORM, con `pg` a pelo. `docker compose up -d` levanta la base de
desarrollo en el puerto **5433** del host (5433 y no 5432, para no chocar con un
Postgres ya instalado). Las migraciones de `backend/src/database/migrations` se aplican
solas al arrancar, cada una en su transacción, y quedan registradas en
`insurance.schema_migrations`.

Sin `DATABASE_URL` el backend arranca con repositorios **en memoria** y lo advierte
cuatro veces. Eso sirve para levantar el proyecto recién clonado, no es un modo de
operación: al reiniciar se pierden cotizaciones, pólizas y siniestros.

Tres decisiones que conviene no deshacer:

- **El dinero en `jsonb` va como cadena de dígitos**, no como número JSON.
  `JSON.parse` devuelve `number` y pierde precisión por encima de 2^53; la cadena es
  el único ida y vuelta exacto. `reviveMoney` la convierte de vuelta a `bigint` por
  el sufijo `Cop` de la clave. Y la conversión al escribir se hace **antes** de
  `JSON.stringify`: `money.ts` instala un `BigInt.prototype.toJSON` que devuelve
  `Number(this)`, y `stringify` lo llama antes que a cualquier `replacer` — un
  `typeof v === 'bigint'` dentro de un `replacer` es código muerto.
- **Los datos personales van en columnas, nunca dentro de `jsonb`.** Un dato
  enterrado en un documento congelado no se puede suprimir sin romper el documento.
  Por eso la llave Bre-B está en `bre_b_key_type` y `bre_b_key_value`.
- **El esquema es la constante `insurance`, no una variable de entorno.** Lo fue, y
  era una inyección de SQL además de una perilla que no servía para nada. Las tablas
  se nombran cualificadas (`insurance.quotes`) en vez de depender de `search_path`.

La RCE de la Ley 1801 la exige también la base, con un trigger, y no solo el motor
de cálculo: `CLAUDE.md` dice que es inevadible por diseño, y el esquema aceptaba sin
protestar una actualización de `coverages` que la quitara. El trigger comprueba lo
estructural —que el amparo esté, con tope positivo y sin copago—, nunca el monto:
50 SMLMV cambian cada enero y una cifra escrita en SQL quedaría desactualizada en
silencio, que es peor que no tenerla.

## Pruebas

`cd backend && npx jest`. Diez suites, 181 pruebas. Cada una corresponde a un defecto
real encontrado y corregido; si una se pone roja, algo que ya estaba mal volvió.

Con `DATABASE_URL` corren las tres suites de persistencia; sin ella se saltan solas.
El `globalSetup` de Jest aplica las migraciones antes de la primera suite: sin eso las
pruebas de persistencia solo pasaban si alguien había arrancado la aplicación antes
contra esa misma base, y contra una base recién creada —lo que hace un pipeline—
fallaban las veinte.

La configuración de Jest necesita `setupFiles: ["reflect-metadata"]`: sin eso los
decoradores de `class-validator` no cargan y las pruebas de DTO no corren.

**Trampa de shell, documentada porque costó horas:** `pkill -f "dist/main"` mata el
propio shell, porque el patrón aparece en su línea de comandos. El truco de los
corchetes no basta si el comando menciona `dist/main.js` en otra parte. Para bajar el
backend, mata por puerto: `fuser -k 3003/tcp`.
