import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600&display=swap";
document.head.appendChild(fontLink);

const SUPABASE_URL  = "https://jsyzxscinfrfcebiqmja.supabase.co";
const SUPABASE_KEY  = "sb_publishable_KtY55FFvhf5WfSZpO3nSoA_02XnFl1l";
const ANTHROPIC_KEY = process.env.REACT_APP_ANTHROPIC_KEY || "";
const supabase      = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Constants ────────────────────────────────────────────────────────────────
const STAGES = [
  { id:"new",       label:"New Lead",         color:"#6366F1", icon:"○" },
  { id:"contacted", label:"Contacted",        color:"#F59E0B", icon:"◌" },
  { id:"showing",   label:"Showing Scheduled",color:"#3B82F6", icon:"◉" },
  { id:"offer",     label:"Offer Made",       color:"#8B5CF6", icon:"◈" },
  { id:"contract",  label:"Under Contract",   color:"#10B981", icon:"★" },
  { id:"closed",    label:"Closed",           color:"#059669", icon:"✓" },
  { id:"dead",      label:"Not Moving",       color:"#94A3B8", icon:"✕" },
];

const LEAD_TYPES = ["Buyer","Seller","Both"];
const TIMELINES  = ["ASAP","1-3 months","3-6 months","6-12 months","Just browsing"];
const PRICE_RANGES = ["Under $200k","$200k-$400k","$400k-$600k","$600k-$1M","$1M+"];

// ─── DB helpers ───────────────────────────────────────────────────────────────
function toRow(lead, userId) {
  return {
    id:           lead.id,
    user_id:      userId,
    stage:        lead.stage,
    name:         lead.name,
    phone:        lead.phone||"",
    address:      lead.address||"",
    sqft:         lead.sqft||null,
    equity:       lead.equity||0,
    tax_lien:     false,
    vacant:       false,
    score:        lead.score||50,
    hot:          lead.hot||false,
    notes:        lead.notes||"",
    arv:          lead.listPrice?{value:lead.listPrice,mao:lead.listPrice}:null,
    comps:        lead.comps||[],
    rehab_tier:   null,
    condition_report: lead.conditionReport||null,
    sms_history:  lead.smsHistory||[],
    follow_ups:   lead.followUps||[],
    last_contact: lead.lastContact||null,
  };
}

