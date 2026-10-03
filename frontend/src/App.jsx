import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { api } from './services/api'

const packages = [
  { name:'Aarambh', sub:'Digital Foundation', price:499, tone:'orange', icon:'↗', items:['Basics of Digital Skills','Beginner Friendly Courses','Certificate Included'] },
  { name:'Udaan', sub:'Creative + Content Skills', price:999, tone:'blue', icon:'▥', items:['Content Creation Courses','Design & Creative Tools','Live Projects & Assignments'] },
  { name:'Pragati', sub:'Marketing + Client Skills', price:1999, tone:'green', icon:'◎', items:['Marketing & Client Handling','Freelancing Guidance','Masterclasses Included'] },
  { name:'Brahmastra', sub:'Advanced Digital Skills', price:3999, tone:'purple', icon:'♛', items:['Advanced Tools & Strategies','Live Workshops','Real World Case Studies'] },
  { name:'Shikhar', sub:'Leadership + Business', price:6999, tone:'pink', icon:'★', items:['Leadership & Business Skills','Personal Mentorship','Business Growth Masterclasses'] }
]

const courseNames = ['Digital Marketing Foundations','Modern Web Development','Content Creation Mastery','AI Productivity','Graphic Design Essentials','Freelancing Fundamentals']
const categories = ['Digital Marketing','Web Development','Graphic Design','Content Creation','Business & Finance','AI & Tech','Communication','Personal Growth']

function Header({session}) {
  const [open,setOpen] = useState(false)
  const navigate = useNavigate()
  async function logout(){ if(supabase) await supabase.auth.signOut(); setOpen(false); navigate('/login') }
  const links = [['Home','/'],['Courses','/courses'],['Packages','/packages'],['Masterclasses','/masterclasses'],['Workshops','/workshops'],['About','/about']]
  return <header className="header">
    <Link className="logo" to="/" onClick={()=>setOpen(false)}><b>✦</b>Skill<span>Link</span></Link>
    <div className="search"><span>⌕</span><input aria-label="Search" placeholder="Search for courses, packages, masterclasses..."/></div>
    <button className="menu-btn" onClick={()=>setOpen(!open)} aria-label="Open navigation">{open?'×':'☰'}</button>
    <nav className={`nav ${open?'open':''}`}>
      {links.map(([name,path])=><NavLink key={path} to={path} end={path==='/'}
        onClick={()=>setOpen(false)}>{name}</NavLink>)}
      <span className="divider"/>
      {session ? <><Link to="/referrals" onClick={()=>setOpen(false)}>Referrals</Link><button className="nav-btn" onClick={logout}>Logout</button></> :
        <><Link className="nav-login" to="/login" onClick={()=>setOpen(false)}>Login</Link>
        <Link className="nav-signup" to="/signup" onClick={()=>setOpen(false)}>Sign Up</Link></>}
    </nav>
  </header>
}

function Home(){
  return <>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">DIGITAL SKILLS • PRACTICAL LEARNING</div>
        <h1>Learn Skills.<br/>Build Your Future.<br/><span>Grow with SkillLink.</span></h1>
        <p>Join learners, instructors and partners to gain in-demand skills, create opportunities and build a better tomorrow.</p>
        <div className="hero-actions"><Link className="cta" to="/courses">Explore Courses →</Link><Link className="outline" to="/packages">View Packages</Link></div>
        <div className="learner-row"><div className="avatars"><i>AS</i><i>RK</i><i>NP</i><i>SK</i></div><div><strong>50,000+</strong><small>Learners already growing with us</small></div></div>
      </div>
      <div className="hero-art"><div className="art-glow"/><div className="person"><div className="hair"/><div className="head"/><div className="body">SL</div></div>
        {[
          ['f1','▰','Learn','In-Demand Skills'],['f2','↗','Earn','Through Referrals'],['f3','▣','Get Certified','Boost Your Career'],['f4','♧','Grow','Your Network']
        ].map(x=><div className={`float ${x[0]}`} key={x[0]}><b>{x[1]}</b><strong>{x[2]}</strong><small>{x[3]}</small></div>)}
      </div>
    </section>

    <section className="stats">
      {[['♧','50,000+','Active Learners'],['▤','500+','Courses & Workshops'],['♧','1,000+','Expert Instructors'],['◎','95%','Student Satisfaction']].map(x=><div key={x[1]}><b>{x[0]}</b><strong>{x[1]}</strong><span>{x[2]}</span></div>)}
    </section>

    <section className="section">
      <SectionTitle title="Popular Categories" sub="Explore top skill categories and start learning today." link="/courses" label="View All Categories →"/>
      <div className="cat-grid">{categories.map((x,i)=><Link className="cat" to="/courses" key={x}><b>{['✦','</>','◉','▣','▥','◈','●','◎'][i]}</b><span>{x}</span></Link>)}</div>
    </section>

    <section className="package-section">
      <SectionTitle title="Our Learning Packages" sub="Choose the right package and get complete access to curated courses, masterclasses and workshops." link="/packages" label="Compare Packages →"/>
      <PackageGrid/>
    </section>

    <section className="section">
      <SectionTitle title="Upcoming Masterclasses" sub="Join live masterclasses from industry experts and learn directly from the best." link="/masterclasses" label="View All Masterclasses →"/>
      <MasterGrid/>
    </section>
  </>
}

