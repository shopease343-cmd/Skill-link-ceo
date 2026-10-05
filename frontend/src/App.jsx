import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { api } from './services/api'

const packages = [
  { name:'Aarambh', image:'/assets/package-aarambh.png', sub:'Digital Foundation', price:499, tone:'orange', icon:'↗', items:['Basics of Digital Skills','Beginner Friendly Courses','Certificate Included'] },
  { name:'Udaan', image:'/assets/package-udaan.png', sub:'Creative + Content Skills', price:999, tone:'blue', icon:'▥', items:['Content Creation Courses','Design & Creative Tools','Live Projects & Assignments'] },
  { name:'Pragati', image:'/assets/package-pragati.png', sub:'Marketing + Client Skills', price:1999, tone:'green', icon:'◎', items:['Marketing & Client Handling','Freelancing Guidance','Masterclasses Included'] },
  { name:'Brahmastra', image:'/assets/package-brahmastra.png', sub:'Advanced Digital Skills', price:3999, tone:'purple', icon:'♛', items:['Advanced Tools & Strategies','Live Workshops','Real World Case Studies'] },
  { name:'Shikhar', image:'/assets/package-shikhar.png', sub:'Leadership + Business', price:6999, tone:'pink', icon:'★', items:['Leadership & Business Skills','Personal Mentorship','Business Growth Masterclasses'] }
]

const courseCatalog = [
  {title:'Digital Marketing Foundations', image:'/assets/course-marketing.png', tone:'marketing'},
  {title:'Web Development Essentials', image:'/assets/course-development.png', tone:'development'},
  {title:'Content Creation Mastery', image:'/assets/course-content.png', tone:'creative'},
  {title:'AI Productivity', image:'/assets/course-ai.png', tone:'ai'},
  {title:'Graphic Design Essentials', image:'/assets/course-design.png', tone:'design'}
]
const categories = ['Digital Marketing','Web Development','Graphic Design','Content Creation','Business & Finance','AI & Tech','Communication','Personal Growth']

function LoadingScreen(){
  return <div className="loading-screen" role="status" aria-label="Loading SkillLink">
    <div className="loading-backdrop"/>
    <div className="loading-card">
      <img className="loading-logo-art" src="/assets/skilllink-loading.jpg" alt="SkillLink loading"/>
      <div className="loading-brand"><span>✦</span> SkillLink</div>
      <div className="loading-tagline">LEARN <b>•</b> EARN <b>•</b> GROW</div>
      <div className="loading-progress"><i/></div>
      <div className="loading-label">Loading your SkillLink experience…</div>
      <div className="loading-walkway" aria-hidden="true">
        <div className="walker walker-one"><i/><b/><em/><span/></div>
        <div className="walker walker-two"><i/><b/><em/><span/></div>
        <div className="walker walker-three"><i/><b/><em/><span/></div>
      </div>
    </div>
  </div>
}

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
      <div className="hero-art"><div className="art-glow"/><img className="hero-person-photo" src="/assets/skilllink-learner.jpg" alt="SkillLink learner studying with a book"/>
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

async function loadRazorpayScript(){if(window.Razorpay)return;await new Promise((resolve,reject)=>{const sc=document.createElement('script');sc.src='https://checkout.razorpay.com/v1/checkout.js';sc.onload=resolve;sc.onerror=()=>reject(new Error('Payment checkout could not load. Check your connection.'));document.body.appendChild(sc)})}

