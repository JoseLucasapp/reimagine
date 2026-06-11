import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Check, GripVertical, Upload, ChevronDown, ChevronRight,
  Camera, Phone, Navigation, FileText, X, Maximize, Minus, Plus, Search,
  ArrowUp, Download, Save, Loader2, ArrowLeft, ChevronLeft, ChevronRight as ChevronRightIcon
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, closestCenter, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getAllSites } from "@/data/mapRuntimeData";

/* ───────── TYPES ───────── */
interface SiteData {
  id: string;
  name: string;
  address: string;
  sf: string;
  baseRent: string;
  nnn: string;
  grossMo: string;
  tourTime: string;
  tourType: "scheduled" | "driveby";
  brokerName: string;
  brokerPhone: string;
  locationNotes: string;
  tourDirections: string;
  uploadedPages: UploadedPage[];
  checked: boolean;
  statusDot: string;
  images: (string | null)[];
}

interface UploadedPage {
  id: string;
  fileName: string;
  label: string;
  wrapStyle: "fullbleed" | "framed";
  type: "pdf" | "image";
}

type PageEditorKey = "instructions" | "schedule" | "map";
type SiteTextField = { [K in keyof SiteData]: SiteData[K] extends string ? K : never }[keyof SiteData];
type SiteValue<K extends keyof SiteData> = SiteData[K];
type FieldFocusHandler = React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;

