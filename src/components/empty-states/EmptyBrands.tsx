import { Building2 } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { useNavigate } from "react-router-dom";

export function EmptyBrands() {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={Building2}
      title="No Brands Yet"
      description="Create your first brand to start tracking performance and managing your marketing efforts."
      primaryAction={{
        label: "Create Brand",
        onClick: () => navigate("/admin/brands"),
      }}
      secondaryAction={{
        label: "Learn More",
        onClick: () => window.open("https://docs.lovable.dev", "_blank"),
        variant: "ghost",
      }}
    />
  );
}
