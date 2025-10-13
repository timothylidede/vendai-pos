/**
 * Communication templates for payment reminders and notifications
 */

interface PaymentReminderData {
  retailerName?: string | null;
  installmentNumber: number;
  dueDate: Date;
  totalAmount: number;
  daysUntilDue: number;
}

interface OverdueNotificationData {
  retailerName?: string | null;
  installmentNumber: number;
  dueDate: Date;
  totalAmount: number;
  outstandingAmount: number;
  daysOverdue: number;
}

/**
 * Format currency in Kenyan Shillings
 */
function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format date in DD/MM/YYYY format
 */
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Generate SMS message for payment reminder
 */
export function generateReminderSMS(data: PaymentReminderData): string {
  const name = data.retailerName || 'Valued Customer';
  const amount = formatCurrency(data.totalAmount);
  const dueDate = formatDate(data.dueDate);
  const daysText = data.daysUntilDue === 1 ? 'tomorrow' : `in ${data.daysUntilDue} days`;

  return `Hi ${name}, your credit repayment installment #${data.installmentNumber} of ${amount} is due ${daysText} (${dueDate}). Pay via M-Pesa or your VendAI dashboard. Contact support for assistance.`;
}

/**
 * Generate email subject for payment reminder
 */
export function generateReminderEmailSubject(data: PaymentReminderData): string {
  return `Payment Reminder: Installment #${data.installmentNumber} Due ${data.daysUntilDue === 1 ? 'Tomorrow' : `in ${data.daysUntilDue} Days`}`;
}

/**
 * Generate email HTML body for payment reminder
 */
