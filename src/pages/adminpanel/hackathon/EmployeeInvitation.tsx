import { useState, useMemo } from "react";
import { Send, RefreshCw, Search, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useHackathonEvents } from "@/hooks/useHackathon";
import {
  useEmployees,
  useSyncEmployees,
  useSendHackathonInvites,
} from "@/hooks/useEmployees";

export default function EmployeeInvitation() {
  const { data: events } = useHackathonEvents();
  const { data: employees, isLoading: loadingEmployees } = useEmployees();
  const syncEmployees = useSyncEmployees();
  const sendInvites = useSendHackathonInvites();

  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const departments = useMemo(() => {
    if (!employees) return [];
    const depts = new Set(
      employees.map((e) => e.department).filter((d): d is string => !!d)
    );
    return Array.from(depts).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];

    return employees.filter((emp) => {
      const matchesSearch =
        emp.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDepartment =
        departmentFilter === "all" || emp.department === departmentFilter;

      return matchesSearch && matchesDepartment;
    });
  }, [employees, searchQuery, departmentFilter]);

  const handleToggleEmployee = (employeeId: string) => {
    const newSet = new Set(selectedEmployeeIds);
    if (newSet.has(employeeId)) {
      newSet.delete(employeeId);
    } else {
      newSet.add(employeeId);
    }
    setSelectedEmployeeIds(newSet);
  };

  const handleToggleAll = () => {
    if (selectedEmployeeIds.size === filteredEmployees.length) {
      setSelectedEmployeeIds(new Set());
    } else {
      setSelectedEmployeeIds(new Set(filteredEmployees.map((e) => e.id)));
    }
  };

  const handleSendInvites = async () => {
    if (!selectedEventId || selectedEmployeeIds.size === 0) return;

    await sendInvites.mutateAsync({
      eventId: selectedEventId,
      employeeIds: Array.from(selectedEmployeeIds),
    });

    setSelectedEmployeeIds(new Set());
  };

  const activeEvents = events?.filter((e) => e.status !== "completed");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invite Employees</h1>
          <p className="text-muted-foreground">
            Send hackathon invitations to employees
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => syncEmployees.mutate()}
          disabled={syncEmployees.isPending}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${syncEmployees.isPending ? "animate-spin" : ""}`}
          />
          Sync Employees
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Event</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event">Event</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger id="event">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {activeEvents?.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title} ({event.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEventId && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <p className="text-sm font-medium">
                    {selectedEmployeeIds.size} employee(s) selected
                  </p>
                </div>
                <Button
                  onClick={handleSendInvites}
                  disabled={
                    selectedEmployeeIds.size === 0 || sendInvites.isPending
                  }
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Invitations
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedEventId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Select Employees</CardTitle>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={
                    filteredEmployees.length > 0 &&
                    selectedEmployeeIds.size === filteredEmployees.length
                  }
                  onCheckedChange={handleToggleAll}
                />
                <Label htmlFor="select-all" className="cursor-pointer">
                  Select All ({filteredEmployees.length})
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingEmployees ? (
              <div className="text-center py-8">Loading employees...</div>
            ) : filteredEmployees.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => handleToggleEmployee(employee.id)}
                  >
                    <Checkbox
                      checked={selectedEmployeeIds.has(employee.id)}
                      onCheckedChange={() => handleToggleEmployee(employee.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      <p className="font-medium">
                        {employee.first_name} {employee.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {employee.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {employee.department && (
                        <Badge variant="secondary">{employee.department}</Badge>
                      )}
                      {employee.title && (
                        <span className="text-sm text-muted-foreground">
                          {employee.title}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {searchQuery || departmentFilter !== "all"
                    ? "No employees match your filters"
                    : "No employees available"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
