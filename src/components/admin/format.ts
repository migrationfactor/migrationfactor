const perth = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Perth' });

/** Admin timestamps are shown in Perth time, where the business is based. */
export function formatDateTime(value: string): string {
  return `${perth.format(new Date(value))} AWST`;
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
