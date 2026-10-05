import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import crypto from 'node:crypto'

const app = express()
const port = Number(process.env.PORT || 4000)

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/* -----------------------------
   SECURITY / HTTP
------------------------------ */

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(helmet())

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean)

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error('CORS origin not allowed'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}))

app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => {
    req.rawBody = Buffer.from(buf)
  }
}))

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
}))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
})

/* -----------------------------
   HELPERS
------------------------------ */

const asyncRoute = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

const nowIso = () => new Date().toISOString()

function normalizePackage(pkg) {
  if (!pkg) return pkg
  return {
    ...pkg,
    subtitle: pkg.subtitle ?? null,
    base_price: pkg.price,
    is_active: pkg.active,
    is_featured: pkg.featured
  }
}

function normalizePackages(list) {
  return (list || []).map(normalizePackage)
}

function errorMessage(error, fallback) {
  return error?.message || fallback
}

function isUuid(value) {
  return z.string().uuid().safeParse(value).success
}

async function hasPaidRegistration(userId) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .eq('order_type', 'package')
    .eq('status', 'paid')
    .limit(1)

  if (error) throw error
  return Boolean(data?.length)
}

async function audit(req, action, entityType, entityId = null, metadata = {}) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: req.user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata
    })
  } catch (error) {
    console.error('AUDIT_LOG_ERROR:', error.message)
  }
}

/* -----------------------------
   AUTHORIZATION
------------------------------ */

async function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data?.user) {
    return res.status(401).json({ message: 'Invalid or expired session' })
  }

  req.user = data.user
  next()
}

async function profile(req, res, next) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select([
      'id',
      'username',
      'full_name',
      'phone',
      'avatar_url',
      'role',
      'status',
      'referral_code',
      'referred_by',
      'created_at',
      'updated_at'
    ].join(','))
    .eq('id', req.user.id)
    .single()

  if (error || !data) {
    return res.status(403).json({ message: 'Profile not found' })
  }

  if (data.status !== 'active') {
    return res.status(403).json({ message: 'Active profile required' })
  }

  req.profile = data
  next()
}

const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.profile.role)) {
    return res.status(403).json({ message: 'Access denied for this role' })
  }
  next()
}

const requireCEO = allowRoles('ceo')
const requireAdmin = allowRoles('admin', 'ceo')
const requirePartner = allowRoles('partner')
const requireInstructor = allowRoles('instructor')
const requireStudent = allowRoles('student')

/* -----------------------------
   HEALTH
------------------------------ */

app.get('/api/health', asyncRoute(async (_req, res) => {
  const { error } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true })

  if (error) {
    return res.status(503).json({
      ok: false,
      service: 'skilllink-api',
      database: 'unavailable'
    })
  }

  res.json({
    ok: true,
    service: 'skilllink-api',
    database: 'connected'
  })
}))

/* -----------------------------
   CURRENT USER
------------------------------ */

app.get('/api/me', auth, profile, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email || null
    },
    profile: req.profile
  })
})

/* -----------------------------
   PAYMENT CONFIG
------------------------------ */

const paymentEnv = {
  keyId: process.env.RAZORPAY_KEY_ID || '',
  keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || ''
}

function razorpayConfigured() {
  return Boolean(paymentEnv.keyId && paymentEnv.keySecret)
}

