import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TestimonialRecord, TestimonialType } from "@/hooks/useTestimonials";
import { useState } from "react";

interface CollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testimonial?: TestimonialRecord;
  onSendRequest: (type: TestimonialType, message: string) => void;
}

const typeLabels: Record<TestimonialType, string> = {
  google_review: "Google Review",
  written_quote: "Written Quote",
  video: "Video Testimonial",
  linkedin: "LinkedIn Recommendation",
  case_study: "Case Study",
};

export const CollectionDialog = ({
  open,
  onOpenChange,
  testimonial,
  onSendRequest,
}: CollectionDialogProps) => {
  const [selectedType, setSelectedType] = useState<TestimonialType>("written_quote");
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!testimonial) return;
    onSendRequest(selectedType, message);
    setMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Testimonial Request</DialogTitle>
          <DialogDescription>
            {testimonial
              ? `Reach out to ${testimonial.clientName} at ${testimonial.companyName}.`
              : "Select a testimonial to send a request."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="testimonial-type">Channel</Label>
            <Select value={selectedType} onValueChange={(value) => setSelectedType(value as TestimonialType)}>
              <SelectTrigger id="testimonial-type">
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="testimonial-message">Personalized Message</Label>
            <Textarea
              id="testimonial-message"
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Add a thoughtful note about how their feedback helps the team."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!testimonial}>
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
