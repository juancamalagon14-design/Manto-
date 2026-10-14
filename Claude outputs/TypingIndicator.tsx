import React from 'react';

/**
 * TypingIndicator Component
 *
 * Shows three bouncing dots to indicate the assistant is "typing".
 * Provides visual feedback during processing delays.
 *
 * @example
 * {isLoading && <TypingIndicator />}
 */
export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-center gap-1 py-2">
      <div className="w-3 h-3 rounded-full bg-gray-400 animate-typing-dot" />
      <div className="w-3 h-3 rounded-full bg-gray-400 animate-typing-dot" style={{ animationDelay: '0.2s' }} />
      <div className="w-3 h-3 rounded-full bg-gray-400 animate-typing-dot" style={{ animationDelay: '0.4s' }} />
    </div>
  );
};

TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator;
