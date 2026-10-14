# 🎨 MANTO SANCTUARY - DESIGN SYSTEM GUIDE

## Introducción

Este es el **Design System completo** para Manto 2.0. Incluye:
- ✅ Configuración Tailwind customizada
- ✅ Estilos globales y variables CSS
- ✅ Componentes reutilizables (Button, Card, Input, ChatBubble, etc.)
- ✅ Animaciones y transiciones
- ✅ Sistema de colores cálido y accesible

---

## 📁 Estructura de Archivos

Copia estos archivos a tu proyecto `manto-frontend/`:

```
manto-frontend/
├── tailwind.config.ts              ← Reemplazar configuración
├── src/
│   ├── styles/
│   │   └── globals.css             ← Crear archivo de estilos globales
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx          ← Crear componente
│   │   │   ├── Card.tsx            ← Crear componente
│   │   │   ├── Input.tsx           ← Crear componente
│   │   │   ├── ChatBubble.tsx      ← Crear componente
│   │   │   ├── ProgressBar.tsx     ← Crear componente
│   │   │   ├── TypingIndicator.tsx ← Crear componente
│   │   │   └── index.ts            ← Crear barrel export
│   │   └── ... (otros componentes)
│   └── app.tsx
└── package.json
```

---

## 🎯 PASO A PASO

### Paso 1: Actualizar tailwind.config.ts

Reemplaza completamente `manto-frontend/tailwind.config.ts` con el archivo proporcionado.

**Qué incluye:**
- Paleta de colores Manto (naranja #FF6B35, amarillo #FFD662)
- Escala tipográfica (12px - 48px)
- Sistema de espaciado (4px base unit)
- Animaciones personalizadas
- Sombras y radios customizados

### Paso 2: Agregar estilos globales

Crea el archivo `src/styles/globals.css` con el contenido proporcionado.

**Qué hace:**
- Define variables CSS root
- Reinicia estilos base
- Establece tipografía predeterminada
- Añade animaciones keyframes
- Proporciona clases utilidad

### Paso 3: Importar estilos en layout principal

En `src/app.tsx` o `src/pages/_app.tsx`:

```tsx
import '@/styles/globals.css';

export default function App() {
  return (
    // ...
  );
}
```

### Paso 4: Crear carpeta de componentes UI

```bash
mkdir -p src/components/ui
```

Copia cada componente (Button.tsx, Card.tsx, etc.) a esta carpeta.

### Paso 5: Crear archivo de índice

Crea `src/components/ui/index.ts`:

```typescript
export { Button } from './Button';
export { Card } from './Card';
export { Input } from './Input';
export { ChatBubble } from './ChatBubble';
export { ProgressBar } from './ProgressBar';
export { TypingIndicator } from './TypingIndicator';

export type { ButtonProps } from './Button';
export type { CardProps } from './Card';
export type { InputProps } from './Input';
```

### Paso 6: Instalar dependencias necesarias

```bash
npm install clsx
```

---

## 🎨 COLORES: REFERENCIA RÁPIDA

### Paleta Principal

```
Primary:    #FF6B35 (Naranja cálido - Manto)
Secondary:  #F7931E (Naranja más claro)
Accent:     #FFD662 (Amarillo cálido - CTA)
Dark:       #1F2937 (Texto oscuro)
Light:      #FAFAFA (Fondo claro)
```

### Uso en Tailwind

```tsx
// Colores
<div className="text-manto-primary">Naranja</div>
<div className="bg-manto-accent">Amarillo</div>

// Gradientes
<div className="bg-gradient-manto">Gradiente</div>

// Sombras
<div className="shadow-cta">Sombra CTA</div>
<div className="shadow-chat-user">Sombra chat usuario</div>
<div className="shadow-chat-bot">Sombra chat bot</div>
```

---

## 🧩 COMPONENTES: GUÍA DE USO

### Button

```tsx
import { Button } from '@/components/ui';

// Variantes
<Button variant="primary">Primario</Button>
<Button variant="secondary">Secundario</Button>
<Button variant="outline">Contorno</Button>
<Button variant="ghost">Fantasma</Button>
<Button variant="danger">Peligro</Button>

// Tamaños
<Button size="sm">Pequeño</Button>
<Button size="md">Mediano</Button>
<Button size="lg">Grande</Button>
<Button size="xl">Extra grande</Button>

// Estados
<Button loading>Procesando...</Button>
<Button disabled>Deshabilitado</Button>
<Button fullWidth>Ancho completo</Button>

// Con icono
<Button icon="🐾">Con icono</Button>
```

### Card

```tsx
import { Card } from '@/components/ui';

// Variantes
<Card variant="default">Predeterminado</Card>
<Card variant="elevated">Elevado</Card>
<Card variant="outlined">Contorno</Card>
<Card variant="gradient">Gradiente</Card>

// Espaciado
<Card padding="sm">Pequeño</Card>
<Card padding="md">Mediano</Card>
<Card padding="lg">Grande</Card>
```

### Input

```tsx
import { Input } from '@/components/ui';

// Básico
<Input placeholder="Escribe aquí..." />

// Con etiqueta
<Input label="Nombre de tu mascota" />

// Con error
<Input error="El nombre es requerido" />

// Con ayuda
<Input helperText="Mínimo 2 caracteres" />

// Con icono
<Input icon="🐾" placeholder="Nombre" />
```

### ChatBubble

```tsx
import { ChatBubble } from '@/components/ui';

// Mensaje del bot
<ChatBubble 
  role="assistant" 
  content="¿Cuál es el nombre de tu mascota?"
  avatar="🐾"
/>

// Mensaje del usuario
<ChatBubble 
  role="user" 
  content="Firulais"
  timestamp="10:30 AM"
/>
```

### ProgressBar

```tsx
import { ProgressBar } from '@/components/ui';

// Mostrar progreso
<ProgressBar current={2} total={5} />  // "Paso 2/5"
<ProgressBar current={2} total={5} variant="compact" />
```

### TypingIndicator

```tsx
import { TypingIndicator } from '@/components/ui';

// Mostrar que el bot está escribiendo
{isLoading && <TypingIndicator />}
```

---

## ✨ ANIMACIONES

### Clases disponibles

```tsx
// Entrada
<div className="animate-chat-slide-in">Slide In</div>
<div className="animate-fade-in">Fade In</div>
<div className="animate-slide-up">Slide Up</div>
<div className="animate-bounce-in">Bounce In</div>

// Loading
<div className="animate-pulse-glow">Pulse Glow</div>
<div className="animate-typing-dot">Typing Dot</div>
<div className="animate-float">Float</div>
```

### Transiciones rápidas

```tsx
// Fast (150ms)
<div className="transition-all duration-300">Rápido</div>

// Base (300ms)
<div className="transition-all duration-300">Normal</div>

// Slow (500ms)
<div className="transition-all duration-500">Lento</div>
```

---

## 🎯 EJEMPLOS DE USO COMPLETOS

### Pantalla de inicio (Path Selector)

```tsx
import { Button, Card } from '@/components/ui';

export function PathSelector() {
  return (
    <div className="min-h-screen bg-neutral-bg-light flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-manto-primary">
            🐾 Manto
          </h1>
          <p className="text-xl text-gray-600">
            ¿Cómo prefieres cotizar con tu mascota?
          </p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-4">
          {/* Photo Option */}
          <Card 
            variant="elevated" 
            padding="lg"
            className="cursor-pointer hover:shadow-card-hover"
            onClick={() => setPath('image')}
          >
            <div className="text-center space-y-3">
              <div className="text-5xl">📷</div>
              <h3 className="font-bold">Foto de tu mascota</h3>
              <p className="text-sm text-gray-600">
                Sube una foto y dejamos que la IA lo haga
              </p>
            </div>
          </Card>

          {/* Chat Option */}
          <Card 
            variant="elevated" 
            padding="lg"
            className="cursor-pointer hover:shadow-card-hover"
            onClick={() => setPath('chat')}
          >
            <div className="text-center space-y-3">
              <div className="text-5xl">💬</div>
              <h3 className="font-bold">Chat guiado</h3>
              <p className="text-sm text-gray-600">
                Responde preguntas y cotiza
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

### Chat Flow

```tsx
import { 
  ChatBubble, 
  Input, 
  ProgressBar, 
  Button,
  TypingIndicator 
} from '@/components/ui';

export function ChatFlow({ step, total }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-neutral-bg-light">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b px-4 py-3">
        <h2 className="text-lg font-bold text-manto-primary">🐾 Cotización</h2>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, idx) => (
          <ChatBubble key={idx} {...msg} />
        ))}
        {loading && <TypingIndicator />}
      </div>

      {/* Progress */}
      <div className="px-4 py-2">
        <ProgressBar current={step} total={total} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-white border-t p-4">
        <div className="flex gap-2">
          <Input 
            placeholder="Escribe aquí..." 
            className="flex-1"
          />
          <Button size="md" icon="🚀">Enviar</Button>
        </div>
      </div>
    </div>
  );
}
```

### Quote Card

```tsx
import { Card, Button } from '@/components/ui';

