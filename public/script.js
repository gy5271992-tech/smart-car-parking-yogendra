document.addEventListener("DOMContentLoaded", function () {

    const BASE_URL = "https://smart-car-parking-yogendra.onrender.com"; // Apna server URL yahan daalo

    // ===== ELEMENTS =====
    const areas = {
        bike:  document.getElementById("bikeArea"),
        car:   document.getElementById("carArea"),
        truck: document.getElementById("truckArea")
    };
    const counters = {
        bike:  document.getElementById("bikeCount"),
        car:   document.getElementById("carCount"),
        truck: document.getElementById("truckCount")
    };

    const billPopup     = document.getElementById("billPopup");
    const billSlot      = document.getElementById("billSlot");
    const amountDisplay = document.getElementById("amountDisplay");
    const gate          = document.getElementById("gate");
    const userNameInput = document.getElementById("userName");
    const vehicleInput  = document.getElementById("vehicleNumber");

    let selectedSlot = null;
    let bookings     = [];

    // ===== SLOT CONFIG =====
    const config = {
        bike:  { count: 40, price: 20,  icon: "🏍", color: "#00e5ff" },
        car:   { count: 30, price: 50,  icon: "🚗", color: "#00ccff" },
        truck: { count: 10, price: 100, icon: "🚚", color: "#ff9900" }
    };

    // ===== CREATE SLOTS =====
    function createSlots(type) {
        const { count, price, icon, color } = config[type];
        const area = areas[type];

        for (let i = 1; i <= count; i++) {
            const slot = document.createElement("div");
            slot.className      = "slot";
            slot.dataset.booked = "false";
            slot.dataset.type   = type;
            slot.dataset.price  = price;
            slot.dataset.number = `${type.toUpperCase()}-${i}`;

            slot.innerHTML = `
                <div class="slot-icon">${icon}</div>
                <div class="slot-number">${type.toUpperCase()}-${i}</div>
            `;
            slot.style.border = `2px solid ${color}`;

            slot.addEventListener("click", function () {
                if (slot.dataset.booked === "true") return;

                document.querySelectorAll(".slot").forEach(s => s.classList.remove("selected"));
                slot.classList.add("selected");
                selectedSlot = slot;

                billSlot.innerText      = slot.dataset.number;
                amountDisplay.innerText = "₹" + price;

                // Default aaj ki date
                document.getElementById("bookingDate").value =
                    new Date().toISOString().split("T")[0];

                billPopup.style.display = "flex";
            });

            area.appendChild(slot);
        }

        updateAvailable();
    }

    // ===== AVAILABLE COUNT =====
    function updateAvailable() {
        Object.keys(config).forEach(type => {
            const available = [...areas[type].children]
                .filter(s => s.dataset.booked === "false").length;
            counters[type].innerText = available;
        });
    }
   

// 👇 YAHAN ADD KAR
async function loadSlotsFromServer() {
    try {
        const res = await fetch(`${BASE_URL}/slots`);
        const data = await res.json();

        data.forEach(slotData => {
            const slot = document.querySelector(
                `[data-number="${slotData.slot_number}"]`
            );

            if (slot && slotData.is_booked) {
                slot.dataset.booked = "true";
                slot.classList.add("booked");
                slot.style.border = "2px solid red";
            }
        });

        updateAvailable();

    } catch (err) {
        console.error("Error loading slots:", err);
    }
}

    // ===== BOOKING LIST UI =====
    function updateBookingUI() {
        const list  = document.getElementById("bookingList");
        const count = document.getElementById("bookingCount");
        list.innerHTML = "";

        if (bookings.length === 0) {
            list.innerHTML = `<p class="empty-msg">No bookings yet</p>`;
        } else {
            bookings.forEach((b, index) => {
                const div = document.createElement("div");
                div.classList.add("booking-item");
                div.innerHTML = `
                    <div class="ticket">
                        <h4>🎫 ${b.ticketId}</h4>
                        <p><b>Slot:</b> ${b.slot}</p>
                        <p><b>Vehicle:</b> ${b.vehicle}</p>
                        <p><b>Name:</b> ${b.name}</p>
                        <p><b>Date:</b> ${b.date} &nbsp; <b>Time:</b> ${b.time}</p>
                        <p><b>Amount:</b> ₹${b.amount}</p>
                        <div id="qr-${index}" class="qr-box"></div>
                    </div>
                `;
                list.appendChild(div);
                new QRCode(document.getElementById(`qr-${index}`), {
                    text: b.ticketId, width: 120, height: 120
                });
            });
        }

        count.innerText = bookings.length;
    }

    // ===== PAY NOW — Razorpay =====
    window.payNow = async function () {
        if (!selectedSlot) { alert("Slot select karein!"); return; }

        const name    = userNameInput.value.trim();
        const vehicle = vehicleInput.value.trim();
        const date    = document.getElementById("bookingDate").value;
        const time    = document.getElementById("bookingTime").value;

        if (!name)    { alert("Naam daalen!"); return; }
        if (!vehicle) { alert("Vehicle number daalen!"); return; }
        if (!date)    { alert("Date select karein!"); return; }
        if (!time)    { alert("Time select karein!"); return; }

        const amount = parseInt(selectedSlot.dataset.price);
        const type   = selectedSlot.dataset.type;
        const slot   = selectedSlot.dataset.number;

        // Loading dikhao
        const payBtn = document.querySelector(".pay-btn");
        payBtn.innerText    = "⏳ Processing...";
        payBtn.disabled     = true;

        try {
            // Step 1: Backend se order create karo
            const res = await fetch(`${BASE_URL}/create-order`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slot, name, vehicle, type, date, time, amount })
            });

            const data = await res.json();

            if (!res.ok) {
                alert("❌ " + (data.error || "Order create nahi hua!"));
                payBtn.innerText = "💳 Proceed to Pay";
                payBtn.disabled  = false;
                return;
            }

            // Step 2: Razorpay checkout open karo
            const options = {
                key:         data.key_id,
                amount:      data.amount,
                currency:    data.currency,
                name:        "Smart Parking",
                description: `Slot: ${slot}`,
                order_id:    data.order_id,
                image:       "./logo.png", // optional

                // ✅ Payment successful hone par
                handler: async function (response) {
                    await verifyPayment(
                        response.razorpay_order_id,
                        response.razorpay_payment_id,
                        response.razorpay_signature,
                        data.ticket_id,
                        slot
                    );
                },

                prefill: {
                    name:    name,
                    contact: ""
                },

                theme: { color: "#00d4ff" },

                // ❌ Payment cancel hone par
                modal: {
                    ondismiss: function () {
                        alert("Payment cancel kar di. Dobara try karein.");
                        payBtn.innerText = "💳 Proceed to Pay";
                        payBtn.disabled  = false;
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();

            billPopup.style.display = "none";

        } catch (err) {
            console.error(err);
            alert("❌ Server se connect nahi ho pa raha! Server chalu hai?");
            payBtn.innerText = "💳 Proceed to Pay";
            payBtn.disabled  = false;
        }
    };

    // ===== VERIFY PAYMENT =====
    async function verifyPayment(orderId, paymentId, signature, ticketId, slot) {
        try {
            const res = await fetch(`${BASE_URL}/verify-payment`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    razorpay_order_id:   orderId,
                    razorpay_payment_id: paymentId,
                    razorpay_signature:  signature,
                    ticket_id:           ticketId,
                    slot:                slot
                })
            });

            const data = await res.json();

            if (data.success) {
                // ✅ Slot automatically mark as booked
                if (selectedSlot) {
                    selectedSlot.dataset.booked = "true";
                    selectedSlot.classList.add("booked");
                    selectedSlot.style.border = "2px solid #ff4455";
                }

                // Booking local mein save karo
                bookings.push({
                    ticketId: ticketId,
                    slot:     slot,
                    type:     selectedSlot ? selectedSlot.dataset.type : "",
                    vehicle:  vehicleInput.value.trim(),
                    name:     userNameInput.value.trim(),
                    date:     document.getElementById("bookingDate").value,
                    time:     document.getElementById("bookingTime").value,
                    amount:   selectedSlot ? selectedSlot.dataset.price : ""
                });

                updateBookingUI();
                updateAvailable();

                // Gate open karo
                gate.classList.add("open");
                setTimeout(() => gate.classList.remove("open"), 2500);

                // Ticket popup dikhao
                showTicketPopup(ticketId);
                resetForm();

            } else {
                alert("❌ Payment verify nahi hui: " + (data.error || "Unknown error"));
            }

        } catch (err) {
            console.error(err);
            alert("❌ Verification mein problem aayi!");
        }
    }

    // ===== TICKET POPUP =====
    function showTicketPopup(ticketId) {
        document.getElementById("ticketIdDisplay").innerText = "Ticket: " + ticketId;

        const qrWrap = document.getElementById("ticketQR");
        qrWrap.innerHTML = "";
        new QRCode(qrWrap, { text: ticketId, width: 160, height: 160 });

        document.getElementById("ticketPopup").style.display = "flex";
    }

    window.closeTicket = function () {
        document.getElementById("ticketPopup").style.display = "none";
    };

    // ===== RESET FORM =====
    function resetForm() {
        selectedSlot        = null;
        userNameInput.value = "";
        vehicleInput.value  = "";
        document.querySelectorAll(".slot").forEach(s => s.classList.remove("selected"));
        const payBtn = document.querySelector(".pay-btn");
        if (payBtn) { payBtn.innerText = "💳 Proceed to Pay"; payBtn.disabled = false; }
    }

    // ===== CLOSE POPUP =====
    window.closePopup = function () {
        billPopup.style.display = "none";
        resetForm();
    };

    // ===== TOGGLE BOOKINGS =====
    window.toggleBookings = function (e) {
        if (e) e.preventDefault();
        const popup = document.getElementById("bookingPopup");
        popup.style.display = popup.style.display === "flex" ? "none" : "flex";
    };

    window.closeBokingOnBg = function (e) {
        if (e.target === document.getElementById("bookingPopup"))
            document.getElementById("bookingPopup").style.display = "none";
    };

    // ===== CONTACT =====
    window.openContact = function (e) {
        if (e) e.preventDefault();
        document.getElementById("contactPopup").style.display = "flex";
    };
    window.closeContact = function () {
        document.getElementById("contactPopup").style.display = "none";
    };
    window.closeContactOnBg = function (e) {
        if (e.target === document.getElementById("contactPopup"))
            document.getElementById("contactPopup").style.display = "none";
    };

    // ===== INIT =====
    createSlots("bike");
    createSlots("car");
    createSlots("truck");

    loadSlotsFromServer();
});
