import React from 'react';

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  padding?: number | string;
  style?: React.CSSProperties;
  accent?: string; // top-border accent color
  onClick?: () => void;
}

export function Card({ children, padding = 18, style, accent, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)', overflow: 'hidden',
        cursor: onClick ? 'pointer' : undefined,
        borderTop: accent ? `3px solid ${accent}` : undefined,
        ...style,
      }}
    >
      <div style={{ padding }}>{children}</div>
    </div>
  );
}

export function Surface({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 10, padding: 14, ...style }}>
      {children}
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

interface SectionProps {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Section({ title, action, children, style }: SectionProps) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)', ...style }}>
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f0f2f7' }}>
          {title && <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const MODAL_WIDTHS = { sm: 400, md: 520, lg: 680, xl: 900 };

export function Modal({ title, subtitle, onClose, children, size = 'md' }: ModalProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 16, padding: 26, width: '100%', maxWidth: MODAL_WIDTHS[size], maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 10px 32px rgba(0,0,0,.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #e0e4ef' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1, padding: 2, borderRadius: 4, flexShrink: 0 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

export function Spinner({ size = 16, color = '#d0271d' }: { size?: number; color?: string }) {
  return (
    <span style={{
      width: size, height: size, display: 'inline-block', flexShrink: 0,
      border: `2px solid ${color}20`, borderTopColor: color, borderRadius: '50%',
      animation: 'riq-spin .6s linear infinite',
    }} />
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  value: number;        // 0–100
  height?: number;
  color?: string;       // override color
  showLabel?: boolean;
}

export function ProgressBar({ value, height = 6, color, showLabel }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const autoColor = color ?? (clampedValue >= 80 ? '#18a057' : clampedValue >= 50 ? '#d4840a' : '#d0271d');
  return (
    <div>
      {showLabel && (
        <div style={{ fontSize: 11, fontWeight: 700, color: autoColor, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4, textAlign: 'right' }}>
          {clampedValue}%
        </div>
      )}
      <div style={{ height, background: '#f0f2f7', borderRadius: height / 2, overflow: 'hidden' }}>
        <div style={{ width: `${clampedValue}%`, height: '100%', background: autoColor, borderRadius: height / 2, transition: 'width .6s ease' }} />
      </div>
    </div>
  );
}

// ─── Metric tile ─────────────────────────────────────────────────────────────

interface MetricProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: string;
}

export function Metric({ label, value, sub, color = '#111827' }: MetricProps) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 10, padding: 15, flex: 1, minWidth: 110, boxShadow: '0 1px 3px rgba(0,0,0,.06)', transition: 'box-shadow .2s' }}>
      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = '📋', title, description, action }: EmptyStateProps) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      {icon && <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>}
      <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16, maxWidth: 340, margin: '0 auto 16px' }}>{description}</div>}
      {action}
    </div>
  );
}

// ─── Alert banners ───────────────────────────────────────────────────────────

