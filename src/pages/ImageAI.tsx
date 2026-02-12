import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useImageGeneration, type GeneratedImage } from "@/hooks/useImageGeneration";
import { useImagePresets } from "@/hooks/useImagePresets";
import { useImageEditHistory } from "@/hooks/useImageEditHistory";
import { supabase } from "@/integrations/supabase/client";

// Components
import { PromptPanel } from "@/components/image-ai/PromptPanel";
import { ImagePreviewPanel } from "@/components/image-ai/ImagePreviewPanel";
import { EditHistorySidebar } from "@/components/image-ai/EditHistorySidebar";
import { TalkToEditChat } from "@/components/image-ai/TalkToEditChat";
import { ImageCardGrid } from "@/components/image-ai/ImageCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageIcon, AlertCircle, Grid, History, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function ImageAI() {
  // State
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("photorealistic");
  const [selectedRatio, setSelectedRatio] = useState("square");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [adminOverride, setAdminOverride] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "gallery">("create");
  const [showDebug, setShowDebug] = useState(false);
  const [lastError, setLastError] = useState<{
    type: string;
    message: string;
    suggestion?: string;
    debug?: any;
    canOverride?: boolean;
    triggeredCategories?: any[];
  } | null>(null);

  // Report dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [selectedBlockedImage, setSelectedBlockedImage] = useState<GeneratedImage | null>(null);

  // Hooks
  const { toast } = useToast();
  const {
    generateImage,
    editImage,
    fetchUserImages,
    getQuotaUsage,
    reportFalsePositive,
    images,
    quotaUsed,
    quotaLimit,
  } = useImageGeneration();
  const { stylePresets, aspectRatios, getSizeString } = useImagePresets();
  const { versionHistory, fetchVersionChain } = useImageEditHistory();

  // Load data on mount
  useEffect(() => {
    fetchUserImages();
    getQuotaUsage();
    checkAdminStatus();
  }, []);

  // Load version history when current image changes
  useEffect(() => {
    if (currentImage?.id) {
      fetchVersionChain(currentImage.id);
    }
  }, [currentImage?.id, fetchVersionChain]);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle(); // Use maybeSingle to handle missing role gracefully

      setIsAdmin(userRole?.role === "super_admin" || userRole?.role === "manager");
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt || prompt.trim().length < 5) {
      toast({
        title: "Invalid prompt",
        description: "Prompt must be at least 5 characters long",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setLastError(null);

    const size = getSizeString(selectedRatio);
    const { data, error } = await generateImage(prompt, size, selectedStyle, adminOverride);

    setIsGenerating(false);

    if (error) {
      const errorDetails = error.details;
      const errorType = error.type || "unknown";

      setLastError({
        type: errorType,
        message: error.message,
        suggestion: errorDetails?.suggestion,
        debug: error.debug,
        canOverride: error.canOverride,
        triggeredCategories: error.triggeredCategories,
      });

      toast({
        title: errorType === "content_safety"
          ? "Content Safety Block"
          : errorType === "quota_exceeded"
          ? "Quota Exceeded"
          : "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Success
    setAdminOverride(false);
    setPrompt("");
    toast({
      title: "Success!",
      description: adminOverride ? "Image generated with admin override" : "Image generated successfully",
    });

    // Set as current image and refresh
    if (data?.record) {
      setCurrentImage(data.record as unknown as GeneratedImage);
    }
    fetchUserImages();
    getQuotaUsage();
  }, [prompt, selectedRatio, selectedStyle, adminOverride, getSizeString, generateImage, fetchUserImages, getQuotaUsage, toast]);

  const handleEdit = useCallback(async (instruction: string) => {
    if (!currentImage?.id) return;

    setIsEditing(true);
    const { data, error } = await editImage(currentImage.id, instruction, adminOverride);
    setIsEditing(false);

    if (error) {
      toast({
        title: "Edit Failed",
        description: error.message,
        variant: "destructive",
      });
      throw new Error(error.message);
    }

    toast({
      title: "Edit Applied!",
      description: `Version ${data?.record?.version_number || "new"} created`,
    });

    // Update current image to the new version
    if (data?.record) {
      setCurrentImage(data.record as unknown as GeneratedImage);
    }
    fetchUserImages();
  }, [currentImage?.id, adminOverride, editImage, fetchUserImages, toast]);

  const handleDownload = useCallback(async (imageUrl: string, imagePrompt: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gemini-${imagePrompt.slice(0, 30).replace(/[^a-z0-9]/gi, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download the image",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleSelectImage = useCallback((image: GeneratedImage) => {
    setCurrentImage(image);
    setActiveTab("create");
  }, []);

  const handleReportFalsePositive = useCallback(async () => {
    if (!selectedBlockedImage || !reportReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for reporting",
        variant: "destructive",
      });
      return;
    }

    const { error } = await reportFalsePositive(
      selectedBlockedImage.id,
      selectedBlockedImage.prompt,
      reportReason
    );

    if (error) {
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Report Submitted",
      description: "Thank you! Admins will review your report shortly.",
    });

    setReportDialogOpen(false);
    setReportReason("");
    setSelectedBlockedImage(null);
  }, [selectedBlockedImage, reportReason, reportFalsePositive, toast]);

  return (
    <div className="w-full py-6 px-6 h-[calc(100vh-4rem)]">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "gallery")} className="h-full flex flex-col">
        {/* Header with tabs inline */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <ImageIcon className="w-7 h-7" />
              Image AI Studio
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate and edit images using Google Gemini AI
            </p>
          </div>
          <TabsList>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Create & Edit
            </TabsTrigger>
            <TabsTrigger value="gallery" className="flex items-center gap-2">
              <Grid className="w-4 h-4" />
              Gallery ({images.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Create & Edit Tab - Split Screen Layout */}
        <TabsContent value="create" className="flex-1 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
            {/* Left Panel - Prompt & Settings */}
            <div className="lg:col-span-3 overflow-y-auto">
              <PromptPanel
                prompt={prompt}
                onPromptChange={setPrompt}
                selectedStyle={selectedStyle}
                onStyleChange={setSelectedStyle}
                selectedRatio={selectedRatio}
                onRatioChange={setSelectedRatio}
                stylePresets={stylePresets}
                aspectRatios={aspectRatios}
                isGenerating={isGenerating}
                isAdmin={isAdmin}
                adminOverride={adminOverride}
                onAdminOverrideChange={setAdminOverride}
                onGenerate={handleGenerate}
                quotaUsed={quotaUsed}
                quotaLimit={quotaLimit}
              />

              {/* Error display */}
              {lastError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {lastError.type === "content_safety" ? "Content Safety Block" : "Error"}
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p className="text-sm">{lastError.message}</p>
                    {lastError.suggestion && (
                      <p className="text-xs italic">{lastError.suggestion}</p>
                    )}
                    {lastError.debug && (
                      <Collapsible open={showDebug} onOpenChange={setShowDebug}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full">
                            {showDebug ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                            Debug Details
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto max-h-40">
                            {JSON.stringify(lastError.debug, null, 2)}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setLastError(null)}>
                      Dismiss
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Center Panel - Image Preview */}
            <div className="lg:col-span-6">
              <ImagePreviewPanel
                image={currentImage}
                isGenerating={isGenerating}
                isEdit={isEditing}
                onDownload={handleDownload}
                className="h-full"
              />
            </div>

            {/* Right Panel - Edit History & Chat */}
            <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden">
              {/* Version History */}
              <div className="flex-1 min-h-0">
                <EditHistorySidebar
                  currentImage={currentImage}
                  versionHistory={versionHistory}
                  onSelectVersion={setCurrentImage}
                  className="h-full"
                />
              </div>

              {/* Talk to Edit */}
              <div className="h-[280px]">
                <TalkToEditChat
                  currentImageId={currentImage?.id || null}
                  currentImageUrl={currentImage?.image_url || null}
                  onEdit={handleEdit}
                  isEditing={isEditing}
                  className="h-full"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Gallery Tab */}
        <TabsContent value="gallery" className="flex-1 mt-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Your Generated Images
              </CardTitle>
              <CardDescription>
                All images expire after 30 days. Click an image to edit it.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[calc(100%-5rem)] overflow-hidden">
              <ScrollArea className="h-full">
                {images.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>No images generated yet.</p>
                    <p className="text-sm">Switch to the Create tab to generate your first image!</p>
                  </div>
                ) : (
                  <ImageCardGrid
                    images={images as GeneratedImage[]}
                    selectedId={currentImage?.id}
                    onSelect={handleSelectImage}
                    onDownload={handleDownload}
                    onEdit={(img) => {
                      setCurrentImage(img);
                      setActiveTab("create");
                    }}
                    onReportFalsePositive={(img) => {
                      setSelectedBlockedImage(img);
                      setReportDialogOpen(true);
                    }}
                    columns={4}
                  />
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Report False Positive Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report False Positive</DialogTitle>
            <DialogDescription>
              Help us improve content safety filters by reporting false positives.
            </DialogDescription>
          </DialogHeader>

          {selectedBlockedImage && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-semibold mb-1">Blocked Prompt:</p>
                <p className="text-sm text-muted-foreground">{selectedBlockedImage.prompt}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reportReason">
                  Why do you believe this is a false positive?
                </Label>
                <Textarea
                  id="reportReason"
                  placeholder="Please explain why this prompt should be allowed..."
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReportFalsePositive} disabled={!reportReason.trim()}>
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
