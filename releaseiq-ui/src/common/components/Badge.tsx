import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'cyan' | 'orange';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  color?: string;       // explicit color override (hex / css var)
  small?: boolean;
  dot?: boolean;        // show a leading dot indicator
  pulse?: boolean;      // animate the dot
  className?: string;
}

const VARIANT_MAP: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  default:  { bg: 'rgba(107,114,128,.1)',  text: '#6b7280',  border: 'rgba(107,114,128,.18)' },
  success:  { bg: 'rgba(24,160,87,.1)',    text: '#18a057',  border: 'rgba(24,160,87,.2)' },
  warning:  { bg: 'rgba(212,132,10,.1)',   text: '#d4840a',  border: 'rgba(212,132,10,.2)' },
  danger:   { bg: 'rgba(208,39,29,.09)',   text: '#d0271d',  border: 'rgba(208,39,29,.2)' },
  info:     { bg: 'rgba(32,96,216,.1)',    text: '#2060d8',  border: 'rgba(32,96,216,.2)' },
  purple:   { bg: 'rgba(121,103,174,.1)',  text: '#7967ae',  border: 'rgba(121,103,174,.2)' },
  cyan:     { bg: 'rgba(13,148,136,.1)',   text: '#0d9488',  border: 'rgba(13,148,136,.2)' },
  orange:   { bg: 'rgba(200,95,26,.1)',    text: '#c85f1a',  border: 'rgba(200,95,26,.2)' },
};

/** Derive variant from a freeform status string */
export function statusToVariant(status: string): BadgeVariant {
  const s = status?.toLowerCase() ?? '';
  if (['complete','done','deployed','passed','accepted','success','resolved','approved'].some(k => s.includes(k))) return 'success';
  if (['in progress','syncing','certifying','verifying','active'].some(k => s.includes(k))) return 'info';
  if (['blocked','failed','error','denied','critical'].some(k => s.includes(k))) return 'danger';
  if (['pending','warning','stale','major'].some(k => s.includes(k))) return 'warning';
  if (['planning','minor'].some(k => s.includes(k))) return 'default';
  return 'default';
}

export function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  return <Badge label={status} variant={statusToVariant(status)} small={small} />;
}

export default function Badge({ label, variant = 'default', color, small, dot, pulse }: BadgeProps) {
  const theme = VARIANT_MAP[variant];
  const textColor = color ?? theme.text;
  const bgColor   = color ? color + '14' : theme.bg;
  const bdColor   = color ? color + '28' : theme.border;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: bgColor, color: textColor, border: `1px solid ${bdColor}`,
      borderRadius: 12, padding: small ? '2px 7px' : '3px 9px',
      fontSize: small ? 10 : 10, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {dot && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%', background: textColor,
          display: 'inline-block', flexShrink: 0,
          animation: pulse ? 'riq-pulse 2s infinite' : undefined,
        }} />
      )}
      {label}
    </span>
  );
}
