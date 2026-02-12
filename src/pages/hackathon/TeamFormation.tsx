import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAllTeams, useCreateTeamSimple } from "@/hooks/useHackathon";
import { useUsers } from "@/hooks/useUsers";
import { Users, Plus, Loader2, Search, X, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function TeamFormation() {
  const { data: teams, isLoading: teamsLoading, refetch: refetchTeams } = useAllTeams();
  const { data: users, isLoading: usersLoading } = useUsers();
  const createTeamMutation = useCreateTeamSimple();

  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Filter users based on search
  const filteredUsers = users?.filter(user => {
    const searchLower = memberSearch.toLowerCase();
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
    return fullName.includes(searchLower) || user.email?.toLowerCase().includes(searchLower);
  }) || [];

  const toggleMember = (employeeId: string) => {
    setSelectedMembers(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const removeMember = (employeeId: string) => {
    setSelectedMembers(prev => prev.filter(id => id !== employeeId));
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    try {
      await createTeamMutation.mutateAsync({
        teamName: teamName.trim(),
        description: description.trim(),
        memberIds: selectedMembers,
      });

      setTeamName("");
      setDescription("");
      setSelectedMembers([]);
      setMemberSearch("");
      setIsCreateDialogOpen(false);
      refetchTeams();
    } catch (error: any) {
      toast.error(error.message || "Failed to create team");
    }
  };

  const getSelectedUsers = () => {
    return users?.filter(user => selectedMembers.includes(user.id)) || [];
  };

  if (teamsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading teams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Teams</h1>
            <p className="text-muted-foreground">Create and manage teams</p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
                <DialogDescription>
                  Create a team and add members
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCreateTeam} className="space-y-4 flex-1 overflow-hidden flex flex-col">
                <div className="space-y-2">
                  <Label htmlFor="teamName">Team Name *</Label>
                  <Input
                    id="teamName"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter team name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's your team about?"
                    rows={2}
                  />
                </div>

                {/* Selected Members */}
                {selectedMembers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Members ({selectedMembers.length})</Label>
                    <div className="flex flex-wrap gap-2">
                      {getSelectedUsers().map(user => (
                        <Badge key={user.id} variant="secondary" className="pr-1">
                          {user.first_name} {user.last_name}
                          <button
                            type="button"
                            onClick={() => removeMember(user.id)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Member Selection */}
                <div className="space-y-2 flex-1 overflow-hidden flex flex-col min-h-0">
                  <Label>Add Team Members</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search users..."
                      className="pl-9"
                    />
                  </div>
                  
                  <ScrollArea className="flex-1 border rounded-md min-h-[200px] max-h-[250px]">
                    {usersLoading ? (
                      <div className="p-4 text-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                        Loading users...
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        No users found
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {filteredUsers.map(user => (
                          <div
                            key={user.id}
                            className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                            onClick={() => toggleMember(user.id)}
                          >
                            <Checkbox
                              checked={selectedMembers.includes(user.id)}
                              onCheckedChange={() => toggleMember(user.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {user.first_name} {user.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={createTeamMutation.isPending || !teamName.trim()}
                >
                  {createTeamMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Create Team {selectedMembers.length > 0 && `with ${selectedMembers.length} members`}
                    </>
                  )}
                </Button>
              </form>
            </DialogContent>
        </Dialog>
        </div>

        {/* Teams List */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Teams ({teams?.length || 0})</h2>
        </div>

        {!teams || teams.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Teams Yet</h3>
              <p className="text-muted-foreground mb-6">
                Create the first team
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => {
              const memberCount = team.members?.length || 0;

              return (
                <Card key={team.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        {team.team_name}
                      </CardTitle>
                      <Badge variant="outline">
                        {memberCount} member{memberCount !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <CardDescription>{team.description || 'No description'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {team.members && team.members.length > 0 ? (
                        <div className="space-y-2">
                          {team.members.slice(0, 5).map((member: any) => (
                            <div key={member.id} className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                                {member.employee?.first_name?.[0] || '?'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm truncate block">
                                  {member.employee?.first_name} {member.employee?.last_name}
                                </span>
                              </div>
                              {member.is_captain && (
                                <Badge variant="outline" className="text-xs shrink-0">Captain</Badge>
                              )}
                            </div>
                          ))}
                          {memberCount > 5 && (
                            <p className="text-sm text-muted-foreground pl-9">
                              +{memberCount - 5} more
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No members yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
