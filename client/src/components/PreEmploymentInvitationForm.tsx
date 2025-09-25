import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Mail, User, Send, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// JotForm links for each health check type
const JOTFORM_LINKS = {
  pre_employment: "https://form.jotform.com/250927279768475",
  injury: "https://form.jotform.com/240273367274054", 
  prevention: "https://form.jotform.com/240266476492059",
  general_health_wellbeing: "https://form.jotform.com/240032989875064",
  mental_health: "https://form.jotform.com/251677479546070",
  exit: "https://form.jotform.com/240032827738053",
} as const;

const invitationSchema = z.object({
  workerName: z.string().min(2, "Worker name must be at least 2 characters"),
  workerEmail: z.string().email("Please enter a valid email address"),
  customMessage: z.string().min(10, "Message must be at least 10 characters"),
});

type InvitationFormData = z.infer<typeof invitationSchema>;

interface PreEmploymentInvitationFormProps {
  onClose: () => void;
  checkType?: string;
}

export default function PreEmploymentInvitationForm({ 
  onClose,
  checkType = "pre_employment"
}: PreEmploymentInvitationFormProps) {
  const { toast } = useToast();
  const [isPreview, setIsPreview] = useState(false);

  // Health check type configurations
  const checkTypeConfig = {
    pre_employment: {
      title: "Pre-Employment Check Invitation",
      description: "Send a secure pre-employment health check invitation to a worker",
      template: `Dear [Worker Name],

Please complete your pre-employment health check by clicking the link below:

${JOTFORM_LINKS.pre_employment}

This health assessment is being conducted by GPNet as part of our pre-employment checks.

If you have any questions, please don't hesitate to contact us.

Regards,
[Manager Name]`
    },
    injury: {
      title: "Workplace Injury Assessment Invitation",
      description: "Send an invitation for workplace injury assessment and management",
      template: `Dear [Worker Name],

Please complete your workplace injury assessment by clicking the link below:

${JOTFORM_LINKS.injury}

This assessment will help us provide appropriate support for your injury management and recovery.

If you have any questions, please don't hesitate to contact us.

Regards,
[Manager Name]`
    },
    prevention: {
      title: "Prevention Health Check Invitation",
      description: "Send an invitation for preventive health screening and risk assessment",
      template: `Dear [Worker Name],

Please complete your preventive health screening by clicking the link below:

${JOTFORM_LINKS.prevention}

This assessment will help us identify and manage potential health risks proactively.

If you have any questions, please don't hesitate to contact us.

Regards,
[Manager Name]`
    },
    general_health_wellbeing: {
      title: "General Health and Well-being Check Invitation",
      description: "Send an invitation for comprehensive health and wellness evaluation",
      template: `Dear [Worker Name],

Please complete your health and wellness evaluation by clicking the link below:

${JOTFORM_LINKS.general_health_wellbeing}

This comprehensive assessment will help us understand your overall health and wellbeing.

If you have any questions, please don't hesitate to contact us.

Regards,
[Manager Name]`
    },
    mental_health: {
      title: "Mental Health Assessment Invitation",
      description: "Send an invitation for mental health assessment and support",
      template: `Dear [Worker Name],

Please complete your mental health assessment by clicking the link below:

${JOTFORM_LINKS.mental_health}

This confidential assessment will help us provide appropriate mental health support and resources.

If you have any questions, please don't hesitate to contact us.

Regards,
[Manager Name]`
    },
    exit: {
      title: "Exit Medical Examination Invitation",
      description: "Send an invitation for exit medical examination",
      template: `Dear [Worker Name],

Please complete your exit medical examination by clicking the link below:

${JOTFORM_LINKS.exit}

This examination is part of your departure process to ensure proper documentation.

If you have any questions, please don't hesitate to contact us.

Regards,
[Manager Name]`
    }
  };

  const currentConfig = checkTypeConfig[checkType as keyof typeof checkTypeConfig] || checkTypeConfig.pre_employment;

  const form = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      workerName: "",
      workerEmail: "",
      customMessage: currentConfig.template,
    },
  });

  // Send invitation mutation
  const sendInvitationMutation = useMutation({
    mutationFn: async (data: InvitationFormData) => {
      const payload = {
        workerName: data.workerName,
        workerEmail: data.workerEmail,
        customMessage: data.customMessage,
      };
      
      const response = await apiRequest("POST", "/api/pre-employment/invitations", payload);
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Invitation Sent Successfully",
        description: `Pre-employment check invitation sent to ${form.getValues('workerEmail')}`,
      });
      // Invalidate relevant queries to refresh the dashboard
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Invitation",
        description: error.message || "An error occurred while sending the invitation",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InvitationFormData) => {
    sendInvitationMutation.mutate(data);
  };

  const previewMessage = form.watch('customMessage')
    .replace(/\[Worker Name\]/g, form.watch('workerName') || '[Worker Name]')
    .replace(/\[Manager Name\]/g, 'Manager Name'); // Server will fill actual manager name

  // Handle escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      console.log('Modal: Escape key pressed, closing modal');
      onClose();
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      console.log('Modal: Backdrop clicked, closing modal');
      onClose();
    }
  };

  // Handle close button click
  const handleCloseClick = () => {
    console.log('Modal: Close button clicked, closing modal');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      data-testid="modal-backdrop"
    >
      <div 
        className="bg-background max-w-2xl w-full mx-4 rounded-lg shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <Card className="border-0 shadow-none">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2" data-testid="text-invitation-title">
                      <Mail className="h-5 w-5 text-blue-600" />
                      {currentConfig.title}
                    </CardTitle>
                    <CardDescription>
                      {currentConfig.description}
                    </CardDescription>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleCloseClick}
                    data-testid="button-close-invitation"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Worker Details Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <Label className="text-base font-medium">Worker Details</Label>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                    <FormField
                      control={form.control}
                      name="workerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Worker Name</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="e.g., John Smith"
                              data-testid="input-worker-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="workerEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Worker Email</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email"
                              placeholder="e.g., john.smith@test.com"
                              data-testid="input-worker-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Message Builder Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <Label className="text-base font-medium">Invitation Message</Label>
                  </div>
                  
                  <div className="pl-6 space-y-4">
                    {/* JotForm Link Section */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Direct Form Link</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                        Workers will complete the health check using this JotForm:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-white dark:bg-gray-800 border rounded text-xs font-mono break-all">
                          {JOTFORM_LINKS[checkType as keyof typeof JOTFORM_LINKS] || JOTFORM_LINKS.pre_employment}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(JOTFORM_LINKS[checkType as keyof typeof JOTFORM_LINKS] || JOTFORM_LINKS.pre_employment, '_blank')}
                          data-testid="button-open-form"
                        >
                          Open Form
                        </Button>
                      </div>
                    </div>

                    {!isPreview ? (
                      <FormField
                        control={form.control}
                        name="customMessage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Message Template</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field}
                                rows={6}
                                placeholder="Enter your invitation message..."
                                className="font-mono text-sm"
                                data-testid="textarea-message-template"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="space-y-2">
                        <Label>Message Preview</Label>
                        <div 
                          className="border rounded-md p-4 bg-muted/50 whitespace-pre-wrap font-mono text-sm"
                          data-testid="text-message-preview"
                        >
                          {previewMessage}
                        </div>
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPreview(!isPreview)}
                      data-testid="button-toggle-preview"
                    >
                      {isPreview ? "Edit Message" : "Preview Message"}
                    </Button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose}
                    data-testid="button-cancel-invitation"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={sendInvitationMutation.isPending}
                    data-testid="button-send-invitation"
                  >
                    {sendInvitationMutation.isPending ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </div>
  );
}