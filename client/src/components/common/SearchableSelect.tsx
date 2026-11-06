import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export interface SearchableOption {
  value: string | number;
  label: string;
  sublabel?: string;
  badge?: string;
  keywords?: string;
}

interface SearchableSelectProps {
  value: string | number;
  onChange: (value: any, option?: SearchableOption) => void;
  options: SearchableOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowCustom?: boolean;
  className?: string;
  dropdownClassName?: string;
  maxDisplay?: number;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Selecione ou digite...',
  required = false,
  disabled = false,
  allowCustom = false,
  className = '',
  dropdownClassName = '',
  maxDisplay = 50
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Encontra a opção selecionada atual
  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(value));
  }, [options, value]);

  // Sincroniza query com o valor atual quando o dropdown está fechado
  useEffect(() => {
    if (!isOpen) {
      if (selectedOption) {
        setQuery(selectedOption.label);
      } else if (allowCustom && value) {
        setQuery(String(value));
      } else {
        setQuery('');
      }
    }
  }, [isOpen, selectedOption, value, allowCustom]);

  // Fecha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Restaura query para o label selecionado
        if (selectedOption) {
          setQuery(selectedOption.label);
        } else if (allowCustom && value) {
          setQuery(String(value));
        } else {
          setQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption, value, allowCustom]);

  // Filtra opções
  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options.slice(0, maxDisplay);

    const normalize = (text: string) =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const q = normalize(query.trim());
    const tokens = q.split(/\s+/).filter(Boolean);

    return options
      .filter((opt) => {
        const fullText = normalize(`${opt.label} ${opt.sublabel || ''} ${opt.keywords || ''} ${opt.badge || ''}`);
        return tokens.every((token) => fullText.includes(token));
      })
      .slice(0, maxDisplay);
  }, [options, query, maxDisplay]);

  const handleSelect = (opt: SearchableOption) => {
    onChange(opt.value, opt);
    setQuery(opt.label);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    setHighlightedIndex(0);

    if (allowCustom) {
      onChange(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        e.preventDefault();
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (allowCustom && query) {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Campo de Input com visual de Combobox */}
      <div
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all cursor-text ${
          isOpen
            ? 'border-amber-500 ring-2 ring-amber-500/20 bg-slate-50 dark:bg-dark-800'
            : 'border-slate-300 dark:border-dark-700 bg-slate-50 dark:bg-dark-800 hover:border-slate-400 dark:hover:border-dark-600'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required && !value}
          disabled={disabled}
          className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none font-semibold"
        />

        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer"
            title="Limpar seleção"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </div>

      {/* Dropdown com opções filtradas */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-850 shadow-2xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 ${dropdownClassName}`}
        >
          {filteredOptions.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-400">
              {allowCustom ? (
                <div>
                  <p className="font-semibold text-slate-300">Nenhum item correspondente.</p>
                  <p className="text-[11px] text-amber-500 mt-0.5">
                    O valor digitado <strong>"{query}"</strong> será utilizado.
                  </p>
                </div>
              ) : (
                'Nenhum resultado encontrado'
              )}
            </div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = String(opt.value) === String(value);
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={`${opt.value}-${idx}`}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold'
                      : isHighlighted
                      ? 'bg-slate-100 dark:bg-dark-750 text-slate-900 dark:text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-800'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{opt.label}</div>
                    {opt.sublabel && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {opt.sublabel}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.badge && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-dark-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-dark-600">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <Check className="w-4 h-4 text-amber-500 shrink-0" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