function fromRow(row) {
  return {
    id:             row.id,
    stage:          row.stage,
    name:           row.name,
    phone:          row.phone,
    address:        row.address,
    sqft:           row.sqft,
    equity:         row.equity,
    score:          row.score,
    hot:            row.hot,
    notes:          row.notes,
    listPrice:      row.arv?.value||null,
    commission:     row.arv?.mao||null,
    comps:          row.comps||[],
    conditionReport:row.condition_report,
    smsHistory:     row.sms_history||[],
    followUps:      row.follow_ups||[],
    lastContact:    row.last_contact,
    leadType:       "Buyer",
    timeline:       "1-3 months",
    priceRange:     "$200k-$400k",
    preApproved:    false,
    gci:            null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt$ = n => "$" + Math.round(n).toLocaleString();
const stageOf = id => STAGES.find(s => s.id === id) || STAGES[0];
const commissionCalc = (price, rate=0.03) => Math.round(price * rate);

// ─── AI helper ────────────────────────────────────────────────────────────────
async function callClaude(system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:800, system, messages:[{role:"user",content:user}] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.find(b => b.type==="text")?.text?.trim() || "";
}

// ─── Bubble ───────────────────────────────────────────────────────────────────
const Bubble = ({ msg }) => (
  <div style={{ display:"flex", justifyContent:msg.from==="in"?"flex-start":"flex-end", marginBottom:8 }}>
    <div style={{ maxWidth:"82%", padding:"10px 14px", borderRadius:msg.from==="in"?"4px 16px 16px 16px":"16px 4px 16px 16px",
      background:msg.from==="in"?"#F1F5F9":"#6366F1", fontSize:13, color:msg.from==="in"?"#1E293B":"#fff", lineHeight:1.55 }}>
      {msg.text}
      <div style={{ fontSize:10, color:msg.from==="in"?"#94A3B8":"rgba(255,255,255,.6)", marginTop:4 }}>{msg.time}</div>
    </div>
  </div>
);

// ─── AI Panel ─────────────────────────────────────────────────────────────────
function AIPanel({ lead, onClose, onUpdate }) {
  const [tab, setTab]       = useState("sms");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [copied, setCopied]   = useState(false);
  const stage = stageOf(lead.stage);

  const run = async (system, user) => {
    setLoading(true); setResult(null);
    try { setResult(await callClaude(system, user)); }
    catch(e) { setResult("Error: " + e.message); }
    setLoading(false);
  };

  const runSMS = () => run(
    `You are a professional real estate agent. Draft a natural, helpful SMS under 160 chars. No pressure tactics. Build trust and move toward next step.`,
    `Client: ${lead.name} | Type: ${lead.leadType||"Buyer"} | Stage: ${stage.label} | Timeline: ${lead.timeline||"unknown"} | Price range: ${lead.priceRange||"unknown"} | Notes: ${lead.notes}\n\nConversation:\n${lead.smsHistory.map(m=>`${m.from==="in"?lead.name:"You"}: ${m.text}`).join("\n")||"No messages yet"}\n\nDraft next SMS. Output ONLY message text.`
  );

  const runScore = () => run(
    `You are a real estate lead qualification expert. Score and qualify honestly.`,
    `Score this real estate lead:\nName: ${lead.name}\nType: ${lead.leadType||"Buyer"}\nTimeline: ${lead.timeline||"unknown"}\nPrice range: ${lead.priceRange||"unknown"}\nPre-approved: ${lead.preApproved?"YES":"NO"}\nStage: ${stage.label}\nNotes: ${lead.notes}\n\nReturn:\n1. Score (0-100)\n2. HOT LEAD: YES/NO\n3. Qualification signals\n4. Urgency: Low/Medium/High\n5. Recommended next action`
  );

  const runFollowUp = () => run(
    `You are a top real estate agent. Create a strategic follow-up plan.`,
    `Client: ${lead.name} | ${lead.leadType||"Buyer"} | ${lead.timeline||"unknown"} timeline | ${lead.priceRange||"unknown"}\nStage: ${stage.label} | Last contact: ${lead.lastContact||"never"}\nNotes: ${lead.notes}\n\nCreate a 3-touch follow-up sequence with timing and exact message for each.`
  );

  const runListPrice = () => run(
    `You are a real estate listing specialist and pricing expert.`,
    `Property: ${lead.address}\nSqft: ${lead.sqft||"unknown"}\nComps:\n${(lead.comps||[]).map(c=>`${c.address}: ${fmt$(c.soldPrice)} (${c.sqft||"?"}sqft, ${c.daysAgo}d ago)`).join("\n")||"No comps added yet"}\n\nProvide:\n1. Recommended list price range\n2. Aggressive vs conservative pricing strategy\n3. Price per sqft analysis\n4. Days on market estimate\n5. Key pricing factors`
  );

  const applyDraft = () => {
    const now = new Date();
    const time = now.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" "+now.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
    navigator.clipboard.writeText(result.trim());
    onUpdate({...lead, smsHistory:[...lead.smsHistory,{from:"out",text:result.trim(),time}]});
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };

  const applyScore = () => {
    const s = result.match(/\b(\d{1,3})\b/);
    const h = result.match(/HOT LEAD:\s*(YES|NO)/i);
    onUpdate({...lead, score:s?Math.min(100,parseInt(s[1])):lead.score, hot:h?h[1].toUpperCase()==="YES":lead.hot});
  };

  const TABS = [
    { id:"sms",       label:"Draft SMS",   run:runSMS },
    { id:"score",     label:"Score",       run:runScore },
    { id:"followup",  label:"Follow-Up",   run:runFollowUp },
    { id:"listprice", label:"List Price",  run:runListPrice },
  ];

  return (
    <div style={{ position:"fixed", right:0, top:0, bottom:0, width:420, background:"#fff", borderLeft:"1px solid #E2E8F0", display:"flex", flexDirection:"column", zIndex:100, boxShadow:"-8px 0 32px rgba(0,0,0,.08)" }}>
      <div style={{ padding:"20px 22px 16px", borderBottom:"1px solid #E2E8F0", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:3, color:"#6366F1", fontFamily:"'DM Mono',monospace", marginBottom:4 }}>AI AGENT</div>
          <div style={{ fontSize:16, fontWeight:700, color:"#0F172A" }}>{lead.name}</div>
          <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>{lead.address}</div>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", color:"#94A3B8", cursor:"pointer", fontSize:20 }}>✕</button>
      </div>
      <div style={{ display:"flex", borderBottom:"1px solid #E2E8F0" }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setResult(null);}} style={{ background:"none", border:"none", padding:"10px 12px", fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap", color:tab===t.id?"#6366F1":"#94A3B8", borderBottom:tab===t.id?"2px solid #6366F1":"2px solid transparent" }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:18 }}>
        {tab==="sms" && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, letterSpacing:2, color:"#94A3B8", fontFamily:"'DM Mono',monospace", marginBottom:10 }}>CONVERSATION</div>
            {lead.smsHistory.map((m,i) => <Bubble key={i} msg={m}/>)}
          </div>
        )}
        {result && (
          <div style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:10, padding:16, marginTop:8 }}>
            <div style={{ fontSize:10, letterSpacing:2, color:"#6366F1", fontFamily:"'DM Mono',monospace", marginBottom:10 }}>AI OUTPUT</div>
            <div style={{ fontSize:13, color:"#334155", lineHeight:1.75, whiteSpace:"pre-wrap" }}>{result}</div>
            <div style={{ display:"flex", gap:8, marginTop:14 }}>
              {tab==="sms"      && <button onClick={applyDraft} style={{ background:copied?"#10B981":"#6366F1", border:"none", borderRadius:6, color:"#fff", padding:"8px 16px", fontSize:11, cursor:"pointer", fontWeight:700 }}>{copied?"✓ COPIED":"COPY & LOG"}</button>}
              {tab==="score"    && <button onClick={applyScore} style={{ background:"#6366F1", border:"none", borderRadius:6, color:"#fff", padding:"8px 16px", fontSize:11, cursor:"pointer", fontWeight:700 }}>SAVE SCORE</button>}
            </div>
          </div>
        )}
        {loading && <div style={{ display:"flex", alignItems:"center", gap:10, padding:16, color:"#6366F1", fontSize:13 }}><div style={{ width:8, height:8, borderRadius:"50%", background:"#6366F1", animation:"pulse 1s infinite" }}/>Processing...</div>}
      </div>
      <div style={{ padding:"14px 18px", borderTop:"1px solid #E2E8F0" }}>
        <button onClick={TABS.find(t=>t.id===tab)?.run} disabled={loading} style={{ width:"100%", border:"none", borderRadius:8, background:loading?"#F1F5F9":"#6366F1", color:loading?"#94A3B8":"#fff", padding:"12px", fontSize:12, fontWeight:700, cursor:loading?"not-allowed":"pointer", letterSpacing:1 }}>
          {loading ? "GENERATING..." : `▶ RUN ${TABS.find(t=>t.id===tab)?.label?.toUpperCase()}`}
        </button>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

