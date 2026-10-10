import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useContext,
  createContext,
} from "react";
import { Navigate } from "react-router-dom";
import {
  Wifi,
  Utensils,
  Car,
  ShieldCheck,
  Wind,
  Sun,
  Users,
  Sparkles,
  Check,
  Home,
  LoaderCircle,
  X,
} from "lucide-react";
import { api, type User } from "./api";
export type Context = {
  user: User | null;
  config: any;
  refresh: () => Promise<void>;
  toast: (s: string) => void;
  saved: string[];
  toggleSave: (id: string) => void;
  compare: string[];
  toggleCompare: (id: string) => void;
};
export const Ctx = createContext<Context>(null!);
export const useApp = () => useContext(Ctx);
export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const I: any =
    (
      {
        "Wi-Fi": Wifi,
        Food: Utensils,
        Parking: Car,
        Security: ShieldCheck,
        Laundry: Wind,
        "Power backup": Sun,
        Gym: Users,
        Housekeeping: Sparkles,
        Kitchen: Utensils,
      } as any
    )[name] || Check;
  return <I size={size} />;
}
export function Badge({
  children,
  status = "",
}: {
  children: React.ReactNode;
  status?: string;
}) {
  return <span className={`badge ${status}`}>{children}</span>;
}
export function Empty({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Home size={32} />
      <h3>{title}</h3>
      <p>{body}</p>
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" /> A little closer to home…
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const node = ref.current;
    node?.querySelector<HTMLElement>("input,button,select,textarea")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const els = [
          ...node!.querySelectorAll<HTMLElement>(
            "button,a,input,select,textarea",
          ),
        ].filter((el) => !el.hasAttribute("disabled"));
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function useLoad<T = any>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setError("");
      setData(await api(path));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [path]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);
  return { data, error, load };
}
export function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div className="error" role="alert">
      {error}
    </div>
  ) : null;
}
export function Guard({
  roles,
  children,
}: {
  roles?: string[];
  children: React.ReactNode;
}) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return (
      <Empty
        title="This area belongs to another role"
        body="Use the dashboard linked in your navigation."
      />
    );
  return <>{children}</>;
}
export function PageTitle({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
