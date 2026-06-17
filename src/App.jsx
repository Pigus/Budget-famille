import { useState, useEffect } from "react";

const SUPABASE_URL = "https://ejhbjfzvajevmmwsxlgy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqaGJqZnp2YWpldm1td3N4bGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTUyNDIsImV4cCI6MjA5NzI5MTI0Mn0.BKoTh93OJgzIpU8V5iQk6Inh1MGYC9-N-DrPvXAbt8Q";

const CATS = [
  { id:"courses",    label:"Courses",    icon:"🛒", color:"#2D6A4F" },
  { id:"restaurant", label:"Restaurant", icon:"🍽️", color:"#E76F51" },
  { id:"enfants",    label:"Enfants",    icon:"🧒", color:"#9B5DE5" },
  { id:"maison",     label:"Maison",     icon:"🏠", color:"#457B9D" },
  { id:"epargne",    label:"Épargne",    icon:"🐷", color:"#E9C46A" },
];

const DEFAULT_BUDGETS = { courses:50, restaurant:50, enfants:50, maison:50, epargne:50 };

function fmt(v) { return v.toLocaleString("fr-FR",{style:"currency",currency:"EUR"}); }
function monthKey(d) { return new Date(d).toISOString().slice(0,7); }
function weekKey(d) {
  const dt=new Date(d); const day=dt.getDay()===0?6:dt.getDay()-1;
  dt.setDate(dt.getDate()-day); return dt.toISOString().slice(0,10);
}
function periodLabel(key, mode) {
  if(mode==="semaine"){
    const s=new Date(key); const e=new Date(key); e.setDate(e.getDate()+6);
    return `Sem. ${s.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} – ${e.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}`;
  }
  const [y,m]=key.split("-"); return new Date(y,m-1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
}

async function apiFetch(path, opts={}) {
  const r = await fetch(SUPABASE_URL+"/rest/v1/"+path, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer "+SUPABASE_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...opts.headers
    },
    ...opts
  });
  if(!r.ok) throw new Error(await r.text());
  const text = await r.text();
  return text ? JSON.parse(text) : [];
}

