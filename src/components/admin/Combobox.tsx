'use client';
import { useId, useRef, useState } from 'react';

export interface ComboOption { value: string; label: string; hint?: string }

interface Props {
  value: string;
  options: ComboOption[];
  onChange: (text: string) => void;
  onSelect: (option: ComboOption) => void;
  placeholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
  maxLength?: number;
  id?: string;
}

/**
 * Text input with a themed suggestion list (ARIA combobox). Replaces <datalist>, whose popup the
 * browser draws in its own grey style. Typing filters; arrows, Enter and Escape work as expected.
 */
export default function Combobox({ value, options, onChange, onSelect, placeholder, ariaLabel, invalid, maxLength, id }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const term = value.trim().toLowerCase();
  // A value that already matches an option shows the full list, so the choice can be changed.
  const exact = options.some((o) => o.label.toLowerCase() === term);
  const matches = options
    .filter((o) => !term || exact || o.label.toLowerCase().includes(term) || (o.hint ?? '').toLowerCase().includes(term))
    .slice(0, 50);
  const show = open && matches.length > 0;

  function choose(option: ComboOption) {
    onSelect(option);
    setOpen(false);
    setActive(-1);
  }
  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive((i) => Math.min(matches.length - 1, i + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === 'Enter' && show && active >= 0) { event.preventDefault(); choose(matches[active]); }
    else if (event.key === 'Escape') { setOpen(false); setActive(-1); }
  }

  return (
    <div className="admin-combo">
      <input ref={input} id={id} value={value} placeholder={placeholder} maxLength={maxLength} autoComplete="off"
        role="combobox" aria-label={ariaLabel} aria-expanded={show} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined} aria-invalid={invalid || undefined}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown} />
      {show && (
        <ul className="admin-combo-list" id={listId} role="listbox">
          {matches.map((o, i) => (
            <li key={`${o.value}-${i}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              className={i === active ? 'is-active' : undefined}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }} onMouseEnter={() => setActive(i)}>
              <span>{o.label}</span>{o.hint && <small>{o.hint}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