// ─── Lead Modal ───────────────────────────────────────────────────────────────
function LeadModal({ lead, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState("details");
  const [aiOpen, setAiOpen]       = useState(false);
  const [smsInput, setSmsInput]   = useState("");
  const [inbound, setInbound]     = useState("");
  const [copied, setCopied]       = useState(null);
  const [commRate, setCommRate]   = useState(3);
  const stage = stageOf(lead.stage);

  const now = () => { const d=new Date(); return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}); };

  const sendSMS = () => {
    if (!smsInput.trim()) return;
    onUpdate({...lead, smsHistory:[...lead.smsHistory,{from:"out",text:smsInput.trim(),time:now()}], lastContact:"Just now"});
    setSmsInput("");
  };

  const logInbound = () => {
    if (!inbound.trim()) return;
    onUpdate({...lead, smsHistory:[...lead.smsHistory,{from:"in",text:inbound.trim(),time:now()}], lastContact:"Just now"});
    setInbound("");
  };

  const copyText = (text, id) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(()=>setCopied(null),2000); };

  const gci = lead.listPrice ? commissionCalc(lead.listPrice, commRate/100) : null;

  const inp = { width:"100%", boxSizing:"border-box", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, padding:"10px 12px", color:"#0F172A", fontSize:13, fontFamily:"Inter,sans-serif", outline:"none" };
  const lab = { display:"block", fontSize:10, fontFamily:"'DM Mono',monospace", color:"#94A3B8", letterSpacing:1, marginBottom:6 };

  return (
    <>
      <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.4)", zIndex:50, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={e=>e.target===e.currentTarget&&onClose()}>
        <div style={{ background:"#fff", borderRadius:16, width:880, maxHeight:"92vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px rgba(0,0,0,.15)" }}>

          {/* Header */}
          <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #E2E8F0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:stage.color }}/>
                <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:stage.color, letterSpacing:2 }}>{stage.label.toUpperCase()}</span>
                {lead.hot && <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"#FEF3C7", color:"#D97706", borderRadius:4, padding:"2px 8px", fontWeight:700 }}>🔥 HOT</span>}
                <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", background:"#EEF2FF", color:"#6366F1", borderRadius:4, padding:"2px 8px" }}>{lead.leadType||"Buyer"}</span>
              </div>
              <div style={{ fontSize:22, fontWeight:800, color:"#0F172A" }}>{lead.name}</div>
              <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>{lead.phone} · {lead.address||"No address"}</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>onUpdate({...lead,hot:!lead.hot})} style={{ background:lead.hot?"#FEF3C7":"#F8FAFC", border:`1px solid ${lead.hot?"#F59E0B":"#E2E8F0"}`, borderRadius:8, color:lead.hot?"#D97706":"#94A3B8", padding:"8px 14px", fontSize:13, cursor:"pointer", fontWeight:700 }}>
                {lead.hot?"🔥 HOT":"☆ Mark Hot"}
              </button>
              <button onClick={()=>setAiOpen(true)} style={{ background:"#EEF2FF", border:"1px solid #C7D2FE", borderRadius:8, color:"#6366F1", padding:"8px 16px", fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>⚡ AI AGENT</button>
              <button onClick={onClose} style={{ background:"none", border:"none", color:"#94A3B8", cursor:"pointer", fontSize:22 }}>✕</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", borderBottom:"1px solid #E2E8F0", padding:"0 24px" }}>
            {[["details","Details"],["comps","Comps & Price"],["sms","Messages"]].map(([id,label])=>(
              <button key={id} onClick={()=>setActiveTab(id)} style={{ background:"none", border:"none", padding:"10px 16px", fontSize:12, cursor:"pointer", fontFamily:"'DM Mono',monospace", color:activeTab===id?"#6366F1":"#94A3B8", borderBottom:activeTab===id?"2px solid #6366F1":"2px solid transparent" }}>{label}</button>
            ))}
          </div>

          <div style={{ flex:1, overflow:"hidden", display:"flex" }}>

            {/* DETAILS TAB */}
            {activeTab==="details" && (
              <div style={{ flex:1, overflowY:"auto", padding:24 }}>
                {/* Stage selector */}
                <div style={{ marginBottom:20 }}>
                  <label style={lab}>PIPELINE STAGE</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {STAGES.map(s=>(
                      <button key={s.id} onClick={()=>onUpdate({...lead,stage:s.id})} style={{ padding:"6px 12px", borderRadius:6, cursor:"pointer", fontSize:11, fontFamily:"'DM Mono',monospace", background:lead.stage===s.id?s.color+"15":"#F8FAFC", border:`1px solid ${lead.stage===s.id?s.color:"#E2E8F0"}`, color:lead.stage===s.id?s.color:"#64748B" }}>
                        {s.icon} {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Client info grid */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
                  <div>
                    <label style={lab}>CLIENT TYPE</label>
                    <select value={lead.leadType||"Buyer"} onChange={e=>onUpdate({...lead,leadType:e.target.value})} style={{...inp,cursor:"pointer"}}>
                      {LEAD_TYPES.map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lab}>TIMELINE</label>
                    <select value={lead.timeline||"1-3 months"} onChange={e=>onUpdate({...lead,timeline:e.target.value})} style={{...inp,cursor:"pointer"}}>
                      {TIMELINES.map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lab}>PRICE RANGE</label>
                    <select value={lead.priceRange||"$200k-$400k"} onChange={e=>onUpdate({...lead,priceRange:e.target.value})} style={{...inp,cursor:"pointer"}}>
                      {PRICE_RANGES.map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Pre-approval */}
                <div style={{ marginBottom:20 }}>
                  <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                    <input type="checkbox" checked={lead.preApproved||false} onChange={e=>onUpdate({...lead,preApproved:e.target.checked})} style={{ width:16, height:16, accentColor:"#10B981" }}/>
                    <span style={{ fontSize:13, color:"#334155", fontWeight:500 }}>Pre-approved for financing</span>
                    {lead.preApproved && <span style={{ fontSize:11, background:"#D1FAE5", color:"#065F46", borderRadius:4, padding:"2px 8px", fontFamily:"'DM Mono',monospace", fontWeight:600 }}>✓ QUALIFIED</span>}
                  </label>
                </div>

                {/* GCI Calculator */}
                {lead.listPrice && (
                  <div style={{ marginBottom:20, background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10, padding:16 }}>
                    <div style={{ fontSize:10, letterSpacing:2, color:"#059669", fontFamily:"'DM Mono',monospace", marginBottom:12 }}>GCI CALCULATOR</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                      {[["List Price",fmt$(lead.listPrice),"#0F172A"],["Commission Rate",commRate+"%","#6366F1"],["Your GCI",gci?fmt$(gci):"—","#059669"]].map(([k,v,c])=>(
                        <div key={k} style={{ background:"#fff", borderRadius:8, padding:"10px 12px", border:"1px solid #BBF7D0" }}>
                          <div style={{ fontSize:10, color:"#94A3B8", fontFamily:"'DM Mono',monospace" }}>{k}</div>
                          <div style={{ fontSize:18, fontWeight:800, color:c, fontFamily:"'DM Mono',monospace" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <label style={{ fontSize:12, color:"#059669" }}>Rate %</label>
                      <input type="range" min={1} max={6} step={0.5} value={commRate} onChange={e=>setCommRate(parseFloat(e.target.value))} style={{ flex:1, accentColor:"#10B981" }}/>
                      <span style={{ fontSize:13, fontWeight:700, color:"#059669", fontFamily:"'DM Mono',monospace", width:36 }}>{commRate}%</span>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label style={lab}>NOTES</label>
                  <div style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, padding:12, fontSize:13, color:"#475569", lineHeight:1.6 }}>{lead.notes||"No notes yet."}</div>
                </div>
              </div>
            )}

            {/* COMPS TAB */}
            {activeTab==="comps" && (
              <div style={{ flex:1, overflowY:"auto", padding:24 }}>
                <CompsPanel lead={lead} onUpdate={onUpdate}/>
              </div>
            )}

            {/* MESSAGES TAB */}
            {activeTab==="sms" && (
              <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
                <div style={{ padding:"10px 16px", borderBottom:"1px solid #E2E8F0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontSize:11, color:"#94A3B8", fontFamily:"'DM Mono',monospace" }}>{lead.smsHistory.length} MESSAGES</div>
                </div>
                <div style={{ flex:1, overflowY:"auto", padding:16 }}>
                  {lead.smsHistory.length===0 && <div style={{ textAlign:"center", color:"#CBD5E1", fontSize:13, padding:"40px 0" }}>No messages yet</div>}
                  {lead.smsHistory.map((m,i)=><Bubble key={i} msg={m}/>)}
                </div>
                <div style={{ padding:"10px 14px", borderTop:"1px solid #E2E8F0", background:"#F0FDF4" }}>
                  <div style={{ fontSize:9, letterSpacing:2, color:"#059669", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>LOG CLIENT MESSAGE</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input value={inbound} onChange={e=>setInbound(e.target.value)} onKeyDown={e=>e.key==="Enter"&&logInbound()} placeholder="Paste client's message here..." style={{ flex:1, background:"#fff", border:"1px solid #BBF7D0", borderRadius:8, padding:"9px 12px", color:"#0F172A", fontSize:12, outline:"none" }}/>
                    <button onClick={logInbound} style={{ background:"#10B981", border:"none", borderRadius:8, color:"#fff", padding:"9px 14px", cursor:"pointer", fontWeight:700, fontSize:11, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>LOG</button>
                  </div>
                </div>
                <div style={{ padding:"10px 14px", borderTop:"1px solid #E2E8F0" }}>
                  <div style={{ fontSize:9, letterSpacing:2, color:"#6366F1", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>YOUR REPLY — COPY & SEND</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input value={smsInput} onChange={e=>setSmsInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendSMS()} placeholder="Type or use AI Agent to draft..." style={{ flex:1, background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, padding:"9px 12px", color:"#0F172A", fontSize:12, outline:"none" }}/>
                    <button onClick={()=>{if(smsInput.trim()){copyText(smsInput,999);sendSMS();}}} style={{ background:"#6366F1", border:"none", borderRadius:8, color:"#fff", padding:"9px 14px", cursor:"pointer", fontWeight:700, fontSize:11, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>
                      {copied===999?"✓ COPIED":"COPY & LOG"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {aiOpen && <AIPanel lead={lead} onClose={()=>setAiOpen(false)} onUpdate={u=>{onUpdate(u);}}/>}
    </>
  );
}

// ─── Comps Panel ──────────────────────────────────────────────────────────────
function CompsPanel({ lead, onUpdate }) {
  const [newComp, setNewComp] = useState({ address:"", sqft:"", soldPrice:"", daysAgo:"" });
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const addComp = () => {
    if (!newComp.address||!newComp.soldPrice) return;
    const comp = { address:newComp.address, sqft:parseInt(newComp.sqft)||0, soldPrice:parseInt(newComp.soldPrice.replace(/[^0-9]/g,""))||0, daysAgo:parseInt(newComp.daysAgo)||0 };
    onUpdate({...lead, comps:[...(lead.comps||[]),comp]});
    setNewComp({address:"",sqft:"",soldPrice:"",daysAgo:""});
  };

  const removeComp = i => { const c=[...(lead.comps||[])]; c.splice(i,1); onUpdate({...lead,comps:c}); };

  const runAI = async () => {
    if (!lead.comps?.length) return;
    setLoading(true);
    try {
      const summary = lead.comps.map(c=>`${c.address}: ${fmt$(c.soldPrice)} (${c.sqft||"?"}sqft, ${c.daysAgo}d ago)`).join("\n");
      const result = await callClaude("Real estate pricing analyst. Return ONLY valid JSON.",
        `Property: ${lead.address}, ${lead.sqft||"?"}sqft\nComps:\n${summary}\nReturn JSON: {"listPrice":number,"lowPrice":number,"highPrice":number,"pricePerSqft":number,"daysOnMarket":15,"confidence":"low|medium|high","strategy":"one sentence pricing recommendation"}`);
      setAiResult(JSON.parse(result.replace(/```json|```/g,"").trim()));
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const savePrice = () => {
    if (!aiResult) return;
    onUpdate({...lead, listPrice:aiResult.listPrice, gci:Math.round(aiResult.listPrice*0.03)});
    setAiResult(null);
  };

  const inp = { background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:6, padding:"8px 10px", color:"#0F172A", fontSize:12, outline:"none", width:"100%", boxSizing:"border-box" };

  return (
    <div>
      <div style={{ fontSize:10, letterSpacing:2, color:"#94A3B8", fontFamily:"'DM Mono',monospace", marginBottom:12 }}>COMPARABLE SALES</div>
      {(lead.comps||[]).length>0 && (
        <div style={{ marginBottom:16 }}>
          {lead.comps.map((c,i)=>(
            <div key={i} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, padding:"10px 14px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"#0F172A" }}>{c.address}</div>
                <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>{c.sqft?`${c.sqft.toLocaleString()}sqft · `:""}{c.daysAgo}d ago</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ fontSize:15, fontWeight:800, color:"#059669", fontFamily:"'DM Mono',monospace" }}>{fmt$(c.soldPrice)}</div>
                {c.sqft&&<div style={{ fontSize:10, color:"#94A3B8" }}>${Math.round(c.soldPrice/c.sqft)}/sf</div>}
                <button onClick={()=>removeComp(i)} style={{ background:"none", border:"none", color:"#CBD5E1", cursor:"pointer", fontSize:16 }}>×</button>
              </div>
            </div>
          ))}
          <button onClick={runAI} disabled={loading} style={{ width:"100%", background:loading?"#F1F5F9":"#EEF2FF", border:"1px solid #C7D2FE", borderRadius:8, padding:"10px", color:loading?"#94A3B8":"#6366F1", fontSize:12, cursor:loading?"not-allowed":"pointer", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
            {loading?"ANALYZING...":"⚡ AI — RECOMMEND LIST PRICE"}
          </button>
          {aiResult && (
            <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10, padding:16, marginTop:12 }}>
              <div style={{ fontSize:10, letterSpacing:2, color:"#059669", fontFamily:"'DM Mono',monospace", marginBottom:12 }}>AI PRICING · {aiResult.confidence?.toUpperCase()} CONFIDENCE</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:12 }}>
                {[["List Price",fmt$(aiResult.listPrice),"#059669"],["Low",fmt$(aiResult.lowPrice),"#64748B"],["High",fmt$(aiResult.highPrice),"#64748B"],["$/sqft","$"+aiResult.pricePerSqft,"#6366F1"]].map(([k,v,c])=>(
                  <div key={k} style={{ background:"#fff", borderRadius:6, padding:"8px 10px", border:"1px solid #BBF7D0" }}>
                    <div style={{ fontSize:9, color:"#94A3B8", fontFamily:"'DM Mono',monospace" }}>{k}</div>
                    <div style={{ fontSize:14, fontWeight:800, color:c, fontFamily:"'DM Mono',monospace" }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12, color:"#065F46", marginBottom:12 }}>{aiResult.strategy}</div>
              <button onClick={savePrice} style={{ background:"#10B981", border:"none", borderRadius:6, color:"#fff", padding:"8px 16px", fontSize:11, cursor:"pointer", fontWeight:700 }}>SAVE LIST PRICE →</button>
            </div>
          )}
        </div>
      )}
      <div style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:10, padding:16 }}>
        <div style={{ fontSize:10, color:"#94A3B8", fontFamily:"'DM Mono',monospace", marginBottom:10 }}>ADD COMPARABLE SALE</div>
        <div style={{ marginBottom:8 }}><input value={newComp.address} onChange={e=>setNewComp(n=>({...n,address:e.target.value}))} placeholder="123 Main St, City TX" style={inp}/></div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
          <input value={newComp.soldPrice} onChange={e=>setNewComp(n=>({...n,soldPrice:e.target.value}))} placeholder="Sale price" style={inp}/>
          <input value={newComp.sqft} onChange={e=>setNewComp(n=>({...n,sqft:e.target.value}))} placeholder="Sqft" style={inp} type="number"/>
          <input value={newComp.daysAgo} onChange={e=>setNewComp(n=>({...n,daysAgo:e.target.value}))} placeholder="Days ago" style={inp} type="number"/>
        </div>
        <button onClick={addComp} style={{ background:"#6366F1", border:"none", borderRadius:6, color:"#fff", padding:"8px 16px", fontSize:11, cursor:"pointer", fontWeight:700 }}>+ ADD COMP</button>
      </div>
    </div>
  );
}

// ─── Lead Card ────────────────────────────────────────────────────────────────
function LeadCard({ lead, onClick, onDragStart }) {
  const stage = stageOf(lead.stage);
  return (
    <div draggable onDragStart={e=>onDragStart(e,lead.id)} onClick={()=>onClick(lead)}
      style={{ background:"#fff", border:`1px solid ${lead.hot?"#FDE68A":"#E2E8F0"}`, borderRadius:10, padding:"14px 16px", cursor:"pointer", marginBottom:8, boxShadow:"0 1px 3px rgba(0,0,0,.06)", transition:"all .2s", position:"relative" }}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,.1)";e.currentTarget.style.transform="translateY(-1px)";}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,.06)";e.currentTarget.style.transform="translateY(0)";}}>
      {lead.hot && <div style={{ position:"absolute", top:8, right:8, background:"#FEF3C7", color:"#D97706", fontSize:9, fontWeight:800, fontFamily:"'DM Mono',monospace", borderRadius:4, padding:"2px 6px" }}>🔥 HOT</div>}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#0F172A", paddingRight:lead.hot?44:0 }}>{lead.name}</div>
        <div style={{ fontSize:12, fontWeight:700, color:lead.score>=80?"#6366F1":lead.score>=55?"#F59E0B":"#94A3B8", fontFamily:"'DM Mono',monospace" }}>{lead.score}</div>
      </div>
      <div style={{ fontSize:11, color:"#94A3B8", marginBottom:8 }}>{lead.phone}</div>
      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:lead.listPrice?8:0 }}>
        <span style={{ fontSize:10, background:"#EEF2FF", color:"#6366F1", borderRadius:4, padding:"2px 7px", fontFamily:"'DM Mono',monospace", fontWeight:600 }}>{lead.leadType||"Buyer"}</span>
        {lead.timeline&&<span style={{ fontSize:10, background:"#F8FAFC", color:"#64748B", borderRadius:4, padding:"2px 7px", fontFamily:"'DM Mono',monospace" }}>{lead.timeline}</span>}
        {lead.preApproved&&<span style={{ fontSize:10, background:"#D1FAE5", color:"#065F46", borderRadius:4, padding:"2px 7px", fontFamily:"'DM Mono',monospace", fontWeight:600 }}>✓ PRE-APPROVED</span>}
      </div>
      {lead.listPrice && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:8 }}>
          {[["LIST",fmt$(lead.listPrice),"#0F172A"],["GCI",fmt$(commissionCalc(lead.listPrice)),"#059669"]].map(([k,v,c])=>(
            <div key={k} style={{ background:"#F8FAFC", borderRadius:6, padding:"5px 8px" }}>
              <div style={{ fontSize:8, color:"#94A3B8", fontFamily:"'DM Mono',monospace" }}>{k}</div>
              <div style={{ fontSize:12, fontWeight:700, color:c, fontFamily:"'DM Mono',monospace" }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── New Lead Modal ───────────────────────────────────────────────────────────
function NewLeadModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name:"", phone:"", address:"", leadType:"Buyer", timeline:"1-3 months", priceRange:"$200k-$400k", preApproved:false, notes:"", stage:"new" });
  const [error, setError] = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const handleAdd = () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    onAdd({ id:Date.now(), ...form, name:form.name.trim(), phone:form.phone.trim(), score:50, hot:false, comps:[], smsHistory:[], followUps:[], lastContact:null, listPrice:null, gci:null, conditionReport:null });
    onClose();
  };
  const inp = { width:"100%", boxSizing:"border-box", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, padding:"10px 12px", color:"#0F172A", fontSize:13, fontFamily:"Inter,sans-serif", outline:"none" };
  const lab = { display:"block", fontSize:10, fontFamily:"'DM Mono',monospace", color:"#94A3B8", letterSpacing:1, marginBottom:6 };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.4)", zIndex:50, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:"#fff", borderRadius:16, width:520, maxHeight:"90vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px rgba(0,0,0,.15)" }}>
        <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #E2E8F0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:10, letterSpacing:3, color:"#6366F1", fontFamily:"'DM Mono',monospace", marginBottom:4 }}>NEW CLIENT</div><div style={{ fontSize:20, fontWeight:800, color:"#0F172A" }}>Add to Pipeline</div></div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#94A3B8", cursor:"pointer", fontSize:22 }}>✕</button>
        </div>
        <div style={{ overflowY:"auto", padding:24 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
            <div><label style={lab}>CLIENT NAME *</label><input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Sarah Johnson" style={inp}/></div>
            <div><label style={lab}>PHONE</label><input value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="(713) 555-1234" style={inp}/></div>
          </div>
          <div style={{ marginBottom:14 }}><label style={lab}>PROPERTY ADDRESS (if listing)</label><input value={form.address} onChange={e=>set("address",e.target.value)} placeholder="123 Main St, Houston TX 77001" style={inp}/></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:14 }}>
            <div><label style={lab}>CLIENT TYPE</label><select value={form.leadType} onChange={e=>set("leadType",e.target.value)} style={{...inp,cursor:"pointer"}}>{LEAD_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
            <div><label style={lab}>TIMELINE</label><select value={form.timeline} onChange={e=>set("timeline",e.target.value)} style={{...inp,cursor:"pointer"}}>{TIMELINES.map(t=><option key={t}>{t}</option>)}</select></div>
            <div><label style={lab}>PRICE RANGE</label><select value={form.priceRange} onChange={e=>set("priceRange",e.target.value)} style={{...inp,cursor:"pointer"}}>{PRICE_RANGES.map(t=><option key={t}>{t}</option>)}</select></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
            <div><label style={lab}>PIPELINE STAGE</label><select value={form.stage} onChange={e=>set("stage",e.target.value)} style={{...inp,cursor:"pointer"}}>{STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            <div style={{ display:"flex", alignItems:"flex-end", paddingBottom:2 }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}><input type="checkbox" checked={form.preApproved} onChange={e=>set("preApproved",e.target.checked)} style={{ width:16, height:16, accentColor:"#10B981" }}/><span style={{ fontSize:13, color:"#334155" }}>Pre-approved</span></label>
            </div>
          </div>
          <div style={{ marginBottom:14 }}><label style={lab}>NOTES</label><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="First-time buyer, looking near good schools..." rows={3} style={{...inp,resize:"vertical",lineHeight:1.5}}/></div>
          {error&&<div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"10px 14px", marginBottom:14, color:"#DC2626", fontSize:13 }}>⚠ {error}</div>}
        </div>
        <div style={{ padding:"16px 24px", borderTop:"1px solid #E2E8F0", display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={onClose} style={{ background:"none", border:"1px solid #E2E8F0", borderRadius:8, color:"#64748B", padding:"10px 20px", cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleAdd} style={{ background:"#6366F1", border:"none", borderRadius:8, color:"#fff", padding:"10px 24px", cursor:"pointer", fontSize:13, fontWeight:700 }}>+ ADD CLIENT</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main CRM ─────────────────────────────────────────────────────────────────
export default function App({ currentUser, onLeadsChange }) {
  const [leads, setLeads]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [showNew, setShowNew]   = useState(false);
  const [search, setSearch]     = useState("");
  const [hotOnly, setHotOnly]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [dbReady, setDbReady]   = useState(false);
  const userId = currentUser?.id;

  useEffect(()=>{
    if(!userId)return;
    supabase.from("leads").select("*").eq("user_id",userId).order("created_at",{ascending:false})
      .then(({data,error})=>{
        if(error){console.error(error);setDbReady(true);return;}
        const loaded=(data||[]).map(fromRow);
        setLeads(loaded);
        onLeadsChange?.(loaded);
        setDbReady(true);
      });
  },[userId]);

  const saveLead = async lead => {
    if(!userId)return;
    setSaving(true);
    await supabase.from("leads").upsert(toRow(lead,userId));
    setTimeout(()=>setSaving(false),600);
  };

  const setLeadsSync = updater => {
    setLeads(prev=>{
      const next=typeof updater==="function"?updater(prev):updater;
      onLeadsChange?.(next);
      return next;
    });
  };

  const addLead = async lead => { setLeadsSync(ls=>[lead,...ls]); await saveLead(lead); };

  const updateLead = async upd => {
    setLeadsSync(ls=>ls.map(l=>l.id===upd.id?upd:l));
    await saveLead(upd);
  };

  const onDragStart=(e,id)=>{setDragging(id);e.dataTransfer.effectAllowed="move";};
  const onDragOver=e=>{e.preventDefault();};
  const onDrop=(e,stageId)=>{
    e.preventDefault();
    if(!dragging)return;
    const lead=leads.find(l=>l.id===dragging);
    if(lead){const u={...lead,stage:stageId};setLeadsSync(ls=>ls.map(l=>l.id===dragging?u:l));saveLead(u);}
    setDragging(null);
  };

  const filtered = leads.filter(l=>{
    if(hotOnly&&!l.hot)return false;
    if(!search)return true;
    return l.name.toLowerCase().includes(search.toLowerCase())||l.phone?.includes(search);
  });

  // Stats
  const totalGCI   = leads.filter(l=>l.listPrice).reduce((s,l)=>s+commissionCalc(l.listPrice),0);
  const closedGCI  = leads.filter(l=>l.stage==="closed"&&l.listPrice).reduce((s,l)=>s+commissionCalc(l.listPrice),0);
  const hotCount   = leads.filter(l=>l.hot).length;
  const underContract = leads.filter(l=>l.stage==="contract").length;

  if(!dbReady)return(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#F8FAFC",flexDirection:"column",gap:12}}>
      <div style={{width:32,height:32,border:"2px solid #E2E8F0",borderTopColor:"#6366F1",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
      <div style={{fontSize:12,color:"#94A3B8",fontFamily:"'DM Mono',monospace"}}>LOADING...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden",background:"#F8FAFC",fontFamily:"Inter,sans-serif",color:"#0F172A"}}>
      {/* Sub-header stats */}
      <div style={{borderBottom:"1px solid #E2E8F0",padding:"0 20px",background:"#fff",display:"flex",alignItems:"center",gap:0,flexShrink:0}}>
        <div style={{display:"flex",gap:0,flex:1}}>
          {[
            {label:"PIPELINE GCI",  value:fmt$(totalGCI),    color:"#059669"},
            {label:"CLOSED GCI",    value:fmt$(closedGCI),   color:"#6366F1"},
            {label:"🔥 HOT LEADS",  value:hotCount,          color:"#D97706"},
            {label:"UNDER CONTRACT",value:underContract,      color:"#3B82F6"},
          ].map((s,i)=>(
            <div key={i} style={{padding:"12px 20px",borderLeft:i===0?"none":"1px solid #E2E8F0"}}>
              <div style={{fontSize:9,letterSpacing:2,color:"#94A3B8",fontFamily:"'DM Mono',monospace"}}>{s.label}</div>
              <div style={{fontSize:18,fontWeight:800,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",padding:"10px 0"}}>
          {saving&&<div style={{fontSize:11,color:"#F59E0B",fontFamily:"'DM Mono',monospace"}}>SAVING...</div>}
          {!saving&&leads.length>0&&<div style={{fontSize:11,color:"#10B981",fontFamily:"'DM Mono',monospace"}}>✓ SAVED</div>}
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients..." style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,padding:"7px 12px",color:"#0F172A",fontSize:12,width:160,outline:"none"}}/>
          <button onClick={()=>setHotOnly(!hotOnly)} style={{background:hotOnly?"#FEF3C7":"#F8FAFC",border:`1px solid ${hotOnly?"#F59E0B":"#E2E8F0"}`,borderRadius:8,color:hotOnly?"#D97706":"#94A3B8",padding:"7px 11px",cursor:"pointer",fontSize:11}}>🔥</button>
          <button onClick={()=>setShowNew(true)} style={{background:"#6366F1",border:"none",borderRadius:8,color:"#fff",padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700}}>+ NEW CLIENT</button>
        </div>
      </div>

      {/* Kanban */}
      <div style={{display:"flex",gap:0,padding:"16px 12px",overflowX:"auto",flex:1,boxSizing:"border-box"}}>
        {STAGES.map(stage=>{
          const stageLeads=filtered.filter(l=>l.stage===stage.id);
          return(
            <div key={stage.id} onDragOver={onDragOver} onDrop={e=>onDrop(e,stage.id)} style={{minWidth:210,maxWidth:240,flex:"0 0 210px",margin:"0 5px",display:"flex",flexDirection:"column"}}>
              <div style={{padding:"8px 12px",marginBottom:8,borderRadius:8,background:"#fff",border:`1px solid ${stage.color}22`,borderTop:`3px solid ${stage.color}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:10,fontWeight:700,color:stage.color,fontFamily:"'DM Mono',monospace",letterSpacing:1}}>{stage.label.toUpperCase()}</span>
                  <div style={{fontSize:11,fontWeight:700,color:"#CBD5E1",fontFamily:"'DM Mono',monospace"}}>{stageLeads.length}</div>
                </div>
                {stageLeads.length>0&&stageLeads[0].listPrice&&(
                  <div style={{fontSize:11,color:"#059669",fontFamily:"'DM Mono',monospace",marginTop:3}}>
                    {fmt$(stageLeads.reduce((s,l)=>s+(l.listPrice||0),0))} total
                  </div>
                )}
              </div>
              <div style={{flex:1,overflowY:"auto",paddingRight:2}}>
                {stageLeads.map(lead=><LeadCard key={lead.id} lead={lead} onClick={setSelected} onDragStart={onDragStart}/>)}
                {stageLeads.length===0&&<div style={{border:"2px dashed #E2E8F0",borderRadius:8,padding:"18px 12px",textAlign:"center",color:"#CBD5E1",fontSize:11,fontFamily:"'DM Mono',monospace"}}>DROP HERE</div>}
              </div>
            </div>
          );
        })}
      </div>

      {selected&&<LeadModal lead={leads.find(l=>l.id===selected.id)||selected} onClose={()=>setSelected(null)} onUpdate={u=>{updateLead(u);setSelected(u);}}/>}
      {showNew&&<NewLeadModal onClose={()=>setShowNew(false)} onAdd={addLead}/>}
    </div>
  );
}
