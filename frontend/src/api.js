import {supabase} from '../lib/supabase'
export async function api(path,options={}){
 const session=supabase?(await supabase.auth.getSession()).data.session:null
 const headers={'Content-Type':'application/json',...(options.headers||{})}
 if(session?.access_token) headers.Authorization=`Bearer ${session.access_token}`
 const r=await fetch(`${import.meta.env.VITE_API_URL||'http://localhost:4000/api'}${path}`,{...options,headers})
 const data=await r.json().catch(()=>({}))
 if(!r.ok) throw new Error(data.message||'Request failed')
 return data
}
