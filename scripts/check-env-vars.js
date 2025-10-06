#!/usr/bin/env node

/**
 * Vercel Environment Variable Checker
 * Verifies that Firebase env variables are correctly set without CRLF issues
 */

const chalk = require('chalk');

console.log(chalk.bold.cyan('\n🔍 Checking Environment Variables...\n'));

const requiredVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

const expectedValues = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'AIzaSyDAH3xcghGGn1pQez0fczy6rBP9qqBWfx0',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'auth.vendai.digital',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'vendai-fa58c',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'vendai-fa58c.firebasestorage.app',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '1002924595563',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:1002924595563:web:69923ed21eb2d2a075142e',
};

let hasIssues = false;

requiredVars.forEach((varName) => {
  const value = process.env[varName];
  const expected = expectedValues[varName];
  
  if (!value) {
    console.log(chalk.red(`✗ ${varName}: NOT SET`));
    hasIssues = true;
    return;
  }

  // Check for CRLF characters
  const hasCRLF = value.includes('\r') || value.includes('\n');
  
  // Check for extra whitespace
  const hasWhitespace = value !== value.trim();
  
  // Check if matches expected
  const isCorrect = value === expected;
  
  if (hasCRLF) {
    console.log(chalk.red(`✗ ${varName}: Contains CRLF characters (\\r\\n)`));
    console.log(chalk.yellow(`  Current: ${JSON.stringify(value)}`));
    console.log(chalk.green(`  Expected: ${expected}`));
    hasIssues = true;
  } else if (hasWhitespace) {
    console.log(chalk.yellow(`⚠ ${varName}: Contains extra whitespace`));
    console.log(chalk.yellow(`  Current: "${value}"`));
    console.log(chalk.green(`  Expected: "${expected}"`));
    hasIssues = true;
  } else if (!isCorrect) {
    console.log(chalk.yellow(`⚠ ${varName}: Value doesn't match expected`));
    console.log(chalk.yellow(`  Current: ${value}`));
    console.log(chalk.green(`  Expected: ${expected}`));
    hasIssues = true;
  } else {
    console.log(chalk.green(`✓ ${varName}: OK`));
  }
});

console.log('\n' + chalk.bold('Summary:'));
if (hasIssues) {
  console.log(chalk.red('❌ Issues found! Please update environment variables in Vercel.'));
  console.log(chalk.cyan('\nSteps to fix:'));
  console.log('1. Go to https://vercel.com/timothylidede/vendai-pos/settings/environment-variables');
  console.log('2. Edit each flagged variable');
  console.log('3. Copy the expected value EXACTLY (no extra spaces or line breaks)');
  console.log('4. Save and redeploy');
  process.exit(1);
} else {
  console.log(chalk.green('✅ All environment variables are correctly configured!'));
  process.exit(0);
}
