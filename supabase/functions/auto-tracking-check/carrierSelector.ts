import { CarrierStrategy } from "./types.ts";

const CARRIER_STRATEGIES: Record<string, CarrierStrategy> = {
  correos_de_mexico: {
    name: "Correos de México",
    defaultTrackingUrl: "https://www.correosdemexico.gob.mx/sslservicios/seguimientoenvio/seguimiento.aspx",
    buildTrackingUrl: (trackingNumber: string) =>
      `https://www.correosdemexico.gob.mx/sslservicios/seguimientoenvio/seguimiento.aspx?guia=${encodeURIComponent(trackingNumber)}`
  },
  estafeta: {
    name: "Estafeta",
    defaultTrackingUrl: "https://www.estafeta.com/Herramientas/Rastreo",
    buildTrackingUrl: (trackingNumber: string) =>
      `https://www.estafeta.com/Herramientas/Rastreo?trackingNumber=${encodeURIComponent(trackingNumber)}`
  },
  fedex: {
    name: "FedEx",
    defaultTrackingUrl: "https://www.fedex.com/fedextrack/",
    buildTrackingUrl: (trackingNumber: string) =>
      `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`
  },
  dhl: {
    name: "DHL",
    defaultTrackingUrl: "https://www.dhl.com/mx-es/home/rastreo.html",
    buildTrackingUrl: (trackingNumber: string) =>
      `https://www.dhl.com/mx-es/home/rastreo.html?tracking-id=${encodeURIComponent(trackingNumber)}`
  },
  paquetexpress: {
    name: "Paquetexpress",
    defaultTrackingUrl: "https://www.paquetexpress.com.mx/rastreo",
    buildTrackingUrl: (trackingNumber: string) =>
      `https://www.paquetexpress.com.mx/rastreo?tracking=${encodeURIComponent(trackingNumber)}`
  }
};

export function carrierSelector(carrierInput?: string): CarrierStrategy {
  if (!carrierInput) {
    return CARRIER_STRATEGIES.correos_de_mexico;
  }

  const normalized = carrierInput.toLowerCase().trim().replace(/[\s\-_]+/g, '_');

  if (normalized.includes('correos') || normalized.includes('mexpost') || normalized.includes('sepomex')) {
    return CARRIER_STRATEGIES.correos_de_mexico;
  }
  if (normalized.includes('estafeta')) {
    return CARRIER_STRATEGIES.estafeta;
  }
  if (normalized.includes('fedex')) {
    return CARRIER_STRATEGIES.fedex;
  }
  if (normalized.includes('dhl')) {
    return CARRIER_STRATEGIES.dhl;
  }
  if (normalized.includes('paquetexpress')) {
    return CARRIER_STRATEGIES.paquetexpress;
  }

  // Extensible default fallback strategy
  return {
    name: carrierInput || "Paquetería Genérica",
    defaultTrackingUrl: "https://www.google.com/search?q=rastreo+" + encodeURIComponent(carrierInput),
    buildTrackingUrl: (trackingNumber: string) =>
      `https://www.google.com/search?q=rastreo+${encodeURIComponent(carrierInput)}+${encodeURIComponent(trackingNumber)}`
  };
}
