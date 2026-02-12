import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { propertyId, brandId, startDate = '30daysAgo', endDate = 'today' } = await req.json();

    let effectivePropertyId: string | undefined = propertyId;
    let credentials: any | null = null;

    // Try brand-specific credentials first with priority order
    if (brandId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && serviceRoleKey) {
          const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
          const { data: integrationRows, error: integrationError } = await supabaseAdmin
            .from('brand_analytics_integrations')
            .select('service_account_key_encrypted, ga4_property_id, is_active, integration_type')
            .eq('brand_id', brandId)
            .in('integration_type', ['google_analytics', 'ga4', 'n8n_analytics'])
            .eq('is_active', true);

          if (integrationError) {
            console.error('Failed to load brand GA config:', integrationError);
          }

          // Pick the best integration row based on priority and data completeness
          let integrationRow = null;
          if (integrationRows && integrationRows.length > 0) {
            // Priority: google_analytics > ga4 > n8n_analytics
            const priorityOrder = ['google_analytics', 'ga4', 'n8n_analytics'];
            integrationRow = integrationRows
              .filter(r => r.service_account_key_encrypted && r.ga4_property_id)
              .sort((a, b) => {
                const aIndex = priorityOrder.indexOf(a.integration_type);
                const bIndex = priorityOrder.indexOf(b.integration_type);
                return aIndex - bIndex;
              })[0] || integrationRows[0];
            
            console.log(`Using integration_type="${integrationRow.integration_type}" for brand ${brandId}`);
          }

          if (integrationRow?.service_account_key_encrypted) {
            try {
              credentials = JSON.parse(integrationRow.service_account_key_encrypted as string);
              console.log(`Loaded credentials for service account: ${credentials.client_email}`);
            } catch (e) {
              console.error('Invalid stored service account JSON for brand:', e);
            }
            if (!effectivePropertyId && integrationRow?.ga4_property_id) {
              effectivePropertyId = integrationRow.ga4_property_id as string;
            }
          }
        }
      } catch (e) {
        console.error('Error while resolving brand-specific GA credentials:', e);
      }
    }

    // Fallback to project-level secret
    if (!credentials) {
      const serviceAccountKey = Deno.env.get('GOOGLE_ANALYTICS_SERVICE_ACCOUNT_KEY');
      if (!serviceAccountKey) {
        console.error('Service account key not configured');
        return new Response(
          JSON.stringify({ error: 'Service account not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      credentials = JSON.parse(serviceAccountKey);
    }

    if (!effectivePropertyId) {
      return new Response(
        JSON.stringify({ error: 'Property ID is required (none provided and no brand mapping found)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create JWT for OAuth2
    const now = Math.floor(Date.now() / 1000);
    const jwtHeader = {
      alg: 'RS256',
      typ: 'JWT',
      kid: credentials.private_key_id
    };
    
    const jwtClaim = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    // Base64url encode header and claim
    const base64UrlEncode = (obj: any) => {
      return btoa(JSON.stringify(obj))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    };

    const headerEncoded = base64UrlEncode(jwtHeader);
    const claimEncoded = base64UrlEncode(jwtClaim);
    const signatureInput = `${headerEncoded}.${claimEncoded}`;

    // Import RSA private key
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    const pemContents = credentials.private_key
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');
    
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    
    const key = await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    // Sign the JWT
    const textEncoder = new TextEncoder();
    const dataToSign = textEncoder.encode(signatureInput);
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      dataToSign
    );

    const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const jwt = `${signatureInput}.${signatureEncoded}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      let details: any = null;
      try { details = JSON.parse(text); } catch { details = { raw: text }; }
      console.error('Token exchange failed:', details);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to authenticate with Google', 
          details, 
          status: tokenResponse.status,
          hint: 'Verify the service account JSON, private key validity, and enable Google Analytics Data API in Google Cloud.',
          serviceAccountEmail: credentials.client_email
        }),
        { status: tokenResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { access_token } = await tokenResponse.json();

    // Fetch analytics data
    const analyticsResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${effectivePropertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'totalUsers' },
            { name: 'screenPageViews' },
            { name: 'active1DayUsers' }
          ],
          orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }]
        })
      }
    );

    if (!analyticsResponse.ok) {
      const text = await analyticsResponse.text();
      let details: any = null;
      try { details = JSON.parse(text); } catch { details = { raw: text }; }
      console.error('Analytics API error:', details);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch analytics data', 
          details, 
          status: analyticsResponse.status,
          hint: details?.error?.status === 'PERMISSION_DENIED' 
            ? 'Grant the service account Viewer access to the GA4 property in Admin > Property Access Management.'
            : undefined,
          serviceAccountEmail: credentials.client_email,
          propertyId: effectivePropertyId
        }),
        { status: analyticsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analyticsData = await analyticsResponse.json();

    console.log('Full GA4 API Response:', JSON.stringify(analyticsData, null, 2));

    // Transform the response to match expected format
    const rows = analyticsData.rows?.map((row: any) => ({
      date: row.dimensionValues[0].value,
      totalUsers: row.metricValues[0].value,
      screenPageViews: row.metricValues[1].value,
      active1DayUsers: row.metricValues[2].value
    })) || [];

    console.log(`Fetched ${rows.length} rows of analytics data`);

    // If no data found, return detailed diagnostic info
    if (rows.length === 0) {
      console.warn('No analytics data returned. Check:');
      console.warn(`1. Property ID: ${effectivePropertyId}`);
      console.warn(`2. Date range: ${startDate} to ${endDate}`);
      console.warn(`3. Service account: ${credentials.client_email}`);
      console.warn(`4. API response metadata:`, analyticsData.metadata || 'No metadata');
      
      return new Response(
        JSON.stringify({
          success: true,
          rows: [],
          message: 'No analytics data available for this property and date range.',
          diagnostics: {
            propertyId: effectivePropertyId,
            dateRange: `${startDate} to ${endDate}`,
            serviceAccount: credentials.client_email,
            apiResponseMetadata: analyticsData.metadata || null,
            possibleReasons: [
              'The GA4 property has not collected any data in the specified date range',
              'The service account may not have access to this property',
              'The property ID may be incorrect (should be numeric, e.g., "357820181")',
              'Data may still be processing (GA4 has 24-48h delay for some data)'
            ],
            nextSteps: [
              '1. Verify property ID in GA4 Admin > Property Settings > Property Details',
              '2. Check service account has "Viewer" role in GA4 Admin > Property Access Management',
              '3. Confirm the website is sending data to this GA4 property',
              '4. Try a longer date range (e.g., "90daysAgo" to "today")'
            ]
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(rows),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in fetch-google-analytics:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
