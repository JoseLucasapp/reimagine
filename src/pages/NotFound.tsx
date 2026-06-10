import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-lg text-muted-foreground font-medium">Page not found</p>
        <a href="/" className="text-sm text-brand-orange font-semibold hover:underline">
          Return to Dashboard
        </a>
      </div>
    </div>
  );
};

export default NotFound;
