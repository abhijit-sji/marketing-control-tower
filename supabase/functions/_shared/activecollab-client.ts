/**
 * ActiveCollab API Client
 * Shared utility for all ActiveCollab edge functions
 * Uses Basic Authentication for projects/tasks, Bearer Token for comments
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptValue } from './encryption.ts';

export interface ActiveCollabConfig {
  apiUrl: string;
  username: string;
  password: string;
  bearerToken?: string; // Used specifically for fetching task comments
}

export class ActiveCollabClient {
  private config: ActiveCollabConfig;

  constructor(config: ActiveCollabConfig) {
    this.config = config;
  }

  /**
   * Generate Basic Auth header (for projects/tasks)
   */
  private getBasicAuthHeader(): string {
    const credentials = `${this.config.username}:${this.config.password}`;
    const encoded = btoa(credentials);
    return `Basic ${encoded}`;
  }

  /**
   * Generate Bearer Token header (for comments)
   */
  private getBearerAuthHeader(): string {
    if (!this.config.bearerToken) {
      throw new Error('Bearer token not configured for comments endpoint');
    }
    return `Bearer ${this.config.bearerToken}`;
  }

  /**
   * Determine which auth method to use based on endpoint
   * - Bearer Token for /ac-get-task-comments and /ac_query_tasks.php (comments SQL query)
   * - Basic Auth for all other endpoints
   */
  private getAuthHeader(endpoint: string): string {
    // Use Bearer Token for comments-related endpoints
    if (endpoint.includes('/ac-get-task-comments') || endpoint.includes('/ac_query_tasks.php')) {
      console.log('Using Bearer Token authentication for comments endpoint');
      return this.getBearerAuthHeader();
    }
    console.log('Using Basic Auth for endpoint:', endpoint);
    return this.getBasicAuthHeader();
  }

  /**
   * Fetch task comments using SQL query endpoint
   * This is the correct endpoint for fetching comments from ActiveCollab
   */
  async getTaskComments(taskId: number | string): Promise<any> {
    const sqlQuery = `SELECT * FROM comments WHERE parent_type = 'Task' AND parent_id = ${taskId}`;
    console.log(`Fetching comments with SQL query for task ${taskId}`);
    
    const response = await this.post('/ac_query_tasks.php', {
      sql_query: sqlQuery,
    });
    
    // Extract comments from the 'details' array in response
    if (response && response.status === 'success' && Array.isArray(response.details)) {
      console.log(`Found ${response.details.length} comments for task ${taskId}`);
      return response.details;
    }
    
    console.warn(`Unexpected response format for comments: ${JSON.stringify(response).substring(0, 200)}`);
    return [];
  }

  /**
   * Make authenticated request to ActiveCollab API
   * Automatically selects auth method based on endpoint:
   * - Bearer Token for /ac-get-task-comments
   * - Basic Auth for all other endpoints
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    let baseUrl = this.config.apiUrl;
    
    // ac_query_tasks.php should be at root level, not under /api/v1
    if (endpoint.includes('ac_query_tasks.php')) {
      baseUrl = baseUrl.replace(/\/api\/v1\/?$/, '');
    }
    
    // Ensure proper URL construction (avoid double slashes)
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    const url = `${cleanBase}${cleanEndpoint}`;
    
    console.log(`ActiveCollab API Request: ${options.method || 'GET'} ${url}`);
    if (options.body) {
      console.log(`Request Body: ${options.body}`);
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.getAuthHeader(endpoint),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ActiveCollab HTTP error: ${response.status} - ${errorText}`);
      throw new Error(`ActiveCollab HTTP error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Check if the API returned an error payload (even with HTTP 200)
    if (data && typeof data === 'object') {
      if (data.status === 'error' || data.success === false) {
        const errorMsg = data.message || data.error || 'Unknown API error';
        console.error(`ActiveCollab API error response: ${errorMsg}`);
        throw new Error(`ActiveCollab API error: ${errorMsg}`);
      }
    }
    
    console.log(`ActiveCollab API Response: Success`);
    return data;
  }

  /**
   * GET request helper
   */
  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST request helper
   */
  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

/**
 * Initialize ActiveCollab client from environment variables
 */
