'use client';

import React from 'react';
import { DeductibleOption } from '@/types/pricing';
import { ShieldCheck, Sparkles, TrendingDown } from 'lucide-react';

interface DeductibleSelectorProps {
  selected: DeductibleOption;
  onChange: (deductible: DeductibleOption) => void;
  disabled?: boolean;
}

interface OptionConfig {
  value: DeductibleOption;
  percentageLabel: string;
  mantoCoverage: string;
  title: string;
  badge?: string;
  icon: React.ReactNode;
}

const OPCIONES: OptionConfig[] = [
  {
    value: 0.1,
    percentageLabel: '10%',
    mantoCoverage: 'Manto cubre el 90%',
    title: 'Mayor protección en clínica',
    icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />,
  },
  {
    value: 0.15,
    percentageLabel: '15%',
    mantoCoverage: 'Manto cubre el 85%',
    title: 'Equilibrado',
    badge: 'Recomendado',
    icon: <Sparkles className="h-4 w-4 text-orange-brand" />,
  },
  {
    value: 0.2,
    percentageLabel: '20%',
    mantoCoverage: 'Manto cubre el 80%',
    title: 'Cuota mensual más baja',
    icon: <TrendingDown className="h-4 w-4 text-blue-600" />,
  },
];

export const DeductibleSelector: React.FC<DeductibleSelectorProps> = ({
  selected,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-semibold text-navy-900">
            Tu aporte por evento (copago)
          </label>
          <p className="text-xs text-navy-500">
            Lo que pagas tú en cada atención médica; Manto reembolsa el porcentaje restante.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {OPCIONES.map((op) => {
          const isSelected = selected === op.value;
          return (
            <button
              key={op.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(op.value)}
              aria-pressed={isSelected}
              className={`relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                isSelected
                  ? 'border-orange-cta bg-orange-50/40 ring-2 ring-orange-cta/20 shadow-sm'
                  : 'border-line bg-canvas-pure hover:border-navy-300 hover:bg-canvas'
              } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              {op.badge && (
                <span className="absolute -top-2.5 right-3 rounded-full bg-orange-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                  {op.badge}
                </span>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {op.icon}
                  <span className="text-lg font-bold tabular-nums text-navy-900">
                    {op.percentageLabel}
                  </span>
                </div>
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    isSelected
                      ? 'border-orange-cta bg-orange-cta'
                      : 'border-line bg-canvas-pure'
                  }`}
                >
                  {isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
              </div>

              <div className="mt-2 space-y-0.5">
                <p className="text-xs font-semibold text-navy-900">{op.title}</p>
                <p className="text-[11px] font-medium text-emerald-700">
                  {op.mantoCoverage}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DeductibleSelector;
