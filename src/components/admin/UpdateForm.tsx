'use client';
import { useActionState } from 'react';
import type { ActionState } from '@/app/admin/actions';
import { statusLabel } from './format';

interface UpdateFormProps {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  table?: string;
  status: string;
  notes: string | null;
  statuses: readonly string[];
  notifyOption?: boolean;
}

export default function UpdateForm({ action, id, table, status, notes, statuses, notifyOption }: UpdateFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form className="admin-update" action={formAction}>
      <input type="hidden" name="id" value={id} />
      {table && <input type="hidden" name="table" value={table} />}
      <label>Status<select name="status" defaultValue={status}>
        {statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
      </select></label>
      <label>Internal notes<textarea name="admin_notes" rows={4} maxLength={4000} defaultValue={notes || ''} /></label>
      {notifyOption && <label className="admin-check"><input type="checkbox" name="notify" defaultChecked />Email the client when the status changes to confirmed or cancelled</label>}
      <button type="submit" className="admin-button" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</button>
      <p className={`admin-message${state.ok === false || (state.message && !state.ok) ? ' error' : ''}`} role="status" aria-live="polite">{state.message}</p>
    </form>
  );
}