function Toast({ msg, visible }) {
  if(!visible) return null;
  return (
    <div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",
      background: msg.startsWith("⚠")?"#c0392b":"#2D6A4F",
      color:"white",padding:"10px 20px",borderRadius:10,fontSize:14,fontWeight:600,zIndex:100,whiteSpace:"nowrap"}}>
      {msg}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("accueil");
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState(DEFAULT_BUDGETS);
  const [histMode, setHistMode] = useState("mois");
  const [form, setForm] = useState({ montant:"", label:"", categorie:"courses", date:new Date().toISOString().slice(0,10) });
  const [editBudgets, setEditBudgets] = useState(false);
  const [tempBudgets, setTempBudgets] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [toast, setToast] = useState({ msg:"", visible:false });

  function showToast(msg) {
    setToast({ msg, visible:true });
    setTimeout(() => setToast(t => ({...t, visible:false})), 2500);
  }

  async function fetchTransactions(silent=false) {
    try {
      const rows = await apiFetch("transactions?order=date.desc,id.desc");
      setTransactions(rows);
      setLastSync(new Date());
    } catch(e) {
      if(!silent) showToast("⚠ Erreur connexion : "+e.message);
    } finally {
      if(!silent) setLoading(false);
    }
  }

  useEffect(() => {
    fetchTransactions(false);
    const interval = setInterval(() => fetchTransactions(true), 30000);
    return () => clearInterval(interval);
  }, []);

  async function addTransaction() {
    const montant = parseFloat(form.montant.replace(",","."));
    if(!montant||montant<=0||!form.label.trim()) return;
    setSyncing(true);
    try {
      const rows = await apiFetch("transactions", {
        method:"POST",
        body: JSON.stringify({ montant, label:form.label.trim(), categorie:form.categorie, date:form.date })
      });
      setTransactions(txs => [rows[0], ...txs]);
      setForm(f => ({...f, montant:"", label:""}));
      showToast("✓ Dépense ajoutée !");
      setView("accueil");
    } catch(e) { showToast("⚠ Erreur : "+e.message); }
    setSyncing(false);
  }

  async function deleteTx(id) {
    try {
      await apiFetch("transactions?id=eq."+id, { method:"DELETE" });
      setTransactions(txs => txs.filter(t=>t.id!==id));
    } catch(e) { showToast("⚠ Erreur suppression"); }
  }

  function totalSpent(catId, txList) {
    return txList.filter(t=>t.categorie===catId).reduce((s,t)=>s+t.montant,0);
  }

  const curMonth = monthKey(new Date());
  const txMonth = transactions.filter(t=>monthKey(t.date)===curMonth);

  const cat = CATS.find(c=>c.id===form.categorie);

  const navItems = [
    { id:"accueil", icon:"📊", label:"Accueil" },
    { id:"ajouter", icon:"➕", label:"Ajouter" },
    { id:"historique", icon:"📋", label:"Historique" },
    { id:"budgets", icon:"✏️", label:"Enveloppes" },
  ];

  return (
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"#F7F8FA",minHeight:"100vh",maxWidth:480,margin:"0 auto",paddingBottom:80}}>
      <Toast msg={toast.msg} visible={toast.visible} />

      {/* Header */}
      <div style={{background:"#1B2B3A",padding:"20px 20px 14px",color:"white"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:11,letterSpacing:2,opacity:0.5,textTransform:"uppercase",marginBottom:3}}>Budget famille</div>
            <div style={{fontSize:24,fontWeight:700}}>
              {view==="accueil"&&"Tableau de bord"}
              {view==="ajouter"&&"Nouvelle dépense"}
              {view==="historique"&&"Historique"}
              {view==="budgets"&&"Mes enveloppes"}
            </div>
            <div style={{fontSize:12,opacity:0.45,marginTop:2}}>
              {lastSync ? `Sync ${lastSync.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}` : new Date().toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}
            </div>
          </div>
          <button onClick={()=>fetchTransactions(false)}
            style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:10,padding:"8px 12px",
              color:"white",cursor:"pointer",fontSize:18,marginTop:4}}
            title="Rafraîchir">
            🔄
          </button>
        </div>
      </div>

      {/* ACCUEIL */}
      {view==="accueil" && (
        <div style={{padding:"14px 14px 0"}}>
          <div style={{fontSize:11,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Ce mois-ci</div>
          {loading ? <div style={{textAlign:"center",color:"#aaa",marginTop:40}}>Chargement…</div> :
          CATS.map(c => {
            const spent = totalSpent(c.id, txMonth);
            const budget = budgets[c.id]||0;
            const pct = budget>0?Math.min(spent/budget,1):0;
            const over = spent>budget;
            return (
              <div key={c.id} style={{background:"white",borderRadius:14,padding:"14px 16px",marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:20}}>{c.icon}</span>
                    <span style={{fontWeight:600,fontSize:15}}>{c.label}</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontWeight:700,color:over?"#E63946":c.color,fontSize:15}}>{fmt(spent)}</span>
                    <span style={{color:"#aaa",fontSize:12}}> / {fmt(budget)}</span>
                  </div>
                </div>
                <div style={{background:"#F0F0F0",borderRadius:99,height:6,overflow:"hidden"}}>
                  <div style={{background:over?"#E63946":c.color,width:`${Math.round(pct*100)}%`,height:"100%",borderRadius:99,transition:"width 0.4s"}} />
                </div>
                <div style={{fontSize:11,marginTop:4,color:over?"#E63946":"#aaa",fontWeight:over?600:400}}>
                  {over?`Dépassement de ${fmt(spent-budget)}`:(budget>0?`Reste ${fmt(budget-spent)}`:"")}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AJOUTER */}
      {view==="ajouter" && (
        <div style={{padding:16}}>
          <div style={{background:"white",borderRadius:16,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:1}}>Catégorie</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:8}}>
                {CATS.map(c=>(
                  <button key={c.id} onClick={()=>setForm(f=>({...f,categorie:c.id}))}
                    style={{padding:"7px 12px",borderRadius:99,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,
                      background:form.categorie===c.id?c.color:"#F0F0F0",
                      color:form.categorie===c.id?"white":"#555"}}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:1}}>Montant (€)</label>
              <input type="number" inputMode="decimal" placeholder="0,00" value={form.montant}
                onChange={e=>setForm(f=>({...f,montant:e.target.value}))}
                style={{display:"block",width:"100%",marginTop:6,padding:"12px 14px",borderRadius:10,
                  border:"1.5px solid #E0E0E0",fontSize:22,fontWeight:700,color:cat?.color||"#1B2B3A",outline:"none"}}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:1}}>Description</label>
              <input type="text" placeholder="ex: Lidl, plein d'essence…" value={form.label}
                onChange={e=>setForm(f=>({...f,label:e.target.value}))}
                style={{display:"block",width:"100%",marginTop:6,padding:"11px 14px",borderRadius:10,
                  border:"1.5px solid #E0E0E0",fontSize:15,outline:"none"}}/>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{fontSize:12,fontWeight:600,color:"#888",textTransform:"uppercase",letterSpacing:1}}>Date</label>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}
                style={{display:"block",width:"100%",marginTop:6,padding:"11px 14px",borderRadius:10,
                  border:"1.5px solid #E0E0E0",fontSize:15,outline:"none"}}/>
            </div>
            <button onClick={addTransaction} disabled={syncing}
              style={{width:"100%",padding:14,borderRadius:12,border:"none",cursor:"pointer",
                background:cat?.color||"#1B2B3A",color:"white",fontWeight:700,fontSize:16,opacity:syncing?0.5:1}}>
              {syncing?"Envoi en cours…":"Ajouter la dépense"}
            </button>
          </div>
        </div>
      )}

      {/* HISTORIQUE */}
      {view==="historique" && (
        <div style={{padding:16}}>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {["semaine","mois"].map(m=>(
              <button key={m} onClick={()=>setHistMode(m)}
                style={{flex:1,padding:9,borderRadius:10,border:"none",cursor:"pointer",fontWeight:600,fontSize:14,
                  background:histMode===m?"#1B2B3A":"#E8E8E8",color:histMode===m?"white":"#555"}}>
                Par {m}
              </button>
            ))}
          </div>
          {loading ? <div style={{textAlign:"center",color:"#aaa",marginTop:40}}>Chargement…</div> : (() => {
            const groups={};
            transactions.forEach(tx=>{
              const key=histMode==="semaine"?weekKey(tx.date):monthKey(tx.date);
              if(!groups[key]) groups[key]=[];
              groups[key].push(tx);
            });
            const keys=Object.keys(groups).sort((a,b)=>b.localeCompare(a));
            if(!keys.length) return <div style={{textAlign:"center",color:"#aaa",marginTop:40}}>Aucune dépense enregistrée.</div>;
            return keys.map(key=>{
              const txs=groups[key];
              const total=txs.reduce((s,t)=>s+t.montant,0);
              return (
                <div key={key} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <span style={{fontWeight:700,fontSize:14}}>{periodLabel(key,histMode)}</span>
                    <span style={{fontWeight:700,fontSize:14,color:"#E76F51"}}>{fmt(total)}</span>
                  </div>
                  <div style={{background:"white",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                    {txs.map((tx,i)=>{
                      const c=CATS.find(c=>c.id===tx.categorie)||CATS[5];
                      return (
                        <div key={tx.id} style={{display:"flex",alignItems:"center",padding:"12px 16px",
                          borderBottom:i<txs.length-1?"1px solid #F0F0F0":"none"}}>
                          <span style={{fontSize:20,marginRight:12}}>{c.icon}</span>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:600,fontSize:14}}>{tx.label}</div>
                            <div style={{fontSize:11,color:"#aaa"}}>{new Date(tx.date).toLocaleDateString("fr-FR")} · {c.label}</div>
                          </div>
                          <span style={{fontWeight:700,fontSize:15,marginRight:12}}>{fmt(tx.montant)}</span>
                          <button onClick={()=>deleteTx(tx.id)}
                            style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#ddd",padding:0}}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* BUDGETS */}
      {view==="budgets" && (
        <div style={{padding:16}}>
          <div style={{background:"white",borderRadius:16,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <p style={{fontSize:13,color:"#888",marginBottom:16}}>Définissez vos enveloppes mensuelles par catégorie.</p>
            {CATS.map(c=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <span style={{fontSize:22,width:28}}>{c.icon}</span>
                <label style={{flex:1,fontWeight:600,fontSize:14}}>{c.label}</label>
                <div style={{position:"relative"}}>
                  <input type="number" disabled={!editBudgets}
                    value={editBudgets?(tempBudgets[c.id]??budgets[c.id]):budgets[c.id]}
                    onChange={e=>setTempBudgets(tb=>({...tb,[c.id]:parseFloat(e.target.value)||0}))}
                    style={{width:90,padding:"8px 24px 8px 10px",borderRadius:8,border:"1.5px solid #E0E0E0",
                      fontSize:15,fontWeight:700,color:c.color,outline:"none",
                      background:editBudgets?"white":"#F7F8FA"}}/>
                  <span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",color:"#aaa",fontSize:13}}>€</span>
                </div>
              </div>
            ))}
            {!editBudgets
              ? <button onClick={()=>{setEditBudgets(true);setTempBudgets({});}}
                  style={{width:"100%",padding:13,marginTop:6,borderRadius:12,border:"none",cursor:"pointer",
                    background:"#1B2B3A",color:"white",fontWeight:700,fontSize:15}}>
                  Modifier les enveloppes
                </button>
              : <div style={{display:"flex",gap:10,marginTop:6}}>
                  <button onClick={()=>setEditBudgets(false)}
                    style={{flex:1,padding:13,borderRadius:12,border:"1.5px solid #E0E0E0",cursor:"pointer",
                      background:"white",color:"#555",fontWeight:600,fontSize:15}}>Annuler</button>
                  <button onClick={()=>{setBudgets(b=>({...b,...tempBudgets}));setEditBudgets(false);showToast("✓ Enveloppes enregistrées !");}}
                    style={{flex:2,padding:13,borderRadius:12,border:"none",cursor:"pointer",
                      background:"#2D6A4F",color:"white",fontWeight:700,fontSize:15}}>Enregistrer</button>
                </div>
            }
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,
        background:"white",borderTop:"1px solid #EEE",display:"flex",zIndex:10}}>
        {navItems.map(tab=>(
          <button key={tab.id} onClick={()=>setView(tab.id)}
            style={{flex:1,padding:"10px 0 8px",border:"none",cursor:"pointer",background:"none",
              display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:20}}>{tab.icon}</span>
            <span style={{fontSize:11,fontWeight:600,color:view===tab.id?"#1B2B3A":"#aaa"}}>{tab.label}</span>
            {view===tab.id&&<div style={{width:20,height:3,background:"#1B2B3A",borderRadius:99}}/>}
          </button>
        ))}
      </div>
    </div>
  );
}
