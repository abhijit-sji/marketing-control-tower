import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const INTEGRATION_TYPE = 'n8n_analytics';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

type UserProfile = {
  id: string;
  role: string | null;
  is_marketing: boolean | null;
};

type BrandRecord = {
  id: string;
  name: string;
  owner_id: string;
  co_owner_id: string | null;
  team_members: string[] | null;
  active_integrations: string[] | null;
};

type AnalyticsIntegrationRow = {
  id: string;
  brand_id: string;
  webhook_url: string;
  webhook_secret: string;
  n8n_workflow_id: string | null;
  is_active: boolean | null;
  last_sync_at: string | null;
  sync_frequency: string | null;
  data_sources: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

function getSupabaseClient(req?: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase environment variables are not configured');
  }

  const headers: Record<string, string> = {};
  if (req) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
  }

  return createClient(supabaseUrl, serviceKey, {
    global: { headers },
    auth: { persistSession: false },
  });
}

function getServiceRoleClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase environment variables are not configured');
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

async function getAuthenticatedUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    return null;
  }
  return data.user;
}

async function getUserProfile(client: SupabaseClient, userId: string): Promise<UserProfile | null> {
  // Query users table for basic info
  const { data: userData, error: userError } = await client
    .from('users')
    .select('id, is_marketing')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !userData) {
    console.error('[getUserProfile] Failed to fetch user data', userError);
    return null;
  }

  // Query user_roles table for role
  const { data: roleData, error: roleError } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (roleError) {
    console.error('[getUserProfile] Failed to fetch user role', roleError);
  }

  return {
    id: userData.id,
    role: roleData?.role ?? null,
    is_marketing: userData.is_marketing ?? null,
  };
}

function userIsManagerOrMarketing(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.role === 'super_admin' || profile.role === 'manager') return true;
  return profile.is_marketing === true;
}

function userHasBrandMembership(brand: BrandRecord, userId: string): boolean {
  if (brand.owner_id === userId) return true;
  if (brand.co_owner_id === userId) return true;
  if (Array.isArray(brand.team_members)) {
    return brand.team_members.includes(userId);
  }
  return false;
}

async function getBrand(client: SupabaseClient, brandId: string): Promise<BrandRecord | null> {
  const { data, error } = await client
    .from('brands')
    .select('id, name, owner_id, co_owner_id, team_members, active_integrations')
    .eq('id', brandId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as BrandRecord;
}

async function ensureBrandAccess(
  client: SupabaseClient,
  brandId: string,
  userId: string,
  profile: UserProfile | null,
): Promise<BrandRecord> {
  const brand = await getBrand(client, brandId);
  if (!brand) {
    throw new Error('Brand not found');
  }

  if (userIsManagerOrMarketing(profile) || userHasBrandMembership(brand, userId)) {
    return brand;
  }

  throw new Error('Forbidden');
}

function buildWebhookUrl(brandId: string): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is not configured');
  }
  
  // Validate brandId is a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(brandId)) {
    throw new Error('Invalid brand ID format');
  }
  
  // Ensure URL is properly formatted
  const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
  return `${baseUrl}/functions/v1/n8n-analytics-manage/webhook/${brandId}`;
}

async function addIntegrationToBrand(client: SupabaseClient, brand: BrandRecord) {
  const current = Array.isArray(brand.active_integrations) ? [...brand.active_integrations] : [];
  if (!current.includes(INTEGRATION_TYPE)) {
    current.push(INTEGRATION_TYPE);
    await client
      .from('brands')
      .update({ active_integrations: current })
      .eq('id', brand.id);
  }
}

async function removeIntegrationFromBrand(client: SupabaseClient, brand: BrandRecord) {
  const current = Array.isArray(brand.active_integrations) ? [...brand.active_integrations] : [];
  if (current.includes(INTEGRATION_TYPE)) {
    const updated = current.filter((value) => value !== INTEGRATION_TYPE);
    await client
      .from('brands')
      .update({ active_integrations: updated })
      .eq('id', brand.id);
  }
}

