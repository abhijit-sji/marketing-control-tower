import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitProject } from "@/hooks/useHackathon";
import { Upload } from "lucide-react";

export default function SubmissionForm() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event");
  const teamId = searchParams.get("team");
  const navigate = useNavigate();
  
  const submitMutation = useSubmitProject();

  const [projectTitle, setProjectTitle] = useState("");
  const [description, setDescription] = useState("");
  const [demoVideoUrl, setDemoVideoUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventId || !teamId) return;

    await submitMutation.mutateAsync({
      eventId,
      teamId,
      projectTitle,
      description,
      demoVideoUrl,
      githubUrl,
    });

    navigate(`/hackathon/dashboard?event=${eventId}`);
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Upload className="h-8 w-8" />
              Submit Your Project
            </CardTitle>
            <CardDescription className="text-base">
              Share your amazing creation with the judges and participants
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Project Title *</Label>
                <Input
                  id="title"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Enter your project name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Project Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your project, the problem it solves, and how it works"
                  rows={6}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="demo">Demo Video URL</Label>
                <Input
                  id="demo"
                  type="url"
                  value={demoVideoUrl}
                  onChange={(e) => setDemoVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="github">GitHub Repository URL</Label>
                <Input
                  id="github"
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/..."
                />
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(`/hackathon/dashboard?event=${eventId}`)}
                >
                  Save Draft
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={submitMutation.isPending || !projectTitle || !description}
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit Project"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
