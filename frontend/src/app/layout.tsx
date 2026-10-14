import type { Metadata, Viewport } from 'next';
// Poppins en toda la interfaz.
// 400 cuerpo · 500 etiquetas y UI · 600 subtítulos y CTAs · 700 títulos
//
// Viene del paquete `@fontsource/poppins`, no de `next/font/google`, y la
// diferencia no es cosmética: `next/font/google` descarga la tipografía EN
// TIEMPO DE COMPILACIÓN, así que el build entero falla con
// «Failed to fetch font Poppins» en cualquier entorno que no alcance
// fonts.googleapis.com — un contenedor con lista blanca de salida, un runner
// de CI, o la máquina de quien esté detrás de un proxy corporativo. Era la
// deuda abierta n.º 7 del CLAUDE.md. Servida desde node_modules, la fuente se
// empaqueta con el sitio y el build no depende de la red.
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import './globals.css';
import ChatWidget from '@/components/chat/ChatWidget';

export const metadata: Metadata = {
  title: 'Manto 2.0 | Seguros Digitales a la Medida',
  description:
    'El seguro que tu perro o gato merece. Sin planes enlatados: contratos a la medida, calculados por el motor actuarial y guiados por Nuquí y Sué.',
  keywords: [
    'seguro para perros',
    'seguro para gatos',
    'insurtech colombia',
    'manto seguros',
    'ley 1801 mascotas',
    'cotizador mascotas',
  ],
  authors: [{ name: 'Manto Insurtech Team' }],
  icons: {
    icon: '/brand/manto-logo-color.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#EDEFF2',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-canvas font-sans text-navy-900 antialiased selection:bg-orange-brand/20 selection:text-orange-cta">
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
