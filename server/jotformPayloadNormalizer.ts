/**
 * Jotform Payload Normalizer
 * 
 * Jotform sends all form data as strings, but our schemas expect proper types.
 * This module handles the transformation from Jotform's string-based payload
 * to properly typed data that matches our Zod schemas.
 */

export interface JotformRawPayload {
  [key: string]: string | string[] | undefined;
}

/**
 * Normalizes Jotform boolean fields
 * Jotform sends: "Yes", "No", "true", "false", "1", "0", or actual booleans
 */
function normalizeBoolean(value: string | string[] | boolean | undefined): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  
  // If already a boolean, return as-is
  if (typeof value === 'boolean') return value;
  
  // If it's an array, take the first valid element
  if (Array.isArray(value)) {
    const first = value.find(item => item && item.trim() !== '');
    if (!first) return undefined;
    value = first;
  }
  
  // If not a string, try to convert
  if (typeof value !== 'string') return undefined;
  
  const normalized = value.toLowerCase().trim();
  
  // Handle common boolean representations
  if (normalized === 'yes' || normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'no' || normalized === 'false' || normalized === '0') {
    return false;
  }
  
  return undefined;
}

/**
 * Normalizes Jotform yes/no fields to string enums
 * Jotform sends: "Yes", "No", "true", "false", "1", "0", or actual booleans
 * Returns: "yes", "no", or undefined
 */
function normalizeYesNo(value: string | string[] | boolean | undefined): "yes" | "no" | undefined {
  if (value === undefined || value === null) return undefined;
  
  // If already a boolean, convert to string
  if (typeof value === 'boolean') return value ? "yes" : "no";
  
  // If it's an array, take the first valid element
  if (Array.isArray(value)) {
    const first = value.find(item => item && item.trim() !== '');
    if (!first) return undefined;
    value = first;
  }
  
  // If not a string, try to convert
  if (typeof value !== 'string') return undefined;
  
  const normalized = value.toLowerCase().trim();
  
  // Handle common yes/no representations
  if (normalized === 'yes' || normalized === 'true' || normalized === '1') {
    return "yes";
  }
  if (normalized === 'no' || normalized === 'false' || normalized === '0') {
    return "no";
  }
  
  return undefined;
}

/**
 * Normalizes Jotform number fields
 * Jotform sends: "123", "45.67", "0", "" or actual numbers
 */
function normalizeNumber(value: string | string[] | number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  
  // If already a number, return as-is
  if (typeof value === 'number') return isNaN(value) ? undefined : value;
  
  // If it's an array, take the first valid element
  if (Array.isArray(value)) {
    const first = value.find(item => item && item.trim() !== '');
    if (!first) return undefined;
    value = first;
  }
  
  // If not a string, try to convert
  if (typeof value !== 'string') return undefined;
  
  if (value.trim() === '') return undefined;
  
  const normalized = parseFloat(value.trim());
  return isNaN(normalized) ? undefined : normalized;
}

/**
 * Normalizes Jotform integer fields
 * Jotform sends: "123", "0", "" or actual numbers
 */
function normalizeInteger(value: string | string[] | number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  
  // If already a number, return rounded
  if (typeof value === 'number') return isNaN(value) ? undefined : Math.round(value);
  
  // If it's an array, take the first valid element
  if (Array.isArray(value)) {
    const first = value.find(item => item && item.trim() !== '');
    if (!first) return undefined;
    value = first;
  }
  
  // If not a string, try to convert
  if (typeof value !== 'string') return undefined;
  
  if (value.trim() === '') return undefined;
  
  const normalized = parseInt(value.trim(), 10);
  return isNaN(normalized) ? undefined : normalized;
}

/**
 * Normalizes Jotform array fields (multi-select, checkboxes)
 * Jotform sends: "option1,option2,option3" or ["option1", "option2"]
 */
function normalizeArray(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  
  if (Array.isArray(value)) {
    return value.filter(item => item && item.trim() !== '');
  }
  
  if (typeof value === 'string') {
    // Handle comma-separated values
    return value.split(',')
      .map(item => item.trim())
      .filter(item => item !== '');
  }
  
  return undefined;
}

