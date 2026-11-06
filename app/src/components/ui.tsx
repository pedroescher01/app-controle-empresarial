import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { brl, maskPhone, parseDecimal, qtd } from '../lib/format';

// ---------- ícones (traço 1.9, 24×24) ----------
const P: Record<string, ReactNode> = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /></>,
  doc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  users: <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M15.5 5.3a3.3 3.3 0 0 1 0 6.4M18 14.8c1.9.7 3.1 2.4 3.5 5.2" /></>,
  more: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="M15 5 8 12l7 7" />,
  chev: <path d="m9 6 6 6-6 6" />,
  // símbolo do WhatsApp (vetorizado a partir do logo oficial)
  wa: <path fill="currentColor" stroke="none" fillRule="evenodd" d="M2.24 22.66C2.63 22.56 4.15 22.16 4.73 22.01C4.92 21.96 5.16 21.90 5.26 21.88C5.36 21.85 5.76 21.76 6.16 21.65C6.55 21.55 6.92 21.46 6.96 21.46C7.02 21.46 7.23 21.55 7.44 21.66C8.08 22.00 9.21 22.39 10.05 22.56C10.70 22.70 11.25 22.74 12.14 22.74C16.85 22.74 20.97 19.57 22.20 14.98C22.64 13.34 22.63 11.32 22.19 9.63C20.83 4.50 15.75 1.20 10.45 2.03C9.68 2.16 8.35 2.55 7.90 2.78C7.85 2.81 7.64 2.92 7.41 3.02C7.18 3.14 6.98 3.23 6.97 3.25C6.96 3.26 6.82 3.35 6.65 3.45C5.74 4.00 4.57 5.03 3.97 5.83C3.84 5.98 3.74 6.11 3.72 6.13C3.52 6.29 2.70 7.76 2.45 8.43C2.36 8.64 2.28 8.86 2.25 8.92C2.23 8.98 2.13 9.29 2.05 9.60C1.36 12.10 1.67 14.95 2.88 17.19C2.99 17.39 3.08 17.61 3.08 17.67C3.08 17.72 3.00 18.07 2.90 18.42C2.80 18.77 2.68 19.16 2.66 19.29C2.62 19.41 2.50 19.80 2.41 20.15C2.04 21.45 1.76 22.45 1.73 22.62C1.70 22.78 1.71 22.80 1.78 22.77C1.83 22.76 2.03 22.71 2.24 22.66ZM10.81 20.96C9.67 20.78 8.55 20.37 7.47 19.74L7.25 19.61L6.30 19.85C5.78 19.98 5.11 20.15 4.83 20.23C4.34 20.36 4.14 20.39 4.14 20.34C4.14 20.31 4.49 19.03 4.62 18.63C4.69 18.41 4.75 18.16 4.77 18.08C4.80 17.99 4.85 17.79 4.89 17.65L4.96 17.38L4.73 17.00C3.82 15.48 3.46 14.27 3.42 12.57C3.36 10.50 3.94 8.67 5.16 7.07C5.52 6.59 5.77 6.32 6.44 5.70C6.92 5.25 8.10 4.52 8.75 4.28C8.84 4.25 9.06 4.16 9.23 4.09C9.57 3.97 10.25 3.79 10.77 3.69C11.23 3.62 12.91 3.62 13.42 3.69C17.21 4.30 20.10 7.19 20.74 10.98C20.84 11.63 20.84 13.11 20.73 13.73C20.04 17.59 17.05 20.49 13.23 20.98C12.52 21.07 11.49 21.06 10.81 20.96ZM15.45 17.25C15.81 17.17 16.39 16.87 16.64 16.63C16.99 16.30 17.16 15.99 17.30 15.44C17.48 14.73 17.50 14.77 16.40 14.25C16.18 14.16 15.78 13.97 15.50 13.84C15.23 13.70 14.95 13.59 14.89 13.57C14.71 13.51 14.54 13.67 13.91 14.51C13.63 14.88 13.58 14.92 13.39 14.92C13.24 14.92 12.75 14.72 12.38 14.52C12.27 14.45 12.12 14.38 12.08 14.35C11.28 13.92 10.16 12.82 9.68 12.00C9.36 11.45 9.35 11.48 10.22 10.52C10.41 10.33 10.46 10.17 10.42 10.00C10.38 9.87 9.96 8.87 9.76 8.44C9.71 8.33 9.64 8.14 9.58 8.01C9.39 7.52 9.29 7.46 8.65 7.46C8.19 7.46 8.03 7.53 7.66 7.91C7.11 8.49 6.89 9.05 6.88 9.83C6.88 11.00 7.31 11.99 8.44 13.42C8.80 13.87 9.78 14.88 10.15 15.18C11.27 16.08 12.46 16.72 13.77 17.12C14.35 17.30 14.98 17.35 15.45 17.25Z" />,
  phone: <path d="M21 16.4v2.9a1.9 1.9 0 0 1-2.1 1.9 18.9 18.9 0 0 1-8.2-2.9 18.6 18.6 0 0 1-5.7-5.7A18.9 18.9 0 0 1 2.1 4.3 1.9 1.9 0 0 1 4 2.2h2.9a1.9 1.9 0 0 1 1.9 1.6c.1.9.3 1.8.7 2.7a1.9 1.9 0 0 1-.4 2L7.8 9.7a15.2 15.2 0 0 0 5.7 5.7l1.2-1.2a1.9 1.9 0 0 1 2-.4c.9.3 1.8.6 2.7.7a1.9 1.9 0 0 1 1.6 1.9z" />,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></>,
  check: <path d="M5 12.5 10 17 19 7" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  share: <><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" /><path d="M5 12v8h14v-8" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  cash: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 9.5v5M17.5 9.5v5" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  trash: <><path d="M4.5 7h15M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.4" /></>,
  hard: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 15h18M7 18h.01" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
  helmet: <><path d="M4 16a8 8 0 0 1 16 0" /><path d="M3 16h18v2.5H3zM12 8v4M9.5 8.8l.5 3.7M14.5 8.8 14 12.5" /></>,
  building: <><path d="M4 21V5l8-2v18M12 8h8v13" /><path d="M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2" /></>,
  del: <><path d="M9 6h11v12H9l-6-6z" /><path d="m12 9.5 5 5M17 9.5l-5 5" /></>,
  upload: <><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5" /><path d="M5 14v6h14v-6" /></>,
  download: <><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" /><path d="M5 14v6h14v-6" /></>,
  alert: <><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17h.01" /></>,
  face: <><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M9 9.5v1M15 9.5v1M12 9.5V13h-1M9.5 15.5a3.5 3.5 0 0 0 5 0" /></>,
  coil: <><ellipse cx="8" cy="12" rx="4" ry="7" /><ellipse cx="8" cy="12" rx="1.4" ry="2.6" /><path d="M8 5h9c2.2 0 4 3.1 4 7s-1.8 7-4 7H8" /></>,
  truck: <><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
};
export function Icon({ name, className, style }: { name: keyof typeof P | string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      {P[name]}
    </svg>
  );
}

