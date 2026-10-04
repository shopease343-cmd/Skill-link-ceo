import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import crypto from 'node:crypto'

const app=express()
const port=Number(process.env.PORT||4000)
const requiredEnv=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']
for(const key of requiredEnv){if(!process.env[key]){console.error(`Missing required environment variable: ${key}`);process.exit(1)}}
const allowedOrigins=(process.env.CORS_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean)
if(process.env.NODE_ENV==='production' && !allowedOrigins.length){console.error('Missing CORS_ORIGIN in production');process.exit(1)}
const supabaseAdmin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}})
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({origin(origin,cb){if(!origin||allowedOrigins.includes(origin))return cb(null,true);return cb(new Error('CORS origin not allowed'))},methods:['GET','POST','PATCH','PUT','DELETE','OPTIONS'],allowedHeaders:['Content-Type','Authorization','X-Razorpay-Signature'],maxAge:86400}))
app.use(express.json({limit:'1mb',verify:(req,_res,buf)=>{req.rawBody=Buffer.from(buf)}}))
app.use(rateLimit({windowMs:15*60*1000,max:300,standardHeaders:true,legacyHeaders:false,skip:req=>req.path==='/api/health'}))
app.get('/api/health',async(_req,res)=>{const {error}=await supabaseAdmin.from('profiles').select('id',{count:'exact',head:true});if(error)return res.status(503).json({ok:false,service:'skilllink-api',database:'unavailable'});res.json({ok:true,service:'skilllink-api',database:'connected'})})

async function auth(req,res,next){
  const token=(req.headers.authorization||'').startsWith('Bearer ')?req.headers.authorization.slice(7):null
  if(!token)return res.status(401).json({message:'Authentication required'})
  const {data,error}=await supabaseAdmin.auth.getUser(token)
  if(error||!data.user)return res.status(401).json({message:'Invalid or expired session'})
  req.user=data.user; next()
}
async function profile(req,res,next){
  const {data,error}=await supabaseAdmin.from('profiles').select('id,full_name,role,status,referral_code,referred_by,registration_fee_paid,registration_fee_paid_at,created_at,updated_at').eq('id',req.user.id).single()
  if(error||!data||data.status!=='active')return res.status(403).json({message:'Active profile required'})
  req.profile=data; next()
}
function requireCEO(req,res,next){if(req.profile?.role!=='ceo')return res.status(403).json({message:'CEO permission required'});next()}
const requireRoles=(...roles)=>(req,res,next)=>{if(!roles.includes(req.profile?.role))return res.status(403).json({message:'Access denied for this role'});next()}
const requireStudent=requireRoles('student')
const requirePartner=requireRoles('partner')
const requireInstructor=requireRoles('instructor')
const requireAdmin=requireRoles('admin','ceo')
async function adminPermission(req,res,next){
  if(req.profile?.role==='ceo') return next()
  if(req.profile?.role!=='admin') return res.status(403).json({message:'Admin permission required'})
  const permission=req.permissionKey
  if(!permission) return res.status(500).json({message:'Permission key not configured'})
  const {data,error}=await supabaseAdmin.from('admin_permissions').select('id').eq('admin_id',req.user.id).eq('permission_key',permission).maybeSingle()
  if(error)return res.status(500).json({message:'Unable to verify admin permission'})
  if(!data)return res.status(403).json({message:`Missing admin permission: ${permission}`})
  next()
}
function withPermission(key){return (req,res,next)=>{req.permissionKey=key;adminPermission(req,res,next)}}
async function audit(req,action,entityType,entityId,metadata={}){await supabaseAdmin.from('audit_logs').insert({actor_id:req.user.id,action,entity_type:entityType,entity_id:entityId||null,metadata})}


