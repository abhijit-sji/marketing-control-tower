export interface LinkedInLeader {
  id: string;
  name: string;
  title: string;
  department: string | null;
  linkedinUrl: string | null;
  targetAudience: Record<string, unknown>;
  personaTone: string;
  agentTemplateId: string | null;
  personalContext: {
    bio?: string;
    expertise_areas?: string[];
    journey?: string;
    meeting_scheduler?: string;
    [key: string]: unknown;
  } | null;
  styleOverrides: Record<string, unknown> | null;
  targetClientSegments: string[] | null;
  urlSlug: string | null;
  // Niche & Growth Phase fields
  nicheKeyword: string | null;
  nicheDomain: string | null;
  contentPhase: 'teach' | 'own_problem' | 'contextual_mention' | null;
  contentPhaseStartDate: string | null;
  weeklyRhythm: {
    teaching: number;
    opinion: number;
    how_to: number;
  } | null;
  postsThisWeek: {
    teaching: number;
    opinion: number;
    how_to: number;
  } | null;
  postsWeekStart: string | null;
  createdAt: string;
  updatedAt: string;
  uploadCount: number;
  trendCount: number;
  generatedPostCount: number;
}

export interface LeaderInput {
  name: string;
  title: string;
  department?: string | null;
  linkedinUrl?: string | null;
  targetAudience: Record<string, unknown>;
  personaTone: string;
  agentTemplateId?: string | null;
  userId?: string | null;
  // Niche & Growth Phase fields
  nicheKeyword?: string | null;
  nicheDomain?: string | null;
  contentPhase?: 'teach' | 'own_problem' | 'contextual_mention' | null;
  contentPhaseStartDate?: string | null;
}

export interface LeaderUpload {
  id: string;
  leaderId: string;
  fileName: string;
  fileUrl: string;
  fileSummary: string | null;
  fileType: 'url' | 'upload';
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
  openaiFileId?: string | null;
  fileIndexedAt?: string | null;
}

export interface UploadInput {
  fileName: string;
  fileUrl: string;
  fileSummary?: string | null;
}

export interface DocumentUploadInput {
  file: File;
  fileName: string;
  fileSummary?: string | null;
}

export interface WeeklyTrend {
  id: string;
  leaderId: string;
  weekStart: string;
  topicTitle: string;
  topicSummary: string;
  relevanceScore: number | null;
  createdAt: string;
}

export interface GeneratedPost {
  id: string;
  leaderId: string;
  sourceType: "trend" | "influencer" | "custom" | "youtube";
  sourceReference: string | null;
  postTitle: string;
  postBody: string;
  extraPayload: {
    carousel_outline?: string[];
    caption_ideas?: string[];
    post_type?: 'teaching' | 'opinion' | 'how_to' | 'carousel';
    raw?: unknown;
    // YouTube-specific fields
    youtube_metadata?: {
      title?: string;
      channel?: string;
      duration?: string;
      thumbnail_url?: string;
    };
    extraction?: {
      core_thesis?: string;
      key_data?: string[];
      golden_quotes?: string[];
      framework?: string;
    };
    angles?: Array<{
      headline: string;
      premise: string;
    }>;
    carousel_slides?: Array<{
      slide_number: number;
      headline: string;
      body: string;
      visual_note?: string;
    }>;
    [key: string]: unknown;
  };
  generatedAt: string;
  updatedAt: string;
}

export interface GeneratePostInput {
  sourceType: "trend" | "custom" | "youtube";
  sourceId?: string;
  youtubeUrl?: string;
  customContent?: string;
  headlineIdea?: string;
  callToAction?: string;
  model?: string;
  influencerStyles?: string[];
  generateCarousel?: boolean;
}

export interface AIPipelineConfig {
  use_dual_model?: boolean;
  research_model?: 'gemini' | 'perplexity';
  writing_model?: 'claude' | 'gpt5';
  research_depth?: 'quick' | 'standard' | 'deep';
}

export interface InfluencerStyle {
  id: string;
  influencer_name: string;
  platform: string;
  style_description: string;
  sample_posts: string[];
  is_active: boolean;
}

export interface UpdatePostInput {
  postTitle?: string;
  postBody?: string;
  extraPayload?: Record<string, unknown>;
}