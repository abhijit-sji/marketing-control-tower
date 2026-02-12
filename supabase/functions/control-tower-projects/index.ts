import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get Control Tower API credentials from environment
function getControlTowerCredentials() {
  const url = Deno.env.get('CONTROL_TOWER_API_URL');
  const apiKey = Deno.env.get('CONTROL_TOWER_API_KEY');

  if (!url || !apiKey) {
    throw new Error('Control Tower API credentials not configured. Please set CONTROL_TOWER_API_URL and CONTROL_TOWER_API_KEY environment variables.');
  }

  return { url, apiKey };
}

// Search Control Tower projects by name
async function searchControlTowerProjects(searchTerm: string) {
  const { url, apiKey } = getControlTowerCredentials();

  // Build Control Tower API URL
  const searchUrl = `${url}/api-v1-projects?search=${encodeURIComponent(searchTerm)}&limit=50`;

  console.log(`🔍 Searching Control Tower projects with term: "${searchTerm}"`);
  console.log(`🔗 Request URL: ${searchUrl}`);

  const response = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Control Tower API error: ${response.status} - ${errorText}`);
    throw new Error(`Failed to search Control Tower projects: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  const projects = result?.data?.projects || [];
  console.log(`✅ Found ${projects.length} projects in Control Tower`);

  return projects;
}

