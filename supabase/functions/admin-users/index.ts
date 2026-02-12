import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type SupabaseServiceClient = ReturnType<typeof createClient>

console.log("Admin Users function up and running!")

interface UserWithDetails {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: string;
  title: string | null;
  department: string | null;
  is_marketing: boolean;
  created_at: string;
  updated_at: string;
  user_brands?: Array<{
    brand_id: string;
    brand_name: string;
    access_level: string;
    can_view_analytics: boolean;
    can_manage_content: boolean;
    can_manage_team: boolean;
    can_manage_settings: boolean;
  }>;
  permissions?: Array<{
    module_name: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  }>;
}

interface BrandAssignmentInput {
  brand_id: string;
  access_level?: string;
}

interface RawUserBrand {
  brand_id: string;
  access_level: string;
  can_view_analytics: boolean;
  can_manage_content: boolean;
  can_manage_team: boolean;
  can_manage_settings: boolean;
  brands?: {
    name?: string | null;
  };
}

interface RawUserPermission {
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface RawUserRecord {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  title: string | null;
  department: string | null;
  is_marketing: boolean | null;
  created_at: string;
  updated_at: string;
  user_brands?: RawUserBrand[] | null;
  user_permissions?: RawUserPermission[] | null;
}

interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
  status?: string;
  title?: string | null;
  department?: string | null;
  isMarketing?: boolean;
  brandAssignments?: BrandAssignmentInput[];
}

interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: string;
  title?: string | null;
  department?: string | null;
  isMarketing?: boolean;
  brandAssignments?: BrandAssignmentInput[];
}

// Build select query for users table (without role field)
const buildUserSelect = () => `
  id,
  email,
  first_name,
  last_name,
  status,
  title,
  department,
  is_marketing,
  created_at,
  updated_at,
  user_brands(
    brand_id,
    access_level,
    can_view_analytics,
    can_manage_content,
    can_manage_team,
    can_manage_settings,
    brands(name)
  ),
  user_permissions(
    module_name,
    can_view,
    can_create,
    can_edit,
    can_delete
  )
`;

const transformUser = (userData: RawUserRecord, role: string = 'user'): UserWithDetails => ({
  ...userData,
  role,
  title: userData.title ?? null,
  department: userData.department ?? null,
  is_marketing: userData.is_marketing ?? false,
  user_brands:
    userData.user_brands?.map((ub) => ({
      brand_id: ub.brand_id,
      brand_name: ub.brands?.name || '',
      access_level: ub.access_level,
      can_view_analytics: ub.can_view_analytics,
      can_manage_content: ub.can_manage_content,
      can_manage_team: ub.can_manage_team,
      can_manage_settings: ub.can_manage_settings,
    })) || [],
  permissions: userData.user_permissions || [],
});

const syncUserBrands = async (
  client: any,
  userId: string,
  brandAssignments: BrandAssignmentInput[] = [],
) => {
  if (!userId) return;

  const normalizedAssignments = brandAssignments
    .filter((assignment) => assignment?.brand_id)
    .map((assignment) => {
      const level = assignment.access_level || 'member';
      return {
        user_id: userId,
        brand_id: assignment.brand_id,
        access_level: level,
        can_view_analytics: true,
        can_manage_content: level !== 'viewer',
        can_manage_team: level === 'owner',
        can_manage_settings: level === 'owner',
      };
    });

  const existingAssignmentsResponse = await client
    .from('user_brands')
    .select('id, brand_id')
    .eq('user_id', userId);

  if (existingAssignmentsResponse.error) {
    throw existingAssignmentsResponse.error;
  }

  type UserBrandRecord = { id: string; brand_id: string };
  const existingAssignments = (existingAssignmentsResponse.data || []) as UserBrandRecord[];

  const newBrandIds = new Set(normalizedAssignments.map((assignment) => assignment.brand_id));
  const toDelete = existingAssignments
    .filter((record) => !newBrandIds.has(record.brand_id))
    .map((record) => record.id);

  if (toDelete.length > 0) {
    const { error: deleteError } = await client
      .from('user_brands')
      .delete()
      .in('id', toDelete);

    if (deleteError) {
      throw deleteError;
    }
  }

  if (normalizedAssignments.length > 0) {
    const { error: upsertError } = await client
      .from('user_brands')
      .upsert(normalizedAssignments, { onConflict: 'user_id,brand_id' });

    if (upsertError) {
      throw upsertError;
    }
  }
};

// Fetch user with details including role from user_roles table
const fetchUserWithDetails = async (client: any, userId: string): Promise<UserWithDetails> => {
  // Fetch user data
  const { data: userData, error: userError } = await client
    .from('users')
    .select(buildUserSelect())
    .eq('id', userId)
    .single();

  if (userError) {
    throw userError;
  }

  // Fetch role from user_roles table
  const { data: roleData, error: roleError } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (roleError) {
    console.error('Error fetching user role:', roleError);
  }

  const role = roleData?.role || 'user';
  
  return transformUser(userData as RawUserRecord, role);
};

