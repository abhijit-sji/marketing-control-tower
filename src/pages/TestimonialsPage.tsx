import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollectionDialog } from "@/components/testimonials/CollectionDialog";
import { OpportunityPipeline } from "@/components/testimonials/OpportunityPipeline";
import { TestimonialCard } from "@/components/testimonials/TestimonialCard";
import { useTestimonials, TestimonialRecord, TestimonialType } from "@/hooks/useTestimonials";
import { BarChart3, MessageSquareQuote, ThumbsUp } from "lucide-react";

const statusLabels = {
  pending_outreach: "Pending Outreach",
  requested: "Requested",
  received: "Received",
  approved: "Approved",
  published: "Published",
  dismissed: "Dismissed",
};

export default function TestimonialsPage() {
  const { opportunities, collection, repository, counts, updateStatus, testimonials } = useTestimonials();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTestimonial, setSelectedTestimonial] = useState<TestimonialRecord | undefined>();

  const analytics = useMemo(() => {
    const totalOpportunities = testimonials.length;
    const totalCollected = testimonials.filter((item) =>
      ["received", "approved", "published"].includes(item.status)
    ).length;
    const responseRate = totalOpportunities === 0 ? 0 : Math.round((totalCollected / totalOpportunities) * 100);

    return {
      totalOpportunities,
      totalCollected,
      responseRate,
    };
  }, [testimonials]);

  const handleSendRequest = (type: TestimonialType, message: string) => {
    if (!selectedTestimonial) return;
    updateStatus(selectedTestimonial.id, "requested");
    setSelectedTestimonial({
      ...selectedTestimonial,
      type,
    });
    if (!message) {
      return;
    }
  };

  const openRequestDialog = (testimonial: TestimonialRecord) => {
    setSelectedTestimonial(testimonial);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquareQuote className="h-8 w-8 text-primary" />
            Testimonials
          </h1>
          <p className="text-muted-foreground mt-1">
            Capture positive sentiment, track outreach, and build a reusable testimonial library.
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedTestimonial(opportunities[0]);
            setDialogOpen(true);
          }}
        >
          Send Request
        </Button>
      </div>

      <OpportunityPipeline counts={counts} />

      <Tabs defaultValue="opportunities" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="collection">Collection</TabsTrigger>
          <TabsTrigger value="repository">Repository</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="space-y-4">
          {opportunities.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                No new testimonial opportunities detected this week.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {opportunities.map((item) => (
                <TestimonialCard
                  key={item.id}
                  testimonial={item}
                  primaryActionLabel="Send request"
                  onPrimaryAction={() => openRequestDialog(item)}
                  secondaryActionLabel="Dismiss"
                  onSecondaryAction={() => updateStatus(item.id, "dismissed")}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="collection" className="space-y-4">
          {collection.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                No active requests yet. Send outreach to move opportunities into collection.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {collection.map((item) => (
                <TestimonialCard
                  key={item.id}
                  testimonial={item}
                  primaryActionLabel={item.status === "requested" ? "Mark received" : "Approve"}
                  onPrimaryAction={() =>
                    updateStatus(item.id, item.status === "requested" ? "received" : "approved")
                  }
                  secondaryActionLabel="Open details"
                  onSecondaryAction={() => openRequestDialog(item)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="repository" className="space-y-4">
          {repository.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                Approved testimonials will appear here for marketing reuse.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {repository.map((item) => (
                <Card key={item.id} className="h-full">
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{item.companyName}</Badge>
                      <Badge variant="secondary">{statusLabels[item.status]}</Badge>
                    </div>
                    <CardTitle className="text-lg">{item.clientName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {item.content || "Approved testimonial ready for publishing."}
                    </p>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(item.id, "published")}> 
                      Publish
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Opportunities tracked</CardTitle>
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{analytics.totalOpportunities}</p>
                <p className="text-sm text-muted-foreground">Signals captured across channels.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Testimonials collected</CardTitle>
                <ThumbsUp className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{analytics.totalCollected}</p>
                <p className="text-sm text-muted-foreground">Received and approved stories.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Response rate</CardTitle>
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{analytics.responseRate}%</p>
                <p className="text-sm text-muted-foreground">Opportunities to collected.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <CollectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        testimonial={selectedTestimonial}
        onSendRequest={handleSendRequest}
      />
    </div>
  );
}