const paymentEnv={
  keyId:process.env.RAZORPAY_KEY_ID||'',
  keySecret:process.env.RAZORPAY_KEY_SECRET||'',
  webhookSecret:process.env.RAZORPAY_WEBHOOK_SECRET||''
}
function razorpayConfigured(){return Boolean(paymentEnv.keyId&&paymentEnv.keySecret)}
async function razorpayRequest(path,options={}){
  if(!razorpayConfigured()) throw new Error('Payment gateway is not configured on the server')
  const auth=Buffer.from(`${paymentEnv.keyId}:${paymentEnv.keySecret}`).toString('base64')
  const r=await fetch(`https://api.razorpay.com/v1${path}`,{...options,headers:{'Content-Type':'application/json',Authorization:`Basic ${auth}`,...(options.headers||{})}})
  const data=await r.json().catch(()=>({}))
  if(!r.ok) throw new Error(data.error?.description||'Payment gateway request failed')
  return data
}
async function fulfillPaidOrder(orderId,razorpayPaymentId){
  const {data:order,error:oe}=await supabaseAdmin.from('orders').select('*').eq('id',orderId).single()
  if(oe||!order) throw new Error('Order not found')
  if(order.status==='paid') return order
  const {data:updated,error}=await supabaseAdmin.from('orders').update({status:'paid'}).eq('id',order.id).neq('status','paid').select().single()
  if(error) throw new Error('Unable to mark order paid')
  if(updated.course_id){
    const {data:existing}=await supabaseAdmin.from('enrollments').select('id').eq('student_id',order.buyer_id).eq('course_id',updated.course_id).limit(1)
    if(!existing?.length) await supabaseAdmin.from('enrollments').insert({student_id:order.buyer_id,course_id:updated.course_id,status:'active',progress:0})
  }
  if(updated.package_id){
    if(updated.order_purpose==='upgrade' && updated.upgrade_from_package_id){
      await supabaseAdmin.from('enrollments').update({status:'cancelled'}).eq('student_id',order.buyer_id).eq('package_id',updated.upgrade_from_package_id).eq('status','active')
    }
    const {data:existing}=await supabaseAdmin.from('enrollments').select('id').eq('student_id',order.buyer_id).eq('package_id',updated.package_id).eq('status','active').limit(1)
    if(!existing?.length) await supabaseAdmin.from('enrollments').insert({student_id:order.buyer_id,package_id:updated.package_id,status:'active',progress:0})
    if(updated.order_purpose==='registration_bundle'){
      await supabaseAdmin.from('profiles').update({registration_fee_paid:Number(updated.registration_fee||99),registration_fee_paid_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',order.buyer_id)
    }
  }
  if(updated.referral_code){
    const {data:partner}=await supabaseAdmin.from('profiles').select('id').eq('referral_code',updated.referral_code).eq('role','partner').single()
    if(partner){
      let commission=0
      if(updated.package_id){const {data:pkg}=await supabaseAdmin.from('packages').select('partner_commission').eq('id',updated.package_id).single();commission=Number(pkg?.partner_commission||0)}
      if(commission>0){
        const {data:existing}=await supabaseAdmin.from('commissions').select('id').eq('partner_id',partner.id).eq('order_id',updated.id).limit(1)
        if(!existing?.length){await supabaseAdmin.from('commissions').insert({partner_id:partner.id,order_id:updated.id,amount:commission,status:'available'});await supabaseAdmin.from('earnings_ledger').insert({partner_id:partner.id,type:'commission',amount:commission,reference_id:updated.id,description:'Verified referral commission'})}
      }
    }
  }
  if(razorpayPaymentId){await supabaseAdmin.from('payments').update({provider_payment_id:razorpayPaymentId,status:'verified',raw_status:'captured',verified_at:new Date().toISOString()}).eq('order_id',order.id)}
  return updated
}

app.post('/api/payments/create-order',auth,profile,requireStudent,async(req,res)=>{
  const schema=z.object({kind:z.enum(['package','course','masterclass','workshop']),id:z.string().uuid().optional(),name:z.string().trim().max(160).optional(),purpose:z.enum(['registration_bundle','purchase','upgrade']).default('purchase')}).refine(x=>x.id||x.name,{message:'Item id or name is required'})
  const p=schema.safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid checkout request'})
  if(!razorpayConfigured())return res.status(503).json({message:'Payment gateway is not configured. Add Razorpay server keys in Render environment variables.'})
  if(p.data.purpose==='registration_bundle' && p.data.kind!=='package')return res.status(400).json({message:'Registration bundle must contain a package'})
  if(p.data.purpose==='upgrade' && p.data.kind!=='package')return res.status(400).json({message:'Upgrade is available for packages only'})
  try{
    let item,amount,title,packagePrice=0,registrationFee=0,upgradeFromPackageId=null
    if(p.data.kind==='package'){
      const q=supabaseAdmin.from('packages').select('id,name,base_price').eq('is_active',true)
      const r=p.data.id?q.eq('id',p.data.id).single():q.eq('name',p.data.name).single();const out=await r;if(out.error||!out.data)return res.status(404).json({message:'Package not found'});item=out.data;packagePrice=Number(item.base_price);title=item.name
      if(p.data.purpose==='registration_bundle'){
        if(Number(req.profile.registration_fee_paid||0)>0)return res.status(409).json({message:'Registration fee has already been paid. Use Upgrade Package instead.'})
        registrationFee=99;amount=registrationFee+packagePrice
      }else if(p.data.purpose==='upgrade'){
        const {data:active}=await supabaseAdmin.from('enrollments').select('package_id,packages(id,name,base_price)').eq('student_id',req.user.id).eq('status','active').not('package_id','is',null).order('created_at',{ascending:false}).limit(1).maybeSingle()
        const currentPrice=Number(active?.packages?.base_price||0)
        if(!active?.package_id)return res.status(400).json({message:'No current package found. Choose a package purchase instead.'})
        if(item.id===active.package_id)return res.status(409).json({message:'You already have this package.'})
        if(packagePrice<=currentPrice)return res.status(400).json({message:'Upgrade must be to a higher-priced package.'})
        upgradeFromPackageId=active.package_id;amount=packagePrice-currentPrice
      }else amount=packagePrice
    }else if(p.data.kind==='course'){
      const {data,error}=await supabaseAdmin.from('courses').select('id,title,price').eq('id',p.data.id).eq('status','published').single();if(error||!data)return res.status(404).json({message:'Course not found'});item=data;amount=Number(data.price);title=data.title
    }else if(p.data.kind==='masterclass'){
      const {data,error}=await supabaseAdmin.from('masterclasses').select('id,title,price').eq('id',p.data.id).eq('status','published').single();if(error||!data)return res.status(404).json({message:'Masterclass not found'});item=data;amount=Number(data.price);title=data.title
    }else{
      const {data,error}=await supabaseAdmin.from('workshops').select('id,title,price').eq('id',p.data.id).eq('status','published').single();if(error||!data)return res.status(404).json({message:'Workshop not found'});item=data;amount=Number(data.price);title=data.title
    }
    if(!Number.isFinite(amount)||amount<1)return res.status(400).json({message:'This item is not currently payable'})
    let referralCode=null
    if(req.profile.referred_by){const {data:partner}=await supabaseAdmin.from('profiles').select('referral_code').eq('id',req.profile.referred_by).eq('role','partner').single();referralCode=partner?.referral_code||null}
    const insert={buyer_id:req.user.id,amount,currency:'INR',status:'pending',referral_code:referralCode,order_purpose:p.data.purpose,registration_fee:registrationFee,package_price:packagePrice,upgrade_from_package_id:upgradeFromPackageId,[`${p.data.kind}_id`]:item.id}
    const {data:local,error:oe}=await supabaseAdmin.from('orders').insert(insert).select().single();if(oe)return res.status(400).json({message:'Unable to create local order'})
    const gateway=await razorpayRequest('/orders',{method:'POST',body:JSON.stringify({amount:Math.round(amount*100),currency:'INR',receipt:`SL-${local.id.slice(0,12)}`,notes:{skilllink_order_id:local.id,item_type:p.data.kind,item_title:title,order_purpose:p.data.purpose}})})
    await supabaseAdmin.from('payments').insert({order_id:local.id,provider:'razorpay',provider_order_id:gateway.id,provider_payment_id:gateway.id,amount,status:'pending',raw_status:'created'})
    res.status(201).json({orderId:local.id,razorpayOrderId:gateway.id,keyId:paymentEnv.keyId,amount:Math.round(amount*100),currency:'INR',title,registrationFee,packagePrice,upgradeFromPackageId})
  }catch(e){res.status(502).json({message:e.message||'Unable to start payment'})}
})

app.get('/api/my/package-options',auth,profile,requireStudent,async(req,res)=>{
  const {data:packages,error}=await supabaseAdmin.from('packages').select('id,name,subtitle,base_price,is_active,is_featured').eq('is_active',true).order('base_price')
  if(error)return res.status(500).json({message:'Unable to load packages'})
  const {data:active}=await supabaseAdmin.from('enrollments').select('package_id,packages(id,name,base_price)').eq('student_id',req.user.id).eq('status','active').not('package_id','is',null).order('created_at',{ascending:false}).limit(1).maybeSingle()
  const current=active?.packages||null
  res.json({registrationFee:99,registrationPaid:Number(req.profile.registration_fee_paid||0)>0,currentPackage:current,packages:packages||[]})
})
app.post('/api/payments/verify',auth,profile,async(req,res)=>{
  const p=z.object({skilllinkOrderId:z.string().uuid(),razorpayOrderId:z.string().min(5),razorpayPaymentId:z.string().min(5),razorpaySignature:z.string().min(10)}).safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid payment verification data'})
  const {data:order,error:oe}=await supabaseAdmin.from('orders').select('*').eq('id',p.data.skilllinkOrderId).eq('buyer_id',req.user.id).single();if(oe||!order)return res.status(404).json({message:'Order not found'})
  const {data:payment,error:pe}=await supabaseAdmin.from('payments').select('*').eq('order_id',order.id).single();if(pe||!payment)return res.status(404).json({message:'Payment record not found'})
  if(payment.provider_order_id!==p.data.razorpayOrderId)return res.status(400).json({message:'Gateway order mismatch'})
  const expected=crypto.createHmac('sha256',paymentEnv.keySecret).update(`${p.data.razorpayOrderId}|${p.data.razorpayPaymentId}`).digest('hex')
  const receivedSig=Buffer.from(p.data.razorpaySignature);const expectedSig=Buffer.from(expected);if(receivedSig.length!==expectedSig.length||!crypto.timingSafeEqual(expectedSig,receivedSig))return res.status(400).json({message:'Payment signature verification failed'})
  try{
    const remote=await razorpayRequest(`/payments/${encodeURIComponent(p.data.razorpayPaymentId)}`)
    if(remote.order_id!==p.data.razorpayOrderId)return res.status(400).json({message:'Gateway payment order mismatch'})
    if(Number(remote.amount)!==Math.round(Number(order.amount)*100))return res.status(400).json({message:'Payment amount mismatch'})
    if(remote.status!=='captured')return res.status(400).json({message:`Payment is ${remote.status}, not captured`})
    const fulfilled=await fulfillPaidOrder(order.id,p.data.razorpayPaymentId)
    await audit(req,'payment.verified','payment',payment.id,{order_id:order.id,provider:'razorpay'})
    res.json({ok:true,order:fulfilled})
  }catch(e){res.status(502).json({message:e.message||'Payment verification failed'})}
})

app.post('/api/payments/webhook',async(req,res)=>{
  if(!paymentEnv.webhookSecret)return res.status(503).json({message:'Webhook secret not configured'})
  const signature=req.headers['x-razorpay-signature']||''
  const expected=crypto.createHmac('sha256',paymentEnv.webhookSecret).update(req.rawBody||Buffer.from('')).digest('hex')
  const sigBuf=Buffer.from(String(signature));const expBuf=Buffer.from(expected);if(!signature||sigBuf.length!==expBuf.length||!crypto.timingSafeEqual(expBuf,sigBuf))return res.status(400).json({message:'Invalid webhook signature'})
  const event=req.body?.event;const payload=req.body?.payload||{}
  try{
    if(event==='payment.captured'||event==='order.paid'){
      const paymentEntity=payload.payment?.entity;const orderEntity=payload.order?.entity
      const gatewayOrderId=paymentEntity?.order_id||orderEntity?.id
      if(gatewayOrderId){const {data:pay}=await supabaseAdmin.from('payments').select('order_id').eq('provider_order_id',gatewayOrderId).single();if(pay)await fulfillPaidOrder(pay.order_id,paymentEntity?.id||null)}
    }else if(event==='payment.failed'){
      const gatewayOrderId=payload.payment?.entity?.order_id
      if(gatewayOrderId){const {data:pay}=await supabaseAdmin.from('payments').select('order_id').eq('provider_order_id',gatewayOrderId).single();if(pay){await supabaseAdmin.from('payments').update({status:'failed'}).eq('order_id',pay.order_id);await supabaseAdmin.from('orders').update({status:'failed'}).eq('id',pay.order_id).neq('status','paid')}}
    }else if(event==='refund.processed'){
      const gatewayPaymentId=payload.refund?.entity?.payment_id
      if(gatewayPaymentId){const {data:pay}=await supabaseAdmin.from('payments').select('order_id').eq('provider_payment_id',gatewayPaymentId).single();if(pay){await supabaseAdmin.from('payments').update({status:'refunded'}).eq('order_id',pay.order_id);await supabaseAdmin.from('orders').update({status:'refunded'}).eq('id',pay.order_id)}}
    }
    res.json({ok:true})
  }catch(e){res.status(500).json({message:'Webhook processing failed'})}
})

app.get('/api/courses',async(_req,res)=>{
  const {data,error}=await supabaseAdmin.from('courses').select('id,title,slug,description,status,price,thumbnail_url,instructor_id').eq('status','published').order('created_at',{ascending:false})
  if(error)return res.status(500).json({message:'Unable to load courses'});res.json({courses:data||[]})
})
app.get('/api/me',auth,profile,(req,res)=>res.json({profile:req.profile,user:{id:req.user.id,email:req.user.email}}))

app.get('/api/referrals/me',auth,profile,async(req,res)=>{
  const {data:commissions}=await supabaseAdmin.from('commissions').select('amount,status').eq('partner_id',req.user.id).neq('status','reversed')
  const {count:referralCount}=await supabaseAdmin.from('referrals').select('id',{count:'exact',head:true}).eq('partner_id',req.user.id).not('referred_user_id','is',null)
  const {data:refs}=await supabaseAdmin.from('referrals').select('order_id').eq('partner_id',req.user.id).not('order_id','is',null)
  const ids=(refs||[]).map(x=>x.order_id).filter(Boolean);let successfulPurchases=0
  if(ids.length){const {count}=await supabaseAdmin.from('orders').select('id',{count:'exact',head:true}).in('id',ids).eq('status','paid');successfulPurchases=count||0}
  const total=(commissions||[]).reduce((s,x)=>s+Number(x.amount||0),0)
  const base=process.env.PUBLIC_APP_URL||process.env.CORS_ORIGIN||''
  res.json({referralCode:req.profile.referral_code,referralLink:base?`${base.replace(/\/$/,'')}/signup?ref=${encodeURIComponent(req.profile.referral_code||'')}`:`/signup?ref=${encodeURIComponent(req.profile.referral_code||'')}`,isPartner:req.profile.role==='partner',referralCount:referralCount||0,successfulPurchases,commissionTotal:total})
})


app.get('/api/my/orders',auth,profile,async(req,res)=>{const {data,error}=await supabaseAdmin.from('orders').select('id,amount,currency,status,package_id,course_id,masterclass_id,workshop_id,created_at').eq('buyer_id',req.user.id).order('created_at',{ascending:false}).limit(100);if(error)return res.status(500).json({message:'Unable to load your orders'});res.json({orders:data||[]})})
app.get('/api/partner/withdrawals',auth,profile,async(req,res)=>{if(req.profile.role!=='partner')return res.status(403).json({message:'Partner permission required'});const {data,error}=await supabaseAdmin.from('withdrawals').select('*').eq('partner_id',req.user.id).order('created_at',{ascending:false});if(error)return res.status(500).json({message:'Unable to load withdrawals'});res.json({withdrawals:data||[]})})
app.post('/api/partner/withdrawals',auth,profile,async(req,res)=>{
  if(req.profile.role!=='partner')return res.status(403).json({message:'Partner permission required'})
  const p=z.object({amount:z.number().positive().max(10000000)}).safeParse(req.body);if(!p.success)return res.status(400).json({message:'Enter a valid withdrawal amount'})
  const {data:commissions}=await supabaseAdmin.from('commissions').select('amount').eq('partner_id',req.user.id).eq('status','available');const earned=(commissions||[]).reduce((s,x)=>s+Number(x.amount||0),0)
  const {data:pending}=await supabaseAdmin.from('withdrawals').select('amount').eq('partner_id',req.user.id).in('status',['pending','approved']);const reserved=(pending||[]).reduce((s,x)=>s+Number(x.amount||0),0)
  const available=Math.max(0,earned-reserved);if(p.data.amount<100)return res.status(400).json({message:'Minimum withdrawal is ₹100'});if(p.data.amount>available)return res.status(400).json({message:`Insufficient available earnings. Available: ₹${available.toFixed(2)}`})
  const {data,error}=await supabaseAdmin.from('withdrawals').insert({partner_id:req.user.id,amount:p.data.amount,status:'pending'}).select().single();if(error)return res.status(400).json({message:'Withdrawal request failed'});await audit(req,'withdrawal.requested','withdrawal',data.id,{amount:p.data.amount});res.status(201).json({withdrawal:data,available_after:Number((available-p.data.amount).toFixed(2))})
})

// ROLE DASHBOARDS
app.get('/api/dashboard',auth,profile,async(req,res)=>{
  const role=req.profile.role
  if(role==='student'){
    const [{data:enrollments,error:e1},{data:orders,error:e2},{data:active,error:e3}]=await Promise.all([
      supabaseAdmin.from('enrollments').select('id,status,progress,course_id,package_id,created_at,courses(id,title,price),packages(id,name,base_price)').eq('student_id',req.user.id).order('created_at',{ascending:false}).limit(100),
      supabaseAdmin.from('orders').select('id,amount,currency,status,order_purpose,package_id,course_id,created_at').eq('buyer_id',req.user.id).order('created_at',{ascending:false}).limit(100),
      supabaseAdmin.from('enrollments').select('package_id,packages(id,name,base_price)').eq('student_id',req.user.id).eq('status','active').not('package_id','is',null).order('created_at',{ascending:false}).limit(1).maybeSingle()
    ])
    if(e1||e2||e3)return res.status(500).json({message:'Unable to load student dashboard'})
    return res.json({role,profile:req.profile,enrollments:enrollments||[],orders:orders||[],currentPackage:active?.packages||null})
  }
  if(role==='partner'){
    const [{data:commissions,error:e1},{data:ledger,error:e2},{data:withdrawals,error:e3},{count:referralCount,error:e4}]=await Promise.all([
      supabaseAdmin.from('commissions').select('id,order_id,amount,status,created_at').eq('partner_id',req.user.id).order('created_at',{ascending:false}).limit(100),
      supabaseAdmin.from('earnings_ledger').select('id,type,amount,reference_id,description,created_at').eq('partner_id',req.user.id).order('created_at',{ascending:false}).limit(100),
      supabaseAdmin.from('withdrawals').select('id,amount,status,reviewed_at,note,created_at').eq('partner_id',req.user.id).order('created_at',{ascending:false}).limit(100),
      supabaseAdmin.from('referrals').select('id',{count:'exact',head:true}).eq('partner_id',req.user.id).not('referred_user_id','is',null)
    ])
    if(e1||e2||e3||e4)return res.status(500).json({message:'Unable to load partner dashboard'})
    const earned=(commissions||[]).filter(x=>x.status==='available').reduce((s,x)=>s+Number(x.amount||0),0)
    const reserved=(withdrawals||[]).filter(x=>['pending','approved'].includes(x.status)).reduce((s,x)=>s+Number(x.amount||0),0)
    return res.json({role,profile:req.profile,referralCount:referralCount||0,commissions:commissions||[],ledger:ledger||[],withdrawals:withdrawals||[],availableEarnings:Math.max(0,earned-reserved)})
  }
  if(role==='instructor'){
    const [{data:courses,error:e1},{data:masterclasses,error:e2},{data:workshops,error:e3}]=await Promise.all([
      supabaseAdmin.from('courses').select('id,title,price,status,created_at').eq('instructor_id',req.user.id).order('created_at',{ascending:false}),
      supabaseAdmin.from('masterclasses').select('id,title,price,status,scheduled_at,seats').eq('instructor_id',req.user.id).order('created_at',{ascending:false}),
      supabaseAdmin.from('workshops').select('id,title,price,status,scheduled_at,seats').eq('instructor_id',req.user.id).order('created_at',{ascending:false})
    ])
    if(e1||e2||e3)return res.status(500).json({message:'Unable to load instructor dashboard'})
    return res.json({role,profile:req.profile,courses:courses||[],masterclasses:masterclasses||[],workshops:workshops||[]})
  }
  if(role==='admin'){
    const [{count:usersCount,error:e1},{count:coursesCount,error:e2},{count:ordersCount,error:e3},{count:withdrawalsCount,error:e4}]=await Promise.all([
      supabaseAdmin.from('profiles').select('id',{count:'exact',head:true}),
      supabaseAdmin.from('courses').select('id',{count:'exact',head:true}),
      supabaseAdmin.from('orders').select('id',{count:'exact',head:true}),
      supabaseAdmin.from('withdrawals').select('id',{count:'exact',head:true})
    ])
    if(e1||e2||e3||e4)return res.status(500).json({message:'Unable to load admin dashboard'})
    return res.json({role,profile:req.profile,counts:{users:usersCount||0,courses:coursesCount||0,orders:ordersCount||0,withdrawals:withdrawalsCount||0}})
  }
  if(role==='ceo')return res.json({role,profile:req.profile,redirect:'/ceo'})
  return res.status(403).json({message:'Unsupported account role'})
})

app.get('/api/admin/users',auth,profile,requireAdmin,withPermission('users.view'),async(_req,res)=>{const {data,error}=await supabaseAdmin.from('profiles').select('id,full_name,role,status,referral_code,referred_by,created_at').order('created_at',{ascending:false}).limit(500);if(error)return res.status(500).json({message:'Unable to load users'});res.json({users:data||[]})})
app.get('/api/admin/payments',auth,profile,requireAdmin,withPermission('payments.view'),async(_req,res)=>{const {data,error}=await supabaseAdmin.from('payments').select('id,order_id,provider,provider_payment_id,amount,status,verified_at,created_at').order('created_at',{ascending:false}).limit(500);if(error)return res.status(500).json({message:'Unable to load payments'});res.json({payments:data||[]})})
app.get('/api/admin/withdrawals',auth,profile,requireAdmin,withPermission('withdrawals.view'),async(_req,res)=>{const {data,error}=await supabaseAdmin.from('withdrawals').select('id,partner_id,amount,status,reviewed_by,reviewed_at,note,created_at').order('created_at',{ascending:false}).limit(500);if(error)return res.status(500).json({message:'Unable to load withdrawals'});res.json({withdrawals:data||[]})})

// CEO CONTROL CENTER
app.get('/api/ceo/overview',auth,profile,requireCEO,async(req,res)=>{
  const tables=['profiles','courses','packages','masterclasses','workshops','orders','withdrawals','support_tickets','reviews']
  const counts={}
  for(const t of tables){const {count,error}=await supabaseAdmin.from(t).select('id',{count:'exact',head:true});if(error)return res.status(500).json({message:`Unable to read ${t}`});counts[t]=count||0}
  const {data:paid}=await supabaseAdmin.from('orders').select('amount').eq('status','paid');const revenue=(paid||[]).reduce((s,x)=>s+Number(x.amount||0),0)
  const {data:pendingWithdrawals}=await supabaseAdmin.from('withdrawals').select('id,amount,partner_id,status,created_at').eq('status','pending').order('created_at',{ascending:false}).limit(20)
  const {data:recentAudit}=await supabaseAdmin.from('audit_logs').select('id,action,entity_type,entity_id,created_at,metadata').order('created_at',{ascending:false}).limit(20)
  res.json({counts,revenue,pendingWithdrawals:pendingWithdrawals||[],recentAudit:recentAudit||[]})
})

app.get('/api/ceo/users',auth,profile,requireCEO,async(req,res)=>{
  const {data,error}=await supabaseAdmin.from('profiles').select('id,full_name,role,status,referral_code,referred_by,created_at').order('created_at',{ascending:false}).limit(500)
  if(error)return res.status(500).json({message:'Unable to load users'});res.json({users:data||[]})
})
app.patch('/api/ceo/users/:id',auth,profile,requireCEO,async(req,res)=>{
  const schema=z.object({role:z.enum(['ceo','admin','partner','instructor','student']).optional(),status:z.enum(['active','pending','suspended','disabled']).optional(),full_name:z.string().trim().min(1).max(160).optional()}).refine(x=>Object.keys(x).length>0)
  const p=schema.safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid user update'})
  if(req.params.id===req.user.id && p.data.role && p.data.role!=='ceo')return res.status(400).json({message:'CEO cannot remove their own CEO role'})
  const {data,error}=await supabaseAdmin.from('profiles').update(p.data).eq('id',req.params.id).select().single()
  if(error)return res.status(400).json({message:'User update failed'});await audit(req,'user.updated','profile',data.id,p.data);res.json({user:data})
})

const packageSchema=z.object({name:z.string().trim().min(2).max(80),subtitle:z.string().trim().min(2).max(160),description:z.string().max(5000).default(''),base_price:z.number().min(0).max(10000000),partner_commission:z.number().min(0).max(10000000).optional(),access_days:z.number().int().positive().nullable().optional(),is_active:z.boolean().optional(),is_featured:z.boolean().optional()})
app.get('/api/ceo/packages',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('packages').select('*').order('base_price');if(error)return res.status(500).json({message:'Unable to load packages'});res.json({packages:data||[]})})
app.patch('/api/ceo/packages/:id',auth,profile,requireCEO,async(req,res)=>{const p=packageSchema.partial().safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid package data'});const {data,error}=await supabaseAdmin.from('packages').update({...p.data,updated_at:new Date().toISOString()}).eq('id',req.params.id).select().single();if(error)return res.status(400).json({message:'Package update failed'});await audit(req,'package.updated','package',data.id,p.data);res.json({package:data})})

app.get('/api/ceo/courses',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('courses').select('*').order('created_at',{ascending:false}).limit(500);if(error)return res.status(500).json({message:'Unable to load courses'});res.json({courses:data||[]})})
app.patch('/api/ceo/courses/:id',auth,profile,requireCEO,async(req,res)=>{const p=z.object({title:z.string().trim().min(3).max(160).optional(),description:z.string().max(5000).optional(),price:z.number().min(0).max(10000000).optional(),status:z.enum(['draft','pending_review','published','rejected','archived']).optional(),thumbnail_url:z.string().url().nullable().optional()}).partial().safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid course update'});const {data,error}=await supabaseAdmin.from('courses').update({...p.data,updated_at:new Date().toISOString()}).eq('id',req.params.id).select().single();if(error)return res.status(400).json({message:'Course update failed'});await audit(req,'course.updated','course',data.id,p.data);res.json({course:data})})

app.get('/api/ceo/masterclasses',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('masterclasses').select('*').order('created_at',{ascending:false});if(error)return res.status(500).json({message:'Unable to load masterclasses'});res.json({masterclasses:data||[]})})
app.get('/api/ceo/workshops',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('workshops').select('*').order('created_at',{ascending:false});if(error)return res.status(500).json({message:'Unable to load workshops'});res.json({workshops:data||[]})})
app.get('/api/ceo/orders',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('orders').select('*').order('created_at',{ascending:false}).limit(500);if(error)return res.status(500).json({message:'Unable to load orders'});res.json({orders:data||[]})})
app.get('/api/ceo/payments',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('payments').select('*').order('created_at',{ascending:false}).limit(500);if(error)return res.status(500).json({message:'Unable to load payments'});res.json({payments:data||[]})})

