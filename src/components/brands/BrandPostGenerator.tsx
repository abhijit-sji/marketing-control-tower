import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Wand2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Leader {
  id: string;
  name: string;
  title: string;
  url_slug: string | null;
}

interface BrandPostGeneratorProps {
  brandId: string;
  brandSlug: string;
  brandName: string;
  leaders: Leader[];
  indexedFilesCount: number;
}

export const BrandPostGenerator = ({
  brandId,
  brandSlug,
  brandName,
  leaders,
  indexedFilesCount,
}: BrandPostGeneratorProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>("");
  const [postType, setPostType] = useState<"feature" | "trend" | "custom">("feature");
  const [customContent, setCustomContent] = useState("");
  const [featureAnnouncement, setFeatureAnnouncement] = useState("");

  const selectedLeader = leaders.find(l => l.id === selectedLeaderId);

  const handleGenerate = () => {
    if (!selectedLeaderId) {
      toast({
        title: "Please select a leader",
        description: "Choose who will author this post.",
        variant: "destructive",
      });
      return;
    }

    if (postType === "feature" && !featureAnnouncement.trim()) {
      toast({
        title: "Feature description required",
        description: "Please describe the feature you want to promote.",
        variant: "destructive",
      });
      return;
    }

    if (postType === "custom" && !customContent.trim()) {
      toast({
        title: "Custom content required",
        description: "Please provide your custom post idea.",
        variant: "destructive",
      });
      return;
    }

    const params = new URLSearchParams({
      brandId,
      leaderId: selectedLeaderId,
      sourceType: postType === "trend" ? "trend" : "custom",
    });

    if (postType === "feature") {
      params.append("featureAnnouncement", featureAnnouncement);
    } else if (postType === "custom") {
      params.append("customContent", customContent);
    }

    navigate(
      `/content/leaders/${selectedLeader?.url_slug || selectedLeaderId}/generate?${params.toString()}`
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Brand Post</CardTitle>
        <CardDescription>
          Create a LinkedIn post about {brandName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Who's posting?</Label>
          <Select value={selectedLeaderId} onValueChange={setSelectedLeaderId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a thought leader" />
            </SelectTrigger>
            <SelectContent>
              {leaders.map((leader) => (
                <SelectItem key={leader.id} value={leader.id}>
                  {leader.name} - {leader.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>Post topic</Label>
          <RadioGroup value={postType} onValueChange={(v) => setPostType(v as any)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="feature" id="feature" />
              <Label htmlFor="feature" className="font-normal cursor-pointer">
                Feature announcement
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="trend" id="trend" />
              <Label htmlFor="trend" className="font-normal cursor-pointer">
                Industry trend
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="custom" />
              <Label htmlFor="custom" className="font-normal cursor-pointer">
                Custom idea
              </Label>
            </div>
          </RadioGroup>
        </div>

        {postType === "feature" && (
          <div className="space-y-2">
            <Label htmlFor="feature-input">Feature to promote</Label>
            <Textarea
              id="feature-input"
              value={featureAnnouncement}
              onChange={(e) => setFeatureAnnouncement(e.target.value)}
              placeholder="E.g., New AI-powered workflow builder that automates 80% of repetitive tasks..."
              rows={4}
            />
          </div>
        )}

        {postType === "custom" && (
          <div className="space-y-2">
            <Label htmlFor="custom-input">Your post idea</Label>
            <Textarea
              id="custom-input"
              value={customContent}
              onChange={(e) => setCustomContent(e.target.value)}
              placeholder="Describe what you want this post to be about..."
              rows={4}
            />
          </div>
        )}

        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm">Knowledge Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span>Company knowledge (SJ Innovation)</span>
            </div>
            <div className="flex items-center gap-2">
              {indexedFilesCount > 0 ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  <span>
                    {brandName} knowledge ({indexedFilesCount} files indexed)
                  </span>
                </>
              ) : (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                  <span className="text-muted-foreground">
                    {brandName} knowledge (no files indexed)
                  </span>
                </>
              )}
            </div>
            {selectedLeader && (
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span>{selectedLeader.name}'s voice & style</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleGenerate} className="w-full" size="lg">
          <Wand2 className="mr-2 h-4 w-4" />
          Generate Post
        </Button>
      </CardContent>
    </Card>
  );
};
