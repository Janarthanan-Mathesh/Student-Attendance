"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDeficiencyPDF = generateDeficiencyPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const qrcode_1 = __importDefault(require("qrcode"));
const crypto_1 = __importDefault(require("crypto"));
async function generateDeficiencyPDF(data) {
    // Generate digital verification hash
    const hashPayload = `${data.register_no}-${data.course_code}-${data.current_percentage}-${data.issued_at}`;
    const digitalSignature = crypto_1.default.createHash('sha256').update(hashPayload).digest('hex').toUpperCase().slice(0, 16);
    const verifyUrl = `https://portal.institution.edu/verify-notice?reg=${data.register_no}&code=${data.course_code}&sig=${digitalSignature}`;
    // Generate QR Code Buffer
    const qrDataUrl = await qrcode_1.default.toDataURL(verifyUrl);
    const qrImageBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ margin: 50 });
        const buffers = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));
        // Document Header
        doc.fillColor('#1E293B').fontSize(18).text('OFFICIAL ACADEMIC DEFICIENCY NOTICE', { align: 'center' });
        doc.fontSize(10).fillColor('#64748B').text('INSTITUTIONAL ACADEMIC ACCREDITATION & COMPLIANCE BOARD', { align: 'center' });
        doc.moveDown(0.5);
        doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(1);
        // Warning Banner based on status
        const isCritical = data.deficiency_status === 'CRITICAL_DETENTION';
        const bannerColor = isCritical ? '#EF4444' : '#F59E0B';
        const bannerText = isCritical
            ? 'CRITICAL DEFICIENCY NOTICE - MANDATORY PARENT INTERVENTION & DETENTION WARNING'
            : 'FORMAL DEFICIENCY WARNING - IMMEDIATE ATTENDANCE RECOVERY REQUIRED';
        doc.rect(50, doc.y, 500, 28).fill(bannerColor);
        doc.fillColor('#FFFFFF').fontSize(10).text(bannerText, 55, doc.y - 20, { width: 490, align: 'center' });
        doc.moveDown(1.5);
        // Student & Parent Information Grid
        doc.fillColor('#0F172A').fontSize(12).text('Student & Record Details:', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#334155');
        doc.text(`Student Name: ${data.student_name}`);
        doc.text(`Register No / ID: ${data.register_no}`);
        doc.text(`Department: ${data.department}`);
        doc.text(`Parent/Guardian Name: ${data.parent_name}`);
        doc.moveDown(0.8);
        // Academic & Attendance Metrics
        doc.fillColor('#0F172A').fontSize(12).text('Course & Deficiency Metrics:', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#334155');
        doc.text(`Course Code & Title: ${data.course_code} - ${data.course_name}`);
        doc.text(`Current Attendance Percentage: ${data.current_percentage}%`);
        doc.text(`Mandatory Eligibility Threshold: 75.00%`);
        doc.text(`Minimum Consecutive Classes Required to Reach Safe Zone: ${data.classes_required} Sessions`);
        doc.text(`Deficiency Classification: ${data.deficiency_status}`);
        doc.moveDown(1.5);
        // Compliance & Digital Verification Section
        doc.rect(50, doc.y, 500, 100).fillAndStroke('#F8FAFC', '#E2E8F0');
        const boxY = doc.y - 95;
        doc.fillColor('#0F172A').fontSize(10).text('Digital Verification & Sign-Off:', 60, boxY);
        doc.fontSize(8).fillColor('#475569').text(`Digital Security Signature Hash: ${digitalSignature}`, 60, boxY + 18);
        doc.text(`Date of Issuance: ${data.issued_at}`, 60, boxY + 30);
        doc.text('Scan the QR code to verify validity on the institutional portal.', 60, boxY + 42);
        // Embed QR Code Image
        doc.image(qrImageBuffer, 430, boxY + 5, { width: 80, height: 80 });
        doc.moveDown(3);
        // Footer Signatures
        doc.fillColor('#0F172A').fontSize(10);
        doc.text('_______________________', 60, doc.y);
        doc.text('Head of Department', 60, doc.y + 15);
        doc.text('_______________________', 360, doc.y - 15);
        doc.text('Parent/Guardian Signature', 360, doc.y + 15);
        doc.end();
    });
}
