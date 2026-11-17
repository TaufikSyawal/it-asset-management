"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, ArrowRight, RefreshCw } from "lucide-react";

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ExcelImportModal({
  isOpen,
  onClose,
  onSuccess,
}: ExcelImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setPreviewData(null);
    setImportResult(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("dryRun", "true");

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse Excel file");
      }

      setPreviewData(data);
    } catch (err: any) {
      setError(err.message || "Failed to process Excel spreadsheet");
    } finally {
      setLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dryRun", "false");

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Batch import failed");
      }

      setImportResult(data);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to import into PostgreSQL");
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleTemplate = () => {
    const sampleHeaders = [
      {
        "Asset Tag": "GMD-LPT-101",
        "Asset Name": "Dell Latitude 5430",
        "Company": "GMD",
        "Category": "Laptop",
        "Model": "Latitude 5430",
        "CPU": "Intel Core i5-1245U",
        "RAM": "16 GB DDR4",
        "Serial Number": "890XBC2",
        "MAC Address": "A0:B1:C2:D3:E4:F5",
        "Status": "In Use",
        "Physical Condition": "Good",
        "Assigned Employee": "Aditya Putra",
        "Location": "HQ Floor 2",
        "Purchase Date": "2023-09-15",
        "Purchase Cost": "16500000",
        "Useful Life": "36",
        "Laptop Code": "GMD-POOL-09",
        "Laptop Account": "LOCAL-USER",
        "Username": "aditya.p",
        "Notes": "Corporate standard laptop",
      },
      {
        "Asset Tag": "GMC-LPT-055",
        "Asset Name": "ThinkPad T14s",
        "Company": "GMC",
        "Category": "Laptop",
        "Model": "20WM007BUS",
        "CPU": "AMD Ryzen 7 PRO 5850U",
        "RAM": "16 GB LPDDR4x",
        "Serial Number": "", // Demonstrates optional serial number
        "MAC Address": "",
        "Status": "Available",
        "Physical Condition": "Excellent",
        "Assigned Employee": "",
        "Location": "GMC Warehouse Rack 1",
        "Purchase Date": "2023-10-01",
        "Purchase Cost": "19000000",
        "Useful Life": "36",
        "Laptop Code": "GMC-LPT-55",
        "Laptop Account": "GMC-ADMIN",
        "Username": "",
        "Notes": "Unassigned stock",
      },
      {
        "Asset Tag": "TEL-DSK-020",
        "Asset Name": "Lenovo ThinkCentre M70q",
        "Company": "TEL",
        "Category": "Desktop",
        "Model": "11MY001KUS",
        "CPU": "Intel Core i7-12700T",
        "RAM": "32 GB DDR4",
        "Serial Number": "MJ0EX891",
        "MAC Address": "74:D4:35:E1:90:02",
        "Status": "In Use",
        "Physical Condition": "Good",
        "Assigned Employee": "Fajar Hidayat",
        "Location": "Data Center TEL",
        "Purchase Date": "2023-04-18",
        "Purchase Cost": "22000000",
        "Useful Life": "48",
        "Laptop Code": "TEL-SRV-01",
        "Laptop Account": "TEL-ADMIN",
        "Username": "fajar.h",
        "Notes": "NOC diagnostic terminal",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleHeaders);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "IT_Asset_Inventory_Template.xlsx");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Excel Inventory Batch Importer
              </h3>
              <p className="text-xs text-slate-500">
                Parse existing spreadsheets into PostgreSQL • Auto-flag duplicate tags
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {importResult ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Import Completed Successfully</h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                {importResult.message} All imported assets and employees have been recorded into the PostgreSQL database.
              </p>
              <div className="pt-4">
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  Return to Inventory
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-200 hover:border-brand-500 rounded-2xl p-6 text-center transition-colors bg-slate-50/50">
                <input
                  type="file"
                  id="excelFileInput"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileChange(f);
                  }}
                />
                <label htmlFor="excelFileInput" className="cursor-pointer block">
                  <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center mx-auto text-slate-600 mb-3">
                    <Upload className="w-6 h-6 text-brand-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-800 block">
                    {file ? file.name : "Click or drag your Excel file here (.xlsx, .xls)"}
                  </span>
                  <span className="text-xs text-slate-500 mt-1 block">
                    Maps 19 standard columns: Tag, Name, Company, Specs, S/N, Status, Employee, etc.
                  </span>
                </label>

                <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={downloadSampleTemplate}
                    className="text-xs text-brand-600 hover:text-brand-800 font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Standard Excel Template
                  </button>
                </div>
              </div>

              {/* Dry-Run Validation Summary */}
              {previewData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-slate-500 block">Total Rows Found</span>
                      <span className="text-lg font-bold text-slate-900">{previewData.totalRows}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-emerald-700 block">Valid Rows</span>
                      <span className="text-lg font-bold text-emerald-800">{previewData.validRows}</span>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <span className="text-amber-700 block">Duplicate Tags Flagged</span>
                      <span className="text-lg font-bold text-amber-800">{previewData.duplicateTagsCount}</span>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                      <span className="text-rose-700 block">Invalid Rows</span>
                      <span className="text-lg font-bold text-rose-800">{previewData.invalidRows}</span>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                      Parsed Rows Preview ({previewData.preview.length} displayed)
                    </h4>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-56">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 sticky top-0">
                          <tr>
                            <th className="p-2 border-b">Row</th>
                            <th className="p-2 border-b">Tag</th>
                            <th className="p-2 border-b">Name</th>
                            <th className="p-2 border-b">Entity</th>
                            <th className="p-2 border-b">Specs (CPU / RAM)</th>
                            <th className="p-2 border-b">Serial</th>
                            <th className="p-2 border-b">Employee</th>
                            <th className="p-2 border-b">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {previewData.preview.map((r: any) => (
                            <tr key={r.rowNumber} className={r.isDuplicateTag ? "bg-amber-50/50" : ""}>
                              <td className="p-2 font-mono text-[11px] text-slate-400">#{r.rowNumber}</td>
                              <td className="p-2 font-mono font-bold text-slate-900">
                                {r.assetTag}
                                {r.isDuplicateTag && (
                                  <span className="ml-1 text-[10px] bg-amber-200 text-amber-900 px-1 rounded">
                                    Duplicate
                                  </span>
                                )}
                              </td>
                              <td className="p-2 font-medium text-slate-800">{r.assetName}</td>
                              <td className="p-2 font-bold text-slate-700">{r.companyCode}</td>
                              <td className="p-2 text-slate-500 text-[11px]">
                                {r.cpu} • {r.ram}
                              </td>
                              <td className="p-2 font-mono text-slate-600 text-[11px]">
                                {r.serialNumber || "—"}
                              </td>
                              <td className="p-2 text-slate-700">{r.employeeName || "Unassigned"}</td>
                              <td className="p-2">{r.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer Controls */}
          {!importResult && (
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Cancel
              </button>

              {previewData && (
                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={loading || previewData.validRows === 0}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm shadow-emerald-200 flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Writing to PostgreSQL..." : `Import ${previewData.validRows} Assets`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

