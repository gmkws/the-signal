import { useState, useRef, useCallback } from "react";
import { Upload, X, Image, Video, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MediaUploadButtonProps {
  /** If provided, the upload will also update the post record in the database */
  postId?: number;
  /** For carousel slides: which slide index to update (0-based) */
  slideIndex?: number;
  /** Called with the CDN URL after a successful upload */
  onUploadComplete: (url: string, mediaType: "image" | "video") => void;
  /** Current media URL (to show preview) */
  currentUrl?: string;
  /** Whether to allow video uploads (default: true) */
  allowVideo?: boolean;
  /** Compact mode — shows a small icon button instead of a full drop zone */
  compact?: boolean;
  /** Disabled state */
  disabled?: boolean;
  className?: string;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export function MediaUploadButton({
  postId,
  slideIndex,
  onUploadComplete,
  currentUrl,
  allowVideo = true,
  compact = false,
  disabled = false,
  className,
}: MediaUploadButtonProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptTypes = allowVideo
    ? "image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
    : "image/jpeg,image/png,image/webp";

  const uploadFile = useCallback(async (file: File) => {
    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 50MB.");
      return;
    }

    // Validate type
    const allowed = allowVideo
      ? ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"]
      : ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error(`Unsupported file type. Allowed: ${allowVideo ? "JPG, PNG, WebP, MP4" : "JPG, PNG, WebP"}`);
      return;
    }

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploadState("uploading");
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (postId !== undefined) formData.append("postId", String(postId));
      if (slideIndex !== undefined) formData.append("slideIndex", String(slideIndex));

      // Use XMLHttpRequest for progress tracking
      const result = await new Promise<{ url: string; mediaType: "image" | "video" }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload/media");
        xhr.withCredentials = true;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 90)); // Cap at 90% until server responds
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch {
              reject(new Error("Invalid server response"));
            }
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error ?? `Upload failed (${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(formData);
      });

      setProgress(100);
      setUploadState("success");
      setPreviewUrl(result.url);
      onUploadComplete(result.url, result.mediaType);
      toast.success("Media uploaded successfully.");

      // Reset to idle after 2s
      setTimeout(() => setUploadState("idle"), 2000);
    } catch (err: any) {
      setUploadState("error");
      setPreviewUrl(currentUrl ?? null);
      toast.error(err.message ?? "Upload failed. Please try again.");
      setTimeout(() => setUploadState("idle"), 3000);
    }
  }, [postId, slideIndex, onUploadComplete, currentUrl, allowVideo]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const clearMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewUrl(null);
    setUploadState("idle");
    onUploadComplete("", "image");
  };

  // ── Compact mode: small icon button ──────────────────────────────────────
  if (compact) {
    return (
      <div className={cn("relative inline-flex", className)}>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || uploadState === "uploading"}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploadState === "uploading"}
          className="gap-1.5 text-xs"
        >
          {uploadState === "uploading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : uploadState === "success" ? (
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {uploadState === "uploading" ? `${progress}%` : "Upload"}
        </Button>
      </div>
    );
  }

  // ── Full drop zone mode ───────────────────────────────────────────────────
  return (
    <div className={cn("relative", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || uploadState === "uploading"}
      />

      {/* Preview area */}
      {previewUrl ? (
        <div className="relative rounded-lg overflow-hidden border border-border bg-muted group">
          {previewUrl.match(/\.(mp4|mov|webm)$/i) || (previewUrl.startsWith("blob:") && allowVideo) ? (
            <video
              src={previewUrl}
              className="w-full max-h-64 object-contain"
              controls
              muted
            />
          ) : (
            <img
              src={previewUrl}
              alt="Uploaded media"
              className="w-full max-h-64 object-contain"
            />
          )}

          {/* Overlay controls */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploadState === "uploading"}
            >
              <Upload className="h-4 w-4 mr-1" />
              Replace
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={clearMedia}
              disabled={disabled}
            >
              <X className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>

          {/* Upload progress overlay */}
          {uploadState === "uploading" && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
              <div className="w-32 bg-white/20 rounded-full h-1.5">
                <div
                  className="bg-white h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-white text-sm font-medium">{progress}%</span>
            </div>
          )}

          {/* Success indicator */}
          {uploadState === "success" && (
            <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
              <CheckCircle className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
      ) : (
        /* Drop zone */
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50",
            disabled && "opacity-50 cursor-not-allowed",
            uploadState === "error" && "border-destructive bg-destructive/5"
          )}
        >
          {uploadState === "uploading" ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <div className="w-32 bg-muted rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground">Uploading... {progress}%</span>
            </div>
          ) : uploadState === "error" ? (
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive font-medium">Upload failed</p>
              <p className="text-xs text-muted-foreground">Click to try again</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-2 text-muted-foreground">
                <Image className="h-6 w-6" />
                {allowVideo && <Video className="h-6 w-6" />}
              </div>
              <p className="text-sm font-medium text-foreground">
                {isDragging ? "Drop file here" : "Upload your own media"}
              </p>
              <p className="text-xs text-muted-foreground">
                {allowVideo
                  ? "JPG, PNG, WebP, or MP4 — max 50MB"
                  : "JPG, PNG, or WebP — max 50MB"}
              </p>
              <p className="text-xs text-muted-foreground">
                Drag & drop or click to browse
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
