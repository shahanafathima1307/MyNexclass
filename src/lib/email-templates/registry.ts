/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentType } from "react";
import { template as classInviteTemplate } from "./class-invite";
import { template as bookingConfirmationTemplate } from "./booking-confirmation";
import { template as tutorBookingAlertTemplate } from "./tutor-booking-alert";
import { template as classReminderTemplate } from "./class-reminder";
import { template as assignmentNotificationTemplate } from "./assignment-notification";
import { template as referralRewardTemplate } from "./referral-reward";
import { template as approvalStatusTemplate } from "./approval-status";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  "class-invite": classInviteTemplate,
  "booking-confirmation": bookingConfirmationTemplate,
  "tutor-booking-alert": tutorBookingAlertTemplate,
  "class-reminder": classReminderTemplate,
  "assignment-notification": assignmentNotificationTemplate,
  "referral-reward": referralRewardTemplate,
  "approval-status": approvalStatusTemplate,
};
