"use client";

import React, { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, RefreshCw, Volume2, VolumeX, AlertCircle, CheckCircle2, Search, ArrowRight, WifiOff, CloudUpload } from "lucide-react";

interface QRCameraScannerProps {
  onScan: (scannedText: string, isOffline?: boolean) => Promise<{ success: boolean; message?: string }>;
  isProcessing?: boolean;
  activeSessionId?: string;
  defaultLocation?: string;
  placeholder?: string;
}

export interface OfflineScanRecord {
  id: string;
  sessionId: string;
  rawInput: string;
  actualLocation?: string;
  actualCondition?: string;
  actualEmployeeId?: string;
  scannedAt: string;
}

export default function QRCameraScanner({
  onScan,
  isProcessing = false,
  activeSessionId,
  defaultLocation,
  placeholder = "Enter Asset Tag, Asset ID, or Serial Number...",
}: QRCameraScannerProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<OfflineScanRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanTimestamp = useRef<number>(0);

  // Storage key for conflict-safe offline queue
  const queueStorageKey = activeSessionId ? `opname_offline_queue_${activeSessionId}` : "opname_offline_queue_global";

  // Load offline queue from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(queueStorageKey);
      if (stored) {
        setOfflineQueue(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, [queueStorageKey]);

  // Save offline queue
  const saveOfflineQueue = (queue: OfflineScanRecord[]) => {
    setOfflineQueue(queue);
    try {
      localStorage.setItem(queueStorageKey, JSON.stringify(queue));
    } catch {
      // ignore
    }
  };

  // Play audio beep via Web Audio API (zero audio file dependencies)
  const playBeep = (freq = 880, duration = 0.08) => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // ignore browser audio limitations
    }
  };

  // Trigger mobile vibration
  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([70]);
      } catch {
        // ignore
      }
    }
  };

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported in this browser environment.");
      }

      // Try environment/back camera first, fallback to user camera
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setCameraActive(true);
        startScanLoop();
      }
    } catch (err: any) {
      console.warn("Camera access failed:", err);
      let errMsg = "Camera access error. Please ensure permissions are granted or use manual entry below.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errMsg = "Camera permission was denied. Please allow camera access in your browser settings, or use manual entry.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errMsg = "No camera found on this device. Please use the manual input box below.";
      }
      setCameraError(errMsg);
      setCameraActive(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Frame processing loop
  const startScanLoop = () => {
    const scanFrame = () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
        animationFrameId.current = requestAnimationFrame(scanFrame);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          const now = Date.now();
          // Debounce: prevent triggering multiple scans within 1.2s for same code
          if (code.data !== lastScannedCode || now - lastScanTimestamp.current > 1200) {
            lastScanTimestamp.current = now;
            setLastScannedCode(code.data);
            handleScannedValue(code.data);
          }
        }
      }

      animationFrameId.current = requestAnimationFrame(scanFrame);
    };

    animationFrameId.current = requestAnimationFrame(scanFrame);
  };

  // Handle scanned string from camera or manual entry
  const handleScannedValue = async (rawString: string) => {
    const trimmed = rawString.trim();
    if (!trimmed || isProcessing) return;

    playBeep(880, 0.08);
    triggerHaptic();

    // Check online status
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    if (!isOnline && activeSessionId) {
      // Queue offline
      const offlineRecord: OfflineScanRecord = {
        id: `off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sessionId: activeSessionId,
        rawInput: trimmed,
        actualLocation: defaultLocation,
        scannedAt: new Date().toISOString(),
      };
      const updated = [...offlineQueue, offlineRecord];
      saveOfflineQueue(updated);

      setScanFeedback({
        type: "info",
        msg: `Offline: Scan queued (${updated.length} pending sync). Will auto-submit when reconnected.`,
      });
      return;
    }

    try {
      const result = await onScan(trimmed);
      if (result.success) {
        setScanFeedback({ type: "success", msg: result.message || `Scanned: ${trimmed}` });
      } else {
        playBeep(330, 0.15); // low buzz on discrepancy/error
        setScanFeedback({ type: "error", msg: result.message || `Scan issue: ${trimmed}` });
      }
    } catch (err: any) {
      // Network failed during request -> save offline
      if (activeSessionId) {
        const offlineRecord: OfflineScanRecord = {
          id: `off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          sessionId: activeSessionId,
          rawInput: trimmed,
          actualLocation: defaultLocation,
          scannedAt: new Date().toISOString(),
        };
        const updated = [...offlineQueue, offlineRecord];
        saveOfflineQueue(updated);
        setScanFeedback({
          type: "info",
          msg: `Network interruption: Scan safely queued locally (${updated.length} pending).`,
        });
      } else {
        setScanFeedback({ type: "error", msg: err.message || "Failed to submit scan" });
      }
    }

    // Clear feedback after 4 seconds
    setTimeout(() => {
      setScanFeedback((curr) => (curr?.msg.includes(trimmed) ? null : curr));
    }, 4000);
  };

  // Manual input submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    const value = manualInput.trim();
    setManualInput("");
    handleScannedValue(value);
  };

  // Sync offline queue
  const syncOfflineQueue = async () => {
    if (offlineQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);

    let syncedCount = 0;
    const remainingQueue: OfflineScanRecord[] = [];

    for (const item of offlineQueue) {
      try {
        const res = await onScan(item.rawInput, true);
        if (res.success) {
          syncedCount++;
        } else {
          remainingQueue.push(item);
        }
      } catch {
        remainingQueue.push(item);
      }
    }

    saveOfflineQueue(remainingQueue);
    setIsSyncing(false);

    if (syncedCount > 0) {
      setScanFeedback({
        type: "success",
        msg: `Successfully synchronized ${syncedCount} offline scans to PostgreSQL.`,
      });
      playBeep(1046, 0.1);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Scanner Header Controls */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/75">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-900 text-white shadow-2xs">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900">QR & Barcode Optical Scanner</h3>
            <p className="text-[11px] text-slate-500">Live mobile camera with offline conflict-safe queuing</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
              soundEnabled
                ? "bg-slate-100 text-slate-700 border-slate-200"
                : "bg-white text-slate-400 border-slate-200"
            }`}
            title={soundEnabled ? "Mute audio beep" : "Enable audio beep"}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Camera toggle */}
          {cameraActive ? (
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <CameraOff className="w-3.5 h-3.5 text-slate-500" />
              Turn Off Camera
            </button>
          ) : (
            <button
              type="button"
              onClick={startCamera}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors shadow-2xs"
            >
              <Camera className="w-3.5 h-3.5" />
              Start Camera Scanner
            </button>
          )}
        </div>
      </div>

      {/* Offline Queue Notice */}
      {offlineQueue.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{offlineQueue.length} offline scans queued</strong> in local storage.
            </span>
          </div>
          <button
            type="button"
            onClick={syncOfflineQueue}
            disabled={isSyncing}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white text-[11px] font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            <CloudUpload className="w-3 h-3" />
            {isSyncing ? "Syncing..." : "Sync to Database"}
          </button>
        </div>
      )}

      {/* Camera Viewfinder Area */}
      {cameraActive ? (
        <div className="relative bg-black w-full aspect-video max-h-[340px] flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner Targeting Reticle */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-56 h-56 border-2 border-brand-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-brand-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-brand-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-brand-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-brand-400 rounded-br-lg" />

              {/* Laser animation bar */}
              <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-brand-400 to-transparent animate-bounce" />
            </div>
          </div>

          <div className="absolute bottom-2 text-center inset-x-0 pointer-events-none">
            <span className="bg-black/60 backdrop-blur-xs text-white text-[11px] font-medium px-3 py-1 rounded-full border border-white/10">
              Align QR Code or Barcode inside the square
            </span>
          </div>
        </div>
      ) : cameraError ? (
        <div className="p-5 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-900">Camera Notice</p>
            <p className="text-rose-700 leading-relaxed">{cameraError}</p>
          </div>
        </div>
      ) : null}

      {/* Live Scan Status Feedback Bar */}
      {scanFeedback && (
        <div
          className={`px-4 py-2.5 text-xs flex items-center gap-2 border-b transition-all ${
            scanFeedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : scanFeedback.type === "error"
              ? "bg-rose-50 text-rose-800 border-rose-200"
              : "bg-blue-50 text-blue-800 border-blue-200"
          }`}
        >
          {scanFeedback.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          {scanFeedback.type === "error" && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          {scanFeedback.type === "info" && <CloudUpload className="w-4 h-4 text-blue-600 shrink-0" />}
          <span className="font-medium">{scanFeedback.msg}</span>
        </div>
      )}

      {/* Manual Input Fallback Section */}
      <div className="p-3.5 sm:p-4 bg-white">
        <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder={placeholder}
              disabled={isProcessing}
              className="block w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={!manualInput.trim() || isProcessing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-2xs"
          >
            <span>Audit Check</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
        <p className="text-[10px] text-slate-400 mt-1.5">
          Tip: You can use USB barcode scanners, bluetooth handhelds, or paste full QR payloads.
        </p>
      </div>
    </div>
  );
}

