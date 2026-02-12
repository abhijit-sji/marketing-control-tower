import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  Sparkles,
  FileText,
  Linkedin,
  Mail,
  Download,
  Edit2,
  Save,
  X,
  Loader2,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface HookIdea {
  text: string;
  performance_reason: string;
}

interface TopAsset {
  hook: string;
  angle: string;
  script_30sec: string;
  newsletter_subject: string;
  newsletter_preview: string;
  linkedin_post: string;
  hashtags: string[];
}

interface CalendarEntry {
  content_id: string;
  suggested_date: string;
  channel: string;
  cta: string;
}

interface ContentOutput {
  content_id: string;
  content_title: string;
  hooks: HookIdea[];
  top_3: TopAsset[];
  calendar: CalendarEntry;
}

interface ContentCalendarViewProps {
  contentOutputs: ContentOutput[];
  brandId?: string;
  onApprove?: (selectedItems: { contentId: string; assetIndex: number }[]) => void;
}

export function ContentCalendarView({ contentOutputs, brandId, onApprove }: ContentCalendarViewProps) {
  const { toast } = useToast();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [expandedContent, setExpandedContent] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<{ contentId: string; assetIndex: number }[]>([]);
  const [assetDialog, setAssetDialog] = useState<{
    contentId: string;
    asset: TopAsset;
    assetIndex: number;
  } | null>(null);
  
  // Editing state
  const [editingAsset, setEditingAsset] = useState<{ contentId: string; assetIndex: number } | null>(null);
  const [editedAssets, setEditedAssets] = useState<Record<string, TopAsset>>({});
  const [savingToBrand, setSavingToBrand] = useState<string | null>(null);

  const getAssetKey = (contentId: string, assetIndex: number) => `${contentId}-${assetIndex}`;

  const getCurrentAsset = (contentId: string, assetIndex: number, originalAsset: TopAsset): TopAsset => {
    const key = getAssetKey(contentId, assetIndex);
    return editedAssets[key] || originalAsset;
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(key);
      setTimeout(() => setCopiedItem(null), 2000);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const toggleAsset = (contentId: string, assetIndex: number) => {
    setSelectedAssets((prev) => {
      const exists = prev.find((s) => s.contentId === contentId && s.assetIndex === assetIndex);
      if (exists) {
        return prev.filter((s) => !(s.contentId === contentId && s.assetIndex === assetIndex));
      }
      return [...prev, { contentId, assetIndex }];
    });
  };

  const isAssetSelected = (contentId: string, assetIndex: number) =>
    selectedAssets.some((s) => s.contentId === contentId && s.assetIndex === assetIndex);

  const handleStartEdit = (contentId: string, assetIndex: number, asset: TopAsset) => {
    const key = getAssetKey(contentId, assetIndex);
    if (!editedAssets[key]) {
      setEditedAssets(prev => ({ ...prev, [key]: { ...asset } }));
    }
    setEditingAsset({ contentId, assetIndex });
  };

  const handleCancelEdit = () => {
    setEditingAsset(null);
  };

  const handleSaveEdit = () => {
    setEditingAsset(null);
    toast({ title: "Changes saved locally" });
  };

  const handleAssetChange = (contentId: string, assetIndex: number, field: keyof TopAsset, value: string | string[]) => {
    const key = getAssetKey(contentId, assetIndex);
    setEditedAssets(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
  };

  const handleSaveToBrand = async (contentId: string, assetIndex: number, asset: TopAsset) => {
    if (!brandId) {
      toast({ title: "No brand selected", variant: "destructive" });
      return;
    }

    const key = getAssetKey(contentId, assetIndex);
    setSavingToBrand(key);

    try {
      const { error } = await supabase.from("brand_generated_posts").insert({
        brand_id: brandId,
        post_title: asset.hook,
        post_body: asset.linkedin_post,
        source_type: "content_strategist",
        source_reference: contentId,
        extra_payload: {
          angle: asset.angle,
          script_30sec: asset.script_30sec,
          newsletter_subject: asset.newsletter_subject,
          newsletter_preview: asset.newsletter_preview,
          hashtags: asset.hashtags,
        },
      });

      if (error) throw error;
      toast({ title: "Saved to brand content library" });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSavingToBrand(null);
    }
  };

  const handleApprove = () => {
    if (selectedAssets.length === 0) {
      toast({ title: "Select at least one asset", variant: "destructive" });
      return;
    }
    onApprove?.(selectedAssets);
  };

  const handleExportCSV = () => {
    const rows = contentOutputs.flatMap((content) =>
      content.top_3.map((asset, i) => {
        const current = getCurrentAsset(content.content_id, i, asset);
        return {
          content_title: content.content_title,
          hook: current.hook,
          angle: current.angle,
          channel: content.calendar?.channel || "LinkedIn",
          suggested_date: content.calendar?.suggested_date || "",
          cta: content.calendar?.cta || "",
          linkedin_post: current.linkedin_post,
          hashtags: current.hashtags?.join(", ") || "",
        };
      })
    );

    const headers = Object.keys(rows[0] || {}).join(",");
    const csv = [
      headers,
      ...rows.map((row) =>
        Object.values(row)
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `content-calendar-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: "Calendar exported" });
  };

  if (!contentOutputs || contentOutputs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No content strategies generated yet.
        </CardContent>
      </Card>
    );
  }

  const isEditing = (contentId: string, assetIndex: number) =>
    editingAsset?.contentId === contentId && editingAsset?.assetIndex === assetIndex;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Content Calendar</h2>
            <p className="text-sm text-muted-foreground">
              {contentOutputs.length} content items •{" "}
              {contentOutputs.reduce((sum, c) => sum + (c.hooks?.length || 0), 0)} hooks generated
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={handleApprove} disabled={selectedAssets.length === 0}>
            Approve Selected ({selectedAssets.length})
          </Button>
        </div>
      </div>

      {/* Content Items */}
      {contentOutputs.map((content) => (
        <Card key={content.content_id}>
          <Collapsible
            open={expandedContent === content.content_id}
            onOpenChange={(open) => setExpandedContent(open ? content.content_id : null)}
          >
            <CardHeader>
              <CollapsibleTrigger asChild>
                <div className="flex items-start justify-between cursor-pointer">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{content.content_title}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Badge variant="outline">{content.hooks?.length || 0} hooks</Badge>
                      <Badge variant="outline">{content.top_3?.length || 0} assets</Badge>
                      {content.calendar?.suggested_date && (
                        <Badge variant="secondary" className="gap-1">
                          <Calendar className="h-3 w-3" />
                          {content.calendar.suggested_date}
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                  {expandedContent === content.content_id ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                {/* Hook Ideas */}
                {content.hooks && content.hooks.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Hook Ideas</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {content.hooks.map((hook, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <p className="font-medium text-sm">{hook.text}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {hook.performance_reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top 3 Assets */}
                {content.top_3 && content.top_3.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Repurpose Assets</h4>
                    <div className="space-y-3">
                      {content.top_3.map((originalAsset, i) => {
                        const asset = getCurrentAsset(content.content_id, i, originalAsset);
                        const editing = isEditing(content.content_id, i);
                        const assetKey = getAssetKey(content.content_id, i);

                        return (
                          <div
                            key={i}
                            className="p-4 rounded-lg border hover:border-primary/50 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={isAssetSelected(content.content_id, i)}
                                onCheckedChange={() => toggleAsset(content.content_id, i)}
                              />
                              <div className="flex-1 space-y-2">
                                {editing ? (
                                  <Input
                                    value={asset.hook}
                                    onChange={(e) => handleAssetChange(content.content_id, i, "hook", e.target.value)}
                                    className="font-medium"
                                  />
                                ) : (
                                  <p className="font-medium">{asset.hook}</p>
                                )}
                                
                                {editing ? (
                                  <Textarea
                                    value={asset.linkedin_post}
                                    onChange={(e) => handleAssetChange(content.content_id, i, "linkedin_post", e.target.value)}
                                    rows={4}
                                    className="text-sm"
                                  />
                                ) : (
                                  <p className="text-sm text-muted-foreground">{asset.angle}</p>
                                )}

                                {editing ? (
                                  <Input
                                    value={asset.hashtags?.join(", ") || ""}
                                    onChange={(e) => handleAssetChange(content.content_id, i, "hashtags", e.target.value.split(",").map(t => t.trim()))}
                                    placeholder="Hashtags (comma separated)"
                                    className="text-xs"
                                  />
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {asset.hashtags?.map((tag, j) => (
                                      <Badge key={j} variant="outline" className="text-xs">
                                        #{tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                  {editing ? (
                                    <>
                                      <Button variant="default" size="sm" onClick={handleSaveEdit}>
                                        <Save className="h-4 w-4 mr-1" />
                                        Save
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                                        <X className="h-4 w-4 mr-1" />
                                        Cancel
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleStartEdit(content.content_id, i, asset)}
                                      >
                                        <Edit2 className="h-4 w-4 mr-1" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          setAssetDialog({ contentId: content.content_id, asset, assetIndex: i })
                                        }
                                      >
                                        <FileText className="h-4 w-4 mr-1" />
                                        View Full
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleCopy(asset.linkedin_post, `linkedin-${content.content_id}-${i}`)
                                        }
                                      >
                                        {copiedItem === `linkedin-${content.content_id}-${i}` ? (
                                          <Check className="h-4 w-4 mr-1" />
                                        ) : (
                                          <Linkedin className="h-4 w-4 mr-1" />
                                        )}
                                        Copy LinkedIn
                                      </Button>
                                      {brandId && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleSaveToBrand(content.content_id, i, asset)}
                                          disabled={savingToBrand === assetKey}
                                        >
                                          {savingToBrand === assetKey ? (
                                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                          ) : (
                                            <Save className="h-4 w-4 mr-1" />
                                          )}
                                          Save to Brand
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Calendar Entry */}
                {content.calendar && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Suggested Schedule
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Date</p>
                        <p className="font-medium">{content.calendar.suggested_date}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Channel</p>
                        <p className="font-medium">{content.calendar.channel}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">CTA</p>
                        <p className="font-medium">{content.calendar.cta}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}

      {/* Asset Detail Dialog with Editing */}
      <Dialog open={!!assetDialog} onOpenChange={() => setAssetDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{assetDialog?.asset.hook}</DialogTitle>
            <DialogDescription>{assetDialog?.asset.angle}</DialogDescription>
          </DialogHeader>
          {assetDialog && (
            <div className="space-y-6">
              {/* 30-Second Script */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  30-Second Script
                </h4>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="whitespace-pre-wrap">{assetDialog.asset.script_30sec}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => handleCopy(assetDialog.asset.script_30sec, "script")}
                >
                  {copiedItem === "script" ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  Copy Script
                </Button>
              </div>

              {/* Newsletter */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Newsletter
                </h4>
                <div className="p-4 rounded-lg bg-muted space-y-2">
                  <p className="font-medium">{assetDialog.asset.newsletter_subject}</p>
                  <p className="text-muted-foreground">{assetDialog.asset.newsletter_preview}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    handleCopy(
                      `Subject: ${assetDialog.asset.newsletter_subject}\n\n${assetDialog.asset.newsletter_preview}`,
                      "newsletter"
                    )
                  }
                >
                  {copiedItem === "newsletter" ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  Copy Newsletter
                </Button>
              </div>

              {/* LinkedIn Post */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Linkedin className="h-4 w-4" />
                  LinkedIn Post
                </h4>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="whitespace-pre-wrap">{assetDialog.asset.linkedin_post}</p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {assetDialog.asset.hashtags?.map((tag, i) => (
                      <Badge key={i} variant="secondary">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopy(
                        `${assetDialog.asset.linkedin_post}\n\n${assetDialog.asset.hashtags?.map((t) => `#${t}`).join(" ")}`,
                        "linkedin-full"
                      )
                    }
                  >
                    {copiedItem === "linkedin-full" ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    Copy Full Post
                  </Button>
                  {brandId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleSaveToBrand(assetDialog.contentId, assetDialog.assetIndex, assetDialog.asset);
                        setAssetDialog(null);
                      }}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save to Brand
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
