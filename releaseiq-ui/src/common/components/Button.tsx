import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'blue';
export type ButtonSize    = 'xs' | 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary:   { background: '#d0271d', color: '#fff', border: 'none' },
  secondary: { background: '#121c4e', color: '#fff', border: 'none' },
  ghost:     { background: '#f0f2f7', color: '#374151', border: '1px solid #e0e4ef' },
  danger:    { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' },
  success:   { background: '#18a057', color: '#fff', border: 'none' },
  blue:      { background: '#2060d8', color: '#fff', border: 'none' },
};

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  xs: { padding: '4px 9px',  fontSize: 10 },
  sm: { padding: '6px 13px', fontSize: 11 },
  md: { padding: '9px 18px', fontSize: 12 },
};

export default function Button({
  variant = 'ghost', size = 'md', loading = false,
  leftIcon, rightIcon, fullWidth, children, disabled, style, ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, borderRadius: 8, fontWeight: 600, cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap',
        opacity: (disabled || loading) ? .55 : 1,
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
      {...rest}
    >
      {loading && <Spinner />}
      {!loading && leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}

function Spinner() {
  return (
    <span style={{
      width: 13, height: 13, border: '2px solid rgba(255,255,255,.3)',
      borderTopColor: '#fff', borderRadius: '50%',
      display: 'inline-block', flexShrink: 0,
      animation: 'riq-spin .6s linear infinite',
    }} />
  );
}