function sanitizeIntegrationResponse(row: AnalyticsIntegrationRow | null, includeSecret = false) {
  if (!row) return null;
  const base = {
    id: row.id,
    brand_id: row.brand_id,
    webhook_url: row.webhook_url,
    n8n_workflow_id: row.n8n_workflow_id,
    is_active: row.is_active ?? false,
    last_sync_at: row.last_sync_at,
    sync_frequency: row.sync_frequency || 'daily',
    data_sources: row.data_sources || { google_analytics: true },
    metadata: row.metadata || {},
  };

  if (includeSecret) {
    return { ...base, webhook_secret: row.webhook_secret };
  }

  return base;
}

async function fetchAnalyticsIntegration(
  client: SupabaseClient,
  brandId: string,
): Promise<AnalyticsIntegrationRow | null> {
  const { data, error } = await client
    .from('brand_analytics_integrations')
    .select('id, brand_id, webhook_url, webhook_secret, n8n_workflow_id, is_active, last_sync_at, sync_frequency, data_sources, metadata')
    .eq('brand_id', brandId)
    .eq('integration_type', INTEGRATION_TYPE)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch analytics integration', error);
    throw error;
  }

  return (data as AnalyticsIntegrationRow | null) ?? null;
}

async function fetchAnalyticsData(
  client: SupabaseClient,
  brandId: string,
  limit = 20,
  startDate?: string,
  endDate?: string,
) {
  let query = client
    .from('brand_analytics_data')
    .select('id, data_type, date_range_start, date_range_end, metrics, dimensions, raw_data, received_at, integration_id')
    .eq('brand_id', brandId)
    .order('received_at', { ascending: false })
    .limit(limit);

  if (startDate) {
    query = query.gte('date_range_start', startDate);
  }

  if (endDate) {
    query = query.lte('date_range_end', endDate);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Failed to fetch analytics data', error);
    throw error;
  }

  return data ?? [];
}

// Simple rate limiting using in-memory store
const webhookAttempts = new Map<string, { count: number; resetAt: number }>();

