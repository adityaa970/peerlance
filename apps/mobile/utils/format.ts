/** ₹ amount with Indian digit grouping (1,24,500), dropping ".00" for whole rupees. */
export function formatINR(value: number | string | null | undefined): string {
  const n = Number(value) || 0;
  const negative = n < 0;
  const [whole, paise] = Math.abs(n).toFixed(2).split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  return `${negative ? '-' : ''}₹${grouped}${paise === '00' ? '' : `.${paise}`}`;
}

export type StatusTone = 'neutral' | 'info' | 'progress' | 'attention' | 'success' | 'danger';

/**
 * One place that turns a task status (as sent by the API) into a short label and a colour
 * tone, so cards and screens describe progress the same way.
 */
export function describeStatus(status?: string | null): { label: string; tone: StatusTone } {
  const s = String(status || 'OPEN').trim().toUpperCase().replace(/[\s-]+/g, '_');
  switch (s) {
    case 'OPEN':
      return { label: 'Open', tone: 'info' };
    case 'CLAIMED':
    case 'ACCEPTED':
    case 'ACTIVE':
    case 'IN_PROGRESS':
    case 'WRITING':
      return { label: 'In progress', tone: 'progress' };
    case 'UNDER_REVIEW':
      return { label: 'Under review', tone: 'info' };
    case 'NEEDS_APPROVAL':
      return { label: 'Needs approval', tone: 'attention' };
    case 'COMPLETED':
      return { label: 'Completed', tone: 'success' };
    case 'CANCELLED':
    case 'REFUNDED':
      return { label: s === 'REFUNDED' ? 'Refunded' : 'Cancelled', tone: 'neutral' };
    case 'DISPUTED':
      return { label: 'Disputed', tone: 'danger' };
    default:
      return { label: s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' '), tone: 'neutral' };
  }
}

/** Foreground + soft background colours for a status tone. */
export function toneColors(tone: StatusTone, Colors: any): { fg: string; bg: string } {
  switch (tone) {
    case 'info': return { fg: Colors.info, bg: Colors.infoSoft };
    case 'progress': return { fg: Colors.primary, bg: Colors.primarySoft };
    case 'attention': return { fg: Colors.warning, bg: Colors.warningSoft };
    case 'success': return { fg: Colors.success, bg: Colors.successSoft };
    case 'danger': return { fg: Colors.error, bg: Colors.errorSoft };
    default: return { fg: Colors.textTertiary, bg: Colors.overlayLight };
  }
}