function SectionTitle({title,sub,link,label}) {
  return <div className="section-title"><div><h2>{title}</h2><p>{sub}</p></div><Link to={link}>{label}</Link></div>
}

function PackageGrid(){
  return <div className="package-grid">{packages.map(p=><article className={`package ${p.tone}`} key={p.name}>
    <div className="package-icon">{p.icon}</div><h3>{p.name}</h3><p>{p.sub}</p><strong>₹{p.price.toLocaleString('en-IN')}</strong>
    <ul>{p.items.map(x=><li key={x}>✓ {x}</li>)}</ul><Link className="package-btn" to="/login">Get Started</Link>
  </article>)}</div>
}

function MasterGrid(){
  const names=['Instagram Growth Strategies 2025','Full Stack Web Development Roadmap','Practical AI Tools for Creators','Freelancing to Full-Time Business']
  return <div className="master-grid">{names.map((name,i)=><article className={`master m${i}`} key={name}><span className="live">+ Live</span><small>{categories[i===0?0:i===1?1:i===2?5:4]}</small><h3>{name}</h3><p>▣ {25+i*3} Oct 2026 &nbsp; ◷ {i%2?'6:00 PM':'7:00 PM'}</p><footer><b>{i%2?'₹199':'₹99'}</b><Link to="/login">Join Now</Link></footer></article>)}</div>
}

function Courses(){
  const [courses,setCourses]=useState([])
  const [error,setError]=useState('')
  useEffect(()=>{api('/courses').then(x=>setCourses(x.courses||[])).catch(e=>setError(e.message))},[])
  const list=courses.length?courses.map(c=>({title:c.title,desc:c.description,status:c.status})):courseNames.map(title=>({title,desc:'Practical, structured learning experience. Sign in to access enrollment and course details.',status:'Coming soon'}))
  return <Page title="Explore Courses" eyebrow="LEARNING MARKETPLACE" sub="Build practical skills through structured courses, projects and assessments.">
    {error && <div className="notice">{error}</div>}
    <div className="filterbar"><input placeholder="Search courses..."/><button>All Categories ▾</button><button>Sort ▾</button></div>
    <div className="listing-grid">{list.map((c,i)=><article className="list-card" key={c.title}><div className={`thumb thumb${i%4}`}>{['MARKETING','DEVELOPMENT','CREATIVE','AI'][i%4]}</div><div><span className="tag">{c.status}</span><h3>{c.title}</h3><p>{c.desc}</p><Link to="/login">View details →</Link></div></article>)}</div>
  </Page>
}

