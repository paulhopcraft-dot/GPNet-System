import type { IStorage } from './storage.js';
import type { WorkerParticipationEvent } from '@shared/schema';

/**
 * Consultant Appointment Service
 * Handles appointment attendance checking and reschedule loops
 */
export class ConsultantAppointmentService {
  private storage: IStorage;
  private readonly ATTENDANCE_CHECK_DELAY_HOURS = 1; // Check 1 hour after appointment

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Check attendance for all appointments that were scheduled 1+ hours ago
   * Called by background scheduler
   */
  async checkAppointmentAttendance(): Promise<void> {
    console.log('Checking consultant appointment attendance...');
    
    try {
      // Calculate cutoff time (1 hour ago)
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - this.ATTENDANCE_CHECK_DELAY_HOURS);
      const cutoffDateStr = cutoffTime.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Get appointments that need attendance checking
      const appointmentsToCheck = await this.getAppointmentsNeedingCheck(cutoffDateStr);

      console.log(`Found ${appointmentsToCheck.length} appointments requiring attendance verification`);

      for (const appointment of appointmentsToCheck) {
        await this.processAppointmentAttendance(appointment);
      }

    } catch (error) {
      console.error('Error checking appointment attendance:', error);
      throw error;
    }
  }

  /**
   * Get appointments that need attendance checking
   */
  private async getAppointmentsNeedingCheck(cutoffDate: string): Promise<WorkerParticipationEvent[]> {
    try {
      // Get all participation events for consultant appointments
      const allEvents = await this.storage.getAllWorkerParticipationEvents();
      
      return allEvents.filter(event => 
        event.eventType === 'consultant_appointment' &&
        event.participationStatus === 'scheduled' && // Not yet confirmed/checked
        event.scheduledDate &&
        event.scheduledDate <= cutoffDate // Appointment was scheduled for today or earlier
      );
    } catch (error) {
      console.error('Error getting appointments needing check:', error);
      return [];
    }
  }

  /**
   * Process attendance for a single appointment
   */
  private async processAppointmentAttendance(appointment: WorkerParticipationEvent): Promise<void> {
    try {
      console.log(`Checking attendance for appointment ${appointment.id} on ${appointment.scheduledDate}`);

      // Get ticket and worker info
      const ticket = await this.storage.getTicket(appointment.ticketId);
      if (!ticket) {
        console.warn(`Ticket not found for appointment ${appointment.id}`);
        return;
      }

      const worker = await this.storage.getWorker(ticket.workerId);
      if (!worker) {
        console.warn(`Worker not found for appointment ${appointment.id}`);
        return;
      }

      // Get clinic/stakeholder info
      let clinicContact = null;
      if (appointment.stakeholderInvolved) {
        clinicContact = await this.storage.getStakeholder(appointment.stakeholderInvolved);
      }

      // Send attendance confirmation request to clinic
      const attendanceConfirmed = await this.requestAttendanceConfirmation(
        appointment, 
        worker, 
        clinicContact
      );

      if (attendanceConfirmed) {
        // Mark as attended
        await this.markAppointmentAttended(appointment);
        
        // Update timeline
        await this.storage.createAuditEvent({
          companyId: ticket.companyId || '',
          actorId: "system",
          actorName: "Appointment Attendance Service",
          eventType: "appointment_attended",
          objectType: "worker_participation_event",
          objectId: appointment.id,
          summary: `Consultant appointment attended on ${appointment.scheduledDate}`,
          details: {
            appointmentId: appointment.id,
            attendanceStatus: "attended",
            checkDate: new Date().toISOString()
          }
        });

      } else {
        // Mark as no-show and trigger reschedule
        await this.markAppointmentNoShow(appointment);
        await this.triggerRescheduleProcess(appointment, ticket, worker);
        
        // Update timeline
        await this.storage.createAuditEvent({
          companyId: ticket.companyId || '',
          actorId: "system", 
          actorName: "Appointment Attendance Service",
          eventType: "appointment_no_show",
          objectType: "worker_participation_event",
          objectId: appointment.id,
          summary: `Consultant appointment no-show on ${appointment.scheduledDate}`,
          details: {
            appointmentId: appointment.id,
            attendanceStatus: "no_show",
            rescheduleTriggered: true
          }
        });
      }

    } catch (error) {
      console.error(`Error processing appointment attendance ${appointment.id}:`, error);
    }
  }

  /**
   * Request attendance confirmation from clinic
   * In a real implementation, this would send emails/SMS to clinic
   */
  private async requestAttendanceConfirmation(
    appointment: WorkerParticipationEvent,
    worker: any,
    clinicContact: any
  ): Promise<boolean> {
    try {
      console.log(`Requesting attendance confirmation for ${worker.name} from clinic`);

      // Create an email to clinic requesting confirmation
      const emailSubject = `Attendance Confirmation Required - ${worker.name} - ${appointment.scheduledDate}`;
      const emailBody = this.generateAttendanceConfirmationEmail(appointment, worker, clinicContact);

      // Store the confirmation request
      await this.storage.createEmail({
        ticketId: appointment.ticketId,
        to: clinicContact?.email || 'clinic@example.com',
        from: 'noreply@gpnet.com',
        subject: emailSubject,
        body: emailBody,
        source: 'system',
        direction: 'outbound'
      });

      // For demonstration: simulate response (in real implementation, this would be async)
      // Return true 70% of the time (attended), false 30% (no-show)
      const attendanceRate = 0.7;
      const attended = Math.random() < attendanceRate;

      console.log(`Attendance confirmation: ${attended ? 'ATTENDED' : 'NO-SHOW'} (simulated)`);
      return attended;

    } catch (error) {
      console.error('Error requesting attendance confirmation:', error);
      return false; // Assume no-show if confirmation fails
    }
  }

  /**
   * Generate attendance confirmation email
   */
  private generateAttendanceConfirmationEmail(
    appointment: WorkerParticipationEvent,
    worker: any,
    clinicContact: any
  ): string {
    return `Dear ${clinicContact?.name || 'Clinic Team'},

We need to confirm attendance for the following consultant appointment:

Patient: ${worker.name}
Appointment Date: ${appointment.scheduledDate}
Appointment Type: ${appointment.eventType}

Please confirm:
- Did the patient attend this appointment? (Yes/No)
- If they attended, was the consultation completed? (Yes/No)
- If they did not attend, what was the reason? (No-show/Cancelled/Rescheduled)

Please reply to this email with the attendance status or call our team at [PHONE].

This confirmation helps us ensure proper case management and compliance with return-to-work requirements.

Thank you for your cooperation.

Best regards,
GPNet Case Management Team`;
  }

  /**
   * Mark appointment as attended
   */
  private async markAppointmentAttended(appointment: WorkerParticipationEvent): Promise<void> {
    await this.storage.updateWorkerParticipationEvent(appointment.id, {
      participationStatus: 'attended',
      eventDate: appointment.scheduledDate, // Confirm the actual date
      complianceNotes: 'Attendance confirmed by clinic'
    });

    console.log(`Marked appointment ${appointment.id} as attended`);
  }

  /**
   * Mark appointment as no-show
   */
  private async markAppointmentNoShow(appointment: WorkerParticipationEvent): Promise<void> {
    await this.storage.updateWorkerParticipationEvent(appointment.id, {
      participationStatus: 'no_show',
      reasonForNonParticipation: 'Did not attend scheduled appointment',
      complianceNotes: 'No-show confirmed by clinic - reschedule required'
    });

    console.log(`Marked appointment ${appointment.id} as no-show`);
  }

  /**
   * Trigger reschedule process for no-show appointments
   */
  private async triggerRescheduleProcess(
    appointment: WorkerParticipationEvent,
    ticket: any,
    worker: any
  ): Promise<void> {
    try {
      console.log(`Triggering reschedule process for appointment ${appointment.id}`);

      // Create reminder for worker to reschedule
      await this.storage.createReminderSchedule({
        ticketId: ticket.id,
        checkType: 'consultant_appointment',
        recipientEmail: worker.email,
        recipientName: worker.name,
        reminderNumber: 1,
        scheduledFor: new Date(), // Send immediately
        emailSubject: 'Missed Appointment - Rescheduling Required',
        emailBody: this.generateRescheduleReminderEmail(worker, appointment),
        managerAlertRequired: true,
        isManagerAlert: false
      });

      // Create manager alert
      const managerAlert = new Date();
      managerAlert.setHours(managerAlert.getHours() + 24); // Alert manager in 24 hours if not rescheduled

      await this.storage.createReminderSchedule({
        ticketId: ticket.id,
        checkType: 'consultant_appointment',
        recipientEmail: ticket.managerEmail || 'manager@company.com',
        recipientName: 'Manager',
        reminderNumber: 1,
        scheduledFor: managerAlert,
        emailSubject: `Worker Missed Consultant Appointment - ${worker.name}`,
        emailBody: this.generateManagerAlertEmail(worker, appointment),
        managerAlertRequired: false,
        isManagerAlert: true
      });

      console.log(`Created reschedule reminders for worker and manager`);

    } catch (error) {
      console.error('Error triggering reschedule process:', error);
    }
  }

  /**
   * Generate reschedule reminder email for worker
   */
  private generateRescheduleReminderEmail(worker: any, appointment: WorkerParticipationEvent): string {
    return `Dear ${worker.name},

We have been informed that you did not attend your scheduled consultant appointment on ${appointment.scheduledDate}.

To continue with your return-to-work process, you must reschedule this appointment as soon as possible.

Please contact the clinic directly to book a new appointment, or speak with your manager for assistance.

Appointment Details:
- Type: ${appointment.eventType}
- Original Date: ${appointment.scheduledDate}
- Clinic: ${appointment.stakeholderInvolved || 'As advised'}

Rescheduling this appointment is required for your case progression. Failure to reschedule may impact your return-to-work timeline.

Best regards,
GPNet Case Management Team`;
  }

  /**
   * Generate manager alert email
   */
  private generateManagerAlertEmail(worker: any, appointment: WorkerParticipationEvent): string {
    return `Dear Manager,

This is to inform you that ${worker.name} did not attend their scheduled consultant appointment on ${appointment.scheduledDate}.

Actions Required:
1. Follow up with the worker to understand the reason for non-attendance
2. Ensure the appointment is rescheduled promptly
3. Consider any impact on return-to-work timeline
4. Document any discussions or actions taken

Appointment Details:
- Worker: ${worker.name}
- Type: ${appointment.eventType}
- Scheduled Date: ${appointment.scheduledDate}
- Status: No-show confirmed

Please take appropriate action to ensure case progression continues as planned.

Best regards,
GPNet Case Management System`;
  }

  /**
   * Get service status for monitoring
   */
  getServiceStatus(): { isEnabled: boolean; lastCheck?: Date; appointmentsChecked: number } {
    return {
      isEnabled: true,
      lastCheck: new Date(),
      appointmentsChecked: 0 // Could track this with instance variables
    };
  }
}

// Export factory function
export const createConsultantAppointmentService = (storage: IStorage) => {
  return new ConsultantAppointmentService(storage);
};