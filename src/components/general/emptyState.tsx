import { Ban, PlusCircle } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "../ui/button";

interface iAppProps {
    title: string,
    description: string,
    buttonText: string,
    href: string
}

export function EmptyState({ title, buttonText, description, href }: iAppProps) {
    return (
        <div className="flex flex-col flex-1 h-full items-center justify-center 
        rounded-b-md border-dashed border p-8 text-center animate-in fade-in-50">
            <div className="flex items-center justify-center size-20 rounded-full bg-primary/10 mb-4">
                <Ban className="size-10 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">
                {title}
            </h2>
            <p className="mb-8 mt-2 text-center text-sm leading-tight text-muted-foreground">{description}</p>
            <Link href={href} className={buttonVariants()}>
                <PlusCircle className="size-4 mr-2" />
                {buttonText}
            </Link>
        </div>
    );
}