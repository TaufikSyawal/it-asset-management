import QRCode from "qrcode";
import { QRCodePayload } from "@/types";

/**
 * Generate standard QR payload for an asset.
 * Includes immutable ID, human-readable tag, company code, optional serial, and verification token.
 */
export function generateAssetQRPayload(asset: {
  id: string;
  assetTag: string;
  companyCode?: string;
  serialNumber?: string | null;
  qrCodeToken?: string | null;
}): string {
  const payload: QRCodePayload = {
    v: 1,
    id: asset.id,
    tag: asset.assetTag,
    co: asset.companyCode || "CORP",
    sn: asset.serialNumber || null,
    tok: asset.qrCodeToken || `QR-${asset.id}`,
  };
  return JSON.stringify(payload);
}

/**
 * Render QR code as high-resolution PNG data URL for direct embedding in printable labels & badges.
 */
export async function generateQRCodeDataURL(
  text: string,
  options?: {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  }
): Promise<string> {
  return QRCode.toDataURL(text, {
    width: options?.width || 600,
    margin: options?.margin ?? 1,
    color: {
      dark: "#000000", // pure high-contrast black
      light: "#ffffff",
    },
    errorCorrectionLevel: options?.errorCorrectionLevel || "M",
  });
}

/**
 * Render QR code as pure SVG string for lossless vector rendering in print engines.
 */
export async function generateQRCodeSVG(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });
}

/**
 * Parse any raw string captured by camera scanner, barcode reader, or manual input box.
 * Handles structured JSON payloads, web URLs, raw Asset IDs, Asset Tags, or QR Tokens.
 */
export function parseQRScanInput(raw: string): {
  assetId?: string;
  assetTag?: string;
  qrCodeToken?: string;
  isRawString: boolean;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { isRawString: true };
  }

  // 1. Try JSON payload
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed) as QRCodePayload;
      if (parsed.id || parsed.tag || parsed.tok) {
        return {
          assetId: parsed.id,
          assetTag: parsed.tag,
          qrCodeToken: parsed.tok,
          isRawString: false,
        };
      }
    } catch {
      // not valid JSON, proceed to other checks
    }
  }

  // 2. Try URL
  if (trimmed.includes("http://") || trimmed.includes("https://")) {
    try {
      const url = new URL(trimmed);
      const queryId = url.searchParams.get("id");
      const queryTag = url.searchParams.get("tag");
      const queryTok = url.searchParams.get("tok") || url.searchParams.get("token");
      const pathParts = url.pathname.split("/").filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];

      if (queryId || queryTag || queryTok) {
        return {
          assetId: queryId || undefined,
          assetTag: queryTag || undefined,
          qrCodeToken: queryTok || undefined,
          isRawString: false,
        };
      }
      if (lastPart) {
        return {
          assetId: lastPart,
          isRawString: false,
        };
      }
    } catch {
      // invalid url, continue
    }
  }

  // 3. Raw Token format: QR-XXX...
  if (trimmed.startsWith("QR-")) {
    return {
      qrCodeToken: trimmed,
      isRawString: false,
    };
  }

  // 4. Raw CUID or Asset Tag
  return {
    assetId: trimmed.length >= 24 && trimmed.startsWith("c") ? trimmed : undefined,
    assetTag: trimmed,
    isRawString: true,
  };
}

