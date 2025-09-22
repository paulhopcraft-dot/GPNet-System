// Jotform Integration Configuration
// External Jotform links for different health check types

export const JOTFORM_LINKS = {
  MENTAL_HEALTH_CHECK: "https://form.jotform.com/251677479546070",
  // Additional forms to be added:
  // PRE_EMPLOYMENT_CHECK: "",
  // INJURY_ASSESSMENT: "",
  // FITNESS_FOR_WORK: "",
  // RETURN_TO_WORK: "",
  // PERIODIC_HEALTH_CHECK: "",
} as const;

export const JOTFORM_CONFIG = {
  // Webhook endpoints for each form type
  webhookEndpoints: {
    MENTAL_HEALTH_CHECK: "/api/webhook/mental-health",
    PRE_EMPLOYMENT_CHECK: "/api/webhook/jotform",
    INJURY_ASSESSMENT: "/api/webhook/injury",
    FITNESS_FOR_WORK: "/api/webhook/fitness-check",
    RETURN_TO_WORK: "/api/webhook/rtw-check",
    PERIODIC_HEALTH_CHECK: "/api/webhook/periodic-check",
  },
  
  // Form types mapping
  formTypes: {
    MENTAL_HEALTH_CHECK: "mental_health",
    PRE_EMPLOYMENT_CHECK: "pre_employment", 
    INJURY_ASSESSMENT: "injury",
    FITNESS_FOR_WORK: "fitness_assessment",
    RETURN_TO_WORK: "rtw_assessment",
    PERIODIC_HEALTH_CHECK: "periodic_check",
  }
} as const;

// Type definitions
export type JotformType = keyof typeof JOTFORM_LINKS;
export type FormType = typeof JOTFORM_CONFIG.formTypes[JotformType];