import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import midtransClient from "midtrans-client";

dotenv.config();
const app = express();
app.use(express.json());

const allowed = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes(origin)) return cb(null, true);
    return cb(new Error("Origin not allowed by CORS"));
  }
}));

const snap = new midtransClient.Snap({
  isProduction: process.env.IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

app.post("/create-transaction", async (req, res) => {
  try {
    const { order_id, gross_amount, item_name, customer = {} } = req.body;
    if (!order_id || !gross_amount) {
      return res.status(400).json({ error: "order_id dan gross_amount wajib diisi" });
    }

    const parameter = {
      transaction_details: { order_id, gross_amount: Number(gross_amount) },
      item_details: [{ id: order_id, price: Number(gross_amount), quantity: 1, name: item_name || "Digital Item" }],
      customer_details: {
        first_name: customer.name || "Customer",
        email: customer.email || "noemail@example.com",
        phone: customer.phone || ""
      },
      credit_card: { secure: true }
      // enabled_payments bisa ditambahkan jika ingin membatasi metode
    };

    const token = await snap.createTransactionToken(parameter);
    res.json({ token, clientKey: process.env.MIDTRANS_CLIENT_KEY });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Webhook notifikasi status pembayaran
app.post("/midtrans-notify", async (req, res) => {
  try {
    const notification = req.body;
    const status = await snap.transaction.status(notification?.order_id);
    console.log("[NOTIFY]", status); // TODO: update status di database kamu
    res.status(200).json({ received: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log("Midtrans backend listening on port", process.env.PORT || 3001);
});