// Get user's role from user_roles table
const getUserRole = async (client: any, userId: string): Promise<string | null> => {
  const { data, error } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user role:', error);
    return null;
  }

  return data?.role || null;
};

// Update user role in user_roles table
const updateUserRole = async (client: any, userId: string, role: string): Promise<void> => {
  const { error } = await client
    .from('user_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id,role' });

  if (error) {
    throw error;
  }

  // Remove old roles if changing to a new one
  const { error: deleteError } = await client
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .neq('role', role);

  if (deleteError) {
    console.error('Error removing old roles:', deleteError);
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Verify the requesting user is authenticated and has admin privileges
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Check if user has admin privileges from user_roles table
    const userRole = await getUserRole(supabaseClient, user.id);
    
    if (!userRole || !['super_admin', 'manager'].includes(userRole)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient privileges' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      )
    }

    const { method } = req
    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    // Get userId from query params for PUT/DELETE, from path for GET single user
    const userIdFromQuery = url.searchParams.get('userId')
    const userIdFromPath = pathSegments[pathSegments.length - 1]
    const userId = userIdFromQuery || (userIdFromPath !== 'admin-users' ? userIdFromPath : null)

    if (method === 'GET') {
      if (userId && userId !== 'admin-users') {
        try {
          const userWithDetails = await fetchUserWithDetails(supabaseClient, userId)

          return new Response(
            JSON.stringify({ user: userWithDetails }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            }
          )
        } catch (userError: unknown) {
          const message = userError instanceof Error ? userError.message : 'Failed to load user'
          return new Response(
            JSON.stringify({ error: message }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            }
          )
        }
      } else {
        // Get all users with pagination and filtering
        const searchParams = url.searchParams
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const search = searchParams.get('search') || ''
        const roleFilter = searchParams.get('role') || ''
        const statusFilter = searchParams.get('status') || ''
        const marketingFilter = searchParams.get('is_marketing')

        const offset = (page - 1) * limit

        let query = supabaseClient
          .from('users')
          .select(buildUserSelect(), { count: 'exact' })

        // Apply filters
        if (search) {
          query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
        }
        if (statusFilter) {
          query = query.eq('status', statusFilter)
        }
        if (marketingFilter === 'true') {
          query = query.eq('is_marketing', true)
        }
        if (marketingFilter === 'false') {
          query = query.eq('is_marketing', false)
        }

        const { data: users, error: usersError, count } = await query
          .range(offset, offset + limit - 1)
          .order('created_at', { ascending: false })

        if (usersError) {
          return new Response(
            JSON.stringify({ error: usersError.message }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        // Fetch roles for all users
        const userIds = (users || []).map((u: any) => u.id);
        const { data: rolesData, error: rolesError } = await supabaseClient
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);

        if (rolesError) {
          console.error('Error fetching user roles:', rolesError);
        }

        // Create role map
        const roleMap = new Map((rolesData || []).map(r => [r.user_id, r.role]));

        // Transform the data with roles
        let usersWithDetails: UserWithDetails[] = (users || []).map((user: any) => {
          const role = roleMap.get(user.id) || 'user';
          return transformUser(user as RawUserRecord, role);
        });

        // Apply role filter if specified
        if (roleFilter) {
          usersWithDetails = usersWithDetails.filter(u => u.role === roleFilter);
        }

        return new Response(
          JSON.stringify({ 
            users: usersWithDetails,
            total: roleFilter ? usersWithDetails.length : (count || 0),
            page,
            limit
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      }
    }

    if (method === 'POST') {
      // Create new user
      const {
        email,
        password,
        firstName,
        lastName,
        role = 'user',
        status = 'active',
        title = null,
        department = null,
        isMarketing = false,
        brandAssignments = [],
      } = await req.json() as CreateUserRequest

      console.log('Creating user:', email, 'with role:', role)

      // Validate role
      const validRoles = ['super_admin', 'manager', 'brand_manager', 'pm', 'user'];
      if (!validRoles.includes(role)) {
        return new Response(
          JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      // Create user in auth
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          title,
          department,
          is_marketing: isMarketing
        }
      })

      if (authError) {
        console.error('Auth user creation error:', authError)
        return new Response(
          JSON.stringify({ error: authError.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      const newUserId = authData.user?.id;
      if (!newUserId) {
        return new Response(
          JSON.stringify({ error: 'Failed to create user' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }

      // Create or update user record in users table (trigger may have already created it)
      // Note: We do NOT include role here - it goes in user_roles table
      const { data: userData, error: userError } = await supabaseClient
        .from('users')
        .upsert({
          id: newUserId,
          email,
          first_name: firstName,
          last_name: lastName,
          status,
          title,
          department,
          is_marketing: isMarketing
        }, {
          onConflict: 'id'
        })
        .select()
        .single()

      if (userError) {
        console.error('User table creation error:', userError)
        // Clean up auth user if database insert fails
        await supabaseClient.auth.admin.deleteUser(newUserId)
        
        return new Response(
          JSON.stringify({ error: userError.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      // Insert role into user_roles table (replacing any default role from trigger)
      try {
        await updateUserRole(supabaseClient, newUserId, role);
      } catch (roleError: unknown) {
        console.error('Role assignment error:', roleError);
        // Clean up user if role assignment fails
        await supabaseClient.auth.admin.deleteUser(newUserId);
        
        const message = roleError instanceof Error ? roleError.message : 'Failed to assign role';
        return new Response(
          JSON.stringify({ error: message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      // Assign brands
      try {
        await syncUserBrands(supabaseClient, newUserId, brandAssignments)
      } catch (brandError: unknown) {
        const message = brandError instanceof Error ? brandError.message : 'Failed to assign brands'
        console.error('Brand assignment error:', brandError)
        return new Response(
          JSON.stringify({ error: message }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        )
      }

      const createdUser = await fetchUserWithDetails(supabaseClient, userData.id)

      console.log('User created successfully:', email)
      return new Response(
        JSON.stringify({ user: createdUser }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201
        }
      )
    }

    if (method === 'PUT') {
      if (!userId || userId === 'admin-users') {
        return new Response(
          JSON.stringify({ error: 'User ID required for update' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      const { brandAssignments, ...rawUpdates } = await req.json() as UpdateUserRequest

      const updatePayload: Record<string, unknown> = {}

      if (typeof rawUpdates.email !== 'undefined') {
        updatePayload.email = rawUpdates.email
      }
      if (typeof rawUpdates.firstName !== 'undefined') {
        updatePayload.first_name = rawUpdates.firstName
      }
      if (typeof rawUpdates.lastName !== 'undefined') {
        updatePayload.last_name = rawUpdates.lastName
      }
      // Note: role is NOT included in updatePayload - it's handled separately
      if (typeof rawUpdates.status !== 'undefined') {
        updatePayload.status = rawUpdates.status
      }
      if (typeof rawUpdates.title !== 'undefined') {
        updatePayload.title = rawUpdates.title
      }
      if (typeof rawUpdates.department !== 'undefined') {
        updatePayload.department = rawUpdates.department
      }
      if (typeof rawUpdates.isMarketing !== 'undefined') {
        updatePayload.is_marketing = rawUpdates.isMarketing
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: userError } = await supabaseClient
          .from('users')
          .update(updatePayload)
          .eq('id', userId)

        if (userError) {
          return new Response(
            JSON.stringify({ error: userError.message }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            }
          )
        }
      }

      // Update role in user_roles table if provided
      if (typeof rawUpdates.role !== 'undefined') {
        const validRoles = ['super_admin', 'manager', 'brand_manager', 'pm', 'user'];
        if (!validRoles.includes(rawUpdates.role)) {
          return new Response(
            JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }

        try {
          await updateUserRole(supabaseClient, userId, rawUpdates.role);
        } catch (roleError: unknown) {
          const message = roleError instanceof Error ? roleError.message : 'Failed to update role';
          return new Response(
            JSON.stringify({ error: message }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          )
        }
      }

      // Update email in auth.users if provided
      if (typeof rawUpdates.email !== 'undefined') {
        const { error: emailError } = await supabaseClient.auth.admin.updateUserById(userId, {
          email: rawUpdates.email
        })

        if (emailError) {
          return new Response(
            JSON.stringify({ error: `Failed to update email: ${emailError.message}` }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            }
          )
        }
      }

      if (Array.isArray(brandAssignments)) {
        try {
          await syncUserBrands(supabaseClient, userId, brandAssignments)
        } catch (brandError: unknown) {
          const message = brandError instanceof Error ? brandError.message : 'Failed to update brand assignments'
          return new Response(
            JSON.stringify({ error: message }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            }
          )
        }
      }

      const metadataUpdates: Record<string, unknown> = {}
      if (typeof rawUpdates.firstName !== 'undefined') {
        metadataUpdates.first_name = rawUpdates.firstName
      }
      if (typeof rawUpdates.lastName !== 'undefined') {
        metadataUpdates.last_name = rawUpdates.lastName
      }
      // Note: role is NOT stored in user_metadata anymore
      if (typeof rawUpdates.title !== 'undefined') {
        metadataUpdates.title = rawUpdates.title
      }
      if (typeof rawUpdates.department !== 'undefined') {
        metadataUpdates.department = rawUpdates.department
      }
      if (typeof rawUpdates.isMarketing !== 'undefined') {
        metadataUpdates.is_marketing = rawUpdates.isMarketing
      }

      if (Object.keys(metadataUpdates).length > 0) {
        await supabaseClient.auth.admin.updateUserById(userId, {
          user_metadata: metadataUpdates
        })
      }

      const updatedUser = await fetchUserWithDetails(supabaseClient, userId)

      return new Response(
        JSON.stringify({ user: updatedUser }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    if (method === 'DELETE') {
      if (!userId || userId === 'admin-users') {
        return new Response(
          JSON.stringify({ error: 'User ID required for deletion' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      // Delete from auth (this will cascade to users and user_roles tables via ON DELETE CASCADE)
      const { error: authError } = await supabaseClient.auth.admin.deleteUser(userId)

      if (authError) {
        return new Response(
          JSON.stringify({ error: authError.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

      return new Response(
        JSON.stringify({ message: 'User deleted successfully' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
