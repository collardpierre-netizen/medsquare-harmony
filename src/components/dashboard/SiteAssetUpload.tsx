import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

interface SiteAssetUploadProps {
  folder: string;
  currentUrl: string | null;
  onUpload: (url: string) => void;
  onRemove?: () => void;
  className?: string;
  placeholder?: React.ReactNode;
}

const SiteAssetUpload = ({
  folder,
  currentUrl,
  onUpload,
  onRemove,
  className,
  placeholder,
}: SiteAssetUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Non connecté");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch(`${FUNCTIONS_URL}/upload-site-asset`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Erreur d'upload");
        return;
      }

      onUpload(data.url);
    } catch {
      setError("Erreur réseau");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={cn("relative group inline-block", className)}>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "overflow-hidden bg-muted border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center rounded-xl",
          uploading && "opacity-60 pointer-events-none"
        )}
      >
        {currentUrl ? (
          <img src={currentUrl} alt="Upload" className="w-full h-full object-cover" />
        ) : (
          placeholder || (
            <div className="flex flex-col items-center gap-1 p-4">
              <Camera className="h-6 w-6 text-muted-foreground/40" />
              <span className="text-[10px] text-muted-foreground/60">
                {uploading ? "Upload…" : "Ajouter une photo"}
              </span>
            </div>
          )
        )}

        <div className={cn(
          "absolute inset-0 bg-foreground/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl",
        )}>
          {uploading ? (
            <div className="h-5 w-5 rounded-full border-2 border-background border-t-transparent animate-spin" />
          ) : (
            <Camera className="h-5 w-5 text-background" />
          )}
        </div>
      </div>

      {currentUrl && onRemove && !uploading && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {error && (
        <p className="text-[10px] text-destructive mt-1 text-center">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
};

export default SiteAssetUpload;