function BuyButton({kind,id,name,label='Buy now',purpose='purchase'}){
  const navigate=useNavigate();
  const [busy,setBusy]=useState(false); const [msg,setMsg]=useState('');
  async function start(){
    setMsg('');
    if(!supabase){navigate('/login');return}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){navigate('/login');return}
    setBusy(true);
    try{
      const order=await api('/payments/create-order',{method:'POST',body:JSON.stringify({kind,id,name,purpose})});
      await loadRazorpayScript();
      const options={key:order.keyId,amount:order.amount,currency:order.currency,name:'SkillLink',description:order.title,order_id:order.razorpayOrderId,prefill:{email:session.user.email||''},theme:{color:'#6839e5'},modal:{ondismiss:()=>setBusy(false)},handler:async response=>{
        try{await api('/payments/verify',{method:'POST',body:JSON.stringify({skilllinkOrderId:order.orderId,razorpayOrderId:response.razorpay_order_id,razorpayPaymentId:response.razorpay_payment_id,razorpaySignature:response.razorpay_signature})});navigate('/dashboard',{replace:true})}
        catch(e){setMsg(e.message);setBusy(false)}
      }};
      const checkout=new window.Razorpay(options);checkout.on('payment.failed',response=>{setMsg(response.error?.description||'Payment failed. Please try again.');setBusy(false)});checkout.open();
    }catch(e){setMsg(e.message);setBusy(false)}
  }
  return <div className="buy-wrap"><button className="package-btn buy-btn" disabled={busy} onClick={start}>{busy?'Opening secure checkout…':label}</button>{msg&&<small className="buy-error">{msg}</small>}</div>
}

