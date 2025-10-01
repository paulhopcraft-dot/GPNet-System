import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  User, Briefcase, Calendar, Activity, FileText, 
  Mail, MessageSquare, CheckSquare, AlertTriangle,
  Clock, MapPin, Phone
} from 'lucide-react';

interface CaseDrawerProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CaseData {
  caseId: string;
  worker: {
    name: string;
    dob: string;
    phone: string;
    email: string;
  } | null;
  employer: { name: string; site?: string };
  role: string;
  status: {
    work: string;
    risk: string;
    certificate: { from: string | null; to: string | null };
  };
  diagnosis: string;
  dateOfInjury: string;
  restrictions: {
    physical: string[];
    functional: string[];
    mentalHealth: string[];
  };
  treatmentPlan: Array<{
    type: string;
    name: string;
    frequency: string;
    nextAppt: string;
    contact?: string;
    notes?: string;
  }>;
  timeline: Array<{
    timestamp: string;
    source: string;
    summary: string;
    details: any;
  }>;
  nextSteps: Array<{
    id: string;
    action: string;
    priority: string;
    done: boolean;
  }>;
  predictions: {
    claimProgressionProb: number;
    healingEtaDays: number;
  };
  emails?: Array<{
    id: string;
    subject: string;
    sentAt: string;
    from: string;
    to: string;
    body: string;
  }>;
  emailsCount: number;
  reportsCount: number;
}

