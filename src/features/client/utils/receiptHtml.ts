import type { ReceiptData } from './receiptTypes';

const DEEP_BLUE = '#1E293B';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const buildReceiptHtml = (data: ReceiptData): string => {
  const title = escapeHtml(data.jobTitle);
  const category = escapeHtml(data.categoryLabel);
  const worker = escapeHtml(data.workerName ?? '—');
  const client = escapeHtml(data.clientName ?? '—');
  const address = escapeHtml(data.address ?? '—');
  const completed = escapeHtml(data.completedAt);
  const amount = escapeHtml(data.payAmountLabel);
  const receiptId = escapeHtml(data.jobId.slice(0, 8).toUpperCase());

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Recibo CHAMBA — ${title}</title>
  <style>
    @page { size: A4; margin: 24mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #F9FAFB;
      margin: 0;
      padding: 32px;
      line-height: 1.5;
    }
    .sheet {
      max-width: 680px;
      margin: 0 auto;
      background: #FFFFFF;
      border: 1px solid ${BORDER};
      border-radius: 16px;
      overflow: hidden;
    }
    .header {
      background: ${DEEP_BLUE};
      color: #FFFFFF;
      padding: 28px 32px;
    }
    .brand {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 2px;
      margin: 0 0 4px;
    }
    .tagline {
      font-size: 13px;
      opacity: 0.85;
      margin: 0;
    }
    .body { padding: 28px 32px 32px; }
    .receipt-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: ${MUTED};
      margin: 0 0 8px;
    }
    .service-title {
      font-size: 22px;
      font-weight: 700;
      color: ${DEEP_BLUE};
      margin: 0 0 4px;
    }
    .service-meta {
      font-size: 14px;
      color: ${MUTED};
      margin: 0 0 24px;
    }
    .amount-box {
      background: #F9FAFB;
      border: 1px solid ${BORDER};
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 24px;
    }
    .amount-label {
      font-size: 12px;
      font-weight: 600;
      color: ${MUTED};
      margin: 0 0 6px;
    }
    .amount-value {
      font-size: 32px;
      font-weight: 800;
      color: ${DEEP_BLUE};
      margin: 0;
      letter-spacing: -0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    td {
      padding: 10px 0;
      border-bottom: 1px solid ${BORDER};
      vertical-align: top;
    }
    td:first-child {
      width: 38%;
      color: ${MUTED};
      font-weight: 600;
    }
    td:last-child {
      color: #111827;
      font-weight: 600;
      text-align: right;
    }
    tr:last-child td { border-bottom: none; }
    .footer {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid ${BORDER};
      font-size: 12px;
      color: ${MUTED};
      text-align: center;
    }
    .footer strong { color: ${DEEP_BLUE}; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <h1 class="brand">CHAMBA</h1>
      <p class="tagline">Recibo de servicio · Nicaragua</p>
    </div>
    <div class="body">
      <p class="receipt-label">Comprobante #${receiptId}</p>
      <h2 class="service-title">${title}</h2>
      <p class="service-meta">${category}</p>

      <div class="amount-box">
        <p class="amount-label">Monto pagado</p>
        <p class="amount-value">${amount}</p>
      </div>

      <table>
        <tr>
          <td>Fecha de finalización</td>
          <td>${completed}</td>
        </tr>
        <tr>
          <td>Cliente</td>
          <td>${client}</td>
        </tr>
        <tr>
          <td>Técnico</td>
          <td>${worker}</td>
        </tr>
        <tr>
          <td>Ubicación</td>
          <td>${address}</td>
        </tr>
      </table>

      <div class="footer">
        <p>Gracias por confiar en <strong>CHAMBA</strong>.</p>
        <p>Este documento es un comprobante informativo del servicio completado.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};
