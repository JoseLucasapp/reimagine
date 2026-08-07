import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MapView from "@/pages/MapView";

type MapIQModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  dealId?: string;
  dealIds?: string[];
  brandId?: string;
  enableAdvancedTools?: boolean;
};

export function MapIQModal({
  open,
  onOpenChange,
  title = "MapIQ",
  description = "Map tools are scoped to your current deal and brand access.",
  dealId,
  dealIds,
  brandId,
  enableAdvancedTools = false,
}: MapIQModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none gap-0 p-0"
        style={{
          width: "min(1480px, calc(100vw - 96px))",
          height: "min(820px, calc(100vh - 96px))",
          overflow: "hidden",
          borderRadius: 14,
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-main)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <DialogHeader
          className="shrink-0 px-5 py-2.5"
          style={{
            borderBottom: "1px solid var(--border-divider)",
            background: "var(--bg-surface)",
          }}
        >
          <DialogTitle style={{ color: "var(--text-primary)" }}>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <MapView
            embedded
            enableAdvancedTools={enableAdvancedTools}
            requestedDealId={dealId}
            requestedDealIds={dealIds}
            requestedBrandId={brandId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
