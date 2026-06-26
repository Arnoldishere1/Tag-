import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import {
  Clock, Camera, Trash2, ChevronRight, X, AlertTriangle,
  CheckCircle2, ShieldCheck, Building2, ScrollText, Loader2,
  CalendarDays, FileSignature, Hash, UserRound, MailIcon, MapPin, Lock,
  ClipboardCheck, FileCheck2, Briefcase, Layers,
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CHECKLIST_ITEMS = [
  { key: "item1", label: "Base plates and mudsills stable and level" },
  { key: "item2", label: "All planks tightly abutted, no cracks" },
  { key: "item3", label: "Guardrails and mid-rails secure" },
  { key: "item4", label: "Structure tied / braced to building" },
  { key: "item5", label: "Ladder / stairway access clear and secure" },
];

const FALLBACK_SITES = ["Unilever","Baker baker","Erl","Chane","Howdens","Iko","Byk","Cp","Um Regent"];
const FALLBACK_INSPECTORS = ["Luke Arnold","Jeff Arnold","Jon McHale","Josh McHale"];

/* ============ PIN GATE ============ */
function PinGate({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = useCallback(async (value) => {
    setLoading(true);
    try {
      await axios.post(`${API}/auth/verify-pin`, { pin: value });
      onUnlock();
    } catch (e) {
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 500);
    } finally {
      setLoading(false);
    }
  }, [onUnlock]);

  const press = (n) => {
    if (pin.length >= 4 || loading) return;
    const next = pin + String(n);
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => submit(next), 120);
    }
  };

  const backspace = () => setPin((p) => p.slice(0, -1));
  const clearAll = () => setPin("");

  useEffect(() => {
    const onKey = (e) => {
      if (loading) return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") backspace();
      else if (e.key === "Escape") clearAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="min-h-screen pin-bg flex flex-col" data-testid="pin-gate-screen">
      <div className="ticker">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between">
          <span>SECURE GATEWAY · FIELD INSPECTION SYSTEM</span>
          <span className="hidden sm:inline">v1.0 · TAG SCAFFOLDING</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md tech-card-strong" data-testid="pin-box">
          <div className="px-6 pt-8 pb-6 border-b border-zinc-200">
            <div className="flex items-center gap-2 eyebrow text-zinc-500"><Lock size={12} /> Auth Required</div>
            <h1 className="font-display text-4xl font-black tracking-tighter mt-2 leading-none">SAFETY<br/>INSPECTION</h1>
            <p className="text-sm text-zinc-600 mt-3">Enter the 4-digit access code to load the field dashboard.</p>
          </div>

          <div className="px-6 py-6">
            <div className="flex items-center justify-center gap-4 mb-6" data-testid="pin-dots">
              {[0,1,2,3].map(i => (
                <div key={i} className="pin-dot" data-filled={pin.length > i} data-error={error}></div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button
                  key={n}
                  className="pin-key"
                  onClick={() => press(n)}
                  data-testid={`pin-key-${n}`}
                  disabled={loading}
                >{n}</button>
              ))}
              <button className="pin-key" data-variant="ghost" onClick={clearAll} data-testid="pin-key-clear" disabled={loading}>CLR</button>
              <button className="pin-key" onClick={() => press(0)} data-testid="pin-key-0" disabled={loading}>0</button>
              <button className="pin-key" data-variant="ghost" onClick={backspace} data-testid="pin-key-back" disabled={loading}>
                <X size={18} className="mx-auto" />
              </button>
            </div>

            <div className="mt-5 h-6 flex items-center justify-center">
              {loading && <Loader2 size={16} className="animate-spin text-zinc-500" />}
              {error && !loading && (
                <span className="kbd-label text-[color:var(--fail)] flex items-center gap-1" data-testid="pin-error">
                  <AlertTriangle size={12} /> Invalid access token
                </span>
              )}
            </div>
          </div>

          <div className="px-6 py-3 border-t border-zinc-200 flex items-center justify-between kbd-label">
            <span>ENC-256 · LOCAL</span>
            <span>TAG SCAFFOLDING</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ LIVE CLOCK ============ */
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = now.getHours();
  const h12 = ((hh + 11) % 12) + 1;
  const time = `${String(h12).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")} ${hh>=12?"PM":"AM"}`;
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  return (
    <div className="text-right font-mono leading-tight" data-testid="live-clock">
      <div className="text-base font-semibold tabular-nums">{time}</div>
      <div className="text-[10px] tracking-[0.18em] text-zinc-500 font-semibold">{date}</div>
    </div>
  );
}

/* ============ SIGNATURE PAD ============ */
const SignaturePad = React.forwardRef(function SignaturePad({ onChange }, ref) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const dirtyRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const setup = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#09090b";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    setup();
    const onResize = () => {
      const data = dirtyRef.current ? canvasRef.current.toDataURL() : null;
      setup();
      if (data) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvasRef.current.getContext("2d");
          const rect = canvasRef.current.getBoundingClientRect();
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
        };
        img.src = data;
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setup]);

  const getPos = (e) => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawingRef.current = true;
    dirtyRef.current = true;
    setHasInk(true);
    const ctx = canvasRef.current.getContext("2d");
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (onChange) onChange(canvasRef.current.toDataURL());
  };

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, c.width, c.height);
    dirtyRef.current = false;
    setHasInk(false);
    if (onChange) onChange("");
  };

  // expose imperative methods
  React.useImperativeHandle(ref, () => ({
    clear,
    getDataUrl: () => (dirtyRef.current ? canvasRef.current.toDataURL() : ""),
  }));

  return (
    <div className="sig-pad" data-testid="signature-pad">
      <canvas
        ref={canvasRef}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        data-testid="signature-canvas"
      />
      {!hasInk && <div className="sig-hint">SIGN HERE</div>}
      <button type="button" className="sig-clear" onClick={clear} data-testid="signature-clear-btn">CLEAR</button>
    </div>
  );
});

