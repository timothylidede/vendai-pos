"use client";

import { useEffect } from 'react';

export default function RemovedSignUpPage() {
  useEffect(() => {
    // Redirect any legacy /signup traffic to /login
    window.location.replace('/login');
  }, []);
  return null;
}