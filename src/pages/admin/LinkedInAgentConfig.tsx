import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Plus, Trash2, Edit, Upload, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { UploadDialog, NewKnowledgeDialog, UploadInfluencerDialog, NewInfluencerDialog } from "./LinkedInAgentConfigDialogs";

interface AgentTemplate {
  id: string;
  template_name: string;
  role_category: string;
  persona_tone: string;
  system_prompt: string;
  is_active: boolean;
}

interface KnowledgeBase {
  id: string;
  knowledge_type: string;
  title: string;
  content: string;
  keywords: string[];
  is_active: boolean;
  effective_date: string;
}

interface InfluencerStyle {
  id: string;
  influencer_name: string;
  platform: string;
  style_description: string;
  sample_posts: string[];
  is_active: boolean;
}

export default function LinkedInAgentConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeBase | null>(null);
  const [selectedInfluencer, setSelectedInfluencer] = useState<InfluencerStyle | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [newKnowledgeDialogOpen, setNewKnowledgeDialogOpen] = useState(false);
  const [newKnowledgeForm, setNewKnowledgeForm] = useState({
    title: '',
    content: '',
    knowledge_type: 'company_info',
    keywords: ''
  });
  const [newInfluencerForm, setNewInfluencerForm] = useState({
    influencer_name: '',
    platform: 'linkedin',
    style_description: '',
    sample_posts: '',
  });
  const [newInfluencerDialogOpen, setNewInfluencerDialogOpen] = useState(false);
  const [uploadInfluencerDialogOpen, setUploadInfluencerDialogOpen] = useState(false);

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['linkedin-agent-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('linkedin_agent_templates')
        .select('*')
        .order('template_name');
      if (error) throw error;
      return data as AgentTemplate[];
    }
  });

  // Fetch knowledge base
  const { data: knowledge, isLoading: knowledgeLoading } = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .order('knowledge_type', { ascending: true });
      if (error) throw error;
      return data as KnowledgeBase[];
    }
  });

  // Fetch influencer styles
  const { data: influencers, isLoading: influencersLoading } = useQuery({
    queryKey: ['influencer-style-library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencer_style_library')
        .select('*')
        .order('influencer_name');
      if (error) throw error;
      return data as InfluencerStyle[];
    }
  });

  // Update template mutation
  const updateTemplate = useMutation({
    mutationFn: async (template: AgentTemplate) => {
      const { error } = await supabase
        .from('linkedin_agent_templates')
        .update({
          template_name: template.template_name,
          system_prompt: template.system_prompt,
          persona_tone: template.persona_tone,
          is_active: template.is_active
        })
        .eq('id', template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-agent-templates'] });
      toast({ title: "Template updated successfully" });
      setSelectedTemplate(null);
    },
    onError: (error) => {
      toast({ title: "Error updating template", description: error.message, variant: "destructive" });
    }
  });

  // Update knowledge mutation
  const updateKnowledge = useMutation({
    mutationFn: async (kb: KnowledgeBase) => {
      const { error } = await supabase
        .from('knowledge_base')
        .update({
          title: kb.title,
          content: kb.content,
          knowledge_type: kb.knowledge_type,
          is_active: kb.is_active
        })
        .eq('id', kb.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast({ title: "Knowledge base updated successfully" });
      setSelectedKnowledge(null);
    },
    onError: (error) => {
      toast({ title: "Error updating knowledge", description: error.message, variant: "destructive" });
    }
  });

  // Update influencer mutation
  const updateInfluencer = useMutation({
    mutationFn: async (inf: InfluencerStyle) => {
      const { error } = await supabase
        .from('influencer_style_library')
        .update({
          influencer_name: inf.influencer_name,
          style_description: inf.style_description,
          sample_posts: inf.sample_posts,
          is_active: inf.is_active
        })
        .eq('id', inf.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['influencer-style-library'] });
      toast({ title: "Influencer style updated successfully" });
      setSelectedInfluencer(null);
    },
    onError: (error) => {
      toast({ title: "Error updating influencer", description: error.message, variant: "destructive" });
    }
  });

  // Create knowledge mutation
  const createKnowledge = useMutation({
    mutationFn: async (newEntry: typeof newKnowledgeForm) => {
      const { error } = await supabase
        .from('knowledge_base')
        .insert({
          title: newEntry.title,
          content: newEntry.content,
          knowledge_type: newEntry.knowledge_type,
          keywords: newEntry.keywords ? newEntry.keywords.split(',').map((k) => k.trim()) : [],
          is_active: true,
          effective_date: new Date().toISOString().split('T')[0]
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast({ title: "Knowledge entry created successfully" });
      setUploadDialogOpen(false);
      setNewKnowledgeDialogOpen(false);
      setNewKnowledgeForm({ title: '', content: '', knowledge_type: 'company_info', keywords: '' });
    },
    onError: (error) => {
      toast({ title: "Error creating entry", description: error.message, variant: "destructive" });
    },
  });

  // Delete knowledge mutation
  const deleteKnowledge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      toast({ title: "Knowledge entry deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error deleting entry", description: error.message, variant: "destructive" });
    },
  });

  // Create influencer mutation
  const createInfluencer = useMutation({
    mutationFn: async (newEntry: typeof newInfluencerForm) => {
      const { error } = await supabase
        .from('influencer_style_library')
        .insert({
          influencer_name: newEntry.influencer_name,
          platform: newEntry.platform,
          style_description: newEntry.style_description,
          sample_posts: newEntry.sample_posts.split('---').map(p => p.trim()).filter(Boolean),
          is_active: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['influencer-style-library'] });
      toast({ title: "Influencer style created successfully" });
      setUploadInfluencerDialogOpen(false);
      setNewInfluencerDialogOpen(false);
      setNewInfluencerForm({ influencer_name: '', platform: 'linkedin', style_description: '', sample_posts: '' });
    },
    onError: (error) => {
      toast({ title: "Error creating influencer style", description: error.message, variant: "destructive" });
    },
  });

  // Delete influencer mutation
  const deleteInfluencer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('influencer_style_library')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['influencer-style-library'] });
      toast({ title: "Influencer style deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error deleting influencer", description: error.message, variant: "destructive" });
    },
  });

  // File upload handler
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setNewKnowledgeForm({
        title: file.name.replace(/\.[^/.]+$/, ""),
        content,
        knowledge_type: 'company_info',
        keywords: ''
      });
      setUploadDialogOpen(true);
    };
    reader.readAsText(file);
  }, []);

  // Influencer file upload handler
  const handleInfluencerFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      // Parse content into sample posts (split by double newline or numbered lists)
      const posts = content.split(/\n\n+|\n\d+\.\s/).filter(p => p.trim());
      setNewInfluencerForm({
        influencer_name: file.name.replace(/\.[^/.]+$/, ""),
        platform: 'linkedin',
        style_description: '',
        sample_posts: posts.slice(0, 5).join('\n---\n'), // Take first 5 posts
      });
      setUploadInfluencerDialogOpen(true);
    };
    reader.readAsText(file);
  }, []);

  const handleCreateKnowledge = () => {
    createKnowledge.mutate(newKnowledgeForm);
  };

  const handleDeleteKnowledge = (id: string) => {
    if (confirm("Are you sure you want to delete this knowledge entry?")) {
      deleteKnowledge.mutate(id);
    }
  };

  const handleCreateInfluencer = () => {
    createInfluencer.mutate(newInfluencerForm);
  };

  const handleDeleteInfluencer = (id: string) => {
    if (confirm("Are you sure you want to delete this influencer style?")) {
      deleteInfluencer.mutate(id);
    }
  };

  if (templatesLoading || knowledgeLoading || influencersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 p-6 border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
        <h2 className="text-xl font-bold mb-2 text-amber-900 dark:text-amber-100">⚠️ This Page Has Moved</h2>
        <p className="text-amber-800 dark:text-amber-200 mb-4">
          LinkedIn Agent configuration is now integrated into the unified AI Control Panel for better management.
        </p>
        <Button onClick={() => window.location.href = '/adminpanel/ai-control'}>
          Go to AI Control Panel
        </Button>
      </div>
      <div className="mb-8 opacity-50">
        <h1 className="text-3xl font-bold mb-2">LinkedIn AI Agent Configuration</h1>
        <p className="text-muted-foreground">
          This interface is deprecated. Please use the AI Control Panel instead.
        </p>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="templates">Agent Prompts</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="influencers">Influencer Styles</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {templates?.length || 0} agent prompts configured
            </p>
          </div>

          <div className="grid gap-4">
            {templates?.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{template.template_name}</CardTitle>
                      <CardDescription>
                        {template.role_category} · {template.persona_tone}
                      </CardDescription>
                    </div>
                    <Dialog open={selectedTemplate?.id === template.id} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedTemplate(template)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit Agent Prompt: {template.template_name}</DialogTitle>
                          <DialogDescription>
                            Update the system prompt and configuration. This master prompt will be used when generating LinkedIn posts.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div>
                            <Label>Prompt Name</Label>
                            <Input
                              value={selectedTemplate?.template_name || ""}
                              onChange={(e) =>
                                setSelectedTemplate({ ...selectedTemplate!, template_name: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label>Persona Tone</Label>
                            <Input
                              value={selectedTemplate?.persona_tone || ""}
                              onChange={(e) =>
                                setSelectedTemplate({ ...selectedTemplate!, persona_tone: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label>System Prompt</Label>
                            <Textarea
                              value={selectedTemplate?.system_prompt || ""}
                              onChange={(e) =>
                                setSelectedTemplate({ ...selectedTemplate!, system_prompt: e.target.value })
                              }
                              rows={15}
                              className="font-mono text-sm"
                              placeholder="Enter the complete system prompt for the AI agent..."
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {selectedTemplate?.system_prompt?.length || 0} characters
                            </p>
                          </div>
                          <Button
                            onClick={() => updateTemplate.mutate(selectedTemplate!)}
                            disabled={updateTemplate.isPending}
                          >
                            {updateTemplate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {template.system_prompt.substring(0, 200)}...
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              {knowledge?.length || 0} knowledge entries
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setNewKnowledgeDialogOpen(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Entry
              </Button>
              <Button variant="outline" size="sm" asChild>
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                  <input
                    id="file-upload"
                    type="file"
                    accept=".txt,.md,.docx,.pdf,.xlsx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {knowledge?.map((kb) => (
              <Card key={kb.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {kb.title}
                      </CardTitle>
                      <CardDescription>
                        {kb.knowledge_type} · {new Date(kb.effective_date).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteKnowledge(kb.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Dialog open={selectedKnowledge?.id === kb.id} onOpenChange={(open) => !open && setSelectedKnowledge(null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedKnowledge(kb)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit Knowledge: {kb.title}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div>
                            <Label>Title</Label>
                            <Input
                              value={selectedKnowledge?.title || ""}
                              onChange={(e) =>
                                setSelectedKnowledge({ ...selectedKnowledge!, title: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label>Type</Label>
                            <Select
                              value={selectedKnowledge?.knowledge_type}
                              onValueChange={(value) =>
                                setSelectedKnowledge({ ...selectedKnowledge!, knowledge_type: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="company_info">Company Info</SelectItem>
                                <SelectItem value="services">Services</SelectItem>
                                <SelectItem value="case_studies">Case Studies</SelectItem>
                                <SelectItem value="content_strategy">Content Strategy</SelectItem>
                                <SelectItem value="policies">Policies</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Content</Label>
                            <Textarea
                              value={selectedKnowledge?.content || ""}
                              onChange={(e) =>
                                setSelectedKnowledge({ ...selectedKnowledge!, content: e.target.value })
                              }
                              rows={15}
                            />
                          </div>
                          <Button
                            onClick={() => updateKnowledge.mutate(selectedKnowledge!)}
                            disabled={updateKnowledge.isPending}
                          >
                            {updateKnowledge.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {kb.content.substring(0, 150)}...
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="influencers" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              {influencers?.length || 0} influencer styles
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setNewInfluencerDialogOpen(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Entry
              </Button>
              <Button variant="outline" size="sm" asChild>
                <label htmlFor="influencer-file-upload" className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                  <input
                    id="influencer-file-upload"
                    type="file"
                    accept=".txt,.md,.docx,.pdf"
                    onChange={handleInfluencerFileUpload}
                    className="hidden"
                  />
                </label>
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {influencers?.map((inf) => (
              <Card key={inf.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{inf.influencer_name}</CardTitle>
                      <CardDescription>{inf.platform}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteInfluencer(inf.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Dialog open={selectedInfluencer?.id === inf.id} onOpenChange={(open) => !open && setSelectedInfluencer(null)}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedInfluencer(inf)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit Influencer: {inf.influencer_name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div>
                            <Label>Influencer Name</Label>
                            <Input
                              value={selectedInfluencer?.influencer_name || ""}
                              onChange={(e) =>
                                setSelectedInfluencer({ ...selectedInfluencer!, influencer_name: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label>Style Description</Label>
                            <Textarea
                              value={selectedInfluencer?.style_description || ""}
                              onChange={(e) =>
                                setSelectedInfluencer({ ...selectedInfluencer!, style_description: e.target.value })
                              }
                              rows={10}
                            />
                          </div>
                          <Button
                            onClick={() => updateInfluencer.mutate(selectedInfluencer!)}
                            disabled={updateInfluencer.isPending}
                          >
                            {updateInfluencer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                        </div>
                      </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {inf.style_description?.substring(0, 150)}...
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        form={newKnowledgeForm}
        onFormChange={setNewKnowledgeForm}
        onSave={handleCreateKnowledge}
        isPending={createKnowledge.isPending}
      />

      <NewKnowledgeDialog
        open={newKnowledgeDialogOpen}
        onOpenChange={setNewKnowledgeDialogOpen}
        form={newKnowledgeForm}
        onFormChange={setNewKnowledgeForm}
        onSave={handleCreateKnowledge}
        isPending={createKnowledge.isPending}
      />

      <UploadInfluencerDialog
        open={uploadInfluencerDialogOpen}
        onOpenChange={setUploadInfluencerDialogOpen}
        form={newInfluencerForm}
        onFormChange={setNewInfluencerForm}
        onSave={handleCreateInfluencer}
        isPending={createInfluencer.isPending}
      />

      <NewInfluencerDialog
        open={newInfluencerDialogOpen}
        onOpenChange={setNewInfluencerDialogOpen}
        form={newInfluencerForm}
        onFormChange={setNewInfluencerForm}
        onSave={handleCreateInfluencer}
        isPending={createInfluencer.isPending}
      />
    </div>
  );
}
