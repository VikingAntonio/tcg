export type PackageDirection = 'sent' | 'received';

export type TrackingStatus =
  | 'pending'
  | 'in_transit'
  | 'ready_for_pickup'
  | 'completed'
  | 'returned';

export interface TrackingItem {
  id: string;
  user_id: string;
  guia?: string;
  tracking_number?: string;
  paqueteria?: string;
  carrier?: string;
  nombre_cliente?: string;
  seller_name?: string;
  tracking_url?: string | null;
  direction?: PackageDirection;
  status: string;
  last_checked_at?: string | null;
  completed_at?: string | null;
  is_notified?: boolean;
  notified_at?: string | null;
  created_at?: string;
}

export interface CarrierStrategy {
  name: string;
  defaultTrackingUrl: string;
  buildTrackingUrl: (trackingNumber: string) => string;
}

export interface ScrapeResult {
  success: boolean;
  rawText: string;
  trackingNumber: string;
  carrier: string;
  error?: string;
}

export interface InterpretationResult {
  status: TrackingStatus;
  summary: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ProcessedTrackingResult {
  id: string;
  trackingNumber: string;
  carrier: string;
  previousStatus: string;
  newStatus: TrackingStatus;
  isNewReadyForPickup: boolean;
  error?: string;
}

export interface NotificationPayload {
  userId: string;
  readyCount: number;
  message: string;
  trackingIds: string[];
}
