CREATE DATABASE IF NOT EXISTS parking_system;
USE parking_system;

-- ==========================================
-- USERS TABLE (OPTIONAL)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    phone VARCHAR(15),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- PARKING SLOTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slot_number VARCHAR(20) UNIQUE,
    type ENUM('bike','car','truck'),
    is_booked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- BOOKINGS TABLE (WITH QR SUPPORT)
-- ==========================================
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id VARCHAR(100) UNIQUE,
    qr_data TEXT, -- 🔥 QR JSON DATA
    slot_id INT,
    slot_number VARCHAR(20),
    vehicle_number VARCHAR(50),
    user_name VARCHAR(100),
    vehicle_type ENUM('bike','car','truck'),
    amount INT,
    status ENUM('BOOKED','ENTERED','EXITED') DEFAULT 'BOOKED',
    entry_time TIMESTAMP NULL,
    exit_time TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (slot_id) REFERENCES slots(id)
    ON DELETE CASCADE
);

-- ==========================================
-- PAYMENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT,
    amount INT,
    payment_status ENUM('SUCCESS','FAILED') DEFAULT 'SUCCESS',
    payment_method VARCHAR(50),
    payment_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (booking_id) REFERENCES bookings(id)
    ON DELETE CASCADE
);

-- ==========================================
-- INSERT ALL SLOTS (BIKE, CAR, TRUCK)
-- ==========================================

-- BIKE SLOTS (40)
INSERT IGNORE INTO slots (slot_number, type) VALUES
('BIKE-1','bike'),('BIKE-2','bike'),('BIKE-3','bike'),('BIKE-4','bike'),
('BIKE-5','bike'),('BIKE-6','bike'),('BIKE-7','bike'),('BIKE-8','bike'),
('BIKE-9','bike'),('BIKE-10','bike'),('BIKE-11','bike'),('BIKE-12','bike'),
('BIKE-13','bike'),('BIKE-14','bike'),('BIKE-15','bike'),('BIKE-16','bike'),
('BIKE-17','bike'),('BIKE-18','bike'),('BIKE-19','bike'),('BIKE-20','bike'),
('BIKE-21','bike'),('BIKE-22','bike'),('BIKE-23','bike'),('BIKE-24','bike'),
('BIKE-25','bike'),('BIKE-26','bike'),('BIKE-27','bike'),('BIKE-28','bike'),
('BIKE-29','bike'),('BIKE-30','bike'),('BIKE-31','bike'),('BIKE-32','bike'),
('BIKE-33','bike'),('BIKE-34','bike'),('BIKE-35','bike'),('BIKE-36','bike'),
('BIKE-37','bike'),('BIKE-38','bike'),('BIKE-39','bike'),('BIKE-40','bike');

-- CAR SLOTS (30)
INSERT IGNORE INTO slots (slot_number, type) VALUES
('CAR-1','car'),('CAR-2','car'),('CAR-3','car'),('CAR-4','car'),
('CAR-5','car'),('CAR-6','car'),('CAR-7','car'),('CAR-8','car'),
('CAR-9','car'),('CAR-10','car'),('CAR-11','car'),('CAR-12','car'),
('CAR-13','car'),('CAR-14','car'),('CAR-15','car'),('CAR-16','car'),
('CAR-17','car'),('CAR-18','car'),('CAR-19','car'),('CAR-20','car'),
('CAR-21','car'),('CAR-22','car'),('CAR-23','car'),('CAR-24','car'),
('CAR-25','car'),('CAR-26','car'),('CAR-27','car'),('CAR-28','car'),
('CAR-29','car'),('CAR-30','car');

-- TRUCK SLOTS (10)
INSERT IGNORE INTO slots (slot_number, type) VALUES
('TRUCK-1','truck'),('TRUCK-2','truck'),('TRUCK-3','truck'),
('TRUCK-4','truck'),('TRUCK-5','truck'),('TRUCK-6','truck'),
('TRUCK-7','truck'),('TRUCK-8','truck'),('TRUCK-9','truck'),
('TRUCK-10','truck');

-- ==========================================
-- SAMPLE BOOKING WITH QR DATA
-- ==========================================
INSERT INTO bookings 
(ticket_id, qr_data, slot_id, slot_number, vehicle_number, user_name, vehicle_type, amount)
VALUES 
(
 'TEST123',
 '{"ticketId":"TEST123","slot":"CAR-5","vehicle":"RJ14AB1234"}',
 5,
 'CAR-5',
 'RJ14AB1234',
 'Yogendra',
 'car',
 50
);

-- ==========================================
-- USEFUL QUERIES
-- ==========================================

-- CHECK AVAILABLE SLOTS
SELECT type, COUNT(*) AS available_slots
FROM slots
WHERE is_booked = FALSE
GROUP BY type;

-- VERIFY QR
SELECT * FROM bookings WHERE ticket_id = 'TEST123';

-- ENTRY
UPDATE bookings 
SET status = 'ENTERED', entry_time = NOW()
WHERE ticket_id = 'TEST123';

-- EXIT + FREE SLOT
UPDATE bookings 
SET status = 'EXITED', exit_time = NOW()
WHERE ticket_id = 'TEST123';

UPDATE slots 
SET is_booked = FALSE 
WHERE slot_number = 'CAR-5';
