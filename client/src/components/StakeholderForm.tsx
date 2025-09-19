import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { insertStakeholderSchema } from "@shared/schema";
import type { Stakeholder } from "@shared/schema";

// Extended stakeholder form schema for UI validation
const stakeholderFormSchema = insertStakeholderSchema.extend({
  role: z.enum(["doctor", "insurer", "orc", "rehab_provider", "lawyer"], {
    required_error: "Please select a stakeholder role",
  }),
  name: z.string().min(1, "Name is required"),
  ticketId: z.string().min(1, "Ticket ID is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  organization: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type StakeholderFormData = z.infer<typeof stakeholderFormSchema>;

interface StakeholderFormProps {
  ticketId: string;
  initialData?: Stakeholder;
  onSubmit: (data: StakeholderFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
}

const roleOptions = [
  { value: "doctor", label: "Medical Doctor", description: "Healthcare provider or treating physician" },
  { value: "insurer", label: "Insurance Provider", description: "Workers compensation or health insurer" },
  { value: "orc", label: "ORC (Occupational Rehabilitation Coordinator)", description: "Return to work coordinator" },
  { value: "rehab_provider", label: "Rehabilitation Provider", description: "Physical therapy or rehabilitation services" },
  { value: "lawyer", label: "Legal Representative", description: "Legal counsel or advocate" },
];

export default function StakeholderForm({
  ticketId,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = "create"
}: StakeholderFormProps) {
  const form = useForm<StakeholderFormData>({
    resolver: zodResolver(stakeholderFormSchema),
    defaultValues: {
      ticketId,
      role: initialData?.role as any || undefined,
      name: initialData?.name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      organization: initialData?.organization || "",
      notes: initialData?.notes || "",
      isActive: initialData?.isActive ?? true,
    },
  });

  const handleSubmit = (data: StakeholderFormData) => {
    onSubmit(data);
  };

  const selectedRole = form.watch("role");
  const selectedRoleInfo = roleOptions.find(option => option.value === selectedRole);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {mode === "create" ? "Add New Stakeholder" : "Edit Stakeholder"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stakeholder Role */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stakeholder Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-stakeholder-role">
                        <SelectValue placeholder="Select stakeholder role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRoleInfo && (
                    <FormDescription>
                      {selectedRoleInfo.description}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter full name" 
                      {...field}
                      data-testid="input-stakeholder-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Organization */}
            <FormField
              control={form.control}
              name="organization"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Hospital, clinic, insurance company, etc." 
                      {...field}
                      data-testid="input-stakeholder-organization"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input 
                        type="email"
                        placeholder="email@example.com" 
                        {...field}
                        data-testid="input-stakeholder-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="(04) 1234 5678" 
                        {...field}
                        data-testid="input-stakeholder-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about this stakeholder..."
                      className="min-h-[100px]"
                      {...field}
                      data-testid="textarea-stakeholder-notes"
                    />
                  </FormControl>
                  <FormDescription>
                    Any relevant information about this stakeholder's involvement in the case
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Active Status */}
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Stakeholder</FormLabel>
                    <FormDescription>
                      Whether this stakeholder is currently involved in the case
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-stakeholder-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            data-testid="button-cancel-stakeholder"
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            disabled={isSubmitting}
            data-testid="button-save-stakeholder"
          >
            {isSubmitting ? "Saving..." : mode === "create" ? "Add Stakeholder" : "Update Stakeholder"}
          </Button>
        </div>
      </form>
    </Form>
  );
}