require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// =====================
// DATABASE CONNECTION
// =====================
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        console.error("❌ DB Error:", err);
        return;
    }
    console.log("✅ MySQL Connected!");
    createTables();
});

// =====================
// AUTO CREATE TABLES
// =====================
function createTables() {
    const slotTable = `
    CREATE TABLE IF NOT EXISTS slots (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slot_number VARCHAR(20) NOT NULL UNIQUE,
        type ENUM('bike','car','truck') NOT NULL,
        is_booked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;

    const bookingTable = `
    CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id VARCHAR(50) NOT NULL UNIQUE,
        slot_number VARCHAR(20) NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        vehicle_number VARCHAR(30) NOT NULL,
        vehicle_type VARCHAR(20) NOT NULL,
        amount INT NOT NULL,
        razorpay_order_id VARCHAR(100),
        razorpay_payment_id VARCHAR(100),
        payment_status ENUM('PENDING','PAID','FAILED') DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;

    db.query(slotTable, err => console.log(err || "✅ Slots table ready"));
    db.query(bookingTable, err => console.log(err || "✅ Bookings table ready"));
}

// =====================
// RAZORPAY
// =====================
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// =====================
// GET SLOTS
// =====================
app.get("/slots", (req, res) => {
    db.query("SELECT slot_number, type, is_booked FROM slots ORDER BY id", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// =====================
// CREATE ORDER
// =====================
app.post("/create-order", async (req, res) => {
    try {
        const { slot, name, vehicle, type, amount } = req.body;

        if (!slot || !name || !vehicle || !amount) {
            return res.status(400).json({ error: "Fill all fields!" });
        }

        db.query(
            "SELECT is_booked FROM slots WHERE slot_number=?",
            [slot],
            async (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });

                if (rows.length && rows[0].is_booked) {
                    return res.status(400).json({ error: "Slot already booked!" });
                }

                const order = await razorpay.orders.create({
                    amount: amount * 100,
                    currency: "INR",
                    receipt: "rcpt_" + Date.now(),
                    notes: { slot, name, vehicle, type }
                });

                const ticketId = "TKT-" + Date.now();

                db.query(
                    `INSERT INTO bookings 
                    (ticket_id, slot_number, user_name, vehicle_number, vehicle_type, amount, razorpay_order_id, payment_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
                    [ticketId, slot, name, vehicle, type, amount, order.id],
                    (err2) => {
                        if (err2) return res.status(500).json({ error: err2.message });

                        res.json({
                            order_id: order.id,
                            amount: order.amount,
                            currency: order.currency,
                            ticket_id: ticketId,
                            key_id: process.env.RAZORPAY_KEY_ID
                        });
                    }
                );
            }
        );

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Order failed!" });
    }
});

// =====================
// VERIFY PAYMENT
// =====================
app.post("/verify-payment", (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    console.log("Signature:", razorpay_signature);
    console.log("Generated:", generatedSignature);

    // ✅ DEMO MODE: verification skip (IMPORTANT)
    // if (generatedSignature !== razorpay_signature) {
    //     return res.status(400).json({ success: false });
    // }

    // 🔥 DB से slot निकालो (correct way)
    db.query(
        "SELECT slot_number FROM bookings WHERE razorpay_order_id=?",
        [razorpay_order_id],
        (err, rows) => {
            if (err || rows.length === 0) {
                return res.status(500).json({ error: "Booking not found" });
            }

            const slot = rows[0].slot_number;

            // booking update
            db.query(
                "UPDATE bookings SET payment_status='PAID', razorpay_payment_id=? WHERE razorpay_order_id=?",
                [razorpay_payment_id, razorpay_order_id],
                (err2) => {
                    if (err2) return res.status(500).json({ error: err2.message });

                    // slot booked
                    db.query(
                        "UPDATE slots SET is_booked=TRUE WHERE slot_number=?",
                        [slot],
                        (err3) => {
                            if (err3) return res.status(500).json({ error: err3.message });

                            res.json({ success: true });
                        }
                    );
                }
            );
        }
    );
});

// =====================
// SERVER START
// =====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log("🚀 Server running on port " + PORT);
});
