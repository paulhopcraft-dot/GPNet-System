import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Building, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Archive, 
  Eye,
  Users,
  Calendar,
  Loader2
} from "lucide-react";
import { useUser } from "@/components/UserContext";

interface Organization {
  id: string;
  name: string;
  slug: string;
  domain: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  caseCount?: number;
}

export default function OrganizationsTab() {
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Fetch organizations
  const { 
    data: organizations = [], 
    isLoading,
    error 
  } = useQuery<Organization[]>({ 
    queryKey: ["/api/admin/organizations"] 
  });

  // Start impersonation mutation
  const impersonateMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      return apiRequest("POST", "/api/auth/impersonate/start", { organizationId });
    },
    onSuccess: () => {
      // Refresh user context and redirect to dashboard
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.location.href = "/";
    },
  });

  // Archive organization mutation
  const archiveMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      return apiRequest("POST", `/api/admin/organizations/${organizationId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
    },
  });

  // Filter organizations based on search
  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.domain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleImpersonate = (org: Organization) => {
    if (!user?.permissions?.includes('superuser')) {
      alert('Only superusers can impersonate organizations');
      return;
    }
    
    if (confirm(`Are you sure you want to impersonate ${org.name}? This will switch your session to that organization's context.`)) {
      impersonateMutation.mutate(org.id);
    }
  };

  const handleArchive = (org: Organization) => {
    if (confirm(`Are you sure you want to archive ${org.name}? This will deactivate the organization.`)) {
      archiveMutation.mutate(org.id);
    }
  };

  const handleViewDetails = (org: Organization) => {
    setSelectedOrg(org);
    setIsViewDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Loading organizations...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-red-600">Error loading organizations</p>
            <p className="text-muted-foreground text-sm mt-2">
              {error.message}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Organizations ({organizations.length})
              </CardTitle>
              <CardDescription>
                Manage client organizations and their settings
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-organization">
              <Plus className="h-4 w-4 mr-2" />
              Add Organization
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-organizations"
            />
          </div>

          {/* Organizations Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Cases</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrganizations.map((org) => (
                  <TableRow key={org.id} data-testid={`row-organization-${org.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{org.name}</div>
                        <div className="text-sm text-muted-foreground">
                          /{org.slug}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{org.domain}</TableCell>
                    <TableCell className="text-sm">
                      <div>{org.contactEmail}</div>
                      {org.contactPhone && (
                        <div className="text-xs text-muted-foreground">
                          {org.contactPhone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span className="text-sm">{org.userCount || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{org.caseCount || 0}</span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={org.isActive ? "default" : "secondary"}
                        data-testid={`badge-status-${org.id}`}
                      >
                        {org.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(org.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-actions-${org.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(org)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {user?.permissions?.includes('superuser') && (
                            <DropdownMenuItem 
                              onClick={() => handleImpersonate(org)}
                              disabled={impersonateMutation.isPending}
                            >
                              <Users className="h-4 w-4 mr-2" />
                              {impersonateMutation.isPending ? "Switching..." : "Impersonate"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleArchive(org)}
                            className="text-destructive"
                            disabled={archiveMutation.isPending}
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredOrganizations.length === 0 && (
            <div className="text-center py-12">
              <Building className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No organizations found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No organizations match your search criteria." : "Get started by creating your first organization."}
              </p>
              {!searchTerm && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Organization
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Organization Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              {selectedOrg?.name}
            </DialogTitle>
            <DialogDescription>
              Organization details and statistics
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrg && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Slug</h4>
                  <p className="text-sm">/{selectedOrg.slug}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Domain</h4>
                  <p className="text-sm">{selectedOrg.domain}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Contact Email</h4>
                  <p className="text-sm">{selectedOrg.contactEmail}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Contact Phone</h4>
                  <p className="text-sm">{selectedOrg.contactPhone || "Not provided"}</p>
                </div>
              </div>
              
              {selectedOrg.address && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Address</h4>
                  <p className="text-sm">{selectedOrg.address}</p>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Users</h4>
                  <p className="text-2xl font-bold">{selectedOrg.userCount || 0}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Cases</h4>
                  <p className="text-2xl font-bold">{selectedOrg.caseCount || 0}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Status</h4>
                  <Badge variant={selectedOrg.isActive ? "default" : "secondary"}>
                    {selectedOrg.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium">Created:</span> {new Date(selectedOrg.createdAt).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Updated:</span> {new Date(selectedOrg.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}