export function generateReminderEmailBody(data: PaymentReminderData): string {
  const name = data.retailerName || 'Valued Customer';
  const amount = formatCurrency(data.totalAmount);
  const dueDate = formatDate(data.dueDate);
  const urgencyClass = data.daysUntilDue === 1 ? 'urgent' : 'normal';
  const urgencyText = data.daysUntilDue === 1 ? 'TOMORROW' : `in ${data.daysUntilDue} days`;

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .amount { font-size: 28px; font-weight: bold; color: #4F46E5; margin: 20px 0; }
    .due-date { font-size: 18px; color: #dc2626; font-weight: bold; }
    .due-date.normal { color: #f59e0b; }
    .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
    .info-box { background-color: white; padding: 15px; border-left: 4px solid #4F46E5; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Reminder</h1>
    </div>
    <div class="content">
      <p>Dear ${name},</p>
      
      <p>This is a friendly reminder that your credit repayment is coming up soon.</p>
      
      <div class="info-box">
        <p><strong>Installment Number:</strong> #${data.installmentNumber}</p>
        <p><strong>Amount Due:</strong> <span class="amount">${amount}</span></p>
        <p><strong>Due Date:</strong> <span class="due-date ${urgencyClass}">${dueDate} (${urgencyText})</span></p>
      </div>

      <p><strong>How to Pay:</strong></p>
      <ul>
        <li><strong>M-Pesa STK Push:</strong> Log in to your VendAI dashboard and click "Make Payment" on your repayment schedule</li>
        <li><strong>Manual Payment:</strong> Contact your VendAI account manager</li>
      </ul>

      <center>
        <a href="https://vendai.app/retailer/credit/repayments" class="button">View Repayment Schedule</a>
      </center>

      <p>Timely payments help maintain your credit score and increase your credit limit eligibility.</p>

      <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>

      <p>Best regards,<br>The VendAI Team</p>
    </div>
    <div class="footer">
      <p>VendAI - Empowering African Retailers</p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate SMS message for overdue notification
 */
export function generateOverdueSMS(data: OverdueNotificationData): string {
  const name = data.retailerName || 'Valued Customer';
  const amount = formatCurrency(data.outstandingAmount);
  const daysOverdue = data.daysOverdue;

  if (daysOverdue === 1) {
    return `URGENT: ${name}, your credit payment of ${amount} was due yesterday. Please pay immediately to avoid late fees and protect your credit score. Pay via VendAI dashboard or contact support.`;
  } else if (daysOverdue <= 7) {
    return `OVERDUE: ${name}, your credit payment of ${amount} is ${daysOverdue} days overdue. Late fees may apply. Pay now via VendAI to restore your account. Contact support if you need help.`;
  } else {
    return `URGENT: ${name}, your credit payment of ${amount} is ${daysOverdue} days overdue. Your credit limit may be suspended. Pay immediately via VendAI or contact support to discuss payment options.`;
  }
}

/**
 * Generate email subject for overdue notification
 */
export function generateOverdueEmailSubject(data: OverdueNotificationData): string {
  if (data.daysOverdue >= 14) {
    return `URGENT: Payment ${data.daysOverdue} Days Overdue - Immediate Action Required`;
  }
  return `Payment Overdue: Installment #${data.installmentNumber} - ${data.daysOverdue} Days Late`;
}

/**
 * Generate email HTML body for overdue notification
 */
export function generateOverdueEmailBody(data: OverdueNotificationData): string {
  const name = data.retailerName || 'Valued Customer';
  const totalAmount = formatCurrency(data.totalAmount);
  const outstandingAmount = formatCurrency(data.outstandingAmount);
  const dueDate = formatDate(data.dueDate);
  const daysOverdue = data.daysOverdue;

  const urgencyLevel = daysOverdue >= 14 ? 'critical' : daysOverdue >= 7 ? 'high' : 'medium';
  const urgencyColor = urgencyLevel === 'critical' ? '#dc2626' : urgencyLevel === 'high' ? '#f59e0b' : '#f97316';

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${urgencyColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .amount { font-size: 28px; font-weight: bold; color: ${urgencyColor}; margin: 20px 0; }
    .overdue-days { font-size: 24px; color: ${urgencyColor}; font-weight: bold; background-color: #fef2f2; padding: 10px; border-radius: 6px; text-align: center; }
    .button { display: inline-block; background-color: ${urgencyColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
    .info-box { background-color: white; padding: 15px; border-left: 4px solid ${urgencyColor}; margin: 20px 0; }
    .warning-box { background-color: #fef2f2; border: 2px solid ${urgencyColor}; padding: 15px; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Payment Overdue</h1>
    </div>
    <div class="content">
      <p>Dear ${name},</p>
      
      <p><strong>Your credit payment is now overdue and requires immediate attention.</strong></p>
      
      <div class="overdue-days">
        ${daysOverdue} Day${daysOverdue === 1 ? '' : 's'} Overdue
      </div>

      <div class="info-box">
        <p><strong>Installment Number:</strong> #${data.installmentNumber}</p>
        <p><strong>Original Amount:</strong> ${totalAmount}</p>
        <p><strong>Outstanding Balance:</strong> <span class="amount">${outstandingAmount}</span></p>
        <p><strong>Original Due Date:</strong> ${dueDate}</p>
      </div>

      <div class="warning-box">
        <h3 style="margin-top: 0; color: ${urgencyColor};">⚠️ Important Consequences</h3>
        <ul style="margin: 10px 0;">
          <li><strong>Late Fees:</strong> Additional charges may apply</li>
          <li><strong>Credit Score Impact:</strong> Your credit score is being negatively affected</li>
          ${daysOverdue >= 7 ? '<li><strong>Credit Limit Freeze:</strong> New credit disbursements may be suspended</li>' : ''}
          ${daysOverdue >= 14 ? '<li><strong>Account Escalation:</strong> Your account may be referred to collections</li>' : ''}
        </ul>
      </div>

      <p><strong>Pay Now to Avoid Further Consequences:</strong></p>
      <ul>
        <li><strong>M-Pesa STK Push:</strong> Instant payment via your VendAI dashboard</li>
        <li><strong>Contact Support:</strong> Discuss payment plans if you're facing difficulties</li>
      </ul>

      <center>
        <a href="https://vendai.app/retailer/credit/repayments" class="button">Pay Now</a>
      </center>

      <p>If you're experiencing financial difficulties, please contact our support team immediately. We're here to help you find a solution.</p>

      <p>Best regards,<br>The VendAI Team</p>
    </div>
    <div class="footer">
      <p>VendAI - Empowering African Retailers</p>
      <p>For assistance: support@vendai.app | +254 XXX XXX XXX</p>
    </div>
  </div>
</body>
</html>
  `;
}
