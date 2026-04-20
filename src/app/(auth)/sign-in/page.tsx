import { auth } from '@/lib/auth';
// import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginForm } from './_components/loginForm';
import { headers } from 'next/headers';
import { Suspense } from 'react';

import { AppLoader } from '@/components/shared/app-loader';

const signInPage = async () => {

  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (session) {
    return redirect("/");
  }

  return (
    <Suspense fallback={<AppLoader />}>
      <LoginForm />
    </Suspense>
  )
}

export default signInPage

