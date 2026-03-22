import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: number;
  type: ToastType;
  text: string;
}

let toastId = 0;
let addToastFn: ((type: ToastType, text: string) => void) | null = null;

export function showToast(type: ToastType, text: string) {
  addToastFn?.(type, text);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    addToastFn = (type, text) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, type, text }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    };
    return () => { addToastFn = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className={`toast-dot toast-dot-${toast.type}`} />
          <span className="toast-text">{toast.text}</span>
        </div>
      ))}
    </div>
  );
}
