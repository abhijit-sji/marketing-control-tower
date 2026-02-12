import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";
import { Loader2, Mail, Calendar, Send } from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";

interface WeeklyClientEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Get Monday to Friday of current week
function getCurrentWeekRange() {
  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 }); // Monday as start
  const friday = addDays(monday, 4); // Friday (Monday + 4 days)
  return {
    start: monday,
    end: friday,
  };
}

export function WeeklyClientEmailDialog({ open, onOpenChange }: WeeklyClientEmailDialogProps) {
  const { toast } = useToast();
  const { clients } = useClients({ limit: 1000 });
  
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [dateRange, setDateRange] = useState(getCurrentWeekRange());
  const [summary, setSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");

  // Filter active clients with email
  const activeClientsWithEmail = clients.filter(
    (client) => client.status === "active" && client.email
  );

  // Generate default subject when client or date range changes
  useEffect(() => {
    if (selectedClientId && dateRange.start && dateRange.end) {
      const client = activeClientsWithEmail.find((c) => c.id === selectedClientId);
      if (client) {
        const startStr = format(dateRange.start, "MMM d");
        const endStr = format(dateRange.end, "MMM d, yyyy");
        setEmailSubject(`Weekly Project Update - ${startStr} to ${endStr}`);
      }
    }
  }, [selectedClientId, dateRange, activeClientsWithEmail]);

  const handleGenerateSummary = async () => {
    if (!selectedClientId) {
      toast({
        title: "Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setSummary("");

    try {
      const startDate = format(dateRange.start, "yyyy-MM-dd");
      const endDate = format(dateRange.end, "yyyy-MM-dd");

      const { data, error } = await supabase.functions.invoke("weekly-client-summary", {
        body: {
          client_id: selectedClientId,
          start_date: startDate,
          end_date: endDate,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setSummary(data.summary || "No summary generated.");
    } catch (error: any) {
      toast({
        title: "Error Generating Summary",
        description: error.message || "Failed to generate summary",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedClientId) {
      toast({
        title: "Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }

    if (!summary.trim()) {
      toast({
        title: "Error",
        description: "Please generate a summary first",
        variant: "destructive",
      });
      return;
    }

    if (!emailSubject.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email subject",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-client-email", {
        body: {
          client_id: selectedClientId,
          subject: emailSubject,
          body: summary,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Email Sent Successfully",
        description: `Weekly summary sent to ${data.client_email}`,
      });

      // Reset form
      setSummary("");
      setSelectedClientId("");
      setDateRange(getCurrentWeekRange());
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error Sending Email",
        description: error.message || "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const selectedClient = activeClientsWithEmail.find((c) => c.id === selectedClientId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Weekly Client Email Agent
          </DialogTitle>
          <DialogDescription>
            Generate and send weekly project summaries to clients based on task comments
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="client">Client *</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger id="client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {activeClientsWithEmail.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} {client.company && `(${client.company})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClient && (
              <p className="text-sm text-muted-foreground">
                Email: {selectedClient.email}
              </p>
            )}
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Week Range (Monday - Friday)
            </Label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Start Date (Monday)</Label>
                <input
                  type="date"
                  value={format(dateRange.start, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    setDateRange({ start: newDate, end: addDays(newDate, 4) });
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">End Date (Friday)</Label>
                <input
                  type="date"
                  value={format(dateRange.end, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    setDateRange({ start: addDays(newDate, -4), end: newDate });
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {format(dateRange.start, "MMM d")} - {format(dateRange.end, "MMM d, yyyy")}
            </p>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerateSummary}
            disabled={!selectedClientId || isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Summary...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Generate Summary
              </>
            )}
          </Button>

          {/* Summary Textarea */}
          {summary && (
            <div className="space-y-2">
              <Label htmlFor="summary">Summary (Editable)</Label>
              <Textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                placeholder="Summary will appear here..."
              />
              <p className="text-xs text-muted-foreground">
                You can edit the summary before sending. Use markdown formatting: **bold**, *italic*
              </p>
            </div>
          )}

          {/* Email Subject */}
          {summary && (
            <div className="space-y-2">
              <Label htmlFor="subject">Email Subject *</Label>
              <input
                id="subject"
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Weekly Project Update - [Date Range]"
              />
            </div>
          )}

          {/* Send Button */}
          {summary && (
            <Button
              onClick={handleSendEmail}
              disabled={!emailSubject.trim() || isSending}
              className="w-full"
              size="lg"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Email...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Email to Client
                </>
              )}
            </Button>
          )}

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">How it works</CardTitle>
              <CardDescription className="text-xs">
                This agent fetches all tasks with comments from the selected week range for the client's projects,
                generates an AI-powered summary, and allows you to review and send it via email.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

