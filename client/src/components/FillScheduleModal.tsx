/**
 * FillScheduleModal
 * Lets the user generate a full content queue (7/15/30 days) in one click.
 * Shows a preview of slots before generating so no credits are burned unnecessarily.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarDays, Sparkles, CheckCircle2, AlertCircle, Clock, Upload } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { CONTENT_TYPE_LABELS } from "@shared/types";

const GENERAL_FORMATS = [
  "hey_tony", "hook_solve", "auditor_showcase",
  "local_tips", "machine_series", "print_digital",
] as const;

const HOUR_OPTIONS = [
  { value: "6", label: "6:00 AM" }, { value: "7", label: "7:00 AM" },
  { value: "8", label: "8:00 AM" }, { value: "9", label: "9:00 AM" },
  { value: "10", label: "10:00 AM" }, { value: "11", label: "11:00 AM" },
  { value: "12", label: "12:00 PM" }, { value: "13", label: "1:00 PM" },
  { value: "14", label: "2:00 PM" }, { value: "15", label: "3:00 PM" },
  { value: "16", label: "4:00 PM" }, { value: "17", label: "5:00 PM" },
  { value: "18", label: "6:00 PM" }, { value: "19", label: "7:00 PM" },
  { value: "20", label: "8:00 PM" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  brandId: number;
  brandName: string;
}

export default function FillScheduleModal({ open, onClose, brandId, brandName }: Props) {
  const utils = trpc.useUtils();

  const [windowDays, setWindowDays] = useState<7 | 15 | 30>(7);
  const [postsPerDay, setPostsPerDay] = useState<1 | 2>(1);
  const [firstPostHour, setFirstPostHour] = useState(9);
  const [secondPostHour, setSecondPostHour] = useState(17);
  const [createAs, setCreateAs] = useState<"draft" | "scheduled">("draft");
  const [useContentSources, setUseContentSources] = useState(true);
  const [generateImages, setGenerateImages] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [imageStats, setImageStats] = useState<{ generated: number; failed: number } | null>(null);

  // Tomorrow as start date
  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const preview = trpc.ai.previewSchedule.useQuery(
    { brandId, windowDays, postsPerDay, firstPostHour, secondPostHour, startDate },
    { enabled: open && !done }
  );

  const fillSchedule = trpc.ai.fillSchedule.useMutation({
    onSuccess: (data) => {
      setCreatedCount(data.created);
      setImageStats({ generated: (data as any).imagesGenerated ?? 0, failed: (data as any).imagesFailed ?? 0 });
      setDone(true);
      utils.post.list.invalidate();
      utils.post.calendar.invalidate();
    },
    onError: (e) => {
      toast.error(`Failed: ${e.message}`);
      setConfirmed(false);
    },
  });

  const handleConfirm = () => {
    setConfirmed(true);
    fillSchedule.mutate({
      brandId,
      windowDays,
      postsPerDay,
      firstPostHour,
      secondPostHour,
      startDate,
      createAs,
      useContentSources,
      generateImages,
    });
  };

  const handleClose = () => {
    setConfirmed(false);
    setDone(false);
    setCreatedCount(0);
    setImageStats(null);
    onClose();
  };

  const slots = preview.data?.slots ?? [];
  const newCount = preview.data?.newCount ?? 0;
  const existingCount = preview.data?.existingCount ?? 0;

  // Group slots by date for display
  const slotsByDate = useMemo(() => {
    const map = new Map<string, typeof slots>();
    for (const slot of slots) {
      const dateKey = new Date(slot.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(slot);
    }
    return Array.from(map.entries());
  }, [slots]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Fill Content Schedule
          </DialogTitle>
          <DialogDescription>
            Generate a full content queue for <strong>{brandName}</strong> in one click. Preview the slots before any AI credits are used.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          // Success state
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto" />
            <div>
              <p className="text-xl font-semibold">{createdCount} posts created!</p>
              <p className="text-muted-foreground mt-1">
                Saved as <strong>{createAs === "draft" ? "drafts" : "scheduled posts"}</strong> — review them in the Posts or Calendar page.
              </p>
              {imageStats && generateImages && (
                <p className="text-sm text-muted-foreground mt-2">
                  {imageStats.generated} image{imageStats.generated !== 1 ? "s" : ""} generated
                  {imageStats.failed > 0 && (
                    <span className="text-yellow-400"> · {imageStats.failed} failed — use the "Needs Image" filter to add them
                    </span>
                  )}
                </p>
              )}
              {!generateImages && (
                <p className="text-sm text-muted-foreground mt-2">
                  No images generated — use the "Needs Image" filter to add custom images to each post.
                </p>
              )}
            </div>
            <Button onClick={handleClose} className="mt-4">Done</Button>
          </div>
        ) : confirmed && fillSchedule.isPending ? (
          // Generating state
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
            <div>
              <p className="text-lg font-semibold">
                Generating {newCount} posts{generateImages ? " with images" : ""}...
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {generateImages
                  ? "Writing content and generating a visual for each post. This may take 1–3 minutes depending on queue size."
                  : "Writing content for each post. This should only take a moment."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Window</Label>
                <Select value={String(windowDays)} onValueChange={(v) => setWindowDays(Number(v) as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="15">15 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Posts per day</Label>
                <Select value={String(postsPerDay)} onValueChange={(v) => setPostsPerDay(Number(v) as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 post/day</SelectItem>
                    <SelectItem value="2">2 posts/day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>First post time</Label>
                <Select value={String(firstPostHour)} onValueChange={(v) => setFirstPostHour(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {postsPerDay === 2 && (
                <div className="space-y-2">
                  <Label>Second post time</Label>
                  <Select value={String(secondPostHour)} onValueChange={(v) => setSecondPostHour(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOUR_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Save posts as</Label>
                <Select value={createAs} onValueChange={(v) => setCreateAs(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Drafts (review before scheduling)</SelectItem>
                    <SelectItem value="scheduled">Scheduled (auto-publish)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <div className="flex items-center gap-2 pb-1">
                  <Switch checked={useContentSources} onCheckedChange={setUseContentSources} id="fill-sources" />
                  <Label htmlFor="fill-sources" className="text-sm cursor-pointer">Mix in services/products</Label>
                </div>
              </div>
            </div>

            {/* Image Source Toggle */}
            <div className="p-3 rounded-lg border border-border bg-secondary/20 space-y-2">
              <Label className="text-sm font-medium">Image Source</Label>
              <RadioGroup
                value={generateImages ? "ai" : "upload"}
                onValueChange={(v) => setGenerateImages(v === "ai")}
                className="flex gap-6"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="ai" id="fill-img-ai" />
                  <span className="text-sm flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Auto-Generate AI Images
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="upload" id="fill-img-upload" />
                  <span className="text-sm flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                    No Images (Upload Later)
                  </span>
                </label>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                {generateImages
                  ? "An AI image will be generated for each post. Adds ~10–20s per post to the total time."
                  : "Posts will be saved without images. Use the \"Needs Image\" filter later to add them."}
              </p>
            </div>

            {/* Slot Preview */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-secondary/50 flex items-center justify-between">
                <span className="text-sm font-medium">Schedule Preview</span>
                <div className="flex items-center gap-2">
                  {existingCount > 0 && (
                    <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">
                      {existingCount} slots already filled
                    </Badge>
                  )}
                  {preview.isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <Badge className="text-xs">{newCount} new posts</Badge>
                  )}
                </div>
              </div>

              {preview.isLoading ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Calculating available slots...
                </div>
              ) : newCount === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  <AlertCircle className="h-5 w-5 mx-auto mb-2 text-yellow-400" />
                  All slots in this window are already filled. Try a longer window or different times.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-border">
                  {slotsByDate.map(([date, daySlots]) => (
                    <div key={date} className="px-4 py-2 flex items-start gap-3">
                      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{date}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {daySlots.map((slot, i) => (
                          <div key={i} className="flex items-center gap-1 text-xs">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {new Date(slot.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </span>
                            <Badge variant="outline" className="text-xs py-0 h-5">
                              {CONTENT_TYPE_LABELS[slot.contentType as keyof typeof CONTENT_TYPE_LABELS] || slot.contentType}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {createAs === "scheduled" && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-300">
                  Posts will be saved as <strong>Scheduled</strong> and published automatically by the cron engine. Make sure your Facebook/Instagram accounts are connected before generating.
                </p>
              </div>
            )}
          </>
        )}

        {!done && !confirmed && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={handleConfirm}
              disabled={newCount === 0 || preview.isLoading}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Generate {newCount > 0 ? `${newCount} Posts` : "Posts"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
