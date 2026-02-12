import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquareQuote } from "lucide-react";

export default function TestimonialSubmitPage() {
  const { token } = useParams();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <MessageSquareQuote className="h-6 w-6 text-primary" />
              Share your experience
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Thank you for taking a moment to share feedback. Your testimonial helps us tell authentic stories.
            </p>
            {token && (
              <Badge variant="outline" className="w-fit">
                Token: {token}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" placeholder="Avery Johnson" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title / Role</Label>
                <Input id="title" placeholder="Director of Growth" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" placeholder="Cloudpeak Health" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testimonial">Testimonial</Label>
              <Textarea
                id="testimonial"
                rows={6}
                placeholder="Tell us what stood out about working with the team..."
              />
            </div>
            <div className="flex justify-end">
              <Button type="button">Submit testimonial</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
