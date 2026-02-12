import { useNavigate } from "react-router-dom";
import { ListChecks, Plus, List, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { usePackageBuilder } from "@/contexts/PackageBuilderContext";
import type { PackageItem } from "@/types/quote-builder";
import { useMemo } from "react";

interface GroupedRequirements {
  category: string;
  items: { serviceName: string; requirements: string[] }[];
}

function parseRequirementsFromHtml(html: string | null): string[] {
  if (!html) return [];

  // Create a temporary element to parse HTML
  const temp = document.createElement("div");
  temp.innerHTML = html;

  // Extract list items
  const listItems = temp.querySelectorAll("li");
  if (listItems.length > 0) {
    return Array.from(listItems).map((li) => li.textContent?.trim() || "");
  }

  // Extract paragraphs if no list items
  const paragraphs = temp.querySelectorAll("p");
  if (paragraphs.length > 0) {
    return Array.from(paragraphs)
      .map((p) => p.textContent?.trim() || "")
      .filter(Boolean);
  }

  // Fall back to plain text split by newlines
  return temp.textContent
    ?.split("\n")
    .map((line) => line.trim())
    .filter(Boolean) || [];
}

function groupRequirementsByCategory(items: PackageItem[]): GroupedRequirements[] {
  const groups: Record<string, { serviceName: string; requirements: string[] }[]> = {};

  items.forEach((item) => {
    const requirements = parseRequirementsFromHtml(item.requirements_html);
    if (requirements.length === 0) return;

    // Use "General" as default category
    const category = "General";

    if (!groups[category]) {
      groups[category] = [];
    }

    groups[category].push({
      serviceName: item.service_name,
      requirements,
    });
  });

  return Object.entries(groups).map(([category, items]) => ({
    category,
    items,
  }));
}

interface RequirementsStepProps {
  estimateId?: string;
}

export function RequirementsStep({ estimateId }: RequirementsStepProps) {
  const navigate = useNavigate();
  const { state, resetBuilder, goPrevStep, totalHours, totalPrice, itemCount } =
    usePackageBuilder();

  const groupedRequirements = useMemo(
    () => groupRequirementsByCategory(state.items),
    [state.items]
  );

  const hasRequirements = groupedRequirements.some(
    (group) => group.items.length > 0
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const handleCreateAnother = () => {
    resetBuilder();
    // The reset will set currentStep back to 'create'
  };

  const handleViewAllEstimates = () => {
    navigate("/quotes");
  };

  const handleViewEstimate = () => {
    if (estimateId) {
      navigate(`/quotes/${estimateId}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xl text-muted-foreground">Estimate Saved Successfully</p>
            <h1 className="text-2xl font-bold mt-2">
              {state.project_name}
              {state.client_name && <span> for {state.client_name}</span>}
            </h1>
            <div className="flex items-center justify-center gap-4 mt-4">
              <Badge variant="secondary">
                {itemCount} Service{itemCount !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="secondary">{totalHours.toFixed(1)} Hours</Badge>
              <Badge variant="outline" className="text-primary">
                {formatCurrency(totalPrice)}
                {state.billing_type === "monthly" ? "/mo" : state.billing_type === "hourly" ? "/hr" : ""}
              </Badge>
            </div>
          </div>

          {/* Requirements Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Requirements Summary
              </CardTitle>
              <CardDescription>
                Information required from the client to begin work
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasRequirements ? (
                <div className="space-y-6">
                  {groupedRequirements.map((group) => (
                    <div key={group.category}>
                      {group.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="mb-4 last:mb-0">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Badge variant="outline" className="font-normal">
                              {item.serviceName}
                            </Badge>
                          </h4>
                          <ul className="space-y-1.5 ml-4">
                            {item.requirements.map((req, reqIndex) => (
                              <li
                                key={reqIndex}
                                className="text-sm text-muted-foreground flex items-start gap-2"
                              >
                                <span className="text-primary mt-1.5 shrink-0">
                                  •
                                </span>
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ListChecks className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">
                    No requirements defined for the selected services
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Services Included */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Services Included
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {state.items.map((item) => (
                  <div
                    key={item.temp_id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.service_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.effort_hours}h × {item.quantity}
                      </p>
                    </div>
                    <p className="font-medium">
                      {formatCurrency(item.final_price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {/* Bottom Actions */}
      <div className="sticky bottom-0 left-0 right-0 bg-background border-t shadow-lg z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <Button variant="outline" onClick={goPrevStep}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Edit
            </Button>
            <div className="flex items-center gap-2">
              {estimateId && (
                <Button variant="outline" onClick={handleViewEstimate}>
                  View Estimate
                </Button>
              )}
              <Button variant="outline" onClick={handleViewAllEstimates}>
                <List className="h-4 w-4 mr-2" />
                View All Estimates
              </Button>
              <Button onClick={handleCreateAnother}>
                <Plus className="h-4 w-4 mr-2" />
                Create Another
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
