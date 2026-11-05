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
  wa: <><path d="M3.6 20.4l1.35-4.2a8.3 8.3 0 1 1 3.05 3.05z" /><g transform="translate(12 12) scale(0.37) translate(-12 -12)"><path fill="currentColor" stroke="none" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></g></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
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
