function escapeHtml(value) {
  if (value == null || value === '') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildMedicalCertificateHtml(certificate) {
  const patientName = escapeHtml(certificate?.patientName || 'Patient');
  const patientId = escapeHtml(certificate?.patientId || '');
  const purpose = escapeHtml(certificate?.purpose || 'Medical certification');
  const service = escapeHtml(certificate?.service || 'Medical');
  const appointmentDate = escapeHtml(certificate?.appointmentDate || '');
  const appointmentTime = escapeHtml(certificate?.appointmentTime || '');
  const findings = escapeHtml(certificate?.findings || '');
  const issuedAt = escapeHtml(certificate?.issuedAt || '');
  const issuedBy = escapeHtml(certificate?.issuedBy || 'Infirmary Admin');
  const certificateCode = escapeHtml(certificate?.certificateCode || '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Medical Certificate</title>
  <style>
    @page { size: A4; margin: 18mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #eef4f1;
      color: #0f172a;
      font-family: Georgia, "Times New Roman", serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { padding: 24px; }
    .sheet {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #d7e3dc;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
      padding: 44px 52px;
      box-sizing: border-box;
    }
    .topline {
      text-align: center;
      font-size: 12px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: #0f766e;
      font-weight: 700;
      margin-bottom: 10px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .title {
      text-align: center;
      font-size: 34px;
      font-weight: 700;
      letter-spacing: 0.08em;
      margin: 0 0 10px;
      text-transform: uppercase;
    }
    .subtitle {
      text-align: center;
      font-size: 14px;
      color: #475569;
      margin-bottom: 36px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 28px;
      font-size: 13px;
      color: #334155;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .paragraph {
      font-size: 18px;
      line-height: 1.85;
      text-align: justify;
      margin: 0 0 26px;
    }
    .patient {
      font-weight: 700;
      text-decoration: underline;
      text-underline-offset: 4px;
    }
    .block {
      margin-top: 24px;
      padding: 18px 20px;
      border: 1px solid #dbe7e1;
      background: #f8fbfa;
    }
    .block h3 {
      margin: 0 0 10px;
      font-size: 12px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #0f766e;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .block p {
      margin: 0;
      white-space: pre-wrap;
      line-height: 1.7;
      font-size: 15px;
    }
    .signature {
      margin-top: 70px;
      display: flex;
      justify-content: flex-end;
    }
    .signature-box {
      min-width: 280px;
      text-align: center;
    }
    .signature-line {
      border-top: 1.5px solid #0f172a;
      padding-top: 10px;
      font-size: 16px;
      font-weight: 700;
    }
    .signature-role {
      margin-top: 6px;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #475569;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet {
        box-shadow: none;
        border: 0;
        max-width: none;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="topline">University Infirmary</div>
    <h1 class="title">Medical Certificate</h1>
    <div class="subtitle">This certificate is generated from the infirmary records system and is ready for printing.</div>
    <div class="meta">
      <div><strong>Issued:</strong> ${issuedAt}</div>
      <div><strong>Certificate No.:</strong> ${certificateCode || 'N/A'}</div>
    </div>
    <p class="paragraph">
      This is to certify that <span class="patient">${patientName}</span>${patientId ? ` (${patientId})` : ''} was evaluated by the infirmary for <strong>${purpose}</strong> under the <strong>${service}</strong> service.
    </p>
    ${(appointmentDate || appointmentTime) ? `
      <p class="paragraph">
        Consultation schedule: <strong>${appointmentDate || 'N/A'}</strong>${appointmentTime ? ` at <strong>${appointmentTime}</strong>` : ''}.
      </p>
    ` : ''}
    <div class="block">
      <h3>Findings / Remarks</h3>
      <p>${findings || 'No additional findings were provided.'}</p>
    </div>
    <p class="paragraph" style="margin-top: 26px;">
      This certification is issued upon request for whatever lawful purpose it may serve best.
    </p>
    <div class="signature">
      <div class="signature-box">
        <div class="signature-line">${issuedBy}</div>
        <div class="signature-role">Authorized Infirmary Personnel</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function openMedicalCertificateWindow(certificate) {
  const html = buildMedicalCertificateHtml(certificate);
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=980,height=900');
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
