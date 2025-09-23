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

const invitationSchema = z.object({
  workerName: z.string().min(2, "Worker name must be at least 2 characters"),
  workerEmail: z.string().email("Please enter a valid email address"),
  customMessage: z.string().min(10, "Message must be at least 10 characters"),
});

type InvitationFormData = z.infer<typeof invitationSchema>;

interface PreEmploymentInvitationFormProps {
  onClose: () => void;
  managerName?: string;
  organizationName?: string;
}

export default function PreEmploymentInvitationForm({ 
  onClose, 
  managerName = "Manager",
  organizationName = "Your Organization" 
}: PreEmploymentInvitationFormProps) {
  const { toast } = useToast();
  const [isPreview, setIsPreview] = useState(false);

  // Default email template from the specification
  const defaultTemplate = `Dear [Worker Name],

Please find attached a pre-employment check from GPNet, who are looking after our pre-employment checks.

Regards,
${managerName}`;

  const form = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      workerName: "",
      workerEmail: "",
      customMessage: defaultTemplate,
    },
  });

  // Send invitation mutation
  const sendInvitationMutation = useMutation({
    mutationFn: async (data: InvitationFormData) => {
      const payload = {
        workerName: data.workerName,
        workerEmail: data.workerEmail,
        customMessage: data.customMessage.replace('[Worker Name]', data.workerName),
        managerName,
        organizationName,
      };
      
      const response = await apiRequest("POST", "/api/pre-employment/invitations", payload);
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Invitation Sent Successfully",
        description: `Pre-employment check invitation sent to ${form.getValues('workerEmail')}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
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

  const previewMessage = form.watch('customMessage').replace('[Worker Name]', form.watch('workerName') || '[Worker Name]');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background max-w-2xl w-full mx-4 rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <Card className="border-0 shadow-none">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2" data-testid="text-invitation-title">
                      <Mail className="h-5 w-5 text-blue-600" />
                      Pre-Employment Check Invitation
                    </CardTitle>
                    <CardDescription>
                      Send a secure pre-employment health check invitation to a worker
                    </CardDescription>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={onClose}
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