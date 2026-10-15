import { NextRequest } from 'next/server';
import { readPublicJson, jsonResponse } from '@/lib/api-guard';
import { supabaseConfigured } from '@/lib/supabase/config';
import { validateCommunication } from '@/lib/leads/communication';
import { saveWebsiteCommunication } from '@/lib/leads/communication-service';
export async function POST(request: NextRequest) {
 try {
  const parsed=await readPublicJson(request,'communication-leads',20);
  if('response' in parsed) return parsed.response;
  const {data,errors}=validateCommunication(parsed.input);
  if(!data||Object.keys(errors).length) return jsonResponse({message:'Please check your details.',errors},422);
  if(!supabaseConfigured()) return jsonResponse({message:'Your enquiry could not be saved right now. Please try again or contact our team directly.'},503);
  const saved=await saveWebsiteCommunication(data);
  return jsonResponse({...saved,message:'Your enquiry has been saved for our team.'},201);
 }catch{
  console.error('Communication enquiry save failed.');
  return jsonResponse({message:'Your enquiry could not be saved. Please try again.'},500);
 }
}
