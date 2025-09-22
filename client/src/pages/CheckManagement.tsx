import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Plus, Edit, Trash2, Building2, FileText, UserCheck, Settings, Clock, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

// Types
interface HealthCheck {
  id: string;
  checkKey: string;
  checkName: string;
  description: string;
  jotformId: string;
  urgencyLevel: 'low' | 'normal' | 'high' | 'urgent';
  estimatedCompletionDays: number;
  isActive: boolean;
  requiredDocuments: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

interface CompanyAlias {
  id: string;
  companyId: string;
  aliasName: string;
  matchStrength: number;
  isActive: boolean;
  createdAt: string;
  createdBy?: string;
}

// Form schemas
const checkFormSchema = z.object({
  checkKey: z.string().min(1, 'Check key is required'),
  checkName: z.string().min(1, 'Check name is required'),
  description: z.string().min(1, 'Description is required'),
  jotformId: z.string().min(1, 'JotForm ID is required'),
  urgencyLevel: z.enum(['low', 'normal', 'high', 'urgent']),
  estimatedCompletionDays: z.number().min(1).max(365),
  isActive: z.boolean(),
  requiredDocuments: z.array(z.string())
});

const aliasFormSchema = z.object({
  aliasName: z.string().min(1, 'Alias name is required'),
  matchStrength: z.number().min(0).max(100),
  isActive: z.boolean()
});

type CheckFormData = z.infer<typeof checkFormSchema>;
type AliasFormData = z.infer<typeof aliasFormSchema>;

export default function CheckManagement() {
  const { toast } = useToast();
  const [isCheckDialogOpen, setIsCheckDialogOpen] = useState(false);
  const [isAliasDialogOpen, setIsAliasDialogOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<HealthCheck | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string>('');

  // Fetch health checks
  const { 
    data: checks = [], 
    isLoading: checksLoading 
  } = useQuery<HealthCheck[]>({
    queryKey: ['/api/check-management/checks'],
    enabled: true
  });

  // Fetch company aliases
  const { 
    data: aliases = [], 
    isLoading: aliasesLoading 
  } = useQuery<CompanyAlias[]>({
    queryKey: ['/api/check-management/companies', selectedCompany, 'aliases'],
    enabled: !!selectedCompany
  });

  // Check form
  const checkForm = useForm<CheckFormData>({
    resolver: zodResolver(checkFormSchema),
    defaultValues: {
      checkKey: '',
      checkName: '',
      description: '',
      jotformId: '',
      urgencyLevel: 'normal',
      estimatedCompletionDays: 5,
      isActive: true,
      requiredDocuments: []
    }
  });

  // Alias form
  const aliasForm = useForm<AliasFormData>({
    resolver: zodResolver(aliasFormSchema),
    defaultValues: {
      aliasName: '',
      matchStrength: 90,
      isActive: true
    }
  });

  // Create/Update check mutation
  const checkMutation = useMutation({
    mutationFn: async (data: CheckFormData) => {
      if (editingCheck) {
        return apiRequest(`/api/check-management/checks/${editingCheck.id}`, 'PUT', data);
      } else {
        return apiRequest('/api/check-management/checks', 'POST', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/check-management/checks'] });
      setIsCheckDialogOpen(false);
      setEditingCheck(null);
      checkForm.reset();
      toast({
        title: editingCheck ? 'Check Updated' : 'Check Created',
        description: `Health check has been ${editingCheck ? 'updated' : 'created'} successfully.`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save check',
        variant: 'destructive'
      });
    }
  });

  // Delete check mutation
  const deleteCheckMutation = useMutation({
    mutationFn: async (checkId: string) => {
      return apiRequest(`/api/check-management/checks/${checkId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/check-management/checks'] });
      toast({
        title: 'Check Deleted',
        description: 'Health check has been deleted successfully.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete check',
        variant: 'destructive'
      });
    }
  });

  // Create alias mutation
  const aliasMutation = useMutation({
    mutationFn: async (data: AliasFormData) => {
      return apiRequest(`/api/check-management/companies/${selectedCompany}/aliases`, 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/check-management/companies', selectedCompany, 'aliases'] 
      });
      setIsAliasDialogOpen(false);
      aliasForm.reset();
      toast({
        title: 'Alias Created',
        description: 'Company alias has been created successfully.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create alias',
        variant: 'destructive'
      });
    }
  });

  const handleEditCheck = (check: HealthCheck) => {
    setEditingCheck(check);
    checkForm.reset({
      checkKey: check.checkKey,
      checkName: check.checkName,
      description: check.description,
      jotformId: check.jotformId,
      urgencyLevel: check.urgencyLevel,
      estimatedCompletionDays: check.estimatedCompletionDays,
      isActive: check.isActive,
      requiredDocuments: check.requiredDocuments || []
    });
    setIsCheckDialogOpen(true);
  };

  const handleDeleteCheck = (checkId: string) => {
    if (confirm('Are you sure you want to delete this health check?')) {
      deleteCheckMutation.mutate(checkId);
    }
  };

  const activeChecks = checks.filter(check => check.isActive);
  const inactiveChecks = checks.filter(check => !check.isActive);

  return (
    <div className="space-y-6 p-6" data-testid="page-check-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Check Management</h1>
          <p className="text-muted-foreground">
            Manage health check types and company aliases for the GPNet system
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCheckDialogOpen} onOpenChange={setIsCheckDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-check">
                <Plus className="w-4 h-4 mr-2" />
                Create Check
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCheck ? 'Edit Health Check' : 'Create New Health Check'}
                </DialogTitle>
              </DialogHeader>
              <Form {...checkForm}>
                <form 
                  onSubmit={checkForm.handleSubmit((data) => checkMutation.mutate(data))}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={checkForm.control}
                      name="checkKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Check Key</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., pre_employment_standard" 
                              {...field}
                              data-testid="input-check-key"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={checkForm.control}
                      name="checkName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Check Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., Standard Pre-Employment Check" 
                              {...field}
                              data-testid="input-check-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={checkForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe this health check..." 
                            {...field}
                            data-testid="textarea-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={checkForm.control}
                      name="jotformId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>JotForm ID</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., 242234567890123" 
                              {...field}
                              data-testid="input-jotform-id"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={checkForm.control}
                      name="urgencyLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Urgency Level</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-urgency">
                                <SelectValue placeholder="Select urgency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={checkForm.control}
                      name="estimatedCompletionDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Est. Completion (Days)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              max="365"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              data-testid="input-completion-days"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={checkForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Active Check
                          </FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Enable this check for manager requests
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-is-active"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsCheckDialogOpen(false);
                        setEditingCheck(null);
                        checkForm.reset();
                      }}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={checkMutation.isPending}
                      data-testid="button-save-check"
                    >
                      {checkMutation.isPending ? 'Saving...' : editingCheck ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="checks" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="checks" data-testid="tab-checks">
            <UserCheck className="w-4 h-4 mr-2" />
            Health Checks
          </TabsTrigger>
          <TabsTrigger value="companies" data-testid="tab-companies">
            <Building2 className="w-4 h-4 mr-2" />
            Company Aliases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checks" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Active Health Checks
                    </CardTitle>
                    <CardDescription>
                      Currently available for manager-initiated requests
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{activeChecks.length} active</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {checksLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">Loading checks...</div>
                  </div>
                ) : activeChecks.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">No active health checks found</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {activeChecks.map((check) => (
                      <Card key={check.id} className="border-l-4 border-l-green-500">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{check.checkName}</h3>
                                <Badge variant="secondary">{check.checkKey}</Badge>
                                <Badge 
                                  variant={
                                    check.urgencyLevel === 'urgent' ? 'destructive' :
                                    check.urgencyLevel === 'high' ? 'secondary' : 'outline'
                                  }
                                >
                                  {check.urgencyLevel}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{check.description}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {check.estimatedCompletionDays} days
                                </span>
                                <span>JotForm: {check.jotformId}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditCheck(check)}
                                data-testid={`button-edit-${check.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteCheck(check.id)}
                                data-testid={`button-delete-${check.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {inactiveChecks.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-muted-foreground" />
                        Inactive Health Checks
                      </CardTitle>
                      <CardDescription>
                        Disabled checks not available for requests
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{inactiveChecks.length} inactive</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {inactiveChecks.map((check) => (
                      <Card key={check.id} className="border-l-4 border-l-muted opacity-60">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{check.checkName}</h3>
                                <Badge variant="secondary">{check.checkKey}</Badge>
                                <Badge variant="outline">inactive</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{check.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditCheck(check)}
                                data-testid={`button-edit-inactive-${check.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteCheck(check.id)}
                                data-testid={`button-delete-inactive-${check.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Aliases</CardTitle>
              <CardDescription>
                Manage alternative company names for better matching
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="company-select">Select Company</Label>
                  <Input
                    id="company-select"
                    placeholder="Enter company ID or name..."
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    data-testid="input-company-select"
                  />
                </div>
                <div className="flex items-end">
                  <Dialog open={isAliasDialogOpen} onOpenChange={setIsAliasDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        disabled={!selectedCompany}
                        data-testid="button-create-alias"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Alias
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Company Alias</DialogTitle>
                      </DialogHeader>
                      <Form {...aliasForm}>
                        <form 
                          onSubmit={aliasForm.handleSubmit((data) => aliasMutation.mutate(data))}
                          className="space-y-4"
                        >
                          <FormField
                            control={aliasForm.control}
                            name="aliasName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Alias Name</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="Alternative company name" 
                                    {...field}
                                    data-testid="input-alias-name"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={aliasForm.control}
                            name="matchStrength"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Match Strength (%)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="0" 
                                    max="100"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    data-testid="input-match-strength"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={aliasForm.control}
                            name="isActive"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Active Alias</FormLabel>
                                  <div className="text-sm text-muted-foreground">
                                    Use this alias for company matching
                                  </div>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-alias-active"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <div className="flex justify-end gap-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => {
                                setIsAliasDialogOpen(false);
                                aliasForm.reset();
                              }}
                              data-testid="button-cancel-alias"
                            >
                              Cancel
                            </Button>
                            <Button 
                              type="submit" 
                              disabled={aliasMutation.isPending}
                              data-testid="button-save-alias"
                            >
                              {aliasMutation.isPending ? 'Creating...' : 'Create'}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {selectedCompany && (
                <div className="space-y-4">
                  {aliasesLoading ? (
                    <div className="text-center py-4">
                      <div className="text-sm text-muted-foreground">Loading aliases...</div>
                    </div>
                  ) : aliases.length === 0 ? (
                    <div className="text-center py-8">
                      <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">No aliases found for this company</p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {aliases.map((alias) => (
                        <Card key={alias.id}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{alias.aliasName}</span>
                                <Badge variant="outline">{alias.matchStrength}% match</Badge>
                                {alias.isActive ? (
                                  <Badge variant="default">Active</Badge>
                                ) : (
                                  <Badge variant="secondary">Inactive</Badge>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-delete-alias-${alias.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}