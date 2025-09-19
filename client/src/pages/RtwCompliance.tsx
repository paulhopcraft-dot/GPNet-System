import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle, Clock, FileText, Users, Scale, Calendar, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { 
  insertRtwWorkflowStepSchema, 
  insertWorkerParticipationEventSchema, 
  insertComplianceAuditSchema,
  type InsertRtwWorkflowStep,
  type InsertWorkerParticipationEvent,
  type InsertComplianceAudit 
} from "@shared/schema";

// Extended schemas with additional frontend validation
const rtwWorkflowStepFormSchema = insertRtwWorkflowStepSchema.extend({
  stepId: z.string().min(1, "Step ID is required"),
  deadlineDate: z.string().min(1, "Deadline date is required"),
});

const participationEventFormSchema = insertWorkerParticipationEventSchema.extend({
  eventType: z.string().min(1, "Event type is required"),
  eventDate: z.string().min(1, "Event date is required"),
  participationStatus: z.string().min(1, "Participation status is required"),
});

const complianceAuditFormSchema = insertComplianceAuditSchema.extend({
  action: z.string().min(1, "Action is required"),
  actorName: z.string().min(1, "Actor name is required"),
  sourceVersion: z.string().default("2025-09-19"),
  checksum: z.string().default("pending"),
});

type RtwWorkflowStepForm = z.infer<typeof rtwWorkflowStepFormSchema>;
type ParticipationEventForm = z.infer<typeof participationEventFormSchema>;
type ComplianceAuditForm = z.infer<typeof complianceAuditFormSchema>;