/* ───────── CSS KEYFRAMES ───────── */
const STYLE_TAG_ID = "tourbook-animations";
function injectAnimations() {
  if (document.getElementById(STYLE_TAG_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = `
    @keyframes updateFlash {
      0%   { box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.00); }
      30%  { box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.50); }
      100% { box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.00); }
    }
    @keyframes fieldPulse {
      0%   { border-color: rgba(36,60,81,0.12); }
      40%  { border-color: #243c51; box-shadow: 0 0 0 3px rgba(36,60,81,0.10); }
      100% { border-color: rgba(36,60,81,0.12); }
    }
    .update-flash { animation: updateFlash 0.8s ease forwards; }
    .field-pulse { animation: fieldPulse 1s ease forwards; }
    .preview-click-zone { cursor: pointer; transition: outline 0.15s ease; border-radius: 4px; }
    .preview-click-zone:hover { outline: 1.5px solid rgba(36,60,81,0.15); }
  `;
  document.head.appendChild(style);
}

/* ───────── ZOOM CONSTANTS ───────── */
const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const ZOOM_LABELS = ["50%", "75%", "100%", "125%", "150%", "200%"];

/* ───────── RUNTIME DATA ───────── */
function createInitialSites(): SiteData[] {
  return getAllSites().map((site) => ({
    id: site.id,
    name: site.address,
    address: `${site.address}, ${site.city}, ${site.state}`,
    sf: "",
    baseRent: "",
    nnn: "",
    grossMo: "",
    tourTime: "",
    tourType: site.stage === "Prospecting" ? "driveby" : "scheduled",
    brokerName: "",
    brokerPhone: "",
    locationNotes: site.notes,
    tourDirections: site.notes,
    uploadedPages: [],
    checked: true,
    statusDot: site.stage === "Open" ? "#065f46" : "#E18739",
    images: [null, null, null, null],
  }));
}

const PROGRESS_MESSAGES = [
  "Composing cover page...", "Building schedule table...", "Generating map overview...",
  "Rendering site pages...", "Applying page frames...", "Finalising PDF...",
];

/* (SortableSiteRow removed — SortableSiteItem is used instead) */

/* ═══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                */
/* ═══════════════════════════════════════════════════════════════ */
export function TourBookGenerator() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [expandedPageEditor, setExpandedPageEditor] = useState<PageEditorKey | null>("instructions");
  const [sites, setSites] = useState<SiteData[]>(() => createInitialSites());
  const [tourDate, setTourDate] = useState("");
  const [franchiseeName, setFranchiseeName] = useState("");
  const [territory, setTerritory] = useState("");
  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [progressMsg, setProgressMsg] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [editingPages, setEditingPages] = useState<Set<number>>(new Set());

  // Editable instruction sections
  const [instructionSections, setInstructionSections] = useState([
    { title: "What to Look For", items: "Ingress/Egress\nVisibility\nParking\nSuite Condition\nSuite Layout\nCompetition Check\nTraffic & Accessibility\nSignage Opportunities\nNeighboring Tenants\nSafety & Atmosphere\nNoise & Surroundings\nWalk the Area" },
    { title: "How to Act", items: "Do not discuss deal terms with leasing agent\nRequest private viewing time if needed\nDon't show too much enthusiasm in front of agent\nFeel free to ask about the property and landlord" },
    { title: "Tips for Touring", items: "Take photos/videos\nBring a notepad\nCarry tape measure" },
    { title: "Next Steps", items: "After tours, we'll regroup to review feedback and decide which locations to pursue with an LOI." },
  ]);

  // Editable map page notes
  const [mapTitle, setMapTitle] = useState("Map Overview");
  const [mapNotes, setMapNotes] = useState("");
  const [flashSections, setFlashSections] = useState<Set<string>>(new Set());
  const [pulseField, setPulseField] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [zoomDropdownOpen, setZoomDropdownOpen] = useState(false);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [dragContext, setDragContext] = useState<"sites" | "configure" | "uploaded" | null>(null);
  const [dragUploadSiteId, setDragUploadSiteId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState(false);

  const coverPhotoInputRef = useRef<HTMLInputElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const editingDotTimers = useRef<Map<number, NodeJS.Timeout>>(new Map());

  useEffect(() => { injectAnimations(); }, []);

  // ─── DnD sensors ───
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const checkedSites = useMemo(() => sites.filter(s => s.checked), [sites]);
  const uncheckedSites = useMemo(() => sites.filter(s => !s.checked), [sites]);
  const canGenerate = checkedSites.length > 0 && tourDate.trim().length > 0;
  const totalUploadedPages = checkedSites.reduce((sum, s) => sum + s.uploadedPages.length, 0);
  const totalPages = 4 + checkedSites.length + totalUploadedPages;

  const getPageEditorKey = (page: number): PageEditorKey | null => {
    if (page === 1) return "instructions";
    if (page === 2) return "schedule";
    if (page === 3) return "map";
    return null;
  };

  // ─── Zoom helpers ───
  const zoomIn = useCallback(() => {
    setZoomLevel(prev => {
      const idx = ZOOM_LEVELS.indexOf(prev);
      if (idx < ZOOM_LEVELS.length - 1) return ZOOM_LEVELS[idx + 1];
      return prev;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const idx = ZOOM_LEVELS.indexOf(prev);
      if (idx > 0) return ZOOM_LEVELS[idx - 1];
      return prev;
    });
  }, []);

  const resetZoom = useCallback(() => setZoomLevel(1.0), []);

  const zoomIdx = ZOOM_LEVELS.indexOf(zoomLevel);
  const zoomLabel = ZOOM_LABELS[zoomIdx] || "100%";

  // ─── Keyboard shortcuts for zoom ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && !e.metaKey && !e.ctrlKey) setActivePage(p => Math.max(0, p - 1));
      if (e.key === "ArrowRight" && !e.metaKey && !e.ctrlKey) setActivePage(p => Math.min(totalPages - 1, p + 1));
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomIn(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") { e.preventDefault(); zoomOut(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "0" || e.key === "1")) { e.preventDefault(); resetZoom(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [totalPages, zoomIn, zoomOut, resetZoom]);

  // ─── Mouse wheel zoom ───
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn();
        else zoomOut();
      }
    };
    stage.addEventListener("wheel", handler, { passive: false });
    return () => stage.removeEventListener("wheel", handler);
  }, [zoomIn, zoomOut]);

  // ─── Flash / editing helpers (same as before) ───
  const triggerFlash = useCallback((sectionId: string) => {
    setFlashSections(prev => new Set(prev).add(sectionId));
    setTimeout(() => {
      setFlashSections(prev => { const n = new Set(prev); n.delete(sectionId); return n; });
    }, 900);
  }, []);

  const markPageEditing = useCallback((pageIdx: number) => {
    setEditingPages(prev => new Set(prev).add(pageIdx));
    const existing = editingDotTimers.current.get(pageIdx);
    if (existing) clearTimeout(existing);
    editingDotTimers.current.set(pageIdx, setTimeout(() => {
      setEditingPages(prev => { const n = new Set(prev); n.delete(pageIdx); return n; });
    }, 2000));
  }, []);

  const getAffectedPages = useCallback((field: string, siteId?: string): number[] => {
    if (field === "tourDate") return [0, 2];
    if (field === "franchisee") return [0];
    if (field === "territory") return [0];
    if (field === "coverPhoto") return [0];
    if (siteId) {
      const siteIdx = checkedSites.findIndex(s => s.id === siteId);
      if (siteIdx < 0) return [];
      const sitePageIdx = 4 + siteIdx;
      if (field === "tourTime" || field === "tourType") return [2, sitePageIdx];
      return [sitePageIdx];
    }
    return [];
  }, [checkedSites]);

  const debouncedUpdate = useCallback((field: string, value: string, setter: (v: string) => void, siteId?: string) => {
    const key = siteId ? `${siteId}-${field}` : field;
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);
    setter(value);
    const pages = getAffectedPages(field, siteId);
    pages.forEach(p => markPageEditing(p));
    debounceTimers.current.set(key, setTimeout(() => { triggerFlash(key); }, 300));
  }, [getAffectedPages, markPageEditing, triggerFlash]);

  const toggleSiteCheck = (id: string) => setSites(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s));

  const updateSite = <K extends keyof SiteData>(id: string, field: K, value: SiteValue<K>) => setSites(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));

  const updateSiteDebounced = useCallback((id: string, field: SiteTextField, value: string) => {
    const pages = getAffectedPages(field as string, id);
    pages.forEach(p => markPageEditing(p));
    const key = `${id}-${field}`;
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);
    updateSite(id, field, value);
    debounceTimers.current.set(key, setTimeout(() => { triggerFlash(key); }, 300));
  }, [getAffectedPages, markPageEditing, triggerFlash]);

  const handleGenerate = useCallback(() => {
    setGenerating(true); setProgressPct(0); setProgressMsg(0);
    const interval = setInterval(() => {
      setProgressPct(prev => { if (prev >= 100) { clearInterval(interval); return 100; } return prev + 2; });
      setProgressMsg(prev => (prev + 1) % PROGRESS_MESSAGES.length);
    }, 150);
    setTimeout(() => { clearInterval(interval); setProgressPct(100); setGenerating(false); setGenerated(true); }, 8000);
  }, []);

  const handleAddUploadedPage = (siteId: string) => {
    const newPage: UploadedPage = { id: `up-${Date.now()}`, fileName: "Floor Plan.pdf", label: "Floor Plan", wrapStyle: "framed", type: "pdf" };
    setSites(prev => prev.map(s => s.id === siteId ? { ...s, uploadedPages: [...s.uploadedPages, newPage] } : s));
  };

  const removeUploadedPage = (siteId: string, pageId: string) => {
    setSites(prev => prev.map(s => s.id === siteId ? { ...s, uploadedPages: s.uploadedPages.filter(p => p.id !== pageId) } : s));
  };

  const toggleWrapStyle = (siteId: string, pageId: string) => {
    setSites(prev => prev.map(s =>
      s.id === siteId ? { ...s, uploadedPages: s.uploadedPages.map(p => p.id === pageId ? { ...p, wrapStyle: p.wrapStyle === "fullbleed" ? "framed" : "fullbleed" } : p) } : s
    ));
  };

  const stepValid = (s: number) => { if (s === 1) return checkedSites.length > 0; if (s === 2) return canGenerate; return true; };
  const getCheckedOrder = (id: string) => { const idx = checkedSites.findIndex(s => s.id === id); return idx >= 0 ? idx + 1 : null; };

  // ─── Preview → left panel sync (only when navigating to site pages) ───
  const prevActivePage = useRef(activePage);
  useEffect(() => {
    if (activePage === prevActivePage.current) return;
    prevActivePage.current = activePage;
    if (activePage >= 4) {
      setExpandedPageEditor(null);
      const siteIdx = activePage - 4;
      if (siteIdx < checkedSites.length) {
        setExpandedSite(checkedSites[siteIdx].id);
        setTimeout(() => {
          document.getElementById(`site-accordion-${checkedSites[siteIdx].id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 100);
      }
    } else if (activePage > 0) {
      const pageEditorKey = getPageEditorKey(activePage);
      setExpandedSite(null);
      setExpandedPageEditor(pageEditorKey);
      setTimeout(() => {
        document.getElementById(pageEditorKey ? `page-editor-${pageEditorKey}` : "field-tourDate")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    } else {
      // Pages 0-3 are global settings (cover, instructions, schedule, map)
      setExpandedSite(null);
      setExpandedPageEditor(null);
      setTimeout(() => {
        const globalSection = document.getElementById("field-tourDate");
        globalSection?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
  }, [activePage, checkedSites]);

  // ─── Reverse click ───
  const handlePreviewClick = useCallback((target: string, siteId?: string) => {
    if (target === "coverPhoto") { setSettingsOpen(true); coverPhotoInputRef.current?.click(); return; }
    if (target === "tourDate" || target === "territory" || target === "franchisee") {
      setSettingsOpen(true);
      setExpandedSite(null);
      setExpandedPageEditor(null);
      setPulseField(target);
      setTimeout(() => { const el = document.getElementById(`field-${target}`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus(); }, 100);
      setTimeout(() => setPulseField(null), 1200);
      return;
    }
    if (siteId) {
      setExpandedPageEditor(null);
      setExpandedSite(siteId);
      setTimeout(() => {
        const el = document.getElementById(`field-${siteId}-${target}`);
        if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.focus(); setPulseField(`${siteId}-${target}`); setTimeout(() => setPulseField(null), 1200); }
      }, 150);
    }
  }, []);

  const handleCoverPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setCoverPhoto(reader.result as string); triggerFlash("coverPhoto"); markPageEditing(0); };
    reader.readAsDataURL(file);
  };
  const removeCoverPhoto = () => { setCoverPhoto(null); triggerFlash("coverPhoto"); };

  const goBack = () => navigate(-1);
  const getPulseClass = (fieldId: string) => pulseField === fieldId ? "field-pulse" : "";

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 32, padding: "6px 9px", fontSize: 12, borderRadius: 6,
    border: "1px solid var(--border-divider)", background: "var(--input-bg, rgba(36,60,81,0.03))",
    color: "var(--text-primary)", outline: "none",
  };
  const focusHandler = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = "var(--text-secondary)"; e.currentTarget.style.background = "var(--card-bg)"; };
  const blurHandler = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = "var(--border-divider)"; e.currentTarget.style.background = "var(--input-bg, rgba(36,60,81,0.03))"; };

  // ─── DnD handlers ───
  const handleDragStart = (event: DragStartEvent) => {
    setDragActiveId(event.active.id as string);
    // Collapse expanded accordion if dragging it
    if (expandedSite === event.active.id) setExpandedSite(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDragActiveId(null);
    setDragContext(null);
    setDragUploadSiteId(null);
    if (!over || active.id === over.id) return;

    // Check if this is an uploaded page drag
    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    if (activeIdStr.startsWith("up-") && overIdStr.startsWith("up-")) {
      // Find which site contains these uploaded pages
      setSites(prev => prev.map(s => {
        const activeIdx = s.uploadedPages.findIndex(p => p.id === activeIdStr);
        const overIdx = s.uploadedPages.findIndex(p => p.id === overIdStr);
        if (activeIdx >= 0 && overIdx >= 0) {
          return { ...s, uploadedPages: arrayMove(s.uploadedPages, activeIdx, overIdx) };
        }
        return s;
      }));
      return;
    }

    // Site reorder
    setSites(prev => {
      const oldIdx = prev.findIndex(s => s.id === active.id);
      const newIdx = prev.findIndex(s => s.id === over.id);
      if (oldIdx >= 0 && newIdx >= 0) return arrayMove(prev, oldIdx, newIdx);
      return prev;
    });
  };

  const draggedSite = dragActiveId ? sites.find(s => s.id === dragActiveId) : null;

  // ─── Zoom scaled width (responsive) ───
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
  const baseMaxWidth = isMobileView ? Math.min(window.innerWidth - 32, 360) : 560;
  const scaledWidth = baseMaxWidth * zoomLevel;

  const coverPhotoInput = (
    <input ref={coverPhotoInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handleCoverPhotoUpload} />
  );

  // ─── Sortable site IDs ───
  const sortableSiteIds = sites.map(s => s.id);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
        {coverPhotoInput}

        {/* ══ HEADER (52px) ══ */}
        <div className="shrink-0 flex items-center justify-between" style={{
          height: 52, padding: "0 12px 0 12px", background: "var(--card-bg)", borderBottom: "1px solid var(--border-divider)", zIndex: 100,
        }}>
          <div className="flex items-center" style={{ gap: 8, minWidth: 0 }}>
            <button onClick={goBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}>
              <ArrowLeft className="w-[15px] h-[15px]" style={{ color: "var(--text-muted)" }} />
            </button>
            <div className="hidden sm:block" style={{ width: 1, height: 18, background: "rgba(36,60,81,0.12)" }} />
            <span className="hidden sm:inline" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>Tour Book Generator</span>
            <span className="sm:inline hidden" style={{ background: "#243c51", color: "white", fontSize: 12, fontWeight: 600, borderRadius: 20, padding: "3px 11px", whiteSpace: "nowrap" }}>GolfTRK — Las Vegas, NV</span>
            <span className="sm:hidden" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>Tour Book</span>
          </div>
          <div className="flex items-center" style={{ gap: 6 }}>
            {/* Mobile panel toggle */}
            <button onClick={() => setMobilePanel(!mobilePanel)} className="md:hidden flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, color: mobilePanel ? "white" : "var(--text-secondary)", padding: "5px 10px", borderRadius: 6, background: mobilePanel ? "#243c51" : "rgba(36,60,81,0.06)", border: "none", cursor: "pointer" }}>
              {mobilePanel ? <><X className="w-3.5 h-3.5" /> Close</> : <><FileText className="w-3.5 h-3.5" /> Edit</>}
            </button>
            <button onClick={goBack} className="hidden sm:block" style={{ fontSize: 12, color: "var(--text-muted)", padding: "5px 10px", borderRadius: 6, background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(36,60,81,0.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>Cancel</button>
            <button onClick={handleGenerate} disabled={!canGenerate || generating}
              style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 7, border: "none", cursor: canGenerate && !generating ? "pointer" : "not-allowed", background: "#243c51", color: "white", opacity: canGenerate && !generating ? 1 : 0.35, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              {generating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> <span className="hidden sm:inline">Generating...</span></> : <><span className="hidden sm:inline">Generate PDF</span><span className="sm:hidden">PDF</span></>}
            </button>
          </div>
        </div>

        {/* ══ THREE-COLUMN BODY ══ */}
        <div className="flex flex-1 relative" style={{ height: "calc(100vh - 52px)", overflow: "hidden" }}>

          {/* Mobile overlay backdrop */}
          {mobilePanel && <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setMobilePanel(false)} />}

          {/* ── LEFT PANEL ── */}
          <div className={`shrink-0 flex flex-col fixed md:relative inset-y-0 left-0 z-50 md:z-auto transition-transform duration-200 ${mobilePanel ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`} style={{ width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100vw' : 352, background: "var(--card-bg)", borderRight: "1px solid var(--border-divider)", overflow: "hidden", top: 52 }}>
            {/* Panel header */}
            <div className="shrink-0 flex items-center justify-between" style={{ height: 44, borderBottom: "1px solid var(--border-divider)", padding: "0 16px" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Tour Book</span>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", background: "rgba(36,60,81,0.08)", borderRadius: 10, padding: "2px 8px" }}>{checkedSites.length} / {sites.length} sites</span>
                <button onClick={() => setMobilePanel(false)} className="md:hidden flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(36,60,81,0.08)", border: "none", cursor: "pointer" }}>
                  <X className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                </button>
              </div>
            </div>

            <div ref={leftPanelRef} className="flex-1 overflow-y-auto" style={{ padding: 16, scrollbarWidth: "thin", scrollbarColor: "rgba(36,60,81,0.15) transparent" }}>
              {/* ── BOOK SETTINGS (collapsible) ── */}
              <div style={{ marginBottom: 14 }}>
                <button onClick={() => setSettingsOpen(!settingsOpen)} className="flex items-center justify-between w-full" style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 8px", marginBottom: settingsOpen ? 0 : 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>Book Settings</span>
                  <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)", transition: "transform 0.2s ease", transform: settingsOpen ? "rotate(90deg)" : "rotate(0deg)" }} />
                </button>
                {settingsOpen && (<>
                  <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-divider)", borderRadius: 10, padding: 14 }}>
                    <div className="flex flex-col" style={{ gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Tour Date(s)</label>
                        <input id="field-tourDate" value={tourDate} onChange={e => debouncedUpdate("tourDate", e.target.value, setTourDate)} placeholder="e.g. January 20 & 21, 2026" className={getPulseClass("tourDate")} style={{ ...inputStyle, height: 36 }} onFocus={focusHandler} onBlur={blurHandler} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Franchisee Name</label>
                        <input id="field-franchisee" value={franchiseeName} onChange={e => debouncedUpdate("franchisee", e.target.value, setFranchiseeName)} className={getPulseClass("franchisee")} style={{ ...inputStyle, height: 36 }} onFocus={focusHandler} onBlur={blurHandler} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Territory</label>
                        <input id="field-territory" value={territory} onChange={e => debouncedUpdate("territory", e.target.value, setTerritory)} className={getPulseClass("territory")} style={{ ...inputStyle, height: 36 }} onFocus={focusHandler} onBlur={blurHandler} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Cover Photo</label>
                        {coverPhoto ? (
                          <div className="relative" style={{ borderRadius: 6, overflow: "hidden", height: 80 }}>
                            <img src={coverPhoto} alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            <button onClick={removeCoverPhoto} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.50)", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <button onClick={() => coverPhotoInputRef.current?.click()} style={{ ...inputStyle, height: 36, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "var(--text-muted)" }}><Camera className="w-3 h-3" /> Upload cover photo</button>
                        )}
                      </div>
                    </div>
                  </div>
                </>)}
              </div>

              {/* ── TOUR PAGES ── */}
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", display: "block", marginBottom: 8 }}>Tour Pages</span>
                <div className="flex flex-col" style={{ gap: 6 }}>
                  <PageEditorRow
                    id="instructions"
                    pageLabel="Page 2"
                    title="Instructions"
                    description="Edit the guidance shown before the site pages."
                    isExpanded={expandedPageEditor === "instructions"}
                    onToggle={() => {
                      const nextExpanded = expandedPageEditor === "instructions" ? null : "instructions";
                      setExpandedPageEditor(nextExpanded);
                      setExpandedSite(null);
                      setActivePage(1);
                    }}
                  >
                    {instructionSections.map((section, sIdx) => (
                      <div key={sIdx} style={{ marginBottom: sIdx < instructionSections.length - 1 ? 10 : 0 }}>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Section Title</label>
                        <input value={section.title} onChange={e => {
                          const val = e.target.value;
                          setInstructionSections(prev => prev.map((s, i) => i === sIdx ? { ...s, title: val } : s));
                          markPageEditing(1);
                        }} style={{ ...inputStyle, height: 36 }} onFocus={focusHandler} onBlur={blurHandler} />
                        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4, marginTop: 6 }}>Items (one per line)</label>
                        <textarea value={section.items} onChange={e => {
                          const val = e.target.value;
                          setInstructionSections(prev => prev.map((s, i) => i === sIdx ? { ...s, items: val } : s));
                          markPageEditing(1);
                          e.currentTarget.style.height = "auto";
                          e.currentTarget.style.height = e.currentTarget.scrollHeight + "px";
                        }} style={{ ...inputStyle, height: "auto", minHeight: 56, resize: "vertical", overflow: "hidden" }} onFocus={focusHandler} onBlur={blurHandler} />
                      </div>
                    ))}
                  </PageEditorRow>

                  <PageEditorRow
                    id="schedule"
                    pageLabel="Page 3"
                    title="Schedule"
                    description="Manage times and tour types for checked sites in one place."
                    isExpanded={expandedPageEditor === "schedule"}
                    onToggle={() => {
                      const nextExpanded = expandedPageEditor === "schedule" ? null : "schedule";
                      setExpandedPageEditor(nextExpanded);
                      setExpandedSite(null);
                      setActivePage(2);
                    }}
                  >
                    <div className="flex flex-col" style={{ gap: 8 }}>
                      {checkedSites.map(site => (
                        <div key={site.id} style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border-divider)", background: "var(--input-bg, rgba(36,60,81,0.03))" }}>
                          <div style={{ marginBottom: 8 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", margin: 0, lineHeight: 1.3 }}>{site.name}</p>
                            <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "2px 0 0", lineHeight: 1.3 }}>{site.address}</p>
                          </div>
                          <div className="flex flex-col" style={{ gap: 8 }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Tour Time</label>
                              <input id={`field-${site.id}-tourTime`} value={site.tourTime} onChange={e => updateSiteDebounced(site.id, "tourTime", e.target.value)} placeholder="e.g. 9:00 AM" className={getPulseClass(`${site.id}-tourTime`)} style={{ ...inputStyle, height: 32 }} onFocus={focusHandler} onBlur={blurHandler} />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Tour Type</label>
                              <div className="flex" style={{ width: "100%", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-divider)" }}>
                                {(["scheduled", "driveby"] as const).map(t => (
                                  <button key={t} onClick={() => { updateSite(site.id, "tourType", t); const pages = getAffectedPages("tourType", site.id); pages.forEach(p => markPageEditing(p)); triggerFlash(`${site.id}-tourType`); }}
                                    style={{ flex: 1, height: 32, fontSize: 11, cursor: "pointer", border: "none", background: site.tourType === t ? "#243c51" : "transparent", color: site.tourType === t ? "#ffffff" : "var(--text-muted)", fontWeight: site.tourType === t ? 600 : 500, transition: "all 0.15s ease" }}>
                                    {t === "scheduled" ? "Scheduled" : "Drive-by"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </PageEditorRow>

                  <PageEditorRow
                    id="map"
                    pageLabel="Page 4"
                    title="Map Overview"
                    description="Control the map title and supporting notes."
                    isExpanded={expandedPageEditor === "map"}
                    onToggle={() => {
                      const nextExpanded = expandedPageEditor === "map" ? null : "map";
                      setExpandedPageEditor(nextExpanded);
                      setExpandedSite(null);
                      setActivePage(3);
                    }}
                  >
                    <div>
                      <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Map Title</label>
                      <input value={mapTitle} onChange={e => { setMapTitle(e.target.value); markPageEditing(3); }} style={{ ...inputStyle, height: 36 }} onFocus={focusHandler} onBlur={blurHandler} />
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Map Notes</label>
                      <textarea value={mapNotes} onChange={e => { setMapNotes(e.target.value); markPageEditing(3); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = e.currentTarget.scrollHeight + "px"; }} placeholder="Add notes about the map or area..." style={{ ...inputStyle, height: "auto", minHeight: 56, resize: "vertical", overflow: "hidden" }} onFocus={focusHandler} onBlur={blurHandler} />
                    </div>
                  </PageEditorRow>
                </div>
              </div>

              {/* ── SITES LIST (unified: checkbox + drag + expandable editing) ── */}
              <div>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", display: "block", marginBottom: 8 }}>Sites</span>
                <SortableContext items={sortableSiteIds} strategy={verticalListSortingStrategy}>
                  {sites.map((site, idx) => {
                    const order = getCheckedOrder(site.id);
                    return (
                      <UnifiedSiteRow
                        key={site.id} site={site} order={order} idx={idx}
                        isExpanded={expandedSite === site.id}
                        isHighlighted={activePage >= 4 && checkedSites[activePage - 4]?.id === site.id}
                        onToggleCheck={() => toggleSiteCheck(site.id)}
                        onToggleExpand={() => {
                          const expanding = expandedSite !== site.id;
                          setExpandedSite(expanding ? site.id : null);
                          if (expanding && site.checked) {
                            const siteIdx = checkedSites.findIndex(s => s.id === site.id);
                            if (siteIdx >= 0) setActivePage(4 + siteIdx);
                          }
                        }}
                        inputStyle={inputStyle} focusHandler={focusHandler} blurHandler={blurHandler}
                        getPulseClass={getPulseClass} updateSiteDebounced={updateSiteDebounced}
                        updateSite={updateSite} getAffectedPages={getAffectedPages} markPageEditing={markPageEditing}
                        triggerFlash={triggerFlash} handleAddUploadedPage={handleAddUploadedPage}
                        removeUploadedPage={removeUploadedPage} toggleWrapStyle={toggleWrapStyle}
                        setSites={setSites}
                      />
                    );
                  })}
                </SortableContext>
                <div className="flex flex-col" style={{ paddingTop: 12, borderTop: "1px solid rgba(36,60,81,0.08)", marginTop: 8, gap: 6 }}>
                  <button style={{ fontSize: 12, color: "#b85c1a", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>↑ Import CSV</button>
                  <button onClick={() => {
                    const newId = `tb-${Date.now()}`;
                    setSites(prev => [...prev, {
                      id: newId, name: "New Site", address: "", sf: "", baseRent: "", nnn: "", grossMo: "",
                      tourTime: "", tourType: "scheduled", brokerName: "", brokerPhone: "",
                      locationNotes: "", tourDirections: "", uploadedPages: [], checked: true, statusDot: "var(--text-muted)",
                      images: [null, null, null, null],
                    }]);
                    toast.success("New site added");
                  }} style={{ fontSize: 12, color: "#b85c1a", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>+ Add manually</button>
                </div>
              </div>
            </div>
          </div>

          {/* ── CENTER STAGE ── */}
          <div ref={stageRef} className="flex-1 flex flex-col items-center" style={{
            background: "#1c2b38", padding: "12px 8px", gap: 12,
            overflow: zoomLevel > 1.0 ? "auto" : "hidden",
            justifyContent: zoomLevel > 1.0 ? "flex-start" : "center",
            position: "relative",
          }}>
            {generating ? (
              <div style={{ maxWidth: 340, padding: 36, borderRadius: 12, background: "white", boxShadow: "0 4px 24px rgba(0,0,0,0.25)", textAlign: "center" }}>
                <BookOpen className="w-9 h-9 mx-auto" style={{ color: "#243c51", marginBottom: 14 }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1b2326", margin: 0 }}>Generating your tour book</h3>
                <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>About 8 seconds</p>
                <div style={{ marginTop: 20, width: "100%", height: 4, borderRadius: 2, background: "rgba(36,60,81,0.10)", overflow: "hidden" }}>
                  <div style={{ width: `${progressPct}%`, height: 4, borderRadius: 2, background: "#243c51", transition: "width 0.15s linear" }} />
                </div>
                <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>{PROGRESS_MESSAGES[progressMsg]}</p>
              </div>
            ) : generated ? (
              <div style={{ maxWidth: 340, padding: 36, borderRadius: 12, background: "white", boxShadow: "0 4px 24px rgba(0,0,0,0.25)", textAlign: "center" }}>
                <div className="mx-auto flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(5,150,105,0.10)" }}>
                  <Check className="w-5 h-5" style={{ color: "#065f46" }} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1b2326", marginTop: 14, margin: "14px 0 0" }}>Tour book ready</h3>
                <div className="flex items-center justify-center" style={{ gap: 6, marginTop: 6 }}>
                  <FileText className="w-3 h-3" style={{ color: "#E18739" }} />
                  <span style={{ fontSize: 12, color: "#6b7280" }}>GolfTRK_Las-Vegas_Tour-Book.pdf</span>
                </div>
                <div className="flex items-center justify-center" style={{ gap: 10, marginTop: 18 }}>
                  <button onClick={() => toast.success("PDF downloaded!")} style={{ padding: "8px 20px", borderRadius: 7, background: "#243c51", color: "white", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer" }}>Download PDF</button>
                  <button onClick={() => { setGenerated(false); setStep(3); }} style={{ padding: "8px 20px", borderRadius: 7, background: "transparent", color: "#243c51", fontSize: 14, fontWeight: 600, border: "1px solid #243c51", cursor: "pointer" }}>Open Preview</button>
                </div>
                <button onClick={() => toast.success("Saved to Deal Files")} className="flex items-center justify-center mx-auto" style={{ gap: 5, marginTop: 10, fontSize: 12, color: "#b85c1a", background: "none", border: "none", cursor: "pointer" }}><Save className="w-3 h-3" /> Save to Deal Files</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between" style={{ width: "100%", maxWidth: scaledWidth, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.40)", letterSpacing: "0.08em" }}>PREVIEW</span>
                  <div className="flex items-center gap-3">
                    {/* Mobile page nav */}
                    <div className="flex items-center gap-2 md:hidden">
                      <button onClick={() => setActivePage(p => Math.max(0, p - 1))} disabled={activePage === 0} style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.10)", border: "none", color: "white", cursor: activePage === 0 ? "not-allowed" : "pointer", opacity: activePage === 0 ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft className="w-4 h-4" /></button>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", minWidth: 60, textAlign: "center" }}>{activePage + 1} / {totalPages}</span>
                      <button onClick={() => setActivePage(p => Math.min(totalPages - 1, p + 1))} disabled={activePage === totalPages - 1} style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.10)", border: "none", color: "white", cursor: activePage === totalPages - 1 ? "not-allowed" : "pointer", opacity: activePage === totalPages - 1 ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRightIcon className="w-4 h-4" /></button>
                    </div>
                    <span className="hidden md:inline" style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Page {activePage + 1} of {totalPages}</span>
                  </div>
                </div>

                {/* Page frame with zoom */}
                <div style={{
                  width: scaledWidth, maxWidth: "none", aspectRatio: "8.5 / 11",
                  background: "white", borderRadius: 3, overflow: "hidden", flexShrink: 0,
                  boxShadow: "0 24px 64px rgba(0,0,0,0.50), 0 4px 16px rgba(0,0,0,0.30)",
                  position: "relative", transition: "width 0.2s ease",
                }}>
                  <div style={{ width: 742, height: 960, transform: `scale(${(scaledWidth / 742)})`, transformOrigin: "top left" }}>
                    <ActivePageRenderer activePage={activePage} checkedSites={checkedSites} tourDate={tourDate} territory={territory} franchisee={franchiseeName} totalPages={totalPages} coverPhoto={coverPhoto} flashSections={flashSections} onPreviewClick={handlePreviewClick} onSiteImageUpload={(siteId, imageIdx, dataUrl) => { setSites(prev => prev.map(s => s.id === siteId ? { ...s, images: s.images.map((img, i) => i === imageIdx ? dataUrl : img) } : s)); }} instructionSections={instructionSections} mapTitle={mapTitle} mapNotes={mapNotes} />
                  </div>
                </div>

                {/* Navigation bar */}
                <div className="flex items-center shrink-0" style={{ gap: 10 }}>
                  <button onClick={() => setActivePage(p => Math.max(0, p - 1))} disabled={activePage === 0}
                    style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.60)", display: "flex", alignItems: "center", justifyContent: "center", cursor: activePage === 0 ? "not-allowed" : "pointer", opacity: activePage === 0 ? 0.20 : 1 }}
                    onMouseEnter={e => { if (activePage > 0) e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center" style={{ gap: 3 }}>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <div key={i} onClick={() => setActivePage(i)} style={{ width: activePage === i ? 20 : 4, height: 4, borderRadius: activePage === i ? 2 : "50%", background: activePage === i ? "white" : "rgba(255,255,255,0.22)", cursor: "pointer", transition: "width 0.2s ease" }} />
                    ))}
                  </div>
                  <button onClick={() => setActivePage(p => Math.min(totalPages - 1, p + 1))} disabled={activePage === totalPages - 1}
                    style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.60)", display: "flex", alignItems: "center", justifyContent: "center", cursor: activePage === totalPages - 1 ? "not-allowed" : "pointer", opacity: activePage === totalPages - 1 ? 0.20 : 1 }}
                    onMouseEnter={e => { if (activePage < totalPages - 1) e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}>
                    <ChevronRightIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* ── ZOOM CONTROL BAR ── */}
                <div style={{
                  position: "sticky", bottom: 16, alignSelf: "center",
                  display: "flex", alignItems: "center", gap: 2,
                  background: "rgba(20,35,48,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, padding: 4, zIndex: 20,
                  marginTop: -48,
                }}>
                  <button onClick={zoomOut} disabled={zoomIdx === 0}
                    style={{ width: 32, height: 32, borderRadius: 7, background: "transparent", border: "none", color: "rgba(255,255,255,0.70)", fontSize: 18, fontWeight: 300, cursor: zoomIdx === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: zoomIdx === 0 ? 0.25 : 1, transition: "background 0.12s" }}
                    onMouseEnter={e => { if (zoomIdx > 0) e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                    <Minus className="w-4 h-4" />
                  </button>

                  {/* Zoom level dropdown trigger */}
                  <div style={{ position: "relative" }}>
                    <button onClick={() => setZoomDropdownOpen(!zoomDropdownOpen)}
                      style={{ minWidth: 52, height: 32, borderRadius: 7, background: "transparent", border: "none", color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "background 0.12s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                      {zoomLabel} <ChevronDown className="w-3 h-3" style={{ opacity: 0.5 }} />
                    </button>
                    {zoomDropdownOpen && (
                      <>
                        <div style={{ position: "fixed", inset: 0, zIndex: 29 }} onClick={() => setZoomDropdownOpen(false)} />
                        <div style={{
                          position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
                          background: "rgba(28,43,56,0.96)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 10, padding: 4, minWidth: 88, zIndex: 30,
                        }}>
                          {ZOOM_LEVELS.map((level, i) => (
                            <button key={level} onClick={() => { setZoomLevel(level); setZoomDropdownOpen(false); }}
                              style={{
                                width: "100%", height: 32, padding: "0 12px", borderRadius: 7, fontSize: 12, border: "none",
                                color: level === zoomLevel ? "white" : "rgba(255,255,255,0.70)",
                                fontWeight: level === zoomLevel ? 600 : 400,
                                display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                                background: "transparent", transition: "background 0.1s",
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                              {ZOOM_LABELS[i]}
                              {level === zoomLevel && <span style={{ fontSize: 12, color: "#E18739" }}>✓</span>}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <button onClick={resetZoom} title="Fit to page"
                    style={{ width: 32, height: 32, borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.60)", transition: "background 0.12s, color 0.12s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "white"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.60)"; }}>
                    <Maximize className="w-3.5 h-3.5" />
                  </button>

                  <button onClick={zoomIn} disabled={zoomIdx === ZOOM_LEVELS.length - 1}
                    style={{ width: 32, height: 32, borderRadius: 7, background: "transparent", border: "none", color: "rgba(255,255,255,0.70)", fontSize: 18, fontWeight: 300, cursor: zoomIdx === ZOOM_LEVELS.length - 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: zoomIdx === ZOOM_LEVELS.length - 1 ? 0.25 : 1, transition: "background 0.12s" }}
                    onMouseEnter={e => { if (zoomIdx < ZOOM_LEVELS.length - 1) e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── FILMSTRIP (72px) — hidden on mobile ── */}
          <div className="shrink-0 hidden md:flex flex-col items-center" style={{ width: 72, background: "#1c2b38", borderLeft: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", padding: "12px 6px", gap: 6, scrollbarWidth: "none" as const }}>
            <FilmstripThumb active={activePage === 0} onClick={() => setActivePage(0)} type="cover" editing={editingPages.has(0)} zoomed={zoomLevel > 1.0 && activePage === 0} />
            <FilmstripThumb active={activePage === 1} onClick={() => setActivePage(1)} type="guide" editing={editingPages.has(1)} zoomed={zoomLevel > 1.0 && activePage === 1} />
            <FilmstripThumb active={activePage === 2} onClick={() => setActivePage(2)} type="schedule" editing={editingPages.has(2)} zoomed={zoomLevel > 1.0 && activePage === 2} />
            <FilmstripThumb active={activePage === 3} onClick={() => setActivePage(3)} type="map" editing={editingPages.has(3)} zoomed={zoomLevel > 1.0 && activePage === 3} />
            {checkedSites.map((site, i) => (
              <FilmstripThumb key={`site-${site.id}`} active={activePage === 4 + i} onClick={() => setActivePage(4 + i)} type="site" editing={editingPages.has(4 + i)} zoomed={zoomLevel > 1.0 && activePage === 4 + i} />
            ))}
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {draggedSite ? (
          <div style={{ background: "var(--card-bg)", borderRadius: 8, border: "1px solid var(--border-divider)", boxShadow: "0 8px 24px rgba(36,60,81,0.16)", padding: "0 12px", height: 48, display: "flex", alignItems: "center", gap: 8, opacity: 0.95, width: 248 }}>
            <GripVertical className="w-3 h-3" style={{ color: "rgba(36,60,81,0.25)" }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{draggedSite.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ═══ UNIFIED SITE ROW (checkbox + drag + expandable editing) ═══ */
function UnifiedSiteRow({ site, order, idx, isExpanded, isHighlighted, onToggleCheck, onToggleExpand, inputStyle, focusHandler, blurHandler, getPulseClass, updateSiteDebounced, updateSite, getAffectedPages, markPageEditing, triggerFlash, handleAddUploadedPage, removeUploadedPage, toggleWrapStyle, setSites }: {
  site: SiteData; order: number | null; idx: number; isExpanded: boolean; isHighlighted: boolean;
  onToggleCheck: () => void; onToggleExpand: () => void;
  inputStyle: React.CSSProperties; focusHandler: FieldFocusHandler; blurHandler: FieldFocusHandler; getPulseClass: (f: string) => string;
  updateSiteDebounced: (id: string, field: SiteTextField, value: string) => void;
  updateSite: <K extends keyof SiteData>(id: string, field: K, value: SiteValue<K>) => void;
  getAffectedPages: (field: string, siteId?: string) => number[];
  markPageEditing: (p: number) => void; triggerFlash: (s: string) => void;
  handleAddUploadedPage: (id: string) => void; removeUploadedPage: (id: string, pid: string) => void;
  toggleWrapStyle: (id: string, pid: string) => void; setSites: React.Dispatch<React.SetStateAction<SiteData[]>>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: site.id });
  const rowStyle: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, marginBottom: 4 };

  return (
    <div ref={setNodeRef} style={rowStyle} id={`site-accordion-${site.id}`} {...attributes}>
      <div style={{
        borderRadius: 8,
        border: isExpanded ? "1.5px solid rgba(225,135,57,0.55)" : isHighlighted ? "1.5px solid rgba(36,60,81,0.22)" : "1px solid rgba(36,60,81,0.08)",
        boxShadow: isExpanded ? "0 0 0 2px rgba(225,135,57,0.10)" : "none",
        overflow: "hidden",
        transition: "all 0.15s ease",
      }}>
      <div className="flex items-center"
        style={{
          height: 44, padding: "0 6px", gap: 6,
          background: isExpanded ? "rgba(36,60,81,0.025)" : isHighlighted ? "rgba(36,60,81,0.05)" : site.checked ? "rgba(36,60,81,0.03)" : "transparent",
          cursor: "pointer", transition: "all 0.15s ease",
        }}>
        <div {...listeners} onClick={e => e.stopPropagation()} style={{ cursor: "grab", padding: 2, flexShrink: 0 }}>
          <GripVertical className="w-3 h-3" style={{ color: "rgba(36,60,81,0.20)" }} />
        </div>
        <div onClick={e => { e.stopPropagation(); onToggleCheck(); }} style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, border: site.checked ? "none" : "1.5px solid rgba(36,60,81,0.25)", background: site.checked ? "#243c51" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          {site.checked && <Check className="w-2 h-2 text-white" />}
        </div>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: site.checked ? "#243c51" : "rgba(36,60,81,0.07)", color: site.checked ? "white" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, fontWeight: 600 }}>{order || "—"}</div>
        <div onClick={onToggleExpand} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0, lineHeight: 1.3 }}>{site.name}</p>
          <p style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0, marginTop: 1, lineHeight: 1.2 }}>{site.address}</p>
        </div>
        {site.tourType === "driveby" ? (
          <span style={{ background: "rgba(225,135,57,0.12)", color: "#b85c1a", fontSize: 9, fontWeight: 600, borderRadius: 4, padding: "2px 6px", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>Drive-by</span>
        ) : (
          <span style={{ background: "rgba(36,60,81,0.10)", color: "#243c51", fontSize: 9, fontWeight: 600, borderRadius: 4, padding: "2px 6px", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>{site.tourTime || "Scheduled"}</span>
        )}
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: site.statusDot, flexShrink: 0 }} />
        <div onClick={onToggleExpand} style={{ cursor: "pointer", padding: 2, flexShrink: 0 }}>
          <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)", transition: "transform 0.2s ease", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }} />
        </div>
      </div>
      {isExpanded && site.checked && (
        <div style={{ padding: "10px 10px 12px", background: "rgba(36,60,81,0.025)" }}>
          {/* Property details — editable */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Property Details</label>
            <div className="grid grid-cols-2" style={{ gap: 6 }}>
              {([
                { key: "sf", label: "SF", placeholder: "e.g. 2,400" },
                { key: "baseRent", label: "Base Rent", placeholder: "e.g. $30.00" },
                { key: "nnn", label: "NNN", placeholder: "e.g. $8.76" },
                { key: "grossMo", label: "Gross/Mo", placeholder: "e.g. $9,942" },
              ] as const).map(f => (
                <div key={f.key} style={{ position: "relative" }}>
                  <span style={{ position: "absolute", top: 4, left: 8, fontSize: 8, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", pointerEvents: "none", zIndex: 1 }}>{f.label}</span>
                  <input
                    id={`field-${site.id}-${f.key}`}
                    value={site[f.key] as string}
                    onChange={e => updateSiteDebounced(site.id, f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className={getPulseClass(`${site.id}-${f.key}`)}
                    style={{ ...inputStyle, height: 38, paddingTop: 14, paddingBottom: 4, fontSize: 11 }}
                    onFocus={focusHandler}
                    onBlur={blurHandler}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Site Status */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Status</label>
            <div className="flex" style={{ gap: 0, width: "100%", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(36,60,81,0.12)" }}>
              {([
                { key: "#E18739", label: "Under Review", activeBg: "#E18739" },
                { key: "#1e6091", label: "Active Tour", activeBg: "#1e6091" },
                { key: "#065f46", label: "Selected", activeBg: "#065f46" },
              ] as const).map(opt => {
                const isActive = site.statusDot === opt.key;
                return (
                  <button key={opt.key} onClick={() => { updateSite(site.id, "statusDot", opt.key); triggerFlash(`${site.id}-statusDot`); }}
                    style={{ flex: 1, height: 30, fontSize: 10, cursor: "pointer", border: "none", background: isActive ? opt.activeBg : "transparent", color: isActive ? "white" : "var(--text-muted)", fontWeight: isActive ? 600 : 400, transition: "all 0.15s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: isActive ? "white" : opt.key }} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tour Time */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Tour Time</label>
            <input id={`field-${site.id}-tourTime`} value={site.tourTime} onChange={e => updateSiteDebounced(site.id, "tourTime", e.target.value)} placeholder="e.g. 9:00 AM" className={getPulseClass(`${site.id}-tourTime`)} style={{ ...inputStyle, height: 32 }} onFocus={focusHandler} onBlur={blurHandler} />
          </div>

          {/* Tour Type */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Tour Type</label>
            <div className="flex" style={{ gap: 0, width: "100%", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(36,60,81,0.12)" }}>
              {(["scheduled", "driveby"] as const).map(t => (
                <button key={t} onClick={() => { updateSite(site.id, "tourType", t); const pages = getAffectedPages("tourType", site.id); pages.forEach(p => markPageEditing(p)); triggerFlash(`${site.id}-tourType`); }}
                  style={{ flex: 1, height: 30, fontSize: 11, cursor: "pointer", border: "none", background: site.tourType === t ? "#243c51" : "transparent", color: site.tourType === t ? "white" : "var(--text-muted)", fontWeight: site.tourType === t ? 600 : 400, transition: "all 0.15s ease" }}>
                  {t === "scheduled" ? "Scheduled" : "Drive-by"}
                </button>
              ))}
            </div>
          </div>

          {/* Broker info — compact two-field group */}
          <div style={{ marginBottom: 8, padding: "8px 8px 6px", background: "rgba(36,60,81,0.03)", borderRadius: 6, border: "1px solid rgba(36,60,81,0.06)" }}>
            <div className="flex items-center" style={{ gap: 4, marginBottom: 6 }}>
              <Phone className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.06em" }}>Broker Contact</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <input id={`field-${site.id}-brokerName`} value={site.brokerName} onChange={e => updateSiteDebounced(site.id, "brokerName", e.target.value)} placeholder="Broker name" className={getPulseClass(`${site.id}-brokerName`)} style={{ ...inputStyle, height: 30 }} onFocus={focusHandler} onBlur={blurHandler} />
            </div>
            <div>
              <input id={`field-${site.id}-brokerPhone`} value={site.brokerPhone} onChange={e => updateSiteDebounced(site.id, "brokerPhone", e.target.value)} placeholder="Phone number" className={getPulseClass(`${site.id}-brokerPhone`)} style={{ ...inputStyle, height: 30 }} onFocus={focusHandler} onBlur={blurHandler} />
            </div>
          </div>

          {/* Notes section */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Location Notes</label>
            <textarea id={`field-${site.id}-locationNotes`} value={site.locationNotes} onChange={e => { updateSiteDebounced(site.id, "locationNotes", e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = e.currentTarget.scrollHeight + "px"; }} placeholder="Add notes..." className={getPulseClass(`${site.id}-locationNotes`)} style={{ ...inputStyle, height: "auto", minHeight: 32, resize: "vertical", overflow: "hidden" }} onFocus={focusHandler} onBlur={blurHandler} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Tour Directions</label>
            <textarea id={`field-${site.id}-tourDirections`} value={site.tourDirections} onChange={e => { updateSiteDebounced(site.id, "tourDirections", e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = e.currentTarget.scrollHeight + "px"; }} placeholder="Directions or meeting point..." className={getPulseClass(`${site.id}-tourDirections`)} style={{ ...inputStyle, height: "auto", minHeight: 32, resize: "vertical", overflow: "hidden" }} onFocus={focusHandler} onBlur={blurHandler} />
          </div>

          {/* Additional pages */}
          <div style={{ paddingTop: 8, borderTop: "1px solid rgba(36,60,81,0.08)" }}>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.08em" }}>Additional Pages</span>
            <SortableContext items={site.uploadedPages.map(p => p.id)} strategy={verticalListSortingStrategy}>
              {site.uploadedPages.map(page => (
                <SortableUploadedPage key={page.id} page={page} siteId={site.id} removeUploadedPage={removeUploadedPage} toggleWrapStyle={toggleWrapStyle} setSites={setSites} />
              ))}
            </SortableContext>
            <button onClick={() => handleAddUploadedPage(site.id)} className="flex items-center w-full" style={{ marginTop: 6, gap: 6, padding: "6px 0", fontSize: 11, color: "#b85c1a", background: "none", border: "none", cursor: "pointer" }}>
              <Upload className="w-3 h-3" /> Upload page
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function PageEditorRow({ id, pageLabel, title, description, isExpanded, onToggle, children }: {
  id: PageEditorKey;
  pageLabel: string;
  title: string;
  description: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div id={`page-editor-${id}`}>
      <div style={{
        borderRadius: 8,
        border: isExpanded ? "1.5px solid rgba(225,135,57,0.55)" : "1px solid var(--border-divider)",
        boxShadow: isExpanded ? "0 0 0 2px rgba(225,135,57,0.10)" : "none",
        overflow: "hidden",
        transition: "all 0.15s ease",
      }}>
      <button onClick={onToggle} className="flex items-center w-full"
        style={{
          background: "var(--card-bg)",
          border: "none",
          cursor: "pointer",
          padding: "10px 12px",
          textAlign: "left",
          gap: 10,
        }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="flex items-center" style={{ gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>{pageLabel}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>{description}</p>
        </div>
        <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)", transition: "transform 0.2s ease", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }} />
      </button>
      {isExpanded && (
        <div style={{ background: "var(--card-bg)", padding: 12 }}>
          {children}
        </div>
      )}
      </div>
    </div>
  );
}

/* ═══ SORTABLE UPLOADED PAGE ═══ */
function SortableUploadedPage({ page, siteId, removeUploadedPage, toggleWrapStyle, setSites }: {
  page: UploadedPage; siteId: string; removeUploadedPage: (sid: string, pid: string) => void;
  toggleWrapStyle: (sid: string, pid: string) => void; setSites: React.Dispatch<React.SetStateAction<SiteData[]>>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={{ ...style, gap: 6, marginTop: 8, padding: "8px 8px", borderRadius: 6, background: "rgba(36,60,81,0.03)", border: "1px solid rgba(36,60,81,0.08)", display: "flex", alignItems: "center" }} {...attributes}>
      <div {...listeners} onClick={e => e.stopPropagation()} style={{ cursor: "grab", padding: 2, flexShrink: 0 }}>
        <GripVertical className="w-3 h-3" style={{ color: "rgba(36,60,81,0.20)" }} />
      </div>
      <FileText className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
      <input value={page.label} onChange={e => {
        const val = e.target.value;
        setSites(prev => prev.map(s => s.id === siteId ? { ...s, uploadedPages: s.uploadedPages.map(p => p.id === page.id ? { ...p, label: val } : p) } : s));
      }} style={{ flex: 1, minWidth: 0, fontSize: 12, border: "none", background: "transparent", outline: "none", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis" }} />
      <div className="flex shrink-0" style={{ gap: 2 }}>
        {(["fullbleed", "framed"] as const).map(ws => (
          <button key={ws} onClick={() => toggleWrapStyle(siteId, page.id)}
            style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
              background: page.wrapStyle === ws ? "#243c51" : "transparent",
              color: page.wrapStyle === ws ? "white" : "var(--text-muted)",
              border: page.wrapStyle === ws ? "1px solid #243c51" : "1px solid rgba(36,60,81,0.12)",
              fontWeight: page.wrapStyle === ws ? 600 : 400, lineHeight: 1.2 }}>
            {ws === "fullbleed" ? "Full" : "Frame"}
          </button>
        ))}
      </div>
      <button onClick={() => removeUploadedPage(siteId, page.id)} style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none", padding: 2, flexShrink: 0 }}><X className="w-3 h-3" /></button>
    </div>
  );
}

/* ═══ FILMSTRIP THUMBNAIL ═══ */
function FilmstripThumb({ active, onClick, type, isUploaded, editing, zoomed }: {
  active: boolean; onClick: () => void; type: "cover" | "guide" | "schedule" | "map" | "site"; isUploaded?: boolean; editing?: boolean; zoomed?: boolean;
}) {
  return (
    <div onClick={onClick} className="relative shrink-0" style={{
      width: 60, height: 78, borderRadius: 3, overflow: "hidden", cursor: "pointer",
      background: "white", position: "relative", transition: "transform 0.2s ease",
      border: active ? "2px solid #E18739" : "1.5px solid rgba(255,255,255,0.08)",
      boxShadow: active ? "0 0 0 2px rgba(225,135,57,0.20)" : "none",
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.transform = "scale(1.04)"; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.transform = "scale(1)"; } }}>
      {editing && <div style={{ position: "absolute", top: 2, right: 2, width: 6, height: 6, borderRadius: "50%", background: "#E18739", zIndex: 10 }} />}
      {zoomed && <div style={{ position: "absolute", bottom: 4, right: 4, fontSize: 10, background: "rgba(36,60,81,0.70)", borderRadius: 3, padding: "1px 3px", lineHeight: 1, zIndex: 10 }}>🔍</div>}
      {type === "cover" && (<><div style={{ height: "55%", background: "#243c51", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 5, fontWeight: 700, color: "white" }}>GOLFTRK</span></div><div style={{ height: "45%", background: "white" }} /></>)}
      {type === "guide" && (<div style={{ background: "white", height: "100%", padding: "6px 6px", display: "flex", flexDirection: "column", gap: 2 }}>{Array.from({ length: 7 }).map((_, i) => (<div key={i} style={{ height: 2, background: "rgba(36,60,81,0.12)", borderRadius: 1, width: "78%", margin: "0 auto" }} />))}</div>)}
      {type === "schedule" && (<div style={{ background: "white", height: "100%", display: "flex", flexDirection: "column" }}><div style={{ height: 10, background: "#243c51" }} />{Array.from({ length: 5 }).map((_, i) => (<div key={i} style={{ height: 3, background: i % 2 === 0 ? "white" : "rgba(36,60,81,0.04)" }} />))}</div>)}
      {type === "map" && (<div style={{ background: "white", height: "100%", position: "relative" }}><svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.08 }}>{Array.from({ length: 6 }).map((_, i) => <line key={`h${i}`} x1="0" y1={i * 14} x2="100%" y2={i * 14} stroke="#243c51" strokeWidth="0.5" />)}{Array.from({ length: 6 }).map((_, i) => <line key={`v${i}`} x1={i * 12} y1="0" x2={i * 12} y2="100%" stroke="#243c51" strokeWidth="0.5" />)}</svg>{[{ left: "25%", top: "30%" }, { left: "60%", top: "50%" }, { left: "40%", top: "70%" }].map((pos, i) => (<div key={i} style={{ position: "absolute", ...pos, width: 3, height: 3, borderRadius: "50%", background: "#E18739" }} />))}</div>)}
      {type === "site" && (<div style={{ background: "white", height: "100%", position: "relative" }}><div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "#E18739" }} /><div style={{ padding: "6px 6px 6px 8px", display: "flex", flexDirection: "column", gap: 2 }}><div style={{ height: 2, background: "rgba(36,60,81,0.20)", borderRadius: 1, width: "65%" }} />{Array.from({ length: 4 }).map((_, i) => (<div key={i} style={{ height: 1.5, background: "rgba(36,60,81,0.10)", borderRadius: 1, width: `${55 + i * 6}%` }} />))}</div></div>)}
      {isUploaded && (<div style={{ position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: "50%", background: "#E18739", display: "flex", alignItems: "center", justifyContent: "center" }}><ArrowUp className="w-[5px] h-[5px] text-white" /></div>)}
    </div>
  );
}

/* ═══ ACTIVE PAGE RENDERER ═══ */
function ActivePageRenderer({ activePage, checkedSites, tourDate, territory, franchisee, totalPages, coverPhoto, flashSections, onPreviewClick, onSiteImageUpload, instructionSections, mapTitle, mapNotes }: {
  activePage: number; checkedSites: SiteData[]; tourDate: string; territory: string; franchisee: string; totalPages: number;
  coverPhoto: string | null; flashSections: Set<string>; onPreviewClick: (target: string, siteId?: string) => void;
  onSiteImageUpload: (siteId: string, imageIdx: number, dataUrl: string) => void;
  instructionSections: { title: string; items: string }[]; mapTitle: string; mapNotes: string;
}) {
  if (activePage === 0) return <PageCover tourDate={tourDate} territory={territory} franchisee={franchisee} coverPhoto={coverPhoto} flashSections={flashSections} onPreviewClick={onPreviewClick} />;
  if (activePage === 1) return <PageInstructions sections={instructionSections} />;
  if (activePage === 2) return <PageSchedule sites={checkedSites} tourDate={tourDate} flashSections={flashSections} />;
  if (activePage === 3) return <PageMap sites={checkedSites} title={mapTitle} notes={mapNotes} />;
  const siteIdx = activePage - 4;
  if (siteIdx >= 0 && siteIdx < checkedSites.length) return <PageSiteCard site={checkedSites[siteIdx]} index={siteIdx + 1} pageNum={activePage + 1} totalPages={totalPages} flashSections={flashSections} onPreviewClick={onPreviewClick} onImageUpload={onSiteImageUpload} />;
  return null;
}

/* ═══ PAGE FRAME ═══ */
function PageFrame({ children, pageNum, totalPages, rightLabel }: { children: React.ReactNode; pageNum?: number; totalPages?: number; rightLabel?: string }) {
  return (
    <div style={{ width: 742, height: 960, display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      <div className="flex items-center justify-between shrink-0" style={{ height: 40, padding: "0 32px", borderBottom: "1px solid rgba(36,60,81,0.10)" }}>
        <div className="flex items-center" style={{ gap: 6 }}><span style={{ fontSize: 18, fontWeight: 700, color: "#243c51" }}>R</span><span style={{ fontSize: 12, color: "rgba(36,60,81,0.45)" }}>Property Tour Book</span></div>
        {rightLabel && <span style={{ fontSize: 10, textTransform: "uppercase", color: "rgba(36,60,81,0.35)", letterSpacing: "0.08em" }}>{rightLabel}</span>}
      </div>
      <div className="flex-1" style={{ overflow: "hidden" }}>{children}</div>
      <div className="flex items-center justify-between shrink-0" style={{ height: 32, padding: "0 32px", borderTop: "1px solid rgba(36,60,81,0.10)", marginTop: "auto" }}>
        <div className="flex items-center" style={{ gap: 6 }}><span style={{ fontSize: 12, fontWeight: 700, color: "#243c51" }}>R</span><span style={{ fontSize: 10, color: "rgba(36,60,81,0.45)" }}>ReimagineCRE.com</span></div>
        {pageNum && <span style={{ fontSize: 10, color: "rgba(36,60,81,0.40)" }}>Page {pageNum}</span>}
      </div>
    </div>
  );
}

/* ═══ COVER PAGE ═══ */
function PageCover({ tourDate, territory, franchisee, coverPhoto, flashSections, onPreviewClick }: { tourDate: string; territory: string; franchisee: string; coverPhoto: string | null; flashSections: Set<string>; onPreviewClick: (target: string) => void; }) {
  return (
    <div style={{ width: 742, height: 960, display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      <div style={{ height: "55%", background: "linear-gradient(160deg, #243c51 0%, #1a2e3d 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 48px 32px", position: "relative" }}>
        <span style={{ position: "absolute", top: 20, right: 24, fontSize: 24, fontWeight: 700, color: "white" }}>R</span>
        <span style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 16 }}>Property Tour Book</span>
        <h1 style={{ fontSize: 52, fontWeight: 700, color: "white", letterSpacing: -1, margin: 0 }}>GOLFTRK</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.60)", marginTop: 6 }}>Property Tour Book</p>
        <div style={{ width: 40, height: 1, background: "rgba(255,255,255,0.20)", margin: "20px auto" }} />
      </div>
      <div style={{ flex: 1, background: "white", padding: "32px 48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className={`preview-click-zone ${flashSections.has("coverPhoto") ? "update-flash" : ""}`} onClick={() => onPreviewClick("coverPhoto")}
          style={{ height: 200, borderRadius: 8, overflow: "hidden", ...(coverPhoto ? {} : { background: "rgba(36,60,81,0.06)", border: "1px dashed rgba(36,60,81,0.18)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }) }}>
          {coverPhoto ? <img src={coverPhoto} alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (<><Camera className="w-6 h-6" style={{ color: "rgba(36,60,81,0.30)" }} /><span style={{ fontSize: 12, color: "rgba(36,60,81,0.40)" }}>Upload cover photo</span></>)}
        </div>
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[{ label: "Tour Date", value: tourDate, key: "tourDate" }, { label: "Territory", value: territory, key: "territory" }, { label: "Franchisee", value: franchisee, key: "franchisee" }].map(item => (
            <div key={item.label} className={`preview-click-zone ${flashSections.has(item.key) ? "update-flash" : ""}`} onClick={() => onPreviewClick(item.key)} style={{ padding: 6, borderRadius: 4 }}>
              <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(36,60,81,0.45)" }}>{item.label}</span>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1b2326", marginTop: 3 }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══ INSTRUCTIONS PAGE ═══ */
function PageInstructions({ sections }: { sections: { title: string; items: string }[] }) {
  return (
    <PageFrame pageNum={2} rightLabel="GUIDE">
      <div style={{ padding: "24px 32px" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1b2326", margin: 0 }}>Property Tour Instructions</h2>
        <div style={{ width: 36, height: 3, background: "#E18739", marginTop: 6, marginBottom: 20 }} />
        {sections.map(section => (
          <div key={section.title} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: "#1b2326", marginBottom: 8 }}>{section.title}</h3>
            {section.items.split("\n").filter(Boolean).map((item, i) => (
              <p key={i} style={{ fontSize: 12, color: "#374151", lineHeight: 1.7, paddingLeft: 12, margin: 0 }}>· {item}</p>
            ))}
          </div>
        ))}
      </div>
    </PageFrame>
  );
}

/* ═══ SCHEDULE PAGE ═══ */
function PageSchedule({ sites, tourDate, flashSections }: { sites: SiteData[]; tourDate: string; flashSections: Set<string> }) {
  return (
    <PageFrame pageNum={3} rightLabel="SCHEDULE">
      <div style={{ padding: "20px 32px" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1b2326", margin: 0 }}>Property Tour Schedule</h2>
        <div style={{ width: 36, height: 3, background: "#E18739", marginTop: 6, marginBottom: 16 }} />
        <div className={flashSections.has("tourDate") ? "update-flash" : ""} style={{ fontSize: 12, fontWeight: 600, color: "rgba(36,60,81,0.55)", background: "rgba(36,60,81,0.05)", borderRadius: 4, padding: "5px 10px", marginBottom: 8 }}>Tuesday, January 20th, 2026</div>
        <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup><col style={{ width: 28 }} /><col style={{ width: 64 }} /><col style={{ width: 160 }} /><col style={{ width: 44 }} /><col style={{ width: 58 }} /><col style={{ width: 44 }} /><col style={{ width: 64 }} /><col style={{ width: 216 }} /></colgroup>
          <thead><tr style={{ background: "#243c51" }}>{["#", "Time", "Property", "SF", "Base Rent", "NNN", "Gross/Mo", "Broker"].map(col => (<th key={col} style={{ padding: "7px 8px", color: "white", fontSize: 9, fontWeight: 600, textTransform: "uppercase", textAlign: "left" }}>{col}</th>))}</tr></thead>
          <tbody>
            {sites.map((site, i) => (
              <tr key={site.id} className={flashSections.has(`${site.id}-tourTime`) || flashSections.has(`${site.id}-tourType`) ? "update-flash" : ""} style={{ height: 44, background: i % 2 === 0 ? "white" : "rgba(36,60,81,0.025)", borderBottom: "1px solid rgba(36,60,81,0.07)" }}>
                <td style={{ padding: "6px 8px", verticalAlign: "middle" }}><span style={{ width: 18, height: 18, borderRadius: "50%", background: "#243c51", color: "white", fontSize: 9, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span></td>
                <td style={{ padding: "6px 8px", verticalAlign: "middle" }}>{site.tourType === "driveby" ? <span style={{ background: "rgba(225,135,57,0.10)", color: "#b85c1a", fontSize: 9, fontWeight: 600, borderRadius: 3, padding: "2px 6px", display: "inline-block" }}>Drive-by</span> : <span style={{ fontSize: 10, fontWeight: 600, color: "#1b2326" }}>{site.tourTime || "—"}</span>}</td>
                <td style={{ padding: "6px 8px", verticalAlign: "middle", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><div style={{ fontSize: 10, fontWeight: 600, color: "#1b2326", lineHeight: 1.3 }}>{site.name}</div><div style={{ fontSize: 9, color: "rgba(36,60,81,0.50)", lineHeight: 1.3 }}>{site.address}</div></td>
                <td style={{ padding: "6px 8px", fontSize: 10, color: "#374151", verticalAlign: "middle" }}>{site.sf}</td>
                <td style={{ padding: "6px 8px", fontSize: 10, color: "#1b2326", verticalAlign: "middle" }}>{site.baseRent}</td>
                <td style={{ padding: "6px 8px", fontSize: 10, color: "#374151", verticalAlign: "middle" }}>{site.nnn}</td>
                <td style={{ padding: "6px 8px", fontSize: 10, fontWeight: 600, color: "#1b2326", verticalAlign: "middle" }}>{site.grossMo}</td>
                <td style={{ padding: "6px 8px", verticalAlign: "middle", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><div style={{ fontSize: 10, color: "#1b2326" }}>{site.brokerName}</div><div style={{ fontSize: 9, color: "rgba(36,60,81,0.50)" }}>{site.brokerPhone}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageFrame>
  );
}

/* ═══ MAP PAGE ═══ */
function PageMap({ sites, title, notes }: { sites: SiteData[]; title: string; notes: string }) {
  return (
    <PageFrame pageNum={4} rightLabel="MAP OVERVIEW">
      <div style={{ padding: "20px 32px" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1b2326", margin: 0 }}>{title}</h2>
        <div style={{ width: 36, height: 3, background: "#E18739", marginTop: 6, marginBottom: 16 }} />
        <div style={{ height: notes ? 280 : 340, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(36,60,81,0.10)", background: "rgba(36,60,81,0.04)", position: "relative" }}>
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>{Array.from({ length: 20 }).map((_, i) => (<line key={`h${i}`} x1="0" y1={i * 18} x2="100%" y2={i * 18} stroke="rgba(36,60,81,0.08)" strokeWidth="1" />))}{Array.from({ length: 30 }).map((_, i) => (<line key={`v${i}`} x1={i * 24} y1="0" x2={i * 24} y2="100%" stroke="rgba(36,60,81,0.08)" strokeWidth="1" />))}</svg>
          {sites.slice(0, 7).map((_, i) => {
            const positions = [{ left: "18%", top: "25%" }, { left: "55%", top: "18%" }, { left: "40%", top: "50%" }, { left: "72%", top: "55%" }, { left: "25%", top: "68%" }, { left: "58%", top: "40%" }, { left: "78%", top: "32%" }];
            return (<div key={i} style={{ position: "absolute", ...positions[i], transform: "translate(-50%,-50%)", width: 20, height: 20, borderRadius: "50%", background: "#E18739", color: "white", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.20)" }}>{i + 1}</div>);
          })}
        </div>
        {notes && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 6, background: "rgba(36,60,81,0.03)", border: "1px solid rgba(36,60,81,0.08)" }}>
            <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "rgba(36,60,81,0.40)", display: "block", marginBottom: 4 }}>Notes</span>
            <p style={{ fontSize: 10, color: "#374151", lineHeight: 1.6, margin: 0 }}>{notes}</p>
          </div>
        )}
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
          {sites.map((site, i) => (<div key={site.id} className="flex items-center" style={{ gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: "50%", background: "#E18739", color: "white", fontSize: 8, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span><div><span style={{ fontSize: 10, color: "#374151" }}>{site.name}</span><span style={{ fontSize: 9, color: "rgba(36,60,81,0.45)", display: "block" }}>{site.address.split(",")[1]?.trim() || site.address}</span></div></div>))}
        </div>
      </div>
    </PageFrame>
  );
}

/* ═══ SITE CARD PAGE ═══ */
function PageSiteCard({ site, index, pageNum, totalPages, flashSections, onPreviewClick, onImageUpload }: { site: SiteData; index: number; pageNum: number; totalPages: number; flashSections: Set<string>; onPreviewClick: (target: string, siteId?: string) => void; onImageUpload: (siteId: string, imageIdx: number, dataUrl: string) => void; }) {
  const initials = site.brokerName.split(" ").map(n => n[0]).join("").slice(0, 2);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadIdx, setUploadIdx] = useState<number>(0);

  const handleImageClick = (idx: number) => {
    setUploadIdx(idx);
    imageInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { onImageUpload(site.id, uploadIdx, reader.result as string); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <PageFrame pageNum={pageNum} totalPages={totalPages} rightLabel={`SITE #${index}`}>
      <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handleFileChange} />
      <div style={{ padding: "20px 32px" }}>
        <div className="flex items-start" style={{ gap: 12, position: "relative" }}>
          <div style={{ width: 3, height: 36, background: "#E18739", flexShrink: 0, borderRadius: 2 }} />
          <div style={{ flex: 1 }}>
            <div className="flex items-center" style={{ gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1b2326", margin: 0 }}>{site.name}</h2>
              {site.tourType === "driveby" ? (
                <span style={{ background: "rgba(225,135,57,0.12)", color: "#b85c1a", fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "3px 7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Drive-by</span>
              ) : (
                <span style={{ background: "rgba(36,60,81,0.10)", color: "#243c51", fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "3px 7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{site.tourTime ? `Scheduled · ${site.tourTime}` : "Scheduled"}</span>
              )}
              {(() => {
                const statusMap: Record<string, { label: string; bg: string; color: string; dot: string }> = {
                  "#E18739": { label: "Under Review", bg: "rgba(217,119,6,0.10)", color: "#92400e", dot: "#E18739" },
                  "#065f46": { label: "Selected", bg: "rgba(5,150,105,0.10)", color: "#065f46", dot: "#065f46" },
                };
                const s = statusMap[site.statusDot] || { label: "Active Tour", bg: "rgba(30,96,145,0.10)", color: "#1e6091", dot: "#1e6091" };
                return (
                  <span className="inline-flex items-center" style={{ gap: 5, background: s.bg, color: s.color, fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "3px 7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />
                    {s.label}
                  </span>
                );
              })()}
            </div>
            <p style={{ fontSize: 12, color: "rgba(36,60,81,0.55)", marginTop: 3 }}>{site.address}</p>
          </div>
          <span style={{ position: "absolute", right: 0, top: 0, fontSize: 36, fontWeight: 700, color: "rgba(36,60,81,0.06)" }}>SITE #{index}</span>
        </div>
        <div className="flex flex-wrap" style={{ gap: 8, marginTop: 14 }}>
          {[`${site.sf} SF`, `${site.baseRent} Base Rent`, `${site.nnn} NNN`, `${site.grossMo}/Mo`].map(pill => (<span key={pill} style={{ fontSize: 10, fontWeight: 600, color: "#374151", background: "rgba(36,60,81,0.06)", borderRadius: 5, padding: "4px 10px" }}>{pill}</span>))}
        </div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {(site.images || [null, null, null, null]).slice(0, 4).map((img, i) => (
                <div key={i} onClick={() => handleImageClick(i)} style={{
                  borderRadius: 5, overflow: "hidden", cursor: "pointer", position: "relative",
                  background: img ? "transparent" : "rgba(36,60,81,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  aspectRatio: "4 / 3",
                  transition: "box-shadow 0.15s ease",
                }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 0 2px rgba(225,135,57,0.30)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
                >
                  {img ? (
                    <>
                      <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; if (e.currentTarget.nextElementSibling) (e.currentTarget.nextElementSibling as HTMLElement).style.display = "flex"; }} />
                      <div className="flex flex-col items-center" style={{ gap: 3, display: "none" }}>
                        <Camera className="w-4 h-4" style={{ color: "rgba(36,60,81,0.25)" }} />
                        <span style={{ fontSize: 8, color: "rgba(36,60,81,0.30)" }}>Click to upload</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center" style={{ gap: 3 }}>
                      <Camera className="w-4 h-4" style={{ color: "rgba(36,60,81,0.25)" }} />
                      <span style={{ fontSize: 8, color: "rgba(36,60,81,0.30)" }}>Click to upload</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {site.locationNotes && (
              <div className={`preview-click-zone ${flashSections.has(`${site.id}-locationNotes`) ? "update-flash" : ""}`} onClick={() => onPreviewClick("locationNotes", site.id)} style={{ marginTop: 12, padding: 12, borderRadius: 7, background: "rgba(36,60,81,0.03)", border: "1px solid rgba(36,60,81,0.08)" }}>
                <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "rgba(36,60,81,0.40)", display: "block", marginBottom: 6 }}>Location Notes</span>
                <p style={{ fontSize: 10, color: "#374151", lineHeight: 1.6, margin: 0 }}>{site.locationNotes}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col" style={{ gap: 10 }}>
            <div style={{ padding: 12, borderRadius: 7, background: "rgba(36,60,81,0.03)", border: "1px solid rgba(36,60,81,0.08)" }}>
              <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "rgba(36,60,81,0.40)", display: "block", marginBottom: 8 }}>Property Details</span>
              {[{ label: "SF Available", value: site.sf }, { label: "Base Rent", value: site.baseRent }, { label: "NNN", value: site.nnn }, { label: "Gross Monthly", value: site.grossMo }].map(row => (
                <div key={row.label} className="flex items-center justify-between" style={{ padding: "5px 0", borderBottom: "1px solid rgba(36,60,81,0.07)" }}><span style={{ fontSize: 10, color: "rgba(36,60,81,0.50)" }}>{row.label}</span><span style={{ fontSize: 10, fontWeight: 600, color: "#1b2326" }}>{row.value}</span></div>
              ))}
            </div>
            <div className={`preview-click-zone ${flashSections.has(`${site.id}-brokerName`) || flashSections.has(`${site.id}-brokerPhone`) ? "update-flash" : ""}`} onClick={() => onPreviewClick("brokerName", site.id)} style={{ padding: 12, borderRadius: 7, background: "rgba(36,60,81,0.03)", border: "1px solid rgba(36,60,81,0.08)" }}>
              <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "rgba(36,60,81,0.40)", display: "block", marginBottom: 6 }}>Broker Contact</span>
              <div className="flex items-center" style={{ gap: 8, marginTop: 6 }}><span style={{ width: 28, height: 28, borderRadius: "50%", background: "#243c51", color: "white", fontSize: 10, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{initials}</span><div><span style={{ fontSize: 12, fontWeight: 700, color: "#1b2326", display: "block" }}>{site.brokerName}</span><span style={{ fontSize: 10, color: "rgba(36,60,81,0.55)", display: "block" }}>{site.brokerPhone}</span></div></div>
            </div>
            {site.tourDirections && (
              <div className={`preview-click-zone ${flashSections.has(`${site.id}-tourDirections`) ? "update-flash" : ""}`} onClick={() => onPreviewClick("tourDirections", site.id)} style={{ padding: 12, borderRadius: 7, background: "rgba(36,60,81,0.03)", border: "1px solid rgba(36,60,81,0.08)" }}>
                <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.10em", color: "rgba(36,60,81,0.40)", display: "block", marginBottom: 4 }}>Tour Directions</span>
                <div className="flex items-start" style={{ gap: 4 }}><span style={{ color: "#E18739", fontSize: 10 }}>→</span><p style={{ fontSize: 10, color: "#374151", lineHeight: 1.6, margin: 0 }}>{site.tourDirections}</p></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