// ---------- cabeçalho ----------
export function TopBar({ eyebrow, title, onBack, backLabel = 'Voltar', right }: { eyebrow?: ReactNode; title: ReactNode; onBack?: () => void; backLabel?: string; right?: ReactNode }) {
  return (
    <header className="top">
      <div className="titles">
        {onBack && (
          <button className="back" onClick={onBack}>
            <Icon name="back" />
            {backLabel}
          </button>
        )}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Pill({ cor, children }: { cor: string; children: ReactNode }) {
  return <span className={`pill ${cor}`}>{children}</span>;
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card empty">
      <div className="ic mute"><Icon name={icon} /></div>
      <b>{title}</b>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- folha que sobe de baixo ----------
export function Sheet({ open, onClose, title, children, right }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; right?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', k);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="in">
          <div className="grab" />
          <div className="hd">
            <h2>{title}</h2>
            {right}
            <button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="x" /></button>
          </div>
          <div className="bd">{children}</div>
        </div>
      </div>
    </>
  );
}

/** Confirmação dentro da página (o iPhone instalado não mostra confirm()). */
export function Confirm({ open, title, text, confirmLabel, danger, onConfirm, onClose }: { open: boolean; title: string; text?: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {text && <p className="muted" style={{ margin: 0 }}>{text}</p>}
      <div className="btns">
        <button className="btn block ghost" onClick={onClose}>Cancelar</button>
        <button className={`btn block ${danger ? 'primary' : 'primary'}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </div>
    </Sheet>
  );
}

// ---------- aviso rápido ----------
const ToastCtx = createContext<(m: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<number>();
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------- campos com formato ----------

/** Moeda no estilo de app de banco: digita só números e vira R$ 1.234,56. */
export function MoneyInput({ value, onChange, id, placeholder = 'R$ 0,00', allowEmpty, className = '', ...rest }: { value: number | null; onChange: (v: number | null) => void; id?: string; placeholder?: string; allowEmpty?: boolean; className?: string; 'aria-label'?: string; autoFocus?: boolean; style?: React.CSSProperties }) {
  const txt = value == null || (allowEmpty && value === 0 && false) ? '' : brl(value);
  return (
    <input
      id={id}
      className={`input money ${className}`}
      inputMode="numeric"
      placeholder={placeholder}
      value={value == null ? '' : txt}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, '');
        if (!d) return onChange(allowEmpty ? null : 0);
        onChange(parseInt(d, 10) / 100);
      }}
      {...rest}
    />
  );
}

/** Número decimal com vírgula (quantidade, metros). Mantém o texto enquanto digita. */
export function DecimalInput({ value, onChange, id, placeholder, className = '', ...rest }: { value: number; onChange: (v: number) => void; id?: string; placeholder?: string; className?: string; 'aria-label'?: string; autoFocus?: boolean; style?: React.CSSProperties }) {
  const [txt, setTxt] = useState(value ? qtd(value) : '');
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setTxt(value ? qtd(value) : '');
      last.current = value;
    }
  }, [value]);
  return (
    <input
      id={id}
      className={`input num ${className}`}
      inputMode="decimal"
      placeholder={placeholder}
      value={txt}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d,.]/g, '');
        setTxt(t);
        const n = parseDecimal(t);
        last.current = n;
        onChange(n);
      }}
      onFocus={(e) => e.target.select()}
      {...rest}
    />
  );
}

export function PhoneInput({ value, onChange, id, ...rest }: { value: string; onChange: (v: string) => void; id?: string; 'aria-label'?: string; placeholder?: string }) {
  return (
    <input id={id} className="input num" type="tel" inputMode="tel" autoComplete="tel" placeholder="(19) 99999-9999" value={value} onChange={(e) => onChange(maskPhone(e.target.value))} {...rest} />
  );
}
