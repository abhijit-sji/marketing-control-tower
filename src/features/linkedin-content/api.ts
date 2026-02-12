import axiosPrivate from "@/lib/axiosPrivate";
import { supabase } from "@/integrations/supabase/client";
import {
  LinkedInLeader,
  LeaderInput,
  LeaderUpload,
  UploadInput,
  DocumentUploadInput,
  WeeklyTrend,
  GeneratedPost,
  GeneratePostInput,
  UpdatePostInput,
} from "./types";

type LeaderRecord = {
  id: string;
  name: string;
  title: string;
  department: string | null;
  linkedin_url: string | null;
  target_audience: Record<string, unknown> | string | null;
  persona_tone: string;
  default_prompt: string;
  guide_text: string | null;
  agent_template_id: string | null;
  personal_context: Record<string, unknown> | null;
  style_overrides: Record<string, unknown> | null;
  target_client_segments: string[] | null;
  url_slug: string | null;
  // Niche & Growth Phase fields
  niche_keyword: string | null;
  niche_domain: string | null;
  content_phase: 'teach' | 'own_problem' | 'contextual_mention' | null;
  content_phase_start_date: string | null;
  weekly_rhythm: { teaching: number; opinion: number; how_to: number } | null;
  posts_this_week: { teaching: number; opinion: number; how_to: number } | null;
  posts_week_start: string | null;
  created_at: string;
  updated_at: string;
  upload_count?: number | null;
  trend_count?: number | null;
  generated_post_count?: number | null;
};

type UploadRecord = {
  id: string;
  leader_id: string;
  file_name: string;
  file_url: string;
  file_summary: string | null;
  file_type: 'url' | 'upload';
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  openai_file_id?: string | null;
  file_indexed_at?: string | null;
};

type TrendRecord = {
  id: string;
  leader_id: string;
  week_start: string;
  topic_title: string;
  topic_summary: string;
  relevance_score: number | null;
  created_at: string;
};

type PostRecord = {
  id: string;
  leader_id: string;
  source_type: "trend" | "influencer" | "custom";
  source_reference: string | null;
  post_title: string;
  post_body: string;
  extra_payload: Record<string, unknown> | null;
  generated_at: string;
  updated_at: string;
};

const parseAudience = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      return { description: trimmed };
    }
  }
  return {};
};

const mapLeader = (record: LeaderRecord): LinkedInLeader => ({
  id: record.id,
  name: record.name,
  title: record.title,
  department: record.department ?? null,
  linkedinUrl: record.linkedin_url ?? null,
  targetAudience: parseAudience(record.target_audience),
  personaTone: record.persona_tone,
  agentTemplateId: record.agent_template_id ?? null,
  personalContext: record.personal_context ?? null,
  styleOverrides: record.style_overrides ?? null,
  targetClientSegments: record.target_client_segments ?? null,
  urlSlug: record.url_slug ?? null,
  // Niche & Growth Phase fields
  nicheKeyword: record.niche_keyword ?? null,
  nicheDomain: record.niche_domain ?? null,
  contentPhase: record.content_phase ?? null,
  contentPhaseStartDate: record.content_phase_start_date ?? null,
  weeklyRhythm: record.weekly_rhythm ?? { teaching: 2, opinion: 1, how_to: 1 },
  postsThisWeek: record.posts_this_week ?? { teaching: 0, opinion: 0, how_to: 0 },
  postsWeekStart: record.posts_week_start ?? null,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
  uploadCount: Number(record.upload_count ?? 0),
  trendCount: Number(record.trend_count ?? 0),
  generatedPostCount: Number(record.generated_post_count ?? 0),
});

const mapUpload = (record: UploadRecord): LeaderUpload => ({
  id: record.id,
  leaderId: record.leader_id,
  fileName: record.file_name,
  fileUrl: record.file_url,
  fileSummary: record.file_summary ?? null,
  fileType: record.file_type,
  fileSize: record.file_size,
  mimeType: record.mime_type,
  createdAt: record.created_at,
  openaiFileId: record.openai_file_id ?? null,
  fileIndexedAt: record.file_indexed_at ?? null,
});

const mapTrend = (record: TrendRecord): WeeklyTrend => ({
  id: record.id,
  leaderId: record.leader_id,
  weekStart: record.week_start,
  topicTitle: record.topic_title,
  topicSummary: record.topic_summary,
  relevanceScore: record.relevance_score !== null ? Number(record.relevance_score) : null,
  createdAt: record.created_at,
});

const mapPost = (record: PostRecord): GeneratedPost => ({
  id: record.id,
  leaderId: record.leader_id,
  sourceType: record.source_type,
  sourceReference: record.source_reference ?? null,
  postTitle: record.post_title,
  postBody: record.post_body,
  extraPayload: record.extra_payload ?? {},
  generatedAt: record.generated_at,
  updatedAt: record.updated_at,
});

const serializeLeader = (input: LeaderInput) => ({
  name: input.name,
  title: input.title,
  department: input.department ?? null,
  linkedin_url: input.linkedinUrl ?? null,
  target_audience: input.targetAudience ?? {},
  persona_tone: input.personaTone,
  agent_template_id: input.agentTemplateId ?? null,
  user_id: input.userId ?? null,
});

