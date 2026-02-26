import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bug, Lightbulb } from "lucide-react";

export default function SubmitFeedbackPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"bug" | "feature">("bug");
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    email: "",
  });

  // Set initial tab based on URL parameter
  useEffect(() => {
    const typeParam = searchParams.get("type");
    if (typeParam === "bug" || typeParam === "feature") {
      setActiveTab(typeParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("feedback_reports")
        .insert({
          type: activeTab,
          subject: formData.subject,
          description: formData.description,
          email: formData.email || user?.email || null,
          created_by: user?.id || null,
        });

      if (error) throw error;

      toast({
        title: "Feedback submitted",
        description: `Thank you for your ${activeTab === "bug" ? "bug report" : "feature request"}! We'll review it soon.`,
      });

      navigate("/feedback/history");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit feedback",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          required
          value={formData.subject}
          onChange={(e) =>
            setFormData({ ...formData, subject: e.target.value })
          }
          placeholder={
            activeTab === "bug"
              ? "Brief description of the issue"
              : "Brief description of your feature idea"
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          required
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder={
            activeTab === "bug"
              ? "Please describe the bug, steps to reproduce, and expected behavior..."
              : "Describe your feature idea, use cases, and expected benefits..."
          }
          rows={6}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email (optional)</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) =>
            setFormData({ ...formData, email: e.target.value })
          }
          placeholder="your@email.com"
        />
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit {activeTab === "bug" ? "Bug Report" : "Feature Request"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(-1)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );

  return (
    <div className="container max-w-2xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Submit Feedback</h1>
          <p className="text-muted-foreground">
            Help us improve by reporting bugs or suggesting new features
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Choose Feedback Type</CardTitle>
            <CardDescription>
              Select whether you're reporting a bug or requesting a feature
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "bug" | "feature")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="bug" className="flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Bug Report
                </TabsTrigger>
                <TabsTrigger value="feature" className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Feature Request
                </TabsTrigger>
              </TabsList>

              <TabsContent value="bug" className="space-y-4 pt-4">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <h3 className="font-semibold text-red-900">Report a Bug</h3>
                  <p className="text-sm text-red-700">
                    Found something that's not working as expected? Let us know so we can fix it.
                  </p>
                </div>
                {renderForm()}
              </TabsContent>

              <TabsContent value="feature" className="space-y-4 pt-4">
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <h3 className="font-semibold text-purple-900">Request a Feature</h3>
                  <p className="text-sm text-purple-700">
                    Have an idea for a new feature or improvement? We'd love to hear it!
                  </p>
                </div>
                {renderForm()}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
