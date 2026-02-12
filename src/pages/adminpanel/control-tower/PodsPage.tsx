// ================================================
// Control Tower - PODs & Teams Page
// ================================================

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePods } from "@/hooks/useControlTowerData";
import { Badge } from "@/components/ui/badge";
import { Users, Package, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SyncStatusBanner } from "@/components/adminpanel/control-tower/SyncStatusBanner";

export default function PodsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = usePods({ limit: 50 });

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <SyncStatusBanner />
      
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>PODs & Teams</CardTitle>
              <CardDescription>
                View all project-oriented departments from SJ Control Tower
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to load PODs: {error.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading PODs...</span>
            </div>
          ) : data?.pods && data.pods.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.pods.map((pod) => (
                <Card
                  key={pod.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow border-2"
                  style={{ borderColor: pod.color }}
                  onClick={() => navigate(`/adminpanel/control-tower/pods/${pod.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: pod.color }}
                        />
                        <CardTitle className="text-lg">{pod.name}</CardTitle>
                      </div>
                      <Badge variant={pod.is_active ? "default" : "secondary"}>
                        {pod.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {pod.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{pod.member_count}</span>
                        <span className="text-muted-foreground">members</span>
                      </div>
                      <Button variant="ghost" size="sm">
                        View Details
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No PODs found.</p>
            </div>
          )}

          {/* Total Count */}
          {data?.pods && data.pods.length > 0 && (
            <div className="mt-6 text-sm text-muted-foreground text-center">
              Showing {data.pods.length} POD{data.pods.length !== 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
