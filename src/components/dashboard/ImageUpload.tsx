import { useState, useRef } from "react";
import { Camera, Upload, X, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  bucket: string;
  folder: string; // typically user id
  currentUrl: string | null;
  onUpload: (url: string) => void;
  onRemove?: () => void;
  shape?: "circle" | "rounded";
  className?: string;
  placeholder?: React.ReactNode;
}

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const ImageUpload = ({
  bucket,
  folder,
  currentUrl,
  onUpload,
  onRemove,
  shape = "circle",
  className,
  placeholder,
}: ImageUploadProps) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE) {
      toast({ variant: "destructive", title: "Image trop volumineuse", description: "Max 5 Mo." });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Format non supporté", description: "Sélectionnez une image (JPG, PNG, WebP)." });
      return;
    }

    setUploading(true);

    const ext = file.name.split(".").pop();
    const fileName = `${folder}/${Date.now()}.${ext}`;

    // Delete old file if exists
    if (currentUrl) {
      const oldPath = extractPath(currentUrl, bucket);
      if (oldPath) {
        await supabase.storage.from(bucket).remove([oldPath]);
      }
    }

    const { error } = await supabase.storage.from(bucket).upload(fileName, file, { upsert: true });

    if (error) {
      toast({ variant: "destructive", title: "Erreur d'upload", description: error.message });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    onUpload(urlData.publicUrl);
    setUploading(false);

    // Reset input
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = async () => {
    if (currentUrl) {
      const oldPath = extractPath(currentUrl, bucket);
      if (oldPath) {
        await supabase.storage.from(bucket).remove([oldPath]);
      }
    }
    onRemove?.();
  };

  return (
    <div className={cn("relative group inline-block", className)}>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "overflow-hidden bg-muted border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center",
          shape === "circle" ? "rounded-full" : "rounded-xl",
          uploading && "opacity-60 pointer-events-none"
        )}
      >
        {currentUrl ? (
          <img src={currentUrl} alt="Upload" className="w-full h-full object-cover" />
        ) : (
          placeholder || (
            <div className="flex flex-col items-center gap-1 p-4">
              <Camera className="h-6 w-6 text-muted-foreground/40" />
              <span className="text-[10px] text-muted-foreground/60">Ajouter</span>
            </div>
          )
        )}

        {/* Overlay */}
        <div className={cn(
          "absolute inset-0 bg-foreground/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
          shape === "circle" ? "rounded-full" : "rounded-xl",
        )}>
          {uploading ? (
            <div className="h-5 w-5 rounded-full border-2 border-background border-t-transparent animate-spin" />
          ) : (
            <Camera className="h-5 w-5 text-background" />
          )}
        </div>
      </div>

      {/* Remove button */}
      {currentUrl && onRemove && !uploading && (
        <button
          onClick={(e) => { e.stopPropagation(); handleRemove(); }}
          className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3.5 w-3.5" />
        </button>
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

function extractPath(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx >= 0) return url.slice(idx + marker.length);
  return null;
}

export default ImageUpload;