async function razorpayRequest(path, options = {}) {
  if (!razorpayConfigured()) {
    throw new Error('Payment gateway is not configured on the server')
  }

  const basic = Buffer
    .from(`${paymentEnv.keyId}:${paymentEnv.keySecret}`)
    .toString('base64')

  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basic}`,
      ...(options.headers || {})
    }
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data?.error?.description || 'Payment gateway request failed'
    )
  }

  return data
}

/* -----------------------------
   PAYMENT FULFILMENT
   Single server-side source of truth.
------------------------------ */

async function fulfillPaidOrder(orderId, razorpayPaymentId = null) {
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw new Error('Order not found')
  }

  if (order.status === 'paid') {
    return order
  }

  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', order.id)
    .neq('status', 'paid')
    .select()
    .single()

  if (updateError || !updatedOrder) {
    throw new Error('Unable to mark order paid')
  }

  if (updatedOrder.course_id) {
    const { data: existing } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('user_id', updatedOrder.user_id)
      .eq('course_id', updatedOrder.course_id)
      .eq('status', 'active')
      .limit(1)

    if (!existing?.length) {
      await supabaseAdmin.from('enrollments').insert({
        user_id: updatedOrder.user_id,
        course_id: updatedOrder.course_id,
        order_id: updatedOrder.id,
        status: 'active',
        progress: 0
      })
    }
  }

  if (updatedOrder.package_id) {
    await supabaseAdmin
      .from('enrollments')
      .update({ status: 'cancelled' })
      .eq('user_id', updatedOrder.user_id)
      .eq('status', 'active')
      .not('package_id', 'is', null)

    const { data: existingPackage } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('user_id', updatedOrder.user_id)
      .eq('package_id', updatedOrder.package_id)
      .eq('status', 'active')
      .limit(1)

    if (!existingPackage?.length) {
      await supabaseAdmin.from('enrollments').insert({
        user_id: updatedOrder.user_id,
        package_id: updatedOrder.package_id,
        order_id: updatedOrder.id,
        status: 'active',
        progress: 0
      })
    }

    // Registration status is derived from paid registration orders.
    // The current profiles schema does not store payment status.
    // Orders remain the single source of truth for payment state.
  }

  /* Commission is created only after verified payment. */
  const { data: buyerProfile } = await supabaseAdmin
    .from('profiles')
    .select('referred_by')
    .eq('id', updatedOrder.user_id)
    .maybeSingle()

  if (buyerProfile?.referred_by && updatedOrder.package_id) {
    const partnerId = buyerProfile.referred_by
    const { data: pkg } = await supabaseAdmin
      .from('packages')
      .select('price')
      .eq('id', updatedOrder.package_id)
      .single()

    const commission = Number(pkg?.price || 0) * 0.40

    if (commission > 0) {
      const { data: existingCommission } = await supabaseAdmin
        .from('commissions')
        .select('id')
        .eq('partner_id', partnerId)
        .eq('order_id', updatedOrder.id)
        .limit(1)

      if (!existingCommission?.length) {
        await supabaseAdmin.from('commissions').insert({
          partner_id: partnerId,
          referred_user_id: updatedOrder.user_id,
          order_id: updatedOrder.id,
          package_id: updatedOrder.package_id,
          amount: commission,
          status: 'available',
          available_at: nowIso()
        })

        const { data: lastLedger } = await supabaseAdmin
          .from('earnings_ledger')
          .select('balance_after')
          .eq('partner_id', partnerId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        await supabaseAdmin.from('earnings_ledger').insert({
          partner_id: partnerId,
          transaction_type: 'commission',
          amount: commission,
          balance_after: Number(lastLedger?.balance_after || 0) + commission,
          description: 'Verified referral commission'
        })
      }
    }
  }

  if (razorpayPaymentId) {
    await supabaseAdmin
      .from('payments')
      .update({
        provider_payment_id: razorpayPaymentId,
        status: 'verified',
        paid_at: nowIso()
      })
      .eq('order_id', updatedOrder.id)
  }

  return updatedOrder
}

/* -----------------------------
   REGISTRATION / CHECKOUT
   Only authenticated STUDENT can buy registration bundle.
------------------------------ */

const checkoutSchema = z.object({
  kind: z.enum(['package', 'course', 'masterclass', 'workshop']),
  id: z.string().uuid().optional(),
  name: z.string().trim().max(160).optional(),
  purpose: z.enum(['registration_bundle', 'purchase', 'upgrade']).default('purchase')
}).refine(value => value.id || value.name, {
  message: 'Item id or name is required'
})

app.post(
  '/api/payments/create-order',
  auth,
  profile,
  asyncRoute(async (req, res) => {
    if (!razorpayConfigured()) {
      return res.status(503).json({
        message: 'Payment gateway is not configured. Add Razorpay server keys in Render.'
      })
    }

    const parsed = checkoutSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid checkout request' })
    }

    const request = parsed.data

    if (request.purpose === 'registration_bundle') {
      if (req.profile.role !== 'student') {
        return res.status(403).json({
          message: 'Registration payment is available only to student accounts'
        })
      }

      if (request.kind !== 'package') {
        return res.status(400).json({
          message: 'Registration bundle must contain a package'
        })
      }

      const registrationPaid = await hasPaidRegistration(req.user.id)

      if (registrationPaid) {
        return res.status(409).json({
          message: 'Registration is already paid. Use package upgrade instead.'
        })
      }

      const { data: activePackage } = await supabaseAdmin
        .from('enrollments')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('status', 'active')
        .not('package_id', 'is', null)
        .limit(1)

      if (activePackage?.length) {
        return res.status(409).json({
          message: 'An active package already exists for this account.'
        })
      }
    }

    if (request.purpose === 'upgrade' && request.kind !== 'package') {
      return res.status(400).json({
        message: 'Upgrade is available for packages only'
      })
    }

    if (request.purpose === 'upgrade' && req.profile.role !== 'student') {
      return res.status(403).json({
        message: 'Package upgrades are available only to student accounts'
      })
    }

    try {
      let item = null
      let amount = 0
      let title = ''
      let packagePrice = 0
      let registrationFee = 0
      let upgradeFromPackageId = null

      if (request.kind === 'package') {
        let query = supabaseAdmin
          .from('packages')
          .select('id,name,price')
          .eq('active', true)

        if (request.id) {
          query = query.eq('id', request.id).single()
        } else {
          query = query.eq('name', request.name).single()
        }

        const { data, error } = await query

        if (error || !data) {
          return res.status(404).json({ message: 'Package not found' })
        }

        item = data
        packagePrice = Number(item.price)
        title = item.name

        if (request.purpose === 'registration_bundle') {
          registrationFee = 99
          amount = registrationFee + packagePrice
        } else if (request.purpose === 'upgrade') {
          const { data: active } = await supabaseAdmin
            .from('enrollments')
            .select('package_id,packages(id,name,price)')
            .eq('user_id', req.user.id)
            .eq('status', 'active')
            .not('package_id', 'is', null)
            .order('enrolled_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const currentPrice = Number(active?.packages?.price || 0)

          if (!active?.package_id) {
            return res.status(400).json({
              message: 'No current package found. Choose registration purchase.'
            })
          }

          if (item.id === active.package_id) {
            return res.status(409).json({
              message: 'You already have this package.'
            })
          }

          if (packagePrice <= currentPrice) {
            return res.status(400).json({
              message: 'Upgrade must be to a higher-priced package.'
            })
          }

          upgradeFromPackageId = active.package_id
          amount = packagePrice - currentPrice
        } else {
          amount = packagePrice
        }
      }

      if (request.kind === 'course') {
        const { data, error } = await supabaseAdmin
          .from('courses')
          .select('id,title,price')
          .eq('id', request.id)
          .eq('status', 'published')
          .single()

        if (error || !data) {
          return res.status(404).json({ message: 'Course not found' })
        }

        item = data
        amount = Number(data.price)
        title = data.title
      }

      if (request.kind === 'masterclass') {
        const { data, error } = await supabaseAdmin
          .from('masterclasses')
          .select('id,title,price')
          .eq('id', request.id)
          .eq('status', 'published')
          .single()

        if (error || !data) {
          return res.status(404).json({ message: 'Masterclass not found' })
        }

        item = data
        amount = Number(data.price)
        title = data.title
      }

      if (request.kind === 'workshop') {
        const { data, error } = await supabaseAdmin
          .from('workshops')
          .select('id,title,price')
          .eq('id', request.id)
          .eq('status', 'published')
          .single()

        if (error || !data) {
          return res.status(404).json({ message: 'Workshop not found' })
        }

        item = data
        amount = Number(data.price)
        title = data.title
      }

      if (!item || !Number.isFinite(amount) || amount < 1) {
        return res.status(400).json({
          message: 'This item is not currently payable'
        })
      }

      const insert = {
        user_id: req.user.id,
        amount,
        currency: 'INR',
        status: 'pending',
        order_type: request.kind,
        [`${request.kind}_id`]: item.id
      }

      const { data: localOrder, error: localError } = await supabaseAdmin
        .from('orders')
        .insert(insert)
        .select()
        .single()

      if (localError || !localOrder) {
        return res.status(400).json({
          message: 'Unable to create local order'
        })
      }

      const gatewayOrder = await razorpayRequest('/orders', {
        method: 'POST',
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency: 'INR',
          receipt: `SL-${localOrder.id.slice(0, 12)}`,
          notes: {
            skilllink_order_id: localOrder.id,
            item_type: request.kind,
            item_title: title,
            purpose: request.purpose
          }
        })
      })

      const { error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert({
          order_id: localOrder.id,
          provider: 'razorpay',
          provider_order_id: gatewayOrder.id,
          provider_payment_id: null,
          amount,
          status: 'pending',
          
        })

      if (paymentError) {
        await supabaseAdmin
          .from('orders')
          .update({ status: 'failed' })
          .eq('id', localOrder.id)
        throw new Error('Unable to create payment record')
      }

      await audit(
        req,
        'payment.order_created',
        'order',
        localOrder.id,
        {
          purpose: request.purpose,
          kind: request.kind,
          amount
        }
      )

      return res.status(201).json({
        orderId: localOrder.id,
        razorpayOrderId: gatewayOrder.id,
        keyId: paymentEnv.keyId,
        amount: Math.round(amount * 100),
        currency: 'INR',
        title,
        registrationFee,
        packagePrice,
        upgradeFromPackageId
      })
    } catch (error) {
      return res.status(502).json({
        message: errorMessage(error, 'Unable to start payment')
      })
    }
  })
)

/* Payment status for the current account. */
app.get(
  '/api/payments/registration-status',
  auth,
  profile,
  requireStudent,
  asyncRoute(async (req, res) => {
    const { data: paidRegistration } = await supabaseAdmin
      .from('orders')
      .select('id,status,amount,package_id,order_type,created_at')
      .eq('user_id', req.user.id)
      .eq('order_type', 'package')
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: activePackage } = await supabaseAdmin
      .from('enrollments')
      .select('package_id,packages(id,name,price)')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .not('package_id', 'is', null)
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const registrationPaid = Boolean(paidRegistration)

    res.json({
      accountCreated: true,
      registrationPaid,
      registrationOrder: paidRegistration || null,
      currentPackage: activePackage?.packages || null,
      canStartRegistrationPayment:
        !registrationPaid && !activePackage?.package_id
    })
  })
)

/* -----------------------------
   PAYMENT VERIFY / WEBHOOK
------------------------------ */

app.post(
  '/api/payments/verify',
  auth,
  profile,
  asyncRoute(async (req, res) => {
    if (!razorpayConfigured()) {
      return res.status(503).json({
        message: 'Payment gateway is not configured on the server'
      })
    }

    const parsed = z.object({
      skilllinkOrderId: z.string().uuid(),
      razorpayOrderId: z.string().min(5),
      razorpayPaymentId: z.string().min(5),
      razorpaySignature: z.string().min(10)
    }).safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid payment verification data'
      })
    }

    const p = parsed.data

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', p.skilllinkOrderId)
      .eq('user_id', req.user.id)
      .single()

    if (orderError || !order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('order_id', order.id)
      .single()

    if (paymentError || !payment) {
      return res.status(404).json({ message: 'Payment record not found' })
    }

    if (payment.provider_order_id !== p.razorpayOrderId) {
      return res.status(400).json({ message: 'Gateway order mismatch' })
    }

    const expectedSignature = crypto
      .createHmac('sha256', paymentEnv.keySecret)
      .update(`${p.razorpayOrderId}|${p.razorpayPaymentId}`)
      .digest('hex')

    const expectedBuffer = Buffer.from(expectedSignature)
    const receivedBuffer = Buffer.from(p.razorpaySignature)

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return res.status(400).json({
        message: 'Payment signature verification failed'
      })
    }

    try {
      const remotePayment = await razorpayRequest(
        `/payments/${encodeURIComponent(p.razorpayPaymentId)}`
      )

      if (remotePayment.order_id !== p.razorpayOrderId) {
        return res.status(400).json({
          message: 'Gateway payment order mismatch'
        })
      }

      if (Number(remotePayment.amount) !== Math.round(Number(order.amount) * 100)) {
        return res.status(400).json({
          message: 'Payment amount mismatch'
        })
      }

      if (remotePayment.status !== 'captured') {
        return res.status(400).json({
          message: `Payment is ${remotePayment.status}, not captured`
        })
      }

      const fulfilled = await fulfillPaidOrder(
        order.id,
        p.razorpayPaymentId
      )

      await audit(
        req,
        'payment.verified',
        'payment',
        payment.id,
        {
          order_id: order.id,
          provider: 'razorpay'
        }
      )

      return res.json({
        ok: true,
        order: fulfilled
      })
    } catch (error) {
      return res.status(502).json({
        message: errorMessage(error, 'Payment verification failed')
      })
    }
  })
)

app.post('/api/payments/webhook', asyncRoute(async (req, res) => {
  if (!paymentEnv.webhookSecret) {
    return res.status(503).json({
      message: 'Webhook secret not configured'
    })
  }

  const signature = String(req.headers['x-razorpay-signature'] || '')
  const expected = crypto
    .createHmac('sha256', paymentEnv.webhookSecret)
    .update(req.rawBody || Buffer.from(''))
    .digest('hex')

  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(signature)

  if (
    !signature ||
    expectedBuffer.length !== receivedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return res.status(400).json({
      message: 'Invalid webhook signature'
    })
  }

  try {
    const event = req.body?.event
    const payload = req.body?.payload || {}

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payment?.entity
      const orderEntity = payload.order?.entity
      const gatewayOrderId = paymentEntity?.order_id || orderEntity?.id

      if (gatewayOrderId) {
        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('order_id')
          .eq('provider_order_id', gatewayOrderId)
          .single()

        if (payment) {
          await fulfillPaidOrder(
            payment.order_id,
            paymentEntity?.id || null
          )
        }
      }
    }

    if (event === 'payment.failed') {
      const gatewayOrderId = payload.payment?.entity?.order_id

      if (gatewayOrderId) {
        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('order_id')
          .eq('provider_order_id', gatewayOrderId)
          .single()

        if (payment) {
          await supabaseAdmin
            .from('payments')
            .update({
              status: 'failed',
              
            })
            .eq('order_id', payment.order_id)

          await supabaseAdmin
            .from('orders')
            .update({ status: 'failed' })
            .eq('id', payment.order_id)
            .neq('status', 'paid')
        }
      }
    }

    if (event === 'refund.processed') {
      const gatewayPaymentId = payload.refund?.entity?.payment_id

      if (gatewayPaymentId) {
        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('order_id')
          .eq('provider_payment_id', gatewayPaymentId)
          .single()

        if (payment) {
          await supabaseAdmin
            .from('payments')
            .update({ status: 'refunded' })
            .eq('order_id', payment.order_id)

          await supabaseAdmin
            .from('orders')
            .update({ status: 'refunded' })
            .eq('id', payment.order_id)
        }
      }
    }

    return res.json({ ok: true })
  } catch (error) {
    console.error('WEBHOOK_ERROR:', error)
    return res.status(500).json({
      message: 'Webhook processing failed'
    })
  }
}))

/* -----------------------------
   PUBLIC CATALOG
------------------------------ */

app.get('/api/packages', asyncRoute(async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('packages')
    .select('id,name,description,price,active,featured')
    .eq('active', true)
    .order('price')

  if (error) {
    return res.status(500).json({ message: 'Unable to load packages' })
  }

  res.json({ packages: normalizePackages(data) })
}))

app.get('/api/courses', asyncRoute(async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('courses')
    .select('id,title,slug,description,status,price,thumbnail_url,instructor_id')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ message: 'Unable to load courses' })
  }

  res.json({ courses: data || [] })
}))

/* -----------------------------
   STUDENT / LEARNER
------------------------------ */

app.get(
  '/api/student/dashboard',
  auth,
  profile,
  requireStudent,
  asyncRoute(async (req, res) => {
    const { data: enrollments, error } = await supabaseAdmin
      .from('enrollments')
      .select('id,status,progress,course_id,package_id,enrolled_at,courses(id,title,price),packages(id,name,price)')
      .eq('user_id', req.user.id)
      .order('enrolled_at', { ascending: false })

    if (error) {
      return res.status(500).json({ message: 'Unable to load student dashboard' })
    }

    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id,amount,currency,status,order_type,package_id,course_id,created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    res.json({
      role: 'student',
      profile: req.profile,
      enrollments: enrollments || [],
      orders: orders || []
    })
  })
)

app.get(
  '/api/student/package-options',
  auth,
  profile,
  requireStudent,
  asyncRoute(async (req, res) => {
    const { data: packages, error } = await supabaseAdmin
      .from('packages')
      .select('id,name,description,price,active,featured')
      .eq('active', true)
      .order('price')

    if (error) {
      return res.status(500).json({ message: 'Unable to load packages' })
    }

    const { data: active } = await supabaseAdmin
      .from('enrollments')
      .select('package_id,packages(id,name,price)')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .not('package_id', 'is', null)
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const registrationPaid = await hasPaidRegistration(req.user.id)

    res.json({
      registrationFee: 99,
      registrationPaid,
      currentPackage: normalizePackage(active?.packages || null),
      packages: normalizePackages(packages)
    })
  })
)

app.get(
  '/api/student/orders',
  auth,
  profile,
  requireStudent,
  asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id,amount,currency,status,order_type,package_id,course_id,masterclass_id,workshop_id,created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return res.status(500).json({ message: 'Unable to load orders' })
    }

    res.json({ orders: data || [] })
  })
)

app.get('/api/my/package-options', auth, profile, requireStudent, asyncRoute(async (req, res) => {
  const { data: packages, error } = await supabaseAdmin
    .from('packages')
    .select('id,name,description,price,active,featured')
    .eq('active', true)
    .order('price')

  if (error) return res.status(500).json({ message: 'Unable to load packages' })

  const { data: active } = await supabaseAdmin
    .from('enrollments')
    .select('package_id,packages(id,name,price)')
    .eq('user_id', req.user.id)
    .eq('status', 'active')
    .not('package_id', 'is', null)
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const registrationPaid = await hasPaidRegistration(req.user.id)
  res.json({ registrationFee: 99, registrationPaid, currentPackage: normalizePackage(active?.packages || null), packages: normalizePackages(packages) })
}))

app.get('/api/my/orders', auth, profile, requireStudent, asyncRoute(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id,amount,currency,status,order_type,package_id,course_id,masterclass_id,workshop_id,created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return res.status(500).json({ message: 'Unable to load orders' })
  res.json({ orders: data || [] })
}))

app.get('/api/referrals/me', auth, profile, requirePartner, asyncRoute(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('referrals')
    .select('*')
    .eq('partner_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return res.status(500).json({ message: 'Unable to load referrals' })
  res.json({ referrals: data || [] })
}))

app.get(
  '/api/student/notifications',
  auth,
  profile,
  requireStudent,
  asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ message: 'Unable to load notifications' })
    }

    res.json({ notifications: data || [] })
  })
)

/* -----------------------------
   PARTNER
------------------------------ */

app.get(
  '/api/partner/dashboard',
  auth,
  profile,
  requirePartner,
  asyncRoute(async (req, res) => {
    const { data: referrals } = await supabaseAdmin
      .from('referrals')
      .select('id,status,created_at,referred_user_id,referral_code,activated_at')
      .eq('partner_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(200)

    const { data: commissions } = await supabaseAdmin
      .from('commissions')
      .select('id,amount,status,order_id,created_at')
      .eq('partner_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(200)

    const { data: withdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select('id,amount,status,requested_at,reviewed_at')
      .eq('partner_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    const available = (commissions || [])
      .filter(x => x.status === 'available')
      .reduce((sum, x) => sum + Number(x.amount || 0), 0)

    const pending = (commissions || [])
      .filter(x => x.status === 'pending')
      .reduce((sum, x) => sum + Number(x.amount || 0), 0)

    const reserved = (withdrawals || [])
      .filter(x => ['pending', 'approved'].includes(x.status))
      .reduce((sum, x) => sum + Number(x.amount || 0), 0)

    res.json({
      role: 'partner',
      profile: req.profile,
      referralCode: req.profile.referral_code,
      referralCount: referrals?.length || 0,
      commissions: commissions || [],
      withdrawals: withdrawals || [],
      availableEarnings: Math.max(0, available - reserved),
      pendingEarnings: pending,
      referrals: referrals || []
    })
  })
)

app.get(
  '/api/partner/referrals',
  auth,
  profile,
  requirePartner,
  asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('referrals')
      .select('id,status,created_at,referred_user_id,referral_code,activated_at')
      .eq('partner_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ message: 'Unable to load referrals' })
    }

    const base = process.env.PUBLIC_APP_URL || process.env.CORS_ORIGIN || ''
    const referralLink = base
      ? `${base.replace(/\/$/, '')}/signup?ref=${encodeURIComponent(req.profile.referral_code || '')}`
      : null

    res.json({
      referralCode: req.profile.referral_code,
      referralLink,
      referrals: data || []
    })
  })
)

app.get(
  '/api/partner/withdrawals',
  auth,
  profile,
  requirePartner,
  asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .eq('partner_id', req.user.id)
      .order('requested_at', { ascending: false })

    if (error) {
      return res.status(500).json({ message: 'Unable to load withdrawals' })
    }

    res.json({ withdrawals: data || [] })
  })
)

app.post(
  '/api/partner/withdrawals',
  auth,
  profile,
  requirePartner,
  asyncRoute(async (req, res) => {
    const parsed = z.object({
      amount: z.coerce.number().finite().min(100).max(10000000)
    }).safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Minimum withdrawal is ₹100' })
    }

    const { data: commissions } = await supabaseAdmin
      .from('commissions')
      .select('amount')
      .eq('partner_id', req.user.id)
      .eq('status', 'available')

    const earned = (commissions || [])
      .reduce((sum, x) => sum + Number(x.amount || 0), 0)

    const { data: pending } = await supabaseAdmin
      .from('withdrawals')
      .select('amount')
      .eq('partner_id', req.user.id)
      .in('status', ['pending', 'approved'])

    const reserved = (pending || [])
      .reduce((sum, x) => sum + Number(x.amount || 0), 0)

    const available = Math.max(0, earned - reserved)

    if (parsed.data.amount > available) {
      return res.status(400).json({
        message: `Insufficient available earnings. Available: ₹${available.toFixed(2)}`
      })
    }

    const { data, error } = await supabaseAdmin
      .from('withdrawals')
      .insert({
        partner_id: req.user.id,
        amount: parsed.data.amount,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      return res.status(400).json({ message: 'Withdrawal request failed' })
    }

    await audit(
      req,
      'withdrawal.requested',
      'withdrawal',
      data.id,
      { amount: parsed.data.amount }
    )

    res.status(201).json({
      withdrawal: data,
      availableAfter: Number((available - parsed.data.amount).toFixed(2))
    })
  })
)

/* -----------------------------
   INSTRUCTOR
------------------------------ */

app.get(
  '/api/instructor/dashboard',
  auth,
  profile,
  requireInstructor,
  asyncRoute(async (req, res) => {
    const { data: courses, error } = await supabaseAdmin
      .from('courses')
      .select('id,title,slug,description,price,status,thumbnail_url,created_at,updated_at')
      .eq('instructor_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ message: 'Unable to load instructor dashboard' })
    }

    res.json({
      role: 'instructor',
      profile: req.profile,
      courses: courses || []
    })
  })
)

app.get(
  '/api/instructor/courses',
  auth,
  profile,
  requireInstructor,
  asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('courses')
      .select('*')
      .eq('instructor_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ message: 'Unable to load instructor courses' })
    }

    res.json({ courses: data || [] })
  })
)

app.post(
  '/api/instructor/courses',
  auth,
  profile,
  requireInstructor,
  asyncRoute(async (req, res) => {
    const parsed = z.object({
      title: z.string().trim().min(3).max(160),
      description: z.string().max(5000).default(''),
      price: z.coerce.number().min(0).max(10000000)
    }).safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid course data' })
    }

    const slug =
      parsed.data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Date.now()

    const { data, error } = await supabaseAdmin
      .from('courses')
      .insert({
        ...parsed.data,
        slug,
        instructor_id: req.user.id,
        status: 'draft'
      })
      .select()
      .single()

    if (error) {
      return res.status(400).json({ message: 'Course could not be created' })
    }

    await audit(req, 'course.created', 'course', data.id, {
      status: 'draft'
    })

    res.status(201).json({ course: data })
  })
)

app.patch(
  '/api/instructor/courses/:id',
  auth,
  profile,
  requireInstructor,
  asyncRoute(async (req, res) => {
    const parsed = z.object({
      title: z.string().trim().min(3).max(160).optional(),
      description: z.string().max(5000).optional(),
      price: z.coerce.number().min(0).max(10000000).optional(),
      status: z.enum(['draft', 'pending_review', 'published', 'rejected', 'archived']).optional(),
      thumbnail_url: z.string().url().nullable().optional()
    }).partial().safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid course update' })
    }

    const { data, error } = await supabaseAdmin
      .from('courses')
      .update({
        ...parsed.data,
        updated_at: nowIso()
      })
      .eq('id', req.params.id)
      .eq('instructor_id', req.user.id)
      .select()
      .single()

    if (error || !data) {
      return res.status(404).json({
        message: 'Course not found or not owned by instructor'
      })
    }

    await audit(req, 'course.updated', 'course', data.id, parsed.data)

    res.json({ course: data })
  })
)

/* -----------------------------
   ADMIN
   Admin is permission-based, never CEO-by-default.
------------------------------ */

async function hasAdminPermission(req, permission) {
  if (req.profile.role === 'ceo') return true
  return false
}

function requireAdminPermission(permission) {
  return asyncRoute(async (req, res, next) => {
    if (!(await hasAdminPermission(req, permission))) {
      return res.status(403).json({
        message: `Admin permission required: ${permission}`
      })
    }
    next()
  })
}

app.get(
  '/api/admin/dashboard',
  auth,
  profile,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const permissions = []
    const counts = {}

    for (const table of ['profiles', 'packages', 'courses', 'orders', 'withdrawals', 'support_tickets']) {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('id', { count: 'exact', head: true })

      if (error) {
        return res.status(500).json({
          message: `Unable to load admin dashboard data: ${table}`
        })
      }

      counts[table] = count || 0
    }

    res.json({
      role: req.profile.role,
      profile: req.profile,
      permissions: (permissions || []).map(x => x.permission_key),
      counts
    })
  })
)

app.get(
  '/api/admin/users',
  auth,
  profile,
  requireAdmin,
  requireAdminPermission('users.view'),
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id,full_name,role,status,referral_code,referred_by,created_at')
      .neq('role', 'ceo')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return res.status(500).json({ message: 'Unable to load users' })
    }

    res.json({ users: data || [] })
  })
)

app.get(
  '/api/admin/payments',
  auth,
  profile,
  requireAdmin,
  requireAdminPermission('payments.view'),
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return res.status(500).json({ message: 'Unable to load payment records' })
    }

    res.json({ payments: data || [] })
  })
)

app.get(
  '/api/admin/withdrawals',
  auth,
  profile,
  requireAdmin,
  requireAdminPermission('withdrawals.view'),
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(500)

    if (error) {
      return res.status(500).json({ message: 'Unable to load withdrawal records' })
    }

    res.json({ withdrawals: data || [] })
  })
)

app.get(
  '/api/admin/projects',
  auth,
  profile,
  requireAdmin,
  (_req, res) => res.status(501).json({ message: 'Projects table is not present in the current database schema' })
)

app.get(
  '/api/admin/referrals',
  auth,
  profile,
  requireAdmin,
  requireAdminPermission('referrals.view'),
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return res.status(500).json({ message: 'Unable to load referrals' })
    }

    res.json({ referrals: data || [] })
  })
)

/* -----------------------------
   CEO
------------------------------ */

app.get(
  '/api/ceo/overview',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const tables = [
      'profiles',
      'courses',
      'packages',
      'masterclasses',
      'workshops',
      'orders',
      'withdrawals',
      'support_tickets',
      'reviews'
    ]

    const counts = {}

    for (const table of tables) {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('id', { count: 'exact', head: true })

      if (error) {
        return res.status(500).json({
          message: `Unable to read ${table}`
        })
      }

      counts[table] = count || 0
    }

    const { data: paid } = await supabaseAdmin
      .from('orders')
      .select('amount')
      .eq('status', 'paid')

    const revenue = (paid || [])
      .reduce((sum, row) => sum + Number(row.amount || 0), 0)

    const { data: pendingWithdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select('id,amount,partner_id,status,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20)

    const { data: recentAudit } = await supabaseAdmin
      .from('audit_logs')
      .select('id,action,entity_type,entity_id,created_at,metadata')
      .order('created_at', { ascending: false })
      .limit(20)

    res.json({
      role: 'ceo',
      counts,
      revenue,
      pendingWithdrawals: pendingWithdrawals || [],
      recentAudit: recentAudit || []
    })
  })
)

app.get(
  '/api/ceo/users',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id,full_name,role,status,referral_code,referred_by,created_at')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return res.status(500).json({ message: 'Unable to load users' })
    }

    res.json({ users: data || [] })
  })
)

app.patch(
  '/api/ceo/users/:id',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (req, res) => {
    const parsed = z.object({
      role: z.enum(['ceo', 'admin', 'partner', 'instructor', 'student']).optional(),
      status: z.enum(['active', 'pending', 'suspended', 'disabled']).optional(),
      full_name: z.string().trim().min(1).max(160).optional()
    }).refine(value => Object.keys(value).length > 0).safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid user update' })
    }

    if (
      req.params.id === req.user.id &&
      parsed.data.role &&
      parsed.data.role !== 'ceo'
    ) {
      return res.status(400).json({
        message: 'CEO cannot remove their own CEO role'
      })
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        ...parsed.data,
        updated_at: nowIso()
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error || !data) {
      return res.status(400).json({ message: 'User update failed' })
    }

    await audit(req, 'user.updated', 'profile', data.id, parsed.data)

    res.json({ user: data })
  })
)

const packageSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().max(5000).optional(),
  price: z.coerce.number().min(0).max(10000000).optional(),
  access_days: z.coerce.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
  featured: z.boolean().optional()
})

app.get(
  '/api/ceo/packages',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('packages')
      .select('*')
      .order('price')

    if (error) {
      return res.status(500).json({ message: 'Unable to load packages' })
    }

    res.json({ packages: normalizePackages(data) })
  })
)

app.patch(
  '/api/ceo/packages/:id',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (req, res) => {
    const parsed = packageSchema.partial().safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid package data' })
    }

    const { data, error } = await supabaseAdmin
      .from('packages')
      .update({
        ...parsed.data,
        updated_at: nowIso()
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error || !data) {
      return res.status(400).json({ message: 'Package update failed' })
    }

    await audit(req, 'package.updated', 'package', data.id, parsed.data)

    res.json({ package: data })
  })
)

app.get(
  '/api/ceo/courses',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return res.status(500).json({ message: 'Unable to load courses' })
    }

    res.json({ courses: data || [] })
  })
)

app.patch(
  '/api/ceo/courses/:id',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (req, res) => {
    const parsed = z.object({
      title: z.string().trim().min(3).max(160).optional(),
      description: z.string().max(5000).optional(),
      price: z.coerce.number().min(0).max(10000000).optional(),
      status: z.enum(['draft', 'pending_review', 'published', 'rejected', 'archived']).optional(),
      thumbnail_url: z.string().url().nullable().optional()
    }).partial().safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid course update' })
    }

    const { data, error } = await supabaseAdmin
      .from('courses')
      .update({
        ...parsed.data,
        updated_at: nowIso()
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error || !data) {
      return res.status(404).json({ message: 'Course not found' })
    }

    await audit(req, 'course.updated', 'course', data.id, parsed.data)

    res.json({ course: data })
  })
)

app.get(
  '/api/ceo/masterclasses',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('masterclasses')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ message: 'Unable to load masterclasses' })
    }

    res.json({ masterclasses: data || [] })
  })
)

app.get(
  '/api/ceo/workshops',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('workshops')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ message: 'Unable to load workshops' })
    }

    res.json({ workshops: data || [] })
  })
)

app.get(
  '/api/ceo/orders',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return res.status(500).json({ message: 'Unable to load orders' })
    }

    res.json({ orders: data || [] })
  })
)

app.get(
  '/api/ceo/payments',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return res.status(500).json({ message: 'Unable to load payments' })
    }

    res.json({ payments: data || [] })
  })
)

app.get(
  '/api/ceo/withdrawals',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(500)

    if (error) {
      return res.status(500).json({ message: 'Unable to load withdrawals' })
    }

    res.json({ withdrawals: data || [] })
  })
)

app.patch(
  '/api/ceo/withdrawals/:id',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (req, res) => {
    const parsed = z.object({
      status: z.enum(['approved', 'rejected']),
      note: z.string().max(1000).optional()
    }).safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Status must be approved or rejected'
      })
    }

    const { data: old, error: oldError } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (oldError || !old) {
      return res.status(404).json({ message: 'Withdrawal not found' })
    }

    if (old.status !== 'pending') {
      return res.status(409).json({
        message: 'Withdrawal already reviewed'
      })
    }

    const { data, error } = await supabaseAdmin
      .from('withdrawals')
      .update({
        status: parsed.data.status,
        reviewed_by: req.user.id,
        reviewed_at: nowIso(),
        note: parsed.data.note || null
      })
      .eq('id', old.id)
      .eq('status', 'pending')
      .select()
      .single()

    if (error || !data) {
      return res.status(400).json({
        message: 'Withdrawal review failed'
      })
    }

    await audit(
      req,
      `withdrawal.${parsed.data.status}`,
      'withdrawal',
      data.id,
      {
        amount: old.amount,
        note: parsed.data.note || null
      }
    )

    res.json({ withdrawal: data })
  })
)

app.get(
  '/api/ceo/referrals',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return res.status(500).json({ message: 'Unable to load referrals' })
    }

    res.json({ referrals: data || [] })
  })
)

app.get(
  '/api/ceo/commissions',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('commissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return res.status(500).json({ message: 'Unable to load commissions' })
    }

    res.json({ commissions: data || [] })
  })
)

app.get(
  '/api/ceo/ledger',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('earnings_ledger')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return res.status(500).json({ message: 'Unable to load earnings ledger' })
    }

    res.json({ ledger: data || [] })
  })
)

app.get(
  '/api/ceo/levels',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('level_rules')
      .select('*')
      .order('level')

    if (error) {
      return res.status(500).json({ message: 'Unable to load level rules' })
    }

    res.json({ levels: data || [] })
  })
)

app.patch(
  '/api/ceo/levels/:level',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (req, res) => {
    const parsed = z.object({
      points_required: z.coerce.number().int().min(0),
      required_referrals: z.coerce.number().int().min(0),
      required_skill_mastery: z.boolean()
    }).safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid level rule' })
    }

    const { data, error } = await supabaseAdmin
      .from('level_rules')
      .update({
        ...parsed.data,
        updated_at: nowIso()
      })
      .eq('level', Number(req.params.level))
      .select()
      .single()

    if (error || !data) {
      return res.status(400).json({
        message: 'Level rule update failed'
      })
    }

    await audit(
      req,
      'level_rule.updated',
      'level_rule',
      null,
      { level: Number(req.params.level), ...parsed.data }
    )

    res.json({ level: data })
  })
)

app.get(
  '/api/ceo/reviews',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return res.status(500).json({ message: 'Unable to load reviews' })
    }

    res.json({ reviews: data || [] })
  })
)

app.patch(
  '/api/ceo/reviews/:id',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (req, res) => {
    const parsed = z.object({
      status: z.enum(['pending', 'approved', 'rejected'])
    }).safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid review status' })
    }

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update({ status: parsed.data.status })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error || !data) {
      return res.status(400).json({
        message: 'Review update failed'
      })
    }

    await audit(req, 'review.moderated', 'review', data.id, parsed.data)

    res.json({ review: data })
  })
)

app.get(
  '/api/ceo/rewards',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('level_rewards')
      .select('*')
      .order('level')

    if (error) {
      return res.status(500).json({ message: 'Unable to load rewards' })
    }

    res.json({ rewards: data || [] })
  })
)

app.patch(
  '/api/ceo/rewards/:level',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (req, res) => {
    const parsed = z.object({
      reward_name: z.string().trim().min(2).max(160).optional(),
      reward_description: z.string().max(3000).optional(),
      active: z.boolean().optional()
    }).partial().safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid reward data' })
    }

    const { data, error } = await supabaseAdmin
      .from('level_rewards')
      .update({
        ...parsed.data
      })
      .eq('level', Number(req.params.level))
      .select()
      .single()

    if (error || !data) {
      return res.status(400).json({
        message: 'Reward update failed'
      })
    }

    await audit(req, 'reward.updated', 'reward_rule', data.id, parsed.data)

    res.json({ reward: data })
  })
)

app.get(
  '/api/ceo/admin-permissions',
  auth,
  profile,
  requireCEO,
  (_req, res) => res.status(501).json({ message: 'Admin permissions table is not present in the current database schema' })
)

app.put(
  '/api/ceo/admin-permissions/:adminId',
  auth,
  profile,
  requireCEO,
  (_req, res) => res.status(501).json({ message: 'Admin permissions table is not present in the current database schema' })
)

app.get(
  '/api/ceo/settings',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('*')
      .order('setting_key')

    if (error) {
      return res.status(500).json({
        message: 'Unable to load platform settings'
      })
    }

    res.json({ settings: data || [] })
  })
)

app.put(
  '/api/ceo/settings/:key',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (req, res) => {
    const parsed = z.object({
      value: z.any()
    }).safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid setting' })
    }

    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .upsert({
        setting_key: req.params.key,
        setting_value: parsed.data.value,
        updated_by: req.user.id,
        updated_at: nowIso()
      })
      .select()
      .single()

    if (error) {
      return res.status(400).json({ message: 'Setting update failed' })
    }

    await audit(
      req,
      'platform_setting.updated',
      'platform_setting',
      null,
      { key: req.params.key }
    )

    res.json({ setting: data })
  })
)

app.get(
  '/api/ceo/coupons',
  auth,
  profile,
  requireCEO,
  (_req, res) => res.status(501).json({ message: 'Coupons table is not present in the current database schema' })
)

app.post(
  '/api/ceo/coupons',
  auth,
  profile,
  requireCEO,
  (_req, res) => res.status(501).json({ message: 'Coupons table is not present in the current database schema' })
)

app.get(
  '/api/ceo/audit-logs',
  auth,
  profile,
  requireCEO,
  asyncRoute(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return res.status(500).json({ message: 'Unable to load audit logs' })
    }

    res.json({ logs: data || [] })
  })
)

/* -----------------------------
   ERROR HANDLING
------------------------------ */

app.use((_req, res) => {
  res.status(404).json({
    message: 'API route not found'
  })
})

app.use((error, _req, res, _next) => {
  console.error('API_ERROR:', error)

  if (error?.message === 'CORS origin not allowed') {
    return res.status(403).json({
      message: 'CORS origin not allowed'
    })
  }

  if (error?.code === '23505') {
    return res.status(409).json({
      message: 'Duplicate record'
    })
  }

  res.status(500).json({
    message: 'Internal server error'
  })
})

process.on('unhandledRejection', error => {
  console.error('UNHANDLED_REJECTION:', error)
})

process.on('uncaughtException', error => {
  console.error('UNCAUGHT_EXCEPTION:', error)
})

app.listen(port, () => {
  console.log(`SkillLink API listening on ${port}`)
})