/* ============ HELPERS ============ */
function getNextInspectionDay(selectedDate) {
  if (!selectedDate) return "";
  const [y, m, d] = selectedDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0=Sun
  const daysToAdd = [2, 1, 1, 2, 1, 4, 3]; // Tue/Wed/Fri rotation
  date.setDate(date.getDate() + daysToAdd[dow]);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

/* ============ INSPECTION FORM ============ */
function InspectionForm({ siteList, inspectorList, onSubmitted }) {
  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }, []);

  const [site, setSite] = useState("");
  const [scaffoldId, setScaffoldId] = useState("");
  const [inspector, setInspector] = useState(localStorage.getItem("savedInspectorName") || "");
  const [email, setEmail] = useState(localStorage.getItem("savedInspectorEmail") || "");
  const [date, setDate] = useState(todayISO);
  const [checklist, setChecklist] = useState({});
  const [photo, setPhoto] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const sigRef = useRef(null);
  const fileRef = useRef(null);

  const nextDay = useMemo(() => getNextInspectionDay(date), [date]);

  const setItem = (key, value) => setChecklist((c) => ({ ...c, [key]: value }));

  const onPhotoChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoName(f.name);
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(f);
  };

  const validate = () => {
    if (!site) return "Select a working site.";
    if (!scaffoldId.trim()) return "Enter the scaffold ID.";
    if (!inspector) return "Select the inspector.";
    if (!email.trim()) return "Enter a notification email.";
    if (!date) return "Pick the inspection date.";
    for (const item of CHECKLIST_ITEMS) {
      if (!checklist[item.key]) return `Mark a result for: ${item.label}`;
    }
    if (!status) return "Choose the final tag status.";
    return "";
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    const err = validate();
    if (err) { setSubmitError(err); return; }

    const signature = sigRef.current?.getDataUrl() || "";

    const payload = {
      site,
      scaffold_id: scaffoldId.trim(),
      inspector,
      email: email.trim(),
      date,
      status,
      notes,
      checklist: CHECKLIST_ITEMS.map(i => ({ key: i.key, label: i.label, result: checklist[i.key] })),
      signature,
      photo,
    };

    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/inspections`, payload);
      localStorage.setItem("savedInspectorName", inspector);
      localStorage.setItem("savedInspectorEmail", email);
      onSubmitted(res.data);
      // reset (keep inspector + email)
      setSite("");
      setScaffoldId("");
      setNotes("");
      setStatus("");
      setChecklist({});
      setPhoto(""); setPhotoName("");
      if (fileRef.current) fileRef.current.value = "";
      sigRef.current?.clear();
    } catch (err) {
      setSubmitError(err?.response?.data?.detail || "Failed to submit inspection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-10" data-testid="inspection-form">
      {/* SECTION 1 — General Info */}
      <section data-testid="section-general-info">
        <SectionHeader number="01" title="General Info" icon={<Building2 size={14} />} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5 mt-6">
          <Field label="Working Site" icon={<MapPin size={11} />}>
            <select className="tech-input" value={site} onChange={(e) => setSite(e.target.value)} data-testid="site-selection" required>
              <option value="" disabled>Select site…</option>
              {siteList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Scaffold ID / QR" icon={<Hash size={11} />}>
            <input className="tech-input" placeholder="e.g. SCAFF-7709" value={scaffoldId} onChange={(e) => setScaffoldId(e.target.value)} data-testid="scaffold-id-input" required />
          </Field>

          <Field label="Inspector" icon={<UserRound size={11} />}>
            <select className="tech-input" value={inspector} onChange={(e) => setInspector(e.target.value)} data-testid="inspector-select" required>
              <option value="" disabled>Select inspector…</option>
              {inspectorList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Notification Email" icon={<MailIcon size={11} />}>
            <input type="email" className="tech-input" placeholder="inspector@company.com" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="email-input" required />
          </Field>

          <Field label="Inspection Date" icon={<CalendarDays size={11} />} className="sm:col-span-2">
            <input type="date" className="tech-input" value={date} onChange={(e) => setDate(e.target.value)} data-testid="date-input" required />
            {nextDay && (
              <div className="mt-3 flex items-center justify-between gap-3 border border-zinc-200 px-4 py-3 bg-zinc-50" data-testid="schedule-badge">
                <div>
                  <div className="eyebrow">Next Tagging Day</div>
                  <div className="font-display font-bold text-lg tracking-tight">{nextDay}</div>
                </div>
                <span className="pill pill-info"><Clock size={12} /> Rotation</span>
              </div>
            )}
          </Field>
        </div>
      </section>

      {/* SECTION 2 — Checklist */}
      <section data-testid="section-checklist">
        <SectionHeader number="02" title="Safety Checklist" icon={<ShieldCheck size={14} />} />
        <div className="mt-6 border border-zinc-200 divide-y divide-zinc-200">
          {CHECKLIST_ITEMS.map((item, idx) => (
            <div key={item.key} className="px-4 py-4 sm:px-5 sm:py-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="font-mono text-[11px] tracking-[0.1em] text-zinc-500 mt-0.5">Q{String(idx+1).padStart(2,"0")}</span>
                <p className="font-medium text-zinc-900 leading-snug flex-1">{item.label}?</p>
              </div>
              <div className="flex" data-testid={`checklist-${item.key}`}>
                {["pass","fail","na"].map(v => (
                  <button
                    type="button"
                    key={v}
                    className="seg-btn"
                    data-active={checklist[item.key] === v ? v : undefined}
                    onClick={() => setItem(item.key, v)}
                    data-testid={`checklist-${item.key}-${v}`}
                  >
                    {v === "pass" && <CheckCircle2 size={14} />}
                    {v === "fail" && <AlertTriangle size={14} />}
                    {v === "na" && <X size={14} />}
                    {v.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3 — Observations */}
      <section data-testid="section-observations">
        <SectionHeader number="03" title="Observations & Sign-off" icon={<ScrollText size={14} />} />

        <div className="mt-6 space-y-5">
          <Field label="Photo Proof (Optional)">
            <label className="photo-drop" data-has-file={photo ? "true" : "false"} data-testid="photo-drop">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChange} data-testid="photo-input" />
              {photo ? (
                <>
                  <CheckCircle2 size={22} className="text-emerald-600" />
                  <div className="text-sm font-semibold text-emerald-800">{photoName || "Photo attached"}</div>
                  <div className="kbd-label">Tap to replace</div>
                </>
              ) : (
                <>
                  <Camera size={22} className="text-zinc-500" />
                  <div className="text-sm font-semibold">Tap to capture or upload photo</div>
                  <div className="kbd-label">JPG / PNG · Optional</div>
                </>
              )}
            </label>
          </Field>

          <Field label="Notes / Corrective Actions">
            <textarea className="tech-input" rows={4} value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Describe any defects, observations, or corrective actions taken…" data-testid="notes-input"></textarea>
          </Field>

          <Field label="Final Tag Status">
            <div className="grid grid-cols-2 gap-3" data-testid="status-toggle">
              <button type="button"
                className="h-16 border font-display font-extrabold tracking-tight text-base uppercase transition-colors flex items-center justify-center gap-2"
                style={{
                  background: status === "green" ? "var(--pass)" : "#fff",
                  color: status === "green" ? "#fff" : "#09090b",
                  borderColor: status === "green" ? "var(--pass)" : "var(--line)",
                  borderRadius: 2,
                }}
                onClick={() => setStatus("green")}
                data-testid="status-green-btn"
              >
                <CheckCircle2 size={18} /> Green Tag · Safe
              </button>
              <button type="button"
                className="h-16 border font-display font-extrabold tracking-tight text-base uppercase transition-colors flex items-center justify-center gap-2"
                style={{
                  background: status === "red" ? "var(--fail)" : "#fff",
                  color: status === "red" ? "#fff" : "#09090b",
                  borderColor: status === "red" ? "var(--fail)" : "var(--line)",
                  borderRadius: 2,
                }}
                onClick={() => setStatus("red")}
                data-testid="status-red-btn"
              >
                <AlertTriangle size={18} /> Red Tag · Do Not Use
              </button>
            </div>
          </Field>

          <Field label="Inspector Digital Signature" icon={<FileSignature size={11} />}>
            <SignaturePad ref={sigRef} />
            <div className="kbd-label mt-2">Use finger or mouse to sign. Tap CLEAR to redo.</div>
          </Field>
        </div>
      </section>

      {submitError && (
        <div className="border border-[color:var(--fail)] bg-red-50 px-4 py-3 flex items-start gap-2 text-sm text-red-800" data-testid="submit-error">
          <AlertTriangle size={16} className="mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      <button type="submit" className="btn-primary flex items-center justify-center gap-3" disabled={submitting} data-testid="submit-inspection-btn">
        {submitting ? <><Loader2 size={18} className="animate-spin" /> Submitting…</> : <>Submit Inspection <ChevronRight size={18} /></>}
      </button>
    </form>
  );
}

function SectionHeader({ number, title, icon }) {
  return (
    <div className="flex items-end justify-between border-b border-zinc-900 pb-3">
      <div>
        <div className="kbd-label">SECTION · {number}</div>
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-none mt-1">{title}</h2>
      </div>
      <div className="text-zinc-400">{icon}</div>
    </div>
  );
}

function Field({ label, icon, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <div className="eyebrow mb-2 flex items-center gap-1.5">{icon}{label}</div>
      {children}
    </label>
  );
}

/* ============ ARCHIVE FOLDERS ============ */
function Archive({ siteList, inspections, onRefresh }) {
  const [open, setOpen] = useState(null);

  const grouped = useMemo(() => {
    const map = {};
    for (const s of siteList) map[s] = [];
    for (const i of inspections) {
      if (!map[i.site]) map[i.site] = [];
      map[i.site].push(i);
    }
    return map;
  }, [siteList, inspections]);

  const deleteRecord = async (id) => {
    if (!window.confirm("Permanently delete this inspection record?")) return;
    await axios.delete(`${API}/inspections/${id}`);
    onRefresh();
  };

  return (
    <section className="mt-12" data-testid="archive-section">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="kbd-label">ARCHIVE</div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-none mt-1">Site Records</h2>
        </div>
        <div className="kbd-label">{inspections.length} total log{inspections.length === 1 ? "" : "s"}</div>
      </div>

      <div className="border border-zinc-900 bg-white">
        {siteList.map(site => {
          const records = grouped[site] || [];
          const isOpen = open === site;
          return (
            <div key={site} data-testid={`folder-${site}`}>
              <div
                className="folder-row"
                data-open={isOpen}
                onClick={() => setOpen(isOpen ? null : site)}
                data-testid={`folder-toggle-${site}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs">{String(siteList.indexOf(site)+1).padStart(2,"0")}</span>
                  <span className="font-display font-extrabold text-lg tracking-tight uppercase truncate">{site}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="folder-count kbd-label">{records.length} REC</span>
                  <ChevronRight size={18} className="transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0)" }} />
                </div>
              </div>

              {isOpen && (
                <div className="folder-content" data-testid={`folder-content-${site}`}>
                  {records.length === 0 ? (
                    <div className="px-5 py-8 text-center kbd-label">No inspections logged for {site}.</div>
                  ) : (
                    records.map(r => (
                      <div className="record-row" key={r.id} data-testid={`record-${r.id}`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className={`pill ${r.status === "green" ? "pill-green" : "pill-red"}`} data-testid={`record-status-${r.id}`}>
                              {r.status === "green" ? "GREEN" : "RED"} TAG
                            </span>
                            <span className="font-mono text-[11px] text-zinc-500">{r.date}</span>
                            {r.email_sent && <span className="kbd-label flex items-center gap-1"><MailIcon size={10} /> SENT</span>}
                          </div>
                          <div className="font-display font-bold text-base tracking-tight truncate">{r.scaffold_id}</div>
                          <div className="kbd-label flex items-center gap-2 mt-0.5">
                            <UserRound size={11} /> {r.inspector}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {r.signature ? (
                            <img src={r.signature} alt="signature" className="h-10 border border-zinc-200 bg-white" style={{ width: 76, objectFit: "contain" }} data-testid={`record-sig-${r.id}`} />
                          ) : (
                            <div className="kbd-label">NO SIG</div>
                          )}
                          <button type="button" className="btn-danger-ghost flex items-center gap-1" onClick={() => deleteRecord(r.id)} data-testid={`record-delete-${r.id}`}>
                            <Trash2 size={11} /> Del
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ============ HANDOVER FORM ============ */
function HandoverForm({ siteList, onSubmitted }) {
  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }, []);
  const nowHM = useMemo(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }, []);

  const [form, setForm] = useState({
    contractor: "Tag Scaffolding",
    client_name: "",
    client_email: "",
    site: "",
    description: "",
    drawing_no: "",
    quotation_no: "",
    quotation_date: "",
    use_only_for: "",
    ties_tested: "",
    working_lifts: "1",
    distributed_load: "",
    load_unit: "kN/m2",
    sheeting_designed: "",
    contractor_name: localStorage.getItem("savedInspectorName") || "",
    contractor_position: "Supervisor",
    handover_date: todayISO,
    handover_time: nowHM,
    received_by_name: "",
    received_by_position: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const contractorSigRef = useRef(null);
  const receivedSigRef = useRef(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const required = [
      ["contractor","Contractor"],["client_name","Client name"],["client_email","Client email"],
      ["site","Site"],["description","Description of section handed over"],
      ["use_only_for","Use only for"],["ties_tested","Ties tested"],
      ["working_lifts","Working lifts"],["distributed_load","Distributed load"],
      ["sheeting_designed","Sheeting designed for"],
      ["contractor_name","Contractor name"],["contractor_position","Contractor position"],
      ["handover_date","Handover date"],["handover_time","Handover time"],
    ];
    for (const [k, label] of required) {
      if (!String(form[k] || "").trim()) return `Please fill: ${label}.`;
    }
    return "";
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const err = validate();
    if (err) { setError(err); return; }
    const payload = {
      ...form,
      contractor_signature: contractorSigRef.current?.getDataUrl() || "",
      received_by_signature: receivedSigRef.current?.getDataUrl() || "",
    };
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/handovers`, payload);
      onSubmitted(res.data);
      // Reset some fields, keep contractor + name
      setForm((f) => ({
        ...f,
        client_name: "", client_email: "", site: "", description: "",
        drawing_no: "", quotation_no: "", quotation_date: "",
        use_only_for: "", ties_tested: "", working_lifts: "1",
        distributed_load: "", sheeting_designed: "",
        received_by_name: "", received_by_position: "", notes: "",
      }));
      contractorSigRef.current?.clear();
      receivedSigRef.current?.clear();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to submit handover.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-10" data-testid="handover-form">
      {/* Compliance banner */}
      <div className="border border-zinc-900 bg-zinc-900 text-white px-5 py-4">
        <div className="kbd-label text-zinc-400">SCAFFOLDING HANDING-OVER CERTIFICATE</div>
        <p className="text-sm leading-relaxed mt-2">
          Scaffolding described below has been completed and complies with the <strong>Work at Height Regulations, 2005</strong>.
          It is structurally sound and should only be used in accordance with the agreed specification.
        </p>
      </div>

      {/* Section A — Parties & Site */}
      <section data-testid="handover-section-parties">
        <SectionHeader number="A" title="Parties & Site" icon={<Briefcase size={14} />} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5 mt-6">
          <Field label="Contractor"><input className="tech-input" value={form.contractor} onChange={e=>set("contractor",e.target.value)} data-testid="handover-contractor" /></Field>
          <Field label="Client Name"><input className="tech-input" value={form.client_name} onChange={e=>set("client_name",e.target.value)} placeholder="Client / company" data-testid="handover-client-name" /></Field>
          <Field label="Client Email" icon={<MailIcon size={11} />}>
            <input type="email" className="tech-input" value={form.client_email} onChange={e=>set("client_email",e.target.value)} placeholder="client@company.com" data-testid="handover-client-email" />
          </Field>
          <Field label="Site" icon={<MapPin size={11} />}>
            <select className="tech-input" value={form.site} onChange={e=>set("site",e.target.value)} data-testid="handover-site">
              <option value="" disabled>Select site…</option>
              {siteList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Description of Section Handed Over" className="sm:col-span-2">
            <textarea className="tech-input" rows={3} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="e.g. North elevation, lifts 1–3, 40m run, working platform 2.4m wide…" data-testid="handover-description" />
          </Field>
          <Field label="Drawing No. (if applicable)"><input className="tech-input" value={form.drawing_no} onChange={e=>set("drawing_no",e.target.value)} data-testid="handover-drawing-no" /></Field>
          <Field label="Quotation No. (if applicable)"><input className="tech-input" value={form.quotation_no} onChange={e=>set("quotation_no",e.target.value)} data-testid="handover-quotation-no" /></Field>
          <Field label="Quotation Date" className="sm:col-span-2"><input type="date" className="tech-input" value={form.quotation_date} onChange={e=>set("quotation_date",e.target.value)} data-testid="handover-quotation-date" /></Field>
        </div>
      </section>

      {/* Section B — Use & Loading */}
      <section data-testid="handover-section-loading">
        <SectionHeader number="B" title="Use & Loading" icon={<Layers size={14} />} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5 mt-6">
          <Field label="Use Only For" className="sm:col-span-2">
            <input className="tech-input" value={form.use_only_for} onChange={e=>set("use_only_for",e.target.value)} placeholder="e.g. Bricklaying, rendering, general access…" data-testid="handover-use-only-for" />
          </Field>

          <Field label="Have Ties Been Tested?">
            <div className="flex" data-testid="handover-ties-tested">
              {[["yes","YES"],["no","NO"],["na","N/A"]].map(([v,l]) => (
                <button type="button" key={v} className="seg-btn"
                  data-active={form.ties_tested === v ? (v === "yes" ? "pass" : v === "no" ? "fail" : "na") : undefined}
                  onClick={() => set("ties_tested", v)}
                  data-testid={`handover-ties-${v}`}>{l}</button>
              ))}
            </div>
          </Field>

          <Field label="Working Lifts">
            <input type="number" min="1" className="tech-input" value={form.working_lifts} onChange={e=>set("working_lifts",e.target.value)} data-testid="handover-working-lifts" />
          </Field>

          <Field label="Distributed Load">
            <input className="tech-input" value={form.distributed_load} onChange={e=>set("distributed_load",e.target.value)} placeholder="e.g. 1.5" data-testid="handover-distributed-load" />
          </Field>

          <Field label="Load Unit">
            <div className="flex" data-testid="handover-load-unit">
              {[["kN/m2","kN/m²"],["lbs/ft2","lbs/ft²"]].map(([v,l]) => (
                <button type="button" key={v} className="seg-btn"
                  data-active={form.load_unit === v ? "na" : undefined}
                  onClick={() => set("load_unit", v)}
                  data-testid={`handover-load-unit-${v.replace('/','-')}`}>{l}</button>
              ))}
            </div>
          </Field>

          <Field label="Designed To Take Sheeting / Debris Netting?" className="sm:col-span-2">
            <div className="flex" data-testid="handover-sheeting">
              {[["has","HAS"],["has_not","HAS NOT"]].map(([v,l]) => (
                <button type="button" key={v} className="seg-btn"
                  data-active={form.sheeting_designed === v ? (v === "has" ? "pass" : "fail") : undefined}
                  onClick={() => set("sheeting_designed", v)}
                  data-testid={`handover-sheeting-${v}`}>{l}</button>
              ))}
            </div>
          </Field>
        </div>
      </section>

      {/* Section C — Sign-off */}
      <section data-testid="handover-section-signoff">
        <SectionHeader number="C" title="Sign-off" icon={<FileSignature size={14} />} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5 mt-6">
          <Field label="Contractor — Print Name"><input className="tech-input" value={form.contractor_name} onChange={e=>set("contractor_name",e.target.value)} data-testid="handover-contractor-name" /></Field>
          <Field label="Contractor — Position"><input className="tech-input" value={form.contractor_position} onChange={e=>set("contractor_position",e.target.value)} data-testid="handover-contractor-position" /></Field>

          <Field label="Handover Date"><input type="date" className="tech-input" value={form.handover_date} onChange={e=>set("handover_date",e.target.value)} data-testid="handover-date" /></Field>
          <Field label="Handover Time"><input type="time" className="tech-input" value={form.handover_time} onChange={e=>set("handover_time",e.target.value)} data-testid="handover-time" /></Field>

          <Field label="Contractor Signature" className="sm:col-span-2">
            <SignaturePad ref={contractorSigRef} />
          </Field>

          <Field label="Received By — Print Name (optional)"><input className="tech-input" value={form.received_by_name} onChange={e=>set("received_by_name",e.target.value)} data-testid="handover-received-name" /></Field>
          <Field label="Received By — Position (optional)"><input className="tech-input" value={form.received_by_position} onChange={e=>set("received_by_position",e.target.value)} data-testid="handover-received-position" /></Field>

          <Field label="Received By Signature (optional)" className="sm:col-span-2">
            <SignaturePad ref={receivedSigRef} />
          </Field>

          <Field label="Notes (optional)" className="sm:col-span-2">
            <textarea className="tech-input" rows={3} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Any additional information for the client…" data-testid="handover-notes" />
          </Field>
        </div>
      </section>

      {/* Regulatory notice */}
      <div className="border-l-4 border-zinc-900 bg-zinc-50 px-4 py-3 text-xs text-zinc-700 leading-relaxed">
        In order to comply with the Work at Height Regulations 2005, this scaffold must be inspected before being taken into use for the first time,
        at regular intervals not exceeding 7 days, after any event likely to have affected its strength or stability, and after any substantial
        addition, dismantling or other alteration.
      </div>

      {error && (
        <div className="border border-[color:var(--fail)] bg-red-50 px-4 py-3 flex items-start gap-2 text-sm text-red-800" data-testid="handover-error">
          <AlertTriangle size={16} className="mt-0.5" /><span>{error}</span>
        </div>
      )}

      <button type="submit" className="btn-primary flex items-center justify-center gap-3" disabled={submitting} data-testid="submit-handover-btn">
        {submitting ? <><Loader2 size={18} className="animate-spin" /> Issuing Certificate…</> : <>Issue & Email Handover Certificate <ChevronRight size={18} /></>}
      </button>
    </form>
  );
}

/* ============ HANDOVER ARCHIVE ============ */
function HandoverArchive({ handovers, onRefresh }) {
  const deleteRecord = async (id) => {
    if (!window.confirm("Permanently delete this handover certificate?")) return;
    await axios.delete(`${API}/handovers/${id}`);
    onRefresh();
  };
  return (
    <section className="mt-12" data-testid="handover-archive">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="kbd-label">ARCHIVE</div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-none mt-1">Handover Certificates</h2>
        </div>
        <div className="kbd-label">{handovers.length} issued</div>
      </div>

      <div className="border border-zinc-900 bg-white">
        {handovers.length === 0 ? (
          <div className="px-5 py-10 text-center kbd-label">No handover certificates issued yet.</div>
        ) : handovers.map(h => (
          <div className="record-row" key={h.id} data-testid={`handover-record-${h.id}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="pill pill-info">{h.certificate_no}</span>
                <span className="font-mono text-[11px] text-zinc-500">{h.handover_date} · {h.handover_time}</span>
                {h.email_sent && <span className="kbd-label flex items-center gap-1"><MailIcon size={10} /> SENT</span>}
              </div>
              <div className="font-display font-bold text-base tracking-tight truncate">{h.client_name} · {h.site}</div>
              <div className="kbd-label flex items-center gap-2 mt-0.5 truncate">
                <Briefcase size={11} /> {h.contractor} → {h.client_email}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {h.contractor_signature ? (
                <img src={h.contractor_signature} alt="signature" className="h-10 border border-zinc-200 bg-white" style={{ width: 76, objectFit: "contain" }} />
              ) : (
                <div className="kbd-label">NO SIG</div>
              )}
              <button type="button" className="btn-danger-ghost flex items-center gap-1" onClick={() => deleteRecord(h.id)} data-testid={`handover-delete-${h.id}`}>
                <Trash2 size={11} /> Del
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============ TOAST ============ */
function Toast({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 5500);
    return () => clearTimeout(t);
  }, [data, onClose]);
  if (!data) return null;
  const isHandover = !!data.certificate_no;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-32px)]" data-testid="success-toast">
      <div className="tech-card-strong px-5 py-4 bg-white shadow-lg flex items-start gap-3">
        <div className="h-9 w-9 bg-[color:var(--pass)] text-white flex items-center justify-center shrink-0">
          <CheckCircle2 size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-extrabold text-base leading-tight">
            {isHandover ? "Handover Certificate Issued" : "Inspection Logged"}
          </div>
          <div className="text-sm text-zinc-600 mt-0.5">
            {isHandover ? (
              <>
                <span className="font-mono">{data.certificate_no}</span> for <span className="font-semibold">{data.client_name}</span> at <span className="font-semibold">{data.site}</span>.
                {data.email_sent ? " Sent to client." : " Email pending (key not configured)."}
              </>
            ) : (
              <>
                <span className="font-mono">{data.scaffold_id}</span> filed under <span className="font-semibold">{data.site}</span>.
                {data.email_sent ? " Notification sent." : " Email pending (key not configured)."}
              </>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900" data-testid="toast-close-btn">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

/* ============ MAIN APP ============ */
function MainApp() {
  const [siteList, setSiteList] = useState(FALLBACK_SITES);
  const [inspectorList, setInspectorList] = useState(FALLBACK_INSPECTORS);
  const [inspections, setInspections] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("inspection"); // inspection | handover

  const refresh = useCallback(async () => {
    try {
      const [insp, hand] = await Promise.all([
        axios.get(`${API}/inspections`),
        axios.get(`${API}/handovers`),
      ]);
      setInspections(insp.data || []);
      setHandovers(hand.data || []);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    axios.get(`${API}/sites`).then(r => {
      if (r.data?.sites) setSiteList(r.data.sites);
      if (r.data?.inspectors) setInspectorList(r.data.inspectors);
    }).catch(() => {});
    refresh();
  }, [refresh]);

  const onSubmitted = (data) => {
    setToast(data);
    refresh();
  };

  return (
    <div className="min-h-screen bg-white" data-testid="main-app">
      <header className="sticky-bar">
        <div className="ticker">
          <div className="max-w-3xl mx-auto px-5 flex items-center justify-between">
            <span>FIELD MODE · ACTIVE</span>
            <span>TAG SCAFFOLDING</span>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="kbd-label">DIGITAL FIELD REPORT</div>
            <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tighter leading-none">SAFETY INSPECTION</h1>
          </div>
          <LiveClock />
        </div>
        <div className="max-w-3xl mx-auto px-5 pb-3">
          <div className="flex border border-zinc-900" data-testid="mode-tabs">
            <button
              type="button"
              onClick={() => setTab("inspection")}
              className="flex-1 h-12 font-display font-extrabold uppercase tracking-tight text-sm flex items-center justify-center gap-2 transition-colors"
              style={{ background: tab === "inspection" ? "#09090b" : "#fff", color: tab === "inspection" ? "#fff" : "#09090b" }}
              data-testid="tab-inspection"
            >
              <ClipboardCheck size={16} /> Inspection
            </button>
            <button
              type="button"
              onClick={() => setTab("handover")}
              className="flex-1 h-12 font-display font-extrabold uppercase tracking-tight text-sm flex items-center justify-center gap-2 transition-colors border-l border-zinc-900"
              style={{ background: tab === "handover" ? "#09090b" : "#fff", color: tab === "handover" ? "#fff" : "#09090b" }}
              data-testid="tab-handover"
            >
              <FileCheck2 size={16} /> Handover
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 sm:py-10">
        {tab === "inspection" ? (
          <>
            <InspectionForm siteList={siteList} inspectorList={inspectorList} onSubmitted={onSubmitted} />
            <Archive siteList={siteList} inspections={inspections} onRefresh={refresh} />
          </>
        ) : (
          <>
            <HandoverForm siteList={siteList} onSubmitted={onSubmitted} />
            <HandoverArchive handovers={handovers} onRefresh={refresh} />
          </>
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-5 py-10 border-t border-zinc-200 mt-12">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="kbd-label">CREATED BY LUKE ARNOLD · TAG SCAFFOLDING</div>
          <div className="kbd-label">v1.1.0</div>
        </div>
      </footer>

      <Toast data={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/* ============ ROOT ============ */
export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  return unlocked ? <MainApp /> : <PinGate onUnlock={() => setUnlocked(true)} />;
}
