import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const slugify = (name: string) => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'brand'
}

const isSlugTaken = async (slug: string, currentId?: string) => {
  const { data, error } = await supabase
    .from('brands')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      return true
    }

    throw error
  }

  if (!data) {
    return false
  }

  if (currentId && data.id === currentId) {
    return false
  }

  return true
}

const generateUniqueSlug = async (name: string, currentId?: string) => {
  const baseSlug = slugify(name)
  let slug = baseSlug
  let counter = 2

  while (await isSlugTaken(slug, currentId)) {
    slug = `${baseSlug}-${counter++}`
  }

  return slug
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the user from the auth token
    const { data: user, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const method = req.method;
    const url = new URL(req.url);
    const brandId = url.searchParams.get('id');
    const brandSlug = url.searchParams.get('slug');

    switch (method) {
      case 'GET':
        if (brandId || brandSlug) {
          // Get single brand with KPIs - query by id or slug
          let query = supabase
            .from('brands')
            .select(`
              *,
              owner:users!brands_owner_id_fkey(first_name, last_name, email),
              co_owner:users!brands_co_owner_id_fkey(first_name, last_name, email),
              brand_kpis(*)
            `);
          
          if (brandId) {
            query = query.eq('id', brandId);
          } else if (brandSlug) {
            query = query.eq('slug', brandSlug);
          }
          
          const { data: brand, error: brandError } = await query.single();

          if (brandError) {
            console.error('Error fetching brand:', brandError);
            return new Response(JSON.stringify({ error: 'Brand not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Format the response to match frontend expectations
          const formattedBrand = {
            ...brand,
            owner_name: brand.owner ? `${brand.owner.first_name || ''} ${brand.owner.last_name || ''}`.trim() : 'Unknown',
            co_owner_name: brand.co_owner ? `${brand.co_owner.first_name || ''} ${brand.co_owner.last_name || ''}`.trim() : null,
            kpis: brand.brand_kpis || []
          };

          return new Response(JSON.stringify(formattedBrand), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Get all brands with KPIs
          const { data: brands, error: brandsError } = await supabase
            .from('brands')
            .select(`
              *,
              owner:users!brands_owner_id_fkey(first_name, last_name, email),
              co_owner:users!brands_co_owner_id_fkey(first_name, last_name, email),
              brand_kpis(*)
            `)
            .order('created_at', { ascending: false });

          if (brandsError) {
            console.error('Error fetching brands:', brandsError);
            return new Response(JSON.stringify({ error: 'Failed to fetch brands' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Format the response to match frontend expectations
          const formattedBrands = brands.map(brand => ({
            ...brand,
            owner_name: brand.owner ? `${brand.owner.first_name || ''} ${brand.owner.last_name || ''}`.trim() : 'Unknown',
            co_owner_name: brand.co_owner ? `${brand.co_owner.first_name || ''} ${brand.co_owner.last_name || ''}`.trim() : null,
            kpis: brand.brand_kpis || []
          }));

          return new Response(JSON.stringify(formattedBrands), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

      case 'POST': {
        const createData = await req.json();
        
        // Validate required fields
        if (!createData.name || !createData.description || !createData.owner_id) {
          return new Response(
            JSON.stringify({ 
              error: 'Missing required fields: name, description, and owner_id are required' 
            }), 
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        
        const slug = await generateUniqueSlug(createData.name)

        // Create new brand
        const { data: newBrand, error: createError } = await supabase
          .from('brands')
          .insert({
            name: createData.name,
            slug,
            description: createData.description,
            type: createData.type || 'internal',
            owner_id: createData.owner_id,
            co_owner_id: createData.co_owner_id || null,
            monthly_budget: createData.monthly_budget,
            status: 'active',
            is_active: true
          })
          .select(`
            *,
            owner:users!brands_owner_id_fkey(first_name, last_name, email),
            co_owner:users!brands_co_owner_id_fkey(first_name, last_name, email)
          `)
          .single();

        if (createError) {
          console.error('Error creating brand:', createError);
          return new Response(JSON.stringify({ error: 'Failed to create brand' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Format response
        const formattedNewBrand = {
          ...newBrand,
          owner_name: newBrand.owner ? `${newBrand.owner.first_name || ''} ${newBrand.owner.last_name || ''}`.trim() : 'Unknown',
          co_owner_name: newBrand.co_owner ? `${newBrand.co_owner.first_name || ''} ${newBrand.co_owner.last_name || ''}`.trim() : null,
          kpis: []
        };

        return new Response(JSON.stringify(formattedNewBrand), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'PUT': {
        if (!brandId) {
          return new Response(JSON.stringify({ error: 'Brand ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const updateData = await req.json();
        
        // Validate required fields for update
        if (!updateData.name || !updateData.description || !updateData.owner_id) {
          return new Response(
            JSON.stringify({ 
              error: 'Missing required fields: name, description, and owner_id are required' 
            }), 
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        
        const slug = await generateUniqueSlug(updateData.name, brandId)

        const { data: updatedBrand, error: updateError } = await supabase
          .from('brands')
          .update({
            name: updateData.name,
            slug,
            description: updateData.description,
            type: updateData.type,
            owner_id: updateData.owner_id,
            co_owner_id: updateData.co_owner_id !== undefined ? updateData.co_owner_id : undefined,
            monthly_budget: updateData.monthly_budget,
            is_active: updateData.is_active,
            status: updateData.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', brandId)
          .select(`
            *,
            owner:users!brands_owner_id_fkey(first_name, last_name, email),
            co_owner:users!brands_co_owner_id_fkey(first_name, last_name, email),
            brand_kpis(*)
          `)
          .single();

        if (updateError) {
          console.error('Error updating brand:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update brand' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Format response
        const formattedUpdatedBrand = {
          ...updatedBrand,
          owner_name: updatedBrand.owner ? `${updatedBrand.owner.first_name || ''} ${updatedBrand.owner.last_name || ''}`.trim() : 'Unknown',
          co_owner_name: updatedBrand.co_owner ? `${updatedBrand.co_owner.first_name || ''} ${updatedBrand.co_owner.last_name || ''}`.trim() : null,
          kpis: updatedBrand.brand_kpis || []
        };

        return new Response(JSON.stringify(formattedUpdatedBrand), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'DELETE': {
        if (!brandId) {
          return new Response(JSON.stringify({ error: 'Brand ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error: deleteError } = await supabase
          .from('brands')
          .delete()
          .eq('id', brandId);

        if (deleteError) {
          console.error('Error deleting brand:', deleteError);
          return new Response(JSON.stringify({ error: 'Failed to delete brand' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});