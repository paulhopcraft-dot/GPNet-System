// Jotform Integration Configuration
// External Jotform links for different health check types

export const JOTFORM_LINKS = {
  MENTAL_HEALTH_CHECK: "https://form.jotform.com/251677479546070",
  EXIT_CHECK: "https://form.jotform.com/240032827738053",
  PRE_EMPLOYMENT_CHECK: "https://form.jotform.com/250927279768475",
  INJURY_ASSESSMENT: "https://form.jotform.com/240273367274054",
  PREVENTION_CHECK: "https://form.jotform.com/240266476492059",
  // Additional forms to be added:
  // FITNESS_FOR_WORK: "",
  // RETURN_TO_WORK: "",
} as const;

export const JOTFORM_CONFIG = {
  // Webhook endpoints for each form type
  webhookEndpoints: {
    MENTAL_HEALTH_CHECK: "/api/webhook/mental-health",
    EXIT_CHECK: "/api/webhook/exit-check",
    PRE_EMPLOYMENT_CHECK: "/api/webhook/jotform",
    INJURY_ASSESSMENT: "/api/webhook/injury",
    PREVENTION_CHECK: "/api/webhook/prevention-check",
    FITNESS_FOR_WORK: "/api/webhook/fitness-check",
    RETURN_TO_WORK: "/api/webhook/rtw-check",
  },
  
  // Form types mapping
  formTypes: {
    MENTAL_HEALTH_CHECK: "mental_health",
    EXIT_CHECK: "exit_check",
    PRE_EMPLOYMENT_CHECK: "pre_employment", 
    INJURY_ASSESSMENT: "injury",
    PREVENTION_CHECK: "prevention_check",
    FITNESS_FOR_WORK: "fitness_assessment",
    RETURN_TO_WORK: "rtw_assessment",
  }
} as const;

// Type definitions
export type JotformType = keyof typeof JOTFORM_LINKS;
export type FormType = typeof JOTFORM_CONFIG.formTypes[JotformType];