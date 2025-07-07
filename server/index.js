console.log('🚀 Server script is running...');

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();
const db = require('./db');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({
  origin: [
    'http://localhost:5173',
    `https://${process.env.SHOPIFY_APP_URL}`
  ],
  credentials: true
}));

app.use(express.json());


// 🔐 AUTH ROUTES
app.get('/auth', (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send('Missing shop parameter');

  const redirectUri = `https://${process.env.SHOPIFY_APP_URL}/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_API_KEY}` +
    `&scope=${process.env.SHOPIFY_SCOPES}` +
    `&redirect_uri=${redirectUri}`;

  console.log('🔁 Redirecting to install URL:', installUrl);
  res.redirect(installUrl);
});

app.post('/webhook/:resource/:event', express.raw({ type: 'application/json' }), async (req, res) => {
  const topic = `${req.params.resource}/${req.params.event}`;
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];

  const generatedHash = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.body, 'utf8')
    .digest('base64');

  if (generatedHash !== hmacHeader) {
    console.warn(`⚠️ Webhook signature failed for topic: ${topic}`);
    return res.status(401).send('Unauthorized');
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch (err) {
    console.error(`❌ Failed to parse webhook payload for ${topic}:`, err);
    return res.status(400).send('Invalid payload');
  }

  console.log(`📦 Webhook received: ${topic}`);
  console.dir(payload, { depth: null });

  try {
    if (topic === 'orders/create') {
      const order = payload;
      const totalPrice = parseFloat(order.total_price) || 0;
      const tags = order.tags || '';
      const status = order.fulfillment_status || 'unfulfilled';

      const lineItems = (order.line_items || []).map(item => ({
        title: item.title,
        variant: item.variant_title,
        price: parseFloat(item.price) || 0,
        cost: 0,
        discount: parseFloat(item.total_discount) || 0,
        revenue: parseFloat(item.price) - parseFloat(item.total_discount),
        image_url: null
      }));

      await db.query(`
        INSERT INTO orders (id, order_number, tags, line_items, item_price, total_price, status, image_url, created_at, cost_price)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `, [
        order.id,
        order.name,
        tags,
        JSON.stringify(lineItems),
        lineItems.reduce((sum, i) => sum + i.price, 0),
        totalPrice,
        status,
        null,
        order.created_at,
        lineItems.reduce((sum, i) => sum + i.cost, 0)
      ]);

      console.log('✅ Order inserted from webhook');

    } else if (topic === 'products/create' || topic === 'products/update') {
      const p = payload.product || payload;
      const tagList = (p.tags || '').split(',').map(t => t.trim()).join(', ');
      const imageUrl = p.image?.src || null;

      await db.query(`
        INSERT INTO products (id, title, price, image_url, tags)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET title = $2, price = $3, image_url = $4, tags = $5
      `, [p.id, p.title, parseFloat(p.variants?.[0]?.price || 0), imageUrl, tagList]);

      console.log(`✅ Product ${topic === 'products/create' ? 'inserted' : 'updated'} from webhook`);

    } else if (topic === 'customers/create' || topic === 'customers/update') {
      const customer = payload;
      const tags = customer.tags || '';
      const email = customer.email || '';
      console.log(`ℹ️ Customer webhook: ${email} | Tags: ${tags}`);
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error(`❌ Error processing webhook ${topic}:`, err);
    res.status(500).send('Internal error');
  }
});



app.get('/', (req, res) => {
  res.send('✅ Backend running');
});

