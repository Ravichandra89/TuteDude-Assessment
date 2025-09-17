import PDFDocument from "pdfkit";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../config/s3";  // <-- use the default export
import { Readable } from "stream";

export const generatePDFReport = async (reportData: any, sessionId: string): Promise<string> => {
  try {
    const doc = new PDFDocument();
    const buffers: Buffer[] = [];

    doc.on("data", buffers.push.bind(buffers));

    // Generate PDF content
    doc.fontSize(18).text("Proctoring Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Candidate: ${reportData.candidateName}`);
    doc.text(`Integrity Score: ${reportData.integrityScore}`);
    doc.text(`Focus Lost: ${reportData.focusLostCount}`);
    doc.text(`Absence Count: ${reportData.absenceCount}`);
    doc.text(`Multiple Faces: ${reportData.multipleFacesCount}`);
    doc.moveDown();
    doc.text("Suspicious Items:");
    reportData.suspiciousItems.forEach((item: string, i: number) => {
      doc.text(`${i + 1}. ${item}`);
    });

    doc.end();

    // Wait until PDF is finished
    await new Promise<void>((resolve) => {
      doc.on("end", () => resolve());
    });

    const pdfBuffer = Buffer.concat(buffers);

    // Upload to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: `reports/${sessionId}.pdf`,
        Body: pdfBuffer,
        ContentType: "application/pdf",
      })
    );

    return `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/reports/${sessionId}.pdf`;
  } catch (error) {
    console.error("❌ Error generating PDF:", error);
    return "";
  }
};