export function QuoteCard({ quote }) {
  return (
    <Card variant="elevated" padding="lg" className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">✅ ¡Listo!</h2>
        <p className="text-gray-600 mt-2">
          🐾 {quote.petName} ({quote.breed}, {quote.age} años)
        </p>
      </div>

      {/* Price Box */}
      <Card 
        variant="gradient" 
        padding="lg"
        className="text-center space-y-2"
      >
        <p className="text-white/80">Precio Mensual</p>
        <p className="text-4xl font-bold text-white">
          ${quote.monthly.toLocaleString('es-CO')}
        </p>
        <p className="text-xs text-white/70">
          ${quote.annual.toLocaleString('es-CO')} COP/año
        </p>
      </Card>

      {/* CTA */}
      <Button variant="primary" size="lg" fullWidth>
        🛡️ Contratar Ahora
      </Button>
    </Card>
  );
}
```

---

## 📊 ACCESIBILIDAD

Todos los componentes incluyen:
- ✅ Atributos ARIA apropiados
- ✅ Contraste de colores WCAG AA
- ✅ Focus visible rings
- ✅ Soporte para `prefers-reduced-motion`
- ✅ Navegación por teclado

```css
/* Focus visible automático */
*:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1), 
              0 0 0 1px rgba(255, 107, 53, 0.5);
}
```

---

## 🚀 PRÓXIMOS PASOS

1. ✅ Copia los archivos a tu proyecto
2. ✅ Actualiza tailwind.config.ts
3. ✅ Agrega src/styles/globals.css
4. ✅ Crea los componentes en src/components/ui/
5. ✅ Importa y usa en tus páginas
6. ✅ Customiza colores si lo necesitas

---

## 📝 REFERENCIAS

- [Tailwind CSS Docs](https://tailwindcss.com)
- [React Component Patterns](https://react.dev)
- [WCAG Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Design System v1.0 - Manto Sanctuary**  
*Cálido, accesible, moderno. NO genérico.*