app.get('/auth/callback', async (req, res) => {
      console.log('➡️ OAuth callback triggered:', req.query);

  const { shop, code } = req.query;
  if (!shop || !code) return res.status(400).send('Missing shop or code');

  try {
    const tokenRes = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code
    });

console.log('✅ OAuth callback for shop:', shop);
console.log('🔐 Using API Key:', process.env.SHOPIFY_API_KEY?.slice(0, 6));
console.log('🔐 Using Secret:', process.env.SHOPIFY_API_SECRET?.slice(0, 6));


    const accessToken = tokenRes.data.access_token;

    console.log(`✅ OAuth success for ${shop}`);
    try {
  await db.query(
  `INSERT INTO shop_tokens (shop, access_token)
   VALUES ($1, $2)
   ON CONFLICT (shop) DO UPDATE SET access_token = EXCLUDED.access_token`,
  [shop, accessToken]
);



  console.log(`✅ Stored token in DB for shop: ${shop}`);
} catch (dbErr) {
  console.error(`❌ Failed to insert access token for shop ${shop}:`, dbErr.message);
}

await registerWebhooksForShop(shop, accessToken);

    res.redirect(`https://${shop}/admin/apps`);
  } catch (err) {
    console.error('❌ OAuth callback error:', err.response?.data || err.message);
    res.status(500).send('OAuth failed');
  }
});


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCostFromInventoryItem(inventoryItemId) {
  try {
    const costRes = await axios.get(
      `https://${process.env.SHOPIFY_STORE}/admin/api/2025-04/inventory_items/${inventoryItemId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN
        }
      }
    );
    return parseFloat(costRes.data.inventory_item.cost || 0);
  } catch (err) {
    console.error(`Failed to fetch cost for inventory item ${inventoryItemId}:`, err.message);
    return 0;
  }
}

async function getProductTagsByProductId(productId) {
  try {
    const result = await db.query('SELECT tags FROM products WHERE id = $1', [productId]);
    if (result.rows.length > 0) {
      return result.rows[0].tags.split(',').map(t => t.trim());
    }
    return [];
  } catch (err) {
    console.error(`Failed to fetch product tags for product ${productId}:`, err.message);
    return [];
  }
}

async function getProductImageByProductId(productId) {
  try {
    const result = await db.query('SELECT image_url FROM products WHERE id = $1', [productId]);
    if (result.rows.length > 0) {
      return result.rows[0].image_url || null;
    }
    return null;
  } catch (err) {
    console.error(`Failed to fetch product image for product ${productId}:`, err.message);
    return null;
  }
}

// 🔐 Signup

app.post('/api/signup', async (req, res) => {
  console.log('➡️ POST /api/signup');
  console.log('🔐 Using Storefront Token:', process.env.STOREFRONT_TOKEN?.slice(0, 10));

  const { email, password, firstName, creatorName } = req.body;
  if (!email || !password || !firstName || !creatorName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Step 1: Create customer (Storefront API)
    const result = await axios.post(
  `https://${process.env.SHOPIFY_STORE}/api/2024-04/graphql.json`,
  JSON.stringify({
    query: `
      mutation customerCreate($input: CustomerCreateInput!) {
        customerCreate(input: $input) {
          customer { id }
          customerUserErrors { field message }
        }
      }
    `,
    variables: {
      input: { email, password, firstName }
    }
  }),
  {
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': process.env.STOREFRONT_TOKEN
    }
  }
);


    const errors = result.data.data.customerCreate.customerUserErrors;
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0].message });
    }

    // Step 2: Look up customer via Admin API
    // Step 2: Try finding the customer via Admin API (with retries)
    let customer = null;
    for (let i = 0; i < 5; i++) {
      const searchRes = await axios.get(
        "https://" + process.env.SHOPIFY_STORE + "/admin/api/2024-04/customers/search.json?query=email:" + email,
        {
          headers: {
            'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN
          }
        }
      );
      customer = searchRes.data.customers?.[0];
      if (customer) break;
      console.log(`🔁 Retry ${i + 1}: customer not found yet, waiting...`);
      await new Promise(res => setTimeout(res, 1500)); // wait 1.5 seconds
    }

    if (!customer) {
      return res.status(404).json({ error: 'Customer created, but not found' });
    }

    const customerId = customer.id;

    // Step 3: Add tag to customer
    await axios.put(
      `https://${process.env.SHOPIFY_STORE}/admin/api/2024-04/customers/${customerId}.json`,
      { customer: { id: customerId, tags: `${creatorName}` } },
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    // Step 4: Save to Railway DB
console.log('🛠️ Preparing to insert customer into DB:', customerId, email, creatorName);
await db.query(
  `INSERT INTO customers (shopify_id, email, tag, name, created_at)
   VALUES ($1, $2, $3, $4, NOW())
   ON CONFLICT (shopify_id) DO UPDATE
     SET email      = EXCLUDED.email,
         tag        = EXCLUDED.tag,
         name       = EXCLUDED.name`,
  [
    customerId,    // $1
    email,         // $2
    creatorName,   // $3 — the tag
    firstName      // $4 — the customer’s name
  ]
);

console.log('✅ Inserted customer into DB');

res.json({ message: '✅ Account created, tagged, and stored!' });

} catch (err) {
  console.error('❌ Signup error:', JSON.stringify(err.response?.data || err.message, null, 2));
  res.status(500).json({
    error: 'Signup failed',
    details: err.response?.data || err.message
  });
}
});


