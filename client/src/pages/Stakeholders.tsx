import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Mail, 
  Phone, 
  Building, 
  Edit3, 
  Trash2, 
  ArrowLeft,
  UserCircle,
  AlertCircle,
  CheckCircle,
  User,
  Shield,
  Stethoscope,
  Heart,
  Scale,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import StakeholderForm from "@/components/StakeholderForm";
import type { StakeholderFormData } from "@/components/StakeholderForm";
import type { Stakeholder } from "@shared/schema";
import Header from "@/components/Header";

interface CaseInfo {
  ticketId: string;
  caseType: string;
  workerName: string;
  status: string;
  createdAt: string;
}

const roleConfig = {
  doctor: { 
    icon: Stethoscope, 
    label: "Medical Doctor",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Healthcare provider or treating physician"
  },
  insurer: { 
    icon: Shield, 
    label: "Insurance Provider",
    color: "bg-green-100 text-green-800 border-green-200",
    description: "Workers compensation or health insurer"
  },
  orc: { 
    icon: UserCircle, 
    label: "ORC",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    description: "Occupational Rehabilitation Coordinator"
  },
  rehab_provider: { 
    icon: Heart, 
    label: "Rehabilitation Provider",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    description: "Physical therapy or rehabilitation services"
  },
  lawyer: { 
    icon: Scale, 
    label: "Legal Representative",
    color: "bg-red-100 text-red-800 border-red-200",
    description: "Legal counsel or advocate"
  },
};

