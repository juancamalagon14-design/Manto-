'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface DropdownOption<T = unknown> {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  data?: T;
}

export interface FilterableDropdownProps<T = unknown> {
  options: DropdownOption<T>[];
  value?: string | null;
  onSelect: (option: DropdownOption<T>) => void;
  placeholder?: string;
  autoFocus?: boolean;
  debounceMs?: number;
  emptyMessage?: React.ReactNode;
  headerTitle?: string;
  onDirectConfirm?: (text: string) => void;
  customFilter?: (query: string, option: DropdownOption<T>) => boolean;
  className?: string;
}

/**
 * Normaliza una cadena de texto quitando diacríticos/acentos.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Coincidencia difusa flexible:
 * - Match exacto o substring normalizado.
 * - Match por palabras.
 * - Distancia de Levenshtein <= 1 para palabras de más de 4 letras (ej. 'curso' -> 'corso' para Cane Corso).
 */
function fuzzyMatch(query: string, target: string): boolean {
  const q = normalizeText(query);
  const t = normalizeText(target);

  if (!q) return true;
  if (t.includes(q)) return true;

  const qWords = q.split(/\s+/).filter(Boolean);
  const tWords = t.split(/\s+/).filter(Boolean);

  return qWords.every((qw) => {
    return tWords.some((tw) => {
      if (tw.includes(qw)) return true;
      if (qw.length >= 4 && tw.length >= 4) {
        // Distancia Levenshtein básica <= 1
        if (Math.abs(qw.length - tw.length) <= 1) {
          let diff = 0;
          let i = 0;
          let j = 0;
          while (i < qw.length && j < tw.length) {
            if (qw[i] !== tw[j]) {
              diff++;
              if (diff > 1) break;
              if (qw.length > tw.length) i++;
              else if (tw.length > qw.length) j++;
              else {
                i++;
                j++;
              }
            } else {
              i++;
              j++;
            }
          }
          if (diff <= 1) return true;
        }
      }
      return false;
    });
  });
}

export function FilterableDropdown<T = unknown>({
  options,
  value,
  onSelect,
  placeholder = 'Selecciona o escribe...',
  autoFocus = true,
  debounceMs = 120,
  emptyMessage,
  headerTitle,
  onDirectConfirm,
  customFilter,
  className = '',
}: FilterableDropdownProps<T>) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Debounce del input de búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  // Filtrado de opciones en tiempo real
  const filteredOptions = useMemo(() => {
    if (!debouncedQuery.trim()) return options;
    return options.filter((opt) => {
      if (customFilter) {
        return customFilter(debouncedQuery, opt);
      }
      return (
        fuzzyMatch(debouncedQuery, opt.label) ||
        (opt.sublabel && fuzzyMatch(debouncedQuery, opt.sublabel))
      );
    });
  }, [options, debouncedQuery, customFilter]);

  // Reset del highlight cuando cambian las opciones
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  // Scroll automático del ítem enfocado dentro de la lista
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-dropdown-item]');
    const activeItem = items[highlightedIndex] as HTMLElement | undefined;
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleSelect = useCallback(
    (option: DropdownOption<T>) => {
      onSelect(option);
      setQuery('');
      setDebouncedQuery('');
    },
    [onSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) =>
          prev <= 0 ? filteredOptions.length - 1 : prev - 1,
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (onDirectConfirm && query.trim()) {
        onDirectConfirm(query.trim());
      }
    } else if (e.key === 'Escape') {
      setQuery('');
      setDebouncedQuery('');
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Campo de búsqueda interactivo */}
      <div className="relative">
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-autocomplete="list"
          role="combobox"
          aria-expanded="true"
          className="w-full rounded-xl border border-line bg-canvas-pure pl-10 pr-10 py-3 text-sm font-medium text-navy-900 outline-none transition-colors focus:border-orange-cta focus:ring-1 focus:ring-orange-cta placeholder:text-navy-400 shadow-xs"
        />
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-navy-400 pointer-events-none" />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setDebouncedQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-3 p-1 rounded-md text-navy-400 hover:text-navy-900 transition-colors"
            title="Borrar texto"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Contenedor navegable con teclado */}
      <div className="rounded-2xl border border-line bg-canvas-pure shadow-sm overflow-hidden">
        {headerTitle && (
          <div className="px-3.5 py-2.5 bg-canvas-soft border-b border-line flex items-center justify-between text-xs text-navy-500 font-semibold">
            <span>{headerTitle}</span>
            <span>{filteredOptions.length} resultados</span>
          </div>
        )}

        <div
          ref={listRef}
          role="listbox"
          className="max-h-60 overflow-y-auto divide-y divide-line-soft focus:outline-none"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const isSelected = value === opt.id;

              return (
                <button
                  key={opt.id}
                  type="button"
                  data-dropdown-item
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelect(opt)}
                  className={`flex w-full items-center justify-between p-3.5 text-left transition-all ${
                    isHighlighted
                      ? 'bg-orange-subtle/40 text-navy-950 font-semibold'
                      : 'hover:bg-canvas text-navy-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm font-semibold truncate text-navy-900">
                      {opt.label}
                    </span>
                    {opt.badge && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-navy-600 shrink-0">
                        {opt.badge}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {opt.sublabel && (
                      <span className="text-xs text-navy-400 font-normal">
                        {opt.sublabel}
                      </span>
                    )}
                    {isSelected ? (
                      <Check className="h-4 w-4 text-orange-brand" />
                    ) : (
                      <span className="text-xs text-navy-400 opacity-60">→</span>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-5 text-center space-y-2">
              {emptyMessage ? (
                emptyMessage
              ) : (
                <>
                  <p className="text-sm text-navy-600">
                    No encontramos resultados para "{query}".
                  </p>
                  <p className="text-xs text-navy-400">
                    Intenta con otra palabra clave o presiona Enter para confirmar tu búsqueda.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FilterableDropdown;
