# Principios de Experiencia de Usuario y Diseño de Producto (UX Principles)
## Plataforma Insurtech Digital Multi-Ramo (Manto 2.0)
**Rol:** Senior Product Designer + UX Architect  
**Versión:** 1.0.0  
**Fecha:** Septiembre 2026  
**Mercado Objetivo:** Colombia  

---

## 1. Filosofía de Producto: Simplicidad Radical y Confianza

El seguro tradicional en América Latina es percibido como engorroso, hostil, lleno de "letra menuda" y diseñado para rechazar siniestros. La propuesta de experiencia de Manto se sitúa en el extremo opuesto: una plataforma digital-first, humana, transparente y extremadamente veloz que empodera al asegurado (Pet Parent) desde el primer segundo.

### Los 8 Pilares Fundamentales de UX

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ 1. < 60 SEGUNDOS│   │ 2. MOBILE-FIRST │   │ 3. IA ASISTIVA  │   │ 4. TRANSPARENCIA│
│  Cotización sin │   │ Diseñado para el│   │  Sugerencias,   │   │  Sin jerga ni   │
│   fricción      │   │  uso a una mano │   │ jamás dogmas    │   │  letra menuda   │
└─────────────────┘   └─────────────────┘   └─────────────────┘   └─────────────────┘
         ▲                     ▲                     ▲                     ▲
         │                     │                     │                     │
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ 5. VALOR ANTES  │   │ 6. IDENTIDAD    │   │ 7. MODULARIDAD  │   │ 8. EMPATÍA EN   │
│   DE DATOS      │   │    PREMIUM      │   │   DE ADD-ONS    │   │   SINIESTROS    │
│ Precio antes de │   │ Lujo sereno, no │   │ Coberturas que  │   │ Trámite en 3 min│
│  pedir cédula   │   │ plantilla SaaS  │   │ crecen con vida │   │ dinero en horas │
└─────────────────┘   └─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## 2. El Principio de Justificación de Preguntas (Ruthless Question Filtering)

> [!IMPORTANT]
> **REGLA DE ORO DE CAPTURA DE DATOS**:
> **Cada campo en un formulario debe justificar su existencia.**
> Si una pregunta puede ser:
> 1. **Inferida de forma segura** (ej. especie y raza probable mediante la foto de la mascota),
> 2. **Pospuesta para después del pago** (ej. número de microchip, dirección exacta de residencia),
> 3. **Obtenida de registros existentes** (ej. departamento a partir de la ciudad seleccionada),
> **QUEDA ELIMINADA del flujo inicial de cotización.**

### Auditoría de Campos en el Flujo de Entrada (MVP)

| Dato Requerido | ¿Se pide antes de cotizar? | Justificación de UX / Arquitectura |
| :--- | :---: | :--- |
| **Foto de la Mascota** | **SÍ** | Genera conexión emocional inmediata y reduce el tipeo al inferir especie, raza y edad estimada con IA. |
| **Confirmación de Especie / Raza** | **SÍ** | Factor actuarial crítico para evaluar elegibilidad y factor de riesgo biológico. |
| **Fecha de Nacimiento / Edad** | **SÍ** | Factor multiplicador de prima según rango de edad. |
| **Ciudad de Residencia** | **SÍ** | Factor actuarial geográfico (Bogotá vs. Medellín vs. otras ciudades). |
| **Estado Reproductivo (Esterilizado)** | **SÍ** | Incentivo de ahorro del 5% para el usuario (recompensa inmediata). |
| *Cédula de Ciudadanía* | **NO (Se pospone al checkout)** | Nadie quiere entregar su identificación fiscal antes de saber cuánto cuesta el producto. |
| *Teléfono y Dirección Exacta* | **NO (Se pospone al checkout)** | Evita la sensación de acoso comercial prematuro. |
| *Número de Microchip* | **NO (Post-compra / Siniestro)** | La mayoría de dueños no tienen el número a la mano al momento de navegar desde el móvil. |
| *Historial Clínico Completo* | **NO (Al radicar siniestro)** | Preguntar antecedentes extensos antes de comprar desploma la conversión por encima del 60%. |

---

## 3. Principio de la IA Asistiva y Humilde (AI Companion)

La Inteligencia Artificial nunca debe comportarse como una "caja negra arrogante" ni emitir juicios concluyentes e irrevocables:
1. **Lenguaje Sugestivo, Jamás Dogmático**:
   * ❌ *"Tu perro es un Bull Terrier de 3 años."*
   * ✅ *"Tiene toda la pinta de ser un Bull Terrier de unos 2 a 3 años. ¿Le atinamos?"*
