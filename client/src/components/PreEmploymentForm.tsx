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
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { preEmploymentFormSchema, type PreEmploymentFormData } from "@shared/schema";
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
  { id: "personal", title: "Personal Details", fields: 7 },
  { id: "medical", title: "Medical History", fields: 4 },
  { id: "musculoskeletal", title: "Musculoskeletal Assessment", fields: 16 },
  { id: "functional", title: "Functional Capacity", fields: 5 },
  { id: "psychosocial", title: "Psychosocial Screening", fields: 4 },
  { id: "consent", title: "Consent & Declaration", fields: 3 },
];

interface PreEmploymentFormProps {
  onSubmit?: (data: PreEmploymentFormData) => void;
  isSubmitting?: boolean;
}

export default function PreEmploymentForm({ 
  onSubmit, 
  isSubmitting = false 
}: PreEmploymentFormProps) {
  const [currentSection, setCurrentSection] = useState(0);
  
  const form = useForm<PreEmploymentFormData>({
    resolver: zodResolver(preEmploymentFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      phone: "",
      email: "",
      roleApplied: "",
      site: "",
      previousInjuries: "",
      conditions: [],
      medications: "",
      allergies: "",
      mskBack: "none",
      mskNeck: "none",
      mskShoulders: "none",
      mskElbows: "none",
      mskWrists: "none",
      mskHips: "none",
      mskKnees: "none",
      mskAnkles: "none",
      liftingKg: 25,
      standingMins: 60,
      walkingMins: 30,
      repetitiveTasks: "no",
      sleepRating: 3,
      stressRating: 3,
      supportRating: 3,
      consentToShare: false,
      signature: "",
      signatureDate: new Date().toISOString().split('T')[0],
    },
  });

  const handleSubmit = (data: PreEmploymentFormData) => {
    console.log("Form submitted:", data);
    onSubmit?.(data);
  };

  const nextSection = () => {
    setCurrentSection(Math.min(currentSection + 1, formSections.length - 1));
  };

  const prevSection = () => {
    setCurrentSection(Math.max(currentSection - 1, 0));
  };

  const progress = ((currentSection + 1) / formSections.length) * 100;

  const renderPersonalDetails = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Name *</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-first-name" />
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
                <Input {...field} data-testid="input-last-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="dateOfBirth"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date of Birth *</FormLabel>
              <FormControl>
                <Input type="date" {...field} data-testid="input-dob" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="roleApplied"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role Applied For *</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-role" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="site"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site/Location</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-site" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );

  const renderPsychosocialScreening = () => (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="sleepRating"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>Sleep Quality (1 = Poor, 5 = Excellent)</FormLabel>
            <FormControl>
              <div className="px-3">
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[field.value]}
                  onValueChange={(vals) => field.onChange(vals[0])}
                  data-testid="slider-sleep"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Poor</span>
                  <span>Fair</span>
                  <span>Good</span>
                  <span>Very Good</span>
                  <span>Excellent</span>
                </div>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="stressRating"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>Stress Level (1 = Low, 5 = High)</FormLabel>
            <FormControl>
              <div className="px-3">
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[field.value]}
                  onValueChange={(vals) => field.onChange(vals[0])}
                  data-testid="slider-stress"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Low</span>
                  <span>Mild</span>
                  <span>Moderate</span>
                  <span>High</span>
                  <span>Very High</span>
                </div>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="supportRating"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>Support Network (1 = Poor, 5 = Excellent)</FormLabel>
            <FormControl>
              <div className="px-3">
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[field.value]}
                  onValueChange={(vals) => field.onChange(vals[0])}
                  data-testid="slider-support"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Poor</span>
                  <span>Fair</span>
                  <span>Good</span>
                  <span>Very Good</span>
                  <span>Excellent</span>
                </div>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="psychosocialComments"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Additional Comments</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Any additional information about your wellbeing or support needs..."
                {...field}
                data-testid="textarea-psychosocial-comments"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  const renderConsentSection = () => (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="consentToShare"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                data-testid="checkbox-consent"
              />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel>
                Consent to Share Information *
              </FormLabel>
              <FormDescription>
                I consent to the sharing of this health information with my prospective employer
                for the purpose of pre-employment health assessment.
              </FormDescription>
            </div>
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="signature"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Digital Signature *</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Type your full name"
                  {...field} 
                  data-testid="input-signature" 
                />
              </FormControl>
              <FormDescription>
                By typing your name, you are providing a digital signature
              </FormDescription>
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
                <Input type="date" {...field} data-testid="input-signature-date" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 0: return renderPersonalDetails();
      case 1: return <div className="text-center py-8 text-muted-foreground">Medical History section - simplified for demo</div>;
      case 2: return <div className="text-center py-8 text-muted-foreground">Musculoskeletal Assessment section - simplified for demo</div>;
      case 3: return <div className="text-center py-8 text-muted-foreground">Functional Capacity section - simplified for demo</div>;
      case 4: return renderPsychosocialScreening();
      case 5: return renderConsentSection();
      default: return null;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="space-y-4">
          <CardTitle className="text-2xl">Pre-Employment Health Check</CardTitle>
          
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Section {currentSection + 1} of {formSections.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" data-testid="progress-form" />
          </div>

          {/* Section title */}
          <div className="text-center">
            <h3 className="text-lg font-semibold" data-testid={`text-section-${currentSection}`}>
              {formSections[currentSection].title}
            </h3>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {renderCurrentSection()}

            <Separator />

            {/* Navigation buttons */}
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

              {currentSection === formSections.length - 1 ? (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="button-submit"
                >
                  {isSubmitting ? "Submitting..." : "Submit Assessment"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={nextSection}
                  data-testid="button-next"
                >
                  Next
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}