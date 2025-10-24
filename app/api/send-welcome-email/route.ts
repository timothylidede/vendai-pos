import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, displayName, storeName } = await request.json();

    if (!email || !displayName) {
      return NextResponse.json(
        { error: 'Email and display name are required' },
        { status: 400 }
      );
    }

    // Check if SMTP is configured
    if (!process.env.SMTP_PASSWORD) {
      console.warn('SMTP not configured - skipping welcome email');
      return NextResponse.json({ 
        success: false, 
        message: 'SMTP not configured. Please set SMTP_USER and SMTP_PASSWORD environment variables.' 
      });
    }

    // Dynamic import of nodemailer to avoid build-time errors if not installed
    const nodemailer = await import('nodemailer');

    // Create transporter using Zoho Mail SMTP
    const transporter = nodemailer.default.createTransport({
      host: 'smtp.zoho.com',
      port: 465,
      secure: true, // use SSL
      auth: {
        user: process.env.SMTP_USER || 'hello@vendai.digital',
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Email HTML content matching the Faire style
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
                      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; letter-spacing: 2px;">VENDAI</h1>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                        Hi ${displayName.split(' ')[0] || displayName},
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
                            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://vendai.digital'}/modules" 
                               style="display: inline-block; padding: 14px 32px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: 500;">
                              Start shopping
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 32px 0 0 0; font-size: 16px; line-height: 1.5; color: #333333;">
                        Timothy Lidede, CEO and Co-founder
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 40px; text-align: center; border-top: 1px solid #e9ecef; background-color: #f8f9fa;">
                      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6c757d;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://vendai.digital'}/help" style="color: #6c757d; text-decoration: none; margin: 0 8px;">Help Center</a>
                        <span style="color: #dee2e6;">|</span>
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://vendai.digital'}/contact" style="color: #6c757d; text-decoration: none; margin: 0 8px;">Contact Us</a>
                        <span style="color: #dee2e6;">|</span>
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://vendai.digital'}/privacy" style="color: #6c757d; text-decoration: none; margin: 0 8px;">Privacy Policy</a>
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

    // Send email
    await transporter.sendMail({
      from: '"Vendai" <hello@vendai.digital>',
      to: email,
      subject: 'Welcome to the Vendai community!',
      html: htmlContent,
    });

    return NextResponse.json({ success: true, message: 'Welcome email sent successfully' });
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return NextResponse.json(
      { error: 'Failed to send welcome email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
