# MUST RULES — MANTO 2.0

## MANDATO SUPREMO: DESPLIEGUE OBLIGATORIO DE SUBAGENTES
**SIEMPRE DEBEN DESPLEGARSE LOS SUBAGENTES QUE SEAN REQUERIDOS PARA CUALQUIER MODIFICACIÓN.**

No se permite realizar cambios directos o monolíticos a código fuente, esquemas de bases de datos, APIs, frontend o reglas de negocio sin convocar y delegar en el subagente titular de cada dominio.

---

## 1. Reglas Inquebrantables de Dominio (No Negociables)

1. **Determinismo Actuarial (Superintendencia Financiera de Colombia):**
   - La IA **NUNCA** calcula primas, no decide elegibilidad ni aprueba reembolsos/siniestros.
   - Todo cálculo de precio es determinista, reproducible y ejecutado en el servidor por `manto-pricing`.
   - La IA actúa exclusivamente como asistente de captura y normalización (OCR, visión biológica).

2. **Cumplimiento Legal Inevadible — Ley 1801 de 2016:**
   - Para las 15 razas de manejo especial, el amparo de Responsabilidad Civil Extracontractual (RCE) por **50 SMLMV** ($87.545.250 COP en 2026) es **inevadible por diseño**.
   - Está forzado por el motor actuarial y validado a nivel de base de datos PostgreSQL mediante triggers en `insurance.quotes` e `insurance.policies`.

3. **Manejo Estricto de Moneda (COP):**
   - Prohibido el uso de flotantes (`number`) para dinero.
   - Se utiliza exclusivamente el tipo nominal `ColombianPeso` (`bigint`/enteros).
   - En persistencia JSONB, las cantidades viajan siempre como cadenas de dígitos (con sufijo `Cop`) para evitar pérdida de precisión sobre $2^{53}$.

4. **Habeas Data — Ley 1581 de 2012:**
   - Datos personales y llaves financieras (Bre-B) en columnas dedicadas de la base de datos, **NUNCA** dentro de estructuras JSONB congeladas.
   - Todo módulo debe soportar el derecho de supresión (`suprimirDatosPersonales`) manteniendo la integridad de las pólizas y registros históricos exigidos por ley.
   - Las fotos de mascotas se procesan únicamente para inferencia de raza/edad biológica y nunca para perfilamiento de personas.

5. **Principio Backend-First & Cero Placeholders:**
   - Nunca construir pantallas o interfaces UI sin que la base de datos, DTOs y endpoints de API estén implementados y probados.
   - Prohibido entregar código con `// TODO`, métodos simulados o placeholders. Todo código debe ser funcional y estar probado.

6. **Auditoría de Cierre con `manto-qa-security`:**
   - **TODO** cambio que modifique archivos debe someterse y cerrarse con la revisión del subagente `manto-qa-security`.
   - Si `manto-qa-security` encuentra vulnerabilidades, regresiones o inconsistencias, el cambio queda bloqueado hasta que el agente autor lo subsane.
   - Única excepción: tareas de solo lectura y análisis sin modificación de archivos.

7. **El Código Manda sobre la Documentación:**
   - En caso de divergencia entre la documentación y el código en producción, el código es la fuente de verdad.
   - Las discrepancias deben señalarse explícitamente y resolverse mediante ADR formal.

8. **Vocabulario y UX Copy Colombiano:**
   - Usar estrictamente los términos de marca:
     - *Tu aporte por evento* (nunca "deducible").
     - *Reembolso veterinario* (nunca "siniestro").
     - *Cuota mensual* (nunca "prima").
     - *Días para activación de cobertura* (nunca "carencia").
   - Nuquí 🐾 cotiza y acompaña la emisión. Sué ⚡ gestiona reembolsos y pagos.
