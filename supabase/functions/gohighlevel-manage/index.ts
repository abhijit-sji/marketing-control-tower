import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encryptValue, decryptValue } from '../_shared/encryption.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

async function getClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    auth: { persistSession: false },
  });
}

async function requireAuth(client: any): Promise<string | null> {
  const { data: { user } } = await client.auth.getUser();
  return user?.id || null;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  console.log(`[gohighlevel-manage:${requestId}] Request started`, {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const client = await getClient(req);
  const userId = await requireAuth(client);

  if (!userId) {
    console.warn(`[gohighlevel-manage:${requestId}] Unauthorized access attempt`, {
      duration: Date.now() - startTime
    });
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  try {
    if (req.method === 'GET') {
      console.log(`[gohighlevel-manage:${requestId}] Fetching integration status`, { userId });
      
      // Get current GoHighLevel configuration for the user
      const { data: config, error } = await client
        .from('gohighlevel_integrations')
        .select('location_id, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      const response = {
        ok: true,
        configured: !!config,
        locationId: config?.location_id || '',
        enabled: config?.is_active || false
      };

      console.log(`[gohighlevel-manage:${requestId}] Request completed successfully`, {
        duration: Date.now() - startTime,
        configured: response.configured
      });

      return new Response(JSON.stringify(response), { headers: corsHeaders });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { action, apiKey, locationId } = body;

      console.log(`[gohighlevel-manage:${requestId}] POST action received`, { 
        userId, 
        action, 
        hasApiKey: !!apiKey,
        hasLocationId: !!locationId
      });

      if (action === 'test') {
        // Test GoHighLevel connection
        if (!apiKey) {
          console.warn(`[gohighlevel-manage:${requestId}] Test action missing API key`);
          return new Response(JSON.stringify({ ok: false, error: 'API key required' }), 
            { status: 400, headers: corsHeaders });
        }

        try {
          const testUrl = 'https://services.leadconnectorhq.com/locations/';
          const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Connection failed (${response.status})`);
          }

          console.log(`[gohighlevel-manage:${requestId}] Test action completed successfully`, {
            duration: Date.now() - startTime
          });

          return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        } catch (error) {
          console.error(`[gohighlevel-manage:${requestId}] Test action failed`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - startTime
          });
          return new Response(JSON.stringify({ 
            ok: false, 
            error: error instanceof Error ? error.message : 'Connection test failed' 
          }), { status: 400, headers: corsHeaders });
        }
      }

      if (action === 'save') {
        if (!apiKey) {
          console.warn(`[gohighlevel-manage:${requestId}] Save action missing API key`);
          return new Response(JSON.stringify({ ok: false, error: 'API key required' }), 
            { status: 400, headers: corsHeaders });
        }

        // First test the connection
        try {
          const testUrl = 'https://services.leadconnectorhq.com/locations/';
          const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Connection failed (${response.status})`);
          }
        } catch (error) {
          console.error(`[gohighlevel-manage:${requestId}] Save action connection test failed`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return new Response(JSON.stringify({ 
            ok: false, 
            error: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }), { status: 400, headers: corsHeaders });
        }

        // Deactivate existing integrations
        await client
          .from('gohighlevel_integrations')
          .update({ is_active: false })
          .eq('user_id', userId);

        // Encrypt the API key before storing
        const encryptedApiKey = await encryptValue(apiKey);

        // Save new integration
        const { error: saveError } = await client
          .from('gohighlevel_integrations')
          .insert({
            user_id: userId,
            api_key_encrypted: encryptedApiKey,
            location_id: locationId || null,
            is_active: true
          });

        if (saveError) throw saveError;

        console.log(`[gohighlevel-manage:${requestId}] Save action completed successfully`, {
          duration: Date.now() - startTime,
          hasLocationId: !!locationId
        });

        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      if (action === 'sync-contacts') {
        // Sync contacts from GoHighLevel
        const { data: integration, error: integrationError } = await client
          .from('gohighlevel_integrations')
          .select('id, api_key_encrypted, location_id')
          .eq('user_id', userId)
          .eq('is_active', true)
          .single();

        if (integrationError || !integration) {
          return new Response(JSON.stringify({ ok: false, error: 'Integration not found' }), 
            { status: 404, headers: corsHeaders });
        }

        try {
          // Decrypt the API key before using it
          const decryptedApiKey = await decryptValue(integration.api_key_encrypted);

          const contactsUrl = integration.location_id
            ? `https://services.leadconnectorhq.com/contacts/?locationId=${integration.location_id}`
            : 'https://services.leadconnectorhq.com/contacts/';

          const response = await fetch(contactsUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${decryptedApiKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to sync contacts (${response.status})`);
          }

          const data = await response.json();
          const contacts = data.contacts || [];

          // Store contacts in database
          const contactsToInsert = contacts.map((contact: any) => ({
            integration_id: integration.id,
            contact_id: contact.id,
            name: contact.name || contact.firstName + ' ' + contact.lastName,
            email: contact.email,
            phone: contact.phone,
            status: contact.tags ? contact.tags.join(',') : null
          }));

          if (contactsToInsert.length > 0) {
            // Delete existing contacts for this integration
            await client
              .from('gohighlevel_contacts')
              .delete()
              .eq('integration_id', integration.id);

            // Insert new contacts
            const { error: insertError } = await client
              .from('gohighlevel_contacts')
              .insert(contactsToInsert);

            if (insertError) throw insertError;
          }

          console.log(`[gohighlevel-manage:${requestId}] Sync action completed successfully`, {
            duration: Date.now() - startTime,
            syncedContacts: contactsToInsert.length
          });

          return new Response(JSON.stringify({ 
            ok: true, 
            synced: contactsToInsert.length 
          }), { headers: corsHeaders });
        } catch (error) {
          console.error(`[gohighlevel-manage:${requestId}] Sync action failed`, {
            error: error instanceof Error ? {
              message: error.message,
              stack: error.stack
            } : error,
            duration: Date.now() - startTime
          });
          return new Response(JSON.stringify({ 
            ok: false, 
            error: error instanceof Error ? error.message : 'Contact sync failed' 
          }), { status: 500, headers: corsHeaders });
        }
      }
    }

    console.warn(`[gohighlevel-manage:${requestId}] Unsupported action`, {
      method: req.method,
      duration: Date.now() - startTime
    });

    return new Response(JSON.stringify({ error: 'Unsupported action' }), 
      { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error(`[gohighlevel-manage:${requestId}] Unexpected failure`, {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error,
      duration: Date.now() - startTime
    });
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), { status: 500, headers: corsHeaders });
  }
});