export function createActiveCollabClient(): ActiveCollabClient {
  const apiUrl = Deno.env.get('ACTIVECOLLAB_API_URL');
  const username = Deno.env.get('ACTIVECOLLAB_USERNAME');
  const password = Deno.env.get('ACTIVECOLLAB_PASSWORD');

  if (!apiUrl || !username || !password) {
    throw new Error('Missing required ActiveCollab environment variables: ACTIVECOLLAB_API_URL, ACTIVECOLLAB_USERNAME, ACTIVECOLLAB_PASSWORD');
  }

  console.log(`Initializing ActiveCollab client with URL: ${apiUrl}`);

  return new ActiveCollabClient({
    apiUrl,
    username,
    password,
  });
}

/**
 * Get just the bearer token and API URL from database (no password decryption needed)
 * Used specifically for comments fetching where we only need bearer auth
 */
export async function getActiveCollabBearerConfig(): Promise<{ apiUrl: string; bearerToken: string } | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('Supabase credentials not available for bearer token fetch');
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('activecollab_credentials')
      .select('api_url, bearer_token')
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      console.error('Error fetching bearer token from database:', error);
      return null;
    }

    if (!data.bearer_token) {
      console.warn('No bearer token found in database');
      return null;
    }

    return {
      apiUrl: data.api_url,
      bearerToken: String(data.bearer_token),
    };
  } catch (error) {
    console.error('Error getting bearer config:', error);
    return null;
  }
}

/**
 * Fetch task comments directly using bearer token from database
 * This doesn't require the full client initialization with password decryption
 */
export async function fetchTaskCommentsDirect(taskId: number | string): Promise<any[]> {
  const config = await getActiveCollabBearerConfig();
  
  if (!config) {
    throw new Error('Bearer token not configured - check activecollab_credentials table');
  }
  
  // Construct URL - ac_query_tasks.php is at root level, not under /api/v1
  const baseUrl = config.apiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  const url = `${baseUrl}/ac_query_tasks.php`;
  
  const sqlQuery = `SELECT * FROM comments WHERE parent_type = 'Task' AND parent_id = ${taskId}`;
  
  console.log(`Fetching comments for task ${taskId} from ${url}`);
  console.log(`Using bearer token: ${config.bearerToken.substring(0, 20)}...`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.bearerToken}`,
    },
    body: JSON.stringify({ sql_query: sqlQuery }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Comments fetch error: ${response.status} - ${errorText}`);
    throw new Error(`Comments fetch failed: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (data && data.status === 'success' && Array.isArray(data.details)) {
    console.log(`Found ${data.details.length} comments for task ${taskId}`);
    return data.details;
  }
  
  console.warn(`Unexpected response format: ${JSON.stringify(data).substring(0, 200)}`);
  return [];
}

/**
 * Initialize ActiveCollab client from database credentials
 * This will try database first, then fall back to environment variables
 */
export async function createActiveCollabClientFromDb(): Promise<ActiveCollabClient> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('Supabase credentials not available, falling back to environment variables');
    return createActiveCollabClient();
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active credentials from database
    const { data, error } = await supabase
      .from('activecollab_credentials')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching credentials from database:', error);
      console.log('Falling back to environment variables');
      return createActiveCollabClient();
    }

    if (!data) {
      console.log('No active credentials in database, falling back to environment variables');
      return createActiveCollabClient();
    }

    // Decrypt password - email is now stored as plain text
    const decryptedPassword = await decryptValue(data.password_encrypted);
    
    // Use plain email from database (migration renamed email_base64 to email)
    const email = data.email;
    if (!email) {
      console.error('No email found in activecollab_credentials');
      throw new Error('Email not configured in activecollab_credentials');
    }
    console.log(`Using email for authentication: ${email}`);

    // Get bearer token directly from database - use as-is
    let bearerToken: string | undefined = undefined;
    if (data.bearer_token) {
      // bearer_token is stored as a base64-encoded string - use directly
      bearerToken = String(data.bearer_token);
      console.log('Bearer token retrieved from database for comments endpoint');
    }

    console.log(`Initializing ActiveCollab client from database with URL: ${data.api_url}`);
    if (bearerToken) {
      console.log('Bearer token configured for comments endpoint');
    } else {
      console.warn('WARNING: No bearer token configured - comments fetching may fail');
    }

    return new ActiveCollabClient({
      apiUrl: data.api_url,
      username: email,
      password: decryptedPassword,
      bearerToken: bearerToken,
    });
  } catch (error) {
    console.error('Error creating client from database:', error);
    console.log('Falling back to environment variables');
    return createActiveCollabClient();
  }
}
