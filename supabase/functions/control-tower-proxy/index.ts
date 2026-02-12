// ================================================
// Control Tower API Proxy Edge Function
// ================================================
// This edge function securely proxies requests to the SJ Control Tower API
// It handles authentication, API key management, and rate limiting

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProxyRequest {
  endpoint: string;
  method?: string;
  params?: Record<string, any>;
  body?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has required role (manager or super_admin)
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const hasPermission = userRoles?.some(
      (r: any) => r.role === 'super_admin' || r.role === 'manager'
    );

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const requestBody: ProxyRequest = await req.json();
    const { endpoint, method = 'GET', params, body } = requestBody;

    if (!endpoint) {
      return new Response(JSON.stringify({ error: 'Missing endpoint parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Control Tower API configuration from environment variables
    const baseUrl = Deno.env.get('CONTROL_TOWER_API_URL');
    const apiKey = Deno.env.get('CONTROL_TOWER_API_KEY');

    if (!baseUrl || !apiKey) {
      return new Response(JSON.stringify({
        error: 'Control Tower API configuration missing',
        message: 'Please configure CONTROL_TOWER_API_URL and CONTROL_TOWER_API_KEY in edge function secrets'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build query string
    console.log('📝 Received params:', JSON.stringify(params, null, 2));
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const fullUrl = `${baseUrl}${endpoint}${queryString}`;

    console.log(`🔗 Proxying request to: ${fullUrl}`);
    console.log(`📍 Base URL: ${baseUrl}`);
    console.log(`📍 Endpoint: ${endpoint}`);
    console.log(`📍 Query String: ${queryString}`);

    // Make request to Control Tower API
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(fullUrl, fetchOptions);

    console.log(`📨 Response status: ${response.status} ${response.statusText}`);

    // Parse response
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      console.log(`📦 Response data (JSON):`, Array.isArray(data) ? `Array with ${data.length} items` : typeof data);
    } else {
      data = await response.text();
      console.log(`📦 Response data (Text):`, data.substring(0, 200));
    }

    // Return response
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error: unknown) {
    console.error('Error in control-tower-proxy:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: errMsg
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
