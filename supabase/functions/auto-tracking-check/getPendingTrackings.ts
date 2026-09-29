import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { TrackingItem } from "./types.ts";

export async function getPendingTrackings(supabase: SupabaseClient): Promise<TrackingItem[]> {
  // Query tracking table strictly for received packages that are not yet completed
  const { data, error } = await supabase
    .from('tracking')
    .select('*')
    .eq('direction', 'received')
    .not('status', 'ilike', 'completed')
    .not('status', 'ilike', 'entregado');

  if (error) {
    console.error("Error fetching pending received trackings:", error);
    throw new Error(`Failed to fetch pending trackings: ${error.message}`);
  }

  if (!data) return [];

  // Filter items in JS to ensure non-completed received packages
  const pendingItems: TrackingItem[] = data.filter((item: TrackingItem) => {
    const isReceived = item.direction === 'received';
    const statusLower = (item.status || '').toLowerCase();
    const isCompleted = statusLower === 'completed' || statusLower === 'entregado' || statusLower === 'cancelado';
    return isReceived && !isCompleted;
  });

  return pendingItems;
}
