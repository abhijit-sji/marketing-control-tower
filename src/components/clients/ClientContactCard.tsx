import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone } from "lucide-react";

interface Contact {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  is_primary?: boolean | null;
  lifecycle_stage?: string | null;
}

interface ClientContactCardProps {
  contact: Contact;
}

export const ClientContactCard = ({ contact }: ClientContactCardProps) => {
  return (
    <Card className="border border-border/50 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="font-medium text-sm">
              {contact.first_name} {contact.last_name}
              {contact.is_primary && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Primary
                </Badge>
              )}
            </p>
            {contact.job_title && (
              <p className="text-xs text-muted-foreground mt-1">
                {contact.job_title}
              </p>
            )}
          </div>
          {contact.lifecycle_stage && (
            <Badge variant="outline" className="text-xs">
              {contact.lifecycle_stage}
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          {contact.email && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {contact.email}
            </p>
          )}
          {contact.phone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {contact.phone}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
