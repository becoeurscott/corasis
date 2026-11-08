import { Redirect } from 'expo-router';
import React from 'react';

/** Account creation is automatic now: the email code creates the account if it doesn't exist. */
export default function SignUp() {
  return <Redirect href="/auth/sign-in" />;
}
