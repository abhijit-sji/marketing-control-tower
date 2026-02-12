import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Filter, MoreHorizontal, Trash2, Shield, UserCheck, UserX, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { UserPermissionDialog } from '@/components/admin/UserPermissionDialog';
import { RoleSettingsTab } from '@/components/admin/RoleSettingsTab';
import { useAdminUsers, type AdminUser, type BrandAssignment, type CreateUserData } from '@/hooks/useAdminUsers';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAdminBrands } from '@/hooks/useAdminBrands';

// Extended interface for UI purposes
interface User extends AdminUser {
  name?: string; // Computed field
  brandAccess?: string[]; // Computed field for easier access
}

interface NewUserForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'super_admin' | 'manager' | 'pm' | 'user';
  title: string;
  department: string;
  isMarketing: boolean;
  brandIds: string[];
}

const TeamManagement = () => {
  const { users: rawUsers, loading, total, error, fetchUsers, createUser, updateUser, deleteUser } = useAdminUsers();
  const { brands, loading: brandsLoading } = useAdminBrands();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();

  // Form state for creating users
  const [newUser, setNewUser] = useState<NewUserForm>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'user',
    title: '',
    department: '',
    isMarketing: false,
    brandIds: [],
  });

  // Convert raw users to UI-friendly format
  const users: User[] = useMemo(() => {
    return rawUsers.map(user => ({
      ...user,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
      brandAccess: user.user_brands?.map(ub => ub.brand_name).filter(Boolean) || []
    }));
  }, [rawUsers]);

  const marketingTeamCount = useMemo(
    () => rawUsers.filter(user => user.is_marketing).length,
    [rawUsers]
  );

  const marketingMembers = useMemo(() => {
    return users.filter(user => user.is_marketing);
  }, [users]);

  // Load users on component mount
  useEffect(() => {
    fetchUsers({ page: currentPage, limit: 200 });
  }, [currentPage, fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterRole === "all" || user.role === filterRole;  
      return matchesSearch && matchesFilter;
    });
  }, [users, searchTerm, filterRole]);

  const filteredMarketingMembers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return marketingMembers;

    return marketingMembers.filter((member) => {
      const fullName = [member.first_name, member.last_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const title = (member.title || "").toLowerCase();
      return fullName.includes(term) || title.includes(term);
    });
  }, [marketingMembers, searchTerm]);

  const totalBrandsManaged = useMemo(
    () =>
      marketingMembers.reduce((count, member) => {
        return count + (member.user_brands?.length || 0);
      }, 0),
    [marketingMembers]
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-destructive text-destructive-foreground';
      case 'manager': return 'bg-primary text-primary-foreground';
      case 'pm': return 'bg-secondary text-secondary-foreground';
      case 'user': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'pm': return 'PM';
      default: return role.charAt(0).toUpperCase() + role.slice(1);
    }
  };

  const handleEditPermissions = (user: User) => {
    setSelectedUser(user);
    setIsPermissionDialogOpen(true);
  };

  const handleSavePermissions = async (
    userId: string,
    updates: {
      email: string;
      firstName: string;
      lastName: string;
      role: 'super_admin' | 'manager' | 'pm' | 'user';
      status: 'active' | 'inactive' | 'pending';
      title: string | null;
      department: string | null;
      isMarketing: boolean;
      brandAssignments: BrandAssignment[];
    }
  ) => {
    try {
      await updateUser(userId, {
        email: updates.email,
        firstName: updates.firstName,
        lastName: updates.lastName,
        role: updates.role,
        status: updates.status,
        title: updates.title,
        department: updates.department,
        isMarketing: updates.isMarketing,
        brandAssignments: updates.brandAssignments,
      });
      setIsPermissionDialogOpen(false);
    } catch (error) {
      // Error is surfaced via the updateUser hook toast handler
    }
  };


  const handleCreateUser = async () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.password) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate email domain
    if (!newUser.email.toLowerCase().endsWith('@sjinnovation.com')) {
      toast({
        title: "Error",
        description: "Only @sjinnovation.com email addresses are allowed",
        variant: "destructive",
      });
      return;
    }

    try {
      const brandAssignments: BrandAssignment[] = newUser.brandIds.map((brandId) => ({
        brand_id: brandId,
        access_level: 'member',
      }));

      const userData: CreateUserData = {
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        title: newUser.title.trim() || null,
        department: newUser.department.trim() || null,
        isMarketing: newUser.isMarketing,
        brandAssignments,
      };

      await createUser(userData);
      setIsAddDialogOpen(false);
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'user',
        title: '',
        department: '',
        isMarketing: false,
        brandIds: [],
      });
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await deleteUser(userId);
      } catch (error) {
        // Error is handled by the hook
      }
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      await updateUser(user.id, {
        status: newStatus,
      });
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleRemoveFromMarketingTeam = async (user: User) => {
    if (window.confirm(`Remove ${user.name} from the marketing team? They will still have their user account and other permissions.`)) {
      try {
        await updateUser(user.id, {
          isMarketing: false,
        });
        toast({
          title: "Success",
          description: `${user.name} has been removed from the marketing team.`,
        });
      } catch (error) {
        // Error is handled by the hook
        toast({
          title: "Error",
          description: "Failed to remove user from marketing team.",
          variant: "destructive",
        });
      }
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Team Management</h1>
            <p className="text-muted-foreground">Loading team members...</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error && users.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Team Management</h1>
            <p className="text-muted-foreground">Manage all team members and assignments</p>
          </div>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <h3 className="text-lg font-semibold">Failed to Load Team Members</h3>
                <p className="text-sm text-muted-foreground mt-2">{error}</p>
              </div>
              <Button onClick={() => fetchUsers({ page: currentPage, limit: 200 })}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Team Management</h1>
          <p className="text-muted-foreground">
            Manage all team members, roles, and brand assignments
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Team Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Team Member</DialogTitle>
              <DialogDescription>
                Create a new user account and assign roles.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input
                    id="first-name"
                    placeholder="Enter first name"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input
                    id="last-name"
                    placeholder="Enter last name"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="user-title">Title</Label>
                  <Input
                    id="user-title"
                    placeholder="e.g. Marketing Manager"
                    value={newUser.title}
                    onChange={(e) => setNewUser(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-department">Department</Label>
                  <Input
                    id="user-department"
                    placeholder="e.g. Marketing"
                    value={newUser.department}
                    onChange={(e) => setNewUser(prev => ({ ...prev, department: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email">Email Address</Label>
                <Input
                  id="user-email"
                  type="email"
                  placeholder="user@sjinnovation.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Only @sjinnovation.com email addresses are allowed
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-password">Password</Label>
                <Input
                  id="user-password"
                  type="password"
                  placeholder="Enter password"
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-role">Role</Label>
                <Select value={newUser.role} onValueChange={(value: NewUserForm['role']) => setNewUser(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="pm">PM</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Marketing Team</Label>
                <div className="flex items-center gap-2 rounded-md border p-3">
                  <Checkbox
                    id="user-marketing"
                    checked={newUser.isMarketing}
                    onCheckedChange={(checked) =>
                      setNewUser(prev => ({ ...prev, isMarketing: checked === true }))
                    }
                  />
                  <Label htmlFor="user-marketing" className="text-sm font-normal">
                    Add to marketing team
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assign Brands</Label>
                <ScrollArea className="max-h-40 rounded-md border p-3">
                  <div className="space-y-2">
                    {brandsLoading && (
                      <p className="text-sm text-muted-foreground">Loading brands…</p>
                    )}
                    {!brandsLoading && brands.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No brands available yet. Create a brand to assign access.
                      </p>
                    )}
                    {!brandsLoading && brands.map((brand) => {
                      const isSelected = newUser.brandIds.includes(brand.id);
                      return (
                        <div key={brand.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`brand-${brand.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              setNewUser(prev => ({
                                ...prev,
                                brandIds: checked === true
                                  ? Array.from(new Set([...prev.brandIds, brand.id]))
                                  : prev.brandIds.filter(id => id !== brand.id),
                              }))
                            }
                          />
                          <Label htmlFor={`brand-${brand.id}`} className="text-sm font-medium">
                            {brand.name}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground">
                  New users receive member-level access to selected brands.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateUser} disabled={loading}>
                {loading ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Team Members ({users.length})</TabsTrigger>
          <TabsTrigger value="marketing">Marketing Team ({marketingTeamCount})</TabsTrigger>
          <TabsTrigger value="role-settings">Role Settings</TabsTrigger>
        </TabsList>

        {/* All Team Members Tab */}
        <TabsContent value="all" className="space-y-4">
          {/* Filters and Search */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="pm">PM</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{total}</div>
                <p className="text-xs text-muted-foreground">Across all roles</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users.filter(u => u.status === 'active').length}
                </div>
                <p className="text-xs text-muted-foreground">Currently active</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Marketing Team</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{marketingTeamCount}</div>
                <p className="text-xs text-muted-foreground">Team members</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Filtered Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredUsers.length}</div>
                <p className="text-xs text-muted-foreground">Matching criteria</p>
              </CardContent>
            </Card>
          </div>

          {/* User Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Marketing</TableHead>
                  <TableHead>Brands</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                        {user.title && (
                          <span className="text-xs text-muted-foreground">{user.title}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleColor(user.role)}>
                        {getRoleName(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.is_marketing ? (
                        <Badge variant="outline">Marketing</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.brandAccess && user.brandAccess.length > 0 ? (
                          user.brandAccess.slice(0, 2).map((brand, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {brand}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">No brands</span>
                        )}
                        {user.brandAccess && user.brandAccess.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{user.brandAccess.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditPermissions(user)}>
                            <Shield className="mr-2 h-4 w-4" />
                            Edit Permissions
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleUserStatus(user)}>
                            {user.status === 'active' ? (
                              <>
                                <UserX className="mr-2 h-4 w-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="mr-2 h-4 w-4" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Marketing Team Tab */}
        <TabsContent value="marketing" className="space-y-4">
          {/* Search */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name or title"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Marketing team members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{marketingMembers.length}</div>
                <p className="text-xs text-muted-foreground">Active profiles</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Assigned brands</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalBrandsManaged}</div>
                <p className="text-xs text-muted-foreground">Across marketing users</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Filtered Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredMarketingMembers.length}</div>
                <p className="text-xs text-muted-foreground">Matching search</p>
              </CardContent>
            </Card>
          </div>

          {/* Marketing Team Cards */}
          {filteredMarketingMembers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <h3 className="text-lg font-semibold">No marketing members found</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try adjusting your search or add marketing members from the team tab.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredMarketingMembers.map((member) => {
                const name = [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email;
                const initials = (member.first_name?.[0] || "") + (member.last_name?.[0] || "");
                const brandNames = member.user_brands?.map((brand) => brand.brand_name).filter(Boolean) || [];

                return (
                  <Card key={member.id} className="flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{initials || "MM"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <CardTitle className="text-base leading-tight">{name}</CardTitle>
                          {member.title && (
                            <p className="text-sm text-muted-foreground">{member.title}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">Marketing Team</Badge>
                        <Badge className={`text-xs ${getRoleColor(member.role)}`}>
                          {getRoleName(member.role)}
                        </Badge>
                        {member.department && (
                          <Badge variant="secondary" className="text-xs">{member.department}</Badge>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Brands</p>
                        {brandNames.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {brandNames.map((brandName) => (
                              <Badge key={brandName} variant="outline" className="text-xs">
                                {brandName}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No brand assignments yet</p>
                        )}
                      </div>
                      <div className="mt-auto pt-4 flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleEditPermissions(member)}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Manage Access
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleRemoveFromMarketingTeam(member)}>
                              <UserX className="mr-2 h-4 w-4" />
                              Remove from Marketing Team
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleUserStatus(member)}>
                              {member.status === 'active' ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate User
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Activate User
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteUser(member.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Role Settings Tab */}
        <TabsContent value="role-settings">
          <RoleSettingsTab />
        </TabsContent>
      </Tabs>

      {/* User Permission Dialog */}
      {selectedUser && (
        <UserPermissionDialog
          isOpen={isPermissionDialogOpen}
          onClose={() => setIsPermissionDialogOpen(false)}
          user={selectedUser}
          onSave={handleSavePermissions}
        />
      )}
    </div>
  );
};

export default TeamManagement;