async function registerWebhooksForShop(shop, accessToken) {
  const webhookBaseUrl = `https://${process.env.SHOPIFY_APP_URL}`;

}


app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    // Step 1: Create access token
    const result = await axios.post(
      `https://${process.env.SHOPIFY_STORE}/api/2024-04/graphql.json`,
      {
        query: `
          mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
            customerAccessTokenCreate(input: $input) {
              customerAccessToken {
                accessToken
                expiresAt
              }
              customerUserErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          input: { email, password }
        }
      },
      {
        headers: {
          'X-Shopify-Storefront-Access-Token': process.env.STOREFRONT_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = result.data.data.customerAccessTokenCreate;
    const accessToken = data.customerAccessToken.accessToken;
    if (data.customerUserErrors.length > 0) {
      return res.status(401).json({ error: data.customerUserErrors[0].message });
    }

    const storefrontAccessToken = data.customerAccessToken.accessToken;

// Replace this with your actual shop domain if it's static during dev
const shop = process.env.SHOPIFY_STORE;

const { rows } = await db.query(
  'SELECT access_token FROM shop_tokens WHERE shop = $1 OR shop = $2',
  [shop, 'cf8ee0-fe.myshopify.com']
);
const adminAccessToken = rows[0]?.access_token;

if (!adminAccessToken) {
  console.error(`❌ No admin access token found for shop: ${shop}`);
  return res.status(403).json({ error: 'Missing access token for shop' });
}

// Register webhooks (optional: only do once)
await registerWebhooksForShop(shop, adminAccessToken);



    // Step 2: Lookup customer and extract tag
    const customerRes = await axios.get(
      `https://${process.env.SHOPIFY_STORE}/admin/api/2024-04/customers/search.json?query=email:${encodeURIComponent(email)}`,
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    const customer = customerRes.data.customers?.[0];
    const tag = customer?.tags?.split(',')[0]?.trim() || null;

    return res.json({ accessToken, email, tag });
  } catch (err) {
    console.error('❌ Login error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/sync/orders', async (req, res) => {
  console.log('🟢 /sync/orders endpoint triggered');
  try {
    await db.query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE');
    console.log('🗑️ Cleared all existing orders');

    const ordersRes = await axios.get(`https://${process.env.SHOPIFY_STORE}/admin/api/2023-10/orders.json`, {
      headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN },
      params: {
        status: 'any',
        limit: 100,
        created_at_min: '2024-01-01T00:00:00Z',
        fields: 'id,name,line_items,created_at,fulfillment_status,total_price,tags'
      }
    });

    const orders = ordersRes.data.orders;
    console.log(`📦 Fetched ${orders.length} orders from Shopify`);

    for (const order of orders) {
      console.log(`🧾 Preparing to insert order ${order.name} (ID: ${order.id})`);

      let totalPrice = parseFloat(order.total_price) || 0;
      let totalRetail = 0;
      const lineItems = [];
      const allTagsSet = new Set();

      for (const item of order.line_items) {
        const productId = item.product_id;
        const variantId = item.variant_id;
        const price = parseFloat(item.price) || 0;
        const discount = parseFloat(item.total_discount || 0);
        let cost = 0;
        let imageUrl = null;

        if (variantId) {
          try {
            const variantRes = await axios.get(
              `https://${process.env.SHOPIFY_STORE}/admin/api/2025-04/variants/${variantId}.json`,
              {
                headers: {
                  'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN
                }
              }
            );
            const inventoryItemId = variantRes.data.variant.inventory_item_id;
            cost = await getCostFromInventoryItem(inventoryItemId);
          } catch (err) {
            console.error(`Failed to get variant or cost for variant ${variantId}:`, err.message);
          }
        }

        if (productId) {
          const productTags = await getProductTagsByProductId(productId);
          productTags.forEach(tag => allTagsSet.add(tag.toLowerCase()));
          imageUrl = await getProductImageByProductId(productId);
        }

        const revenue = price - cost - discount;
        totalRetail += price;

        lineItems.push({
          title: item.title,
          variant: item.variant_title,
          price,
          cost,
          discount,
          revenue,
          image_url: imageUrl
        });
      }

      const combinedTags = Array.from(allTagsSet).join(', ');
      const firstImageUrl = lineItems.find(item => item.image_url)?.image_url || null;

      try {
        await db.query(`
          INSERT INTO orders (id, order_number, tags, line_items, item_price, total_price, status, image_url, created_at, cost_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
          ON CONFLICT (id) DO NOTHING
        `, [
          order.id,
          order.name,
          combinedTags,
          JSON.stringify(lineItems),
          totalRetail,
          totalPrice,
          order.fulfillment_status || 'unfulfilled',
          firstImageUrl,
          lineItems.reduce((sum, i) => sum + i.cost, 0)
        ]);
        console.log(`✅ Inserted order ${order.id}`);
      } catch (dbErr) {
        console.error(`❌ DB insert failed for order ${order.id}:`, dbErr.message);
      }

      await sleep(500);
    }

    res.json({ message: '✅ Order sync complete', count: orders.length });
  } catch (err) {
    console.error('❌ Sync error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to sync orders' });
  }
});

