import { supabaseAdmin } from '../config/supabase';

export class NotificationService {
  /**
   * Send a personal notification to a user.
   * Inserts into 'notifications' table, which triggers Supabase Realtime for the mobile client.
   */
  static async sendPersonalNotification(
    targetUserId: string,
    title: string,
    body: string,
    createdBy?: string
  ) {
    try {
      const payload: any = {
        title,
        body,
        type: 'personal',
        target_user_id: targetUserId,
        is_read: false,
      };

      // Only add created_by if it is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (createdBy && uuidRegex.test(createdBy)) {
        payload.created_by = createdBy;
      }

      const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('[NotificationService] Error inserting notification:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[NotificationService] Unexpected error sending notification:', err);
      return null;
    }
  }
}
