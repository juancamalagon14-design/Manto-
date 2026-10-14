import React from 'react';
import clsx from 'clsx';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  avatar?: React.ReactNode;
  animate?: boolean;
}

/**
 * ChatBubble Component
 *
 * A message bubble for the chat interface.
 * User messages appear on the right, assistant on the left.
 * Includes animations and timestamps.
 *
 * @example
 * <ChatBubble role="assistant" content="¿Cuál es el nombre de tu mascota?" />
 * <ChatBubble role="user" content="Firulais" />
 */
export const ChatBubble: React.FC<ChatBubbleProps> = ({
  role,
  content,
  timestamp,
  avatar,
  animate = true,
}) => {
  const isUser = role === 'user';

  return (
    <div
      className={clsx(
        'flex w-full gap-3 py-2',
        isUser ? 'justify-end' : 'justify-start',
        animate && 'animate-chat-slide-in'
      )}
    >
      {/* Avatar (Bot only) */}
      {!isUser && avatar && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-manto-primary flex items-center justify-center text-white text-lg">
          {avatar}
        </div>
      )}

      {/* Bubble */}
      <div
        className={clsx(
          'max-w-xs px-4 py-3 rounded-2xl transition-all duration-300',
          isUser
            ? 'bg-gradient-to-br from-manto-primary to-manto-secondary text-white rounded-br-none shadow-chat-user'
            : 'bg-gray-100 text-gray-900 rounded-bl-none shadow-chat-bot'
        )}
      >
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
          {content}
        </p>

        {timestamp && (
          <span
            className={clsx(
              'text-xs mt-1 block',
              isUser ? 'text-white/70' : 'text-gray-500'
            )}
          >
            {timestamp}
          </span>
        )}
      </div>

      {/* Avatar (User only) */}
      {isUser && avatar && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-manto-accent flex items-center justify-center text-gray-900 text-lg">
          {avatar}
        </div>
      )}
    </div>
  );
};

ChatBubble.displayName = 'ChatBubble';

export default ChatBubble;
