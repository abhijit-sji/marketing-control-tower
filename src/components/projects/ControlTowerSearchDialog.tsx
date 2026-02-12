import { useState, useEffect } from 'react';
import { Search, Download, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useControlTower } from '@/hooks/useControlTower';
import { toast } from '@/hooks/use-toast';

// Helper to normalize response and extract projects array
const normalizeProjects = (data: any): any[] | null => {
  if (!data) return null;

  // Direct array
  if (Array.isArray(data)) return data;

  // Nested in projects property
  if (data.projects) {
    if (Array.isArray(data.projects)) return data.projects;
    if (Array.isArray(data.projects.data)) return data.projects.data;
  }

  // Nested in data property
  if (Array.isArray(data.data)) return data.data;

  // Unknown structure
  return null;
};

export const ControlTowerSearchDialog = ({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) => {
  const [openInternal, setOpenInternal] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen ?? openInternal;
  const setOpen = controlledOnOpenChange ?? setOpenInternal;
  const [searchQuery, setSearchQuery] = useState('');
  const [importingProjectId, setImportingProjectId] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState<{id: string, name: string} | null>(null);
  const { searchProjects, importProject } = useControlTower();

  // Check for invalid data structure after search completes
  useEffect(() => {
    if (searchProjects.isSuccess && searchProjects.data) {
      const projects = normalizeProjects(searchProjects.data);

      if (projects === null) {
        console.error('Invalid projects data structure:', searchProjects.data);
        toast({
          title: 'Data Format Error',
          description: 'Projects data is not in the expected format. Please contact support.',
          variant: 'destructive',
        });
      }
    }
  }, [searchProjects.isSuccess, searchProjects.data]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchProjects.mutate(searchQuery);
    } else {
      toast({
        title: 'Search Required',
        description: 'Please enter a project name to search.',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async (projectId: string, projectName: string) => {
    setImportingProjectId(projectId);
    try {
      console.log(`🚀 Starting import from Control Tower: ${projectName} (ID: ${projectId})`);
      await importProject.mutateAsync({ projectId, projectName });
      console.log(`✅ Successfully imported project: ${projectName}`);
      setOpen(false);
      setConfirmImport(null);
    } catch (error) {
      console.error(`❌ Failed to import project ${projectName}:`, error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import project. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setImportingProjectId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Only render trigger button in standalone mode (when not controlled) */}
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="outline">
            <Search className="h-4 w-4 mr-2" />
            Import from Control Tower
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Search Control Tower Projects</DialogTitle>
          <DialogDescription>
            Search for projects in Control Tower and import them to your local database
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter project name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searchProjects.isPending}>
              {searchProjects.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Error State */}
          {searchProjects.isError && (
            <div className="text-center py-8">
              <p className="text-destructive font-medium">Search Failed</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchProjects.error instanceof Error
                  ? searchProjects.error.message
                  : 'Unable to search projects. Please check your connection and try again.'}
              </p>
            </div>
          )}

          {/* Results */}
          {searchProjects.data && (() => {
            const projects = normalizeProjects(searchProjects.data);

            if (!projects) {
              return null;
            }

            if (projects.length === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  No projects found matching "{searchQuery}"
                </div>
              );
            }

            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Found {projects.length} project{projects.length !== 1 ? 's' : ''}
                </p>
                {projects.map((project: any) => (
                  <Card key={project.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{project.name}</h3>
                        {project.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {project.status && (
                            <Badge variant={project.status === 'active' ? 'default' : 'outline'}>
                              {project.status}
                            </Badge>
                          )}
                          {project.progress !== null && project.progress !== undefined && (
                            <Badge variant="secondary">
                              Progress: {project.progress}%
                            </Badge>
                          )}
                          {project.manager && (
                            <Badge variant="outline">
                              PM: {project.manager}
                            </Badge>
                          )}
                          {project.team && (
                            <Badge variant="outline">
                              Team: {project.team}
                            </Badge>
                          )}
                          {project.priority && (
                            <Badge variant={project.priority === 'high' ? 'destructive' : 'secondary'}>
                              {project.priority}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setConfirmImport({
                          id: project.id,
                          name: project.name
                        })}
                        disabled={
                          importingProjectId !== null ||
                          importProject.isPending ||
                          !project.name
                        }
                      >
                        {importingProjectId === project.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Import
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            );
          })()}
        </div>
      </DialogContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmImport} onOpenChange={() => setConfirmImport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to import "{confirmImport?.name}" from Control Tower?
              This will add the project to your local database or update it if it already exists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmImport) {
                handleImport(confirmImport.id, confirmImport.name);
              }
            }}>
              Import Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