export default function Stakeholders() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const { toast } = useToast();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch case information
  const { data: caseInfo } = useQuery<CaseInfo>({
    queryKey: ["/api/cases", ticketId],
    enabled: !!ticketId,
  });

  // Fetch stakeholders for this case
  const { 
    data: stakeholders = [], 
    isLoading,
    error 
  } = useQuery<Stakeholder[]>({
    queryKey: ["/api/cases", ticketId, "stakeholders"],
    enabled: !!ticketId,
  });

  // Create stakeholder mutation
  const createStakeholderMutation = useMutation({
    mutationFn: async (stakeholderData: StakeholderFormData) => {
      return apiRequest("POST", "/api/stakeholders", stakeholderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", ticketId, "stakeholders"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Stakeholder Added",
        description: "New stakeholder has been added successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Adding Stakeholder",
        description: error.message || "Failed to add stakeholder. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update stakeholder mutation
  const updateStakeholderMutation = useMutation({
    mutationFn: async (stakeholderData: StakeholderFormData) => {
      return apiRequest("PUT", `/api/stakeholders/${editingStakeholder?.id}`, stakeholderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", ticketId, "stakeholders"] });
      setIsEditDialogOpen(false);
      setEditingStakeholder(null);
      toast({
        title: "Stakeholder Updated",
        description: "Stakeholder details have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Updating Stakeholder",
        description: error.message || "Failed to update stakeholder. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete stakeholder mutation
  const deleteStakeholderMutation = useMutation({
    mutationFn: async (stakeholderId: string) => {
      return apiRequest("DELETE", `/api/stakeholders/${stakeholderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", ticketId, "stakeholders"] });
      toast({
        title: "Stakeholder Removed",
        description: "Stakeholder has been removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Removing Stakeholder",
        description: error.message || "Failed to remove stakeholder. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateStakeholder = (stakeholderData: StakeholderFormData) => {
    createStakeholderMutation.mutate(stakeholderData);
  };

  const handleUpdateStakeholder = (stakeholderData: StakeholderFormData) => {
    updateStakeholderMutation.mutate(stakeholderData);
  };

  const handleEditStakeholder = (stakeholder: Stakeholder) => {
    setEditingStakeholder(stakeholder);
    setIsEditDialogOpen(true);
  };

  const handleDeleteStakeholder = (stakeholderId: string) => {
    deleteStakeholderMutation.mutate(stakeholderId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading stakeholders...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Stakeholders</h2>
            <p className="text-muted-foreground">
              Unable to load stakeholders for this case.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Group stakeholders by role for better organization
  const stakeholdersByRole = stakeholders.reduce((acc, stakeholder) => {
    if (!acc[stakeholder.role]) {
      acc[stakeholder.role] = [];
    }
    acc[stakeholder.role].push(stakeholder);
    return acc;
  }, {} as Record<string, Stakeholder[]>);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => window.history.back()}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-stakeholders-title">
                Case Stakeholders
              </h1>
              {caseInfo && (
                <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    <span>Case #{caseInfo.ticketId}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{caseInfo.workerName}</span>
                  </div>
                  <Badge variant="secondary">
                    {caseInfo.caseType === "injury" ? "Workplace Injury" : "Pre-Employment"}
                  </Badge>
                </div>
              )}
            </div>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-stakeholder">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stakeholder
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Stakeholder</DialogTitle>
                </DialogHeader>
                <StakeholderForm
                  ticketId={ticketId}
                  onSubmit={handleCreateStakeholder}
                  onCancel={() => setIsCreateDialogOpen(false)}
                  isSubmitting={createStakeholderMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stakeholders List */}
        <div className="space-y-6">
          {stakeholders.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <UserCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Stakeholders</h3>
                  <p className="text-muted-foreground mb-4">
                    No stakeholders have been added to this case yet.
                  </p>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-create-first-stakeholder">
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Stakeholder
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Stakeholder</DialogTitle>
                      </DialogHeader>
                      <StakeholderForm
                        ticketId={ticketId}
                        onSubmit={handleCreateStakeholder}
                        onCancel={() => setIsCreateDialogOpen(false)}
                        isSubmitting={createStakeholderMutation.isPending}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ) : (
            Object.entries(stakeholdersByRole).map(([role, roleStakeholders]) => {
              const RoleIcon = roleConfig[role as keyof typeof roleConfig]?.icon || UserCircle;
              const roleInfo = roleConfig[role as keyof typeof roleConfig];
              
              return (
                <div key={role} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <RoleIcon className="h-5 w-5" />
                    <h2 className="text-xl font-semibold">{roleInfo?.label || role}</h2>
                    <Badge variant="outline">{roleStakeholders.length}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {roleStakeholders.map((stakeholder) => (
                      <Card 
                        key={stakeholder.id} 
                        className="hover-elevate" 
                        data-testid={`card-stakeholder-${stakeholder.id}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <RoleIcon className="h-5 w-5" />
                                <CardTitle className="text-lg">{stakeholder.name}</CardTitle>
                              </div>
                              {stakeholder.organization && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Building className="h-4 w-4" />
                                  <span>{stakeholder.organization}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1">
                              {stakeholder.isActive ? (
                                <Badge variant="outline">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Inactive
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-3">
                          {/* Contact Information */}
                          <div className="space-y-2">
                            {stakeholder.email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span data-testid={`text-email-${stakeholder.id}`}>
                                  {stakeholder.email}
                                </span>
                              </div>
                            )}
                            
                            {stakeholder.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span data-testid={`text-phone-${stakeholder.id}`}>
                                  {stakeholder.phone}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Notes */}
                          {stakeholder.notes && (
                            <>
                              <Separator />
                              <div className="space-y-1">
                                <p className="text-sm font-medium">Notes</p>
                                <p className="text-sm text-muted-foreground" data-testid={`text-notes-${stakeholder.id}`}>
                                  {stakeholder.notes}
                                </p>
                              </div>
                            </>
                          )}

                          {/* Actions */}
                          <Separator />
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Added {stakeholder.createdAt ? format(new Date(stakeholder.createdAt), "MMM d, yyyy") : "Unknown date"}
                            </span>
                            
                            <div className="flex items-center gap-2">
                              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditStakeholder(stakeholder)}
                                    data-testid={`button-edit-stakeholder-${stakeholder.id}`}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Edit Stakeholder</DialogTitle>
                                  </DialogHeader>
                                  {editingStakeholder && (
                                    <StakeholderForm
                                      ticketId={ticketId}
                                      initialData={editingStakeholder}
                                      onSubmit={handleUpdateStakeholder}
                                      onCancel={() => setIsEditDialogOpen(false)}
                                      isSubmitting={updateStakeholderMutation.isPending}
                                      mode="edit"
                                    />
                                  )}
                                </DialogContent>
                              </Dialog>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    data-testid={`button-delete-stakeholder-${stakeholder.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Stakeholder</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove {stakeholder.name} from this case? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteStakeholder(stakeholder.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}