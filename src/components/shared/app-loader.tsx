import { Loader2 } from "lucide-react";

interface AppLoaderProps {
    className?: string;
    size?: "sm" | "md" | "lg";
    fullPage?: boolean;
}

export function AppLoader({ className = "", size = "md", fullPage = false }: AppLoaderProps) {
    const sizeClasses = {
        sm: "h-6 w-6",
        md: "h-12 w-12",
        lg: "h-20 w-20",
    };

    const containerClasses = fullPage
        ? "fixed inset-0 z-[9999] bg-background/50 backdrop-blur-[2px] flex items-center justify-center"
        : "flex flex-col flex-1 items-center justify-center min-h-[60vh] w-full";
    return (
        <div className={`${containerClasses} ${className}`}>
            <div className="relative">
                <div className={`absolute inset-0 blur-xl rounded-full animate-pulse`} />
                <Loader2 className={`${sizeClasses[size]} animate-spin text-primary relative z-10`} />
            </div>
        </div>
    );
}
