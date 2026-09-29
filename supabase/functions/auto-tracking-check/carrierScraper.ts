import { CarrierStrategy, ScrapeResult } from "./types.ts";

export async function carrierScraper(
  trackingNumber: string,
  strategy: CarrierStrategy,
  overrideUrl?: string | null
): Promise<ScrapeResult> {
  const carrierKey = strategy.name.toLowerCase();

  // 1. FedEx API Handler
  if (carrierKey.includes("fedex")) {
    try {
      const fedexApiUrl = "https://www.fedex.com/trackingCal/track";
      const params = new URLSearchParams();
      params.append("data", JSON.stringify({
        TrackPackagesRequest: {
          appType: "WTRACK",
          appVersion: "1",
          supportBooleans: true,
          supportHTML: true,
          trackingInfoList: [{ trackingNumberInfo: { trackingNumber } }]
        }
      }));
      params.append("action", "trackpackages");
      params.append("format", "json");

      const fedexRes = await fetch(fedexApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        body: params.toString()
      });

      if (fedexRes.ok) {
        const json = await fedexRes.json();
        const packageList = json?.TrackPackagesResponse?.packageList;
        if (packageList && packageList.length > 0) {
          const pkg = packageList[0];
          const rawInfo = `Estado FedEx: ${pkg.keyStatus || ''} - ${pkg.statusWithDetails || ''} - Destino: ${pkg.destinationLocation || ''} - Entrega estimada: ${pkg.displayEstDeliveryDateTime || ''} - Eventos: ${(pkg.scanEventList || []).map((e: any) => e.scanDetails).join(', ')}`;
          return {
            success: true,
            rawText: rawInfo,
            trackingNumber,
            carrier: strategy.name
          };
        }
      }
    } catch (e) {
      console.warn("FedEx API fetch failed, falling back to web fetch:", e);
    }
  }

  // 2. Estafeta Form/API Handler
  if (carrierKey.includes("estafeta")) {
    try {
      const estafetaUrl = "https://www.estafeta.com/Herramientas/Rastreo";
      const res = await fetch(estafetaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        body: `waybill=${encodeURIComponent(trackingNumber)}`
      });
      if (res.ok) {
        const html = await res.text();
        const cleaned = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (cleaned.length > 100) {
          return {
            success: true,
            rawText: cleaned.slice(0, 4000),
            trackingNumber,
            carrier: strategy.name
          };
        }
      }
    } catch (e) {
      console.warn("Estafeta POST failed, falling back to default fetch:", e);
    }
  }

  // 3. Correos de México Form POST Handler
  if (carrierKey.includes("correos")) {
    try {
      const correosUrl = "https://www.correosdemexico.gob.mx/sslservicios/seguimientoenvio/seguimiento.aspx";
      // First fetch GET to acquire ASP.NET WebForm ViewState parameters
      const getRes = await fetch(correosUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      if (getRes.ok) {
        const getHtml = await getRes.text();
        const viewStateMatch = getHtml.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
        const eventValidationMatch = getHtml.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/);

        const viewState = viewStateMatch ? viewStateMatch[1] : "";
        const eventValidation = eventValidationMatch ? eventValidationMatch[1] : "";

        const formParams = new URLSearchParams();
        if (viewState) formParams.append("__VIEWSTATE", viewState);
        if (eventValidation) formParams.append("__EVENTVALIDATION", eventValidation);
        formParams.append("txtGuia", trackingNumber);
        formParams.append("btnBuscar", "Buscar");

        const postRes = await fetch(correosUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          },
          body: formParams.toString()
        });

        if (postRes.ok) {
          const postHtml = await postRes.text();
          const cleaned = postHtml
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (cleaned.length > 50) {
            return {
              success: true,
              rawText: cleaned.slice(0, 4000),
              trackingNumber,
              carrier: strategy.name
            };
          }
        }
      }
    } catch (e) {
      console.warn("Correos de Mexico WebForm POST failed:", e);
    }
  }

  // 4. Default direct fetch fallback
  const targetUrl = overrideUrl || strategy.buildTrackingUrl(trackingNumber);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7"
    };

    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (response.ok) {
      const htmlContent = await response.text();
      const cleanedText = htmlContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (cleanedText.length > 50) {
        return {
          success: true,
          rawText: cleanedText.slice(0, 4000),
          trackingNumber,
          carrier: strategy.name
        };
      }
    }
  } catch (err: any) {
    console.warn("Direct GET fetch failed:", err?.message);
  }

  // 5. Google / Search fallback if HTML is sparse
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=rastreo+${encodeURIComponent(strategy.name)}+${encodeURIComponent(trackingNumber)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    if (searchRes.ok) {
      const searchHtml = await searchRes.text();
      const cleanedSearch = searchHtml
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        success: true,
        rawText: cleanedSearch.slice(0, 4000),
        trackingNumber,
        carrier: strategy.name
      };
    }
  } catch (e) {
    console.warn("Search fallback failed:", e);
  }

  return {
    success: false,
    rawText: `No se pudo obtener información para la guía ${trackingNumber} en ${strategy.name}`,
    trackingNumber,
    carrier: strategy.name,
    error: "Scrape Failed"
  };
}
