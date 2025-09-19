import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
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
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Plus, X, FileText, Calendar, User, Clock } from "lucide-react";
import { rtwPlanSchema, type RtwPlanFormData } from "@shared/schema";
import { format } from "date-fns";

interface RtwPlanFormProps {
  ticketId: string;
  initialData?: Partial<RtwPlanFormData>;
  onSubmit: (data: RtwPlanFormData) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
}

// Common work restrictions options
const commonRestrictions = [
  "No lifting over 10kg",
  "No lifting over 15kg", 
  "No lifting over 20kg",
  "No overhead lifting",
  "No repetitive bending",
  "No prolonged standing",
  "No prolonged sitting",
  "Frequent breaks required",
  "No climbing ladders/stairs",
  "No driving",
  "No night shifts",
  "Modified work hours",
  "Ergonomic workstation required",
  "Regular physiotherapy appointments",
];

// Common modified duties options
const commonModifiedDuties = [
  "Light administrative duties only",
  "Desk-based work only",
  "Phone/computer work",
  "Training and education activities", 
  "Mentoring junior staff",
  "Project planning and documentation",
  "Quality control reviews",
  "Customer service (seated)",
  "Data entry and filing",
  "Research and analysis",
];

const statusConfig = {
  draft: { variant: "secondary" as const, label: "Draft" },
  pending_approval: { variant: "default" as const, label: "Pending Approval" },
  approved: { variant: "default" as const, label: "Approved" },
  active: { variant: "outline" as const, label: "Active" },
  completed: { variant: "outline" as const, label: "Completed" },
};

