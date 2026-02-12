import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, Globe, MapPin, Building2, Calendar, TrendingUp, DollarSign, Users } from "lucide-react";
import { Client } from "@/hooks/useClients";

interface ClientInfoCardProps {
  client: Client;
}

export const ClientInfoCard = ({ client }: ClientInfoCardProps) => {
  return (
    <Card className="border border-border/50 shadow-md">
      <CardHeader>
        <CardTitle className="text-lg">Client Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {client.email && (
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm">{client.email}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm">{client.phone}</span>
          </div>
        )}
        {client.website && (
          <div className="flex items-center gap-3">
            <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <a
              href={client.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              {client.website}
            </a>
          </div>
        )}
        {(client.city || client.country) && (
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm">
              {[client.city, client.state, client.country].filter(Boolean).join(', ')}
            </span>
          </div>
        )}
        {client.industry && (
          <div className="flex items-center gap-3">
            <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm">{client.industry}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm">
            Joined {new Date(client.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm">
            ${(client.total_revenue || 0).toLocaleString()} total revenue
          </span>
        </div>
        {client.company_revenue && (
          <div className="flex items-center gap-3">
            <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Company Revenue</p>
              <p className="text-sm font-medium">${client.company_revenue.toLocaleString()}</p>
            </div>
          </div>
        )}
        {client.team_size && (
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm">{client.team_size} employees</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