function PackagesPage(){return <Page title="Learning Packages" eyebrow="CURATED PATHS" sub="Choose a complete learning path with access to relevant courses, skills and eligible live experiences."><PackageGrid/></Page>}
function Masterclasses(){return <Page title="Masterclasses" eyebrow="LIVE LEARNING" sub="Learn directly through scheduled live and recorded masterclasses."><MasterGrid/></Page>}
function Workshops(){return <Page title="Workshops" eyebrow="PRACTICAL EXPERIENCES" sub="Hands-on workshops with schedules, registration, attendance, resources and eligible certificates."><div className="listing-grid">{['Build Your First Digital Portfolio','Client Acquisition Workshop','AI Tools for Creators','Freelancing Launch Workshop','Content Strategy Lab','Business Growth Workshop'].map((x,i)=><article className="list-card" key={x}><div className={`thumb thumb${i%4}`}>WORKSHOP</div><div><span className="tag">Upcoming</span><h3>{x}</h3><p>Schedule, seats, registration and resources are managed through the platform.</p><Link to="/login">View details →</Link></div></article>)}</div></Page>}
function About(){return <Page title="Skills that move you forward." eyebrow="ABOUT SKILLLINK" sub="SkillLink brings practical learning, projects and opportunity-oriented experiences together in one platform."><div className="about-grid">{[['01','Learn','Structured courses and live learning experiences.'],['02','Build','Projects, assessments and practical progress.'],['03','Grow','Referrals, achievements, certificates and opportunities.']].map(x=><article key={x[0]}><b>{x[0]}</b><h2>{x[1]}</h2><p>{x[2]}</p></article>)}</div></Page>}

function Page({title,eyebrow,sub,children}){return <section className="page-content"><div className="page-head"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{sub}</p></div>{children}</section>}

function Auth({mode}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[referral,setReferral]=useState(()=>new URLSearchParams(window.location.search).get('ref')||''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('')
  const navigate=useNavigate()
  async function submit(e){
    e.preventDefault();setBusy(true);setMsg('')
    try{
      if(!supabase) throw Error('Supabase frontend configuration is missing. Add Vercel VITE environment variables and redeploy.')
      if(mode==='signup'){
        const {error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name,referral_code:referral.trim().toUpperCase()||null}}})
        if(error) throw error
        setMsg('Account created successfully. Check your email if confirmation is enabled.')
      }else{
        const {error}=await supabase.auth.signInWithPassword({email,password})
        if(error) throw error
        navigate('/dashboard')
      }
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  return <section className="auth-page"><div className="auth-visual"><div className="eyebrow">SKILLLINK</div><h1>{mode==='signup'?'Start your learning journey.':'Welcome back.'}</h1><p>Learn practical skills, build projects and grow through structured experiences.</p><div className="auth-badges"><span>✦ Secure access</span><span>▤ Practical learning</span><span>◎ Track progress</span></div></div>
    <form className="auth-card" onSubmit={submit}><div className="eyebrow">{mode==='signup'?'GET STARTED':'WELCOME BACK'}</div><h2>{mode==='signup'?'Create your account':'Login to SkillLink'}</h2>
      {mode==='signup'&&<input required placeholder="Full name" value={name} onChange={e=>setName(e.target.value)}/>}{mode==='signup'&&<><input placeholder="Referral ID / Code (optional)" value={referral} onChange={e=>setReferral(e.target.value.toUpperCase())}/><small className="field-help">If someone referred you, enter their referral code.</small></>}
      <input required type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)}/>
      <input required minLength="8" type="password" placeholder="Password (minimum 8 characters)" value={password} onChange={e=>setPassword(e.target.value)}/>
      {msg&&<div className="notice">{msg}</div>}
      <button className="cta full" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Create Account':'Login'}</button>
      <p>{mode==='signup'?<>Already registered? <Link to="/login">Sign in</Link></>:<>Don't have an account? <Link to="/signup">Sign Up</Link></>}</p>
    </form>
  </section>
}

function Referrals({session}){
  const [data,setData]=useState(null),[error,setError]=useState(''),[copied,setCopied]=useState(false)
  useEffect(()=>{if(session)api('/referrals/me').then(setData).catch(e=>setError(e.message))},[session])
  if(!session)return <Navigate to="/login" replace/>
  async function copy(){if(!data?.referralLink)return;navigator.clipboard?.writeText(data.referralLink);setCopied(true);setTimeout(()=>setCopied(false),1500)}
  return <Page title="Referral Center" eyebrow="GROW WITH SKILLLINK" sub="Share your referral link. Registration attribution is recorded by the backend; commissions are created only for verified eligible purchases.">
    {error&&<div className="notice">{error}</div>}
    <div className="referral-hero"><div><span className="tag">YOUR REFERRAL ID</span><h2>{data?.referralCode||'Loading…'}</h2><p>{data?.isPartner?'Partner referral tracking is active for your account.':'Your account can be attributed to a partner referral when you sign up through a valid referral link.'}</p></div><div className="referral-actions"><input readOnly value={data?.referralLink||''}/><button onClick={copy}>{copied?'Copied':'Copy link'}</button></div></div>
    <div className="referral-stats"><article><small>REFERRALS</small><strong>{data?.referralCount??0}</strong><span>Attributed registrations</span></article><article><small>VERIFIED SALES</small><strong>{data?.successfulPurchases??0}</strong><span>Paid orders</span></article><article><small>COMMISSION</small><strong>₹{Number(data?.commissionTotal||0).toLocaleString('en-IN')}</strong><span>Recorded earnings</span></article></div>
  </Page>
}

