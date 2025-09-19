import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { injuryFormSchema, type InjuryFormData } from "@shared/schema";
import { 
  Form, 
  FormControl, 
  FormDescription,
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";

const formSections = [
  { id: "worker", title: "Worker Information", fields: 8 },
  { id: "incident", title: "Incident Details", fields: 4 },
  { id: "injury", title: "Injury Information", fields: 3 },
  { id: "treatment", title: "Treatment & Recovery", fields: 3 },
  { id: "capacity", title: "Work Capacity", fields: 2 },
  { id: "medical", title: "Medical Provider", fields: 3 },
  { id: "consent", title: "Consent & Declaration", fields: 4 },
];

const bodyParts = [
  "Head", "Neck", "Shoulders", "Arms", "Elbows", "Wrists", "Hands", "Fingers",
  "Back", "Chest", "Abdomen", "Hips", "Legs", "Knees", "Ankles", "Feet", "Toes"
];

const injuryTypes = [
  "Strain/Sprain", "Cut/Laceration", "Bruise/Contusion", "Fracture/Break", 
  "Burn", "Chemical Exposure", "Puncture", "Crush", "Dislocation", "Other"
];

const workRestrictions = [
  "No lifting over 5kg", "No lifting over 10kg", "No lifting over 15kg",
  "No prolonged standing", "No prolonged sitting", "No climbing",
  "No reaching overhead", "No bending/stooping", "No repetitive motions",
  "Modified hours", "Frequent breaks required", "Other"
];

interface InjuryFormProps {
  onSubmit?: (data: InjuryFormData) => void;
  isSubmitting?: boolean;
}

export default function InjuryForm({ 
  onSubmit, 
  isSubmitting = false 
}: InjuryFormProps) {
  const [currentSection, setCurrentSection] = useState(0);
  
  const form = useForm<InjuryFormData>({
    resolver: zodResolver(injuryFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      employeeId: "",
      department: "",
      position: "",
      supervisor: "",
      incidentDate: "",
      incidentTime: "",
      location: "",
      description: "",
      bodyPartsAffected: [],
      injuryType: "",
      severity: "minor",
      medicalTreatment: "",
      timeOffWork: false,
      estimatedRecovery: "",
      witnessDetails: "",
      immediateAction: "",
      canReturnToWork: "yes",
      workRestrictions: [],
      doctorName: "",
      clinicName: "",
      clinicPhone: "",
      claimType: "standard",
      consentToShare: false,
      signature: "",
      signatureDate: "",
    },
  });

  const totalFields = formSections.reduce((sum, section) => sum + section.fields, 0);
  const completedFields = formSections
    .slice(0, currentSection)
    .reduce((sum, section) => sum + section.fields, 0);
  
  const progressPercentage = Math.round((completedFields / totalFields) * 100);

  const nextSection = () => {
    if (currentSection < formSections.length - 1) {
      setCurrentSection(currentSection + 1);
    }
  };

  const prevSection = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const handleFormSubmit = (data: InjuryFormData) => {
    console.log("Injury form submitted:", data);
    onSubmit?.(data);
  };

  const currentDate = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6" data-testid="injury-form">
      {/* Progress Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold">
              Workplace Injury Report
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              Section {currentSection + 1} of {formSections.length}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{formSections[currentSection].title}</span>
              <span>{progressPercentage}% Complete</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </CardHeader>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  {currentSection + 1}
                </span>
                {formSections[currentSection].title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Worker Information Section */}
              {currentSection === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-firstName" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-lastName" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address *</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-email" />
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
                          <FormLabel>Phone Number *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="employeeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employee ID</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-employeeId" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-department" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Position/Job Title *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-position" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="supervisor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supervisor *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-supervisor" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Incident Details Section */}
              {currentSection === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="incidentDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Incident *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-incidentDate" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="incidentTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time of Incident</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} data-testid="input-incidentTime" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location of Incident *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Warehouse Floor 2, Office Building A" data-testid="input-location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description of Incident *</FormLabel>
                        <FormDescription>
                          Please provide a detailed description of what happened, including the sequence of events leading to the injury.
                        </FormDescription>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={4}
                            placeholder="Describe how the incident occurred, what you were doing, and any contributing factors..."
                            data-testid="input-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Injury Information Section */}
              {currentSection === 2 && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="bodyPartsAffected"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Body Parts Affected *</FormLabel>
                        <FormDescription>Select all body parts that were injured</FormDescription>
                        <FormControl>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                            {bodyParts.map((part) => (
                              <div key={part} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`body-${part}`}
                                  checked={field.value?.includes(part) || false}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, part]);
                                    } else {
                                      field.onChange(current.filter((p) => p !== part));
                                    }
                                  }}
                                  data-testid={`checkbox-body-${part}`}
                                />
                                <Label htmlFor={`body-${part}`} className="text-sm">{part}</Label>
                              </div>
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="injuryType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type of Injury *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-injuryType">
                              <SelectValue placeholder="Select injury type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {injuryTypes.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Severity Assessment *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="grid grid-cols-2 md:grid-cols-4 gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="minor" id="minor" data-testid="radio-severity-minor" />
                              <Label htmlFor="minor">Minor</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="moderate" id="moderate" data-testid="radio-severity-moderate" />
                              <Label htmlFor="moderate">Moderate</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="serious" id="serious" data-testid="radio-severity-serious" />
                              <Label htmlFor="serious">Serious</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="major" id="major" data-testid="radio-severity-major" />
                              <Label htmlFor="major">Major</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Treatment & Recovery Section */}
              {currentSection === 3 && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="medicalTreatment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical Treatment Received *</FormLabel>
                        <FormDescription>
                          Describe any first aid, medical treatment, or hospital care received
                        </FormDescription>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={3}
                            placeholder="e.g., First aid on site, emergency room visit, x-rays taken..."
                            data-testid="input-medicalTreatment"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="timeOffWork"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-timeOffWork"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Will this injury require time off work?
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="estimatedRecovery"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Recovery Time</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="e.g., 1-2 weeks, unknown"
                            data-testid="input-estimatedRecovery"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Work Capacity Section */}
              {currentSection === 4 && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="canReturnToWork"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Can you return to your normal work duties? *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="space-y-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="yes" id="return-yes" data-testid="radio-return-yes" />
                              <Label htmlFor="return-yes">Yes, without restrictions</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="with_restrictions" id="return-restricted" data-testid="radio-return-restricted" />
                              <Label htmlFor="return-restricted">Yes, with restrictions</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="no" id="return-no" data-testid="radio-return-no" />
                              <Label htmlFor="return-no">No, unable to work</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {(form.watch("canReturnToWork") === "with_restrictions") && (
                    <FormField
                      control={form.control}
                      name="workRestrictions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work Restrictions *</FormLabel>
                          <FormDescription>Select all restrictions that apply</FormDescription>
                          <FormControl>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                              {workRestrictions.map((restriction) => (
                                <div key={restriction} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`restriction-${restriction}`}
                                    checked={field.value?.includes(restriction) || false}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || [];
                                      if (checked) {
                                        field.onChange([...current, restriction]);
                                      } else {
                                        field.onChange(current.filter((r) => r !== restriction));
                                      }
                                    }}
                                    data-testid={`checkbox-restriction-${restriction}`}
                                  />
                                  <Label htmlFor={`restriction-${restriction}`} className="text-sm">{restriction}</Label>
                                </div>
                              ))}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}

              {/* Medical Provider Section */}
              {currentSection === 5 && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Medical Provider Information (if applicable)
                    </h4>
                    
                    <FormField
                      control={form.control}
                      name="doctorName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Doctor/Provider Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-doctorName" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="clinicName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Clinic/Hospital Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-clinicName" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="clinicPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Clinic Phone Number</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-clinicPhone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <FormField
                    control={form.control}
                    name="claimType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Claim Type *</FormLabel>
                        <FormDescription>
                          Select whether this is a standard workplace injury or requires WorkCover processing
                        </FormDescription>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-claimType">
                              <SelectValue placeholder="Select claim type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="standard">Standard Claim</SelectItem>
                            <SelectItem value="workcover">WorkCover Claim</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Consent & Declaration Section */}
              {currentSection === 6 && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Additional Information
                    </h4>
                    
                    <FormField
                      control={form.control}
                      name="witnessDetails"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Witness Details</FormLabel>
                          <FormDescription>
                            List any witnesses to the incident, including their names and contact information
                          </FormDescription>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              rows={3}
                              placeholder="Name, phone, relationship to incident..."
                              data-testid="input-witnessDetails"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="immediateAction"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Immediate Action Taken</FormLabel>
                          <FormDescription>
                            Describe any immediate action taken after the incident
                          </FormDescription>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              rows={3}
                              placeholder="First aid provided, area secured, equipment checked..."
                              data-testid="input-immediateAction"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Consent & Declaration</h4>
                    
                    <FormField
                      control={form.control}
                      name="consentToShare"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-consentToShare"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              I consent to sharing this information with relevant medical providers, insurers, and regulatory bodies as required for claim processing and workplace safety. *
                            </FormLabel>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="signature"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Digital Signature *</FormLabel>
                          <FormDescription>Type your full name as your digital signature</FormDescription>
                          <FormControl>
                            <Input {...field} placeholder="Type your full name" data-testid="input-signature" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="signatureDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date *</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              defaultValue={currentDate}
                              data-testid="input-signatureDate"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevSection}
                  disabled={currentSection === 0}
                  data-testid="button-previous"
                >
                  Previous
                </Button>
                
                {currentSection < formSections.length - 1 ? (
                  <Button
                    type="button"
                    onClick={nextSection}
                    data-testid="button-next"
                  >
                    Next Section
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    data-testid="button-submit"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Injury Report"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}