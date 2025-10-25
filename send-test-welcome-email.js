require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

async function sendTestEmail() {
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
    console.log('✅ SMTP connection successful!');

    const htmlContent = `
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
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #e9ecef;">
                      <img src="https://app.vendai.digital/images/logo-icon-remove-black.png" alt="Vendai" style="height: 40px; width: auto;" />
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                        Hi Timothy,
                      </p>
                      
                      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                        Welcome to the Vendai community! We're so glad you're here.
                      </p>
                      
                      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                        Through our online marketplace, you can discover <strong>unique, high quality wholesale products</strong> and order from thousands of brands, all in one place. As a new retailer, you'll get <strong>50% off your first order on Vendai, up to KES 10,000 off!</strong>
                      </p>
                      
                      <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                        On Vendai, you're sure to find products your customers will love—including <em>gifts, home décor, apparel</em>, and much more. To get started, check out our top selling brands and <strong>payment terms</strong>.
                      </p>
                      
                      <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                        In addition to the largest selection of independent brands, we're excited to offer risk-free shopping benefits like <strong>free returns on all first orders</strong> and <strong>low order minimums</strong>.
                      </p>
                      
                      <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                        Thank you for being part of our community.
                      </p>
                      
                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="https://app.vendai.digital/modules" 
                               style="display: inline-block; padding: 14px 32px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: 500;">
                              Start shopping
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 32px 0 0 0; font-size: 16px; line-height: 1.5; color: #333333;">
                        Tim Lidede, CEO and Co-founder
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 40px; text-align: center; border-top: 1px solid #e9ecef; background-color: #f8f9fa;">
                      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6c757d;">
                        <a href="https://vendai.digital/help" style="color: #6c757d; text-decoration: none; margin: 0 8px;">Help Center</a>
                        <span style="color: #dee2e6;">|</span>
                        <a href="https://vendai.digital/contact" style="color: #6c757d; text-decoration: none; margin: 0 8px;">Contact Us</a>
                        <span style="color: #dee2e6;">|</span>
                        <a href="https://vendai.digital/privacy" style="color: #6c757d; text-decoration: none; margin: 0 8px;">Privacy Policy</a>
                      </p>
                      <p style="margin: 8px 0 0 0; font-size: 12px; color: #adb5bd;">
                        Nairobi, Kenya
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    console.log('Sending test welcome email...');
    const info = await transporter.sendMail({
      from: '"Vendai" <hello@vendai.digital>',
      to: 'timothyliidede@gmail.com',
      subject: 'Welcome to the Vendai community!',
      html: htmlContent,
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('\nCheck your inbox at: timothyliidede@gmail.com');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

sendTestEmail();
