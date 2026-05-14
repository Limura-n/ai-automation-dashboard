/**
 * Shared utility functions for the Mission Control dashboard.
 * Does NOT overwrite utils.ts which exports cn().
 */

/**
 * Format a date string as a human-readable relative time.
 * Duplicated across page.tsx, missions-panel.tsx, live-activity-panel.tsx — now centralized here.
 */
export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

/**
 * Map a status string to its Tailwind text color class.
 * Covers all statuses used across the dashboard.
 */
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    idle: 'text-slate-400',
    busy: 'text-amber-400',
    completed: 'text-emerald-400',
    error: 'text-rose-400',
    pending: 'text-slate-400',
    assigned: 'text-sky-400',
    in_progress: 'text-amber-400',
    failed: 'text-rose-400',
    analyzing: 'text-purple-400',
    assigning: 'text-cyan-400',
    blocked: 'text-red-400',
  }
  return map[status] || 'text-slate-400'
}

/**
 * Map a status string to its Tailwind background/border classes.
 * Uses the bg-*-500/15 border-*-500/20 pattern consistent with the dashboard.
 */
export function statusBg(status: string): string {
  const map: Record<string, string> = {
    idle: 'bg-slate-500/15 border-slate-500/20',
    busy: 'bg-amber-500/15 border-amber-500/20',
    completed: 'bg-emerald-500/15 border-emerald-500/20',
    error: 'bg-rose-500/15 border-rose-500/20',
    pending: 'bg-slate-500/15 border-slate-500/20',
    assigned: 'bg-sky-500/15 border-sky-500/20',
    in_progress: 'bg-amber-500/15 border-amber-500/20',
    failed: 'bg-rose-500/15 border-rose-500/20',
    analyzing: 'bg-purple-500/15 border-purple-500/20',
    assigning: 'bg-cyan-500/15 border-cyan-500/20',
    blocked: 'bg-red-500/15 border-red-500/20',
  }
  return map[status] || 'bg-slate-500/15 border-slate-500/20'
}

/**
 * Map a priority string to its badge Tailwind classes.
 * Matches the pattern in tasks-panel.tsx.
 */
export function priorityBadge(priority: string): string {
  const map: Record<string, string> = {
    normal: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
    high: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    urgent: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  }
  return map[priority] || 'bg-slate-500/10 text-slate-300 border-slate-500/20'
}
