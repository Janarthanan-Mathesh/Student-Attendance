import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface PDFNoticeData {
  student_name: string;
  register_no: string;
  department: string;
  course_code: string;
  course_name: string;
  current_percentage: number;
  classes_required: number;
  deficiency_status: string;
  parent_name: string;
  issued_at: string;
}

export async function generateDeficiencyPDF(data: PDFNoticeData): Promise<Buffer> {
  // Generate digital verification hash
  const hashPayload = `${data.register_no}-${data.course_code}-${data.current_percentage}-${data.issued_at}`;
  const digitalSignature = crypto.createHash('sha256').update(hashPayload).digest('hex').toUpperCase().slice(0, 16);

  const verifyUrl = `https://portal.institution.edu/verify-notice?reg=${data.register_no}&code=${data.course_code}&sig=${digitalSignature}`;

  // Generate QR Code Buffer
  const qrDataUrl = await QRCode.toDataURL(verifyUrl);
  const qrImageBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const left = 50;
    const right = 545;
    const width = right - left;
    const logoPath = path.resolve(__dirname, '../assets/institute-header.png');

    // Keep the supplied institute header at the top, centered within the page.
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, left, 24, { fit: [width, 112], align: 'center', valign: 'center' });
    } else {
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(14)
        .text('BANNARI AMMAN INSTITUTE OF TECHNOLOGY', left, 48, { width, align: 'center' });
      doc.fillColor('#64748B').font('Helvetica').fontSize(8)
        .text('An Autonomous Institution, Affiliated to Anna University', left, 69, { width, align: 'center' });
    }

    // Fixed positions keep all text blocks clear of one another when values wrap.
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(17)
      .text('OFFICIAL ACADEMIC DEFICIENCY NOTICE', left, 151, { width, align: 'center' });
    doc.fillColor('#64748B').font('Helvetica').fontSize(9)
      .text('INSTITUTIONAL ACADEMIC ACCREDITATION & COMPLIANCE BOARD', left, 177, { width, align: 'center' });
    doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(left, 199).lineTo(right, 199).stroke();

    const isCritical = data.deficiency_status === 'CRITICAL_DETENTION';
    const bannerColor = isCritical ? '#EF4444' : '#F59E0B';
    const bannerText = isCritical
      ? 'CRITICAL DEFICIENCY NOTICE - MANDATORY PARENT INTERVENTION & DETENTION WARNING'
      : 'FORMAL DEFICIENCY WARNING - IMMEDIATE ATTENDANCE RECOVERY REQUIRED';

    doc.roundedRect(left, 211, width, 34, 5).fill(bannerColor);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
      .text(bannerText, left + 10, 221, { width: width - 20, align: 'center', height: 18, ellipsis: true });

    const section = (title: string, y: number) => {
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(12).text(title, left, y);
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(left, y + 17).lineTo(right, y + 17).stroke();
    };
    const detail = (label: string, value: string, x: number, y: number, cellWidth: number) => {
      doc.fillColor('#475569').font('Helvetica').fontSize(9.5).text(label, x, y, { width: cellWidth });
      doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(11).text(value || 'N/A', x, y + 14, { width: cellWidth, height: 25, ellipsis: true });
    };

    section('Student & Record Details', 263);
    detail('Student Name', data.student_name, left + 8, 289, 235);
    detail('Register Number', data.register_no, left + 255, 289, 230);
    detail('Department', data.department, left + 8, 331, 235);
    detail('Parent / Guardian', data.parent_name, left + 255, 331, 230);

    section('Course & Attendance Metrics', 381);
    detail('Course Code', data.course_code, left + 8, 407, 150);
    detail('Course Title', data.course_name, left + 174, 407, 310);
    detail('Current Attendance', `${data.current_percentage}%`, left + 8, 449, 150);
    detail('Required Threshold', '75.00%', left + 174, 449, 145);
    detail('Sessions Needed', `${data.classes_required} sessions`, left + 338, 449, 145);
    detail('Deficiency Classification', data.deficiency_status.replace(/_/g, ' '), left + 8, 491, width - 16);

    const boxY = 552;
    doc.roundedRect(left, boxY, width, 104, 6).fillAndStroke('#F8FAFC', '#CBD5E1');
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10).text('DIGITAL VERIFICATION', left + 14, boxY + 14);
    doc.fillColor('#475569').font('Helvetica').fontSize(8)
      .text(`Security signature: ${digitalSignature}`, left + 14, boxY + 36, { width: 350 })
      .text(`Issued on: ${data.issued_at}`, left + 14, boxY + 52, { width: 350 })
      .text('Scan the QR code to verify this notice.', left + 14, boxY + 68, { width: 350 });
    doc.image(qrImageBuffer, right - 88, boxY + 10, { width: 78, height: 78 });

    doc.strokeColor('#94A3B8').lineWidth(1).moveTo(left + 8, 701).lineTo(left + 205, 701).stroke();
    doc.moveTo(left + 286, 701).lineTo(right - 8, 701).stroke();
    doc.fillColor('#334155').font('Helvetica').fontSize(9)
      .text('Head of Department', left + 8, 709, { width: 197, align: 'center' })
      .text('Parent / Guardian Signature', left + 286, 709, { width: 197, align: 'center' });

    doc.end();
  });
}
