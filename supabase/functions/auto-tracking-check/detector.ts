import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { TrackingItem } from "./types.ts";

export async function detector(supabase: SupabaseClient): Promise<TrackingItem[]> {
  const { data, error } = await supabase
    .from('tracking')
    .select('*')
    .eq('status', 'ready_for_pickup')
    .or('is_notified.eq.false,is_notified.is.null');

  if (error) {
    console.error("Error detecting packages ready for pickup:", error);
    return [];
  }

  return (data as TrackingItem[]) || [];
}
