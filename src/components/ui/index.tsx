import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface ToastState {
  msg: string;
  type: "info" | "success" | "error";
}

const ToastCtx = createContext<(msg: string, type?: ToastState["type"]) => void>(
  () => {}
);

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((msg: string, type: ToastState["type"] = "info") => {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const color =
    toast?.type === "error"
      ? "bg-red-500"
      : toast?.type === "success"
        ? "bg-brand-green"
        : "bg-ink";

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-fade-in-up">
          <div
            className={`rounded-2xl px-5 py-3 text-sm font-medium text-white shadow-glass ${color}`}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}
