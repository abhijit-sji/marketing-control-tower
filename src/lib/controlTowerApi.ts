// ================================================
// SJ Control Tower API Client
// ================================================
// This module provides a type-safe client for interacting with the
// SJ Control Tower API via our Supabase edge function proxy

import { supabase } from "@/integrations/supabase/client";

// ================================================
// Type Definitions
// ================================================

export interface EmployeeBasic {
  id: string;
  name: string;
  title: string;
  department: string;
  location: string;
}

export interface EmployeeFull extends EmployeeBasic {
  email: string;
  phone: string;
  role: string;
  reporting_manager_id: string;
  reporting_manager_email: string;
  reporting_manager_name: string;
  dotted_line_manager_email: string;
  created_at: string;
  updated_at: string;
}

export interface Pod {
  id: string;
  name: string;
  description: string;
  color: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface PodMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  title: string;
  joined_at: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface EmployeesResponse {
  employees: EmployeeFull[];
  pagination: Pagination;
}

export interface EmployeeResponse {
  employee: EmployeeFull;
}

export interface PodsResponse {
  pods: Pod[];
  pagination: Pagination;
}

export interface PodResponse {
  pod: Pod;
}

export interface PodMembersResponse {
  pod: Pod;
  members: PodMember[];
  total_members: number;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  meeting_type?: string;
  start_time: string;
  end_time: string;
  location?: string;
  attendees?: string[];
  organizer?: string;
  status?: string;
  meeting_link?: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingsResponse {
  meetings: Meeting[];
  pagination: Pagination;
}

// ================================================
// Control Tower API Client Class
// ================================================

class ControlTowerAPI {
  /**
   * Internal method to call the edge function proxy
   */
  private async callProxy(endpoint: string, params?: Record<string, any>): Promise<any> {
    try {
      console.log('🚀 Calling control-tower-proxy with:', { endpoint, params });

      const { data, error } = await supabase.functions.invoke('control-tower-proxy', {
        body: { endpoint, method: 'GET', params }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to call Control Tower API');
      }

      console.log('✅ Control Tower proxy response:', {
        dataType: typeof data,
        isArray: Array.isArray(data),
        dataLength: Array.isArray(data) ? data.length : 'N/A',
        data: Array.isArray(data) ? `Array[${data.length}]` : data
      });

      // Check if the response has an error status
      if (data?.status === 'error') {
        throw new Error(data.message || 'API returned an error');
      }

      // Check if data has an error property (might be from Control Tower)
      if (data?.error) {
        throw new Error(data.error.message || data.error || 'Control Tower API error');
      }

      return data;
    } catch (error) {
      console.error('Control Tower API error:', error);
      throw error;
    }
  }

  // ================================================
  // Employees API Methods
  // ================================================

  /**
   * Get all employees with optional filtering and pagination
   * @param params - Query parameters for filtering and pagination
   * @returns Promise with employees list and pagination info
   */
  async getEmployees(params?: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    location?: string;
  }): Promise<EmployeesResponse> {
    const response = await this.callProxy('/api/v1/employees', params);
    return response.data || response;
  }

  /**
   * Get a single employee by ID
   * @param id - Employee ID
   * @returns Promise with employee details
   */
  async getEmployee(id: string): Promise<EmployeeResponse> {
    const response = await this.callProxy(`/api/v1/employees/${id}`);
    return response.data || response;
  }

  // ================================================
  // PODs API Methods
  // ================================================

