const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTokens() {
  const { data } = await supabase.from('User').select('id, name, email, pushToken').not('pushToken', 'is', null);
  
  if (!data || data.length === 0) {
    console.log("No valid tokens found.");
    return;
  }

  const tokens = data.map(u => u.pushToken).filter(t => t.startsWith('ExponentPushToken'));
  console.log(`Sending test push to ${tokens.length} tokens...`);

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tokens.map(t => ({
      to: t,
      title: 'Diagnostic Push Test',
      body: 'This is a test from the backend diagnostic tool.',
      sound: 'default'
    }))),
  });

  const result = await response.json();
  console.log("Expo API Response:");
  console.dir(result, { depth: null });

  // Then check receipts if needed, but Expo's immediate response tells us formatting errors
}

testTokens();