/**
 * Normalizes Jotform string fields
 * Trims whitespace and converts empty strings to undefined
 */
function normalizeString(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  
  // If it's an array, take the first non-empty element
  if (Array.isArray(value)) {
    const first = value.find(item => item && item.trim() !== '');
    return first ? first.trim() : undefined;
  }
  
  if (typeof value !== 'string') return undefined;
  
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Normalizes date fields from Jotform
 * Jotform sends: "2025-09-22", "09/22/2025", ""
 */
function normalizeDate(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  
  // If it's an array, take the first valid element
  if (Array.isArray(value)) {
    const first = value.find(item => item && item.trim() !== '');
    if (!first) return undefined;
    value = first;
  }
  
  if (typeof value !== 'string') return undefined;
  
  if (value.trim() === '') return undefined;
  
  const trimmed = value.trim();
  
  // Try to parse and reformat to ISO date string
  try {
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) return undefined;
    
    // Return in YYYY-MM-DD format
    return date.toISOString().split('T')[0];
  } catch {
    return undefined;
  }
}

/**
 * Normalizes Pre-Employment form data from Jotform
 */
export function normalizePreEmploymentData(rawPayload: JotformRawPayload): any {
  return {
    // Personal Information
    firstName: normalizeString(rawPayload.firstName || rawPayload.first_name),
    lastName: normalizeString(rawPayload.lastName || rawPayload.last_name),
    email: normalizeString(rawPayload.email),
    phone: normalizeString(rawPayload.phone),
    dateOfBirth: normalizeDate(rawPayload.dateOfBirth || rawPayload.date_of_birth),
    
    // Employment Details
    roleApplied: normalizeString(rawPayload.roleApplied || rawPayload.role_applied),
    department: normalizeString(rawPayload.department),
    startDate: normalizeDate(rawPayload.startDate || rawPayload.start_date),
    
    // Physical Requirements
    liftingKg: normalizeInteger(rawPayload.liftingKg || rawPayload.lifting_kg),
    standing: normalizeBoolean(rawPayload.standing),
    sitting: normalizeBoolean(rawPayload.sitting),
    walking: normalizeBoolean(rawPayload.walking),
    repetitiveTasks: normalizeYesNo(rawPayload.repetitiveTasks || rawPayload.repetitive_tasks),
    
    // Health Information
    medicalConditions: normalizeArray(rawPayload.medicalConditions || rawPayload.medical_conditions),
    medications: normalizeString(rawPayload.medications),
    allergies: normalizeString(rawPayload.allergies),
    
    // Consent & Declaration
    consentToShare: normalizeBoolean(rawPayload.consentToShare || rawPayload.consent_to_share),
    signature: normalizeString(rawPayload.signature),
    signatureDate: normalizeDate(rawPayload.signatureDate || rawPayload.signature_date),
  };
}

/**
 * Normalizes Injury Assessment form data from Jotform
 */
export function normalizeInjuryData(rawPayload: JotformRawPayload): any {
  return {
    // Personal Information
    firstName: normalizeString(rawPayload.firstName || rawPayload.first_name),
    lastName: normalizeString(rawPayload.lastName || rawPayload.last_name),
    email: normalizeString(rawPayload.email),
    phone: normalizeString(rawPayload.phone),
    dateOfBirth: normalizeDate(rawPayload.dateOfBirth || rawPayload.date_of_birth),
    employeeId: normalizeString(rawPayload.employeeId || rawPayload.employee_id),
    
    // Injury Details
    injuryDate: normalizeDate(rawPayload.injuryDate || rawPayload.injury_date),
    injuryLocation: normalizeString(rawPayload.injuryLocation || rawPayload.injury_location),
    injuryType: normalizeString(rawPayload.injuryType || rawPayload.injury_type),
    bodyPartAffected: normalizeArray(rawPayload.bodyPartAffected || rawPayload.body_part_affected),
    painLevel: normalizeInteger(rawPayload.painLevel || rawPayload.pain_level),
    
    // Work Impact
    timeOffWork: normalizeBoolean(rawPayload.timeOffWork || rawPayload.time_off_work),
    modifiedDuties: normalizeBoolean(rawPayload.modifiedDuties || rawPayload.modified_duties),
    medicalTreatment: normalizeBoolean(rawPayload.medicalTreatment || rawPayload.medical_treatment),
    
    // Consent & Declaration
    consentToShare: normalizeBoolean(rawPayload.consentToShare || rawPayload.consent_to_share),
    signature: normalizeString(rawPayload.signature),
    signatureDate: normalizeDate(rawPayload.signatureDate || rawPayload.signature_date),
  };
}

