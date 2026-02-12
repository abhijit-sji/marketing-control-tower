import { useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHackathonEvents } from "@/hooks/useHackathon";
import {
  useCreateHackathonEvent,
  useUpdateHackathonEvent,
  useDeleteHackathonEvent,
} from "@/hooks/useHackathonEvents";
import type { HackathonEvent, HackathonEventStatus } from "@/types/hackathon";
import { format } from "date-fns";

export default function EventManagement() {
  const { data: events, isLoading } = useHackathonEvents();
  const createEvent = useCreateHackathonEvent();
  const updateEvent = useUpdateHackathonEvent();
  const deleteEvent = useDeleteHackathonEvent();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<HackathonEvent | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    registration_deadline: "",
    max_team_size: 4,
    min_team_size: 1,
    status: "draft" as HackathonEventStatus,
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      start_date: "",
      end_date: "",
      registration_deadline: "",
      max_team_size: 4,
      min_team_size: 1,
      status: "draft",
    });
    setEditingEvent(null);
  };

  const handleEdit = (event: HackathonEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      start_date: event.start_date,
      end_date: event.end_date,
      registration_deadline: event.registration_deadline || "",
      max_team_size: event.max_team_size,
      min_team_size: event.min_team_size,
      status: event.status,
    });
    setIsCreateDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingEvent) {
      await updateEvent.mutateAsync({
        id: editingEvent.id,
        updates: {
          ...formData,
          rules: {},
          prizes: [],
        },
      });
    } else {
      await createEvent.mutateAsync({
        ...formData,
        rules: {},
        prizes: [],
        created_by: null,
      });
    }

    setIsCreateDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (eventId: string) => {
    if (confirm("Are you sure you want to delete this event?")) {
      await deleteEvent.mutateAsync(eventId);
    }
  };

  const getStatusColor = (status: HackathonEventStatus) => {
    const colors = {
      draft: "secondary",
      published: "default",
      active: "default",
      completed: "secondary",
      cancelled: "destructive",
    };
    return colors[status];
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hackathon Events</h1>
          <p className="text-muted-foreground">
            Create and manage hackathon events
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? "Edit Event" : "Create New Event"}
              </DialogTitle>
              <DialogDescription>
                {editingEvent
                  ? "Update the event details"
                  : "Fill in the details to create a new hackathon event"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData({ ...formData, end_date: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="registration_deadline">
                  Registration Deadline
                </Label>
                <Input
                  id="registration_deadline"
                  type="date"
                  value={formData.registration_deadline}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      registration_deadline: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_team_size">Min Team Size</Label>
                  <Input
                    id="min_team_size"
                    type="number"
                    min="1"
                    value={formData.min_team_size}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        min_team_size: parseInt(e.target.value),
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_team_size">Max Team Size</Label>
                  <Input
                    id="max_team_size"
                    type="number"
                    min="1"
                    value={formData.max_team_size}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_team_size: parseInt(e.target.value),
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: HackathonEventStatus) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createEvent.isPending || updateEvent.isPending}
                >
                  {editingEvent ? "Update" : "Create"} Event
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading events...</div>
      ) : events && events.length > 0 ? (
        <div className="grid gap-4">
          {events.map((event) => (
            <Card key={event.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle>{event.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {event.description}
                    </p>
                  </div>
                  <Badge variant={getStatusColor(event.status) as any}>
                    {event.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1 text-sm">
                    <p>
                      <strong>Dates:</strong>{" "}
                      {format(new Date(event.start_date), "MMM d, yyyy")} -{" "}
                      {format(new Date(event.end_date), "MMM d, yyyy")}
                    </p>
                    {event.registration_deadline && (
                      <p>
                        <strong>Registration:</strong>{" "}
                        {format(
                          new Date(event.registration_deadline),
                          "MMM d, yyyy"
                        )}
                      </p>
                    )}
                    <p>
                      <strong>Team Size:</strong> {event.min_team_size}-
                      {event.max_team_size} members
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(event)}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(event.id)}
                      disabled={deleteEvent.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No events created yet</p>
            <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Event
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