app.get('/api/ceo/withdrawals',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('withdrawals').select('*').order('created_at',{ascending:false}).limit(500);if(error)return res.status(500).json({message:'Unable to load withdrawals'});res.json({withdrawals:data||[]})})
app.patch('/api/ceo/withdrawals/:id',auth,profile,requireCEO,async(req,res)=>{const p=z.object({status:z.enum(['approved','rejected']),note:z.string().max(1000).optional()}).safeParse(req.body);if(!p.success)return res.status(400).json({message:'Status must be approved or rejected'});const {data:old,error:oe}=await supabaseAdmin.from('withdrawals').select('*').eq('id',req.params.id).single();if(oe||!old)return res.status(404).json({message:'Withdrawal not found'});if(old.status!=='pending')return res.status(409).json({message:'Withdrawal already reviewed'});const {data,error}=await supabaseAdmin.from('withdrawals').update({status:p.data.status,reviewed_by:req.user.id,reviewed_at:new Date().toISOString(),note:p.data.note||null}).eq('id',old.id).eq('status','pending').select().single();if(error)return res.status(400).json({message:'Withdrawal review failed'});await audit(req,`withdrawal.${p.data.status}`,'withdrawal',data.id,{amount:old.amount,note:p.data.note||null});res.json({withdrawal:data})})

