import { auth } from '@/lib/auth';
// import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { SignUpForm } from './_components/signUpForm';

const signUpPage = async() => {

  const session = await auth.api.getSession({
    headers: await headers()
  });

  if(session){
    return redirect("/");
  }

  return (
    <SignUpForm />
  )
}

export default signUpPage;
