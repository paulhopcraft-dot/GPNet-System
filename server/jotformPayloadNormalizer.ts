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
 * Updated to capture all Module 1 WIS specification fields
 */
export function normalizeInjuryData(rawPayload: JotformRawPayload): any {
  return {
    // Personal Information (Core Worker Details)
    firstName: normalizeString(rawPayload.firstName || rawPayload.first_name),
    lastName: normalizeString(rawPayload.lastName || rawPayload.last_name),
    fullName: normalizeString(rawPayload.fullName || rawPayload.full_name),
    email: normalizeString(rawPayload.email),
    phone: normalizeString(rawPayload.phone),
    dateOfBirth: normalizeDate(rawPayload.dateOfBirth || rawPayload.date_of_birth),
    employeeId: normalizeString(rawPayload.employeeId || rawPayload.employee_id),
    
    // Manager/Supervisor Details (Module 1 Spec - Critical Update)
    managerName: normalizeString(rawPayload.managerName || rawPayload.manager_name),
    managerEmail: normalizeString(rawPayload.managerEmail || rawPayload.manager_email),
    managerPhone: normalizeString(rawPayload.managerPhone || rawPayload.manager_phone),
    
    // Incident Details (Enhanced from spec)
    injuryDate: normalizeDate(rawPayload.injuryDate || rawPayload.injury_date || rawPayload.incidentDate || rawPayload.incident_date),
    injuryLocation: normalizeString(rawPayload.injuryLocation || rawPayload.injury_location || rawPayload.location),
    injuryType: normalizeString(rawPayload.injuryType || rawPayload.injury_type),
    description: normalizeString(rawPayload.description || rawPayload.incidentDescription || rawPayload.incident_description),
    activityAtTime: normalizeString(rawPayload.activityAtTime || rawPayload.activity_at_time || rawPayload.activity),
    witnesses: normalizeString(rawPayload.witnesses || rawPayload.witnessDetails || rawPayload.witness_details),
    bodyPartAffected: normalizeArray(rawPayload.bodyPartAffected || rawPayload.body_part_affected || rawPayload.bodyPart || rawPayload.body_part),
    painLevel: normalizeInteger(rawPayload.painLevel || rawPayload.pain_level),
    
    // Medical Response (Module 1 Spec)
    ambulanceCalled: normalizeBoolean(rawPayload.ambulanceCalled || rawPayload.ambulance_called),
    hospitalAttended: normalizeBoolean(rawPayload.hospitalAttended || rawPayload.hospital_attended),
    hospitalName: normalizeString(rawPayload.hospitalName || rawPayload.hospital_name),
    doctorSeen: normalizeBoolean(rawPayload.doctorSeen || rawPayload.doctor_seen),
    firstAidAdministered: normalizeBoolean(rawPayload.firstAidAdministered || rawPayload.first_aid_administered),
    firstAidDetails: normalizeString(rawPayload.firstAidDetails || rawPayload.first_aid_details),
    
    // Current Worker Status (Module 1 Spec)
    currentLocation: normalizeString(rawPayload.currentLocation || rawPayload.current_location || rawPayload.workerLocation || rawPayload.worker_location),
    workStatus: normalizeString(rawPayload.workStatus || rawPayload.work_status),
    expectedTimeOff: normalizeString(rawPayload.expectedTimeOff || rawPayload.expected_time_off || rawPayload.timeOff || rawPayload.time_off),
    
    // Employment Context (Module 1 Spec)
    underPerformanceManagement: normalizeBoolean(rawPayload.underPerformanceManagement || rawPayload.under_performance_management || rawPayload.performanceManagement || rawPayload.performance_management),
    performanceDetails: normalizeString(rawPayload.performanceDetails || rawPayload.performance_details),
    previousInjuries: normalizeBoolean(rawPayload.previousInjuries || rawPayload.previous_injuries),
    previousInjuryDetails: normalizeString(rawPayload.previousInjuryDetails || rawPayload.previous_injury_details),
    
    // Additional Information (Module 1 Spec - Free-form notes)
    additionalInfo: normalizeString(rawPayload.additionalInfo || rawPayload.additional_info || rawPayload.notes || rawPayload.additionalNotes || rawPayload.additional_notes),
    
    // Work Impact (Backward compatibility - kept for existing forms)
    timeOffWork: normalizeBoolean(rawPayload.timeOffWork || rawPayload.time_off_work),
    modifiedDuties: normalizeBoolean(rawPayload.modifiedDuties || rawPayload.modified_duties),
    medicalTreatment: normalizeBoolean(rawPayload.medicalTreatment || rawPayload.medical_treatment),
    
    // Consent & Declaration
    consentToShare: normalizeBoolean(rawPayload.consentToShare || rawPayload.consent_to_share),
    signature: normalizeString(rawPayload.signature),
    signatureDate: normalizeDate(rawPayload.signatureDate || rawPayload.signature_date),
    
    // System Metadata (captured from JotForm)
    completedBy: normalizeString(rawPayload.completedBy || rawPayload.completed_by || rawPayload.submittedBy || rawPayload.submitted_by),
    completedDate: normalizeDate(rawPayload.completedDate || rawPayload.completed_date || rawPayload.submissionDate || rawPayload.submission_date),
    caseId: normalizeString(rawPayload.caseId || rawPayload.case_id || rawPayload.ticketId || rawPayload.ticket_id),
    companyId: normalizeString(rawPayload.companyId || rawPayload.company_id || rawPayload.organizationId || rawPayload.organization_id),
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
 * Map Jotform enum values to schema canonical values
 */
function mapHealthRating(value: any): string {
  if (!value) return "good"; // default
  const str = String(value).toLowerCase();
  if (str.includes("excellent")) return "excellent";
  if (str.includes("very") && str.includes("good")) return "very_good";
  if (str.includes("good")) return "good";
  if (str.includes("fair")) return "fair";
  if (str.includes("poor")) return "poor";
  return "good";
}

function mapExerciseFrequency(value: any): string {
  if (!value) return "weekly"; // default
  const str = String(value).toLowerCase();
  if (str.includes("daily")) return "daily";
  if (str.includes("weekly")) return "weekly";
  if (str.includes("monthly")) return "monthly";
  if (str.includes("rarely")) return "rarely";
  if (str.includes("never")) return "never";
  return "weekly";
}

function mapSocialSupport(value: any): string {
  if (!value) return "adequate"; // default
  const str = String(value).toLowerCase();
  if (str.includes("excellent")) return "excellent";
  if (str.includes("good")) return "good";
  if (str.includes("adequate")) return "adequate";
  if (str.includes("poor")) return "poor";
  if (str.includes("none")) return "none";
  return "adequate";
}

function mapSmokingStatus(value: any): string {
  if (!value) return "never"; // default
  const str = String(value).toLowerCase();
  if (str.includes("never")) return "never";
  if (str.includes("former")) return "former";
  if (str.includes("current")) return "current";
  return "never";
}

function mapAlcoholConsumption(value: any): string {
  if (!value) return "none"; // default
  const str = String(value).toLowerCase();
  if (str.includes("none")) return "none";
  if (str.includes("occasional")) return "occasional";
  if (str.includes("moderate")) return "moderate";
  if (str.includes("frequent")) return "frequent";
  return "none";
}

/**
 * General Health and Well-being Form Normalizer
 */
export function normalizeGeneralHealthData(rawPayload: JotformRawPayload): any {
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
    
    // General Health Status
    overallHealthRating: mapHealthRating(rawPayload.overallHealthRating || rawPayload.overall_health_rating),
    currentHealthConditions: normalizeString(rawPayload.currentHealthConditions || rawPayload.current_health_conditions),
    medications: normalizeString(rawPayload.medications),
    allergies: normalizeString(rawPayload.allergies),
    
    // Physical Health
    physicalFitness: normalizeInteger(rawPayload.physicalFitness || rawPayload.physical_fitness),
    energyLevel: normalizeInteger(rawPayload.energyLevel || rawPayload.energy_level),
    sleepQuality: normalizeInteger(rawPayload.sleepQuality || rawPayload.sleep_quality),
    exerciseFrequency: mapExerciseFrequency(rawPayload.exerciseFrequency || rawPayload.exercise_frequency),
    
    // Mental and Emotional Well-being
    stressLevel: normalizeInteger(rawPayload.stressLevel || rawPayload.stress_level),
    moodStability: normalizeInteger(rawPayload.moodStability || rawPayload.mood_stability),
    workLifeBalance: normalizeInteger(rawPayload.workLifeBalance || rawPayload.work_life_balance),
    socialSupport: mapSocialSupport(rawPayload.socialSupport || rawPayload.social_support),
    
    // Lifestyle Factors
    smokingStatus: mapSmokingStatus(rawPayload.smokingStatus || rawPayload.smoking_status),
    alcoholConsumption: mapAlcoholConsumption(rawPayload.alcoholConsumption || rawPayload.alcohol_consumption),
    dietQuality: normalizeInteger(rawPayload.dietQuality || rawPayload.diet_quality),
    
    // Work-Related Health
    workplaceStressors: normalizeArray(rawPayload.workplaceStressors || rawPayload.workplace_stressors),
    physicalDemands: normalizeInteger(rawPayload.physicalDemands || rawPayload.physical_demands),
    workEnvironmentSatisfaction: normalizeInteger(rawPayload.workEnvironmentSatisfaction || rawPayload.work_environment_satisfaction),
    occupationalHealthConcerns: normalizeString(rawPayload.occupationalHealthConcerns || rawPayload.occupational_health_concerns),
    
    // Support and Resources
    healthGoals: normalizeString(rawPayload.healthGoals || rawPayload.health_goals),
    supportNeeded: normalizeArray(rawPayload.supportNeeded || rawPayload.support_needed),
    interestedPrograms: normalizeArray(rawPayload.interestedPrograms || rawPayload.interested_programs),
    
    // Additional Information
    additionalComments: normalizeString(rawPayload.additionalComments || rawPayload.additional_comments),
    
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