import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { NotificationPayload, TrackingItem } from "./types.ts";

export async function notifier(
  supabase: SupabaseClient,
  unnotifiedItems: TrackingItem[]
): Promise<NotificationPayload[]> {
  if (!unnotifiedItems || unnotifiedItems.length === 0) {
    return [];
  }

  // Group items by user_id
  const userMap = new Map<string, TrackingItem[]>();
  for (const item of unnotifiedItems) {
    const list = userMap.get(item.user_id) || [];
    list.push(item);
    userMap.set(item.user_id, list);
  }

  const notifications: NotificationPayload[] = [];
  const now = new Date().toISOString();

  for (const [userId, items] of userMap.entries()) {
    const count = items.length;
    const message = count === 1
      ? "📦 Tienes 1 paquete listo para recoger."
      : `📦 Tienes ${count} paquetes listos para recoger.`;

    const trackingIds = items.map(i => i.id);

    notifications.push({
      userId,
      readyCount: count,
      message,
      trackingIds
    });

    // 1. Mark packages as notified in tracking table
    const { error: updateErr } = await supabase
      .from('tracking')
      .update({
        is_notified: true,
        notified_at: now
      })
      .in('id', trackingIds);

    if (updateErr) {
      console.error(`Error marking packages as notified for user ${userId}:`, updateErr);
    }

    // 2. Persist notification into learn_items as proactive alert for user dashboard/chatbot
    try {
      await supabase.from('learn_items').insert([{
        user_id: userId,
        title: "📦 Paquetes Listos para Recoger",
        content: message,
        category: "notificación",
        type: "alerta_tracking",
        is_public: false,
        created_at: now
      }]);
    } catch (e) {
      console.warn("Could not insert notification into learn_items:", e);
    }
  }

  return notifications;
}
