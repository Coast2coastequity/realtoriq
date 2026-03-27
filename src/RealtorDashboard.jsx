const fmt$ = n => "$" + Math.round(n).toLocaleString();
const commissionCalc = (price, rate=0.03) => Math.round(price * rate);

const STAGES = [
  {id:"new",label:"New Lead",color:"#6366F1"},
  {id:"contacted",label:"Contacted",color:"#F59E0B"},
  {id:"showing",label:"Showing",color:"#3B82F6"},
  {id:"offer",label:"Offer Made",color:"#8B5CF6"},
  {id:"contract",label:"Under Contract",color:"#10B981"},
  {id:"closed",label:"Closed",color:"#059669"},
  {id:"dead",label:"Not Moving",color:"#94A3B8"},
];

const Bar = ({value,max,color})=>(
  <div style={{flex:1,height:8,background:"#F1F5F9",borderRadius:4,overflow:"hidden"}}>
    <div style={{width:`${max>0?(value/max)*100:0}%`,height:"100%",background:color,borderRadius:4,transition:"width .6s"}}/>
  </div>
);

const FunnelBar = ({label,count,total,color})=>{
  const pct=total>0?Math.round((count/total)*100):0;
  return(
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
      <div style={{width:130,fontSize:12,color:"#64748B",flexShrink:0}}>{label}</div>
      <div style={{flex:1,height:26,background:"#F1F5F9",borderRadius:6,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:color+"33",borderLeft:`3px solid ${color}`,display:"flex",alignItems:"center",paddingLeft:10,transition:"width .7s"}}>
          <span style={{fontSize:11,fontWeight:700,color,fontFamily:"'DM Mono',monospace"}}>{count}</span>
        </div>
      </div>
      <div style={{width:36,fontSize:11,color:"#94A3B8",fontFamily:"'DM Mono',monospace",textAlign:"right",flexShrink:0}}>{pct}%</div>
    </div>
  );
};

