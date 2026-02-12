import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Download, FileText, Users, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function EODManagement() {
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: allEODSubmissions, isLoading } = useQuery({
    queryKey: ["eod-submissions", "admin", dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("team_eod_submissions")
        .select(`
          *,
          users!inner(first_name, last_name, email, department)
        `)
        .order("submission_date", { ascending: false });

      if (dateFilter === "today") {
        const today = new Date().toISOString().split("T")[0];
        query = query.eq("submission_date", today);
      } else if (dateFilter === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte("submission_date", weekAgo.toISOString().split("T")[0]);
      } else if (dateFilter === "month") {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        query = query.gte("submission_date", monthAgo.toISOString().split("T")[0]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: todayStats } = useQuery({
    queryKey: ["eod-stats", "today"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      
      const { data: submissions, error: submissionsError } = await supabase
        .from("team_eod_submissions")
        .select("user_id")
        .eq("submission_date", today);

      const { data: activeUsers, error: usersError } = await supabase
        .from("users")
        .select("id")
        .eq("status", "active");

      if (submissionsError || usersError) throw submissionsError || usersError;

      const totalUsers = activeUsers?.length || 0;
      const submittedCount = submissions?.length || 0;
      const pendingCount = totalUsers - submittedCount;
      const completionRate = totalUsers > 0 ? (submittedCount / totalUsers) * 100 : 0;

      return {
        totalSubmissions: submittedCount,
        pendingUsers: pendingCount,
        completionRate: Math.round(completionRate),
        totalActiveUsers: totalUsers,
      };
    },
  });

  const filteredSubmissions = allEODSubmissions?.filter((submission) => {
    if (!searchTerm) return true;
    const fullName = `${submission.users.first_name} ${submission.users.last_name}`.toLowerCase();
    const email = submission.users.email?.toLowerCase() || "";
    const department = submission.users.department?.toLowerCase() || "";
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || email.includes(search) || department.includes(search);
  });

  const exportToCSV = () => {
    if (!filteredSubmissions) return;

    const headers = ["Date", "Name", "Email", "Department", "Tasks Count", "Notes", "Submitted At"];
    const rows = filteredSubmissions.map((sub) => [
      format(new Date(sub.submission_date), "yyyy-MM-dd"),
      `${sub.users.first_name} ${sub.users.last_name}`,
      sub.users.email,
      sub.users.department || "N/A",
      sub.task_links?.length || 0,
      sub.notes?.replace(/\n/g, " ") || "N/A",
      format(new Date(sub.created_at), "yyyy-MM-dd HH:mm"),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eod-submissions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">EOD Management</h1>
          <p className="text-muted-foreground mt-2">
            View and manage all team End of Day submissions
          </p>
        </div>
        <Button onClick={exportToCSV} disabled={!filteredSubmissions?.length}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submissions Today</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayStats?.totalSubmissions || 0}</div>
            <p className="text-xs text-muted-foreground">
              Out of {todayStats?.totalActiveUsers || 0} active users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Users</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayStats?.pendingUsers || 0}</div>
            <p className="text-xs text-muted-foreground">Haven't submitted today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayStats?.completionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Team submission rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allEODSubmissions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {dateFilter === "all" ? "All time" : `Last ${dateFilter}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by name, email, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* EOD Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>EOD Submissions</CardTitle>
          <CardDescription>All team member end of day reports</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading submissions...</div>
          ) : filteredSubmissions && filteredSubmissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-center">Tasks</TableHead>
                  <TableHead>Notes Preview</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(submission.submission_date), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {submission.users.first_name} {submission.users.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">{submission.users.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {submission.users.department ? (
                        <Badge variant="outline">{submission.users.department}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{submission.task_links?.length || 0}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate text-sm text-muted-foreground">
                        {submission.notes || "No notes provided"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(submission.created_at), "h:mm a")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No EOD submissions found.</p>
              <p className="text-sm mt-2">Adjust filters or check back later.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
