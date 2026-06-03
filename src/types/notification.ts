export type AppNotificationType = 'lead_assigned';

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