export default function RtwPlanForm({
  ticketId,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = "create"
}: RtwPlanFormProps) {
  const [customRestriction, setCustomRestriction] = useState("");
  const [customDuty, setCustomDuty] = useState("");

  const form = useForm<RtwPlanFormData>({
    resolver: zodResolver(rtwPlanSchema),
    defaultValues: {
      ticketId,
      title: "",
      restrictions: [],
      modifiedDuties: [],
      targetReturnDate: "",
      reviewDate: "",
      status: "draft",
      doctorApproval: false,
      doctorNotes: "",
      createdBy: "System User", // TODO: Get from current user context
      ...initialData,
    },
  });

  const watchedRestrictions = form.watch("restrictions");
  const watchedDuties = form.watch("modifiedDuties");
  const watchedStatus = form.watch("status");

  const handleAddRestriction = (restriction: string) => {
    if (restriction && !watchedRestrictions.includes(restriction)) {
      form.setValue("restrictions", [...watchedRestrictions, restriction]);
    }
  };

  const handleRemoveRestriction = (restriction: string) => {
    form.setValue("restrictions", watchedRestrictions.filter(r => r !== restriction));
  };

  const handleAddCustomRestriction = () => {
    if (customRestriction.trim() && !watchedRestrictions.includes(customRestriction.trim())) {
      form.setValue("restrictions", [...watchedRestrictions, customRestriction.trim()]);
      setCustomRestriction("");
    }
  };

  const handleAddDuty = (duty: string) => {
    if (duty && !watchedDuties.includes(duty)) {
      form.setValue("modifiedDuties", [...watchedDuties, duty]);
    }
  };

  const handleRemoveDuty = (duty: string) => {
    form.setValue("modifiedDuties", watchedDuties.filter(d => d !== duty));
  };

  const handleAddCustomDuty = () => {
    if (customDuty.trim() && !watchedDuties.includes(customDuty.trim())) {
      form.setValue("modifiedDuties", [...watchedDuties, customDuty.trim()]);
      setCustomDuty("");
    }
  };

  const handleFormSubmit = (data: RtwPlanFormData) => {
    console.log("Submitting RTW plan:", data);
    onSubmit(data);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {mode === "create" ? "Create RTW Plan" : "Edit RTW Plan"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Return to Work plan for Case #{ticketId}
            </p>
          </div>
          {initialData?.status && (
            <Badge {...statusConfig[initialData.status as keyof typeof statusConfig]}>
              {statusConfig[initialData.status as keyof typeof statusConfig].label}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            
            {/* Plan Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <h3 className="text-lg font-semibold">Plan Details</h3>
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Gradual return to administrative duties"
                        data-testid="input-rtw-title"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="targetReturnDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Return Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          data-testid="input-target-return-date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reviewDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Review Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          data-testid="input-review-date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-rtw-status">
                          <SelectValue placeholder="Select plan status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="pending_approval">Pending Approval</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Work Restrictions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <h3 className="text-lg font-semibold">Work Restrictions</h3>
              </div>

              <div className="space-y-3">
                <Label>Common Restrictions</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {commonRestrictions.map((restriction) => (
                    <div key={restriction} className="flex items-center space-x-2">
                      <Checkbox
                        id={`restriction-${restriction}`}
                        checked={watchedRestrictions.includes(restriction)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleAddRestriction(restriction);
                          } else {
                            handleRemoveRestriction(restriction);
                          }
                        }}
                        data-testid={`checkbox-restriction-${restriction.toLowerCase().replace(/\s+/g, '-')}`}
                      />
                      <Label 
                        htmlFor={`restriction-${restriction}`}
                        className="text-sm cursor-pointer"
                      >
                        {restriction}
                      </Label>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Add custom restriction..."
                    value={customRestriction}
                    onChange={(e) => setCustomRestriction(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomRestriction())}
                    data-testid="input-custom-restriction"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCustomRestriction}
                    data-testid="button-add-restriction"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {watchedRestrictions.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Restrictions:</Label>
                    <div className="flex flex-wrap gap-2">
                      {watchedRestrictions.map((restriction) => (
                        <Badge 
                          key={restriction} 
                          variant="secondary" 
                          className="flex items-center gap-1"
                          data-testid={`badge-restriction-${restriction.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {restriction}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 ml-1"
                            onClick={() => handleRemoveRestriction(restriction)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Modified Duties */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <h3 className="text-lg font-semibold">Modified Duties</h3>
              </div>

              <div className="space-y-3">
                <Label>Common Modified Duties</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {commonModifiedDuties.map((duty) => (
                    <div key={duty} className="flex items-center space-x-2">
                      <Checkbox
                        id={`duty-${duty}`}
                        checked={watchedDuties.includes(duty)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleAddDuty(duty);
                          } else {
                            handleRemoveDuty(duty);
                          }
                        }}
                        data-testid={`checkbox-duty-${duty.toLowerCase().replace(/\s+/g, '-')}`}
                      />
                      <Label 
                        htmlFor={`duty-${duty}`}
                        className="text-sm cursor-pointer"
                      >
                        {duty}
                      </Label>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Add custom modified duty..."
                    value={customDuty}
                    onChange={(e) => setCustomDuty(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomDuty())}
                    data-testid="input-custom-duty"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCustomDuty}
                    data-testid="button-add-duty"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {watchedDuties.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Modified Duties:</Label>
                    <div className="flex flex-wrap gap-2">
                      {watchedDuties.map((duty) => (
                        <Badge 
                          key={duty} 
                          variant="secondary" 
                          className="flex items-center gap-1"
                          data-testid={`badge-duty-${duty.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {duty}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 ml-1"
                            onClick={() => handleRemoveDuty(duty)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Doctor Notes */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <h3 className="text-lg font-semibold">Medical Notes</h3>
              </div>

              <FormField
                control={form.control}
                name="doctorNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Doctor Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional medical notes or recommendations..."
                        className="min-h-[100px]"
                        data-testid="textarea-doctor-notes"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  data-testid="button-cancel-rtw"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-submit-rtw"
              >
                {isSubmitting ? "Saving..." : mode === "create" ? "Create Plan" : "Update Plan"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}