app.get('/api/sales', async (req, res) => {
  const tag = req.query.tag?.toLowerCase();
  if (!tag) return res.status(400).json({ error: 'Tag is required' });

  try {
    const { rows } = await db.query(
      `SELECT * FROM orders WHERE EXISTS (
         SELECT 1 FROM unnest(string_to_array(tags, ',')) AS t
         WHERE TRIM(LOWER(t)) = $1
       )
       ORDER BY created_at DESC`,
      [tag.trim()]
    );

    const sales = rows.map(order => {
      let items = [];
      try {
        items = JSON.parse(order.line_items);
      } catch {
        items = [];
      }

      return {
        orderNumber: order.order_number,
        status: order.status,
        tags: order.tags,
        createdAt: order.created_at,
        items: items.map(item => ({
          title: item.title || 'Unknown',
          variantTitle: item.variant || '',
          price: item.price || 0,
          cost: item.cost || 0,
          discount: item.discount || 0,
          revenue: item.revenue || 0,
          image: item.image_url || null
        }))
      };
    });

    res.json({ sales });
  } catch (err) {
    console.error('❌ Failed to fetch sales:', err.message);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

app.get('/api/products', async (req, res) => {
  const tag = req.query.tag?.toLowerCase();
  console.log('📥 Product tag received:', tag);

  if (!tag) return res.status(400).json({ error: 'Tag is required' });

  try {
    const { rows } = await db.query(
      `SELECT * FROM products
       WHERE LOWER(tags) LIKE '%' || $1 || '%'
       ORDER BY id DESC`,
      [tag.trim()]
    );

    console.log(`✅ Products found: ${rows.length}`);
    
    const products = rows.map(p => ({
      id: p.id,
      title: p.title,
      price: p.price,
      image: p.image_url,
      tags: p.tags
    }));

    res.json({ products });
  } catch (err) {
    console.error('❌ Failed to fetch products:', err.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});


// Replace your existing /api/customer block with this:

app.get('/api/customer', async (req, res) => {
  const { email, token } = req.query;

  if (!email || !token) {
    return res.status(401).json({ error: 'Unauthorized: Missing email or token' });
  }

  console.log("🧪 Validating customer token:", token);

  try {
    const result = await axios.post(
      `https://${process.env.SHOPIFY_STORE}/api/2024-04/graphql.json`,
      {
        query: `
          query {
            customer(customerAccessToken: "${token}") {
              email
              firstName
            }
          }
        `
      },
      {
        headers: {
          'X-Shopify-Storefront-Access-Token': process.env.STOREFRONT_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log("🔍 Shopify customer response:", JSON.stringify(result.data, null, 2));

    const customerData = result.data?.data?.customer;

    if (!customerData || customerData.email.toLowerCase() !== email.toLowerCase()) {
      console.warn("🚫 Token valid but email mismatch or missing customer");
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    const { rows } = await db.query(
      `SELECT name, email, tag, created_at FROM customers WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      console.warn(`⚠️ No customer found in DB for email "${email}"`);
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = rows[0];
    console.log(`✅ Customer loaded from DB: ${customer.name} (${customer.email})`);

    res.json({
      customer: {
        name: customer.name,
        email: customer.email,
        tag: customer.tag,
        createdAt: customer.created_at,
        company: '',
        phone: '',
        address: {},
        ordersCount: 0,
        totalSpent: '0.00',
        marketing: { email: false, sms: false }
      }
    });
  } catch (err) {
    console.error('❌ Token validation or DB error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Server error' });
  }
});



app.listen(port, () => {
  console.log(`✅ Backend running at http://localhost:${port}`);
});
