import { useMemo, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Check, AlertCircle, FileText, Building2, Users, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useLinkedInLeader,
  useWeeklyTrends,
  useLeaderUploads,
} from "@/features/linkedin-content/hooks";
import { useGenerateLinkedInPost } from "@/hooks/useGenerateLinkedInPost";
import { GeneratePostView } from "@/features/linkedin-content/components/GeneratePostView";
import type { GeneratePostInput } from "@/features/linkedin-content/types";


const resolveReturnPath = (pathname: string, fallback?: string) => {
  if (fallback) return fallback;
  if (pathname.endsWith("/generate")) {
    return pathname.replace(/\/generate$/, "");
  }
  return pathname;
};

const LinkedInGeneratePostPage = () => {
  const { leaderSlug } = useParams<{ leaderSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const locationState = (location.state as { defaultSource?: GeneratePostInput; from?: string } | null) ?? null;

  const { data: leader, isLoading: leaderLoading } = useLinkedInLeader(leaderSlug);
  const leaderId = leader?.id;

  // Fetch company vector store
  const { data: vectorStore } = useQuery({
    queryKey: ['company-vector-store'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_shared_resources')
        .select('*')
        .eq('resource_type', 'vector_store')
        .eq('resource_name', 'company_knowledge')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // Redirect from UUID to slug URL
  useEffect(() => {
    if (leader && leaderSlug && leader.urlSlug && leaderSlug !== leader.urlSlug) {
      const currentPath = location.pathname;
      const newPath = currentPath.replace(leaderSlug, leader.urlSlug);
      navigate(newPath, { replace: true });
    }
  }, [leader, leaderSlug, navigate, location.pathname]);

  const { data: trends = [], isLoading: trendsLoading } = useWeeklyTrends(leaderId);
  const { data: uploads = [] } = useLeaderUploads(leaderId);
  const { data: influencers = [], isLoading: influencersLoading } = useQuery({
    queryKey: ['influencer-style-library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencer_style_library')
        .select('*')
        .eq('is_active', true)
        .order('influencer_name');
      if (error) throw error;
      return data;
    }
  });
  const generateMutation = useGenerateLinkedInPost(leaderId);

  const detailPath = useMemo(
    () => resolveReturnPath(location.pathname, locationState?.from),
    [location.pathname, locationState?.from],
  );

  const handleCancel = () => {
    navigate(detailPath, { replace: true });
  };

  const handleSubmit = async (payload: GeneratePostInput) => {
    if (!leaderSlug) return;
    
    try {
      const result = await generateMutation.mutateAsync(payload);
      
      // Navigate to result page
      navigate(`/content/linkedin/${leaderSlug}/generate/result`, {
        state: { result },
        replace: true,
      });
    } catch (error) {
      console.error('Failed to generate post', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (!leaderSlug) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Missing leader identifier</p>
      </div>
    );
  }

  if (leaderLoading || !leader) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading leader context…
        </div>
      </div>
    );
  }

  const leaderContext = `${leader.title} at ${leader.department || 'the company'}. Tone: ${leader.personaTone}. ${leader.personalContext?.bio || ''}`;

  // Calculate indexed files
  const indexedFiles = uploads.filter(u => u.openaiFileId);
  const notIndexedFiles = uploads.filter(u => !u.openaiFileId);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 py-6">
      <Button variant="ghost" className="w-fit" onClick={handleCancel}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to leader overview
      </Button>

      <Card>
        <CardContent className="space-y-1 py-4">
          <h1 className="text-2xl font-semibold">{leader.name}</h1>
          <p className="text-sm text-muted-foreground">{leader.title}</p>
          {leader.linkedinUrl && (
            <a
              href={leader.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              View LinkedIn profile
            </a>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Knowledge Sources</CardTitle>
          <CardDescription>
            AI will search these sources when generating posts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* TIER 1: Shared Company Knowledge */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Building2 className="h-3 w-3" />
                Shared
              </Badge>
              <span className="text-sm font-semibold">SJ Innovation Company Knowledge</span>
            </div>
            
            <div className="pl-4 space-y-2">
              {vectorStore ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      Vector store active with {(vectorStore.metadata as any)?.file_count || '?'} files
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ✓ Company overview, culture, services, goals (accessible to all agents)
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <span>No shared vector store created yet</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Contact admin to create shared company knowledge
                  </p>
                </>
              )}
            </div>
          </div>

          {/* TIER 2: Personal Leader Files */}
          {uploads.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="gap-1">
                  <Users className="h-3 w-3" />
                  Personal
                </Badge>
                <span className="text-sm font-semibold">
                  {leader.name}'s Knowledge ({indexedFiles.length}/{uploads.length} indexed)
                </span>
              </div>
              
              <div className="space-y-2 pl-4">
                {indexedFiles.map(upload => (
                  <div key={upload.id} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 truncate">{upload.fileName}</span>
                  </div>
                ))}
                {notIndexedFiles.map(upload => (
                  <div key={upload.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 truncate">{upload.fileName}</span>
                    <Badge variant="outline" className="text-xs">not indexed</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}


          {uploads.length === 0 && !vectorStore && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No knowledge sources available</p>
              <p className="text-xs mt-1">Add personal documents or contact admin for shared knowledge</p>
            </div>
          )}
        </CardContent>
      </Card>

      <GeneratePostView
        leaderId={leaderId}
        leaderName={leader.name}
        leaderContext={leaderContext}
        trends={trends}
        influencers={influencers}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        defaultSource={locationState?.defaultSource}
        isGenerating={generateMutation.isPending}
        influencersLoading={influencersLoading}
        trendsLoading={trendsLoading}
      />
    </div>
  );
};

export default LinkedInGeneratePostPage;
