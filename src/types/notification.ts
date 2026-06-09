export type AppNotificationType =
  | 'lead_assigned'
  | 'admin_digest'
  | 'sales_digest'
  | 'task_due'
  | 'appointment_due'
  | 'pipeline_alert';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  userId: string;
  title: string;
  body: string;
  leadId?: string;
  url?: string;
  read: boolean;
  createdAt: string;
}