export default function RealtorDashboard({leads,onSelectLead,onGoToCRM}){
  const total       = leads.length;
  const hot         = leads.filter(l=>l.hot);
  const closed      = leads.filter(l=>l.stage==="closed");
  const contract    = leads.filter(l=>l.stage==="contract");
  const pipelineGCI = leads.filter(l=>l.listPrice).reduce((s,l)=>s+commissionCalc(l.listPrice),0);
  const closedGCI   = closed.filter(l=>l.listPrice).reduce((s,l)=>s+commissionCalc(l.listPrice),0);
  const buyers      = leads.filter(l=>l.leadType==="Buyer").length;
  const sellers     = leads.filter(l=>l.leadType==="Seller").length;
  const preApproved = leads.filter(l=>l.preApproved).length;

  const card={background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,padding:"16px 18px"};

  return(
    <div style={{flex:1,overflowY:"auto",padding:24,background:"#F8FAFC",fontFamily:"Inter,sans-serif"}}>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <div style={{fontSize:11,letterSpacing:3,color:"#94A3B8",fontFamily:"'DM Mono',monospace",marginBottom:4}}>REALTORIQ</div>
          <div style={{fontSize:28,fontWeight:800,color:"#0F172A",letterSpacing:-0.5}}>Dashboard</div>
        </div>
        <button onClick={onGoToCRM} style={{background:"#6366F1",border:"none",borderRadius:8,color:"#fff",padding:"9px 18px",cursor:"pointer",fontSize:12,fontWeight:700}}>Pipeline →</button>
      </div>

      {/* Hot lead alert */}
      {hot.filter(l=>!l.lastContact).length>0&&(
        <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:10,padding:"12px 16px",marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:18,flexShrink:0}}>⚡</span>
          <div style={{fontSize:13,color:"#C2410C",flex:1}}>
            <strong>{hot.filter(l=>!l.lastContact).length} hot client{hot.filter(l=>!l.lastContact).length>1?"s":""}</strong> with no contact yet — {hot.filter(l=>!l.lastContact).map(l=>l.name).join(", ")}
          </div>
          <button onClick={onGoToCRM} style={{background:"none",border:"1px solid #FED7AA",borderRadius:6,color:"#C2410C",padding:"5px 12px",cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:700,flexShrink:0}}>VIEW →</button>
        </div>
      )}

      {/* Stat cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"PIPELINE GCI",  value:fmt$(pipelineGCI), color:"#059669"},
          {label:"CLOSED GCI",    value:fmt$(closedGCI),   color:"#6366F1"},
          {label:"🔥 HOT CLIENTS",value:hot.length,         color:"#D97706"},
          {label:"UNDER CONTRACT",value:contract.length,    color:"#3B82F6"},
          {label:"PRE-APPROVED",  value:preApproved,        color:"#10B981"},
        ].map((s,i)=>(
          <div key={i} style={{...card}}>
            <div style={{fontSize:9,letterSpacing:2,color:"#94A3B8",fontFamily:"'DM Mono',monospace",marginBottom:8}}>{s.label}</div>
            <div style={{fontSize:22,fontWeight:800,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:16,marginBottom:16}}>

        {/* Stage breakdown */}
        <div style={card}>
          <div style={{fontSize:10,letterSpacing:2,color:"#94A3B8",fontFamily:"'DM Mono',monospace",marginBottom:16}}>PIPELINE BY STAGE</div>
          {STAGES.map(s=>{
            const count=leads.filter(l=>l.stage===s.id).length;
            const stageGCI=leads.filter(l=>l.stage===s.id&&l.listPrice).reduce((sum,l)=>sum+commissionCalc(l.listPrice),0);
            return(
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                <div style={{fontSize:12,color:"#64748B",width:130,flexShrink:0}}>{s.label}</div>
                <Bar value={count} max={total} color={s.color}/>
                <div style={{fontSize:12,fontWeight:700,color:s.color,fontFamily:"'DM Mono',monospace",width:20,textAlign:"right",flexShrink:0}}>{count}</div>
                {stageGCI>0&&<div style={{fontSize:10,color:"#94A3B8",width:64,textAlign:"right",flexShrink:0,fontFamily:"'DM Mono',monospace"}}>{fmt$(stageGCI)}</div>}
              </div>
            );
          })}
          <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #F1F5F9",display:"flex",gap:16}}>
            <div><div style={{fontSize:9,color:"#94A3B8",fontFamily:"'DM Mono',monospace"}}>BUYERS</div><div style={{fontSize:16,fontWeight:800,color:"#6366F1",fontFamily:"'DM Mono',monospace"}}>{buyers}</div></div>
            <div><div style={{fontSize:9,color:"#94A3B8",fontFamily:"'DM Mono',monospace"}}>SELLERS</div><div style={{fontSize:16,fontWeight:800,color:"#059669",fontFamily:"'DM Mono',monospace"}}>{sellers}</div></div>
            <div><div style={{fontSize:9,color:"#94A3B8",fontFamily:"'DM Mono',monospace"}}>BOTH</div><div style={{fontSize:16,fontWeight:800,color:"#94A3B8",fontFamily:"'DM Mono',monospace"}}>{leads.filter(l=>l.leadType==="Both").length}</div></div>
          </div>
        </div>

        {/* Hot clients */}
        <div style={card}>
          <div style={{fontSize:10,letterSpacing:2,color:"#94A3B8",fontFamily:"'DM Mono',monospace",marginBottom:12}}>🔥 HOT CLIENTS</div>
          {hot.length===0&&<div style={{fontSize:12,color:"#CBD5E1",padding:"20px 0",textAlign:"center"}}>No hot clients yet</div>}
          {hot.sort((a,b)=>b.score-a.score).slice(0,5).map((l,i)=>(
            <div key={l.id} onClick={()=>onSelectLead(l)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #F1F5F9",cursor:"pointer"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"#FEF3C7",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:12,fontWeight:700,color:"#D97706"}}>{l.name.charAt(0)}</span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:"#0F172A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.name}</div>
                <div style={{fontSize:10,color:"#94A3B8"}}>{l.leadType||"Buyer"} · {l.timeline||"unknown"}</div>
              </div>
              <div style={{fontSize:14,fontWeight:800,color:"#6366F1",fontFamily:"'DM Mono',monospace",flexShrink:0}}>{l.score}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>

        {/* Conversion funnel */}
        <div style={card}>
          <div style={{fontSize:10,letterSpacing:2,color:"#94A3B8",fontFamily:"'DM Mono',monospace",marginBottom:16}}>CONVERSION FUNNEL</div>
          <FunnelBar label="Total clients"    count={total}                                                           total={total} color="#6366F1"/>
          <FunnelBar label="Contacted"        count={leads.filter(l=>l.smsHistory?.length>0).length}                 total={total} color="#3B82F6"/>
          <FunnelBar label="Showing/Active"   count={leads.filter(l=>["showing","offer","contract","closed"].includes(l.stage)).length} total={total} color="#8B5CF6"/>
          <FunnelBar label="Under Contract"   count={leads.filter(l=>["contract","closed"].includes(l.stage)).length} total={total} color="#10B981"/>
          <FunnelBar label="Closed"           count={closed.length}                                                   total={total} color="#059669"/>
          <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid #F1F5F9",display:"flex",gap:20}}>
            <div><div style={{fontSize:9,color:"#94A3B8",fontFamily:"'DM Mono',monospace"}}>CLOSE RATE</div><div style={{fontSize:16,fontWeight:800,color:"#059669",fontFamily:"'DM Mono',monospace"}}>{total?Math.round((closed.length/total)*100):0}%</div></div>
            <div><div style={{fontSize:9,color:"#94A3B8",fontFamily:"'DM Mono',monospace"}}>AVG SCORE</div><div style={{fontSize:16,fontWeight:800,color:"#6366F1",fontFamily:"'DM Mono',monospace"}}>{total?Math.round(leads.reduce((s,l)=>s+(l.score||0),0)/total):0}</div></div>
            <div><div style={{fontSize:9,color:"#94A3B8",fontFamily:"'DM Mono',monospace"}}>PRE-APPROVED</div><div style={{fontSize:16,fontWeight:800,color:"#10B981",fontFamily:"'DM Mono',monospace"}}>{total?Math.round((preApproved/total)*100):0}%</div></div>
          </div>
        </div>

        {/* GCI tracker */}
        <div style={card}>
          <div style={{fontSize:10,letterSpacing:2,color:"#94A3B8",fontFamily:"'DM Mono',monospace",marginBottom:16}}>GCI TRACKER</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            {[
              {label:"Year Goal",  value:"$120,000", color:"#94A3B8"},
              {label:"Closed YTD", value:fmt$(closedGCI), color:"#059669"},
              {label:"Pipeline",   value:fmt$(pipelineGCI-closedGCI), color:"#6366F1"},
              {label:"To Goal",    value:fmt$(Math.max(0,120000-closedGCI)), color:"#F59E0B"},
            ].map((s,i)=>(
              <div key={i} style={{background:"#F8FAFC",borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontSize:9,color:"#94A3B8",fontFamily:"'DM Mono',monospace",marginBottom:4}}>{s.label}</div>
                <div style={{fontSize:16,fontWeight:800,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <div style={{fontSize:12,color:"#64748B"}}>Annual progress</div>
              <div style={{fontSize:12,fontWeight:700,color:"#059669",fontFamily:"'DM Mono',monospace"}}>{Math.min(100,Math.round((closedGCI/120000)*100))}%</div>
            </div>
            <div style={{height:10,background:"#F1F5F9",borderRadius:5,overflow:"hidden"}}>
              <div style={{width:`${Math.min(100,Math.round((closedGCI/120000)*100))}%`,height:"100%",background:"linear-gradient(90deg,#10B981,#059669)",borderRadius:5,transition:"width .8s"}}/>
            </div>
          </div>
          <div style={{fontSize:11,color:"#94A3B8"}}>Based on 3% average commission · Goal: $120,000/yr</div>
        </div>
      </div>
    </div>
  );
}
