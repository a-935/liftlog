import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Sheet } from './Sheet';
import { haptic } from '../lib/haptics';

// Undo toasts and confirm dialogs, available anywhere via hooks.

interface ToastOptions {
  message: string;
  undo?: () => void | Promise<void>;
  durationMs?: number;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
}

const ToastContext = createContext<(t: ToastOptions) => void>(() => {});
const ConfirmContext = createContext<(c: ConfirmOptions) => Promise<boolean>>(async () => false);

export const useToast = () => useContext(ToastContext);
export const useConfirm = () => useContext(ConfirmContext);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const showToast = useCallback((t: ToastOptions) => {
    window.clearTimeout(timer.current);
    setToast({ ...t, key: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), t.durationMs ?? 5000);
  }, []);

  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const confirm = useCallback(
    (c: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...c, resolve });
        setConfirmOpen(true);
      }),
    [],
  );

  const settle = (ok: boolean) => {
    confirmState?.resolve(ok);
    setConfirmOpen(false);
  };

  return (
    <ToastContext.Provider value={showToast}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        <Sheet open={confirmOpen} onClose={() => settle(false)} title={confirmState?.title}>
          {confirmState?.message && <p className="sheet-text">{confirmState.message}</p>}
          <div className="stack">
            <button
              className={`btn btn-lg ${confirmState?.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => {
                haptic();
                settle(true);
              }}
            >
              {confirmState?.confirmLabel}
            </button>
            <button className="btn btn-lg btn-secondary" onClick={() => settle(false)}>
              Cancel
            </button>
          </div>
        </Sheet>
        {toast &&
          createPortal(
            <div className="toast" key={toast.key} role="status">
              <span className="toast-msg">{toast.message}</span>
              {toast.undo && (
                <button
                  className="toast-undo"
                  onClick={async () => {
                    const undo = toast.undo!;
                    window.clearTimeout(timer.current);
                    setToast(null);
                    haptic();
                    await undo();
                  }}
                >
                  Undo
                </button>
              )}
            </div>,
            document.body,
          )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}
