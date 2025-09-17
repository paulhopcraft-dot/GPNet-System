import PreEmploymentForm from "@/components/PreEmploymentForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { type PreEmploymentFormData } from "@shared/schema";

export default function WorkerForm() {
  const handleFormSubmit = (data: PreEmploymentFormData) => {
    console.log("Worker form submitted:", data);
    // todo: remove mock functionality - implement real form submission
    alert("Form submitted successfully! (Demo mode)");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Simple Header for Worker Form */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">GP</span>
                </div>
                <span className="text-xl font-semibold">GPNet</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                Pre-Employment Check
              </Badge>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Form Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-form-title">
            Pre-Employment Health Assessment
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Please complete this confidential health assessment as part of your pre-employment process. 
            All information will be reviewed by qualified health professionals and shared only with your prospective employer as necessary.
          </p>
        </div>

        <PreEmploymentForm
          onSubmit={handleFormSubmit}
          isSubmitting={false}
        />

        {/* Footer Information */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            This assessment is conducted in accordance with workplace health and safety regulations.
            For questions or assistance, please contact our support team.
          </p>
        </div>
      </main>
    </div>
  );
}