import React from 'react';
import { PawPrint, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp?: string;
  avatar?: React.ReactNode;
  animate?: boolean;
}

/**
 * Turno de la conversación con Nuquí.
 *
 * Dos decisiones vienen de la guía de marca, no del gusto:
 *
 *   · El naranja (#CF5224) es el acento de los CTAs y de una palabra del
 *     titular. En ningún otro lugar. Las burbujas del cliente iban rellenas de
 *     naranja, así que en una conversación de trece turnos el color de la
 *     acción aparecía doce veces antes del botón. Ahora van en Ink.
 *   · El avatar era un emoji de huella. El brief pide iconografía profesional
 *     y cero emojis, así que es un icono trazado.
 */
export const ChatBubble: React.FC<ChatBubbleProps> = ({
  role,
  content,
  image,
  timestamp,
  avatar,
  animate = true,
}) => {
  const isUser = role === 'user';
  const esSoloFoto = Boolean(image && (!content || content.toLowerCase() === 'foto enviada'));

  return (
    <div
      className={cn(
        'flex w-full gap-2.5 py-1.5',
        isUser ? 'justify-end' : 'justify-start',
        animate && 'animate-slide-up',
      )}
    >
      {/* Nuquí */}
      {!isUser && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-line bg-canvas-pure text-navy-500">
          {avatar || <PawPrint className="h-4 w-4" aria-hidden="true" />}
        </div>
      )}

      <div
        className={cn(
          'max-w-[85%] rounded-2xl transition-all duration-200 sm:max-w-md',
          esSoloFoto
            ? 'p-1.5 bg-slate-900 border border-slate-800 shadow-md'
            : isUser
              ? 'rounded-tr-xs bg-navy-900 text-white shadow-xs px-4 py-3'
              : 'rounded-tl-xs border border-line bg-canvas-pure text-navy-900 shadow-xs px-4 py-3',
        )}
      >
        {image && (
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt="Previsualización de foto capturada"
              className="max-h-64 w-full object-cover transition-transform duration-200 hover:scale-[1.02]"
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-slate-950/80 px-2.5 py-1 text-[10px] font-semibold text-white/95 backdrop-blur-md shadow-sm border border-white/10">
              <Camera className="h-3 w-3 text-orange-400" />
              <span>Foto capturada</span>
            </div>
          </div>
        )}

        {content && content.toLowerCase() !== 'foto enviada' && (
          <p className={cn('whitespace-pre-wrap break-words text-sm font-normal leading-relaxed', image && 'mt-2 px-1')}>
            {content}
          </p>
        )}

        {timestamp && (
          <span
            className={cn(
              'mt-1.5 block text-[10px] font-medium',
              isUser ? 'text-right text-white/70' : 'text-navy-500',
            )}
          >
            {timestamp}
          </span>
        )}
      </div>

      {/* Avatar del cliente: solo si se le pasa uno explícitamente. */}
      {isUser && avatar && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-line bg-canvas-soft text-sm font-semibold text-navy-900">
          {avatar}
        </div>
      )}
    </div>
  );
};

ChatBubble.displayName = 'ChatBubble';

export default ChatBubble;
