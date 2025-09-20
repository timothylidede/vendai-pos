# VendAI - AI-Powered POS & ERP System

A modern point of sale and ERP system with integrated AI assistance, built for distributors and retailers in Kenya.

## 🚀 Features

- **Complete POS System** - Process sales, manage inventory, generate receipts
- **Distributor Management** - Handle suppliers, track GMV, manage settlements
- **Retailer Dashboard** - Order management, stock tracking, analytics
- **AI Assistant** - Intelligent business insights and recommendations
- **Real-time Sync** - Firebase-powered real-time data synchronization
- **Desktop App** - Electron-based desktop application for Windows/Mac/Linux
- **Mobile Ready** - Responsive design for tablets and mobile devices

## 📋 Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore enabled
- Google Maps API key (optional, for location features)
- OpenAI API key (optional, for AI features)

## ⚙️ Installation & Setup

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd vendai-pos
npm install
```

### 2. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or select existing project
3. Enable Firestore Database
4. Enable Authentication with Google sign-in
5. Go to Project Settings > General > Your apps
6. Add a web app and copy the configuration

### 3. Environment Configuration

1. Copy the environment template:
   ```bash
   copy .env.template .env.local
   ```

2. Fill in your Firebase credentials in `.env.local`:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

### 4. Firebase Security Rules Setup

Deploy the security rules to your Firebase project:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

### 5. Initialize Backend Data

Run the backend setup script to create sample data:

```bash
node scripts/setup-complete-backend.cjs
```

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🖥️ Desktop App

To run as a desktop application:

```bash
# Development mode
npm run electron:dev

# Build for production
npm run dist:win    # Windows
npm run dist:mac    # macOS  
npm run dist:linux  # Linux
npm run dist:all    # All platforms
```

## 📁 Project Structure

```
vendai-pos/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── modules/           # Main application modules
│   ├── onboarding/        # User onboarding flow
│   └── signup/            # User registration
├── components/            # React components
│   ├── modules/           # Module-specific components
│   └── ui/               # Reusable UI components
├── contexts/             # React contexts
├── lib/                  # Utility libraries
├── electron/             # Electron main process
├── scripts/              # Setup and utility scripts
└── data/                 # Sample data and product catalogs
```

## 👥 User Roles

### Distributor
- Manage product catalogs
- Track retailer orders
- Generate invoices
- Monitor GMV and settlements
- View retailer analytics

### Retailer  
- Browse distributor catalogs
- Place orders
- Manage inventory
- Process sales via POS
- Track business metrics

## 🔐 Authentication Flow

1. **Welcome Page** - Landing page for new users
2. **Sign Up** - Google authentication
3. **Onboarding** - Role selection and business information
4. **Dashboard** - Role-specific main interface

## 🗄️ Database Schema

### Collections
- `distributors` - Distributor business profiles
- `retailers` - Retailer business profiles  
- `orders` - Order transactions between distributors and retailers
- `settlements` - Monthly GMV settlements (5% of total sales)
- `invoices` - Generated invoices for orders
- `products` - Product catalog with pricing
- `users` - User authentication and role data

## 🚀 Deployment

### Web Deployment (Vercel)
```bash
npm run build
# Deploy to Vercel, Netlify, or your preferred platform
```

### Desktop App Distribution
```bash
# Build production desktop apps
npm run dist:all

# Apps will be in dist/ directory ready for distribution
```

## 🔧 Configuration Files

- `firebase.json` - Firebase project configuration
- `firestore.rules` - Database security rules
- `firestore.indexes.json` - Database performance indexes
- `electron-builder.json` - Desktop app build configuration
- `next.config.mjs` - Next.js configuration

## 📊 Key Metrics & KPIs

- **GMV Tracking** - Gross Merchandise Value monitoring
- **Settlement System** - Automated 5% commission calculations
- **Order Analytics** - Real-time order tracking and insights
- **Inventory Metrics** - Stock levels and reorder points
- **Sales Performance** - Revenue tracking and trends

## 🛠️ Development Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run electron         # Start Electron app
npm run electron:dev     # Development mode with hot reload
npm run pack            # Package desktop app (no installer)
npm run dist            # Build desktop app with installer
```

## 🐛 Troubleshooting

### Firebase Issues
- Ensure all environment variables are correctly set
- Check Firebase project permissions
- Verify Firestore security rules are deployed

### Build Issues
- Clear `.next` directory and rebuild
- Ensure all dependencies are installed
- Check Node.js version compatibility

### Authentication Issues
- Verify Google OAuth is enabled in Firebase Console
- Check auth domain configuration
- Ensure proper redirect URLs are set

## 📞 Support

For technical support or questions:
- Check the issues section in the repository
- Review the troubleshooting section above
- Contact the development team

## 📄 License

This project is licensed under the MIT License - see the LICENSE.txt file for details.

---

Built with ❤️ for Kenyan retailers and distributors