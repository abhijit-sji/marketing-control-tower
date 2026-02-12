import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  console.log('[HubSpot Sync] Function invoked');
  console.log('[HubSpot Sync] Method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[HubSpot Sync] Parsing request body...');
    const body = await req.json();
    const { action, searchTerm, companyId, clientId, hubspotId } = body;
    
    console.log('[HubSpot Sync] Action:', action);
    console.log('[HubSpot Sync] Request params:', { searchTerm, companyId, clientId, hubspotId });
    
    const hubspotToken = Deno.env.get('Hubspot_Access_token');
    if (!hubspotToken) {
      console.error('[HubSpot Sync] ERROR: HubSpot access token not configured');
      throw new Error('HubSpot access token not configured');
    }
    console.log('[HubSpot Sync] HubSpot token loaded successfully');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[HubSpot Sync] Processing action: ${action}`);

    // Search companies by name
    if (action === 'search_companies') {
      console.log('[HubSpot Sync] Searching companies with term:', searchTerm);
      
      const response = await fetch(
        `https://api.hubapi.com/crm/v3/objects/companies/search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hubspotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filterGroups: [{
              filters: [{
                propertyName: 'name',
                operator: 'CONTAINS_TOKEN',
                value: searchTerm
              }]
            }],
            properties: [
              'name', 'domain', 'industry', 'city', 'state', 'country',
              'website', 'phone', 'annualrevenue', 'numberofemployees',
              'founded_year', 'description', 'type'
            ],
            limit: 20
          })
        }
      );

      console.log('[HubSpot Sync] HubSpot API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[HubSpot Sync] HubSpot API error:', response.status, errorText);
        throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[HubSpot Sync] Found', data.results?.length || 0, 'companies');
      
      return new Response(JSON.stringify(data.results || []), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch company by ID
    if (action === 'fetch_company_by_id') {
      let actualCompanyId = companyId;

      // Try to fetch as contact first, resolve to company
      try {
        const contactResponse = await fetch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${companyId}?properties=associatedcompanyid`,
          {
            headers: { 'Authorization': `Bearer ${hubspotToken}` }
          }
        );

        if (contactResponse.ok) {
          const contactData = await contactResponse.json();
          if (contactData.properties.associatedcompanyid) {
            actualCompanyId = contactData.properties.associatedcompanyid;
            console.log(`Resolved contact ${companyId} to company ${actualCompanyId}`);
          }
        }
      } catch (error) {
        console.log('Not a contact, treating as company ID');
      }

      // Fetch company details
      const companyResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/companies/${actualCompanyId}?properties=name,domain,industry,city,state,country,website,phone,annualrevenue,numberofemployees,founded_year,description,type,address,zip`,
        {
          headers: { 'Authorization': `Bearer ${hubspotToken}` }
        }
      );

      if (!companyResponse.ok) {
        throw new Error(`Company not found: ${companyResponse.statusText}`);
      }

      const companyData = await companyResponse.json();

      // Fetch associated contacts
      const contactsResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/companies/${actualCompanyId}/associations/contacts`,
        {
          headers: { 'Authorization': `Bearer ${hubspotToken}` }
        }
      );

      let contacts = [];
      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json();
        const contactIds = contactsData.results?.map((r: any) => r.id) || [];

        if (contactIds.length > 0) {
          const contactDetailsResponse = await fetch(
            `https://api.hubapi.com/crm/v3/objects/contacts/batch/read`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${hubspotToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                properties: ['firstname', 'lastname', 'email', 'phone', 'jobtitle', 'lifecyclestage', 'hs_lead_status'],
                inputs: contactIds.map((id: string) => ({ id }))
              })
            }
          );

          if (contactDetailsResponse.ok) {
            const contactDetailsData = await contactDetailsResponse.json();
            contacts = contactDetailsData.results || [];
          }
        }
      }

      return new Response(JSON.stringify({ company: companyData, contacts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Import company with contacts
    if (action === 'import_company') {
      const { company, contacts } = body;
      const props = company.properties;

      // Map HubSpot company to client
      const clientData = {
        name: props.name || 'Unknown Company',
        company: props.name,
        email: props.email || null,
        phone: props.phone || null,
        website: props.website || props.domain || null,
        address: props.address || null,
        city: props.city || null,
        state: props.state || null,
        country: props.country || null,
        industry: props.industry || null,
        company_revenue: props.annualrevenue ? parseFloat(props.annualrevenue) : null,
        team_size: props.numberofemployees ? parseInt(props.numberofemployees) : null,
        founded_year: props.founded_year ? parseInt(props.founded_year) : null,
        notes: props.description || null,
        status: 'active',
        source: 'hubspot',
        hubspot_id: company.id,
        hubspot_sync_status: 'synced',
        hubspot_last_sync: new Date().toISOString(),
        hubspot_sync_metadata: { type: props.type || null }
      };

      // Upsert client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .upsert(clientData, { onConflict: 'hubspot_id' })
        .select()
        .single();

      if (clientError) throw clientError;

      // Import contacts
      if (contacts && contacts.length > 0) {
        const contactsData = contacts.map((contact: any) => ({
          client_id: client.id,
          hubspot_id: contact.id,
          first_name: contact.properties.firstname || null,
          last_name: contact.properties.lastname || null,
          email: contact.properties.email || null,
          phone: contact.properties.phone || null,
          job_title: contact.properties.jobtitle || null,
          lifecycle_stage: contact.properties.lifecyclestage || null,
          lead_status: contact.properties.hs_lead_status || null,
          hubspot_sync_status: 'synced',
          hubspot_last_sync: new Date().toISOString()
        }));

        const { error: contactsError } = await supabase
          .from('contacts')
          .upsert(contactsData, { onConflict: 'hubspot_id' });

        if (contactsError) console.error('Contact import error:', contactsError);
      }

      return new Response(JSON.stringify({ success: true, client }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Sync existing client
    if (action === 'sync_client') {
      const { data: client } = await supabase
        .from('clients')
        .select('hubspot_id')
        .eq('id', clientId)
        .single();

      if (!client?.hubspot_id) {
        throw new Error('Client not linked to HubSpot');
      }

      // Re-fetch and update (similar to import)
      const companyResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/companies/${client.hubspot_id}?properties=name,domain,industry,city,state,country,website,phone,annualrevenue,numberofemployees,founded_year,description,type,address,zip`,
        {
          headers: { 'Authorization': `Bearer ${hubspotToken}` }
        }
      );

      if (!companyResponse.ok) {
        throw new Error('Failed to sync from HubSpot');
      }

      const companyData = await companyResponse.json();
      const props = companyData.properties;

      const { error } = await supabase
        .from('clients')
        .update({
          name: props.name || (client as any).name,
          company: props.name,
          phone: props.phone || null,
          website: props.website || props.domain || null,
          address: props.address || null,
          city: props.city || null,
          state: props.state || null,
          country: props.country || null,
          industry: props.industry || null,
          company_revenue: props.annualrevenue ? parseFloat(props.annualrevenue) : null,
          team_size: props.numberofemployees ? parseInt(props.numberofemployees) : null,
          notes: props.description || null,
          hubspot_sync_status: 'synced',
          hubspot_last_sync: new Date().toISOString()
        })
        .eq('id', clientId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Link existing client to HubSpot
    if (action === 'link_client') {
      const { error } = await supabase
        .from('clients')
        .update({
          hubspot_id: hubspotId,
          hubspot_sync_status: 'synced',
          hubspot_last_sync: new Date().toISOString(),
          source: 'manual'
        })
        .eq('id', clientId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('[HubSpot Sync] ERROR:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[HubSpot Sync] Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    
    return new Response(JSON.stringify({ 
      error: err.message,
      details: err.toString()
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