export default function RtwCompliance() {
  const { toast } = useToast();
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch all cases for selection
  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["/api/cases"],
  });

  // Fetch legislation data
  const { data: legislation, isLoading: legislationLoading } = useQuery({
    queryKey: ["/api/legislation"],
  });

  // Fetch RTW workflow steps for selected ticket
  const { data: workflowSteps, isLoading: workflowLoading } = useQuery({
    queryKey: ["/api/tickets", selectedTicketId, "rtw-workflow"],
    enabled: !!selectedTicketId,
  });

  // Fetch compliance audit trail
  const { data: complianceAudit, isLoading: auditLoading } = useQuery({
    queryKey: ["/api/tickets", selectedTicketId, "compliance-audit"],
    enabled: !!selectedTicketId,
  });

  // Fetch participation events
  const { data: participationEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/tickets", selectedTicketId, "participation-events"],
    enabled: !!selectedTicketId,
  });

  // RTW Workflow Step Form
  const workflowForm = useForm<RtwWorkflowStepForm>({
    resolver: zodResolver(rtwWorkflowStepFormSchema),
    defaultValues: {
      ticketId: selectedTicketId,
      stepId: "",
      status: "pending",
      deadlineDate: "",
      notes: "",
    },
  });

  // Participation Event Form
  const participationForm = useForm<ParticipationEventForm>({
    resolver: zodResolver(participationEventFormSchema),
    defaultValues: {
      ticketId: selectedTicketId,
      eventType: "planning_meeting",
      eventDate: "",
      participationStatus: "attended",
    },
  });

  // Compliance Audit Form
  const auditForm = useForm<ComplianceAuditForm>({
    resolver: zodResolver(complianceAuditFormSchema),
    defaultValues: {
      ticketId: selectedTicketId,
      action: "MANUAL_REVIEW",
      actorId: "system",
      actorName: "System User",
      sourceVersion: "2025-09-19",
      checksum: "pending",
    },
  });

  // Create RTW workflow step mutation
  const createWorkflowStepMutation = useMutation({
    mutationFn: async (data: RtwWorkflowStepForm) => {
      const response = await fetch(`/api/tickets/${selectedTicketId}/rtw-workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create workflow step");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", selectedTicketId, "rtw-workflow"] });
      toast({ title: "RTW workflow step created successfully" });
      workflowForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error creating workflow step",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create participation event mutation
  const createParticipationEventMutation = useMutation({
    mutationFn: async (data: ParticipationEventForm) => {
      const response = await fetch(`/api/tickets/${selectedTicketId}/participation-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to record participation event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", selectedTicketId, "participation-events"] });
      toast({ title: "Participation event recorded successfully" });
      participationForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error recording participation event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create compliance audit mutation
  const createComplianceAuditMutation = useMutation({
    mutationFn: async (data: ComplianceAuditForm) => {
      const response = await fetch(`/api/tickets/${selectedTicketId}/compliance-audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create compliance audit");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", selectedTicketId, "compliance-audit"] });
      toast({ title: "Compliance audit created successfully" });
      auditForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error creating compliance audit",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onWorkflowSubmit = (data: RtwWorkflowStepForm) => {
    createWorkflowStepMutation.mutate(data);
  };

  const onParticipationSubmit = (data: ParticipationEventForm) => {
    createParticipationEventMutation.mutate(data);
  };

  const onAuditSubmit = (data: ComplianceAuditForm) => {
    createComplianceAuditMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, icon: Clock, label: "Pending" },
      in_progress: { variant: "default" as const, icon: Clock, label: "In Progress" },
      completed: { variant: "outline" as const, icon: CheckCircle, label: "Completed" },
      overdue: { variant: "destructive" as const, icon: AlertTriangle, label: "Overdue" },
      compliant: { variant: "outline" as const, icon: CheckCircle, label: "Compliant" },
      non_compliant: { variant: "destructive" as const, icon: AlertTriangle, label: "Non-Compliant" },
      at_risk: { variant: "secondary" as const, icon: AlertCircle, label: "At Risk" },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return <Badge variant="secondary">{status}</Badge>;

    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (ticketsLoading || legislationLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading RTW compliance system...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RTW Complex Claims</h1>
          <p className="text-muted-foreground">
            Legislation-backed compliance management with automated workflow tracking
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Scale className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">WIRC Act & Claims Manual Compliant</span>
        </div>
      </div>

      {/* Ticket Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Case Selection
          </CardTitle>
          <CardDescription>
            Select a ticket to manage RTW compliance workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="ticket-select">Select Ticket</Label>
              <Select value={selectedTicketId} onValueChange={setSelectedTicketId}>
                <SelectTrigger id="ticket-select" data-testid="select-ticket">
                  <SelectValue placeholder="Choose a ticket to manage RTW compliance..." />
                </SelectTrigger>
                <SelectContent>
                  {(tickets as any[])?.map((ticket: any) => (
                    <SelectItem key={ticket.ticketId} value={ticket.ticketId}>
                      #{ticket.ticketId} - {ticket.workerName || 'No worker name'} ({ticket.company || 'No Company'})
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            </div>
            {selectedTicketId && (
              <Button variant="outline" onClick={() => setSelectedTicketId("")} data-testid="button-clear-selection">
                Clear Selection
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedTicketId && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="workflow" data-testid="tab-workflow">Workflow Steps</TabsTrigger>
            <TabsTrigger value="participation" data-testid="tab-participation">Participation</TabsTrigger>
            <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
            <TabsTrigger value="legislation" data-testid="tab-legislation">Legislation</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Workflow Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-workflow-count">
                    {Array.isArray(workflowSteps) ? workflowSteps.length : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Active workflow steps</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Participation Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-participation-count">
                    {Array.isArray(participationEvents) ? participationEvents.length : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Recorded events</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Compliance Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-compliance-count">
                    {Array.isArray(complianceAudit) ? complianceAudit.length : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Audit entries</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest RTW compliance activities for this case</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.isArray(workflowSteps) && workflowSteps.slice(-3).map((step: any, index: number) => (
                    <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{step.stepType} - {step.stepId}</p>
                        <p className="text-sm text-muted-foreground">Due: {step.deadlineDate}</p>
                      </div>
                      {getStatusBadge(step.status)}
                    </div>
                  ))}
                  {(!Array.isArray(workflowSteps) || workflowSteps.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">
                      No workflow steps found. Create a new workflow step to get started.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Workflow Steps Tab */}
          <TabsContent value="workflow" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">RTW Workflow Management</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-workflow-step">Create Workflow Step</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create RTW Workflow Step</DialogTitle>
                    <DialogDescription>
                      Add a new step to the RTW compliance workflow with legislation references
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...workflowForm}>
                    <form onSubmit={workflowForm.handleSubmit(onWorkflowSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={workflowForm.control}
                          name="stepId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Step ID</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., RTW-001" {...field} data-testid="input-step-id" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={workflowForm.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-status">
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="escalated">Escalated</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={workflowForm.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-status">
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="overdue">Overdue</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={workflowForm.control}
                          name="deadlineDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Due Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-due-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={workflowForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Additional notes and details..."
                                className="resize-none"
                                {...field}
                                data-testid="textarea-notes"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="submit" disabled={createWorkflowStepMutation.isPending} data-testid="button-submit-workflow">
                          {createWorkflowStepMutation.isPending ? "Creating..." : "Create Workflow Step"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-4">
              {workflowLoading ? (
                <div className="text-center py-8">
                  <Clock className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p>Loading workflow steps...</p>
                </div>
              ) : Array.isArray(workflowSteps) && workflowSteps.length > 0 ? (
                workflowSteps.map((step: any, index: number) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{step.stepId}</CardTitle>
                        {getStatusBadge(step.status)}
                      </div>
                      <CardDescription>
                        {step.stepId} • Due: {step.deadlineDate}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {step.actionRequired && (
                          <p><strong>Action Required:</strong> {step.actionRequired}</p>
                        )}
                        {step.notes && (
                          <p><strong>Notes:</strong> {step.notes}</p>
                        )}
                        {step.legislationReferences && step.legislationReferences.length > 0 && (
                          <div>
                            <strong>Legislation References:</strong>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {step.legislationReferences.map((ref: string, refIndex: number) => (
                                <Badge key={refIndex} variant="outline" className="text-xs">
                                  {ref}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No workflow steps found for this ticket.</p>
                    <p className="text-sm text-muted-foreground mt-1">Create your first workflow step to get started.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Participation Tab */}
          <TabsContent value="participation" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Worker Participation Tracking</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-participation-event">Record Participation Event</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Worker Participation Event</DialogTitle>
                    <DialogDescription>
                      Document worker participation in RTW activities as required by WIRC Act s111-s113
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...participationForm}>
                    <form onSubmit={participationForm.handleSubmit(onParticipationSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={participationForm.control}
                          name="eventType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Event Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-event-type">
                                    <SelectValue placeholder="Select event type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="meeting">Meeting</SelectItem>
                                  <SelectItem value="assessment">Assessment</SelectItem>
                                  <SelectItem value="interview">Interview</SelectItem>
                                  <SelectItem value="training">Training</SelectItem>
                                  <SelectItem value="consultation">Consultation</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={participationForm.control}
                          name="eventDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Event Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-event-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={participationForm.control}
                        name="participationStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Participation Level</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-participation-level">
                                  <SelectValue placeholder="Select participation level" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="full">Full Participation</SelectItem>
                                <SelectItem value="partial">Partial Participation</SelectItem>
                                <SelectItem value="none">No Participation</SelectItem>
                                <SelectItem value="refused">Refused to Participate</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={participationForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Document participation details, concerns, or follow-up actions..."
                                className="resize-none"
                                {...field}
                                data-testid="textarea-participation-notes"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="submit" disabled={createParticipationEventMutation.isPending} data-testid="button-submit-participation">
                          {createParticipationEventMutation.isPending ? "Recording..." : "Record Event"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-4">
              {eventsLoading ? (
                <div className="text-center py-8">
                  <Clock className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p>Loading participation events...</p>
                </div>
              ) : Array.isArray(participationEvents) && participationEvents.length > 0 ? (
                participationEvents.map((event: any, index: number) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg capitalize">{event.eventType}</CardTitle>
                        {getStatusBadge(event.participationLevel)}
                      </div>
                      <CardDescription>
                        <Calendar className="h-4 w-4 inline mr-1" />
                        {event.eventDate}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {event.notes && <p>{event.notes}</p>}
                      {event.followUpRequired && (
                        <Badge variant="secondary" className="mt-2">
                          Follow-up Required
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No participation events recorded for this ticket.</p>
                    <p className="text-sm text-muted-foreground mt-1">Start tracking worker participation to ensure WIRC Act compliance.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Compliance Audit Trail</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-compliance-audit">Create Compliance Audit</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Compliance Audit</DialogTitle>
                    <DialogDescription>
                      Document compliance status with legislation-backed evidence
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...auditForm}>
                    <form onSubmit={auditForm.handleSubmit(onAuditSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={auditForm.control}
                          name="action"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Audit Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-audit-type">
                                    <SelectValue placeholder="Select audit type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="manual">Manual Review</SelectItem>
                                  <SelectItem value="automated">Automated Check</SelectItem>
                                  <SelectItem value="scheduled">Scheduled Audit</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={auditForm.control}
                          name="result"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Compliance Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-compliance-status">
                                    <SelectValue placeholder="Select compliance status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="compliant">Compliant</SelectItem>
                                  <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                                  <SelectItem value="at_risk">At Risk</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="submit" disabled={createComplianceAuditMutation.isPending} data-testid="button-submit-audit">
                          {createComplianceAuditMutation.isPending ? "Creating..." : "Create Audit"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-4">
              {auditLoading ? (
                <div className="text-center py-8">
                  <Clock className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p>Loading compliance audit trail...</p>
                </div>
              ) : Array.isArray(complianceAudit) && complianceAudit.length > 0 ? (
                complianceAudit.map((audit: any, index: number) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg capitalize">{audit.auditType} Audit</CardTitle>
                        {getStatusBadge(audit.complianceStatus)}
                      </div>
                      <CardDescription>
                        Created: {new Date(audit.auditDate).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {audit.findings && (
                        <div>
                          <strong>Findings:</strong>
                          <p className="mt-1">{audit.findings}</p>
                        </div>
                      )}
                      {audit.recommendations && (
                        <div>
                          <strong>Recommendations:</strong>
                          <p className="mt-1">{audit.recommendations}</p>
                        </div>
                      )}
                      {audit.legislationReferences && audit.legislationReferences.length > 0 && (
                        <div>
                          <strong>Legislation References:</strong>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {audit.legislationReferences.map((ref: string, refIndex: number) => (
                              <Badge key={refIndex} variant="outline" className="text-xs">
                                {ref}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <Scale className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No compliance audits found for this ticket.</p>
                    <p className="text-sm text-muted-foreground mt-1">Create an audit to track compliance status.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Legislation Tab */}
          <TabsContent value="legislation" className="space-y-6">
            <h3 className="text-lg font-semibold">RTW Legislation Reference</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* WIRC Act Sections */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5" />
                    WIRC Act Sections
                  </CardTitle>
                  <CardDescription>
                    Workplace Injury Rehabilitation and Compensation Act 2013
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Array.isArray(legislation) ? legislation
                    .filter((item: any) => item.source === "WIRC")
                    .map((section: any, index: number) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">{section.sectionId}</Badge>
                          <a 
                            href={section.sourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            View Full Text
                          </a>
                        </div>
                        <h4 className="font-medium">{section.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{section.summary}</p>
                      </div>
                    )) : null}
                </CardContent>
              </Card>

              {/* Claims Manual Sections */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Claims Manual Sections
                  </CardTitle>
                  <CardDescription>
                    WorkSafe Victoria Claims Manual - RTW Obligations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Array.isArray(legislation) ? legislation
                    .filter((item: any) => item.source === "CLAIMS_MANUAL")
                    .map((section: any, index: number) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary">{section.sectionId}</Badge>
                          <a 
                            href={section.sourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            View Full Text
                          </a>
                        </div>
                        <h4 className="font-medium">{section.title}</h4>
                      </div>
                    )) : null}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}