/**
 * Normalizes Mental Health Check form data from Jotform
 */
export function normalizeMentalHealthData(rawPayload: JotformRawPayload): any {
  return {
    // Personal Information
    firstName: normalizeString(rawPayload.firstName || rawPayload.first_name),
    lastName: normalizeString(rawPayload.lastName || rawPayload.last_name),
    email: normalizeString(rawPayload.email),
    phone: normalizeString(rawPayload.phone),
    dateOfBirth: normalizeDate(rawPayload.dateOfBirth || rawPayload.date_of_birth),
    employeeId: normalizeString(rawPayload.employeeId || rawPayload.employee_id),
    
    // Mental Health Assessment
    stressLevel: normalizeInteger(rawPayload.stressLevel || rawPayload.stress_level),
    sleepQuality: normalizeString(rawPayload.sleepQuality || rawPayload.sleep_quality),
    moodChanges: normalizeBoolean(rawPayload.moodChanges || rawPayload.mood_changes),
    anxietyLevel: normalizeInteger(rawPayload.anxietyLevel || rawPayload.anxiety_level),
    
    // Support Needs
    supportNeeded: normalizeArray(rawPayload.supportNeeded || rawPayload.support_needed),
    previousCounseling: normalizeBoolean(rawPayload.previousCounseling || rawPayload.previous_counseling),
    
    // Consent & Declaration
    consentToShare: normalizeBoolean(rawPayload.consentToShare || rawPayload.consent_to_share),
    signature: normalizeString(rawPayload.signature),
    signatureDate: normalizeDate(rawPayload.signatureDate || rawPayload.signature_date),
  };
}

/**
 * Normalizes Exit Check form data from Jotform
 */
export function normalizeExitCheckData(rawPayload: JotformRawPayload): any {
  return {
    // Personal Information
    firstName: normalizeString(rawPayload.firstName || rawPayload.first_name),
    lastName: normalizeString(rawPayload.lastName || rawPayload.last_name),
    email: normalizeString(rawPayload.email),
    phone: normalizeString(rawPayload.phone),
    dateOfBirth: normalizeDate(rawPayload.dateOfBirth || rawPayload.date_of_birth),
    employeeId: normalizeString(rawPayload.employeeId || rawPayload.employee_id),
    
    // Exit Information
    lastWorkingDay: normalizeDate(rawPayload.lastWorkingDay || rawPayload.last_working_day),
    reasonForLeaving: normalizeString(rawPayload.reasonForLeaving || rawPayload.reason_for_leaving),
    department: normalizeString(rawPayload.department),
    position: normalizeString(rawPayload.position),
    
    // Health Status
    healthIssues: normalizeArray(rawPayload.healthIssues || rawPayload.health_issues),
    ongoingMedicalCare: normalizeBoolean(rawPayload.ongoingMedicalCare || rawPayload.ongoing_medical_care),
    
    // Consent & Declaration
    consentToShare: normalizeBoolean(rawPayload.consentToShare || rawPayload.consent_to_share),
    signature: normalizeString(rawPayload.signature),
    signatureDate: normalizeDate(rawPayload.signatureDate || rawPayload.signature_date),
  };
}

/**
 * Normalizes Prevention Check form data from Jotform
 */
