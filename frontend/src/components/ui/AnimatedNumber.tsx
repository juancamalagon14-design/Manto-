'use client';

import React, { useEffect, useRef, useState } from 'react';
import { formatCop } from '@/lib/utils';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 350,
  className = '',
}) => {
  const numValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState(numValue);
  const currentRenderedRef = useRef(numValue);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = currentRenderedRef.current;
    const targetValue = numValue;

    if (startValue === targetValue) {
      setDisplayValue(targetValue);
      return;
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const startTime = performance.now();

    const updateValue = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing out cubic: 1 - (1 - t)^3
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (targetValue - startValue) * easeOut);

      currentRenderedRef.current = current;
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(updateValue);
      } else {
        currentRenderedRef.current = targetValue;
        setDisplayValue(targetValue);
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateValue);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [numValue, duration]);

  return <span className={className}>{formatCop(displayValue)}</span>;
};

export default AnimatedNumber;
