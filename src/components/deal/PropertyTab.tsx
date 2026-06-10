import { useState } from "react";
import { ImageIcon, MapPin, FileText, FolderOpen, ClipboardList, LayoutGrid, Pencil, ExternalLink, Building2, ChevronLeft, ChevronRight, X, Camera, Ruler, Grid3X3 } from "lucide-react";
import { LeafletSiteMap } from "./LeafletSiteMap";
import { PropertyStatusBar } from "./PropertyStatusBar";
import { AIPropertyInsight } from "./AIPropertyInsight";
import { LandlordCard } from "./LandlordCard";
import { PropertyNotes } from "./PropertyNotes";
import propertyStorefront from "@/assets/property-storefront.jpg";
import propertyInterior from "@/assets/property-interior.jpg";
import propertyParking from "@/assets/property-parking.jpg";

interface PropertyTabProps {
  deal: {
    city: string;
    state: string;
    franchisee: string;
  };
}

type PropertyDetailField = {
  label: string;
  value: string | null;
  highlight?: boolean;
};

type PropertyDetailSection = {
  title: string;
  fields: PropertyDetailField[];
};

const PROPERTY_SECTIONS: PropertyDetailSection[] = [
  {
    title: "LOCATION",
    fields: [
      { label: "Property Name", value: "McKinney Ave Location" },
      { label: "Address", value: "3421 McKinney Ave" },
      { label: "City, State", value: "Dallas, TX" },
      { label: "Zip Code", value: "75204" },
    ],
  },
  {
    title: "SPACE SPECS",
    fields: [
      { label: "Square Footage", value: "2,400 SF", highlight: true },
      { label: "Space Type", value: "Inline Retail" },
      { label: "Property Type", value: "Strip Center" },
    ],
  },
  {
    title: "LEASE",
    fields: [
      { label: "Landlord", value: "Crow Holdings" },
      { label: "Landlord Contact", value: null },
      { label: "Lease Term", value: "10 years" },
      { label: "Possession Date", value: null },
    ],
  },
];

const MOCK_PHOTOS = [
  { id: 1, src: propertyStorefront, caption: "Storefront view" },
  { id: 2, src: propertyInterior, caption: "Interior space" },
  { id: 3, src: propertyParking, caption: "Parking area" },
];