function CEOControlCenter({session}){
  const [tab,setTab]=useState('overview'),[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const [saving,setSaving]=useState('')
  const tabs=[['overview','Overview'],['users','Users'],['packages','Packages'],['courses','Courses'],['events','Masterclasses & Workshops'],['commerce','Orders & Payments'],['partners','Referrals & Commissions'],['withdrawals','Withdrawals'],['levels','Levels'],['reviews','Reviews'],['rewards','Rewards'],['permissions','Admin Permissions'],['settings','Platform Settings'],['coupons','Coupons'],['audit','Audit Logs']]
  async function load(t=tab){setLoading(true);setError('');try{const paths={overview:'/ceo/overview',users:'/ceo/users',packages:'/ceo/packages',courses:'/ceo/courses',events:'/ceo/masterclasses',commerce:'/ceo/orders',partners:'/ceo/referrals',withdrawals:'/ceo/withdrawals',levels:'/ceo/levels',reviews:'/ceo/reviews',rewards:'/ceo/rewards',permissions:'/ceo/admin-permissions',settings:'/ceo/settings',coupons:'/ceo/coupons',audit:'/ceo/audit-logs'};const r=await api(paths[t]);setData(r);if(t==='events'){const w=await api('/ceo/workshops');setData({...r,workshops:w.workshops||[]})}if(t==='commerce'){const pay=await api('/ceo/payments');setData({...r,payments:pay.payments||[]})}if(t==='partners'){const c=await api('/ceo/commissions');const l=await api('/ceo/ledger');setData({...r,commissions:c.commissions||[],ledger:l.ledger||[]})}}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{if(session)load(tab)},[session,tab])
  if(!session)return <Navigate to="/login" replace/>
  async function updatePackage(id,price){setSaving(id);try{await api(`/ceo/packages/${id}`,{method:'PATCH',body:JSON.stringify({base_price:Number(price)})});await load()}catch(e){setError(e.message)}finally{setSaving('')}}
  async function reviewWithdrawal(id,status){setSaving(id);try{await api(`/ceo/withdrawals/${id}`,{method:'PATCH',body:JSON.stringify({status})});await load()}catch(e){setError(e.message)}finally{setSaving('')}}
  async function updateUser(id,field,value){setSaving(id);try{await api(`/ceo/users/${id}`,{method:'PATCH',body:JSON.stringify({[field]:value})});await load()}catch(e){setError(e.message)}finally{setSaving('')}}
  async function updateCourse(id,field,value){setSaving(id);try{await api(`/ceo/courses/${id}`,{method:'PATCH',body:JSON.stringify({[field]:field==='price'?Number(value):value})});await load()}catch(e){setError(e.message)}finally{setSaving('')}}
  async function updateLevel(level,field,value){setSaving(String(level));try{const row=(data.levels||[]).find(x=>x.level===level);await api(`/ceo/levels/${level}`,{method:'PATCH',body:JSON.stringify({...row,[field]:field==='skill_mastery_required'?Boolean(value):Number(value)})});await load()}catch(e){setError(e.message)}finally{setSaving('')}}
  const c=data?.counts||{}
  return <section className="ceo-shell"><aside className="ceo-side"><div className="ceo-brand">✦ <span>CEO Control</span></div><div className="ceo-nav">{tabs.map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</div><Link to="/dashboard" className="ceo-back">← Member Dashboard</Link></aside><main className="ceo-main"><div className="ceo-top"><div><div className="eyebrow">SKILLLINK ADMINISTRATION</div><h1>{tabs.find(x=>x[0]===tab)?.[1]}</h1><p>CEO-authorized management. Changes are written through the protected API and audited.</p></div><button className="refresh" onClick={()=>load()}>↻ Refresh</button></div>{error&&<div className="notice">{error}</div>}{loading?<div className="ceo-loading">Loading live control data…</div>:<>
    {tab==='overview'&&<div className="ceo-content"><div className="ceo-metrics">{[['Users',c.profiles],['Courses',c.courses],['Packages',c.packages],['Orders',c.orders],['Withdrawals',c.withdrawals],['Revenue',`₹${Number(data.revenue||0).toLocaleString('en-IN')}`],['Reviews',c.reviews],['Tickets',c.support_tickets]].map(x=><article key={x[0]}><small>{x[0]}</small><strong>{x[1]??0}</strong></article>)}</div><div className="ceo-two"><article className="ceo-panel"><h2>Pending withdrawals</h2>{(data.pendingWithdrawals||[]).map(w=><div className="ceo-row" key={w.id}><div><b>₹{Number(w.amount).toLocaleString('en-IN')}</b><small>{w.partner_id}</small></div><span className="status pending">Pending</span></div>)}{!data.pendingWithdrawals?.length&&<Empty/>}</article><article className="ceo-panel"><h2>Recent audit activity</h2>{(data.recentAudit||[]).slice(0,8).map(x=><div className="audit-row" key={x.id}><b>{x.action}</b><small>{new Date(x.created_at).toLocaleString()}</small></div>)}{!data.recentAudit?.length&&<Empty/>}</article></div></div>}
    {tab==='users'&&<Table title="Users" columns={['Name','Role','Status','Referral','Created']} rows={(data.users||[]).map(u=><tr key={u.id}><td>{u.full_name||'—'}<small>{u.id}</small></td><td><select value={u.role} disabled={saving===u.id} onChange={e=>updateUser(u.id,'role',e.target.value)}><option>student</option><option>partner</option><option>instructor</option><option>admin</option><option>ceo</option></select></td><td><select value={u.status} disabled={saving===u.id} onChange={e=>updateUser(u.id,'status',e.target.value)}><option>active</option><option>pending</option><option>suspended</option><option>disabled</option></select></td><td>{u.referral_code||'—'}</td><td>{new Date(u.created_at).toLocaleDateString()}</td></tr>)}/>} 
    {tab==='packages'&&<Table title="Package Management" columns={['Package','Subtitle','Base Price','Active','Featured']} rows={(data.packages||[]).map(p=><tr key={p.id}><td><b>{p.name}</b></td><td>{p.subtitle}</td><td><div className="inline-edit"><span>₹</span><input defaultValue={p.base_price} type="number" onBlur={e=>{if(Number(e.target.value)!==Number(p.base_price))updatePackage(p.id,e.target.value)}}/><span>{saving===p.id?'Saving…':''}</span></div></td><td>{p.is_active?'Yes':'No'}</td><td>{p.is_featured?'Yes':'No'}</td></tr>)}/>} 
    {tab==='courses'&&<Table title="Course Management" columns={['Course','Price','Status','Instructor','Created']} rows={(data.courses||[]).map(c=><tr key={c.id}><td><b>{c.title}</b><small>{c.id}</small></td><td><input className="tiny-input" type="number" defaultValue={c.price} onBlur={e=>updateCourse(c.id,'price',e.target.value)}/></td><td><select value={c.status} onChange={e=>updateCourse(c.id,'status',e.target.value)}><option>draft</option><option>pending_review</option><option>published</option><option>rejected</option><option>archived</option></select></td><td>{c.instructor_id||'—'}</td><td>{new Date(c.created_at).toLocaleDateString()}</td></tr>)}/>} 
    {tab==='events'&&<div className="ceo-two"><EventPanel title="Masterclasses" rows={data.masterclasses||[]}/><EventPanel title="Workshops" rows={data.workshops||[]}/></div>}
    {tab==='commerce'&&<div className="ceo-two"><Table title="Orders" columns={['Order','Amount','Status','Buyer','Created']} rows={(data.orders||[]).map(o=><tr key={o.id}><td>{o.id}</td><td>₹{Number(o.amount).toLocaleString('en-IN')}</td><td><span className={`status ${o.status}`}>{o.status}</span></td><td>{o.buyer_id}</td><td>{new Date(o.created_at).toLocaleDateString()}</td></tr>)}/><Table title="Payments" columns={['Payment','Order','Amount','Status','Provider']} rows={(data.payments||[]).map(p=><tr key={p.id}><td>{p.id}</td><td>{p.order_id}</td><td>₹{Number(p.amount).toLocaleString('en-IN')}</td><td>{p.status}</td><td>{p.provider}</td></tr>)}/></div>}
    {tab==='partners'&&<div className="ceo-two"><Table title="Referrals" columns={['Partner','Code','User','Order','Status']} rows={(data.referrals||[]).map(r=><tr key={r.id}><td>{r.partner_id}</td><td>{r.referral_code}</td><td>{r.referred_user_id||'—'}</td><td>{r.order_id||'—'}</td><td>{r.attribution_status}</td></tr>)}/><Table title="Commissions" columns={['Partner','Order','Amount','Status']} rows={(data.commissions||[]).map(c=><tr key={c.id}><td>{c.partner_id}</td><td>{c.order_id}</td><td>₹{Number(c.amount).toLocaleString('en-IN')}</td><td>{c.status}</td></tr>)}/></div>}
    {tab==='withdrawals'&&<Table title="CEO Withdrawal Approval Queue" columns={['Partner','Amount','Status','Created','Action']} rows={(data.withdrawals||[]).map(w=><tr key={w.id}><td>{w.partner_id}</td><td>₹{Number(w.amount).toLocaleString('en-IN')}</td><td><span className={`status ${w.status}`}>{w.status}</span></td><td>{new Date(w.created_at).toLocaleDateString()}</td><td>{w.status==='pending'?<div className="actions"><button disabled={saving===w.id} onClick={()=>reviewWithdrawal(w.id,'approved')}>Approve</button><button disabled={saving===w.id} className="danger" onClick={()=>reviewWithdrawal(w.id,'rejected')}>Reject</button></div>:<span>Reviewed</span>}</td></tr>)}/>} 
    {tab==='levels'&&<Table title="Level Rules L1–L9" columns={['Level','Points','Referrals','Skill Mastery']} rows={(data.levels||[]).map(l=><tr key={l.level}><td><b>L{l.level}</b></td><td><input className="tiny-input" type="number" defaultValue={l.points_required} onBlur={e=>updateLevel(l.level,'points_required',e.target.value)}/></td><td><input className="tiny-input" type="number" defaultValue={l.referral_required} onBlur={e=>updateLevel(l.level,'referral_required',e.target.value)}/></td><td><input type="checkbox" defaultChecked={l.skill_mastery_required} onChange={e=>updateLevel(l.level,'skill_mastery_required',e.target.checked)}/></td></tr>)}/>} 
    {tab==='reviews'&&<Table title="Review Moderation" columns={['Student','Rating','Content','Status','Action']} rows={(data.reviews||[]).map(r=><tr key={r.id}><td>{r.student_id}</td><td>{r.rating}/5</td><td>{r.body}</td><td>{r.status}</td><td><select value={r.status} onChange={async e=>{setSaving(r.id);try{await api(`/ceo/reviews/${r.id}`,{method:'PATCH',body:JSON.stringify({status:e.target.value})});await load()}catch(x){setError(x.message)}finally{setSaving('')}}}><option>pending</option><option>approved</option><option>rejected</option></select></td></tr>)}/>} 
    {tab==='rewards'&&<Table title="Level Rewards" columns={['Level','Reward','Description','Active']} rows={(data.rewards||[]).map(r=><tr key={r.level}><td>L{r.level}</td><td><input defaultValue={r.reward_name} onBlur={async e=>{setSaving(String(r.level));try{await api(`/ceo/rewards/${r.level}`,{method:'PATCH',body:JSON.stringify({reward_name:e.target.value})});await load()}catch(x){setError(x.message)}finally{setSaving('')}}}/></td><td>{r.description}</td><td>{r.is_active?'Yes':'No'}</td></tr>)}/>} 
    {tab==='permissions'&&<Table title="Admin Permissions" columns={['Admin','Permission','Granted By','Created']} rows={(data.permissions||[]).map(r=><tr key={r.id}><td>{r.admin_id}</td><td>{r.permission_key}</td><td>{r.granted_by||'—'}</td><td>{new Date(r.created_at).toLocaleDateString()}</td></tr>)}/>} 
    {tab==='settings'&&<Table title="Platform Settings" columns={['Key','Value','Updated By','Updated']} rows={(data.settings||[]).map(r=><tr key={r.key}><td><b>{r.key}</b></td><td><code>{JSON.stringify(r.value)}</code></td><td>{r.updated_by||'—'}</td><td>{new Date(r.updated_at).toLocaleDateString()}</td></tr>)}/>} 
    {tab==='coupons'&&<Table title="Coupons / Offers" columns={['Code','Discount','Uses','Active','Expires']} rows={(data.coupons||[]).map(r=><tr key={r.id}><td><b>{r.code}</b></td><td>{r.discount_type==='percent'?`${r.discount_value}%`:`₹${r.discount_value}`}</td><td>{r.used_count}{r.max_uses?` / ${r.max_uses}`:''}</td><td>{r.is_active?'Yes':'No'}</td><td>{r.expires_at?new Date(r.expires_at).toLocaleDateString():'—'}</td></tr>)}/>} 
    {tab==='audit'&&<Table title="Immutable-style Audit History" columns={['Action','Entity','Entity ID','Actor','Time']} rows={(data.logs||[]).map(l=><tr key={l.id}><td>{l.action}</td><td>{l.entity_type}</td><td>{l.entity_id||'—'}</td><td>{l.actor_id||'—'}</td><td>{new Date(l.created_at).toLocaleString()}</td></tr>)}/>} 
  </>}</main></section>
}
function Empty(){return <div className="empty">No records found.</div>}
function EventPanel({title,rows}){return <article className="ceo-panel"><h2>{title}</h2>{rows.map(x=><div className="ceo-row" key={x.id}><div><b>{x.title}</b><small>₹{Number(x.price||0).toLocaleString('en-IN')} · {x.status}</small></div><span>{x.seats??'—'} seats</span></div>)}{!rows.length&&<Empty/>}</article>}
function Table({title,columns,rows}){return <article className="ceo-panel table-panel"><div className="table-head"><h2>{title}</h2><span>{rows.length} records</span></div><div className="table-scroll"><table><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.length?rows:<tr><td colSpan={columns.length}><Empty/></td></tr>}</tbody></table></div></article>}

function Dashboard({session}){
  const [profile,setProfile]=useState(null),[error,setError]=useState('')
  useEffect(()=>{if(session)api('/me').then(setProfile).catch(e=>setError(e.message))},[session])
  if(!session)return <Navigate to="/login" replace/>
  return <Page title="Dashboard" eyebrow="YOUR SKILLINK SPACE" sub="Your role-aware account area. Business permissions are enforced by the backend.">
    {error&&<div className="notice">{error}</div>}
    <div className="dash-grid"><article><small>ACCOUNT</small><h2>{profile?.profile?.full_name||'Member'}</h2><p>Role: {profile?.profile?.role||'Loading…'}</p></article><article><small>MY LEARNING</small><h2>Learning</h2><p>Verified enrollments and progress will appear here.</p></article><article><small>SECURITY</small><h2>Protected</h2><p>Session and role are checked server-side.</p></article></div>
  </Page>
}

export default function App(){
  const [session,setSession]=useState(null)
  useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>setSession(data.session));const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe()},[])
  return <div className="app"><Header session={session}/><Routes>
    <Route path="/" element={<Home/>}/><Route path="/courses" element={<Courses/>}/><Route path="/packages" element={<PackagesPage/>}/><Route path="/masterclasses" element={<Masterclasses/>}/><Route path="/workshops" element={<Workshops/>}/><Route path="/about" element={<About/>}/><Route path="/login" element={<Auth mode="login"/>}/><Route path="/signup" element={<Auth mode="signup"/>}/><Route path="/ceo" element={<CEOControlCenter session={session}/>}/><Route path="/dashboard" element={<Dashboard session={session}/>}/><Route path="/referrals" element={<Referrals session={session}/>}/><Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes><footer className="site-footer">© {new Date().getFullYear()} SkillLink · Learn. Build. Grow.</footer></div>
}
