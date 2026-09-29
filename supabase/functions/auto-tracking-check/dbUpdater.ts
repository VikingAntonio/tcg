import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { TrackingStatus } from "./types.ts";

export async function dbUpdater(
  supabase: SupabaseClient,
  trackingId: string,
  newStatus: TrackingStatus
): Promise<void> {
  const now = new Date().toISOString();

  const updatePayload: Record<string, any> = {
    status: newStatus,
    last_checked_at: now
  };

  if (newStatus === 'completed') {
    updatePayload.completed_at = now;
  }

  const { error } = await supabase
    .from('tracking')
    .update(updatePayload)
    .eq('id', trackingId);

  if (error) {
    console.error(`Error updating tracking ID ${trackingId} in DB:`, error);
    throw new Error(`Failed to update tracking ${trackingId}: ${error.message}`);
  }
}