export function CaseDrawer({ ticketId, open, onOpenChange }: CaseDrawerProps) {
  const [activeTab, setActiveTab] = useState('summary');
  
  const { data: caseData, isLoading } = useQuery<CaseData>({
    queryKey: ['/api/case-drawer', ticketId],
    enabled: !!ticketId && open,
  });

  const toggleStepMutation = useMutation({
    mutationFn: async ({ stepId, done }: { stepId: string; done: boolean }) => {
      const response = await fetch(`/api/case-drawer/${ticketId}/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done })
      });
      if (!response.ok) throw new Error('Failed to update step');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/case-drawer', ticketId] });
    }
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'red': return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'amber': return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
      default: return 'bg-green-500/10 text-green-700 dark:text-green-400';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!ticketId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="text-xl">Case Details</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="text-muted-foreground">Loading case data...</div>
          </div>
        ) : caseData ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Worker Header */}
            <div className="px-6 py-4 bg-muted/30">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>{caseData.worker ? getInitials(caseData.worker.name) : '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate" data-testid="text-worker-name">
                    {caseData.worker?.name || 'Unknown Worker'}
                  </h3>
                  <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {caseData.role}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {caseData.employer.name}
                    </span>
                  </div>
                </div>
                <Badge className={getRiskColor(caseData.status.risk)} data-testid={`badge-risk-${caseData.status.risk}`}>
                  {caseData.status.risk.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="w-full justify-start rounded-none border-b px-6 h-auto flex-wrap gap-1 py-2" data-testid="tabs-case-drawer">
                <TabsTrigger value="summary" data-testid="tab-summary">
                  <Activity className="h-4 w-4 mr-1" />
                  Summary
                </TabsTrigger>
                <TabsTrigger value="restrictions" data-testid="tab-restrictions">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Restrictions
                </TabsTrigger>
                <TabsTrigger value="treatment" data-testid="tab-treatment">
                  <Calendar className="h-4 w-4 mr-1" />
                  Treatment
                </TabsTrigger>
                <TabsTrigger value="reports" data-testid="tab-reports">
                  <FileText className="h-4 w-4 mr-1" />
                  Reports ({caseData.reportsCount})
                </TabsTrigger>
                <TabsTrigger value="analysis" data-testid="tab-analysis">
                  <Activity className="h-4 w-4 mr-1" />
                  Analysis
                </TabsTrigger>
                <TabsTrigger value="emails" data-testid="tab-emails">
                  <Mail className="h-4 w-4 mr-1" />
                  Emails ({caseData.emailsCount})
                </TabsTrigger>
                <TabsTrigger value="michelle" data-testid="tab-michelle">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Michelle
                </TabsTrigger>
                <TabsTrigger value="actions" data-testid="tab-actions">
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Actions
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                <TabsContent value="summary" className="p-6 space-y-6 mt-0">
                  {/* Current Status Timeline */}
                  <div>
                    <h4 className="font-semibold mb-3">Current Status</h4>
                    <div className="space-y-3">
                      {caseData.timeline.slice(0, 5).map((event, idx) => (
                        <div key={idx} className="flex gap-3" data-testid={`timeline-event-${idx}`}>
                          <div className="flex flex-col items-center">
                            <div className={`rounded-full h-2 w-2 ${idx === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                            {idx < 4 && <div className="w-px h-8 bg-border" />}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="text-sm font-medium">{event.summary}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(event.timestamp).toLocaleDateString()} • {event.source}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Next Steps */}
                  <div>
                    <h4 className="font-semibold mb-3">Next Steps</h4>
                    <div className="space-y-2">
                      {caseData.nextSteps.map((step) => (
                        <div 
                          key={step.id} 
                          className="flex items-start gap-3 p-3 rounded-md bg-muted/30 hover-elevate"
                          data-testid={`next-step-${step.id}`}
                        >
                          <input
                            type="checkbox"
                            checked={step.done}
                            onChange={(e) => toggleStepMutation.mutate({ stepId: step.id, done: e.target.checked })}
                            className="mt-0.5"
                            data-testid={`checkbox-step-${step.id}`}
                          />
                          <div className="flex-1">
                            <p className={`text-sm ${step.done ? 'line-through text-muted-foreground' : ''}`}>
                              {step.action}
                            </p>
                            <Badge variant="outline" className="mt-1 text-xs">
                              {step.priority}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="restrictions" className="p-6 space-y-4 mt-0">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Physical Restrictions
                    </h4>
                    {caseData.restrictions.physical.length > 0 ? (
                      <ul className="space-y-2">
                        {caseData.restrictions.physical.map((r, i) => (
                          <li key={i} className="text-sm p-2 bg-muted/30 rounded" data-testid={`restriction-physical-${i}`}>{r}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No physical restrictions</p>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Functional Restrictions</h4>
                    {caseData.restrictions.functional.length > 0 ? (
                      <ul className="space-y-2">
                        {caseData.restrictions.functional.map((r, i) => (
                          <li key={i} className="text-sm p-2 bg-muted/30 rounded" data-testid={`restriction-functional-${i}`}>{r}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No functional restrictions</p>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Mental Health Considerations</h4>
                    {caseData.restrictions.mentalHealth.length > 0 ? (
                      <ul className="space-y-2">
                        {caseData.restrictions.mentalHealth.map((r, i) => (
                          <li key={i} className="text-sm p-2 bg-muted/30 rounded" data-testid={`restriction-mentalhealth-${i}`}>{r}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No mental health considerations</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="treatment" className="p-6 space-y-4 mt-0">
                  <h4 className="font-semibold">Active Treatment Plan</h4>
                  {caseData.treatmentPlan.length > 0 ? (
                    <div className="space-y-3">
                      {caseData.treatmentPlan.map((plan, i) => (
                        <div key={i} className="p-4 border rounded-md" data-testid={`treatment-plan-${i}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{plan.type}</p>
                              <p className="text-sm text-muted-foreground">{plan.name}</p>
                              {plan.contact && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {plan.contact}
                                </div>
                              )}
                            </div>
                            <Badge variant="outline">{plan.frequency}</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Next: {new Date(plan.nextAppt).toLocaleDateString()}
                          </div>
                          {plan.notes && (
                            <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">{plan.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active treatment plan</p>
                  )}
                </TabsContent>

                <TabsContent value="analysis" className="p-6 space-y-4 mt-0">
                  <div className="grid gap-4">
                    <div className="p-4 border rounded-md">
                      <h4 className="font-semibold mb-2">ML Predictions</h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Claim Progression Risk</p>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-amber-500" 
                                style={{ width: `${caseData.predictions.claimProgressionProb * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium" data-testid="text-claim-progression-prob">
                              {Math.round(caseData.predictions.claimProgressionProb * 100)}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Estimated Healing Time</p>
                          <p className="text-lg font-semibold mt-1" data-testid="text-healing-eta">
                            {caseData.predictions.healingEtaDays} days
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="reports" className="p-6 mt-0">
                  <p className="text-sm text-muted-foreground">No reports available</p>
                </TabsContent>

                <TabsContent value="emails" className="p-6 space-y-3 mt-0">
                  {caseData.emails && caseData.emails.length > 0 ? (
                    <>
                      <h4 className="font-semibold">Email Thread ({caseData.emails.length})</h4>
                      <div className="space-y-3">
                        {caseData.emails.map((email) => (
                          <div key={email.id} className="p-4 border rounded-md" data-testid={`email-${email.id}`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{email.subject}</p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <span className="truncate">From: {email.from}</span>
                                  <span>•</span>
                                  <span className="truncate">To: {email.to}</span>
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                {new Date(email.sentAt).toLocaleDateString()}
                              </span>
                            </div>
                            <Separator className="my-2" />
                            <p className="text-sm text-muted-foreground">{email.body}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No emails in thread</p>
                  )}
                </TabsContent>

                <TabsContent value="michelle" className="p-6 mt-0">
                  <p className="text-sm text-muted-foreground">Michelle chat interface coming soon</p>
                </TabsContent>

                <TabsContent value="actions" className="p-6 mt-0">
                  <p className="text-sm text-muted-foreground">Quick actions coming soon</p>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        ) : (
          <div className="flex items-center justify-center flex-1 text-muted-foreground">
            No case data available
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
