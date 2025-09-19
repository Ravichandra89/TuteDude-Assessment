// src/services/report.service.ts
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

interface ReportData {
  candidateName?: string;
  interviewDuration?: number | null;
  focusLostCount?: number;
  absenceCount?: number;
  multipleFacesCount?: number;
  suspiciousItems?: string[];
  events?: any[];
  integrityScore?: number;
}

export const generatePDFReport = async (
  reportData: ReportData,
  sessionId: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Ensure events array exists
      const events = reportData.events || [];

      // Temporary folder for PDFs
      const tmpDir = path.resolve(__dirname, "../../tmp");
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      // Output PDF path
      const pdfPath = path.join(tmpDir, `${sessionId}.pdf`);

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      // Header
      doc.fontSize(20).text("Interview Proctoring Report", { align: "center" });
      doc.moveDown();

      doc
        .fontSize(14)
        .text(`Candidate: ${reportData.candidateName || "Unknown"}`);
      doc.text(
        `Duration: ${
          reportData.interviewDuration != null
            ? `${reportData.interviewDuration} seconds`
            : "N/A"
        }`
      );
      doc.text(`Integrity Score: ${reportData.integrityScore ?? "N/A"}`);
      doc.moveDown();

      // Event Summary
      doc.fontSize(16).text("Event Summary:");
      if (events.length === 0) {
        doc.fontSize(12).text("No events recorded.");
      } else {
        events.forEach((e, idx) => {
          doc
            .fontSize(12)
            .text(
              `${idx + 1}. [${e.type || "UNKNOWN"}] ${
                e.message || ""
              } - ${new Date(e.timestamp).toLocaleString()}`
            );
        });
      }

      doc.end();

      writeStream.on("finish", () => {
        resolve(pdfPath); // Return full path
      });

      writeStream.on("error", (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
};
