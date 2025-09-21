import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, X, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

const emailForwardingSchema = z.object({
  messageId: z.string().min(1, "Message ID is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Email body is required"),
  htmlBody: z.string().optional(),
  originalSender: z.string().email("Valid sender email required"),
  originalSenderName: z.string().optional(),
  forwardedAt: z.string().optional(),
  organizationId: z.string().min(1, "Organization ID is required"),
  forwardedBy: z.string().email("Valid manager email required")
});

type EmailForwardingData = z.infer<typeof emailForwardingSchema>;

interface Attachment {
  filename: string;
  contentType: string;
  size: number;
  content: string; // base64
}

interface EmailForwardingFormProps {
  organizationId: string;
  managerEmail: string;
  onSuccess?: () => void;
}

export default function EmailForwardingForm({ 
  organizationId, 
  managerEmail, 
  onSuccess 
}: EmailForwardingFormProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const form = useForm<EmailForwardingData>({
    resolver: zodResolver(emailForwardingSchema),
    defaultValues: {
      organizationId,
      forwardedBy: managerEmail,
      forwardedAt: new Date().toISOString(),
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  });

  const forwardEmailMutation = useMutation({
    mutationFn: async (data: { email: EmailForwardingData; attachments: Attachment[] }) => {
      return await apiRequest('POST', '/api/external-emails/forward', data);
    },
    onSuccess: () => {
      toast({
        title: "Email Forwarded Successfully",
        description: "The email has been processed and added to the case management system.",
      });
      
      // Reset form
      form.reset();
      setAttachments([]);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/external-emails', organizationId, managerEmail] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', 'recent', organizationId] });
      
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error Forwarding Email",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleFileUpload = async (files: FileList) => {
    setIsProcessing(true);
    
    try {
      const newAttachments: Attachment[] = [];
      
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          throw new Error(`File ${file.name} is too large. Maximum size is 10MB.`);
        }
        
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data URL prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        newAttachments.push({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          content: base64
        });
      }
      
      setAttachments(prev => [...prev, ...newAttachments]);
      
      toast({
        title: "Files Uploaded",
        description: `${newAttachments.length} file(s) added successfully.`,
      });
    } catch (error) {
      toast({
        title: "Upload Error",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = (data: EmailForwardingData) => {
    forwardEmailMutation.mutate({ 
      email: data, 
      attachments 
    });
  };

  return (
    <Card className="w-full max-w-4xl mx-auto" data-testid="card-email-forwarding">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Forward Email to Case System
        </CardTitle>
        <CardDescription>
          Forward an email from a manager or external source to create or update a worker case. 
          The system will automatically analyze the content and provide AI recommendations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="originalSender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Original Sender Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="worker@company.com" 
                        {...field} 
                        data-testid="input-original-sender"
                      />
                    </FormControl>
                    <FormDescription>
                      The email address of the person who originally sent this email
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="originalSenderName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sender Name (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="John Smith" 
                        {...field} 
                        data-testid="input-sender-name"
                      />
                    </FormControl>
                    <FormDescription>
                      The name of the original sender
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Email Content */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Subject</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Re: Return to work query - John Smith" 
                      {...field} 
                      data-testid="input-subject"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Body</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Paste the email content here..." 
                      className="min-h-[200px]"
                      {...field} 
                      data-testid="textarea-body"
                    />
                  </FormControl>
                  <FormDescription>
                    Copy and paste the email content. The system will automatically analyze it for case matching and AI recommendations.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="htmlBody"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>HTML Body (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="HTML version of the email (if available)" 
                      className="min-h-[100px]"
                      {...field} 
                      data-testid="textarea-html-body"
                    />
                  </FormControl>
                  <FormDescription>
                    If the email includes HTML formatting, paste it here for better analysis
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File Attachments */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Attachments</label>
                <div className="mt-2">
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    data-testid="dropzone-attachments"
                  >
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      Click to upload files or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">
                      PDF, DOC, DOCX, JPG, PNG up to 10MB each
                    </p>
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    data-testid="input-file-upload"
                  />
                </div>
              </div>

              {/* Attachment List */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Uploaded Files ({attachments.length})</label>
                  {attachments.map((attachment, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      data-testid={`attachment-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium">{attachment.filename}</p>
                          <p className="text-xs text-gray-500">
                            {attachment.contentType} • {(attachment.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                        data-testid={`button-remove-attachment-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hidden fields */}
            <input type="hidden" {...form.register('organizationId')} />
            <input type="hidden" {...form.register('forwardedBy')} />
            <input type="hidden" {...form.register('messageId')} />
            <input type="hidden" {...form.register('forwardedAt')} />

            {/* Status Messages */}
            {forwardEmailMutation.isPending && (
              <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">Processing email and analyzing content...</span>
              </div>
            )}

            {forwardEmailMutation.isSuccess && (
              <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">Email processed successfully!</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  setAttachments([]);
                }}
                disabled={forwardEmailMutation.isPending || isProcessing}
                data-testid="button-clear-form"
              >
                Clear Form
              </Button>
              <Button
                type="submit"
                disabled={forwardEmailMutation.isPending || isProcessing}
                data-testid="button-forward-email"
              >
                {forwardEmailMutation.isPending ? 'Processing...' : 'Forward Email'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}