export async function fetchLeaders(): Promise<LinkedInLeader[]> {
  const { data } = await axiosPrivate.get<{ leaders: LeaderRecord[] }>("/linkedin-content/leaders");
  return (data?.leaders ?? []).map(mapLeader);
}

export async function fetchLeader(leaderSlugOrId: string): Promise<LinkedInLeader> {
  // Try to fetch by slug first if it doesn't look like a UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leaderSlugOrId);
  
  if (!isUUID) {
    // Try fetching by slug
    try {
      const { data } = await axiosPrivate.get<{ leader: LeaderRecord }>(`/linkedin-content/leaders/by-slug/${leaderSlugOrId}`);
      if (data?.leader) {
        return mapLeader(data.leader);
      }
    } catch (error) {
      // Fall through to UUID fetch
    }
  }
  
  // Fallback to UUID fetch
  const { data } = await axiosPrivate.get<{ leader: LeaderRecord }>(`/linkedin-content/leaders/${leaderSlugOrId}`);
  if (!data?.leader) {
    throw new Error("Leader not found");
  }
  return mapLeader(data.leader);
}

export async function createLeader(payload: LeaderInput): Promise<LinkedInLeader> {
  const { data } = await axiosPrivate.post<{ leader: LeaderRecord }>("/linkedin-content/leaders", serializeLeader(payload));
  if (!data?.leader) {
    throw new Error("Failed to create leader");
  }
  return mapLeader(data.leader);
}

export async function updateLeader(leaderId: string, payload: LeaderInput): Promise<LinkedInLeader> {
  const { data } = await axiosPrivate.put<{ leader: LeaderRecord }>(
    `/linkedin-content/leaders/${leaderId}`,
    serializeLeader(payload),
  );
  if (!data?.leader) {
    throw new Error("Failed to update leader");
  }
  return mapLeader(data.leader);
}

export async function deleteLeader(leaderId: string): Promise<void> {
  await axiosPrivate.delete(`/linkedin-content/leaders/${leaderId}`);
}

export async function fetchUploads(leaderId: string): Promise<LeaderUpload[]> {
  const { data } = await axiosPrivate.get<{ uploads: UploadRecord[] }>(`/linkedin-content/leaders/${leaderId}/uploads`);
  return (data?.uploads ?? []).map(mapUpload);
}

export async function uploadDocument(leaderId: string, payload: DocumentUploadInput): Promise<LeaderUpload> {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('leaderId', leaderId);
  formData.append('fileName', payload.fileName);
  if (payload.fileSummary) {
    formData.append('fileSummary', payload.fileSummary);
  }

  const { data: response } = await supabase.functions.invoke('linkedin-upload-document', {
    body: formData,
  });

  if (!response?.success) {
    throw new Error(response?.error || 'Failed to upload document');
  }

  return mapUpload(response.data as UploadRecord);
}

export async function createUpload(leaderId: string, payload: UploadInput): Promise<LeaderUpload> {
  const { data } = await axiosPrivate.post<{ upload: UploadRecord }>(
    `/linkedin-content/leaders/${leaderId}/uploads`,
    {
      fileName: payload.fileName,
      fileUrl: payload.fileUrl,
      fileSummary: payload.fileSummary ?? null,
    },
  );
  if (!data?.upload) {
    throw new Error("Failed to create upload");
  }
  return mapUpload(data.upload);
}

export async function deleteUpload(leaderId: string, uploadId: string): Promise<void> {
  await axiosPrivate.delete(`/linkedin-content/leaders/${leaderId}/uploads/${uploadId}`);
}

export async function fetchWeeklyTrends(leaderId: string): Promise<WeeklyTrend[]> {
  const { data } = await axiosPrivate.get<{ trends: TrendRecord[] }>(`/linkedin-content/leaders/${leaderId}/trends`);
  return (data?.trends ?? []).map(mapTrend);
}

export async function generateWeeklyTrends(leaderId: string): Promise<WeeklyTrend[]> {
  const { data } = await axiosPrivate.post<{ trends: TrendRecord[] }>(
    `/linkedin-content/leaders/${leaderId}/trends`,
    {},
  );
  return (data?.trends ?? []).map(mapTrend);
}

export async function fetchGeneratedPosts(leaderId: string): Promise<GeneratedPost[]> {
  const { data } = await axiosPrivate.get<{ posts: PostRecord[] }>(`/linkedin-content/leaders/${leaderId}/posts`);
  return (data?.posts ?? []).map(mapPost);
}

export async function generatePost(leaderId: string, payload: GeneratePostInput): Promise<GeneratedPost> {
  const { data } = await axiosPrivate.post<{ post: PostRecord }>(
    `/linkedin-content/leaders/${leaderId}/posts`,
    payload,
  );
  if (!data?.post) {
    throw new Error("Failed to generate post");
  }
  return mapPost(data.post);
}

export async function updateGeneratedPost(
  leaderId: string,
  postId: string,
  payload: UpdatePostInput,
): Promise<GeneratedPost> {
  const { data } = await axiosPrivate.put<{ post: PostRecord }>(
    `/linkedin-content/leaders/${leaderId}/posts/${postId}`,
    payload,
  );
  if (!data?.post) {
    throw new Error("Failed to update post");
  }
  return mapPost(data.post);
}

export async function deleteGeneratedPost(
  leaderId: string,
  postId: string
): Promise<void> {
  await axiosPrivate.delete(`/linkedin-content/leaders/${leaderId}/posts/${postId}`);
}
