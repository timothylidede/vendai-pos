# Welcome Email Setup Guide

This guide explains how to configure automated welcome emails using Zoho Mail SMTP.

## Prerequisites

- A Zoho Mail account with the email address `hello@vendai.digital`
- Access to your Zoho Mail account settings
- Your project's environment variables

## Step 1: Install nodemailer

```bash
npm install nodemailer @types/nodemailer
```

## Step 2: Generate Zoho Mail App Password

1. Log in to your Zoho Mail account at https://mail.zoho.com
2. Go to **Settings** → **Security** → **App Passwords**
3. Click **Generate New Password**
4. Give it a name like "Vendai Welcome Emails"
5. Copy the generated password

## Step 3: Configure Environment Variables

Add these variables to your `.env.local` file (for development) and to your production environment (Vercel, Railway, etc.):

```bash
SMTP_USER=hello@vendai.digital
SMTP_PASSWORD=your_app_password_here
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### For Vercel Deployment

1. Go to your project settings on Vercel
2. Navigate to **Environment Variables**
3. Add `SMTP_USER` and `SMTP_PASSWORD`
4. Redeploy your application

### For Local Development

Create a `.env.local` file in your project root:

```bash
SMTP_USER=hello@vendai.digital
SMTP_PASSWORD=your_zoho_app_password
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 4: Test the Email

After configuration, when a new user completes onboarding, they will automatically receive a welcome email styled like Faire's onboarding email.

### Manual Testing

You can test the email endpoint directly:

```bash
curl -X POST http://localhost:3000/api/send-welcome-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "displayName": "Test User",
    "storeName": "Test Store"
  }'
```

## Zoho SMTP Settings

The application uses these Zoho Mail SMTP settings:

- **Host**: smtp.zoho.com
- **Port**: 465
- **Security**: SSL/TLS
- **Authentication**: Required

## Troubleshooting

### Email not sending

1. **Check SMTP credentials**: Verify `SMTP_USER` and `SMTP_PASSWORD` are correctly set
2. **Check Zoho account**: Ensure the email account is active and has sending permissions
3. **Check logs**: Look for error messages in your application logs
4. **Verify app password**: Generate a new app password if the current one isn't working

### SMTP not configured warning

If you see "SMTP not configured - skipping welcome email" in the logs, it means `SMTP_PASSWORD` is not set in your environment variables.

### Port blocked

Some hosting providers block port 465. If that's the case, try:
- Port 587 with STARTTLS
- Contact your hosting provider about SMTP port access

## Email Content

The welcome email includes:

- Personalized greeting with user's first name
- 50% discount offer (up to KES 10,000 off first order)
- Information about product selection and benefits
- "Start shopping" call-to-action button
- Footer with help links

## Customization

To customize the email template, edit the HTML content in:
`app/api/send-welcome-email/route.ts`

The template is built using HTML email best practices with inline styles for maximum compatibility across email clients.

## Security Notes

- Never commit `.env.local` or actual passwords to version control
- Use app-specific passwords, not your main Zoho account password
- Rotate passwords regularly
- Monitor email sending for unusual activity

## Alternative: Using a Third-Party Email Service

If you prefer, you can replace Zoho SMTP with services like:

- **SendGrid**: More features, free tier available
- **AWS SES**: Cost-effective for high volume
- **Mailgun**: Good deliverability
- **Resend**: Modern API, React email templates

To switch services, update the transporter configuration in `app/api/send-welcome-email/route.ts`.
