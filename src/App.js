import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import CRM from "./realtoriq-crm";
import RealtorDashboard from "./RealtorDashboard";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600&display=swap";
document.head.appendChild(fontLink);

const supabase = createClient(
  "https://jsyzxscinfrfcebiqmja.supabase.co",
  "sb_publishable_KtY55FFvhf5WfSZpO3nSoA_02XnFl1l"
);

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode]       = useState("login");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!email.trim()||!password.trim()) { setError("Email and password required."); return; }
    setLoading(true); setError("");
    try {
      const { data, error: e } = mode==="login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options:{data:{profile:"realtor"}} });
      if (e) { setError(e.message); setLoading(false); return; }
      if (mode==="signup") { setError("✓ Check your email to confirm your account."); setLoading(false); return; }
      onLogin(data.user);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const inp = { width:"100%", boxSizing:"border-box", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, padding:"12px 14px", color:"#0F172A", fontSize:14, fontFamily:"Inter,sans-serif", outline:"none", marginBottom:14 };

  return (
    <div style={{ minHeight:"100vh", background:"#F8FAFC", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Inter,sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:40, width:420, boxShadow:"0 8px 40px rgba(0,0,0,.1)", border:"1px solid #E2E8F0" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:32, fontWeight:900, color:"#0F172A", letterSpacing:-1, marginBottom:4 }}>
            Realtor<span style={{ color:"#6366F1" }}>IQ</span>
          </div>
          <div style={{ fontSize:13, color:"#94A3B8" }}>AI-powered CRM for real estate agents</div>
        </div>
        <div style={{ display:"flex", background:"#F1F5F9", borderRadius:8, padding:3, marginBottom:24 }}>
          {[["login","Log in"],["signup","Sign up"]].map(([id,label])=>(
            <button key={id} onClick={()=>setMode(id)} style={{ flex:1, background:mode===id?"#fff":"transparent", border:"none", borderRadius:6, padding:"8px", fontSize:13, fontWeight:mode===id?700:400, color:mode===id?"#0F172A":"#64748B", cursor:"pointer", transition:"all .2s" }}>{label}</button>
          ))}
        </div>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" style={inp} type="email"/>
        <input value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} placeholder="Password" style={{...inp,marginBottom:20}} type="password"/>
        {error&&<div style={{ padding:"10px 14px", borderRadius:8, marginBottom:16, fontSize:13, background:error.startsWith("✓")?"#F0FDF4":"#FEF2F2", color:error.startsWith("✓")?"#065F46":"#DC2626", border:`1px solid ${error.startsWith("✓")?"#BBF7D0":"#FECACA"}` }}>{error}</div>}
        <button onClick={handle} disabled={loading} style={{ width:"100%", background:loading?"#E2E8F0":"#6366F1", border:"none", borderRadius:8, color:loading?"#94A3B8":"#fff", padding:"14px", fontSize:15, fontWeight:800, cursor:loading?"not-allowed":"pointer" }}>
          {loading?"...":(mode==="login"?"Log in →":"Create account →")}
        </button>
        <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:"#94A3B8" }}>
          <a href="https://dealiq-marketing.vercel.app" style={{ color:"#6366F1", textDecoration:"none" }}>← Back to DealIQ</a>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]       = useState(null);
  const [checking, setChecking] = useState(true);
  const [view, setView]       = useState("dashboard");
  const [leads, setLeads]     = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); setUser(null); setLeads([]); };
  const handleSelectLead = lead => { setSelectedLead(lead); setView("pipeline"); };

  if (checking) return (
    <div style={{ background:"#F8FAFC", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:32, height:32, border:"2px solid #E2E8F0", borderTopColor:"#6366F1", borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!user) return <LoginPage onLogin={setUser}/>;

  const NAV = [
    { id:"dashboard", label:"Dashboard" },
    { id:"pipeline",  label:"Pipeline"  },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#F8FAFC", fontFamily:"Inter,sans-serif" }}>
      {/* Nav */}
      <div style={{ display:"flex", alignItems:"center", background:"#fff", borderBottom:"1px solid #E2E8F0", padding:"0 24px", height:56, flexShrink:0, boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
        <div style={{ fontSize:20, fontWeight:900, color:"#0F172A", marginRight:36, letterSpacing:-0.5 }}>
          Realtor<span style={{ color:"#6366F1" }}>IQ</span>
        </div>
        <div style={{ display:"flex", gap:2 }}>
          {NAV.map(({id,label})=>(
            <button key={id} onClick={()=>setView(id)} style={{ background:"none", border:"none", padding:"0 16px", height:56, fontSize:13, cursor:"pointer", fontWeight:view===id?700:400, color:view===id?"#6366F1":"#64748B", borderBottom:view===id?"2px solid #6366F1":"2px solid transparent" }}>{label}</button>
          ))}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:32, height:32, borderRadius:"50%", background:"#EEF2FF", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:13, fontWeight:700, color:"#6366F1" }}>{user.email?.charAt(0).toUpperCase()}</span>
          </div>
          <div style={{ fontSize:13, color:"#64748B" }}>{user.email}</div>
          <button onClick={handleLogout} style={{ background:"none", border:"1px solid #E2E8F0", borderRadius:6, color:"#94A3B8", padding:"5px 12px", cursor:"pointer", fontSize:12 }}>Sign out</button>
        </div>
      </div>

      {/* Views */}
      <div style={{ flex:1, overflow:"hidden", display:"flex" }}>
        {view==="dashboard" && <RealtorDashboard leads={leads} onSelectLead={handleSelectLead} onGoToCRM={()=>setView("pipeline")}/>}
        {view==="pipeline"  && <CRM currentUser={user} onLogout={handleLogout} initialSelectedLead={selectedLead} onLeadsChange={setLeads}/>}
      </div>
    </div>
  );
}