app.get('/api/ceo/referrals',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('referrals').select('*').order('created_at',{ascending:false}).limit(500);if(error)return res.status(500).json({message:'Unable to load referrals'});res.json({referrals:data||[]})})
app.get('/api/ceo/commissions',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('commissions').select('*').order('created_at',{ascending:false}).limit(500);if(error)return res.status(500).json({message:'Unable to load commissions'});res.json({commissions:data||[]})})
app.get('/api/ceo/ledger',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('earnings_ledger').select('*').order('created_at',{ascending:false}).limit(500);if(error)return res.status(500).json({message:'Unable to load earnings ledger'});res.json({ledger:data||[]})})

app.get('/api/ceo/levels',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('level_rules').select('*').order('level');if(error)return res.status(500).json({message:'Unable to load level rules'});res.json({levels:data||[]})})
app.patch('/api/ceo/levels/:level',auth,profile,requireCEO,async(req,res)=>{const p=z.object({points_required:z.number().int().min(0),referral_required:z.number().int().min(0),skill_mastery_required:z.boolean()}).safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid level rule'});const {data,error}=await supabaseAdmin.from('level_rules').update({...p.data,updated_at:new Date().toISOString()}).eq('level',Number(req.params.level)).select().single();if(error)return res.status(400).json({message:'Level rule update failed'});await audit(req,'level_rule.updated','level_rule',null,{level:Number(req.params.level),...p.data});res.json({level:data})})

app.get('/api/ceo/reviews',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('reviews').select('*').order('created_at',{ascending:false}).limit(500);if(error)return res.status(500).json({message:'Unable to load reviews'});res.json({reviews:data||[]})})
app.patch('/api/ceo/reviews/:id',auth,profile,requireCEO,async(req,res)=>{const p=z.object({status:z.enum(['pending','approved','rejected'])}).safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid review status'});const {data,error}=await supabaseAdmin.from('reviews').update({status:p.data.status}).eq('id',req.params.id).select().single();if(error)return res.status(400).json({message:'Review update failed'});await audit(req,'review.moderated','review',data.id,p.data);res.json({review:data})})

app.get('/api/ceo/rewards',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('reward_rules').select('*').order('level');if(error)return res.status(500).json({message:'Unable to load rewards'});res.json({rewards:data||[]})})
app.patch('/api/ceo/rewards/:level',auth,profile,requireCEO,async(req,res)=>{const p=z.object({reward_name:z.string().trim().min(2).max(160).optional(),description:z.string().max(3000).optional(),image_url:z.string().url().nullable().optional(),eligibility:z.record(z.any()).optional(),is_active:z.boolean().optional()}).partial().safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid reward data'});const {data,error}=await supabaseAdmin.from('reward_rules').update({...p.data,updated_at:new Date().toISOString()}).eq('level',Number(req.params.level)).select().single();if(error)return res.status(400).json({message:'Reward update failed'});await audit(req,'reward.updated','reward_rule',data.id,p.data);res.json({reward:data})})
app.get('/api/ceo/admin-permissions',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('admin_permissions').select('*').order('created_at',{ascending:false});if(error)return res.status(500).json({message:'Unable to load admin permissions'});res.json({permissions:data||[]})})
app.put('/api/ceo/admin-permissions/:adminId',auth,profile,requireCEO,async(req,res)=>{const p=z.object({permissions:z.array(z.string().min(1).max(120)).max(100)}).safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid permissions'});const {error:delError}=await supabaseAdmin.from('admin_permissions').delete().eq('admin_id',req.params.adminId);if(delError)return res.status(400).json({message:'Unable to replace permissions'});if(p.data.permissions.length){const rows=p.data.permissions.map(permission_key=>({admin_id:req.params.adminId,permission_key,granted_by:req.user.id}));const {error}=await supabaseAdmin.from('admin_permissions').insert(rows);if(error)return res.status(400).json({message:'Unable to save permissions'})}await audit(req,'admin_permissions.updated','profile',req.params.adminId,{permissions:p.data.permissions});res.json({adminId:req.params.adminId,permissions:p.data.permissions})})
app.get('/api/ceo/settings',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('platform_settings').select('*').order('key');if(error)return res.status(500).json({message:'Unable to load platform settings'});res.json({settings:data||[]})})
app.put('/api/ceo/settings/:key',auth,profile,requireCEO,async(req,res)=>{const p=z.object({value:z.any()}).safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid setting'});const {data,error}=await supabaseAdmin.from('platform_settings').upsert({key:req.params.key,value:p.data.value,updated_by:req.user.id,updated_at:new Date().toISOString()}).select().single();if(error)return res.status(400).json({message:'Setting update failed'});await audit(req,'platform_setting.updated','platform_setting',null,{key:req.params.key});res.json({setting:data})})
app.get('/api/ceo/coupons',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('coupons').select('*').order('created_at',{ascending:false});if(error)return res.status(500).json({message:'Unable to load coupons'});res.json({coupons:data||[]})})
app.post('/api/ceo/coupons',auth,profile,requireCEO,async(req,res)=>{const p=z.object({code:z.string().trim().toUpperCase().min(3).max(40),discount_type:z.enum(['percent','fixed']),discount_value:z.number().positive(),max_uses:z.number().int().positive().nullable().optional(),starts_at:z.string().datetime().nullable().optional(),expires_at:z.string().datetime().nullable().optional(),is_active:z.boolean().default(true)}).safeParse(req.body);if(!p.success)return res.status(400).json({message:'Invalid coupon'});if(p.data.discount_type==='percent'&&p.data.discount_value>100)return res.status(400).json({message:'Percent discount cannot exceed 100'});const {data,error}=await supabaseAdmin.from('coupons').insert(p.data).select().single();if(error)return res.status(400).json({message:'Coupon could not be created'});await audit(req,'coupon.created','coupon',data.id,{code:data.code});res.status(201).json({coupon:data})})

app.get('/api/ceo/audit-logs',auth,profile,requireCEO,async(_req,res)=>{const {data,error}=await supabaseAdmin.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(500);if(error)return res.status(500).json({message:'Unable to load audit logs'});res.json({logs:data||[]})})

app.post('/api/instructor/courses',auth,profile,async(req,res)=>{if(!['instructor','ceo'].includes(req.profile.role))return res.status(403).json({message:'Permission denied'});const parsed=z.object({title:z.string().trim().min(3).max(160),description:z.string().max(5000).optional(),price:z.number().min(0).max(10000000)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Invalid course data'});const slug=parsed.data.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+Date.now();const {data,error}=await supabaseAdmin.from('courses').insert({...parsed.data,slug,instructor_id:req.user.id,status:'draft'}).select().single();if(error)return res.status(400).json({message:'Course could not be created'});await audit(req,'course.created','course',data.id,{status:'draft'});res.status(201).json({course:data})})

app.use('/api',(req,res)=>res.status(404).json({message:'API route not found'}))
app.use((err,_req,res,_next)=>{console.error(err);if(res.headersSent)return;res.status(500).json({message:process.env.NODE_ENV==='production'?'Internal server error':(err.message||'Internal server error')})})
app.listen(port,()=>console.log(`SkillLink API listening on ${port}`))