// Fetch a specific Control Tower project by ID
async function getControlTowerProject(projectId: string) {
  const { url, apiKey } = getControlTowerCredentials();

  const projectUrl = `${url}/api-v1-projects/${projectId}`;

  console.log(`📥 Fetching Control Tower project: ${projectId}`);
  console.log(`🔗 Request URL: ${projectUrl}`);

  const response = await fetch(projectUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Control Tower API error: ${response.status} - ${errorText}`);
    throw new Error(`Failed to fetch Control Tower project: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  const project = result?.data?.project || result?.data;

  if (!project) {
    throw new Error(`Project ${projectId} not found in Control Tower`);
  }

  console.log(`✅ Fetched project: ${project.name}`);
  return project;
}

// Helper function to validate if a value is a valid UUID
function isValidUUID(value: any): boolean {
  if (!value || typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// Helper function to filter valid UUIDs from an array
function filterValidUUIDs(arr: any[]): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => isValidUUID(item));
}

// Helper function to map Control Tower status to local database allowed values
// Local DB allows: 'planning', 'in_progress', 'on_hold', 'completed', 'cancelled'
function mapStatus(ctStatus: string | null | undefined): string {
  if (!ctStatus) return 'planning';

  const statusLower = ctStatus.toLowerCase().trim();

  // Map Control Tower status values to local DB values
  const statusMap: Record<string, string> = {
    'planning': 'planning',
    'active': 'in_progress',
    'in-progress': 'in_progress',
    'in_progress': 'in_progress',
    'on-hold': 'on_hold',
    'on_hold': 'on_hold',
    'paused': 'on_hold',
    'completed': 'completed',
    'done': 'completed',
    'cancelled': 'cancelled',
    'canceled': 'cancelled',
    'archived': 'cancelled',
    'project-queue': 'planning',
    'queue': 'planning',
  };

  return statusMap[statusLower] || 'planning';
}

// Map essential fields from Control Tower project to local project
// Only maps fields that exist in the projects table schema
function mapControlTowerProject(ctProject: any) {
  // Validate that the Control Tower project ID is a valid UUID
  if (!isValidUUID(ctProject.id)) {
    throw new Error(`Control Tower project ID is not a valid UUID: ${ctProject.id}`);
  }

  // Build the mapped data object
  const mappedData: any = {
    // Control Tower tracking (columns added by migration)
    control_tower_project_id: ctProject.id,
    control_tower_last_synced_at: new Date().toISOString(),

    // Identity & Core Info
    name: ctProject.name,
    description: ctProject.description,

    // Status & Progress (map to existing columns)
    status: mapStatus(ctProject.status),
    progress: ctProject.progress,
    priority: ctProject.priority || 'medium',

    // Dates - only include if they're valid dates or null
    start_date: ctProject.start_date || null,
    end_date: ctProject.end_date || null,
    deadline: ctProject.end_date || null,

    // Financial
    budget: ctProject.budget,
    actual_cost: ctProject.actual_cost,

    // Team - assigned_team is UUID[], so only include valid UUIDs
    // Note: Control Tower uses names (like "Anik"), but our DB expects UUIDs
    assigned_team: filterValidUUIDs(ctProject.team_member_ids || []),

    // Sync tracking
    updated_at: new Date().toISOString(),
  };

  // Only add project_manager if it's a valid UUID (it's a UUID column, not text)
  // Control Tower's manager field contains names like "Anik", which won't work
  if (isValidUUID(ctProject.manager_id)) {
    mappedData.project_manager = ctProject.manager_id;
  } else if (isValidUUID(ctProject.project_manager_id)) {
    mappedData.project_manager = ctProject.project_manager_id;
  }
  // If neither is a valid UUID, we leave project_manager as null (don't set it)

  // Only add external_project_id if it's a valid UUID (for backward compatibility)
  if (isValidUUID(ctProject.id)) {
    mappedData.external_project_id = ctProject.id;
  }

  // Note: We intentionally don't set client_id from Control Tower
  // because the client may not exist in the local database
  // This would cause a foreign key constraint violation
  // Users can manually link clients after importing the project

  return mappedData;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const { action, projectName, projectId } = await req.json();

    console.log(`Control Tower Projects - Action: ${action}`);
    console.log('Received payload:', { action, projectId, projectName });

    switch (action) {
      case 'debug': {
        // Debug endpoint to check environment variables
        return new Response(
          JSON.stringify({
            hasUrl: !!Deno.env.get('CONTROL_TOWER_API_URL'),
            hasApiKey: !!Deno.env.get('CONTROL_TOWER_API_KEY'),
            urlPreview: Deno.env.get('CONTROL_TOWER_API_URL')?.substring(0, 20),
            allEnvKeys: Object.keys(Deno.env.toObject()).filter(k => k.includes('CONTROL')),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'search': {
        // Validate search query
        if (!projectName || projectName.trim().length === 0) {
          return new Response(
            JSON.stringify({ error: 'Project name is required for search' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Search Control Tower API
        const projects = await searchControlTowerProjects(projectName.trim());

        return new Response(JSON.stringify({ projects }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'import': {
        // Validate project ID
        if (!projectId) {
          return new Response(
            JSON.stringify({ error: 'Project ID is required for import' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        console.log(`🔍 IMPORT REQUEST - Project ID: ${projectId}, Name: ${projectName}`);

        // Fetch project from Control Tower
        const ctProject = await getControlTowerProject(projectId);
        console.log('📋 Control Tower Project Data:', JSON.stringify(ctProject, null, 2));

        // Check if project already exists locally
        const { data: existingProject } = await supabase
          .from('projects')
          .select('id')
          .eq('control_tower_project_id', projectId)
          .maybeSingle();

        let project;
        let isNew = true;

        // Map Control Tower fields to local project fields
        const projectData = mapControlTowerProject(ctProject);
        console.log('📤 Mapped Project Data to Insert:', JSON.stringify(projectData, null, 2));

        if (existingProject) {
          // Update existing project
          isNew = false;
          const { data: updatedProject, error } = await supabase
            .from('projects')
            .update(projectData)
            .eq('id', existingProject.id)
            .select()
            .single();

          if (error) {
            console.error('❌ Error updating project:', error);
            console.error('Data that caused error:', JSON.stringify(projectData, null, 2));
            throw new Error(`Failed to update project: ${error.message}. Check logs for data details.`);
          }

          project = updatedProject;
          console.log(`✅ Project updated: ${project.name}`);
        } else {
          // Insert new project
          const { data: newProject, error } = await supabase
            .from('projects')
            .insert(projectData)
            .select()
            .single();

          if (error) {
            console.error('❌ Error creating project:', error);
            console.error('❌ Data that caused the error:', JSON.stringify(projectData, null, 2));

            // Check each field to find the problematic one
            console.error('🔍 Debugging fields:');
            for (const [key, value] of Object.entries(projectData)) {
              console.error(`  - ${key}: ${typeof value} = ${JSON.stringify(value)}`);
              if (value === 'Anik') {
                console.error(`    ⚠️ Found "Anik" in field: ${key}`);
              }
              if (Array.isArray(value) && value.includes('Anik')) {
                console.error(`    ⚠️ Array contains "Anik" in field: ${key}`);
              }
            }

            throw new Error(`Failed to insert project: ${error.message}. Check function logs for detailed field information.`);
          }

          project = newProject;
          console.log(`✅ Project created: ${project.name}`);
        }

        return new Response(
          JSON.stringify({
            project,
            isNew,
            message: isNew
              ? `Project "${project.name}" imported successfully`
              : `Project "${project.name}" updated successfully`,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      default: {
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }
  } catch (error) {
    console.error('❌ Error in control-tower-projects function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const errorDetails = error instanceof Error ? error.toString() : String(error);

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
