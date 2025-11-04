import { Loader2 } from "lucide-react";

interface LoaderProps {
  message?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function Loader({ 
  message = "A carregar dados...", 
  className = "",
  size = "md"
}: LoaderProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12"
  };

  return (
    <div className={`flex items-center justify-center h-64 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
      {message && (
        <span className="ml-2 text-muted-foreground">{message}</span>
      )}
    </div>
  );
}
