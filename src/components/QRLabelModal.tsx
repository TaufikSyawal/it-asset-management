"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AssetDTO } from "@/types";
import { generateAssetQRPayload, generateQRCodeDataURL } from "@/lib/qrcode";
import { Printer, X, FileText, LayoutGrid, Check, Sparkles, AlertCircle } from "lucide-react";

interface QRLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: AssetDTO[];
  initialFormat?: "50x25" | "60x40";
}

interface AssetWithQR {
  asset: AssetDTO;
  qrDataUrl: string;
}

export default function QRLabelModal({
  isOpen,
  onClose,
  assets,
  initialFormat = "50x25",
}: QRLabelModalProps) {
  const [format, setFormat] = useState<"50x25" | "60x40">(initialFormat);
  const [printTarget, setPrintTarget] = useState<"thermal" | "a4">(
    assets.length === 1 ? "thermal" : "a4"
  );
  const [labelData, setLabelData] = useState<AssetWithQR[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isOpen || assets.length === 0) return;

    let isMounted = true;
    setLoading(true);

    async function generateCodes() {
      try {
        const results: AssetWithQR[] = [];
        for (const asset of assets) {
          const payload = generateAssetQRPayload({
            id: asset.id,
            assetTag: asset.assetTag,
            companyCode: asset.company?.code,
            serialNumber: asset.serialNumber,
            qrCodeToken: asset.qrCodeToken,
          });
          // High-resolution 600px square QR with high contrast black/white and quiet zone
          const qrDataUrl = await generateQRCodeDataURL(payload, {
            width: format === "50x25" ? 500 : 700,
            margin: 1,
            errorCorrectionLevel: "M",
          });
          results.push({ asset, qrDataUrl });
        }
        if (isMounted) {
          setLabelData(results);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to generate QR labels:", err);
        if (isMounted) setLoading(false);
      }
    }

    generateCodes();

    return () => {
      isMounted = false;
    };
  }, [isOpen, assets, format]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  // Helper to render a single label card (used for both on-screen preview and print portal)
  const renderLabelContent = (asset: AssetDTO, qrDataUrl: string, isPrint = false) => {
    const isSmall = format === "50x25";

    return (
      <div
        key={asset.id}
        className={`label-item ${isSmall ? "label-50x25" : "label-60x40"} ${
          !isPrint ? "shadow-xs border border-slate-300 rounded-md bg-white hover:border-brand-400 transition-colors" : ""
        }`}
      >
        {/* Left: Perfectly Square 1:1 QR Code */}
        <div className={`qr-box ${isSmall ? "qr-50x25" : "qr-60x40"}`}>
          <img
            src={qrDataUrl}
            alt={`QR for ${asset.assetTag}`}
            className="qr-img"
          />
        </div>

        {/* Right: Clean, Uncluttered Identification */}
        <div className={`text-box ${isSmall ? "text-50x25" : "text-60x40"}`}>
          {/* Company Code Badge */}
          <div className="company-badge">
            <span className="company-pill">{asset.company?.code || "CORP"}</span>
          </div>

          {/* Prominent Bold Monospace Asset Tag */}
          <div className="asset-tag" title={asset.assetTag}>
            {asset.assetTag}
          </div>

          {/* Short Device Name */}
          <div className="asset-name" title={asset.assetName}>
            {asset.assetName}
          </div>

          {!isSmall && (
            <div className="label-sub">
              {asset.category} • IT ASSET
            </div>
          )}
        </div>
      </div>
    );
  };

  // Dedicated Print Portal rendered directly into document.body to avoid parent flexbox constraints
  const printPortal = mounted && typeof document !== "undefined"
    ? createPortal(
        <div
          id="it-asset-print-portal"
          className={printTarget === "thermal" ? "print-portal-thermal" : "print-portal-a4"}
        >
          {labelData.map(({ asset, qrDataUrl }) => renderLabelContent(asset, qrDataUrl, true))}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {/* Global Print Stylesheet specifically targeting #it-asset-print-portal */}
      <style jsx global>{`
        /* ========================================================= */
        /* SCREEN DISPLAY RULES                                      */
        /* ========================================================= */
        @media screen {
          #it-asset-print-portal {
            display: none !important;
          }
        }

        /* ========================================================= */
        /* PRINT MEDIA RULES (Browser Print Preview & Save as PDF)    */
        /* ========================================================= */
        @media print {
          /* 1. Reset Root Document */
          html, body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 2. Hide everything in document.body except the print portal */
          body > *:not(#it-asset-print-portal) {
            display: none !important;
            visibility: hidden !important;
          }

          /* 3. Make Print Portal Active */
          #it-asset-print-portal {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          /* 4. Page Dimensions & Printer Modes */
          ${printTarget === "thermal" && format === "50x25"
            ? `
            @page {
              size: 50mm 25mm !important;
              margin: 0 !important;
            }
            .print-portal-thermal .label-item {
              page-break-after: always !important;
              break-after: page !important;
              margin: 0 !important;
            }
            `
            : ""}

          ${printTarget === "thermal" && format === "60x40"
            ? `
            @page {
              size: 60mm 40mm !important;
              margin: 0 !important;
            }
            .print-portal-thermal .label-item {
              page-break-after: always !important;
              break-after: page !important;
              margin: 0 !important;
            }
            `
            : ""}

          ${printTarget === "a4"
            ? `
            @page {
              size: A4 portrait !important;
              margin: 8mm !important;
            }
            .print-portal-a4 {
              display: flex !important;
              flex-direction: row !important;
              flex-wrap: wrap !important;
              align-content: flex-start !important;
              justify-content: flex-start !important;
              gap: 3mm !important;
              width: 194mm !important;
              margin: 0 auto !important;
            }
            .print-portal-a4 .label-item {
              page-break-after: auto !important;
              break-after: auto !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              margin: 0 !important;
            }
            `
            : ""}

          /* 5. Precise Physical Label Styles */
          .label-50x25 {
            width: 50mm !important;
            height: 25mm !important;
            min-width: 50mm !important;
            min-height: 25mm !important;
            max-width: 50mm !important;
            max-height: 25mm !important;
            padding: 1.5mm !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 2mm !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 1mm !important;
            background: #ffffff !important;
            overflow: hidden !important;
            flex-shrink: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .label-60x40 {
            width: 60mm !important;
            height: 40mm !important;
            min-width: 60mm !important;
            min-height: 40mm !important;
            max-width: 60mm !important;
            max-height: 40mm !important;
            padding: 2.5mm !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 2.5mm !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 1.5mm !important;
            background: #ffffff !important;
            overflow: hidden !important;
            flex-shrink: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* 6. Strict 1:1 QR Square Sizing */
          .qr-50x25 {
            width: 21mm !important;
            height: 21mm !important;
            min-width: 21mm !important;
            min-height: 21mm !important;
            max-width: 21mm !important;
            max-height: 21mm !important;
            aspect-ratio: 1 / 1 !important;
            flex-shrink: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .qr-60x40 {
            width: 34mm !important;
            height: 34mm !important;
            min-width: 34mm !important;
            min-height: 34mm !important;
            max-width: 34mm !important;
            max-height: 34mm !important;
            aspect-ratio: 1 / 1 !important;
            flex-shrink: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .qr-img {
            width: 100% !important;
            height: 100% !important;
            aspect-ratio: 1 / 1 !important;
            object-fit: contain !important;
            display: block !important;
          }

          /* 7. Typography & Overflow Protection */
          .text-50x25 {
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            min-width: 0 !important;
            width: 24mm !important;
            overflow: hidden !important;
            flex: 1 1 auto !important;
          }

          .text-60x40 {
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            min-width: 0 !important;
            width: 20mm !important;
            overflow: hidden !important;
            flex: 1 1 auto !important;
          }

          .company-badge {
            display: flex !important;
            align-items: center !important;
            margin-bottom: 0.5mm !important;
          }

          .company-pill {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
            font-size: 6.5pt !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            padding: 0.2mm 1mm !important;
            background: #0f172a !important;
            color: #ffffff !important;
            border-radius: 0.5mm !important;
            line-height: 1.1 !important;
            display: inline-block !important;
          }

          .asset-tag {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
            font-size: 8pt !important;
            font-weight: 900 !important;
            color: #000000 !important;
            line-height: 1.15 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            margin-bottom: 0.5mm !important;
          }

          .label-60x40 .asset-tag {
            font-size: 9.5pt !important;
            margin-bottom: 0.8mm !important;
          }

          .asset-name {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            font-size: 6pt !important;
            font-weight: 600 !important;
            color: #334155 !important;
            line-height: 1.15 !important;
            overflow: hidden !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
          }

          .label-60x40 .asset-name {
            font-size: 7pt !important;
            -webkit-line-clamp: 3 !important;
          }

          .label-sub {
            font-family: ui-monospace, monospace !important;
            font-size: 5.5pt !important;
            font-weight: 600 !important;
            color: #64748b !important;
            margin-top: 1mm !important;
            text-transform: uppercase !important;
          }
        }
      `}</style>

      {/* Render Portal into document.body */}
      {printPortal}

      {/* On-Screen Interactive Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 border border-brand-100">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  QR Asset Label Printer
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {assets.length} {assets.length === 1 ? "Asset" : "Assets"}
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Calibrated millimeter dimensions for thermal roll printers and A4 sticker sheets
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Configuration Toolbar */}
          <div className="px-5 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4 text-xs">
            {/* Format Selection */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Physical Dimensions:</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                <button
                  type="button"
                  onClick={() => setFormat("50x25")}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    format === "50x25"
                      ? "bg-white text-brand-600 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  50 × 25 mm (Compact)
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("60x40")}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    format === "60x40"
                      ? "bg-white text-brand-600 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  60 × 40 mm (Large Badge)
                </button>
              </div>
            </div>

            {/* Target Printer Configuration */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Printer Setup:</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                <button
                  type="button"
                  onClick={() => setPrintTarget("thermal")}
                  className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                    printTarget === "thermal"
                      ? "bg-white text-brand-600 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Thermal Roll (1/page)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintTarget("a4")}
                  className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                    printTarget === "a4"
                      ? "bg-white text-brand-600 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  A4 Sticker Sheet (Grid)
                </button>
              </div>
            </div>
          </div>

          {/* On-Screen Preview Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-medium">Generating high-contrast 1:1 square QR codes...</p>
              </div>
            ) : labelData.length === 0 ? (
              <div className="text-center py-16 text-xs text-slate-500">No assets selected for printing.</div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center justify-between">
                  <span>
                    Previewing <strong>{format}</strong> labels calibrated for{" "}
                    <strong>{printTarget === "thermal" ? "Continuous Thermal Roll" : "A4 Sticker Sheet"}</strong>.
                    Detailed specs (CPU, RAM, Serial) remain retrievable upon scanning.
                  </span>
                  <span className="font-mono text-[11px] text-blue-700 font-bold shrink-0 ml-2">
                    1:1 Square QR Verified
                  </span>
                </div>

                {/* Preview Canvas */}
                <div className="flex flex-wrap gap-4 items-start justify-center p-4 bg-white/60 rounded-2xl border border-slate-200">
                  {labelData.map(({ asset, qrDataUrl }) => (
                    <div
                      key={asset.id}
                      style={{
                        width: format === "50x25" ? "240px" : "290px",
                        height: format === "50x25" ? "120px" : "190px",
                      }}
                      className="bg-white border-2 border-slate-300 rounded-xl p-3 shadow-sm flex items-center gap-3 transition-transform hover:scale-102"
                    >
                      {/* Left: Square QR Code */}
                      <div
                        style={{
                          width: format === "50x25" ? "95px" : "150px",
                          height: format === "50x25" ? "95px" : "150px",
                        }}
                        className="aspect-square shrink-0 bg-white border border-slate-200 rounded-lg p-1 flex items-center justify-center"
                      >
                        <img
                          src={qrDataUrl}
                          alt={`QR for ${asset.assetTag}`}
                          className="w-full h-full object-contain aspect-square"
                        />
                      </div>

                      {/* Right: Text Specifications */}
                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <div>
                          <span className="font-mono text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-900 text-white inline-block">
                            {asset.company?.code || "CORP"}
                          </span>
                        </div>
                        <div className="font-mono font-black text-slate-900 text-xs sm:text-sm truncate mt-1 leading-tight">
                          {asset.assetTag}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-700 truncate mt-0.5 leading-snug">
                          {asset.assetName}
                        </div>
                        <div className="text-[9px] text-slate-400 uppercase font-mono mt-1">
                          {asset.category}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span>
                {printTarget === "thermal"
                  ? "Thermal mode will emit 1 page per label. Set destination printer margins to None."
                  : "A4 sheet mode will arrange labels in an aligned multi-label grid."}
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={loading || labelData.length === 0}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2 bg-brand-600 text-white text-xs font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                <Printer className="w-4 h-4" />
                Print Labels / Save PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