  /**
   * Get all PODs with optional filtering and pagination
   * @param params - Query parameters for filtering and pagination
   * @returns Promise with PODs list and pagination info
   */
  async getPods(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PodsResponse> {
    const response = await this.callProxy('/api/v1/pods', params);
    return response.data || response;
  }

  /**
   * Get a single POD by ID
   * @param id - POD ID
   * @returns Promise with POD details
   */
  async getPod(id: string): Promise<PodResponse> {
    const response = await this.callProxy(`/api/v1/pods/${id}`);
    return response.data || response;
  }

  /**
   * Get all members of a specific POD
   * @param id - POD ID
   * @returns Promise with POD details and member list
   */
  async getPodMembers(id: string): Promise<PodMembersResponse> {
    const response = await this.callProxy(`/api/v1/pods/${id}/members`);
    return response.data || response;
  }

  async getEmployeesLocal(params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    department?: string; 
  }): Promise<EmployeesResponse> {
    let query = (supabase as any)
      .from('employees')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('first_name', { ascending: true });
    
    if (params?.search) {
      query = query.or(`first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%,email.ilike.%${params.search}%`);
    }
    
    if (params?.department) {
      query = query.eq('department', params.department);
    }
    
    const limit = params?.limit || 20;
    const page = params?.page || 1;
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);
    
    const { data, error, count } = await query;
    if (error) throw error;
    
    return { 
      employees: (data || []).map((e: any) => ({ 
        id: e.employee_id, 
        email: e.email, 
        first_name: e.first_name, 
        last_name: e.last_name, 
        name: e.full_name || `${e.first_name} ${e.last_name}`, 
        title: e.title, 
        department: e.department, 
        location: e.location, 
        phone: e.phone, 
        role: e.role, 
        reporting_manager_id: e.reporting_manager_id, 
        reporting_manager_email: e.reporting_manager_email, 
        reporting_manager_name: e.reporting_manager_name, 
        dotted_line_manager_email: e.dotted_line_manager_email, 
        created_at: e.created_at, 
        updated_at: e.updated_at 
      })), 
      pagination: { 
        page, 
        limit, 
        total: count || 0, 
        total_pages: Math.ceil((count || 0) / limit) 
      } 
    };
  }

  async getPodsLocal(params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
  }): Promise<PodsResponse> {
    let query = (supabase as any)
      .from('pods')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('name', { ascending: true });
    
    if (params?.search) {
      query = query.ilike('name', `%${params.search}%`);
    }
    
    const limit = params?.limit || 50;
    const page = params?.page || 1;
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);
    
    const { data, error, count } = await query;
    if (error) throw error;
    
