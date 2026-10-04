import {supabase} from '../lib/supabase'

const API_BASE=(import.meta.env.VITE_API_URL||'http://localhost:4000/api').replace(/\/$/,'')

export async function api(path,options={}){
 const session=supabase?(await supabase.auth.getSession()).data.session:null
 const headers={'Content-Type':'application/json',...(options.headers||{})}
 if(session?.access_token) headers.Authorization=`Bearer ${session.access_token}`
 let r
 try{r=await fetch(`${API_BASE}${path}`,{...options,headers})}
 catch{throw new Error('Cannot connect to SkillLink backend. Check Vercel API URL, Render status and CORS settings.')}
 const data=await r.json().catch(()=>({}))
 if(!r.ok) throw new Error(data.message||`Request failed (${r.status})`)
 return data
}
