import React, { Suspense } from "react";
import VerifyRequestClient from "./_components/verifyRequestclinte";

export const metadata = {
  title: "Verify Request",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="w-full py-8 text-center">Loading…</div>}>
      <VerifyRequestClient />
    </Suspense>
  )
}