// ===== LIGHTBOX GALLERY =====
function LightboxGallery({ photos, startIndex, onClose }: { photos: typeof MOCK_PHOTOS; startIndex: number; onClose: () => void }) {
  const [current, setCurrent] = useState(startIndex);
  const photo = photos[current];

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center" style={{ background: "rgba(13,20,30,0.92)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <div className="absolute top-4 left-4" style={{ fontSize: 12, color: "white", background: "rgba(0,0,0,0.45)", borderRadius: 8, padding: "4px 12px 4px 12px" }}>
        {current + 1} / {photos.length}
      </div>
      <button className="absolute top-4 right-4 flex items-center justify-center" onClick={onClose}
        style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.15)", color: "white" }}>
        <X className="w-5 h-5" />
      </button>
      <img onClick={(e) => e.stopPropagation()} src={photo.src} alt={photo.caption} style={{
        width: "70vw", maxWidth: 900, height: "60vh", borderRadius: 12, objectFit: "cover",
        boxShadow: "0 8px 40px rgba(0,0,0,0.50)",
      }} />
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.60)", marginTop: 12 }}>{photo.caption}</p>
      {current > 0 && (
        <button className="absolute left-6 top-1/2 flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); setCurrent(c => c - 1); }}
          style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", color: "white", transform: "translateY(-50%)" }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {current < photos.length - 1 && (
        <button className="absolute right-6 top-1/2 flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); setCurrent(c => c + 1); }}
          style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", color: "white", transform: "translateY(-50%)" }}>
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
      <div className="flex items-center" style={{ gap: 8, marginTop: 16 }} onClick={(e) => e.stopPropagation()}>
        {photos.map((p, i) => (
          <button key={p.id} onClick={() => setCurrent(i)} style={{
            width: 64, height: 48, borderRadius: 8, overflow: "hidden",
            border: i === current ? "2px solid #E18739" : "2px solid transparent",
            opacity: i === current ? 1 : 0.65, cursor: "pointer", transition: "opacity 0.15s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={(e) => { if (i !== current) e.currentTarget.style.opacity = "0.65"; }}
          >
            <img src={p.src} alt={p.caption} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ===== FILE ZONE =====
function FileZone({ icon, label, subLabel, uploaded, fileName, variant = "default" }: {
  icon: React.ReactNode; label: string; subLabel: string;
  uploaded?: boolean; fileName?: string; variant?: "default" | "folder";
}) {
  const [hovered, setHovered] = useState(false);
  const isFolder = variant === "folder";

  if (uploaded) {
    return (
      <div className="relative flex flex-col items-start justify-between cursor-pointer" style={{
        padding: 16, borderRadius: 10, minHeight: 120,
        background: "rgba(36,60,81,0.06)", border: "1px solid rgba(36,60,81,0.20)", transition: "all 0.20s ease",
      }}>
        <div className="absolute flex items-center justify-center" style={{ top: 12, right: 12, width: 16, height: 16, borderRadius: "50%", background: "rgba(36,60,81,0.15)" }}>
          <span style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 700 }}>✓</span>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <div style={{ color: "var(--text-primary)" }}>{icon}</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
        </div>
        <span className="truncate w-full" style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", padding: "8px 0 8px 0" }}>{fileName}</span>
        <div className="flex items-center" style={{ gap: 8 }}>
          <button style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>View</button>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>·</span>
          <button style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Replace</button>
        </div>
      </div>
    );
  }

  if (isFolder) {
    return (
      <div className="flex flex-col items-start justify-between cursor-pointer" style={{
        padding: 16, borderRadius: 10, minHeight: 120,
        background: hovered ? "rgba(36,60,81,0.08)" : "rgba(36,60,81,0.06)",
        border: hovered ? "1px solid rgba(36,60,81,0.40)" : "1px solid rgba(36,60,81,0.20)",
        transition: "all 0.20s ease",
      }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <div style={{ color: "#243c51" }}>{icon}</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
        </div>
        <div className="flex flex-col">
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>{subLabel}</span>
          <div className="flex flex-col" style={{ gap: 4, marginTop: 4 }}>
            <div className="flex items-center" style={{ gap: 8 }}>
              <FileText className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>LOI_James...</span>
            </div>
            <div className="flex items-center" style={{ gap: 8 }}>
              <FileText className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Floorplan_Mc...</span>
            </div>
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#243c51" }}>Browse all →</span>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-start justify-between cursor-pointer" style={{
      padding: 16, borderRadius: 10, minHeight: 120,
      background: hovered ? "var(--card-hover-bg, rgba(36,60,81,0.03))" : "var(--card-bg)",
      border: hovered ? "1.5px dashed var(--text-muted)" : "1.5px dashed var(--border-divider)",
      transition: "all 0.20s ease", transform: hovered ? "translateY(-1px)" : "none",
      boxShadow: hovered ? "var(--shadow-card)" : "none",
    }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.4 }}>
        {Array.from({ length: 32 }).map((_, i) => (
          <line key={i} x1={i * 12} y1="0" x2={i * 12 - 64} y2="100%" stroke="rgba(36,60,81,0.025)" strokeWidth="1" />
        ))}
      </svg>
      <div className="flex items-center relative z-10" style={{ gap: 8 }}>
        <div style={{ color: hovered ? "var(--text-primary)" : "var(--text-muted)" }}>{icon}</div>
        <span style={{ fontSize: 12, fontWeight: 600, color: hovered ? "var(--text-primary)" : "var(--text-secondary)" }}>{label}</span>
      </div>
      <div className="relative z-10">
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Drop file or click to upload</span>
      </div>
    </div>
  );
}

// ===== MAIN PROPERTY TAB =====
export function PropertyTab({ deal }: PropertyTabProps) {
  const [photoHovered, setPhotoHovered] = useState(false);
  const [editHovered, setEditHovered] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxStart, setLightboxStart] = useState(0);
  const [galleryPillHover, setGalleryPillHover] = useState(false);
  const hasPhotos = true;
  const photos = MOCK_PHOTOS;

  const openLightbox = (idx: number) => { setLightboxStart(idx); setLightboxOpen(true); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[62%_38%]" style={{ gap: 20 }}>
      {lightboxOpen && <LightboxGallery photos={photos} startIndex={lightboxStart} onClose={() => setLightboxOpen(false)} />}

      {/* LEFT COLUMN */}
      <div className="flex flex-col" style={{ gap: 12 }}>
        {/* Property Status Bar */}
        <PropertyStatusBar />

        {/* Photo Gallery Hero */}
        {hasPhotos ? (
          <div className="relative w-full overflow-hidden" style={{ height: 280, borderRadius: 16, boxShadow: "0 4px 24px rgba(36,60,81,0.12)" }}
            onMouseEnter={() => setPhotoHovered(true)} onMouseLeave={() => setPhotoHovered(false)}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, height: "100%" }}>
              {/* Primary image — spans 2 columns */}
              <div className="relative cursor-pointer overflow-hidden" onClick={() => openLightbox(0)}
                style={{ gridColumn: "1 / 3", borderRadius: "16px 0 0 16px" }}>
                <img src={photos[0].src} alt={photos[0].caption} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <div className="absolute bottom-0 left-0 right-0" style={{ height: 80, background: "linear-gradient(to top, rgba(20,35,50,0.75), transparent)" }} />
                <div className="absolute bottom-3 left-3" style={{ color: "white", fontSize: 14, fontWeight: 600 }}>
                  McKinney Ave — {deal.city}, {deal.state}
                </div>
                {/* Gallery trigger pill */}
                <button
                  className="absolute flex items-center"
                  onClick={(e) => { e.stopPropagation(); openLightbox(0); }}
                  onMouseEnter={() => setGalleryPillHover(true)}
                  onMouseLeave={() => setGalleryPillHover(false)}
                  style={{
                    bottom: 12, right: 12, gap: 8,
                    background: galleryPillHover ? "rgba(20,30,40,0.88)" : "rgba(20,30,40,0.72)",
                    backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)",
                    borderRadius: 8, padding: "8px 12px", cursor: "pointer",
                    transition: "background 0.18s, transform 0.18s",
                    transform: galleryPillHover ? "translateY(-1px)" : "none",
                  }}>
                  <Grid3X3 className="w-3 h-3" style={{ color: "white" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "white" }}>View all {photos.length} photos</span>
                </button>
              </div>
              {/* Top-right thumbnail */}
              <div className="relative cursor-pointer overflow-hidden" onClick={() => openLightbox(1)}
                style={{ borderRadius: "0 16px 0 0" }}>
                <img src={photos[1].src} alt={photos[1].caption} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              {/* Bottom-right thumbnail — hidden, use row span instead */}
            </div>
            {/* Third image overlaid on bottom-right */}
            <div className="absolute cursor-pointer overflow-hidden" onClick={() => openLightbox(2)}
              style={{ right: 0, bottom: 0, width: "calc(100% / 3 - 1px)", height: "calc(50% - 1.5px)", borderRadius: "0 0 16px 0" }}>
              <img src={photos[2].src} alt={photos[2].caption} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {photos.length > 3 && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(20,35,50,0.65)" }}>
                  <span style={{ color: "white", fontSize: 20, fontWeight: 700 }}>+{photos.length - 3} more</span>
                </div>
              )}
            </div>
            {/* Floating actions on hover */}
            {photoHovered && (
              <div className="absolute top-3 right-3 flex flex-col" style={{ gap: 8 }}>
                <button style={{
                  background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)", borderRadius: 8,
                  padding: "8px 12px 8px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)", border: "none", cursor: "pointer",
                }}>📷 Add Photo</button>
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full overflow-hidden flex flex-col items-center justify-center cursor-pointer" style={{
            height: 224, borderRadius: 16, boxShadow: "0 4px 24px rgba(36,60,81,0.12)",
            background: "linear-gradient(135deg, #e8eff5 0%, #dce8f0 60%, #d0dfe9 100%)",
          }}>
            <Building2 className="w-8 h-8" style={{ color: "rgba(36,60,81,0.20)" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginTop: 12 }}>Add property photos</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Drag & drop or click to browse</span>
            <button style={{
              background: "rgba(255,255,255,0.90)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.95)", borderRadius: 8,
              padding: "8px 20px 8px 20px", fontSize: 12, fontWeight: 600, color: "hsl(207, 38%, 23%)",
              marginTop: 12,
            }}>📷  Upload Photos</button>
          </div>
        )}

        {/* Map Card */}
        <div className="glass-card-static relative overflow-hidden" style={{ height: 240, borderRadius: 16, padding: 0, boxShadow: "var(--shadow-card)" }}>
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between" style={{
            padding: "12px 16px 12px 16px", background: "linear-gradient(to bottom, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 100%)", backdropFilter: "blur(2px)",
          }}>
            <div className="flex items-center" style={{ gap: 8 }}>
              <MapPin className="w-4 h-4" style={{ color: "#E18739" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>McKinney Ave, {deal.city}, {deal.state} 75201</span>
            </div>
            <a href="#" className="flex items-center" style={{ gap: 4, fontSize: 12, fontWeight: 600, color: "var(--text-orange-ui)" }}>
              Open in Maps <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <LeafletSiteMap lat={32.8198} lng={-96.7970} label="McKinney Ave Location" />
          <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center" style={{
            gap: 8, padding: "12px 16px 12px 16px", background: "linear-gradient(to top, rgba(255,255,255,0.90), transparent)",
          }}>
            {[
              { icon: MapPin, label: `${deal.city}, ${deal.state}` },
              { icon: Ruler, label: "2,400 SF" },
              { icon: Building2, label: "Strip Center" },
            ].map((chip) => (
              <span key={chip.label} className="flex items-center" style={{
                gap: 4, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
                padding: "4px 12px 4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "var(--text-primary)",
                boxShadow: "0 2px 8px rgba(36,60,81,0.10)", border: "1px solid rgba(255,255,255,0.95)",
              }}>
                <chip.icon className="w-3 h-3" style={{ color: "#E18739" }} />
                {chip.label}
              </span>
            ))}
          </div>
        </div>

        {/* AI Property Insight Card */}
        <AIPropertyInsight />

        {/* Divider with centered label */}
        <div className="relative flex items-center" style={{ margin: "4px 0 4px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border-divider)" }} />
          <span style={{
            padding: "0 12px 0 12px", fontSize: 12, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.10em", color: "#243c51", background: "var(--bg-scene, #f5f0eb)",
          }}>Property Files</span>
          <div style={{ flex: 1, height: 1, background: "var(--border-divider)" }} />
        </div>

        {/* Property Files */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <div className="flex flex-col">
              <div className="flex items-center" style={{ gap: 8 }}>
                <Building2 className="w-4 h-4" style={{ color: "#243c51" }} />
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>
                  Property Files
                </span>
              </div>
              <span style={{ fontSize: 12, background: "rgba(36,60,81,0.08)", borderRadius: 4, padding: "4px 8px 4px 8px", color: "#243c51", display: "inline-block", marginTop: 4 }}>
                Site & Space Documents
              </span>
            </div>
            <div className="flex items-center" style={{ gap: 8 }}>
              <div className="rounded-full" style={{ width: 8, height: 8, background: "#243c51" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#243c51" }}>2 of 4 uploaded</span>
            </div>
          </div>
          <div className="grid grid-cols-2" style={{ gap: 12 }}>
            <FileZone icon={<FileText className="w-5 h-5" />} label="Signed LOI" subLabel="" uploaded fileName="LOI_JamesThornton_Dallas.pdf" />
            <FileZone icon={<LayoutGrid className="w-5 h-5" />} label="Floorplan" subLabel="" uploaded fileName="Floorplan_McKinneyAve.pdf" />
            <FileZone icon={<ClipboardList className="w-5 h-5" />} label="Demo Report" subLabel="Upload or drag file" />
            <FileZone icon={<FolderOpen className="w-5 h-5" />} label="All Files" subLabel="2 files uploaded" variant="folder" />
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN — Property Details */}
      <div className="flex flex-col">
        {/* Property Notes — first item */}
        <PropertyNotes />

        <div className="glass-card-static" style={{ padding: 20, marginTop: 12 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border-divider)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)" }}>
              Property Details
            </span>
            <button title="Edit Details" style={{ color: editHovered ? "#E18739" : "var(--text-muted)", transition: "color 0.15s" }}
              onMouseEnter={() => setEditHovered(true)} onMouseLeave={() => setEditHovered(false)}>
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          {PROPERTY_SECTIONS.map((section, si) => (
            <div key={section.title} style={{ marginBottom: si < PROPERTY_SECTIONS.length - 1 ? 16 : 0 }}>
              <span style={{ fontSize: 12, textTransform: "uppercase", color: "var(--text-faint)", letterSpacing: "0.08em", marginBottom: 8, display: "block" }}>
                {section.title}
              </span>
              {section.fields.map((field, fi) => (
                <div key={field.label} className="flex items-start justify-between" style={{
                  padding: "8px 0 8px 0", borderBottom: fi < section.fields.length - 1 ? "1px solid var(--border-divider)" : "none",
                }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{field.label}</span>
                  {field.value ? (
                    <span style={{
                      fontSize: 12, fontWeight: field.highlight ? 600 : 500,
                      color: field.highlight ? "hsl(207, 38%, 23%)" : "var(--text-primary)",
                      textAlign: "right", maxWidth: "55%", wordBreak: "break-word",
                    }}>
                      {field.highlight && <Building2 className="w-3 h-3 inline-block mr-1" style={{ verticalAlign: "middle" }} />}
                      {field.value}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-faint)", fontStyle: "italic" }}>—</span>
                  )}
                </div>
              ))}
              {si < PROPERTY_SECTIONS.length - 1 && <div style={{ borderBottom: "1px solid var(--border-divider)", marginTop: 8 }} />}
            </div>
          ))}
        </div>

        {/* Landlord Card */}
        <LandlordCard />

      </div>
    </div>
  );
}
