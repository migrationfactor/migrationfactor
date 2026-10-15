'use client';
import { useEffect,useRef,useState } from 'react';
import Icon from '@/components/ui/Icon';
import { company } from '@/content/company';
import { validateCommunication } from '@/lib/leads/communication';

/** Saves website email enquiries before the team notification is attempted. */
export default function EmailEnquiryDialog() {
 const dialog=useRef<HTMLDialogElement>(null);
 const visitorId=useRef('');
 const previousFocus=useRef<HTMLElement|null>(null);
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[message,setMessage]=useState('');
 const [consent,setConsent]=useState(false),[pending,setPending]=useState(false);
 const [errors,setErrors]=useState<Record<string,string>>({});
 const [result,setResult]=useState('');
 const nameInput=useRef<HTMLInputElement>(null);
 const honey=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  const open=(event:MouseEvent)=>{
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const link=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;
   if(!link||!link.href.toLowerCase().startsWith('mailto:'+company.email.toLowerCase()))return;
   event.preventDefault();previousFocus.current=link;
   // Allow a header drawer's close handler to run before opening a new modal.
   requestAnimationFrame(()=>{if(dialog.current&&!dialog.current.open){dialog.current.showModal();nameInput.current?.focus();}});
  };
  document.addEventListener('click',open,true);return()=>document.removeEventListener('click',open,true);
 },[]);
 async function submit(event:React.FormEvent) {
  event.preventDefault();if(pending)return;
  visitorId.current ||= crypto.randomUUID();
  const payload={channel:'email',visitorId:visitorId.current,name,email,phone,message,topic:'',consent,website:honey.current?.value||''};
  const checked=validateCommunication(payload);setErrors(checked.errors);
  if(Object.keys(checked.errors).length)return;
  setPending(true);
  try{
   const response=await fetch('/api/communication-leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const body=await response.json().catch(()=>({}));
   if(!response.ok||!body.id){setErrors(body.errors||{form:body.message||'Your enquiry could not be saved. Please try again.'});return;}
   setResult('Your enquiry has been saved for our team. Reference: '+body.reference);
  }catch{setErrors({form:'Connection failed. Your enquiry was not saved. Please try again.'});}
  finally{setPending(false);}
 }
 return <dialog ref={dialog} className="email-enquiry-dialog" aria-labelledby="email-enquiry-title"
  onClose={()=>previousFocus.current?.focus()} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}>
  <div className="email-enquiry-content">
   <div className="whatsapp-panel-head"><p className="whatsapp-panel-eyebrow"><Icon type="mail"/>Email our team</p>
    <h2 id="email-enquiry-title">How can we help?</h2><p>{company.email}</p>
    <button type="button" className="whatsapp-panel-close" aria-label="Close email enquiry" onClick={()=>dialog.current?.close()}>×</button>
   </div>
   {result?<div className="email-enquiry-form"><p role="status">{result}</p><button className="whatsapp-start" onClick={()=>dialog.current?.close()}>Done</button></div>:
   <form className="email-enquiry-form" onSubmit={submit} noValidate>
    <label htmlFor="email-lead-name">Your name</label><input ref={nameInput} id="email-lead-name" autoComplete="name" maxLength={100} value={name} onChange={e=>setName(e.target.value)} required aria-invalid={!!errors.name}/>{errors.name&&<p className="whatsapp-error">{errors.name}</p>}
    <label htmlFor="email-lead-email">Your email address</label><input id="email-lead-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} required aria-invalid={!!errors.email}/>{errors.email&&<p className="whatsapp-error">{errors.email}</p>}
    <label htmlFor="email-lead-phone">Phone number (optional)</label><input id="email-lead-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)} aria-invalid={!!errors.phone}/>{errors.phone&&<p className="whatsapp-error">{errors.phone}</p>}
    <label htmlFor="email-lead-message">Your enquiry</label><textarea id="email-lead-message" rows={4} maxLength={3000} value={message} onChange={e=>setMessage(e.target.value)} required aria-invalid={!!errors.message}/>{errors.message&&<p className="whatsapp-error">{errors.message}</p>}
    <div className="honey" aria-hidden="true"><label>Website<input ref={honey} name="website" tabIndex={-1} autoComplete="off"/></label></div>
    <label className="email-enquiry-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/>I agree to have my details stored to handle this enquiry. Please do not include passport numbers or sensitive documents.</label>
    {errors.consent&&<p className="whatsapp-error">{errors.consent}</p>}
    <p className="whatsapp-error" role="alert">{errors.form}</p>
    <button className="whatsapp-start" disabled={pending}><Icon type="mail"/>{pending?'Saving enquiry…':'Send enquiry'}</button>
   </form>}
  </div>
 </dialog>;
}
