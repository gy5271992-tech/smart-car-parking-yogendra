document.addEventListener("DOMContentLoaded", function () {

    const BASE_URL = "https://smart-car-parking-yogendra.onrender.com";

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

    const config = {
        bike:  { count: 40, price: 20,  icon: "🏍", color: "#00e5ff" },
        car:   { count: 30, price: 50,  icon: "🚗", color: "#00ccff" },
        truck: { count: 10, price: 100, icon: "🚚", color: "#ff9900" }
    };

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

                billPopup.style.display = "flex";
            });

            area.appendChild(slot);
        }

        updateAvailable();
    }

    function updateAvailable() {
        Object.keys(config).forEach(type => {
            const available = [...areas[type].children]
                .filter(s => s.dataset.booked === "false").length;
            counters[type].innerText = available;
        });
    }

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

    window.payNow = async function () {
        if (!selectedSlot) { alert("Slot select karein!"); return; }

        const name    = userNameInput.value.trim();
        const vehicle = vehicleInput.value.trim();

        if (!name)    { alert("Naam daalen!"); return; }
        if (!vehicle) { alert("Vehicle number daalen!"); return; }

        const amount = parseInt(selectedSlot.dataset.price);
        const type   = selectedSlot.dataset.type;
        const slot   = selectedSlot.dataset.number;

        const payBtn = document.querySelector(".pay-btn");
        payBtn.innerText = "⏳ Processing...";
        payBtn.disabled  = true;

        try {
            const res = await fetch(`${BASE_URL}/create-order`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slot, name, vehicle, type, amount })
            });

            const data = await res.json();

            if (!res.ok) {
                alert("❌ " + (data.error || "Order failed!"));
                payBtn.innerText = "💳 Proceed to Pay";
                payBtn.disabled  = false;
                return;
            }

            const options = {
    key: data.key_id,
    amount: data.amount,
    currency: data.currency,
    name: "Smart Parking",
    description: `Slot: ${slot}`,
    order_id: data.order_id,

    handler: async function (response) {

        console.log("✅ PAYMENT SUCCESS:", response);

        try {
            const verifyRes = await fetch(`${BASE_URL}/verify-payment`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    ticket_id: data.ticket_id,
                    slot: slot
                })
            });

            const verifyData = await verifyRes.json();

            console.log("VERIFY RESPONSE:", verifyData);

            if (verifyData.success) {

                // ✅ SLOT BOOK UI
                if (selectedSlot) {
                    selectedSlot.dataset.booked = "true";
                    selectedSlot.classList.add("booked");
                    selectedSlot.style.border = "2px solid #ff4455";
                }

                bookings.push({
                    ticketId: data.ticket_id,
                    slot: slot,
                    vehicle: vehicleInput.value.trim(),
                    name: userNameInput.value.trim(),
                    amount: Number(selectedSlot.dataset.price)
                });

                updateBookingUI();
                updateAvailable();

                gate.classList.add("open");
                setTimeout(() => gate.classList.remove("open"), 2500);

                showTicketPopup(data.ticket_id);
                resetForm();

                alert("✅ Payment Successful & Slot Booked!");

            } else {
                alert("❌ Payment verification failed");
            }

        } catch (err) {
            console.error(err);
            alert("❌ Verification error!");
        }
    },

    modal: {
        ondismiss: function () {
            alert("❌ Payment cancelled");
        }
    },

    prefill: {
        name: name
    },

    theme: {
        color: "#00d4ff"
    }
};

    async function verifyPayment(orderId, paymentId, signature, ticketId, slot) {
        try {
            const res = await fetch(`${BASE_URL}/verify-payment`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    razorpay_order_id: orderId,
                    razorpay_payment_id: paymentId,
                    razorpay_signature: signature,
                    ticket_id: ticketId,
                    slot: slot
                })
            });

            const data = await res.json();

            if (data.success) {
                if (selectedSlot) {
                    selectedSlot.dataset.booked = "true";
                    selectedSlot.classList.add("booked");
                    selectedSlot.style.border = "2px solid #ff4455";
                }

                bookings.push({
                    ticketId: ticketId,
                    slot: slot,
                    vehicle: vehicleInput.value.trim(),
                    name: userNameInput.value.trim(),
                    amount: selectedSlot ? selectedSlot.dataset.price : ""
                });

                updateBookingUI();
                updateAvailable();

                gate.classList.add("open");
                setTimeout(() => gate.classList.remove("open"), 2500);

                showTicketPopup(ticketId);
                resetForm();

            } else {
                alert("❌ Payment verify failed");
            }

        } catch (err) {
            console.error(err);
            alert("❌ Verification error!");
        }
    }

    function showTicketPopup(ticketId) {
        document.getElementById("ticketIdDisplay").innerText = "Ticket: " + ticketId;

        const qrWrap = document.getElementById("ticketQR");
        qrWrap.innerHTML = "";
        new QRCode(qrWrap, { text: ticketId, width: 160, height: 160 });

        document.getElementById("ticketPopup").style.display = "flex";
    }

    function resetForm() {
        selectedSlot = null;
        userNameInput.value = "";
        vehicleInput.value = "";
        document.querySelectorAll(".slot").forEach(s => s.classList.remove("selected"));
    }

    window.closePopup = function () {
        billPopup.style.display = "none";
        resetForm();
    };

    createSlots("bike");
    createSlots("car");
    createSlots("truck");

    loadSlotsFromServer();
});
