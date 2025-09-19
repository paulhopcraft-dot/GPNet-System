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
  Calendar, 
  Clock, 
  FileText, 
  Edit3, 
  Trash2, 
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  User,
  Building
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import RtwPlanForm from "@/components/RtwPlanForm";
import type { RtwPlanFormData } from "@shared/schema";
import Header from "@/components/Header";

interface RtwPlan {
  id: string;
  ticketId: string;
  doctorStakeholderId?: string;
  title: string;
  restrictions: string[];
  modifiedDuties: string[];
  targetReturnDate: string;
  reviewDate: string;
  status: "draft" | "pending_approval" | "approved" | "active" | "completed";
  doctorApproval: boolean;
  doctorNotes?: string;
  approvalAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface CaseInfo {
  ticketId: string;
  caseType: string;
  workerName: string;
  status: string;
  createdAt: string;
}

const statusConfig = {
  draft: { 
    variant: "secondary" as const, 
    label: "Draft",
    icon: FileText,
    description: "Plan is being prepared"
  },
  pending_approval: { 
    variant: "default" as const, 
    label: "Pending Approval",
    icon: Clock,
    description: "Awaiting doctor approval"
  },
  approved: { 
    variant: "default" as const, 
    label: "Approved",
    icon: CheckCircle,
    description: "Approved by medical professional"
  },
  active: { 
    variant: "outline" as const, 
    label: "Active",
    icon: User,
    description: "Worker is following this plan"
  },
  completed: { 
    variant: "outline" as const, 
    label: "Completed",
    icon: CheckCircle,
    description: "Successfully completed"
  },
};

export default function RtwPlans() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const { toast } = useToast();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RtwPlan | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch case information
  const { data: caseInfo } = useQuery<CaseInfo>({
    queryKey: ["/api/cases", ticketId],
    enabled: !!ticketId,
  });

  // Fetch RTW plans for this case
  const { 
    data: plans = [], 
    isLoading,
    error 
  } = useQuery<RtwPlan[]>({
    queryKey: ["/api/cases", ticketId, "rtw-plans"],
    enabled: !!ticketId,
  });