async function handleWebhook(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST,OPTIONS' } });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const brandId = segments[segments.length - 1];
  
  // Rate limiting: 100 requests per minute per brand
  const now = Date.now();
  const rateLimitKey = `webhook:${brandId}`;
  const attempt = webhookAttempts.get(rateLimitKey);
  
  if (attempt && attempt.resetAt > now) {
    if (attempt.count >= 100) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: corsHeaders,
      });
    }
    attempt.count++;
  } else {
    webhookAttempts.set(rateLimitKey, { count: 1, resetAt: now + 60000 });
  }

  if (!brandId) {
    return new Response(JSON.stringify({ error: 'Brand ID missing in webhook URL' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const secret = req.headers.get('x-webhook-secret') || req.headers.get('X-Webhook-Secret');
  if (!secret) {
    return new Response(JSON.stringify({ error: 'Missing webhook secret' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const client = getSupabaseClient();

  try {
    const integration = await fetchAnalyticsIntegration(client, brandId);
    if (!integration) {
      return new Response(JSON.stringify({ error: 'Integration not configured' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (integration.webhook_secret !== secret) {
      return new Response(JSON.stringify({ error: 'Invalid webhook secret' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const payload = await req.json();
    const {
      data_type,
      date_range_start,
      date_range_end,
      metrics,
      dimensions = {},
      raw_data = null,
    } = payload ?? {};

    if (!data_type || !date_range_start || !date_range_end || !metrics) {
      return new Response(JSON.stringify({ error: 'Missing required analytics payload fields' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const insertResult = await client.from('brand_analytics_data').insert({
      brand_id: brandId,
      integration_id: integration.id,
      data_type,
      date_range_start,
      date_range_end,
      metrics,
      dimensions,
      raw_data,
    }).select('id').single();

    if (insertResult.error) {
      console.error('Failed to store analytics payload', insertResult.error);
      throw insertResult.error;
    }

    // Update integration sync timestamp only if data was successfully stored
    if (insertResult.data?.id) {
      await client
        .from('brand_analytics_integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          is_active: true,
        })
        .eq('id', integration.id);

      const brand = await getBrand(client, brandId);
      if (brand) {
        await addIntegrationToBrand(client, brand);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Webhook processing failed', error);
    return new Response(JSON.stringify({ error: 'Failed to process webhook' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function handleListBrands(
  client: SupabaseClient,
  userId: string,
  profile: UserProfile | null,
) {
  const { data: brandRows, error: brandError } = await client
    .from('brands')
    .select('id, name, owner_id, co_owner_id, team_members, active_integrations');

  if (brandError) {
    throw brandError;
  }

  const brandRecords = (brandRows as BrandRecord[] | null) ?? [];

  const accessibleBrands = brandRecords.filter((brand) =>
    userIsManagerOrMarketing(profile) || userHasBrandMembership(brand, userId)
  );

  const brandIds = accessibleBrands.map((brand) => brand.id);
  if (brandIds.length === 0) {
    return [];
  }

  const { data: integrationRows, error: integrationError } = await client
    .from('brand_analytics_integrations')
    .select('id, brand_id, webhook_url, webhook_secret, n8n_workflow_id, is_active, last_sync_at, sync_frequency, data_sources, metadata')
    .in('brand_id', brandIds)
    .eq('integration_type', INTEGRATION_TYPE);

  if (integrationError) {
    throw integrationError;
  }

  const integrationsByBrand = new Map<string, AnalyticsIntegrationRow>();
  (integrationRows as AnalyticsIntegrationRow[]).forEach((row) => {
    integrationsByBrand.set(row.brand_id, row);
  });

  return accessibleBrands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    active_integrations: brand.active_integrations ?? [],
    integration: sanitizeIntegrationResponse(integrationsByBrand.get(brand.id) ?? null, false),
  }));
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.pathname.includes('/webhook/')) {
    return handleWebhook(req);
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      },
    });
  }

  let client: SupabaseClient;
  try {
    client = getSupabaseClient(req);
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Configuration error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const user = await getAuthenticatedUser(client);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const profile = await getUserProfile(client, user.id);
  // Note: profile can be null for users without detailed profiles
  // Access checks will be done per action

  try {
    if (req.method === 'GET') {
      const brandId = url.searchParams.get('brand_id');
      if (!brandId) {
        const brands = await handleListBrands(client, user.id, profile);
        return new Response(JSON.stringify({ ok: true, brands }), { headers: corsHeaders });
      }

      const brand = await ensureBrandAccess(client, brandId, user.id, profile);
      const integration = await fetchAnalyticsIntegration(client, brandId);
      const data = await fetchAnalyticsData(client, brandId, 10);
      return new Response(JSON.stringify({
        ok: true,
        brand: { id: brand.id, name: brand.name },
        integration: sanitizeIntegrationResponse(integration, false), // Don't expose secret in GET
        data,
      }), { headers: corsHeaders });
    }

    const body = await req.json();
    const action = body?.action as string | undefined;

    if (!action) {
      return new Response(JSON.stringify({ error: 'Missing action' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (action === 'list_brands') {
      const brands = await handleListBrands(client, user.id, profile);
      return new Response(JSON.stringify({ ok: true, brands }), { headers: corsHeaders });
    }

    const brandId = body?.brandId as string | undefined;
    if (!brandId) {
      return new Response(JSON.stringify({ error: 'brandId is required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const brand = await ensureBrandAccess(client, brandId, user.id, profile);
    const existingIntegration = await fetchAnalyticsIntegration(client, brandId);

    if (action === 'get') {
      const data = await fetchAnalyticsData(client, brandId, body?.limit ?? 20, body?.startDate, body?.endDate);
      return new Response(JSON.stringify({
        ok: true,
        integration: sanitizeIntegrationResponse(existingIntegration, true),
        data,
      }), { headers: corsHeaders });
    }

    if (action === 'create') {
      const secret = crypto.randomUUID().replace(/-/g, '');
      const webhookUrl = buildWebhookUrl(brandId);
      const syncFrequency = body?.syncFrequency || 'daily';
      const metadata = body?.metadata ?? {};
      const dataSources = body?.dataSources ?? { google_analytics: true };

      const payload = {
        brand_id: brandId,
        integration_type: INTEGRATION_TYPE,
        webhook_url: webhookUrl,
        webhook_secret: secret,
        sync_frequency: syncFrequency,
        metadata,
        data_sources: dataSources,
        is_active: true,
        created_by: user.id,
      };

      let integrationId = existingIntegration?.id;
      if (existingIntegration) {
        const { error } = await client
          .from('brand_analytics_integrations')
          .update(payload)
          .eq('id', existingIntegration.id);
        if (error) throw error;
      } else {
        const { data, error } = await client
          .from('brand_analytics_integrations')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        integrationId = data?.id;
      }

      await addIntegrationToBrand(client, brand);
      const refreshed = await fetchAnalyticsIntegration(client, brandId);
      return new Response(JSON.stringify({
        ok: true,
        integration: sanitizeIntegrationResponse(refreshed, true),
      }), { headers: corsHeaders });
    }

    if (action === 'update') {
      if (!existingIntegration) {
        return new Response(JSON.stringify({ error: 'Integration not configured' }), {
          status: 404,
          headers: corsHeaders,
        });
      }

      const updates: Record<string, unknown> = {
        sync_frequency: body?.syncFrequency || existingIntegration.sync_frequency || 'daily',
        metadata: body?.metadata ?? existingIntegration.metadata ?? {},
        data_sources: body?.dataSources ?? existingIntegration.data_sources ?? { google_analytics: true },
      };

      if (typeof body?.isActive === 'boolean') {
        updates.is_active = body.isActive;
      }

      if (body?.n8nWorkflowId !== undefined) {
        updates.n8n_workflow_id = body.n8nWorkflowId;
      }

      if (body?.regenerateSecret) {
        updates.webhook_secret = crypto.randomUUID().replace(/-/g, '');
        updates.webhook_url = buildWebhookUrl(brandId);
      }

      const { error } = await client
        .from('brand_analytics_integrations')
        .update(updates)
        .eq('id', existingIntegration.id);

      if (error) {
        throw error;
      }

      if (typeof body?.isActive === 'boolean') {
        if (body.isActive) {
          await addIntegrationToBrand(client, brand);
        } else {
          await removeIntegrationFromBrand(client, brand);
        }
      }

      const refreshed = await fetchAnalyticsIntegration(client, brandId);
      return new Response(JSON.stringify({ ok: true, integration: sanitizeIntegrationResponse(refreshed, true) }), {
        headers: corsHeaders,
      });
    }

    if (action === 'test') {
      if (!existingIntegration) {
        return new Response(JSON.stringify({ ok: false, error: 'Integration not configured' }), {
          status: 404,
          headers: corsHeaders,
        });
      }

      const secretValid = existingIntegration.webhook_secret?.length > 0;
      return new Response(JSON.stringify({ ok: secretValid, integration: sanitizeIntegrationResponse(existingIntegration, true) }), {
        headers: corsHeaders,
      });
    }

    if (action === 'fetch_data') {
      const data = await fetchAnalyticsData(client, brandId, body?.limit ?? 20, body?.startDate, body?.endDate);
      return new Response(JSON.stringify({ ok: true, data }), { headers: corsHeaders });
    }

    if (action === 'save') {
      const analyticsData = body?.analyticsData;
      if (!Array.isArray(analyticsData) || analyticsData.length === 0) {
        return new Response(JSON.stringify({ error: 'analyticsData must be a non-empty array' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      console.log(`Saving ${analyticsData.length} analytics records for brand ${brandId}`);

      // Verify brand exists (simpler check for save action)
      const brand = await getBrand(client, brandId);
      if (!brand) {
        return new Response(JSON.stringify({ error: 'Brand not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      }

      // Get existing integration if any
      const existingIntegration = await fetchAnalyticsIntegration(client, brandId);

      // Transform GA4 data format to our database format
      const records = analyticsData.map((item: any) => {
        const dateStr = item.date; // Format: YYYYMMDD
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const formattedDate = `${year}-${month}-${day}`;

        return {
          brand_id: brandId,
          integration_id: existingIntegration?.id ?? null,
          data_type: 'google_analytics',
          date_range_start: formattedDate,
          date_range_end: formattedDate,
          metrics: {
            totalUsers: parseInt(item.totalUsers || '0'),
            screenPageViews: parseInt(item.screenPageViews || '0'),
            active1DayUsers: parseInt(item.active1DayUsers || '0'),
          },
          dimensions: {},
          raw_data: item,
        };
      });

      // Use service role client for insert to bypass RLS
      // First delete existing records for this brand and date range to avoid conflicts
      const serviceClient = getServiceRoleClient();
      const dateRangeStart = records[0]?.date_range_start;
      const dateRangeEnd = records[records.length - 1]?.date_range_end;
      
      if (dateRangeStart && dateRangeEnd) {
        await serviceClient
          .from('brand_analytics_data')
          .delete()
          .eq('brand_id', brandId)
          .eq('data_type', 'google_analytics')
          .gte('date_range_start', dateRangeStart)
          .lte('date_range_end', dateRangeEnd);
      }

      const { data: insertedData, error: insertError } = await serviceClient
        .from('brand_analytics_data')
        .insert(records)
        .select('id');

      if (insertError) {
        console.error('Failed to save analytics data:', insertError);
        throw insertError;
      }

      console.log(`Successfully saved ${insertedData?.length || 0} analytics records`);

      return new Response(JSON.stringify({ 
        ok: true, 
        saved: insertedData?.length || 0,
        message: `Saved ${insertedData?.length || 0} analytics records`
      }), { 
        headers: corsHeaders 
      });
    }

    if (action === 'update_keywords') {
      if (!Array.isArray(body?.keywords)) {
        return new Response(JSON.stringify({ error: 'keywords must be an array' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const cleanedKeywords = (body.keywords as unknown[])
        .map((value) => (typeof value === 'string' ? value : String(value ?? '')))
        .map((value) => value.trim())
        .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);

      const { data: latestRecord, error: latestError } = await client
        .from('brand_analytics_data')
        .select('id, dimensions')
        .eq('brand_id', brandId)
        .order('date_range_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) {
        throw latestError;
      }

      if (latestRecord) {
        const updatedDimensions = {
          ...(latestRecord.dimensions ?? {}),
          keywords: cleanedKeywords,
        };

        const { error: updateError } = await client
          .from('brand_analytics_data')
          .update({ dimensions: updatedDimensions })
          .eq('id', latestRecord.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        const now = new Date().toISOString();
        const { error: insertError } = await client
          .from('brand_analytics_data')
          .insert({
            brand_id: brandId,
            integration_id: existingIntegration?.id ?? null,
            data_type: 'seo_keywords',
            date_range_start: now,
            date_range_end: now,
            metrics: {},
            dimensions: { keywords: cleanedKeywords },
          });

        if (insertError) {
          throw insertError;
        }
      }

      return new Response(JSON.stringify({ ok: true, keywords: cleanedKeywords }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('n8n analytics manage error', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const status = message === 'Forbidden' ? 403 : message === 'Brand not found' ? 404 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: corsHeaders,
    });
  }
});
