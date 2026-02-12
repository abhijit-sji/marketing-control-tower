import { useState, useMemo } from "react";
import { Search, Filter, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Fuse from "fuse.js";
import { useServices, useServiceCategories } from "@/hooks/useQuoteBuilder";
import type { Service, ServiceCategory } from "@/types/quote-builder";
import { ServiceCard } from "./ServiceCard";

interface ServiceCatalogPanelProps {
  onServiceSelect: (service: Service) => void;
  selectedServiceIds?: string[];
}

export function ServiceCatalogPanel({
  onServiceSelect,
  selectedServiceIds = [],
}: ServiceCatalogPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const { data: services, isLoading: servicesLoading } = useServices(false);
  const { data: categories, isLoading: categoriesLoading } = useServiceCategories(false);

  // Setup fuse.js for fuzzy search
  const fuse = useMemo(() => {
    if (!services) return null;
    return new Fuse(services, {
      keys: ["name", "description", "category.name"],
      threshold: 0.3,
      ignoreLocation: true,
    });
  }, [services]);

  // Filter and search services
  const filteredServices = useMemo(() => {
    if (!services) return [];

    let result = services;

    // Apply category filter
    if (selectedCategoryId) {
      result = result.filter((s) => s.category_id === selectedCategoryId);
    }

    // Apply search
    if (searchQuery.trim() && fuse) {
      const searchResults = fuse.search(searchQuery);
      const searchIds = new Set(searchResults.map((r) => r.item.id));
      result = result.filter((s) => searchIds.has(s.id));
    }

    return result;
  }, [services, selectedCategoryId, searchQuery, fuse]);

  // Group services by category
  const groupedServices = useMemo(() => {
    const groups: Record<string, { category: ServiceCategory | null; services: (Service & { category: ServiceCategory | null })[] }> = {};

    filteredServices.forEach((service) => {
      const categoryId = service.category_id || "uncategorized";
      if (!groups[categoryId]) {
        groups[categoryId] = {
          category: service.category || null,
          services: [],
        };
      }
      groups[categoryId].services.push(service);
    });

    // Sort categories by sort_order
    return Object.entries(groups)
      .sort(([, a], [, b]) => {
        const aOrder = a.category?.sort_order ?? 999;
        const bOrder = b.category?.sort_order ?? 999;
        return aOrder - bOrder;
      })
      .map(([id, data]) => ({
        id,
        name: data.category?.name || "Uncategorized",
        services: data.services,
      }));
  }, [filteredServices]);

  const isLoading = servicesLoading || categoriesLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Search and Filter Header */}
      <div className="p-4 border-b space-y-3">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Package className="h-5 w-5" />
          Service Catalog
        </h2>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={selectedCategoryId || "all"}
            onValueChange={(value) => setSelectedCategoryId(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2 shrink-0" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Service List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading services...
            </div>
          ) : groupedServices.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {searchQuery || selectedCategoryId
                  ? "No services match your filters"
                  : "No services available"}
              </p>
              {(searchQuery || selectedCategoryId) && (
                <Button
                  variant="link"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategoryId(null);
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            groupedServices.map((group) => (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="font-medium">
                    {group.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {group.services.length} service{group.services.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.services.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      onAdd={onServiceSelect}
                      isAdded={selectedServiceIds.includes(service.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
