import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Building2, 
  Users, 
  Plug, 
  Search,
  Eye,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Target,
  BarChart3
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const UserBrands = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dashboardData = useDashboardData();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "internal" | "client">("all");

  // Get brands from dashboard data
  const allBrands = dashboardData.brandPerformance;

  // Filter brands based on search and type
  const filteredBrands = allBrands.filter(brand => {
    const matchesSearch = brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (brand.owner_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         brand.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === "all" || brand.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getBrandStats = (brand: typeof allBrands[0]) => {
    const totalKPIs = brand.kpis.length;
    const achievedKPIs = brand.kpis.filter(kpi => 
      kpi.target_value ? kpi.current_value >= kpi.target_value : true
    ).length;
    const achievementRate = totalKPIs > 0 ? Math.round((achievedKPIs / totalKPIs) * 100) : 0;
    
    return { totalKPIs, achievedKPIs, achievementRate };
  };

  const getBrandIcon = (brandName: string) => {
    const iconMap: Record<string, any> = {
      "Community Outreach": Users,
      "CollabAI": Building2,
      "LeadsLift": TrendingUp,
      "BuildYourAI": Building2,
      "GHL Developer": Building2,
      "Crafted.Email": Building2,
      "PlatePresence": DollarSign,
      "SJ Innovation": Building2,
    };
    return iconMap[brandName] || Building2;
  };

  if (dashboardData.loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">Loading your brands...</span>
        </div>
      </div>
    );
  }

  if (dashboardData.error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive font-medium">Error loading brands</p>
            <p className="text-sm text-muted-foreground">{dashboardData.error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={dashboardData.refreshData}
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Brands</h1>
          <p className="text-muted-foreground">
            View brands you have access to and their current performance
          </p>
          <div className="mt-2">
            <span className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 text-xs px-2 py-1 rounded-full font-medium">
              ✅ Connected to Database
            </span>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Brands</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allBrands.length}</div>
              <p className="text-xs text-muted-foreground">
                {allBrands.filter(b => b.is_active).length} active
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(allBrands.reduce((sum, b) => sum + b.revenue, 0) / 1000).toFixed(0)}K
              </div>
              <p className="text-xs text-muted-foreground">
                across all brands
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allBrands.reduce((sum, b) => sum + b.activeTasks, 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                in progress
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Performance</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allBrands.length > 0 ? Math.round(
                  allBrands.reduce((sum, b) => {
                    const stats = getBrandStats(b);
                    return sum + stats.achievementRate;
                  }, 0) / allBrands.length
                ) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                KPI achievement
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search brands..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={filterType} onValueChange={(value: "all" | "internal" | "client") => setFilterType(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Brands Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredBrands.map((brand) => {
            const stats = getBrandStats(brand);
            const IconComponent = getBrandIcon(brand.name);
            
            return (
              <Card key={brand.id} className="relative group hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0 pr-2">
                      <CardTitle 
                        className="text-lg cursor-pointer hover:text-primary transition-colors group-hover:text-primary truncate"
                        onClick={() => navigate(`/brands/${brand.slug || brand.id}`)}
                      >
                        {brand.name}
                      </CardTitle>
                      <CardDescription className="text-sm line-clamp-2">
                        {brand.description}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-8 w-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                        <IconComponent className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-2">
                    <Badge variant={brand.type === 'internal' ? 'default' : 'secondary'}>
                      {brand.type}
                    </Badge>
                    <Badge variant={brand.is_active ? 'default' : 'destructive'} className="text-xs">
                      {brand.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant={
                      brand.status === 'growing' ? 'default' : 
                      brand.status === 'stable' ? 'secondary' : 'destructive'
                    }>
                      {brand.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Owner & Budget Info */}
                  <div className="flex justify-between items-center text-sm gap-2">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground flex-shrink-0">Owner:</span>
                      <span className="font-medium truncate">{brand.owner_name || 'Unknown'}</span>
                    </div>
                    {brand.monthly_budget && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">${(brand.monthly_budget / 1000).toFixed(0)}K</span>
                      </div>
                    )}
                  </div>

                  {/* Revenue & Growth */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Revenue</p>
                      <p className="text-lg font-bold">${brand.revenue.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Growth</p>
                      <p className={`text-lg font-bold ${
                        brand.growth > 0 ? 'text-success' : 
                        brand.growth < 0 ? 'text-destructive' : 'text-muted-foreground'
                      }`}>
                        {brand.growth > 0 ? '+' : ''}{brand.growth}%
                      </p>
                    </div>
                  </div>

                  {/* KPI Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">KPI Achievement</span>
                      <span className="font-medium">{stats.achievementRate}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          stats.achievementRate >= 80 ? 'bg-success' :
                          stats.achievementRate >= 60 ? 'bg-warning' : 'bg-destructive'
                        }`}
                        style={{ width: `${stats.achievementRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{stats.achievedKPIs}/{stats.totalKPIs} KPIs achieved</span>
                      <span>{brand.activeTasks} active tasks</span>
                    </div>
                  </div>

                  {/* Integrations */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Plug className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {brand.active_integrations.length} integrations
                      </span>
                    </div>
                    {brand.active_integrations.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {brand.active_integrations.slice(0, 3).map((integration, index) => (
                          <Badge key={index} variant="outline" className="text-xs truncate max-w-[120px]">
                            {integration}
                          </Badge>
                        ))}
                        {brand.active_integrations.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{brand.active_integrations.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      onClick={() => navigate(`/brands/${brand.slug || brand.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* No Results State */}
        {filteredBrands.length === 0 && !dashboardData.loading && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No brands found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || filterType !== "all" 
                ? "Try adjusting your search or filter criteria."
                : "You don't have access to any brands yet."
              }
            </p>
            {(searchTerm || filterType !== "all") && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setFilterType("all");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserBrands;