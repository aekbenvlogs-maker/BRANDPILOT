"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/components/ui/Toast.tsx
// ============================================================

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider + Container
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 z-50 flex flex-col items-end justify-end gap-2 p-4"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Individual toast
// ---------------------------------------------------------------------------

const typeConfig: Record<
  ToastType,
  { icon: React.ReactNode; bg: string; text: string; border: string }
> = {
  success: {
    icon: <CheckCircle className="h-5 w-5 text-emerald-500" aria-hidden="true" />,
    bg: "bg-white dark:bg-gray-800",
    text: "text-gray-900 dark:text-white",
    border: "border-emerald-400",
  },
  error: {
    icon: <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />,
    bg: "bg-white dark:bg-gray-800",
    text: "text-gray-900 dark:text-white",
    border: "border-red-400",
  },
  info: {
    icon: <Info className="h-5 w-5 text-indigo-500" aria-hidden="true" />,
    bg: "bg-white dark:bg-gray-800",
    text: "text-gray-900 dark:text-white",
    border: "border-indigo-400",
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />,
    bg: "bg-white dark:bg-gray-800",
    text: "text-gray-900 dark:text-white",
    border: "border-amber-400",
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const config = typeConfig[toast.type];

  return (
    <div
      role="alert"
      className={[
        "pointer-events-auto flex items-center gap-3 rounded-lg border-l-4 px-4 py-3",
        "shadow-lg max-w-sm w-full",
        config.bg,
        config.text,
        config.border,
      ].join(" ")}
    >
      {config.icon}
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Fermer la notification"
        className="ml-2 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export default ToastProvider;
