import { forwardRef, useEffect, useRef, useState } from 'react';
import { formatKg } from '../lib/format';

interface Props {
  value: number | null;
  /** 'decimal' for kg (opens the keypad with a dot), 'numeric' for reps. */
  mode: 'decimal' | 'numeric';
  placeholder?: string;
  label: string;
  onChange: (value: number | null) => void;
  className?: string;
}

const PATTERN = { decimal: /^\d{0,4}([.]\d{0,2})?$/, numeric: /^\d{0,3}$/ };

/** Text input that opens the numeric keypad and writes through on every keystroke. */
export const NumberField = forwardRef<HTMLInputElement, Props>(function NumberField(
  { value, mode, placeholder, label, onChange, className },
  ref,
) {
  const [text, setText] = useState(formatKg(value));
  const focused = useRef(false);

  // Accept outside changes (e.g. "+ Set" copying values) unless the user is typing here.
  useEffect(() => {
    if (!focused.current) setText(formatKg(value));
  }, [value]);

  return (
    <input
      ref={ref}
      className={`num-input ${className ?? ''}`}
      type="text"
      inputMode={mode}
      pattern={mode === 'numeric' ? '[0-9]*' : undefined}
      autoComplete="off"
      enterKeyHint="done"
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        const el = e.currentTarget;
        requestAnimationFrame(() => el.setSelectionRange(0, el.value.length));
      }}
      onBlur={() => {
        focused.current = false;
        setText((t) => (t.endsWith('.') ? t.slice(0, -1) : t));
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.');
        if (!PATTERN[mode].test(raw)) return;
        setText(raw);
        const n = raw === '' || raw === '.' ? null : Number(raw);
        onChange(n == null || Number.isNaN(n) ? null : n);
      }}
    />
  );
});
