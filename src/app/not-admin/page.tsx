import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeftIcon, ShieldX } from "lucide-react";
import Link from "next/link";

export default function NotAdmin() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <Card className="max-w-md w-full">
                <CardHeader className="text-center">
                    <div className=" bg-destructive/10 rounded-full p-4 w-fit mx-auto">
                        <ShieldX className="size-16 text-destructive"/>
                    </div>
                    <CardTitle className="text-2xl">Acesses Denied</CardTitle>
                    <CardDescription className="max-w-xs mx-auto">hey user you are not an admin you can&apos;t create any courses or stuff like that</CardDescription>
                </CardHeader>
                <CardContent>
                    <Link className={buttonVariants({
                        className: "w-full"
                    })} href="/">
                        <ArrowLeftIcon className="size-4 mr-1"/>
                    Back to Home
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}