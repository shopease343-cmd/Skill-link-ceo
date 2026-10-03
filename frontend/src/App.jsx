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
      {session ? <button className="nav-btn" onClick={logout}>Logout</button> :
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
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('')
  const navigate=useNavigate()
  async function submit(e){
    e.preventDefault();setBusy(true);setMsg('')
    try{
      if(!supabase) throw Error('Supabase frontend configuration is missing. Add Vercel VITE environment variables and redeploy.')
      if(mode==='signup'){
        const {error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name}}})
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
      {mode==='signup'&&<input required placeholder="Full name" value={name} onChange={e=>setName(e.target.value)}/>}
      <input required type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)}/>
      <input required minLength="8" type="password" placeholder="Password (minimum 8 characters)" value={password} onChange={e=>setPassword(e.target.value)}/>
      {msg&&<div className="notice">{msg}</div>}
      <button className="cta full" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Create Account':'Login'}</button>
      <p>{mode==='signup'?<>Already registered? <Link to="/login">Sign in</Link></>:<>Don't have an account? <Link to="/signup">Sign Up</Link></>}</p>
    </form>
  </section>
}

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
    <Route path="/" element={<Home/>}/><Route path="/courses" element={<Courses/>}/><Route path="/packages" element={<PackagesPage/>}/><Route path="/masterclasses" element={<Masterclasses/>}/><Route path="/workshops" element={<Workshops/>}/><Route path="/about" element={<About/>}/><Route path="/login" element={<Auth mode="login"/>}/><Route path="/signup" element={<Auth mode="signup"/>}/><Route path="/dashboard" element={<Dashboard session={session}/>}/><Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes><footer className="site-footer">© {new Date().getFullYear()} SkillLink · Learn. Build. Grow.</footer></div>
}
