import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {

  return (
    <>
      <section className="relative py-20 px-4">
        <div className="flex flex-col items-center justify-center text-center gap-6">
          <Badge variant={"outline"}>Welcome to Tusker management</Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Elevate you Experience
          </h1>
          <p className="max-w-[700px] mt-6 text-lg text-gray-600">
            Discover a world of knowledge with our interactive learning platform. Explore courses, track your progress, and achieve your goals with ease.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <Link
              className={buttonVariants({ size: "lg" })}
              href="/w"
            >
              Explore workspace
            </Link>
            <Link
              className={buttonVariants({
                size: "lg",
                variant: "outline"
              })}
              href="/sign-in"
            >
              Log In
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
