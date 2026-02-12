// ================================================
// Control Tower - POD Detail Page
// ================================================

import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePod, usePodMembers } from "@/hooks/useControlTowerData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, Users, ArrowLeft, Loader2, AlertCircle, Mail, Briefcase, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function PodDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: podData, isLoading: podLoading, error: podError } = usePod(id);
  const { data: membersData, isLoading: membersLoading, error: membersError } = usePodMembers(id);

  const isLoading = podLoading || membersLoading;
  const error = podError || membersError;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/adminpanel/control-tower/pods')}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to PODs
      </Button>

      {/* Error State */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load POD details: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading POD details...</span>
        </div>
      ) : (
        <>
          {/* POD Info Card */}
          {podData?.pod && (
            <Card className="mb-6 border-2" style={{ borderColor: podData.pod.color }}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: podData.pod.color }}
                    />
                    <div>
                      <CardTitle className="text-2xl">{podData.pod.name}</CardTitle>
                      <CardDescription className="mt-2">
                        {podData.pod.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={podData.pod.is_active ? "default" : "secondary"}>
                    {podData.pod.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{podData.pod.member_count}</span>
                  <span className="text-muted-foreground">team members</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Members Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Team Members ({membersData?.total_members || 0})</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {membersData?.members && membersData.members.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Joined Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membersData.members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            {member.full_name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{member.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{member.title}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">
                                {new Date(member.joined_at).toLocaleDateString()}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No members found in this POD.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
