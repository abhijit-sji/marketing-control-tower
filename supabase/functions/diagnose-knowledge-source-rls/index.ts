// Diagnostic function to check knowledge_sources RLS policies and user permissions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { brandId } = await req.json();
    if (!brandId) {
      throw new Error('brandId is required');
    }

    // Create admin client for privileged queries
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Check RLS policies on knowledge_sources
    const { data: policies, error: policiesError } = await supabaseAdmin
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'public')
      .eq('tablename', 'knowledge_sources');

    // 2. Check user's role
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    // 3. Check user's brand access via user_has_brand_access function
    const { data: hasBrandAccess, error: brandAccessError } = await supabaseAdmin
      .rpc('user_has_brand_access', {
        _user_id: user.id,
        _brand_id: brandId
      });

    // 4. Check brand ownership details
    const { data: brandDetails, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('id, name, owner_id, co_owner_id, team_members')
      .eq('id', brandId)
      .single();

    // 5. Check user_brands junction table
    const { data: userBrands, error: userBrandsError } = await supabaseAdmin
      .from('user_brands')
      .select('*')
      .eq('user_id', user.id)
      .eq('brand_id', brandId);

    // 6. Check existing sources for this brand
    const { data: existingSources, error: sourcesError } = await supabaseAdmin
      .from('knowledge_sources')
      .select('*')
      .eq('brand_id', brandId);

    // 7. Try to perform the INSERT as the user (this will fail with RLS if blocked)
    const { data: insertTest, error: insertError } = await supabaseClient
      .from('knowledge_sources')
      .insert([{
        name: `TEST_SOURCE_${Date.now()}`,
        type: 'manual',
        brand_id: brandId,
        config: {},
        is_active: true,
      }])
      .select();

    // If insert succeeded, clean it up
    if (insertTest && insertTest.length > 0) {
      await supabaseAdmin
        .from('knowledge_sources')
        .delete()
        .eq('id', insertTest[0].id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: userRole?.role || 'No role found',
        },
        brand: {
          id: brandDetails?.id,
          name: brandDetails?.name,
          owner_id: brandDetails?.owner_id,
          co_owner_id: brandDetails?.co_owner_id,
          team_members: brandDetails?.team_members,
          user_is_owner: brandDetails?.owner_id === user.id,
          user_is_co_owner: brandDetails?.co_owner_id === user.id,
          user_in_team_members: brandDetails?.team_members?.includes(user.id),
        },
        access: {
          has_brand_access: hasBrandAccess,
          user_brands_entry_exists: userBrands && userBrands.length > 0,
        },
        rls_policies: {
          count: policies?.length || 0,
          policies: policies?.map(p => ({
            name: p.policyname,
            operation: p.cmd,
          })) || [],
        },
        existing_sources: {
          count: existingSources?.length || 0,
          sources: existingSources?.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
          })) || [],
        },
        insert_test: {
          success: !insertError,
          error: insertError ? {
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code,
          } : null,
          inserted_id: insertTest?.[0]?.id,
        },
        errors: {
          policies: policiesError?.message,
          role: roleError?.message,
          brand_access: brandAccessError?.message,
          brand: brandError?.message,
          user_brands: userBrandsError?.message,
          sources: sourcesError?.message,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errMsg,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
