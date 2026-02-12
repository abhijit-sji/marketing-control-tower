import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TeamTasksFilters, useBrandsForFilter, useProjectsForFilter } from "@/hooks/useTeamTasks";

interface PMDashboardFiltersProps {
  filters: TeamTasksFilters;
  onFiltersChange: (filters: TeamTasksFilters) => void;
}

export function PMDashboardFilters({ filters, onFiltersChange }: PMDashboardFiltersProps) {
  const { data: brands } = useBrandsForFilter();
  const { data: projects } = useProjectsForFilter();

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.brandId || filters.projectId;

  const handleDateFromChange = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      dateFrom: date ? format(date, 'yyyy-MM-dd') : undefined,
    });
  };

  const handleDateToChange = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      dateTo: date ? format(date, 'yyyy-MM-dd') : undefined,
    });
  };

  const handleBrandChange = (value: string) => {
    onFiltersChange({
      ...filters,
      brandId: value === 'all' ? undefined : value,
    });
  };

  const handleProjectChange = (value: string) => {
    onFiltersChange({
      ...filters,
      projectId: value === 'all' ? undefined : value,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* Date From */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">From Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !filters.dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? format(new Date(filters.dateFrom), "MMM d, yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                  onSelect={handleDateFromChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">To Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !filters.dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo ? format(new Date(filters.dateTo), "MMM d, yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                  onSelect={handleDateToChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Brand Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">Brand</label>
            <Select value={filters.brandId || 'all'} onValueChange={handleBrandChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brands?.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">Project</label>
            <Select value={filters.projectId || 'all'} onValueChange={handleProjectChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="gap-1.5">
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