function PackageGrid(){
  const [items,setItems]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  useEffect(()=>{let cancelled=false;(async()=>{try{const r=await api('/packages');if(!cancelled)setItems(r.packages||[])}catch(e){if(!cancelled)setError(e.message)}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[])
  const meta={Aarambh:packages[0],Udaan:packages[1],Pragati:packages[2],Brahmastra:packages[3],Shikhar:packages[4]}
  if(loading)return <div className="ceo-loading">Loading live packages…</div>
  if(error)return <div className="notice">{error}</div>
  if(!items.length)return <div className="empty">No active packages are currently published.</div>
  return <div className="package-grid">{items.map(p=>{const m=meta[p.name]||{};return <article className={`package ${m.tone||''}`} key={p.id}><div className="package-image-link"><img className="package-image" src={m.image||'/assets/skilllink-loading.jpg'} alt={`${p.name} — ${p.subtitle||''}`} loading="lazy"/></div><div className="package-content"><div className="package-icon">{m.icon||'✦'}</div><h3>{p.name}</h3><p>{p.subtitle||p.description||''}</p><strong>₹{Number(p.base_price??p.price??0).toLocaleString('en-IN')}</strong><ul>{(m.items||[]).map(x=><li key={x}>✓ {x}</li>)}</ul><BuyButton kind="package" id={p.id} name={p.name} label="Get Started →"/></div></article>})}</div>
}
function MasterGrid(){
  const [items,setItems]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  useEffect(()=>{let cancelled=false;(async()=>{try{const r=await api('/masterclasses');if(!cancelled)setItems(r.masterclasses||[])}catch(e){if(!cancelled)setError(e.message)}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[])
  if(loading)return <div className="ceo-loading">Loading live masterclasses…</div>
  if(error)return <div className="notice">{error}</div>
  if(!items.length)return <div className="empty">No published masterclasses are currently available.</div>
  return <div className="master-grid">{items.map((m,i)=><article className="master master-image-card" key={m.id}><div className="master-image-link"><img src={m.thumbnail_url||`/assets/master-${['instagram','fullstack','ai','freelancing'][i%4]}.png`} alt={m.title} loading="lazy"/></div><div className="master-info"><span className="live">{m.mode==='recorded'?'Recorded Masterclass':'Live Masterclass'}</span><small>SkillLink Learning</small><h3>{m.title}</h3><p>◷ {m.scheduled_at?new Date(m.scheduled_at).toLocaleString('en-IN'):'Schedule to be announced'}</p><footer><b>₹{Number(m.price||0).toLocaleString('en-IN')}</b>{m.price>0?<BuyButton kind="masterclass" id={m.id} label="Join Now →"/>:<span>Free</span>}</footer></div></article>)}</div>
}
function Courses(){
  const [courses,setCourses]=useState([])
  const [error,setError]=useState('')
  const [query,setQuery]=useState('')
  const [category,setCategory]=useState('all')
  const [sort,setSort]=useState('newest')
  useEffect(()=>{api('/courses').then(x=>setCourses(x.courses||[])).catch(e=>setError(e.message))},[])
  const imageFor=(title,index)=>{
    const t=String(title||'').toLowerCase()
    if(t.includes('marketing')) return courseCatalog[0].image
    if(t.includes('web')||t.includes('development')) return courseCatalog[1].image
    if(t.includes('content')) return courseCatalog[2].image
    if(t.includes('ai')) return courseCatalog[3].image
    if(t.includes('graphic')||t.includes('design')) return courseCatalog[4].image
    return courseCatalog[index%courseCatalog.length].image
  }
  const categoryFor=title=>{
    const t=String(title||'').toLowerCase()
    if(t.includes('marketing')) return 'Digital Marketing'
    if(t.includes('web')||t.includes('development')||t.includes('coding')) return 'Web Development'
    if(t.includes('graphic')||t.includes('design')) return 'Graphic Design'
    if(t.includes('content')||t.includes('video')) return 'Content Creation'
    if(t.includes('business')||t.includes('finance')) return 'Business & Finance'
    if(t.includes('ai')||t.includes('tech')) return 'AI & Tech'
    if(t.includes('communication')) return 'Communication'
    if(t.includes('growth')) return 'Personal Growth'
    return 'Other'
  }
  const list=courses.map((c,i)=>({id:c.id,title:c.title,desc:c.description||'Practical, structured learning experience.',status:c.status,image:imageFor(c.title,i),category:categoryFor(c.title),created_at:c.created_at,price:Number(c.price||0)}))
    .filter(c=>`${c.title} ${c.desc}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter(c=>category==='all'||c.category===category)
    .sort((a,b)=>sort==='price-low'?a.price-b.price:sort==='price-high'?b.price-a.price:new Date(b.created_at||0)-new Date(a.created_at||0))
  return <Page title="Explore Courses" eyebrow="LEARNING MARKETPLACE" sub="Build practical skills through structured courses, projects and assessments.">
    {error && <div className="notice">{error}</div>}
    <div className="filterbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search courses..." aria-label="Search courses"/><select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Filter by category"><option value="all">All Categories</option>{categories.map(x=><option key={x} value={x}>{x}</option>)}</select><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort courses"><option value="newest">Newest</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option></select></div>
    {!list.length&&!error?<div className="empty">No courses match your filters.</div>:<div className="listing-grid course-listing">{list.map((c,i)=><article className="list-card course-card" key={c.id||c.title}><Link className="course-image-link" to={c.id?`/courses/${c.id}`:'/login'}><img src={c.image} alt={c.title} loading="lazy"/></Link><div className="course-card-body"><span className="tag">{c.status}</span><h3>{c.title}</h3><p>{c.desc}</p><div className="course-pills"><span>✓ Practical Projects</span><span>✓ Step-by-Step</span><span>✓ Certificate</span></div>{c.id?<BuyButton kind="course" id={c.id} label="Enroll & Pay →"/>:<Link to="/login">View details →</Link>}</div></article>)}</div>}
  </Page>
}

function CourseDetails({id}){
  const [course,setCourse]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  useEffect(()=>{let cancelled=false;(async()=>{try{const r=await api(`/courses/${id}`);if(!cancelled)setCourse(r.course)}catch(e){if(!cancelled)setError(e.message)}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[id])
  if(loading)return <Page title="Course" eyebrow="COURSE" sub="Loading live course data…"><div className="ceo-loading">Loading…</div></Page>
  if(error)return <Page title="Course unavailable" eyebrow="COURSE" sub=""><div className="notice">{error}</div></Page>
  return <Page title={course.title} eyebrow="COURSE DETAILS" sub={course.description||'Practical learning experience.'}><div className="dash-grid"><article><small>PRICE</small><h2>₹{Number(course.price||0).toLocaleString('en-IN')}</h2><p>Published course</p></article><article><small>ENROLLMENT</small><BuyButton kind="course" id={course.id} label="Enroll & Pay →"/></article></div></Page>
}

function PackagesPage(){return <Page title="Learning Packages" eyebrow="CURATED PATHS" sub="Choose a complete learning path with access to relevant courses, skills and eligible live experiences."><PackageGrid/></Page>}
function Masterclasses(){return <Page title="Masterclasses" eyebrow="LIVE LEARNING" sub="Learn directly through scheduled live and recorded masterclasses."><MasterGrid/></Page>}
function Workshops(){
  const [items,setItems]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  useEffect(()=>{let cancelled=false;(async()=>{try{const r=await api('/workshops');if(!cancelled)setItems(r.workshops||[])}catch(e){if(!cancelled)setError(e.message)}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[])
  return <Page title="Workshops" eyebrow="PRACTICAL EXPERIENCES" sub="Hands-on workshops with schedules, registration, attendance, resources and eligible certificates.">{loading?<div className="ceo-loading">Loading live workshops…</div>:error?<div className="notice">{error}</div>:!items.length?<div className="empty">No published workshops are currently available.</div>:<div className="listing-grid">{items.map((x,i)=><article className="list-card" key={x.id}><div className={`thumb thumb${i%4}`}>WORKSHOP</div><div><span className="tag">{x.scheduled_at?'Scheduled':'Upcoming'}</span><h3>{x.title}</h3><p>{x.description||'Workshop details will be available after publication.'}</p><div><b>₹{Number(x.price||0).toLocaleString('en-IN')}</b>{x.seats?` · ${x.seats} seats`:''}</div>{x.price>0?<BuyButton kind="workshop" id={x.id} label="Register & Pay →"/>:<span>Free registration</span>}</div></article>)}</div>}</Page>
}
function About(){return <Page title="Skills that move you forward." eyebrow="ABOUT SKILLLINK" sub="SkillLink brings practical learning, projects and opportunity-oriented experiences together in one platform."><div className="about-grid">{[['01','Learn','Structured courses and live learning experiences.'],['02','Build','Projects, assessments and practical progress.'],['03','Grow','Referrals, achievements, certificates and opportunities.']].map(x=><article key={x[0]}><b>{x[0]}</b><h2>{x[1]}</h2><p>{x[2]}</p></article>)}</div></Page>}

function Page({title,eyebrow,sub,children}){return <section className="page-content"><div className="page-head"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{sub}</p></div>{children}</section>}

function Auth({mode}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[referral,setReferral]=useState(()=>new URLSearchParams(window.location.search).get('ref')||''),[selectedPackage,setSelectedPackage]=useState(''),[packageOptions,setPackageOptions]=useState([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[showPassword,setShowPassword]=useState(false)
  const navigate=useNavigate(); const signup=mode==='signup'
  useEffect(()=>{if(!signup)return;let cancelled=false;(async()=>{try{const r=await api('/packages');const live=r.packages||[];if(!cancelled){setPackageOptions(live);setSelectedPackage(prev=>prev||live[0]?.name||'')}}catch(e){if(!cancelled)setMsg(e.message)}})();return()=>{cancelled=true}},[signup])
  const strength=password.length>=12?'Strong':password.length>=8?'Good':'Use 8+ characters'
  async function submit(e){
    e.preventDefault();setBusy(true);setMsg('')
    try{
      if(!supabase) throw Error('Supabase frontend configuration is missing. Add Vercel VITE environment variables and redeploy.')
      if(signup){
        if(password.length<8) throw Error('Password must be at least 8 characters.')
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name.trim(),referral_code:referral.trim().toUpperCase()||null}}})
        if(error) throw error
        if(data.session){
          const order=await api('/payments/create-order',{method:'POST',body:JSON.stringify({kind:'package',name:selectedPackage,purpose:'registration_bundle'})})
          await loadRazorpayScript()
          const options={key:order.keyId,amount:order.amount,currency:order.currency,name:'SkillLink',description:`Registration ₹99 + ${order.title} ₹${order.packagePrice.toLocaleString('en-IN')}`,order_id:order.razorpayOrderId,prefill:{name:name.trim(),email:data.user?.email||email},theme:{color:'#6839e5'},modal:{ondismiss:()=>setBusy(false)},handler:async response=>{try{await api('/payments/verify',{method:'POST',body:JSON.stringify({skilllinkOrderId:order.orderId,razorpayOrderId:response.razorpay_order_id,razorpayPaymentId:response.razorpay_payment_id,razorpaySignature:response.razorpay_signature})});navigate('/dashboard',{replace:true})}catch(e){setMsg(e.message);setBusy(false)}}}
          const checkout=new window.Razorpay(options);checkout.on('payment.failed',response=>{setMsg(response.error?.description||'Payment failed. Your account remains created; complete payment from the dashboard.');setBusy(false)});checkout.open()
        }else setMsg('Account created. Check your email, then log in to complete the ₹99 registration + selected package payment.')
      }else{
        const {error}=await supabase.auth.signInWithPassword({email,password}); if(error) throw error; navigate('/dashboard')
      }
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  return <section className="auth-page">
    <div className="auth-visual">
      <img src="/assets/skilllink-learner.jpg" alt="SkillLink learner" className="auth-photo"/>
      <div className="auth-overlay"/>
      <div className="auth-visual-content"><div className="eyebrow">SKILLLINK • LEARN • BUILD • GROW</div><h1>{signup?'Start building your skills.':'Welcome back to your growth journey.'}</h1><p>Learn practical skills, complete projects, earn certificates and grow through a trusted learning community.</p><div className="auth-feature-grid"><span>✓ Secure account</span><span>✓ Practical projects</span><span>✓ Certificates</span><span>✓ Referral growth</span></div></div>
    </div>
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-logo"><b>✦</b><span>SkillLink</span></div><div className="eyebrow">{signup?'CREATE YOUR ACCOUNT':'SECURE SIGN IN'}</div><h2>{signup?'Join SkillLink':'Login to SkillLink'}</h2><p className="auth-sub">{signup?'Create your account and start learning today.':'Access your courses, progress and SkillLink dashboard.'}</p>
      {signup&&<label>Full name<input required autoComplete="name" placeholder="Your full name" value={name} onChange={e=>setName(e.target.value)}/></label>}
      {signup&&<label>Choose your package <span>₹99 registration + package fee</span><select required disabled={!packageOptions.length} value={selectedPackage} onChange={e=>setSelectedPackage(e.target.value)}>{packageOptions.map(p=><option key={p.id||p.name} value={p.name}>{p.name} — ₹{(Number(p.base_price??p.price??0)+99).toLocaleString('en-IN')} total</option>)}</select></label>}
      {signup&&<label>Referral code <span>optional</span><input autoComplete="off" placeholder="e.g. SL-XXXXXXXX" value={referral} onChange={e=>setReferral(e.target.value.toUpperCase())}/></label>}
      <label>Email address<input required autoComplete="email" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Password<div className="password-wrap"><input required minLength="8" autoComplete={signup?'new-password':'current-password'} type={showPassword?'text':'password'} placeholder="Minimum 8 characters" value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" onClick={()=>setShowPassword(!showPassword)}>{showPassword?'Hide':'Show'}</button></div>{signup&&<small className={`password-strength ${password.length>=8?'ok':''}`}>{strength}</small>}</label>
      {msg&&<div className="notice">{msg}</div>}
      <button className="cta full auth-submit" disabled={busy}>{busy?'Please wait…':signup?'Create Secure Account':'Continue Securely →'}</button>
      <div className="auth-trust"><span>🔒 Secure authentication</span><span>✓ Server-side role checks</span></div>
      <p className="auth-switch">{signup?<>Already registered? <Link to="/login">Sign in</Link></>:<>New to SkillLink? <Link to="/signup">Create an account</Link></>}</p>
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
  async function updatePackage(id,value){setSaving(id);try{const body=typeof value==='object'?value:{base_price:Number(value)};await api(`/ceo/packages/${id}`,{method:'PATCH',body:JSON.stringify(body)});await load()}catch(e){setError(e.message)}finally{setSaving('')}}
  async function reviewWithdrawal(id,status){setSaving(id);try{await api(`/ceo/withdrawals/${id}`,{method:'PATCH',body:JSON.stringify({status})});await load()}catch(e){setError(e.message)}finally{setSaving('')}}
  async function updateUser(id,field,value){setSaving(id);try{await api(`/ceo/users/${id}`,{method:'PATCH',body:JSON.stringify({[field]:value})});await load()}catch(e){setError(e.message)}finally{setSaving('')}}
  async function updateCourse(id,field,value){setSaving(id);try{await api(`/ceo/courses/${id}`,{method:'PATCH',body:JSON.stringify({[field]:field==='price'?Number(value):value})});await load()}catch(e){setError(e.message)}finally{setSaving('')}}
  async function updateLevel(level,field,value){setSaving(String(level));try{const row=(data.levels||[]).find(x=>x.level===level);await api(`/ceo/levels/${level}`,{method:'PATCH',body:JSON.stringify({...row,[field]:field==='skill_mastery_required'?Boolean(value):Number(value)})});await load()}catch(e){setError(e.message)}finally{setSaving('')}}
  const c=data?.counts||{}
  return <section className="ceo-shell"><aside className="ceo-side"><div className="ceo-brand">✦ <span>CEO Control</span></div><div className="ceo-nav">{tabs.map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</div><Link to="/dashboard" className="ceo-back">← Member Dashboard</Link></aside><main className="ceo-main"><div className="ceo-top"><div><div className="eyebrow">SKILLLINK ADMINISTRATION</div><h1>{tabs.find(x=>x[0]===tab)?.[1]}</h1><p>CEO-authorized management. Changes are written through the protected API and audited.</p></div><button className="refresh" onClick={()=>load()}>↻ Refresh</button></div>{error&&<div className="notice">{error}</div>}{loading?<div className="ceo-loading">Loading live control data…</div>:<>
    {tab==='overview'&&<div className="ceo-content"><div className="ceo-metrics">{[['Users',c.profiles],['Courses',c.courses],['Packages',c.packages],['Orders',c.orders],['Withdrawals',c.withdrawals],['Revenue',`₹${Number(data.revenue||0).toLocaleString('en-IN')}`],['Reviews',c.reviews],['Tickets',c.support_tickets]].map(x=><article key={x[0]}><small>{x[0]}</small><strong>{x[1]??0}</strong></article>)}</div><div className="ceo-two"><article className="ceo-panel"><h2>Pending withdrawals</h2>{(data.pendingWithdrawals||[]).map(w=><div className="ceo-row" key={w.id}><div><b>₹{Number(w.amount).toLocaleString('en-IN')}</b><small>{w.partner_id}</small></div><span className="status pending">Pending</span></div>)}{!data.pendingWithdrawals?.length&&<Empty/>}</article><article className="ceo-panel"><h2>Recent audit activity</h2>{(data.recentAudit||[]).slice(0,8).map(x=><div className="audit-row" key={x.id}><b>{x.action}</b><small>{new Date(x.created_at).toLocaleString()}</small></div>)}{!data.recentAudit?.length&&<Empty/>}</article></div></div>}
    {tab==='users'&&<Table title="Users" columns={['Name','Role','Status','Referral','Created']} rows={(data.users||[]).map(u=><tr key={u.id}><td>{u.full_name||'—'}<small>{u.id}</small></td><td><select value={u.role} disabled={saving===u.id} onChange={e=>updateUser(u.id,'role',e.target.value)}><option>student</option><option>partner</option><option>instructor</option><option>admin</option><option>ceo</option></select></td><td><select value={u.status} disabled={saving===u.id} onChange={e=>updateUser(u.id,'status',e.target.value)}><option>active</option><option>pending</option><option>suspended</option><option>disabled</option></select></td><td>{u.referral_code||'—'}</td><td>{new Date(u.created_at).toLocaleDateString()}</td></tr>)}/>} 
    {tab==='packages'&&<Table title="Package Management" columns={['Package','Subtitle','Base Price','Partner Commission','Active','Featured']} rows={(data.packages||[]).map(p=><tr key={p.id}><td><b>{p.name}</b></td><td>{p.subtitle}</td><td><div className="inline-edit"><span>₹</span><input defaultValue={p.base_price} type="number" onBlur={e=>{if(Number(e.target.value)!==Number(p.base_price))updatePackage(p.id,e.target.value)}}/></div></td><td><div className="inline-edit"><span>₹</span><input defaultValue={p.partner_commission||0} type="number" onBlur={e=>{if(Number(e.target.value)!==Number(p.partner_commission||0))updatePackage(p.id,{base_price:Number(p.base_price),partner_commission:Number(e.target.value)})}}/></div></td><td>{p.is_active?'Yes':'No'}</td><td>{p.is_featured?'Yes':'No'}</td></tr>)}/>} 
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

function RoleDashboard({data,onGo}){
  const role=data?.role
  if(role==='ceo') return <Page title="CEO Dashboard" eyebrow="SKILLLINK CONTROL" sub="CEO access is protected by server-side authorization."><div className="dash-grid"><article><small>ACCOUNT</small><h2>{data.profile?.full_name||'CEO'}</h2><p>Role: CEO</p></article><article><small>CONTROL CENTER</small><h2>Live</h2><p>Open the protected CEO Control Center for management.</p><button className="nav-btn" onClick={()=>onGo('/ceo')}>Open CEO Control →</button></article></div></Page>
  if(role==='admin') return <Page title="Admin Dashboard" eyebrow="SKILLLINK ADMIN" sub="Only permissions granted by the CEO can access protected administrative data."><div className="dash-grid">{[['USERS',data.counts?.users],['COURSES',data.counts?.courses],['ORDERS',data.counts?.orders],['WITHDRAWALS',data.counts?.withdrawals]].map(([k,v])=><article key={k}><small>{k}</small><h2>{v??0}</h2><p>Live database count</p></article>)}</div><div className="dashboard-upgrade"><span className="eyebrow">SERVER-SIDE ACCESS</span><h2>Permission controlled</h2><p>Administrative records are returned only by protected APIs after role and permission checks.</p></div></Page>
  if(role==='partner') return <Page title="Partner Dashboard" eyebrow="YOUR PARTNER SPACE" sub="Your referral, earnings and withdrawal information comes directly from the database."><div className="dash-grid"><article><small>REFERRALS</small><h2>{data.referralCount??0}</h2><p>Attributed registrations</p></article><article><small>AVAILABLE EARNINGS</small><h2>₹{Number(data.availableEarnings||0).toLocaleString('en-IN')}</h2><p>Eligible balance after reserved withdrawals</p></article><article><small>WITHDRAWALS</small><h2>{data.withdrawals?.length||0}</h2><p>Recorded requests</p></article></div><div className="dashboard-upgrade"><span className="eyebrow">PARTNER TOOLS</span><h2>Referral Center</h2><p>Your referral code and verified purchase statistics are available in the protected referral center.</p><button className="nav-btn" onClick={()=>onGo('/referrals')}>Open Referral Center →</button></div></Page>
  if(role==='instructor') return <Page title="Instructor Dashboard" eyebrow="YOUR INSTRUCTOR SPACE" sub="Manage your own courses and teaching events through protected APIs."><div className="dash-grid"><article><small>MY COURSES</small><h2>{data.courses?.length||0}</h2><p>Your courses</p></article><article><small>MASTERCLASSES</small><h2>{data.masterclasses?.length||0}</h2><p>Your masterclasses</p></article><article><small>WORKSHOPS</small><h2>{data.workshops?.length||0}</h2><p>Your workshops</p></article></div><div className="dashboard-upgrade"><span className="eyebrow">CONTENT</span><h2>Course workspace</h2><p>New courses are created through the protected instructor API and start as draft content.</p></div></Page>
  const current=data?.currentPackage
  return <Page title="Dashboard" eyebrow="YOUR SKILLINK SPACE" sub="Your role-aware account area. Business permissions are enforced by the backend."><div className="dash-grid"><article><small>ACCOUNT</small><h2>{data?.profile?.full_name||'Member'}</h2><p>Role: {data?.profile?.role||'Student'}</p></article><article><small>MY PACKAGE</small><h2>{current?.name||'Not selected'}</h2><p>{current?`Package value ₹${Number(current.base_price).toLocaleString('en-IN')}`:'Choose a package to unlock your learning path.'}</p></article><article><small>REGISTRATION</small><h2>{Number(data?.profile?.registration_fee_paid||0)>0?'Paid ✓':'₹99 Pending'}</h2><p>{Number(data?.profile?.registration_fee_paid||0)>0?'Registration fee verified.':'Complete registration payment to activate your package.'}</p></article></div><section className="dashboard-upgrade"><div><span className="eyebrow">MY LEARNING</span><h2>{data?.enrollments?.length?'Active learning':'Choose Your Package'}</h2><p>{data?.enrollments?.length?`${data.enrollments.length} enrollment record(s) found in the database.`:'Registration is ₹99 plus your selected package fee.'}</p></div></section></Page>
}

function Dashboard({session}){
  const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  const navigate=useNavigate()
  useEffect(()=>{let cancelled=false;(async()=>{if(!session){setLoading(false);return}try{const d=await api('/dashboard');if(!cancelled)setData(d)}catch(e){if(!cancelled)setError(e.message)}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[session])
  if(!session)return <Navigate to="/login" replace/>
  if(loading)return <Page title="Dashboard" eyebrow="SKILLLINK" sub="Loading your live account data…"><div className="ceo-loading">Loading live account data…</div></Page>
  return <>{error&&<Page title="Dashboard" eyebrow="SKILLLINK" sub="The dashboard could not load its live data."><div className="notice">{error}</div></Page>}{!error&&data&&<RoleDashboard data={data} onGo={navigate}/>}</>
}

function CourseRoute(){const {id}=useParams();return <CourseDetails id={id}/>}

export default function App(){
  const [session,setSession]=useState(null),[booting,setBooting]=useState(true)
  useEffect(()=>{const timer=setTimeout(()=>setBooting(false),1900);if(!supabase)return()=>clearTimeout(timer);supabase.auth.getSession().then(({data})=>setSession(data.session));const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>{clearTimeout(timer);subscription.unsubscribe()}},[])
  if(booting)return <LoadingScreen/>
  return <div className="app"><Header session={session}/><Routes>
    <Route path="/" element={<Home/>}/><Route path="/courses" element={<Courses/>}/><Route path="/courses/:id" element={<CourseRoute/>}/><Route path="/packages" element={<PackagesPage/>}/><Route path="/masterclasses" element={<Masterclasses/>}/><Route path="/workshops" element={<Workshops/>}/><Route path="/about" element={<About/>}/><Route path="/login" element={<Auth mode="login"/>}/><Route path="/signup" element={<Auth mode="signup"/>}/><Route path="/ceo" element={<CEOControlCenter session={session}/>}/><Route path="/dashboard" element={<Dashboard session={session}/>}/><Route path="/referrals" element={<Referrals session={session}/>}/><Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes><footer className="site-footer">© {new Date().getFullYear()} SkillLink · Learn. Build. Grow.</footer></div>
}
