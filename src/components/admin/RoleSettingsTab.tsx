import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Shield, RefreshCw, AlertCircle, Save, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import {
  AppRole,
  PERMISSION_CATEGORIES,
  getRoleDisplayName,
  RolePermissionConfig,
} from '@/types/rolePermissions';
import { cn } from '@/lib/utils';

export const RoleSettingsTab = () => {
  const { rolePermissions, loading, error, updateRolePermissions, resetRolePermissions } =
    useRolePermissions();
  
  const [editedPermissions, setEditedPermissions] = useState<Record<AppRole, Record<string, boolean>>>({} as any);
  const [hasChanges, setHasChanges] = useState<Record<AppRole, boolean>>({
    super_admin: false,
    manager: false,
    pm: false,
    user: false,
  });
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [roleToReset, setRoleToReset] = useState<AppRole | null>(null);
  const [savingRole, setSavingRole] = useState<AppRole | null>(null);

  // Initialize edited permissions from current permissions
  React.useEffect(() => {
    if (rolePermissions && Object.keys(editedPermissions).length === 0) {
      const initial: Record<AppRole, Record<string, boolean>> = {} as any;
      (['super_admin', 'manager', 'pm', 'user'] as AppRole[]).forEach((role) => {
        initial[role] = { ...rolePermissions[role].permissions };
      });
      setEditedPermissions(initial);
    }
  }, [rolePermissions]);

  const handlePermissionToggle = (role: AppRole, permissionId: string, checked: boolean) => {
    setEditedPermissions((prev) => ({
      ...prev,
      [role]: {
        ...(prev[role] || {}),
        [permissionId]: checked,
      },
    }));

    // Mark this role as having changes
    const hasChange = JSON.stringify({
      ...(editedPermissions[role] || {}),
      [permissionId]: checked,
    }) !== JSON.stringify(rolePermissions[role].permissions);

    setHasChanges((prev) => ({
      ...prev,
      [role]: hasChange,
    }));
  };

  const handleSaveRole = async (role: AppRole) => {
    setSavingRole(role);
    try {
      await updateRolePermissions(role, editedPermissions[role]);
      setHasChanges((prev) => ({ ...prev, [role]: false }));
    } catch (error) {
      console.error('Error saving role permissions:', error);
    } finally {
      setSavingRole(null);
    }
  };

  const handleResetRole = async (role: AppRole) => {
    setRoleToReset(role);
    setResetDialogOpen(true);
  };

  const confirmReset = async () => {
    if (!roleToReset) return;

    try {
      await resetRolePermissions(roleToReset);
      // Update edited permissions to match the reset
      setEditedPermissions((prev) => ({
        ...prev,
        [roleToReset]: { ...rolePermissions[roleToReset].permissions },
      }));
      setHasChanges((prev) => ({ ...prev, [roleToReset]: false }));
    } catch (error) {
      console.error('Error resetting role permissions:', error);
    } finally {
      setResetDialogOpen(false);
      setRoleToReset(null);
    }
  };

  const getRoleBadgeColor = (role: AppRole) => {
    const colors: Record<AppRole, string> = {
      super_admin: 'bg-red-500 text-white',
      manager: 'bg-blue-500 text-white',
      pm: 'bg-purple-500 text-white',
      user: 'bg-gray-500 text-white',
    };
    return colors[role];
  };

  const countEnabledPermissions = (role: AppRole): number => {
    const permissions = editedPermissions[role] || rolePermissions[role].permissions;
    return Object.values(permissions).filter((enabled) => enabled).length;
  };

  const totalPermissions = PERMISSION_CATEGORIES.reduce(
    (total, category) => total + category.permissions.length,
    0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading role permissions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <h3 className="text-lg font-semibold">Failed to Load Permissions</h3>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const roles: AppRole[] = ['super_admin', 'manager', 'pm', 'user'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Role Permission Settings</h2>
          <p className="text-muted-foreground mt-1">
            Configure what each role can access and manage across the platform
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Super Admin Only
        </Badge>
      </div>

      {/* Role Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {roles.map((role) => (
          <Card key={role}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge className={cn('text-xs', getRoleBadgeColor(role))}>
                  {getRoleDisplayName(role)}
                </Badge>
                {hasChanges[role] && (
                  <Badge variant="secondary" className="text-xs">
                    Unsaved
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{countEnabledPermissions(role)}</span>
                  <span className="text-sm text-muted-foreground">/ {totalPermissions}</span>
                </div>
                <p className="text-xs text-muted-foreground">Permissions enabled</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Matrix</CardTitle>
          <CardDescription>
            Toggle permissions for each role. Changes must be saved individually per role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-6">
              {PERMISSION_CATEGORIES.map((category) => (
                <div key={category.id} className="space-y-4">
                  {/* Category Header */}
                  <div className="sticky top-0 bg-background z-10 pb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{category.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {category.permissions.length}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                    <Separator className="mt-2" />
                  </div>

                  {/* Permissions Table */}
                  <div className="space-y-2">
                    {category.permissions.map((permission) => (
                      <div
                        key={permission.id}
                        className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 items-center py-3 px-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        {/* Permission Info */}
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{permission.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {permission.description}
                          </p>
                        </div>

                        {/* Role Checkboxes */}
                        {roles.map((role) => (
                          <div key={`${permission.id}-${role}`} className="flex justify-center">
                            <Checkbox
                              checked={
                                editedPermissions[role]?.[permission.id] ??
                                rolePermissions[role].permissions[permission.id] ??
                                false
                              }
                              onCheckedChange={(checked) =>
                                handlePermissionToggle(role, permission.id, checked === true)
                              }
                              disabled={savingRole === role}
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Column Headers - Fixed at bottom */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 items-center py-3 px-4 mt-4 border-t bg-muted/30">
            <div className="font-semibold text-sm">Permission</div>
            {roles.map((role) => (
              <div key={role} className="text-center space-y-2">
                <Badge className={cn('text-xs w-full', getRoleBadgeColor(role))}>
                  {getRoleDisplayName(role)}
                </Badge>
                <div className="flex gap-1 justify-center">
                  <Button
                    size="sm"
                    variant={hasChanges[role] ? 'default' : 'outline'}
                    onClick={() => handleSaveRole(role)}
                    disabled={!hasChanges[role] || savingRole === role}
                    className="h-7 text-xs"
                  >
                    {savingRole === role ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : hasChanges[role] ? (
                      <>
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Saved
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleResetRole(role)}
                    disabled={savingRole === role}
                    className="h-7 text-xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Important Notes</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Permission changes apply immediately to all users with that role</li>
                <li>Super Admin permissions should not be restricted for system security</li>
                <li>Reset button restores default permissions for that role</li>
                <li>Changes must be saved per role using the Save button</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Role Permissions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all permissions for{' '}
              <strong>{roleToReset && getRoleDisplayName(roleToReset)}</strong> to their default
              values. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoleToReset(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset}>Reset to Defaults</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