export function normalizePreventionCheckData(rawPayload: JotformRawPayload): any {
  return {
    // Personal Information
    firstName: normalizeString(rawPayload.firstName || rawPayload.first_name),
    lastName: normalizeString(rawPayload.lastName || rawPayload.last_name),
    email: normalizeString(rawPayload.email),
    phone: normalizeString(rawPayload.phone),
    dateOfBirth: normalizeDate(rawPayload.dateOfBirth || rawPayload.date_of_birth),
    employeeId: normalizeString(rawPayload.employeeId || rawPayload.employee_id),
    department: normalizeString(rawPayload.department),
    position: normalizeString(rawPayload.position),
    
    // Risk Assessment
    workEnvironmentRisks: normalizeArray(rawPayload.workEnvironmentRisks || rawPayload.work_environment_risks),
    physicalDemands: normalizeString(rawPayload.physicalDemands || rawPayload.physical_demands),
    ergonomicConcerns: normalizeString(rawPayload.ergonomicConcerns || rawPayload.ergonomic_concerns),
    hazardExposure: normalizeArray(rawPayload.hazardExposure || rawPayload.hazard_exposure),
    
    // Health and Fitness
    currentHealthStatus: normalizeString(rawPayload.currentHealthStatus || rawPayload.current_health_status),
    fitnessLevel: normalizeInteger(rawPayload.fitnessLevel || rawPayload.fitness_level),
    previousInjuries: normalizeString(rawPayload.previousInjuries || rawPayload.previous_injuries),
    currentMedications: normalizeString(rawPayload.currentMedications || rawPayload.current_medications),
    
    // Prevention Measures
    safetyTrainingCompleted: normalizeBoolean(rawPayload.safetyTrainingCompleted || rawPayload.safety_training_completed),
    ppeUsage: normalizeString(rawPayload.ppeUsage || rawPayload.ppe_usage),
    workstationSetup: normalizeString(rawPayload.workstationSetup || rawPayload.workstation_setup),
    exerciseRoutine: normalizeString(rawPayload.exerciseRoutine || rawPayload.exercise_routine),
    
    // Recommendations
    recommendedPreventionMeasures: normalizeArray(rawPayload.recommendedPreventionMeasures || rawPayload.recommended_prevention_measures),
    additionalComments: normalizeString(rawPayload.additionalComments || rawPayload.additional_comments),
    
    // Consent & Declaration
    consentToShare: normalizeBoolean(rawPayload.consentToShare || rawPayload.consent_to_share),
    signature: normalizeString(rawPayload.signature),
    signatureDate: normalizeDate(rawPayload.signatureDate || rawPayload.signature_date),
  };
}

/**
 * Auto-detects form type and normalizes accordingly
 */
export function normalizeJotformPayload(rawPayload: JotformRawPayload, formType?: string): any {
  // If form type is specified, use it
  if (formType) {
    switch (formType.toLowerCase()) {
      case 'pre_employment':
      case 'preemployment':
        return normalizePreEmploymentData(rawPayload);
      case 'injury':
      case 'injury_assessment':
        return normalizeInjuryData(rawPayload);
      case 'mental_health':
      case 'mentalhealth':
        return normalizeMentalHealthData(rawPayload);
      case 'exit_check':
      case 'exitcheck':
        return normalizeExitCheckData(rawPayload);
      case 'prevention_check':
      case 'preventioncheck':
        return normalizePreventionCheckData(rawPayload);
    }
  }
  
  // Auto-detect based on fields present (fallback)
  if (rawPayload.injuryDate || rawPayload.injury_date) {
    return normalizeInjuryData(rawPayload);
  }
  if (rawPayload.stressLevel || rawPayload.stress_level) {
    return normalizeMentalHealthData(rawPayload);
  }
  if (rawPayload.lastWorkingDay || rawPayload.last_working_day) {
    return normalizeExitCheckData(rawPayload);
  }
  if (rawPayload.workEnvironmentRisks || rawPayload.work_environment_risks) {
    return normalizePreventionCheckData(rawPayload);
  }
  
  // Default to pre-employment
  return normalizePreEmploymentData(rawPayload);
}