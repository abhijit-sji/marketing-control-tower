import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useFeedbackStats } from "@/hooks/useFeedbackStats";
import { FeedbackStatsCards } from "@/components/feedback/FeedbackStatsCards";
import { FeedbackQuickSubmit } from "@/components/feedback/FeedbackQuickSubmit";
import { FeedbackStatusOverview } from "@/components/feedback/FeedbackStatusOverview";
import { FeedbackListItem } from "@/components/feedback/FeedbackListItem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Bug, Lightbulb, List, Search, RefreshCw, MessageSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type FeedbackType = "all" | "bug" | "feature";
type FeedbackStatus = "all" | "resolved" | "closed";

const ITEMS_PER_PAGE = 10;

const formatTimestamp = (iso: string) => format(new Date(iso), "MMM d, yyyy · h:mm a");

export default function MyFeedbackPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<FeedbackType>("bug");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);

  // Handle tab change - reset pagination
  const handleTabChange = (tab: FeedbackType) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setStatusFilter("all");
  };

  const { data: stats, isLoading: statsLoading } = useFeedbackStats();

  // Query for paginated feedback items
  const { data: feedbackData, isLoading: itemsLoading, refetch } = useQuery({
    queryKey: ["feedback-list", activeTab, statusFilter, searchQuery, currentPage],
    queryFn: async () => {
      let query = supabase
        .from("feedback_reports")
        .select(`
          id,
          feedback_number,
          type,
          subject,
          description,
          status,
          priority,
          module,
          upvotes,
          created_at,
          updated_at,
          feedback_comments(id, comment, created_at, user_id)
        `, { count: 'exact' })
        .is("deleted_at", null);

      // For "bug" and "feature" tabs: only show open + in_progress
      if (activeTab === "bug") {
        query = query.eq("type", "bug").in("status", ["open", "in_progress"]);
      } else if (activeTab === "feature") {
        query = query.eq("type", "feature").in("status", ["open", "in_progress"]);
      } else if (activeTab === "all") {
        // "All" tab shows resolved + closed items only
        if (statusFilter === "all") {
          query = query.in("status", ["resolved", "closed"]);
        } else {
          query = query.eq("status", statusFilter);
        }
      }

      if (searchQuery.trim()) {
        query = query.or(`subject.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      // Apply pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);
      
      if (error) throw error;

      // Fetch user names for comments
      const allUserIds = (data || [])
        .flatMap((r) => r.feedback_comments?.map((c: any) => c.user_id).filter(Boolean) || []);
      
      let userMap = new Map<string, string>();
      if (allUserIds.length > 0) {
        const uniqueIds = [...new Set(allUserIds)];
        const { data: users } = await supabase
          .from("users")
          .select("id, first_name, last_name, email")
          .in("id", uniqueIds);
        
        if (users) {
          userMap = new Map(
            users.map((u) => {
              const name = `${u.first_name || ""} ${u.last_name || ""}`.trim();
              return [u.id, name || u.email || "Unknown"];
            })
          );
        }
      }

      const mappedData = (data || []).map((record) => ({
        ...record,
        feedback_comments: (record.feedback_comments || []).map((c: any) => ({
          ...c,
          author_name: c.user_id === user?.id ? "You" : userMap.get(c.user_id) || "Team member",
        })),
      }));

      // Sort: open items first, then by created_at descending
      const statusOrder: Record<string, number> = {
        open: 0,
        in_progress: 1,
        closed: 2,
        resolved: 3,
      };

      const sortedData = mappedData.sort((a, b) => {
        const orderA = statusOrder[a.status] ?? 99;
        const orderB = statusOrder[b.status] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return {
        items: sortedData,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
      };
    },
  });

  // Separate queries for tab counts
  const { data: tabCounts } = useQuery({
    queryKey: ["feedback-tab-counts", searchQuery],
    queryFn: async () => {
      // Count bugs (open + in_progress only)
      const { count: bugCount } = await supabase
        .from("feedback_reports")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("type", "bug")
        .in("status", ["open", "in_progress"]);

      // Count features (open + in_progress only)
      const { count: featureCount } = await supabase
        .from("feedback_reports")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("type", "feature")
        .in("status", ["open", "in_progress"]);

      // Count all (resolved + closed only)
      const { count: allCount } = await supabase
        .from("feedback_reports")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("status", ["resolved", "closed"]);

      return {
        bugs: bugCount || 0,
        features: featureCount || 0,
        all: allCount || 0,
      };
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ feedbackId, comment }: { feedbackId: string; comment: string }) => {
      if (!user) throw new Error("Not authenticated");
      const trimmed = comment.trim();
      if (!trimmed) throw new Error("Comment cannot be empty");

      const { error } = await supabase.from("feedback_comments").insert({
        feedback_id: feedbackId,
        comment: trimmed,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      setCommentDrafts((prev) => ({ ...prev, [variables.feedbackId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["feedback-list"] });
      toast({ title: "Comment added", description: "Your comment was posted successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const feedbackItems = feedbackData?.items || [];
  const totalPages = feedbackData?.totalPages || 1;

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    // Always show first page
    pages.push(1);
    
    if (currentPage > 3) {
      pages.push("ellipsis");
    }
    
    // Show pages around current
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }
    
    if (currentPage < totalPages - 2) {
      pages.push("ellipsis");
    }
    
    // Always show last page
    if (!pages.includes(totalPages)) {
      pages.push(totalPages);
    }
    
    return pages;
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bugs & Feedback</h1>
          <p className="text-muted-foreground">Track bugs, feature requests, and their progress</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={itemsLoading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", itemsLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <FeedbackStatsCards
        openBugs={stats?.openBugs || 0}
        openFeatures={stats?.openFeatures || 0}
        inProgress={stats?.inProgress || 0}
        resolved={stats?.resolved || 0}
        criticalBugs={stats?.criticalBugs || 0}
        highBugs={stats?.highBugs || 0}
        isLoading={statsLoading}
      />

      {/* Quick Submit */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Submit</h2>
        <FeedbackQuickSubmit />
      </div>

      {/* Status Overview */}
      {stats && (
        <FeedbackStatusOverview
          bugsByStatus={stats.bugsByStatus}
          featuresByStatus={stats.featuresByStatus}
        />
      )}

      {/* Feedback List */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Feedback Items</h2>
        
        <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as FeedbackType)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="bug" className="gap-2">
                <Bug className="h-4 w-4" />
                Bugs ({tabCounts?.bugs || 0})
              </TabsTrigger>
              <TabsTrigger value="feature" className="gap-2">
                <Lightbulb className="h-4 w-4" />
                Features ({tabCounts?.features || 0})
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-2">
                <List className="h-4 w-4" />
                All ({tabCounts?.all || 0})
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 w-48"
                />
              </div>
              {/* Only show status filter for "All" tab */}
              {activeTab === "all" && (
                <Select value={statusFilter} onValueChange={(v) => {
                  setStatusFilter(v as FeedbackStatus);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            {itemsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : feedbackItems && feedbackItems.length > 0 ? (
              <div className="space-y-3">
                {feedbackItems.map((item) => (
                  <div key={item.id}>
                    <FeedbackListItem
                      id={item.id}
                      feedbackNumber={item.feedback_number || 0}
                      type={item.type as "bug" | "feature"}
                      subject={item.subject}
                      description={item.description}
                      status={item.status}
                      priority={item.priority || undefined}
                      module={item.module || undefined}
                      upvotes={item.upvotes || 0}
                      commentCount={item.feedback_comments?.length || 0}
                      createdAt={item.created_at}
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    />
                    
                    {/* Expanded Detail View */}
                    {expandedId === item.id && (
                      <Card className="mt-2 ml-4 border-l-4 border-l-primary/50">
                        <CardContent className="pt-4 space-y-4">
                          {/* Full Description */}
                          <div>
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              Description
                            </h4>
                            <p className="text-sm whitespace-pre-wrap">{item.description}</p>
                          </div>

                          <Separator />

                          {/* Comments Section */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                Comments ({item.feedback_comments?.length || 0})
                              </h4>
                            </div>

                            {item.feedback_comments && item.feedback_comments.length > 0 ? (
                              <div className="space-y-2 mb-4">
                                {item.feedback_comments.map((comment: any) => (
                                  <div
                                    key={comment.id}
                                    className="rounded-lg border bg-muted/40 p-3"
                                  >
                                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                      <span className="font-medium text-foreground">
                                        {comment.author_name}
                                      </span>
                                      <span>{formatTimestamp(comment.created_at)}</span>
                                    </div>
                                    <p className="text-sm">{comment.comment}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground mb-4">
                                No comments yet. Add one below.
                              </p>
                            )}

                            {/* Add Comment Form */}
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                commentMutation.mutate({
                                  feedbackId: item.id,
                                  comment: commentDrafts[item.id] || "",
                                });
                              }}
                              className="space-y-2"
                            >
                              <Textarea
                                placeholder="Add a comment..."
                                value={commentDrafts[item.id] || ""}
                                onChange={(e) =>
                                  setCommentDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                className="min-h-[80px]"
                              />
                              <div className="flex justify-end">
                                <Button
                                  type="submit"
                                  size="sm"
                                  disabled={
                                    commentMutation.isPending &&
                                    commentMutation.variables?.feedbackId === item.id
                                  }
                                >
                                  {commentMutation.isPending &&
                                  commentMutation.variables?.feedbackId === item.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : null}
                                  Add Comment
                                </Button>
                              </div>
                            </form>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className={cn(
                              "cursor-pointer",
                              currentPage === 1 && "pointer-events-none opacity-50"
                            )}
                          />
                        </PaginationItem>
                        
                        {getPageNumbers().map((page, index) => (
                          <PaginationItem key={index}>
                            {page === "ellipsis" ? (
                              <span className="px-3 py-2">...</span>
                            ) : (
                              <PaginationLink
                                isActive={page === currentPage}
                                onClick={() => setCurrentPage(page)}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            )}
                          </PaginationItem>
                        ))}
                        
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className={cn(
                              "cursor-pointer",
                              currentPage === totalPages && "pointer-events-none opacity-50"
                            )}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    {activeTab === "all" 
                      ? "No resolved or closed items found" 
                      : "No open items found"}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate("/feedback/submit")}
                  >
                    Submit Feedback
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
