import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Full-height sheet (pickers). */
  full?: boolean;
}

const CLOSE_MS = 200;

/** Bottom sheet. Only ever opened by a tap; closes with the Cancel/Done buttons or a tap outside. */
export function Sheet({ open, onClose, title, children, full }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.documentElement.classList.add('sheet-open');
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('sheet-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [mounted, onClose]);

  if (!mounted) return null;
  return createPortal(
    <div className={`sheet-root${closing ? ' closing' : ''}`}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`sheet${full ? ' sheet-full' : ''}`} role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        {title && <h2 className="sheet-title">{title}</h2>}
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
