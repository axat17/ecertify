// ─── Date / Time ──────────────────────────────────────────────────────────────

export function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

export function fmtDateShort(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmtDateTime(d: Date | string): string {
  const dt = new Date(d);
  return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' ' + fmtDateShort(dt);
}

export function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function fmtDurationHuman(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function timeAgo(d: Date | string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Offset a date by N bi-weekly periods */
export function biWeeklyDate(anchor: string | Date, periods: number): Date {
  const d = new Date(anchor);
  d.setDate(d.getDate() + periods * 14);
  return d;
}

// ─── Validators ──────────────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isStale(lastSync: Date | string | null | undefined, thresholdMinutes = 30): boolean {
  if (!lastSync) return true;
  return (Date.now() - new Date(lastSync).getTime()) > thresholdMinutes * 60 * 1000;
}

// ─── String helpers ───────────────────────────────────────────────────────────

export function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/__+/g, '_');
}

export function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

export function healthColor(score: number): string {
  return score >= 80 ? '#18a057' : score >= 50 ? '#d4840a' : '#d0271d';
}

/** Avatar background colour from a string (stable per input) */
const AVATAR_COLORS = ['#d0271d','#121c4e','#7967ae','#0d9488','#2060d8','#c85f1a','#be185d','#0369a1'];
export function avatarColor(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = input.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Jira / Copado helpers ───────────────────────────────────────────────────

export const SEVERITY_TO_PRIORITY: Record<string, string> = {
  Critical: 'Highest', Major: 'High', Minor: 'Medium',
};

export const ROLE_LABELS: Record<string, string> = {
  bu: 'BU Rep', qa: 'QA Team', rm: 'Release Mgr', dev: 'Dev Lead',
  'main-admin': 'Main Admin', 'project-admin': 'Project Admin', user: 'User',
};

export const ROLE_COLORS: Record<string, string> = {
  bu: '#2060d8', qa: '#7967ae', rm: '#c85f1a', dev: '#0d9488',
  'main-admin': '#d0271d', 'project-admin': '#f59e0b',
};

export const BUNDLE_COLORS = ['#7967ae', '#2060d8', '#0d9488'];

export const ENV_PIPELINE = ['DEV', 'SIT', 'UAT', 'STG', 'PROD'];

export const TEAMS = ['TEAM-A', 'TEAM-B', 'TEAM-C', 'TEAM-D', 'TEAM-E', 'TEAM-F', 'TEAM-G', 'TEAM-H'];

export const BUSINESS_UNITS = ['Enterprise', 'MAS', 'NAS', 'Canada', 'SBS', 'Tax Direct', 'Wisely-Wage Pay'];
