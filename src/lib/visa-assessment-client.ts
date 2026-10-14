import {
  assessmentFields,
  assessmentFieldIsActive,
  assessmentProfileEntries,
  assessmentGuidance,
  buildAssessmentEnquiry,
} from './visa-assessment';
import { validateEnquiryFields } from './enquiry-validation';

/** Attach the wizard to the Next.js client component.
 * @param form HTMLFormElement
 */
export function initVisaAssessment(form: HTMLFormElement): () => void {
  const events = new AbortController();
  const signal = events.signal;
  const panels = Array.from(form.querySelectorAll<HTMLElement>('[data-assessment-step]'));
  const progress = Array.from(form.querySelectorAll<HTMLLIElement>('.assessment-progress li'));
  const stepLabel = form.querySelector<HTMLElement>('[data-assessment-step-label]');
  const status = form.querySelector<HTMLElement>('[data-assessment-status]');
  const actions = form.querySelector<HTMLElement>('.assessment-actions');
  const back = form.querySelector<HTMLButtonElement>('[data-assessment-back]');
  const next = form.querySelector<HTMLButtonElement>('[data-assessment-next]');
  const complete = form.querySelector<HTMLElement>('[data-assessment-complete]');
  const service = form.elements.namedItem('service') as HTMLSelectElement | null;
  const serviceNames = new Set(
    service ? Array.from(service.options).filter((option) => option.value).map((option) => option.value) : []
  );
  let step = 0;
  let busy = false;

  const values = (): Record<string, string | boolean> => {
    const formData = new FormData(form);
    const obj: Record<string, string | boolean> = Object.fromEntries(Array.from(formData.entries(), ([key, value]) => [key, String(value)]));
    const consentEl = form.elements.namedItem('consent') as HTMLInputElement | null;
    obj.consent = consentEl ? consentEl.checked : false;
    return obj;
  };

  function fieldError(name: string, message: string) {
    const input = form.elements.namedItem(name) as HTMLElement | null;
    if (input) input.setAttribute('aria-invalid', String(Boolean(message)));
    const error = form.querySelector<HTMLElement>(`#assessment-${name}-error`);
    if (error) error.textContent = message || '';
  }

  function updateConditionalFields() {
    const profile = values();
    for (const field of assessmentFields) {
      const input = form.elements.namedItem(field.name) as HTMLInputElement | HTMLSelectElement | null;
      const active = assessmentFieldIsActive(field, profile);
      if (input) input.disabled = !active;
      const container = form.querySelector<HTMLElement>(`[data-profile-field="${field.name}"]`);
      if (container) container.hidden = !active;
      if (!active) fieldError(field.name, '');
    }
  }

  function renderSummary() {
    const profile = values();
    const guidanceEl = form.querySelector<HTMLElement>('[data-assessment-guidance]');
    if (guidanceEl) guidanceEl.textContent = assessmentGuidance(profile);
    const summary = form.querySelector<HTMLElement>('[data-assessment-summary]');
    if (summary) {
      summary.replaceChildren();
      for (const [label, value] of assessmentProfileEntries(profile)) {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        summary.append(dt, dd);
      }
    }
  }

  function showStep(index: number, focus = true) {
    step = index;
    panels.forEach((panel, i) => {
      panel.hidden = i !== step;
    });
    progress.forEach((item, i) => {
      if (i === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
      item.classList.toggle('is-done', i < step);
    });
    if (stepLabel) {
      stepLabel.textContent = `Step ${step + 1} of 3 · ${['Your plans', 'Your profile', 'Review & send'][step]}`;
    }
    if (back) back.hidden = step === 0;
    if (next) {
      const span = next.querySelector('span');
      if (span) span.textContent = step === 2 ? 'Send my profile' : 'Continue';
    }
    if (status) {
      status.textContent = '';
      status.classList.remove('error');
    }
    if (step === 2) renderSummary();
    if (focus) {
      const legend = panels[step]?.querySelector<HTMLElement>('legend');
      legend?.focus();
    }
  }

  function validateStep(index: number) {
    let firstInvalid: HTMLElement | null = null;
    const inputs = Array.from(panels[index]?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select') || []);
    for (const input of inputs) {
      if (input.disabled || input.name === 'website') continue;
      const valid = input.checkValidity();
      fieldError(input.name, valid ? '' : input.validationMessage);
      if (!valid && !firstInvalid) firstInvalid = input;
    }
    if (firstInvalid) {
      showStep(index, false);
      firstInvalid.focus();
      return false;
    }
    return true;
  }

  form.addEventListener(
    'input',
    (event) => {
      const target = event.target as HTMLInputElement | null;
      if (target?.name) fieldError(target.name, '');
    },
    { signal }
  );

  form.addEventListener('change', updateConditionalFields, { signal });

  back?.addEventListener(
    'click',
    () => {
      if (!busy) showStep(step - 1);
    },
    { signal }
  );

  const restartBtn = form.querySelector<HTMLElement>('[data-assessment-restart]');
  restartBtn?.addEventListener(
    'click',
    () => {
      form.reset();
      if (complete) complete.hidden = true;
      if (actions) actions.hidden = false;
      if (stepLabel) stepLabel.hidden = false;
      const progressEl = form.querySelector<HTMLElement>('.assessment-progress');
      if (progressEl) progressEl.hidden = false;
      form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
      form.querySelectorAll<HTMLElement>('.field-error').forEach((error) => (error.textContent = ''));
      updateConditionalFields();
      showStep(0);
    },
    { signal }
  );

  form.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();
      if (busy) return;
      updateConditionalFields();
      if (!validateStep(step)) return;
      if (step < 2) {
        showStep(step + 1);
        return;
      }
      for (let i = 0; i < 2; i++) {
        if (!validateStep(i)) return;
      }
      const { data, errors } = validateEnquiryFields(buildAssessmentEnquiry(values()), serviceNames);
      if (Object.keys(errors).length) {
        const [name, message] = Object.entries(errors)[0];
        fieldError(name, message);
        if (name === 'service') showStep(0, false);
        if (status) {
          status.textContent = message;
          status.classList.add('error');
        }
        const input = form.elements.namedItem(name) as HTMLElement | null;
        if (input && name !== 'website') input.focus();
        else status?.focus();
        return;
      }
      busy = true;
      if (next) next.disabled = true;
      if (back) back.disabled = true;
      form.setAttribute('aria-busy', 'true');
      const nextSpan = next?.querySelector('span');
      if (nextSpan) nextSpan.textContent = 'Sending profile…';
      if (status) {
        status.textContent = '';
        status.classList.remove('error');
      }

      try {
        const response = await fetch('/api/enquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, source: 'visa_assessment' }),
          signal,
        });
        const result = await response.json();
        if (!response.ok) {
          Object.entries(result.errors || {}).forEach(([name, message]) =>
            fieldError(name, message as string)
          );
          throw new Error(result.message || 'Your profile could not be saved. Please try again.');
        }
        const confirmEl = form.querySelector<HTMLElement>('[data-assessment-confirmation]');
        if (confirmEl) confirmEl.textContent = result.message;
        panels.forEach((panel) => {
          panel.hidden = true;
        });
        if (actions) actions.hidden = true;
        if (stepLabel) stepLabel.hidden = true;
        const progressEl = form.querySelector<HTMLElement>('.assessment-progress');
        if (progressEl) progressEl.hidden = true;
        if (complete) complete.hidden = false;
        if (status) {
          status.textContent = 'Profile saved.';
          status.focus();
        }
      } catch (error) {
        if (signal.aborted) return;
        if (status) {
          status.textContent =
            error instanceof TypeError
              ? 'Connection failed. Your profile was not confirmed. Please try again or email info@migrationfactor.com.'
              : error instanceof Error ? error.message : 'Unable to send your profile. Please try again.';
          status.classList.add('error');
          status.focus();
        }
      } finally {
        busy = false;
        if (next) next.disabled = false;
        if (back) back.disabled = false;
        form.removeAttribute('aria-busy');
        if (nextSpan) nextSpan.textContent = 'Send my profile';
      }
    },
    { signal }
  );

  fetch('/api/config', { signal })
    .then((response) => (response.ok ? response.json() : null))
    .then((config) => {
      if (!config || signal.aborted) return;
      const deliveryEl = form.querySelector<HTMLElement>('[data-assessment-delivery]');
      if (deliveryEl) {
        deliveryEl.textContent = config.deliveryConfigured
          ? 'Your profile is stored securely and sent to our team for review.'
          : 'Your profile can be saved on this server, but email delivery is not configured. For a direct response, email info@migrationfactor.com.';
      }
    })
    .catch(() => {});

  updateConditionalFields();
  showStep(0, false);
  return () => events.abort();
}
