import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Users, Clock, CheckCircle, User, Phone, Mail, Calendar } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function NatalieDashboard() {
  const [selectedEscalation, setSelectedEscalation] = useState<any>(null);
  const [assignmentReason, setAssignmentReason] = useState("");
  const [selectedSpecialist, setSelectedSpecialist] = useState("");
  const { toast } = useToast();

  // Fetch escalations data
  const { data: escalations, isLoading: escalationsLoading } = useQuery({
    queryKey: ["/api/escalations"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch specialists
  const { data: specialists } = useQuery({
    queryKey: ["/api/specialists"],
  });

  // Fetch dashboard data
  const { data: dashboardData } = useQuery({
    queryKey: ["/api/escalations/dashboard"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Assign escalation mutation
  const assignEscalationMutation = useMutation({
    mutationFn: async (data: {
      escalationId: string;
      specialistId: string;
      assignmentReason: string;
      assignmentType: string;
    }) => {
      return apiRequest(
        "POST",
        `/api/escalations/${data.escalationId}/assign`,
        {
          specialistId: data.specialistId,
          assignmentReason: data.assignmentReason,
          assignmentType: data.assignmentType,
        }
      );
    },
    onSuccess: () => {
      toast({
        title: "Assignment successful",
        description: "Escalation has been assigned to specialist",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/escalations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/escalations/dashboard"] });
      setSelectedEscalation(null);
      setAssignmentReason("");
      setSelectedSpecialist("");
    },
    onError: (error) => {
      toast({
        title: "Assignment failed",
        description: "Failed to assign escalation to specialist",
        variant: "destructive",
      });
    },
  });

  // Update escalation status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (data: { escalationId: string; status: string; notes?: string }) => {
      return apiRequest(
        "PATCH",
        `/api/escalations/${data.escalationId}/status`,
        {
          status: data.status,
          resolutionNotes: data.notes,
        }
      );
    },
    onSuccess: () => {
      toast({
        title: "Status updated",
        description: "Escalation status has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/escalations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/escalations/dashboard"] });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500";
      case "assigned": return "bg-blue-500";
      case "in_progress": return "bg-purple-500";
      case "resolved": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const handleAssignEscalation = () => {
    if (!selectedEscalation || !selectedSpecialist || !assignmentReason.trim()) {
      toast({
        title: "Missing information",
        description: "Please select a specialist and provide assignment reason",
        variant: "destructive",
      });
      return;
    }

    assignEscalationMutation.mutate({
      escalationId: selectedEscalation.id,
      specialistId: selectedSpecialist,
      assignmentReason,
      assignmentType: "manual",
    });
  };

  if (escalationsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading escalations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Natalie Coordinator Dashboard</h1>
          <p className="text-muted-foreground">
            Manage escalations and coordinate specialist assignments
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {Array.isArray(escalations) ? escalations.filter((e: any) => e.status === "pending").length : 0} Pending
        </Badge>
      </div>

      {/* Dashboard Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Escalations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dashboardData as any)?.statusCounts?.pending || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((dashboardData as any)?.statusCounts?.assigned || 0) + ((dashboardData as any)?.statusCounts?.in_progress || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dashboardData as any)?.statusCounts?.resolved || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Specialists</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(specialists) ? specialists.filter((s: any) => s.isActive).length : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="escalations" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="escalations" data-testid="tab-escalations">Active Escalations</TabsTrigger>
          <TabsTrigger value="specialists" data-testid="tab-specialists">Specialists</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="escalations" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Escalations List */}
            <Card>
              <CardHeader>
                <CardTitle>Escalation Queue</CardTitle>
                <CardDescription>
                  Cases requiring specialist attention
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!Array.isArray(escalations) || escalations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No escalations found
                  </div>
                ) : (
                  escalations.map((escalation: any) => (
                    <div
                      key={escalation.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedEscalation?.id === escalation.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedEscalation(escalation)}
                      data-testid={`escalation-${escalation.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getPriorityColor(escalation.priority)} text-white`}>
                            {escalation.priority}
                          </Badge>
                          <Badge className={`${getStatusColor(escalation.status)} text-white`}>
                            {escalation.status}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(escalation.createdAt), "MMM dd, HH:mm")}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium">{escalation.triggerType}</div>
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {escalation.triggerReason}
                        </div>
                        {escalation.assignedSpecialist && (
                          <div className="flex items-center gap-1 text-sm text-blue-600">
                            <User className="h-3 w-3" />
                            Assigned to {escalation.assignedSpecialist.name}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Assignment Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Assignment Actions</CardTitle>
                <CardDescription>
                  Assign escalations to specialists
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedEscalation ? (
                  <>
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Selected: {selectedEscalation.triggerType} escalation
                        (Priority: {selectedEscalation.priority})
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Assign to Specialist
                        </label>
                        <Select value={selectedSpecialist} onValueChange={setSelectedSpecialist}>
                          <SelectTrigger data-testid="select-specialist">
                            <SelectValue placeholder="Select specialist..." />
                          </SelectTrigger>
                          <SelectContent>
                            {specialists?.map((specialist: any) => (
                              <SelectItem key={specialist.id} value={specialist.id}>
                                <div className="flex items-center gap-2">
                                  <span>{specialist.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {specialist.role}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    ({specialist.currentCaseload}/{specialist.maxCaseload})
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Assignment Reason
                        </label>
                        <Textarea
                          value={assignmentReason}
                          onChange={(e) => setAssignmentReason(e.target.value)}
                          placeholder="Explain why this specialist is best suited for this case..."
                          className="min-h-20"
                          data-testid="textarea-assignment-reason"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleAssignEscalation}
                          disabled={assignEscalationMutation.isPending}
                          className="flex-1"
                          data-testid="button-assign-escalation"
                        >
                          {assignEscalationMutation.isPending ? "Assigning..." : "Assign Case"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedEscalation(null);
                            setAssignmentReason("");
                            setSelectedSpecialist("");
                          }}
                          data-testid="button-clear-selection"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    {/* Quick Status Updates */}
                    <div className="border-t pt-4">
                      <label className="text-sm font-medium mb-2 block">
                        Quick Status Update
                      </label>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              escalationId: selectedEscalation.id,
                              status: "in_progress",
                            })
                          }
                          data-testid="button-start-progress"
                        >
                          Start Progress
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              escalationId: selectedEscalation.id,
                              status: "resolved",
                              notes: "Manually resolved by coordinator",
                            })
                          }
                          data-testid="button-mark-resolved"
                        >
                          Mark Resolved
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Select an escalation to assign to a specialist
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="specialists" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.isArray(specialists) ? specialists.map((specialist: any) => (
              <Card key={specialist.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{specialist.name}</CardTitle>
                    <Badge variant={specialist.isActive ? "default" : "secondary"}>
                      {specialist.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription>{specialist.role}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4" />
                      {specialist.email}
                    </div>
                    {specialist.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4" />
                        {specialist.phone}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Caseload</span>
                    <Badge variant="outline">
                      {specialist.currentCaseload}/{specialist.maxCaseload}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Response Time</span>
                    <span className="text-sm font-medium">
                      {specialist.averageResponseTime}m avg
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Resolution Rate</span>
                    <span className="text-sm font-medium">
                      {specialist.caseResolutionRate}%
                    </span>
                  </div>

                  {specialist.lastSeenAt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Last seen {format(new Date(specialist.lastSeenAt), "MMM dd, HH:mm")}
                    </div>
                  )}
                </CardContent>
              </Card>
            )) : null}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Escalation Trends</CardTitle>
                <CardDescription>Overview of escalation activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Total Escalations</span>
                    <span className="font-medium">
                      {Object.values((dashboardData as any)?.statusCounts || {}).reduce((a: any, b: any) => a + b, 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Average Response Time</span>
                    <span className="font-medium">32 minutes</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Resolution Rate</span>
                    <span className="font-medium">94%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Specialist Performance</CardTitle>
                <CardDescription>Team performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.isArray((dashboardData as any)?.specialistWorkload) ? (dashboardData as any).specialistWorkload.map((item: any) => (
                    <div key={item.specialist.id} className="flex items-center justify-between">
                      <span className="text-sm">{item.specialist.name}</span>
                      <Badge variant="outline">
                        {item.activeEscalations} active
                      </Badge>
                    </div>
                  )) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}