  // Create RTW plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (planData: RtwPlanFormData) => {
      return apiRequest("POST", `/api/cases/${ticketId}/rtw-plans`, planData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", ticketId, "rtw-plans"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "RTW Plan Created",
        description: "Return to Work plan has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Creating Plan",
        description: error.message || "Failed to create RTW plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update RTW plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async (planData: RtwPlanFormData) => {
      return apiRequest("PUT", `/api/rtw-plans/${editingPlan?.id}`, planData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", ticketId, "rtw-plans"] });
      setIsEditDialogOpen(false);
      setEditingPlan(null);
      toast({
        title: "RTW Plan Updated",
        description: "Return to Work plan has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Updating Plan",
        description: error.message || "Failed to update RTW plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete RTW plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      return apiRequest("DELETE", `/api/rtw-plans/${planId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", ticketId, "rtw-plans"] });
      toast({
        title: "RTW Plan Deleted",
        description: "Return to Work plan has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Deleting Plan",
        description: error.message || "Failed to delete RTW plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update plan status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ planId, status }: { planId: string; status: string }) => {
      return apiRequest("PATCH", `/api/rtw-plans/${planId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", ticketId, "rtw-plans"] });
      toast({
        title: "Status Updated",
        description: "RTW plan status has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Updating Status",
        description: error.message || "Failed to update plan status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreatePlan = (planData: RtwPlanFormData) => {
    createPlanMutation.mutate(planData);
  };

  const handleUpdatePlan = (planData: RtwPlanFormData) => {
    updatePlanMutation.mutate(planData);
  };

  const handleEditPlan = (plan: RtwPlan) => {
    setEditingPlan(plan);
    setIsEditDialogOpen(true);
  };

  const handleDeletePlan = (planId: string) => {
    deletePlanMutation.mutate(planId);
  };

  const handleStatusChange = (planId: string, status: string) => {
    updateStatusMutation.mutate({ planId, status });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading RTW plans...</p>
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
            <h2 className="text-xl font-semibold mb-2">Error Loading RTW Plans</h2>
            <p className="text-muted-foreground">
              Unable to load Return to Work plans for this case.
            </p>
          </div>
        </main>
      </div>
    );
  }

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
              <h1 className="text-3xl font-bold" data-testid="text-rtw-plans-title">
                Return to Work Plans
              </h1>
              {caseInfo && (
                <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Building className="h-4 w-4" />
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
                <Button data-testid="button-create-rtw-plan">
                  <Plus className="h-4 w-4 mr-2" />
                  Create RTW Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Return to Work Plan</DialogTitle>
                </DialogHeader>
                <RtwPlanForm
                  ticketId={ticketId}
                  onSubmit={handleCreatePlan}
                  onCancel={() => setIsCreateDialogOpen(false)}
                  isSubmitting={createPlanMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* RTW Plans List */}
        <div className="space-y-6">
          {plans.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No RTW Plans</h3>
                  <p className="text-muted-foreground mb-4">
                    No Return to Work plans have been created for this case yet.
                  </p>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-create-first-plan">
                        <Plus className="h-4 w-4 mr-2" />
                        Create First RTW Plan
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create Return to Work Plan</DialogTitle>
                      </DialogHeader>
                      <RtwPlanForm
                        ticketId={ticketId}
                        onSubmit={handleCreatePlan}
                        onCancel={() => setIsCreateDialogOpen(false)}
                        isSubmitting={createPlanMutation.isPending}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ) : (
            plans.map((plan) => {
              const StatusIcon = statusConfig[plan.status].icon;
              
              return (
                <Card key={plan.id} className="hover-elevate" data-testid={`card-rtw-plan-${plan.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <StatusIcon className="h-5 w-5" />
                          <CardTitle className="text-xl">{plan.title}</CardTitle>
                          <Badge 
                            {...statusConfig[plan.status]}
                            data-testid={`badge-plan-status-${plan.status}`}
                          >
                            {statusConfig[plan.status].label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {statusConfig[plan.status].description}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditPlan(plan)}
                              data-testid={`button-edit-plan-${plan.id}`}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit Return to Work Plan</DialogTitle>
                            </DialogHeader>
                            {editingPlan && (
                              <RtwPlanForm
                                ticketId={ticketId}
                                initialData={editingPlan}
                                onSubmit={handleUpdatePlan}
                                onCancel={() => setIsEditDialogOpen(false)}
                                isSubmitting={updatePlanMutation.isPending}
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
                              data-testid={`button-delete-plan-${plan.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete RTW Plan</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{plan.title}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeletePlan(plan.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Plan Timeline */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Target Return:</span>
                        <span data-testid={`text-target-date-${plan.id}`}>
                          {format(new Date(plan.targetReturnDate), "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Review Date:</span>
                        <span data-testid={`text-review-date-${plan.id}`}>
                          {format(new Date(plan.reviewDate), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    {/* Restrictions and Duties */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Work Restrictions */}
                      <div className="space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Work Restrictions
                        </h4>
                        {plan.restrictions.length > 0 ? (
                          <div className="space-y-2">
                            {plan.restrictions.map((restriction, index) => (
                              <div 
                                key={index} 
                                className="flex items-center gap-2 text-sm"
                                data-testid={`restriction-${plan.id}-${index}`}
                              >
                                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                <span>{restriction}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No restrictions specified</p>
                        )}
                      </div>

                      {/* Modified Duties */}
                      <div className="space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Modified Duties
                        </h4>
                        {plan.modifiedDuties.length > 0 ? (
                          <div className="space-y-2">
                            {plan.modifiedDuties.map((duty, index) => (
                              <div 
                                key={index} 
                                className="flex items-center gap-2 text-sm"
                                data-testid={`duty-${plan.id}-${index}`}
                              >
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span>{duty}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No modified duties specified</p>
                        )}
                      </div>
                    </div>

                    {/* Doctor Notes */}
                    {plan.doctorNotes && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <h4 className="font-semibold">Medical Notes</h4>
                          <p className="text-sm text-muted-foreground" data-testid={`doctor-notes-${plan.id}`}>
                            {plan.doctorNotes}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Plan Metadata */}
                    <Separator />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Created by {plan.createdBy}</span>
                      <span>
                        {plan.updatedAt !== plan.createdAt ? "Updated" : "Created"}{" "}
                        {format(new Date(plan.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}