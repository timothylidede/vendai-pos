// Test script for welcome email
require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('Testing email configuration...\n');
  
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '***configured***' : 'NOT SET');
  console.log('');

  if (!process.env.SMTP_PASSWORD) {
    console.error('❌ SMTP_PASSWORD not set in .env.local');
    process.exit(1);
  }

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER || 'hello@vendai.digital',
        pass: process.env.SMTP_PASSWORD,
      },
    });

    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    // Send test email
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: '"Vendai" <hello@vendai.digital>',
      to: process.env.SMTP_USER, // Send to yourself for testing
      subject: 'Test - Welcome to the Vendai community!',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Vendai</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <tr>
                      <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #e9ecef;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; letter-spacing: 2px;">VENDAI</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 40px;">
                        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #333333;">Hi there,</p>
                        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #333333;">Welcome to the Vendai community! We're so glad you're here.</p>
                        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #333333;">This is a test email to verify your SMTP configuration is working correctly.</p>
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                          <tr>
                            <td align="center">
                              <a href="https://app.vendai.digital/modules" style="display: inline-block; padding: 14px 32px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: 500;">Start shopping</a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 32px 0 0 0; font-size: 16px; line-height: 1.5; color: #333333;">Timothy Lidede, CEO and Co-founder</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 20px 40px; text-align: center; border-top: 1px solid #e9ecef; background-color: #f8f9fa;">
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #adb5bd;">Nairobi, Kenya</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('\nCheck your inbox at:', process.env.SMTP_USER);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testEmail();
