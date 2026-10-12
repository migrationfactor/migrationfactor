import { services } from '@/content/services';
import { assessmentFields, AssessmentField } from '@/lib/visa-assessment';

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

const stepTitles = ['Your plans', 'Your profile', 'Review & send'];

function profileField(field: AssessmentField) {
  const id = `assessment-${field.name}`;
  const options = field.name === 'service' ? services.map((service) => service.name) : field.options;
  const attributes = `id="${id}" name="${field.name}" ${field.required ? 'required' : ''} aria-describedby="${id}-error"`;
  const input = options
    ? `<select ${attributes}><option value="">${field.required ? 'Choose an option' : 'Choose if applicable'}</option>${options
        .map((option) => `<option value="${esc(option)}">${esc(option)}</option>`)
        .join('')}</select>`
    : `<input ${attributes} type="text" maxlength="${field.max}" ${
        field.autocomplete ? `autocomplete="${field.autocomplete}"` : ''
      } placeholder="${esc(field.placeholder)}">`;
  return `<div class="field${field.name === 'service' || field.name === 'visaStatus' ? ' full' : ''}" data-profile-field="${
    field.name
  }"${field.when ? ' hidden' : ''}><label for="${id}">${esc(field.label)}${
    field.required ? ' <span aria-hidden="true">*</span>' : ''
  }</label>${input}<span class="field-error" id="${id}-error"></span></div>`;
}

function contactField(
  name: string,
  label: string,
  type: string,
  required: boolean,
  max: number,
  autocomplete: string
) {
  const id = `assessment-${name}`;
  return `<div class="field${name === 'phone' ? ' full' : ''}"><label for="${id}">${label}${
    required ? ' <span aria-hidden="true">*</span>' : ''
  }</label><input id="${id}" name="${name}" type="${type}" ${required ? 'required' : ''} ${
    name === 'name' ? 'minlength="2"' : ''
  } maxlength="${max}" autocomplete="${autocomplete}" aria-describedby="${id}-error"><span class="field-error" id="${id}-error"></span></div>`;
}

export function visaAssessment() {
  return `<section class="section visa-assessment-section" id="visa-assessment" aria-labelledby="assessment-heading"><div class="container assessment-layout">
 <div class="assessment-intro"><span class="eyebrow light">A CLEARER FIRST STEP</span><h2 id="assessment-heading">2-minute<br>Visa Assessment</h2><p>Tell us a little about your plans. Get a clear profile summary and send it to our team for a personal review.</p><ul class="assessment-benefits"><li>Simple questions, one step at a time</li><li>See your summary before you send</li><li>No documents needed to get started</li></ul><div class="assessment-intro-note"><span aria-hidden="true">↗</span><p>Your next chapter starts with a conversation.</p></div></div>
 <form class="assessment-form" id="visa-assessment-form" data-visa-assessment action="/api/enquiries" method="post" novalidate>
 <ol class="assessment-progress" aria-label="Assessment steps">${stepTitles
   .map((title, i) => `<li${i === 0 ? ' aria-current="step"' : ''}><span aria-hidden="true">0${i + 1}</span>${title}</li>`)
   .join('')}</ol>
 <p class="assessment-step-label" data-assessment-step-label aria-live="polite">Step 1 of 3 · Your plans</p>
 ${stepTitles
   .map(
     (title, i) =>
       `<fieldset data-assessment-step="${i}"${i ? ' hidden' : ''}><legend tabindex="-1">${
         i === 0 ? 'Where would you like to go?' : i === 1 ? 'A little about your background' : 'Your profile is ready for review'
       }</legend>${
         i < 2
           ? `<p class="assessment-help">${
               i === 0 ? 'Choose your goal and the destination you have in mind.' : 'Share your basic details so our team can understand your starting point.'
             }</p><div class="form-grid">${assessmentFields
               .filter((field) => field.step === i)
               .map(profileField)
               .join('')}</div>`
           : `<div class="assessment-summary"><p data-assessment-guidance></p><dl data-assessment-summary></dl><p class="assessment-summary-note">This is a profile summary, not an eligibility decision or visa approval guarantee. A consultant needs to review your circumstances.</p></div><p class="assessment-help">Send your profile for a personal review.</p><div class="form-grid">${contactField(
               'name',
               'Full name',
               'text',
               true,
               100,
               'name'
             )}${contactField('email', 'Email address', 'email', true, 254, 'email')}${contactField(
               'phone',
               'Phone (optional)',
               'tel',
               false,
               40,
               'tel'
             )}</div><div class="honey" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="consent" for="assessment-consent"><input id="assessment-consent" name="consent" type="checkbox" required aria-describedby="assessment-consent-error"><span>I agree to have my profile and contact details stored to handle this enquiry. Please do not include passport numbers or sensitive documents.</span></label><span class="field-error" id="assessment-consent-error"></span><p class="assessment-delivery-note" data-assessment-delivery>Online delivery has not been confirmed. You can also contact <a href="mailto:info@migrationfactor.com">info@migrationfactor.com</a> directly.</p>`
       }</fieldset>`
   )
   .join('')}
 <div class="assessment-actions"><button type="button" class="assessment-back" data-assessment-back hidden>← Back</button><button type="submit" class="button" data-assessment-next><span>Continue</span></button></div>
 <div class="assessment-status" role="status" aria-live="polite" tabindex="-1" data-assessment-status></div>
 <div class="assessment-complete" data-assessment-complete hidden><h3>Thank you for sharing your profile</h3><p data-assessment-confirmation></p><a class="text-link" href="/contact/">Contact our team ↗</a><button type="button" class="assessment-back" data-assessment-restart>Start a new assessment</button></div>
 <noscript><p>Please enable JavaScript to use the assessment, or <a class="text-link" href="/contact/">contact our team</a>.</p></noscript>
 </form></div></section>`;
}