interface AlertProps {
  type: 'error' | 'warning' | 'success' | 'info';
  children: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

const ALERT_STYLES: Record<AlertProps['type'], React.CSSProperties> = {
  error:   { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' },
  warning: { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' },
  success: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' },
  info:    { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' },
};

const ALERT_ICONS: Record<AlertProps['type'], string> = {
  error: '❌', warning: '⚠️', success: '✓', info: 'ℹ️',
};

export function Alert({ type, children, action, style }: AlertProps) {
  return (
    <div style={{ borderRadius: 8, padding: '10px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 10, ...ALERT_STYLES[type], ...style }}>
      <span style={{ flexShrink: 0 }}>{ALERT_ICONS[type]}</span>
      <span style={{ flex: 1, lineHeight: 1.5 }}>{children}</span>
      {action}
    </div>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider({ margin = 14 }: { margin?: number }) {
  return <div style={{ height: 1, background: '#e0e4ef', margin: `${margin}px 0` }} />;
}

// ─── Tabs strip ─────────────────────────────────────────────────────────────

interface Tab { label: string; key: string }

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  variant?: 'pills' | 'underline';
}

export function Tabs({ tabs, active, onChange, variant = 'pills' }: TabsProps) {
  if (variant === 'underline') {
    return (
      <div style={{ display: 'flex', borderBottom: '1px solid #e0e4ef', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => onChange(t.key)} style={{
            background: 'none', border: 'none', borderBottom: `2px solid ${active === t.key ? '#d0271d' : 'transparent'}`,
            color: active === t.key ? '#d0271d' : '#9ca3af', padding: '11px 16px', cursor: 'pointer',
            fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'all .15s',
          }}>{t.label}</button>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', background: '#fff', border: '1px solid #e0e4ef', borderRadius: 10, padding: 4, gap: 3, flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          background: active === t.key ? '#121c4e' : 'transparent',
          color: active === t.key ? '#fff' : '#9ca3af',
          border: 'none', borderRadius: 7, padding: '8px 15px', cursor: 'pointer',
          fontSize: 11, fontWeight: 600, transition: 'all .15s', whiteSpace: 'nowrap', fontFamily: 'inherit',
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

interface Column<T> {
  key: string;
  header: string;
  render: (row: T, index: number) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  striped?: boolean;
}

export function Table<T>({ columns, rows, keyExtractor, onRowClick, emptyState, striped = true }: TableProps<T>) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e4ef', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{ padding: '10px 14px', textAlign: col.align ?? 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: '1px solid #e0e4ef', background: '#f8f9fc', whiteSpace: 'nowrap', width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length}>{emptyState ?? <EmptyState title="No data" />}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={keyExtractor(row, i)} onClick={() => onRowClick?.(row)} style={{ background: striped && i % 2 !== 0 ? 'rgba(0,0,0,.01)' : '#fff', cursor: onRowClick ? 'pointer' : undefined, transition: 'background .1s' }}
              onMouseOver={e => { if (onRowClick) (e.currentTarget as HTMLTableRowElement).style.background = '#f8f9fc'; }}
              onMouseOut={e => { (e.currentTarget as HTMLTableRowElement).style.background = striped && i % 2 !== 0 ? 'rgba(0,0,0,.01)' : '#fff'; }}>
              {columns.map(col => (
                <td key={col.key} style={{ padding: '11px 14px', fontSize: 12, color: '#374151', borderBottom: '1px solid #f0f2f7', textAlign: col.align ?? 'left' }}>
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Form fields ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
        {label}{required && <span style={{ color: '#d0271d', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && !error && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{hint}</div>}
      {error && <div style={{ fontSize: 10, color: '#d0271d', marginTop: 3 }}>{error}</div>}
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  width: '100%', background: '#f8f9fc', border: '1px solid #e0e4ef', borderRadius: 8,
  padding: '9px 12px', fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  transition: 'border-color .15s',
};

// ─── Secret input (show/hide toggle) ─────────────────────────────────────────

interface SecretInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}

export function SecretInput({ value, onChange, ...rest }: SecretInputProps) {
  const [show, setShow] = React.useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} style={{ ...inputStyle, paddingRight: 60 }} {...rest} />
      <button type="button" onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: '#e0e4ef', border: 'none', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

// ─── Env toggle row ───────────────────────────────────────────────────────────

export function EnvCheckGroup({ envs, selected, onChange }: { envs: string[]; selected: string[]; onChange: (envs: string[]) => void }) {
  function toggle(env: string) {
    onChange(selected.includes(env) ? selected.filter(e => e !== env) : [...selected, env]);
  }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
      {envs.map(env => (
        <button key={env} type="button" onClick={() => toggle(env)}
          style={{ background: selected.includes(env) ? '#eff6ff' : '#f8f9fc', color: selected.includes(env) ? '#2060d8' : '#9ca3af', border: `1px solid ${selected.includes(env) ? '#bfdbfe' : '#e0e4ef'}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', transition: 'all .15s' }}>
          {env}
        </button>
      ))}
    </div>
  );
}

// ─── Step pipeline ────────────────────────────────────────────────────────────

export function StepPipeline({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {steps.map((step, i) => (
        <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          {i < steps.length - 1 && <div style={{ position: 'absolute', top: 14, left: '50%', width: '100%', height: 2, background: i < activeIndex ? '#18a057' : '#e0e4ef' }} />}
          <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, fontWeight: 700, fontSize: 11, border: '2px solid', background: i < activeIndex ? '#18a057' : i === activeIndex ? '#d0271d' : '#fff', borderColor: i < activeIndex ? '#18a057' : i === activeIndex ? '#d0271d' : '#e0e4ef', color: i <= activeIndex ? '#fff' : '#9ca3af', boxShadow: i === activeIndex ? '0 0 0 4px rgba(208,39,29,.15)' : undefined }}>
            {i < activeIndex ? '✓' : i + 1}
          </div>
          <div style={{ fontSize: 9, color: i <= activeIndex ? '#374151' : '#9ca3af', fontWeight: 600, textTransform: 'uppercase', marginTop: 5 }}>{step}</div>
        </div>
      ))}
    </div>
  );
}
