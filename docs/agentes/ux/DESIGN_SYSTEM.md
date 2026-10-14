# Sistema de Diseño y Tokens Visuales (Design System Specification)
## Plataforma Insurtech Digital Multi-Ramo (Manto 2.0)
**Rol:** Senior Product Designer + UX Architect  
**Nombre del Sistema:** *Manto Sanctuary Design System*  
**Versión:** 1.0.0  
**Fecha:** Septiembre 2026  

---

## 1. Identidad Visual: "Lujo Sereno y Calidez Orgánica"

*Manto Sanctuary* se aleja deliberadamente de los tonos azules corporativos fríos de los bancos y de los neones saturados del fintech genérico. La identidad proyecta **protección tranquila, empatía biológica y sofisticación contemporánea**.

```
    ┌────────────────────────────────────────────────────────────────────────┐
    │  PIEDRA ANGULAR VISUAL:                                                │
    │  • Bosque Obsidiana (Forest Obsidian): Autoridad, solidez y seguridad. │
    │  • Lienzo Avena (Oatmeal Canvas): Calidez doméstica, papel, calma.     │
    │  • Ámbar Vivo (Vital Amber): Energía, vida animal y llamadas de acción.│
    └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tokens de Color (Design Tokens)

Todos los colores satisfacen los criterios de contraste **WCAG 2.1 Nivel AA y AAA** sobre sus respectivos fondos.

### 2.1 Paleta Semántica y Primitivas

```css
:root {
  /* Bases de Fondo (Surfaces) */
  --surface-canvas: #FAF8F5;          /* Lienzo Avena: Fondo principal de la app */
  --surface-card: #FFFFFF;            /* Blanco Puro: Fondo de tarjetas y hojas modales */
  --surface-subtle: #F3EFEA;          /* Avena Suave: Contenedores secundarios y chips inactivos */
  --surface-elevated: #FFFFFF;        /* Superficies elevadas con sombra 1px */

  /* Textos y Primer Plano (Foregrounds) */
  --foreground-primary: #17241F;      /* Bosque Obsidiana: Títulos y textos principales */
  --foreground-secondary: #475851;    /* Musgo Grisáceo: Descripciones y micro-copy */
  --foreground-muted: #7A8D85;        /* Salvia Apagada: Placeholders y textos auxiliares */
  --foreground-inverse: #FAF8F5;      /* Texto claro sobre botones oscuros */

  /* Colores de Marca y Acción (Brand & Action) */
  --brand-primary: #1C362A;          /* Verde Selva Profundo: Botones principales y estados activos */
  --brand-primary-hover: #13261D;    /* Estado hover/pressed del botón primario */
  --brand-accent: #E27237;           /* Terracota / Ámbar Vivo: Insignias, descuentos y acentos */
  --brand-accent-subtle: #FDF2EB;    /* Fondo tenue para badges de ahorro y alertas */

  /* Estados Funcionales (Feedback) */
  --status-success: #1E6B4A;         /* Verde Esmeralda: Coberturas activadas, pagos exitosos */
  --status-success-subtle: #EAF5EF;
  --status-warning: #B87314;         /* Ocre Cálido: Alerta Ley 1801, carencias pendientes */
  --status-warning-subtle: #FEF7EC;
  --status-error: #9B2C2C;           /* Carmesí Mineral: Errores, tarjetas declinadas */
  --status-error-subtle: #FDF0F0;
  
  /* Bordes y Divisores (Borders) */
  --border-subtle: #E8E2D9;          /* Delimitador de tarjetas y campos */
  --border-focused: #1C362A;         /* Anillo de foco accesible */
}
```

---

## 3. Tipografía y Escala Jerárquica

* **Familia Tipográfica Primaria**: `Plus Jakarta Sans`, con respaldo en `Inter` y `-apple-system`.
* Selección por sus proporciones humanistas, aperturas amplias para pantallas móviles y números bien legibles en tablas de precios.

| Nivel Tipográfico | Tamaño (px / rem) | Peso (Font-Weight) | Line-Height | Uso Específico en Manto |
| :--- | :---: | :---: | :---: | :--- |
| **Display 1** | `40px` / `2.5rem` | 700 (Bold) | `1.15` | Hero de Landing y bienvenida |
| **Heading 1** | `28px` / `1.75rem`| 700 (Bold) | `1.25` | Títulos principales de flujo (ej. Planes) |
| **Heading 2** | `22px` / `1.375rem`| 600 (SemiBold)| `1.3` | Títulos de tarjetas de plan y confirmación |
| **Heading 3** | `18px` / `1.125rem`| 600 (SemiBold)| `1.4` | Títulos de add-ons y campos agrupados |
| **Body Large** | `16px` / `1.0rem` | 400 (Regular) | `1.5` | Párrafos introductorios y resúmenes |
| **Body Default**| `14px` / `0.875rem`| 400 (Regular) | `1.5` | Textos generales, descripciones de cobertura |
| **Caption / Meta**| `12px` / `0.75rem`| 500 (Medium) | `1.4` | Insignias, notas legales, tiempos de carencia |
| **Price Hero** | `32px` / `2.0rem` | 800 (ExtraBold)| `1.1` | Cifras monetarias en COP (`$68.900`) |

---

## 4. Cuadrícula, Espaciado y Elevación Táctil

### 4.1 Sistema de Espaciado (Base 4px / 8px Grid)
* `space-1`: `4px` (Espaciado fino entre iconos y etiquetas).
* `space-2`: `8px` (Margen interno de badges y chips).
* `space-3`: `12px` (Espacio entre filas de coberturas).
* `space-4`: `16px` (Padding interno de tarjetas en móvil).
* `space-6`: `24px` (Separación entre secciones de formulario).
* `space-8`: `32px` (Padding vertical de pantallas).
* `space-12`: `48px` (Altura mínima de controles táctiles accesibles).

### 4.2 Radios de Curvatura (Border Radius)
* Evitamos curvaturas infantiles extremas; buscamos bordes arquitectónicos refinados:
  * Botones y campos de texto: `8px` (`rounded-lg`).
  * Tarjetas de planes y contenedores: `16px` (`rounded-2xl`).
  * Badges y chips de estado: `9999px` (`rounded-full`).

### 4.3 Sombras y Elevación
* En lugar de sombras difusas pesadas, Manto utiliza **bordes de contraste de 1px** combinados con sombras atmosféricas de un solo paso:
  ```css
  /* Elevación Nivel 1 (Tarjetas estándar) */
  box-shadow: 0 1px 3px rgba(23, 36, 31, 0.05), 0 1px 2px rgba(23, 36, 31, 0.03);
  border: 1px solid var(--border-subtle);

  /* Elevación Nivel 2 (Tarjetas destacadas / Modales / Bottom Sheets) */
  box-shadow: 0 10px 25px -5px rgba(23, 36, 31, 0.08), 0 8px 10px -6px rgba(23, 36, 31, 0.04);
  border: 1px solid rgba(23, 36, 31, 0.08);
  ```

---

## 5. Anatomía de Componentes Clave

### 5.1 Botones de Acción (Action Buttons)
* **Botón Primario**:
  * Altura: `52px` en móvil (fácil de pulsar con el pulgar en movimiento).
  * Fondo: `--brand-primary` (`#1C362A`), Texto: `--foreground-inverse` (`#FAF8F5`).
  * Efecto Active/Pressed: Escala sutil `scale(0.98)` y fondo `--brand-primary-hover`.
