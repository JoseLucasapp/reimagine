import { useState } from "react";
import {
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  FolderOpen,
  Grid3X3,
  ImageIcon,
  LayoutGrid,
  MapPin,
  Pencil,
  Ruler,
  X,
} from "lucide-react";
import { LeafletSiteMap } from "./LeafletSiteMap";
import { PropertyStatusBar } from "./PropertyStatusBar";
import { AIPropertyInsight } from "./AIPropertyInsight";
import { LandlordCard } from "./LandlordCard";
import { PropertyNotes } from "./PropertyNotes";
import type { DealRecord } from "@/data/dealsData";
import type { Site } from "@/data/mapRuntimeData";

function empty(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function FieldGrid({ title, fields }: { title: string; fields: { label: string; value: string; highlight?: boolean }[] }) {
  return (
    <div className="glass-card-static" style={{ padding: 18, borderRadius: 12 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 12 }}>{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((field) => (
          <div key={field.label}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{field.label}</p>
            <p style={{ fontSize: 14, fontWeight: field.highlight ? 700 : 600, color: field.highlight ? "var(--text-orange-ui)" : "var(--text-primary)" }}>{field.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LightboxGallery({ photos, startIndex, onClose }: { photos: string[]; startIndex: number; onClose: () => void }) {
  const [current, setCurrent] = useState(startIndex);
  const photo = photos[current];

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center" style={{ background: "rgba(13,20,30,0.92)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="absolute top-4 left-4" style={{ fontSize: 12, color: "white", background: "rgba(0,0,0,0.45)", borderRadius: 8, padding: "4px 12px" }}>{current + 1} / {photos.length}</div>
      <button className="absolute top-4 right-4 flex items-center justify-center" onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.15)", color: "white" }}>
        <X className="w-5 h-5" />
      </button>
      <img onClick={(event) => event.stopPropagation()} src={photo} alt="Property" style={{ width: "70vw", maxWidth: 900, height: "60vh", borderRadius: 12, objectFit: "cover", boxShadow: "0 8px 40px rgba(0,0,0,0.50)" }} />
      {current > 0 && (
        <button className="absolute left-6 top-1/2 flex items-center justify-center" onClick={(event) => { event.stopPropagation(); setCurrent((value) => value - 1); }} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)", color: "white", transform: "translateY(-50%)" }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {current < photos.length - 1 && (
        <button className="absolute right-6 top-1/2 flex items-center justify-center" onClick={(event) => { event.stopPropagation(); setCurrent((value) => value + 1); }} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)", color: "white", transform: "translateY(-50%)" }}>
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

function FileZone({ icon, label, url }: { icon: React.ReactNode; label: string; url: string }) {
  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="relative flex flex-col items-start justify-between" style={{ padding: 16, borderRadius: 10, minHeight: 120, background: "rgba(36,60,81,0.06)", border: "1px solid rgba(36,60,81,0.20)", transition: "all 0.20s ease" }}>
        <div className="absolute flex items-center justify-center" style={{ top: 12, right: 12, width: 16, height: 16, borderRadius: "50%", background: "rgba(36,60,81,0.15)" }}>
          <span style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 700 }}>✓</span>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <div style={{ color: "var(--text-primary)" }}>{icon}</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
        </div>
        <span className="truncate w-full" style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", padding: "8px 0" }}>{url}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: 4 }}>View <ExternalLink className="w-3 h-3" /></span>
      </a>
    );
  }

  return (
    <div className="relative flex flex-col items-start justify-between" style={{ padding: 16, borderRadius: 10, minHeight: 120, background: "var(--card-bg)", border: "1.5px dashed var(--border-divider)", transition: "all 0.20s ease" }}>
      <div className="flex items-center relative z-10" style={{ gap: 8 }}>
        <div style={{ color: "var(--text-muted)" }}>{icon}</div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
      </div>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No file URL saved</span>
    </div>
  );
}

export function PropertyTab({ deal, site, onEdit }: { deal: DealRecord; site: Site; onEdit: () => void }) {
  const [photoHovered, setPhotoHovered] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxStart, setLightboxStart] = useState(0);
  const photos = site.photoUrls.filter(Boolean);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
      {lightboxOpen && photos.length > 0 && <LightboxGallery photos={photos} startIndex={lightboxStart} onClose={() => setLightboxOpen(false)} />}
      <div className="space-y-4 min-w-0">
        <div className="glass-card-static overflow-hidden" style={{ borderRadius: 12 }}>
          <div className="relative" style={{ height: 260, background: "linear-gradient(135deg, rgba(36,60,81,0.08), rgba(225,135,57,0.08))" }} onMouseEnter={() => setPhotoHovered(true)} onMouseLeave={() => setPhotoHovered(false)}>
            {photos[0] ? (
              <img src={photos[0]} alt={site.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3" style={{ color: "var(--text-muted)" }}>
                <ImageIcon className="w-10 h-10" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>No property photo saved</span>
              </div>
            )}
            {photos.length > 0 && (
              <button onClick={() => { setLightboxStart(0); setLightboxOpen(true); }} className="absolute bottom-4 right-4 flex items-center gap-2" style={{ padding: "8px 12px", borderRadius: 10, background: photoHovered ? "rgba(13,20,30,0.78)" : "rgba(13,20,30,0.62)", color: "white", fontSize: 12, fontWeight: 700 }}>
                <Camera className="w-4 h-4" /> {photos.length} Photo{photos.length === 1 ? "" : "s"}
              </button>
            )}
          </div>
          <div style={{ padding: 20 }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2" style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 4 }}>
                  <MapPin className="w-4 h-4" /> {site.city}, {site.state}
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{site.name || site.address}</h2>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>{site.address}{site.zipCode ? `, ${site.zipCode}` : ""}</p>
              </div>
              <button onClick={onEdit} className="cta-secondary flex items-center gap-2 self-start"><Pencil className="w-4 h-4" /> Edit Property</button>
            </div>
            <div style={{ marginTop: 18 }}>
              <PropertyStatusBar />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <FieldGrid title="LOCATION" fields={[{ label: "Property Name", value: empty(site.name) }, { label: "Address", value: empty(site.address) }, { label: "City, State", value: `${site.city}, ${site.state}` }, { label: "Zip Code", value: empty(site.zipCode) }]} />
          <FieldGrid title="SPACE SPECS" fields={[{ label: "Square Footage", value: empty(site.squareFootage), highlight: true }, { label: "Space Type", value: empty(site.spaceType) }, { label: "Property Type", value: empty(site.propertyType) }]} />
          <FieldGrid title="LEASE" fields={[{ label: "Landlord", value: empty(site.landlord) }, { label: "Landlord Contact", value: empty(site.landlordContact) }, { label: "Lease Term", value: empty(site.leaseTerm) }, { label: "Possession Date", value: empty(site.possessionDate) }]} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card-static" style={{ padding: 18, borderRadius: 12 }}>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4" style={{ color: "#E18739" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em" }}>MAP</span>
            </div>
            <LeafletSiteMap lat={site.lat} lng={site.lng} label={site.name || site.address} address={site.address} city={site.city} state={site.state} zipCode={site.zipCode} />
          </div>
          <AIPropertyInsight deal={deal} site={site} />
        </div>

        <div className="glass-card-static" style={{ padding: 18, borderRadius: 12 }}>
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen className="w-4 h-4" style={{ color: "#E18739" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em" }}>FILES</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <FileZone icon={<FileText className="w-4 h-4" />} label="Brochure" url={site.brochureUrl} />
            <FileZone icon={<Ruler className="w-4 h-4" />} label="Floor Plan" url={site.floorPlanUrl} />
            <FileZone icon={<ClipboardList className="w-4 h-4" />} label="LOI" url={site.loiUrl} />
            <FileZone icon={<LayoutGrid className="w-4 h-4" />} label="Lease" url={site.leaseUrl} />
          </div>
        </div>
      </div>

      <aside className="space-y-4 min-w-0">
        <LandlordCard />
        <PropertyNotes site={site} />
        <div className="glass-card-static" style={{ padding: 16, borderRadius: 12 }}>
          <div className="flex items-center gap-2 mb-3">
            <Grid3X3 className="w-4 h-4" style={{ color: "#E18739" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em" }}>TOUR DATA</span>
          </div>
          <div className="space-y-2" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            <p><strong>Tour time:</strong> {empty(site.tourTime)}</p>
            <p><strong>Broker:</strong> {empty(site.brokerName)}</p>
            <p><strong>Broker phone:</strong> {empty(site.brokerPhone)}</p>
          </div>
        </div>
        <div className="glass-card-static" style={{ padding: 16, borderRadius: 12 }}>
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4" style={{ color: "#E18739" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em" }}>DEAL</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 700 }}>{deal.franchisee}</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{deal.city}, {deal.state}</p>
        </div>
      </aside>
    </div>
  );
}