    return { 
      pods: (data || []).map((p: any) => ({ 
        id: p.pod_id, 
        name: p.name, 
        description: p.description, 
        color: p.color, 
        member_count: p.member_count, 
        is_active: p.is_active, 
        created_at: p.created_at, 
        updated_at: p.updated_at 
      })), 
      pagination: { 
        page, 
        limit, 
        total: count || 0, 
        total_pages: Math.ceil((count || 0) / limit) 
      } 
    };
  }

  async getPodMembersLocal(id: string): Promise<PodMembersResponse> {
    const { data: pod, error: podError } = await (supabase as any)
      .from('pods')
      .select('*')
      .eq('pod_id', id)
      .single();
    
    if (podError) throw podError;
    
    const { data: members, error: membersError } = await (supabase as any)
      .from('pod_members')
      .select('*, employee:employees!pod_members_employee_id_fkey(*)')
      .eq('pod_id', id)
      .order('joined_at', { ascending: false });
    
    if (membersError) throw membersError;
    
    return { 
      pod: { 
        id: pod.pod_id, 
        name: pod.name, 
        description: pod.description, 
        color: pod.color, 
        is_active: pod.is_active, 
        member_count: pod.member_count, 
        created_at: pod.created_at, 
        updated_at: pod.updated_at 
      }, 
      members: (members || []).map((m: any) => ({ 
        id: m.employee.employee_id, 
        user_id: m.user_id, 
        full_name: m.employee.full_name || `${m.employee.first_name} ${m.employee.last_name}`, 
        email: m.employee.email, 
        title: m.employee.title, 
        joined_at: m.joined_at 
      })), 
      total_members: (members || []).length 
    };
  }

  async triggerSync(): Promise<{ status: string; message: string }> {
    const { data, error } = await supabase.functions.invoke('employee-sync', { body: {} });
    if (error) throw error;
    return data;
  }

  // ================================================
  // Meetings API Methods
  // ================================================

  /**
   * Get all meetings with optional filtering and pagination
   * @param params - Query parameters for filtering and pagination
   * @returns Promise with meetings list and pagination info
   */
  async getMeetings(params?: {
    client_id?: string;
    project_id?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<MeetingsResponse> {
    console.log('🔍 getMeetings called with params:', params);

    // Build query params for Control Tower API
    const page = params?.page || 1;
    const limit = params?.limit || 20;

    const queryParams: Record<string, string> = {
      page: String(page),
      limit: String(limit),
    };

    // Add search filter if provided
    if (params?.search) {
      queryParams['search'] = params.search;
    }

    // Add project filter if provided
    if (params?.project_id) {
      queryParams['project_id'] = params.project_id;
    }

    // Add client filter if provided
    if (params?.client_id) {
      queryParams['client_id'] = params.client_id;
    }

    console.log('📤 Calling proxy with queryParams:', queryParams);

    const response = await this.callProxy('/api-v1-zoom-files', queryParams);

    console.log('📥 Raw response from proxy:', JSON.stringify(response, null, 2));
    console.log('📥 Response status:', response?.status);
    console.log('📥 Response data:', response?.data);
    console.log('📥 Zoom files array:', response?.data?.zoom_files);

    // Handle Control Tower API response format: { status, data: { zoom_files, pagination } }
    const zoomFiles = response?.data?.zoom_files || [];
    const pagination = response?.data?.pagination || { page, limit, total: 0, total_pages: 0 };

    console.log(`✅ Found ${zoomFiles.length} meetings to transform`);
    console.log('📊 Pagination:', pagination);

    const transformedMeetings = zoomFiles.map((zm: any) => ({
      id: zm.id,
      title: zm.meeting_topic || 'Untitled Meeting',
      description: zm.transcript_summary || zm.summary_overview || '',
      meeting_type: zm.meeting_type || 'zoom',
      start_time: zm.meeting_start_time,
      end_time: zm.meeting_start_time, // No end_time in zoom_files, use start_time
      location: 'Zoom',
      attendees: [],
      organizer: zm.host_name || zm.host_email || '',
      status: zm.status || 'completed',
      meeting_link: zm.slug || '',
      created_at: zm.created_at || zm.meeting_start_time,
      updated_at: zm.updated_at || zm.meeting_start_time,
      // Additional fields from Control Tower
      client_name: zm.client_name,
      project_name: zm.project_name,
    }));

    return {
      meetings: transformedMeetings,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        total_pages: pagination.total_pages,
      },
    };
  }

  /**
   * Get a single meeting by ID
   * @param id - Meeting ID
   * @returns Promise with meeting details
   */
  async getMeeting(id: string): Promise<{ meeting: Meeting }> {
    const response = await this.callProxy(`/api-v1-zoom-files/${id}`, {});

    const zm = response?.data?.zoom_file || response?.data;
    if (!zm) {
      throw new Error('Meeting not found');
    }

    const meeting: Meeting = {
      id: zm.id,
      title: zm.meeting_topic || 'Untitled Meeting',
      description: zm.transcript_summary || zm.summary_overview || '',
      meeting_type: zm.meeting_type || 'zoom',
      start_time: zm.meeting_start_time,
      end_time: zm.meeting_start_time,
      location: 'Zoom',
      attendees: [],
      organizer: zm.host_name || zm.host_email || '',
      status: zm.status || 'completed',
      meeting_link: zm.slug || '',
      created_at: zm.created_at || zm.meeting_start_time,
      updated_at: zm.updated_at || zm.meeting_start_time,
    };

    return { meeting };
  }

  /**
   * Get meeting transcript by ID
   * @param id - Meeting ID
   * @returns Promise with meeting transcript
   */
  async getMeetingTranscript(id: string): Promise<{ transcript: string }> {
    const response = await this.callProxy(`/api-v1-zoom-files/${id}`, {});

    const zm = response?.data?.zoom_file || response?.data;
    if (!zm) {
      throw new Error('Meeting not found');
    }

    return { transcript: zm.transcript_summary || zm.summary_overview || '' };
  }
}

// ================================================
// Export singleton instance
// ================================================

export const controlTowerAPI = new ControlTowerAPI();
