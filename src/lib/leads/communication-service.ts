import 'server-only';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { detailEmail, notificationRecipient, sendEmail } from '@/lib/email/resend';
import { normalisePhone, type CommunicationInput, type CommunicationChannel, type CommunicationSource } from './communication';

const hash = (...parts: string[]) => createHash('sha256').update(parts.join('\0')).digest('hex');
export interface IncomingCommunication {
 channel: CommunicationChannel; identity: string; name: string; email?: string; phone?: string; topic?: string;
 source: CommunicationSource; body: string; subject?: string; eventKey: string; receivedAt: string; consent: boolean;
}
export async function persistCommunication(data: IncomingCommunication) {
 const db = createServiceClient();
 const {data: rows,error} = await db.rpc('save_communication',{
  p_channel:data.channel,p_identity:data.identity,p_name:data.name,p_email:data.email||null,p_phone:data.phone||null,
  p_topic:data.topic||null,p_source:data.source,p_body:data.body,p_subject:data.subject||null,p_event_key:data.eventKey,
  p_kind:data.source.endsWith('_inbound')?'received_message':'website_request',p_consent:data.consent,p_received_at:data.receivedAt,
 });
 if(error || !rows?.[0]?.lead_id) throw new Error('Communication could not be saved.');
 const result=rows[0] as {lead_id:string;is_duplicate:boolean;is_new:boolean};
 if(!result.is_duplicate) {
  const label=data.channel==='email'?'Email':'WhatsApp';
  const mail=detailEmail((result.is_new?'New ':'Returning ')+label+' enquiry', [['Name',data.name],['Email',data.email||''],['Phone',data.phone||''],['Topic',data.topic||''],['Enquiry',data.body]],
   data.source==='whatsapp_form'?'Website enquiry saved. Opening WhatsApp does not confirm that a message was sent.':'Open the admin panel to manage this enquiry.');
  const outcome=await sendEmail({to:notificationRecipient(),subject:(result.is_new?'New ':'Returning ')+label+' enquiry — '+data.name,...mail,...(data.email?{replyTo:data.email}:{})});
  const {error: updateError}=await db.from('communication_leads').update({notification_status:outcome}).eq('id',result.lead_id);
  if(updateError) console.warn('Communication notification status was not recorded.');
 }
 return {id:result.lead_id,reference:'MF-'+result.lead_id.slice(0,8).toUpperCase(),duplicate:result.is_duplicate};
}
/**
 * One lead per WhatsApp number or email address; each website request is added to its history.
 * A repeated click on the same day with the same details is recorded once.
 */
export function saveWebsiteCommunication(data: CommunicationInput) {
 const source=data.channel==='email'?'email_form':'whatsapp_form';
 const phone=data.phone?normalisePhone(data.phone):'';
 const identity=data.channel==='email'?hash('email',data.email):hash('whatsapp',phone);
 const body=data.channel==='email'?data.message:'Website WhatsApp enquiry'+(data.topic?': '+data.topic:'. Topic not selected.');
 const day=new Date().toISOString().slice(0,10);
 return persistCommunication({channel:data.channel,identity,name:data.name,
  email:data.channel==='email'?data.email:undefined,phone:phone||undefined,topic:data.topic,source,body,
  eventKey:hash(source,identity,data.name,data.topic,body,day),receivedAt:new Date().toISOString(),consent:data.consent});
}
