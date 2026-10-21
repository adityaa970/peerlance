import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { safeRole } from '@/lib/roles';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    })
  }

  // Verify against the raw body: re-serialising parsed JSON can change bytes and break the signature.
  const body = await req.text()

  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400,
    })
  }

  if (evt.type === 'user.created') {
    const { id, email_addresses, first_name, last_name, primary_email_address_id, unsafe_metadata } = evt.data
    const emailObj = email_addresses.find(e => e.id === primary_email_address_id)
    const email = emailObj?.email_address || ''
    
    const md = (unsafe_metadata || {}) as Record<string, unknown>;
    // unsafeMetadata is editable by the client, so never trust it for 'admin'.
    const role = safeRole(md.role);
    const idCardUrl = typeof md.idCardUrl === 'string' ? md.idCardUrl : null;
    const collegeName = typeof md.collegeName === 'string' ? md.collegeName : 'Unknown';
    const collegeDomain = 'manual_selection';
    
    try {
      const { error } = await supabase.from('User').insert({
        id: crypto.randomUUID(),
        clerkId: id,
        email,
        name: `${first_name || ''} ${last_name || ''}`.trim(),
        college: collegeName,
        collegeDomain,
        isVerified: false,
        isActive: false,
        role: role,
        idCardUrl: idCardUrl,
      });
      
      // If user already exists (duplicate key), just ignore since sync route probably handled it
      if (error && error.code === '23505') {
        console.log('Skipping webhook insert, user already exists in DB');
        return new Response('User exists', { status: 200 })
      } else if (error) {
        throw new Error(error.message);
      }

      return new Response('User created in db', { status: 201 })
    } catch (e) {
      console.error(e)
      return new Response('Error saving user', { status: 500 })
    }
  }

  return new Response('', { status: 200 })
}