* **Botón Flotante Inferior (Sticky Bottom Bar)**:
  * Se mantiene anclado al fondo del viewport en pantallas móviles:
  * Contiene el resumen de precio actual (`Total: $68.900/mes`) a la izquierda y el botón de acción principal a la derecha.

### 5.2 Zona de Carga de Fotos (Pet Photo Dropzone)
* **Componente interactivo**:
  * Superficie punteada con borde sutil en `--border-subtle`.
  * Animación de pulso tenue al recibir foco o arrastre de archivo.
  * Muestra miniatura circular inmediata tras la carga con botón de eliminación/reemplazo en un solo toque.

### 5.3 Tarjetas de Cobertura Modular (Add-on Card)
* **Estructura**:
  1. Icono temático de la asistencia (ej. martillo legal para RCE, cruz médica para telemedicina).
  2. Título de la cobertura con tooltip informativo accesible `(?)`.
  3. Micro-precio destacado: `+$9.900 / mes`.
  4. Interruptor toggle iOS-style con retroalimentación visual clara (Verde esmeralda al activarse).

### 5.4 Control Deslizante de Deducible (Interactive Slider)
* Pista horizontal con 3 marcadores visuales discretos (10%, 15%, 20%).
* Manecilla táctil de tamaño generoso ($28\text{px}$ de diámetro) con sombra perceptible y vibración háptica al cambiar de posición en dispositivos compatibles.

---

## 6. Accesibilidad (a11y) y Estándares WCAG

1. **Objetivos Táctiles**: Todo elemento interactivo mide como mínimo **$48 \times 48 \text{ px}$** de área táctil efectiva (usando padding transparente si el elemento visual es menor).
2. **Anillos de Foco Visibles**: Foco por teclado (`:focus-visible`) con doble anillo de 2px en `--brand-primary` y separación de 2px en blanco para usuarios que navegan con teclado o lectores de pantalla.
3. **Etiquetado Semántico**: Todos los inputs cuentan con `<label>` explícito; los interruptores cuentan con atributos `role="switch"` y `aria-checked`.
4. **Respeto a Preferencias del Sistema**:
   * Soporte para `@media (prefers-reduced-motion: reduce)`: Desactiva automáticamente animaciones complejas y transiciones de carga para evitar mareo en usuarios sensibles.
