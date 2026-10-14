'use client';

import React, { useEffect, useRef } from 'react';
import { services } from '@/content/services';
import { coaching } from '@/content/coaching';
import { company } from '@/content/company';
import { validateEnquiryFields } from '@/lib/enquiry-validation';

interface EnquiryFormProps {
  id?: string;
  entrance?: 'up' | 'down';
}

export default function EnquiryForm({ id = 'enquiry', entrance = 'down' }: EnquiryFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Pre-select service from URL query param
    const selectedService = new URLSearchParams(location.search).get('service');
    const form = formRef.current;
    if (!form) return;

    const serviceSelect = form.elements.namedItem('service') as HTMLSelectElement | null;
    if (selectedService && serviceSelect) {
      const opts = [...serviceSelect.options];
      if (opts.some((o) => o.value === selectedService)) {
        serviceSelect.value = selectedService;
      }
    }

    // Check delivery config
    fetch('/api/config')
      .then((r) => r.json())
      .then((config) => {
        if (config.deliveryConfigured) {
          form.querySelectorAll('.form-note').forEach((el) => {
            el.textContent =
              'Your details are stored securely and sent to our team. Please do not send sensitive documents.';
          });
        }
      })
      .catch(() => {});
  }, []);

  function fieldError(name: string, message: string) {
    const form = formRef.current;
    if (!form) return;
    const input = form.elements.namedItem(name) as HTMLInputElement | null;
    if (input) input.setAttribute('aria-invalid', String(Boolean(message)));
    const error = document.getElementById(`${id}-${name}-error`);
    if (error) error.textContent = message || '';
  }

  function handleInput(e: React.FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLInputElement;
    if (target.name) fieldError(target.name, '');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;

    const values = Object.fromEntries(new FormData(form));
    const serviceSelect = form.elements.namedItem('service') as HTMLSelectElement;
    const serviceNames = new Set(
      [...serviceSelect.options].filter((o) => o.value).map((o) => o.value)
    );

    const { data, errors } = validateEnquiryFields(
      { ...values, consent: (form.elements.namedItem('consent') as HTMLInputElement).checked },
      serviceNames
    );

    ['name', 'email', 'phone', 'service', 'message', 'consent'].forEach((name) =>
      fieldError(name, errors[name] || '')
    );

    const status = form.querySelector('.form-status') as HTMLElement | null;
    if (status) {
      status.textContent = '';
      status.classList.remove('error');
    }

    if (Object.keys(errors).length) {
      const firstKey = Object.keys(errors)[0];
      const invalid = form.elements.namedItem(firstKey) as HTMLElement | null;
      if (invalid) {
        invalid.focus();
      } else if (status) {
        status.textContent = errors.form || '';
        status.classList.add('error');
        status.focus();
      }
      return;
    }

    const submit = form.querySelector('[type=submit]') as HTMLButtonElement | null;
    const submitSpan = submit?.querySelector('span');
    if (submit) submit.disabled = true;
    if (submitSpan) submitSpan.textContent = 'Saving enquiry…';
    form.setAttribute('aria-busy', 'true');

    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        Object.entries(result.errors || {}).forEach(([name, message]) =>
          fieldError(name, message as string)
        );
        throw new Error(result.message || 'Your enquiry could not be saved. Please try again.');
      }
      if (status) status.textContent = result.message;
      form.reset();
      status?.focus();
    } catch (error) {
      if (status) {
        status.textContent =
          error instanceof TypeError
            ? 'Connection failed. Your enquiry was not confirmed. Please try again or email info@migrationfactor.com.'
            : (error as Error).message;
        status.classList.add('error');
        status.focus();
      }
    } finally {
      if (submit) submit.disabled = false;
      if (submitSpan) submitSpan.textContent = 'Submit enquiry';
      form.removeAttribute('aria-busy');
    }
  }

  const allServices = [...services.map((s) => s.name), ...coaching.map((c) => c.name)];

  return (
    <form
      ref={formRef}
      className={`enquiry-form reveal${entrance === 'down' ? ' reveal-down' : ''}`}
      style={{ '--delay': entrance === 'up' ? '200ms' : '0ms' } as React.CSSProperties}
      id={id}
      action="/api/enquiries"
      method="post"
      noValidate
      onInput={handleInput}
      onSubmit={handleSubmit}
    >
      <span className="eyebrow">LET&apos;S TALK ABOUT YOUR PLANS</span>
      <h2>Request an eligibility assessment</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${id}-name`}>
            Full name <span aria-hidden="true">*</span>
          </label>
          <input
            id={`${id}-name`}
            name="name"
            autoComplete="name"
            required
            maxLength={100}
            aria-describedby={`${id}-name-error`}
          />
          <span className="field-error" id={`${id}-name-error`} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-email`}>
            Email address <span aria-hidden="true">*</span>
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            aria-describedby={`${id}-email-error`}
          />
          <span className="field-error" id={`${id}-email-error`} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-phone`}>
            Phone <span className="optional">(optional)</span>
          </label>
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            aria-describedby={`${id}-phone-error`}
          />
          <span className="field-error" id={`${id}-phone-error`} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-service`}>
            I&apos;m interested in <span aria-hidden="true">*</span>
          </label>
          <select
            id={`${id}-service`}
            name="service"
            required
            aria-describedby={`${id}-service-error`}
          >
            <option value="">Choose a service</option>
            {allServices.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <span className="field-error" id={`${id}-service-error`} />
        </div>
        <div className="field full">
          <label htmlFor={`${id}-message`}>
            Tell us about your plans <span aria-hidden="true">*</span>
          </label>
          <textarea
            id={`${id}-message`}
            name="message"
            rows={3}
            required
            minLength={10}
            maxLength={3000}
            aria-describedby={`${id}-message-error`}
          />
          <span className="field-error" id={`${id}-message-error`} />
        </div>
      </div>
      <div className="honey" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="consent" htmlFor={`${id}-consent`}>
        <input
          id={`${id}-consent`}
          type="checkbox"
          name="consent"
          required
          aria-describedby={`${id}-consent-error`}
        />
        <span>
          I agree to have my details stored to handle this enquiry. Please do not include passport
          numbers or sensitive documents.
        </span>
      </label>
      <span className="field-error" id={`${id}-consent-error`} />
      <p className="form-note">
        Your details are used only to respond to your enquiry. Please do not send sensitive documents.
      </p>
      <button className="button" type="submit">
        <span>Submit enquiry</span>
      </button>
      <div className="form-status" role="status" aria-live="polite" tabIndex={-1} />
      <noscript>
        <p>
          Enable JavaScript for the enquiry form, or email{' '}
          <a href={`mailto:${company.email}`}>{company.email}</a>.
        </p>
      </noscript>
    </form>
  );
}
