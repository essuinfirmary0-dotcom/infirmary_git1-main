/** Escape text for HTML body (API-sourced fields). */
function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildKioskReceiptDocumentHtml(kioskResult) {
  const u = kioskResult.user || {};
  const apt = kioskResult.appointment;
  const name = escapeHtml(u.name || 'Guest');
  const queue = escapeHtml(kioskResult.queueNumber ?? '');
  const dateLine = escapeHtml(kioskResult.checkInDateDisplay || '');
  const student = u.studentNumber ? escapeHtml(u.studentNumber) : '';
  const employee = u.employeeNumber ? escapeHtml(u.employeeNumber) : '';
  const college = u.college?.trim() ? escapeHtml(u.college) : '';
  const program = u.program?.trim() ? escapeHtml(u.program) : '';

  let appointmentBlock = '';
  if (kioskResult.hasAppointmentToday && apt) {
    const code = escapeHtml(apt.code || '');
    const time = escapeHtml(apt.time || '');
    const status = escapeHtml(apt.status || '');
    const svc = escapeHtml(
      [apt.service, apt.subcategory].filter(Boolean).join(' - ')
    );
    appointmentBlock = `
      <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #000;">
        <div style="font-size:10px;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Today's appointment</div>
        <div style="font-size:11px;"><strong>Ticket:</strong> ${code}</div>
        <div style="font-size:11px;"><strong>Time:</strong> ${time}</div>
        <div style="font-size:11px;"><strong>Service:</strong> ${svc}</div>
        <div style="font-size:10px;color:#333;margin-top:4px;"><strong>Status:</strong> ${status}</div>
      </div>`;
  }

  const idLine = student
    ? `<div style="font-size:11px;"><strong>Student No.:</strong> ${student}</div>`
    : employee
      ? `<div style="font-size:11px;"><strong>Employee No.:</strong> ${employee}</div>`
      : '';

  const collegeLine = college
    ? `<div style="font-size:11px;"><strong>College:</strong> ${college}</div>`
    : '';
  const programLine = program
    ? `<div style="font-size:11px;"><strong>Program:</strong> ${program}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Infirmary queue receipt</title>
  <style>
    @page { size: 80mm auto; margin: 5mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .wrap {
      max-width: 72mm;
      margin: 0 auto;
      padding: 4px 2px 12px;
      box-sizing: border-box;
    }
    .title { font-size: 9px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; text-align: center; color: #0a6627; }
    h1 { font-size: 16px; margin: 6px 0 4px; text-align: center; }
    .date { font-size: 11px; font-weight: 700; text-align: center; color: #333; margin-bottom: 10px; }
    .label-q { font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; text-align: center; color: #444; }
    .queue {
      font-size: 28px;
      font-weight: 900;
      text-align: center;
      margin: 6px 0 12px;
      padding: 8px 12px;
      border: 2px solid #000;
      border-radius: 8px;
    }
    .hr { height: 1px; background: #000; margin: 8px 0; opacity: 0.35; }
    .name { font-size: 13px; font-weight: 700; margin-bottom: 6px; }
    .foot { font-size: 9px; color: #444; text-align: center; margin-top: 12px; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="title">Kiosk check-in receipt</div>
    <h1>You're in the queue</h1>
    ${dateLine ? `<div class="date">${dateLine}</div>` : ''}
    <div class="label-q">Queue number</div>
    <div class="queue">${queue}</div>
    <div class="hr"></div>
    <div class="name">${name}</div>
    ${idLine}
    ${collegeLine}
    ${programLine}
    ${appointmentBlock}
    <p class="foot">Please wait for your queue number to be called on the infirmary display.</p>
  </div>
</body>
</html>`;
}

/**
 * Opens the system print dialog with a minimal HTML receipt (works reliably on Chrome / Android;
 * avoids blank pages from visibility-based @media print on the main app).
 */
export function printKioskReceipt(kioskResult) {
  if (!kioskResult) return;

  const html = buildKioskReceiptDocumentHtml(kioskResult);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Print receipt');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;pointer-events:none;';

  let printed = false;
  const runPrint = () => {
    if (printed) return;
    printed = true;
    try {
      const w = iframe.contentWindow;
      if (w) {
        w.focus();
        w.print();
      }
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 800);
  };

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = runPrint;
  window.setTimeout(runPrint, 400);
}