2. **Control Total en Manos del Usuario**:
   * Cada inferencia de la IA va acompañada de un mecanismo de edición en un solo toque (dropdown predictivo de razas o selector de edad).
3. **Manejo Amable de Casos Límite**:
   * Si la imagen es borrosa o se sube una foto no válida (ej. una persona o un objeto), el sistema responde con calidez y sentido del humor: *"¡Ups! No pudimos distinguir a tu mascota en esta foto. Intenta con una donde se vea bien clarita su carita."*

---

## 4. Filosofía Visual: Lujo Sereno y Calidez Orgánica

El diseño de Manto debe diferenciarse radicalmente tanto del software corporativo aburrido como de los clichés del fintech genérico:

### Qué EVITAMOS rigurosamente:
* ❌ Plantillas genéricas de SaaS en modo oscuro saturado de neón púrpura.
* ❌ Gradientes cripto genéricos y bordes con efecto "glassmorphism" desmedido.
* ❌ Ilustraciones vectoriales de stock genéricas (estilo "Corporate Memphis" con personajes de extremidades desproporcionadas).
* ❌ Sobrecarga de tarjetas dentro de tarjetas con sombras densas y difusas.
* ❌ Micro-animaciones gratuitas que ralenticen la carga o distraigan en conexiones móviles 4G inestables.

### Qué ADOPTAMOS con intención:
* ✅ **Paleta Orgánica y Sofisticada**: Tonos profundos de bosque (*Forest Slate*), bases cálidas tipo papel/arena (*Oatmeal Canvas*) y acentos minerales en terracota o ámbar vivo.
* ✅ **Fotografía Auténtica**: Perros y gatos reales en situaciones cotidianas de afecto familiar, sin poses de estudio artificiales.
* ✅ **Tipografía Editorial y Funcional**: Combinación armónica entre una fuente sans-serif moderna de alta legibilidad en pantallas pequeñas (*Plus Jakarta Sans* o *Inter*) con jerarquías claras y descansadas.
* ✅ **Elevación Táctil Sutil**: Bordes definidos de 1px con contrastes refinados y sombras de un solo paso de elevación.

---

## 5. Mobile-First y Ergonomía del Pulgar (Thumb Zone)

Más del **75% de las conversiones en Colombia** ocurren desde dispositivos móviles (Android y iOS):
* **Zona de Alcance Natural del Pulgar**: Todos los botones de acción principal (CTA: *"Ver mi precio"*, *"Continuar"*, *"Elegir plan"*) se ubican anclados en la parte inferior de la pantalla (*Bottom Sticky Bar*).
* **Objetivos Táctiles Grandes**: Tamaño mínimo de clic de **$48 \times 48 \text{ px}$** con suficiente espaciado para evitar toques erróneos.
* **Selectores de Tarjeta en lugar de Dropdowns Ocultos**: Opciones de 2 a 3 elementos (ej. Perro / Gato, Macho / Hembra) presentadas como chips o tarjetas seleccionables en un toque sin desplegar menús del sistema operativo.
* **Teclados Especializados**:
  * Campo de edad $\to$ `inputmode="numeric"`.
  * Campo de correo $\to$ `inputmode="email" autocomplete="email"`.
  * Celular $\to$ `inputmode="tel"`.

---

## 6. Transparencia y Desmitificación del Lenguaje Asegurador

Manto habla como un amigo veterinario experto, no como un ajustador de seguros calculador:

| Término Tradicional de Seguros | Término Manto (Comprensible y Transparente) | Explicación en Interfaz (Micro-copy) |
| :--- | :--- | :--- |
| **Deducible** | **Tu aporte por evento** | *"Lo que tú pagas en la veterinaria; nosotros cubrimos todo el resto hasta el tope del plan."* |
| **Copago** | **Porcentaje compartido** | *"Por ejemplo, en un plan con 10% de copago, si la cuenta es de $100.000, Manto te reembolsa $90.000."* |
| **Periodo de Carencia** | **Activación de cobertura** | *"Los accidentes quedan protegidos en 48 horas. Las enfermedades comunes se activan tras 14 días para evitar fraudes."* |
| **Siniestro** | **Reembolso veterinario** | *"Sube tu factura y te devolvemos la plata directamente a tu cuenta bancaria o Nequi."* |
| **Exclusiones** | **Lo que no está cubierto** | Mostrado de forma directa y visible, sin esconderlo detrás de un enlace diminuto en gris claro. |
| **Carátula de Póliza** | **Certificado digital y Carnet** | Tarjeta visual interactiva guardable en Apple Wallet o Google Wallet. |
