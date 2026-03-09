import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("bookings.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'EMPLOYEE'
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    related_id INTEGER,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    location TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_code TEXT,
    room_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    organizer_id TEXT NOT NULL,
    organizer_name TEXT NOT NULL,
    participants_count INTEGER NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms (id),
    FOREIGN KEY (organizer_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS booking_participants (
    booking_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    PRIMARY KEY (booking_id, user_id),
    FOREIGN KEY (booking_id) REFERENCES bookings (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS booking_external_participants (
    booking_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    PRIMARY KEY (booking_id, name),
    FOREIGN KEY (booking_id) REFERENCES bookings (id)
  );

  CREATE TABLE IF NOT EXISTS business_trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_code TEXT,
    user_id TEXT NOT NULL,
    destination TEXT NOT NULL,
    purpose TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    city TEXT,
    hotel_check_in DATE,
    hotel_check_out DATE,
    hotel_name TEXT,
    hotel_location TEXT,
    notes TEXT,
    status TEXT DEFAULT 'PENDING',
    followers TEXT, -- JSON array of user IDs
    hr_comment TEXT,
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS trip_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    position TEXT,
    department TEXT,
    phone TEXT,
    FOREIGN KEY (trip_id) REFERENCES business_trips (id)
  );

  CREATE TABLE IF NOT EXISTS trip_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    room_number INTEGER NOT NULL,
    room_type TEXT NOT NULL,
    FOREIGN KEY (trip_id) REFERENCES business_trips (id)
  );

  CREATE TABLE IF NOT EXISTS trip_room_guests (
    room_id INTEGER NOT NULL,
    participant_name TEXT NOT NULL,
    PRIMARY KEY (room_id, participant_name),
    FOREIGN KEY (room_id) REFERENCES trip_rooms (id)
  );

  CREATE TABLE IF NOT EXISTS hotel_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    hotel_name TEXT NOT NULL,
    location TEXT NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    room_type TEXT NOT NULL,
    FOREIGN KEY (trip_id) REFERENCES business_trips (id)
  );

  CREATE TABLE IF NOT EXISTS vehicle_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_code TEXT,
    user_id TEXT NOT NULL,
    trip_id INTEGER,
    type TEXT NOT NULL, -- 'DAILY' or 'TRIP'
    pickup_location TEXT NOT NULL,
    destination TEXT NOT NULL,
    pickup_time DATETIME NOT NULL,
    passengers INTEGER NOT NULL,
    status TEXT DEFAULT 'PENDING',
    hr_comment TEXT,
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (trip_id) REFERENCES business_trips (id)
  );

  CREATE TABLE IF NOT EXISTS vehicle_participants (
    vehicle_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    PRIMARY KEY (vehicle_id, user_id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicle_bookings (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS vehicle_external_participants (
    vehicle_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    PRIMARY KEY (vehicle_id, name),
    FOREIGN KEY (vehicle_id) REFERENCES vehicle_bookings (id)
  );
`);

// Database migrations for existing tables
try {
  db.prepare("ALTER TABLE bookings ADD COLUMN booking_code TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE business_trips ADD COLUMN booking_code TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE vehicle_bookings ADD COLUMN booking_code TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE business_trips ADD COLUMN hotel_name TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE business_trips ADD COLUMN hotel_location TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'EMPLOYEE'").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE business_trips ADD COLUMN followers TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE business_trips ADD COLUMN hr_comment TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE business_trips ADD COLUMN processed_at DATETIME").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE vehicle_bookings ADD COLUMN hr_comment TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE vehicle_bookings ADD COLUMN processed_at DATETIME").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE business_trips ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE vehicle_bookings ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP").run();
} catch (e) {}

// Ensure HR Manager role is assigned
const hrExists = db.prepare("SELECT id FROM users WHERE id = 'WF24HR'").get();
if (!hrExists) {
  db.prepare("INSERT INTO users (id, name, role) VALUES ('WF24HR', 'HR Manager', 'HR_MANAGER')").run();
} else {
  db.prepare("UPDATE users SET role = 'HR_MANAGER' WHERE id = 'WF24HR'").run();
}

// Seed users if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const users = [
    { id: "EMP001", name: "Nguyễn Văn A", role: "EMPLOYEE" },
    { id: "EMP002", name: "Trần Thị B", role: "EMPLOYEE" },
    { id: "EMP003", name: "Lê Văn C", role: "EMPLOYEE" },
    { id: "EMP004", name: "Phạm Thị D", role: "EMPLOYEE" },
    { id: "EMP005", name: "Hoàng Văn E", role: "EMPLOYEE" },
    { id: "EMP006", name: "Vũ Thị F", role: "EMPLOYEE" },
    { id: "EMP007", name: "Đặng Văn G", role: "EMPLOYEE" },
    { id: "EMP008", name: "Bùi Thị H", role: "EMPLOYEE" },
    { id: "EMP009", name: "Đỗ Văn I", role: "EMPLOYEE" },
    { id: "WF24HR", name: "HR Manager", role: "HR_MANAGER" },
  ];
  const insertUser = db.prepare("INSERT INTO users (id, name, role) VALUES (?, ?, ?)");
  users.forEach(u => insertUser.run(u.id, u.name, u.role));
}

// Seed rooms
const rooms = [
  { name: "Passion Hall", capacity: 500, location: "Cổng 1 - Tầng 1" },
  { name: "Hội trường A4/ Workshop Hall A4", capacity: 100, location: "Cổng 4, Persistent Building A4 - Tầng 3" },
  { name: "Hội trường B6/ Workshop Hall B6", capacity: 150, location: "Cổng 3, Discovery Building B6 - Tầng 4" },
  { name: "Sảnh WISer Connect/ WISER CONNECT Lobby", capacity: 150, location: "Cổng 2 - Tầng 1" },
  { name: "Phòng họp 4 mùa/ 4 Seasons Meeting Room", capacity: 50, location: "Cổng 2, Respect Building - Tầng 1" },
  { name: "Thư viện Tiểu học/ Primary School Library", capacity: 100, location: "Cổng 2, Respect Building - Tầng 3" },
  { name: "Nhà đa năng A3/ Function Room A3", capacity: 250, location: "Cổng 5 - Tầng 2" },
  { name: "Sân Bóng rổ Trung học/ Basketball Court - Secondary", capacity: 300, location: "Cổng 5 - Tầng 1" },
  { name: "Sân Bóng đá Trung học/ Football Field - Secondary", capacity: 100, location: "Cổng 4 - Tầng 1" },
  { name: "Phòng tự học Tầng 2 A4.1/ Selfstudy", capacity: 50, location: "Cổng 4, Persistent Building A4 - Tầng 2" },
  { name: "Thư viện Trung học/ Secondary School Library", capacity: 100, location: "Cổng 5 - Tầng 1" },
  { name: "Các lớp học/ Classrooms", capacity: 30, location: "Wellspring Hanoi - Tầng 1,2,3,4" },
  { name: "Phòng họp mùa xuân/ Spring Meeting Room", capacity: 15, location: "Cổng 2 - Cạnh Phòng Nhân sự - Đào tạo - Tầng 2" },
  { name: "Phòng họp mùa hạ/ Summer Meeting Room", capacity: 15, location: "Cổng 2 - Cạnh Phòng Nhân sự - Đào tạo - Tầng 2" },
  { name: "Phòng họp mùa thu/ Autumn Meeting Room", capacity: 15, location: "Cổng 2 - Cạnh Phòng COO - Tầng 2" },
  { name: "Phòng họp mùa đông/ Winter Meeting Room", capacity: 20, location: "Cổng 2 - Cạnh Khối HCTH-DVHS - Tầng 2" },
];

// Clear and re-seed rooms to ensure latest data
db.prepare("DELETE FROM rooms").run();
const insertRoom = db.prepare("INSERT INTO rooms (name, capacity, location) VALUES (?, ?, ?)");
rooms.forEach(r => insertRoom.run(r.name, r.capacity, r.location));

// Helper to generate booking code
function generateBookingCode(type: 'BM' | 'BT' | 'BC') {
  const year = new Date().getFullYear();
  const tableMap = {
    'BM': 'bookings',
    'BT': 'business_trips',
    'BC': 'vehicle_bookings'
  };
  const tableName = tableMap[type];
  
  const lastBooking = db.prepare(`
    SELECT booking_code FROM ${tableName} 
    WHERE booking_code LIKE ? 
    ORDER BY id DESC LIMIT 1
  `).get(`${type}-${year}-%`) as { booking_code: string } | undefined;

  let sequence = 1;
  if (lastBooking) {
    const parts = lastBooking.booking_code.split('-');
    const lastSeq = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  return `${type}-${year}-${sequence.toString().padStart(6, '0')}`;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.post("/api/login", (req, res) => {
    const { employeeId, password } = req.body;
    // Requirement: password is same as employeeId
    if (employeeId !== password) {
      return res.status(401).json({ error: "Mã nhân viên hoặc mật khẩu không đúng." });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(employeeId) as any;
    if (!user) {
      return res.status(401).json({ error: "Nhân viên không tồn tại trong hệ thống." });
    }

    res.json(user);
  });

  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  });

  app.get("/api/rooms", (req, res) => {
    const rooms = db.prepare("SELECT * FROM rooms ORDER BY capacity ASC").all();
    res.json(rooms);
  });

  app.get("/api/bookings", (req, res) => {
    const { date, user_id } = req.query;
    if (!date) return res.status(400).json({ error: "Date is required" });
    
    // Get bookings where user is organizer OR invited participant
    let query = `
      SELECT DISTINCT b.*, r.name as room_name 
      FROM bookings b 
      JOIN rooms r ON b.room_id = r.id 
      LEFT JOIN booking_participants bp ON b.id = bp.booking_id
      WHERE date(b.start_time) = date(?)
    `;
    const params: any[] = [date];

    if (user_id) {
      query += ` AND (b.organizer_id = ? OR bp.user_id = ?)`;
      params.push(user_id, user_id);
    }

    const bookings = db.prepare(query).all(...params) as any[];

    // For each booking, get participants and specific user status
    const bookingsWithParticipants = bookings.map(b => {
      const participants = db.prepare(`
        SELECT bp.user_id, u.name as user_name, bp.status
        FROM booking_participants bp
        JOIN users u ON bp.user_id = u.id
        WHERE bp.booking_id = ?
      `).all(b.id) as any[];

      let user_status = 'ACCEPTED'; // Organizer is always accepted
      if (user_id && b.organizer_id !== user_id) {
        const p = participants.find(p => p.user_id === user_id);
        user_status = p ? p.status : 'PENDING';
      }

      const external = db.prepare(`
        SELECT name FROM booking_external_participants WHERE booking_id = ?
      `).all(b.id) as any[];

      return {
        ...b,
        invited_participants: participants,
        external_participants: external.map(e => e.name),
        user_status
      };
    });

    res.json(bookingsWithParticipants);
  });

  app.post("/api/bookings", (req, res) => {
    const { room_id, title, organizer_id, organizer_name, participants_count, start_time, end_time, invited_user_ids, external_participants } = req.body;

    // Check for conflicts
    const conflict = db.prepare(`
      SELECT * FROM bookings 
      WHERE room_id = ? 
      AND (
        (start_time < ? AND end_time > ?) OR
        (start_time < ? AND end_time > ?) OR
        (start_time >= ? AND end_time <= ?)
      )
    `).get(room_id, end_time, start_time, start_time, start_time, start_time, end_time);

    if (conflict) {
      return res.status(409).json({ error: "Phòng đã bị đặt trong khoảng thời gian này." });
    }

    const insertBooking = db.prepare(`
      INSERT INTO bookings (booking_code, room_id, title, organizer_id, organizer_name, participants_count, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertParticipant = db.prepare(`
      INSERT INTO booking_participants (booking_id, user_id, status)
      VALUES (?, ?, 'PENDING')
    `);

    const insertExternal = db.prepare(`
      INSERT INTO booking_external_participants (booking_id, name)
      VALUES (?, ?)
    `);

    const transaction = db.transaction((bookingData, participantIds, externalNames) => {
      const bookingCode = generateBookingCode('BM');
      const result = insertBooking.run(
        bookingCode,
        bookingData.room_id, 
        bookingData.title, 
        bookingData.organizer_id, 
        bookingData.organizer_name, 
        bookingData.participants_count, 
        bookingData.start_time, 
        bookingData.end_time
      );
      const bookingId = result.lastInsertRowid;

      if (participantIds && Array.isArray(participantIds)) {
        participantIds.forEach(uid => {
          if (uid !== bookingData.organizer_id) {
            insertParticipant.run(bookingId, uid);
          }
        });
      }

      if (externalNames && Array.isArray(externalNames)) {
        externalNames.forEach(name => {
          if (name.trim()) {
            insertExternal.run(bookingId, name.trim());
          }
        });
      }

      return bookingId;
    });

    try {
      const bookingId = transaction({ room_id, title, organizer_id, organizer_name, participants_count, start_time, end_time }, invited_user_ids, external_participants);
      res.json({ id: bookingId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Có lỗi xảy ra khi lưu cuộc họp." });
    }
  });

  app.post("/api/bookings/:id/rsvp", (req, res) => {
    const { id } = req.params;
    const { user_id, status } = req.body;

    if (!['ACCEPTED', 'DECLINED'].includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ." });
    }

    const result = db.prepare(`
      UPDATE booking_participants 
      SET status = ? 
      WHERE booking_id = ? AND user_id = ?
    `).run(status, id, user_id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Không tìm thấy lời mời cho người dùng này." });
    }

    res.json({ success: true });
  });

  app.delete("/api/bookings/:id", (req, res) => {
    const { id } = req.params;
    const { user_id } = req.query;

    const transaction = db.transaction(() => {
      const booking = db.prepare("SELECT organizer_id FROM bookings WHERE id = ?").get(id) as any;
      if (!booking) throw new Error("Booking not found");
      if (booking.organizer_id !== user_id) throw new Error("Only the organizer can cancel this booking");

      db.prepare("DELETE FROM booking_participants WHERE booking_id = ?").run(id);
      db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Booking deletion error:", error);
      res.status(400).json({ error: error.message || "Failed to cancel booking" });
    }
  });

  // Business Trips
  app.get("/api/trips", (req, res) => {
    const { user_id } = req.query;
    let query = `
      SELECT t.*, u.name as user_name 
      FROM business_trips t
      JOIN users u ON t.user_id = u.id
    `;
    const params: any[] = [];
    if (user_id) {
      query += " WHERE t.user_id = ?";
      params.push(user_id);
    }
    
    const trips = db.prepare(query).all(...params) as any[];
    
    const fullTrips = trips.map(trip => {
      const participants = db.prepare("SELECT * FROM trip_participants WHERE trip_id = ?").all(trip.id);
      const rooms = db.prepare("SELECT * FROM trip_rooms WHERE trip_id = ?").all(trip.id) as any[];
      
      const roomsWithGuests = rooms.map(room => {
        const guests = db.prepare("SELECT participant_name FROM trip_room_guests WHERE room_id = ?").all(room.id) as any[];
        return { ...room, guest_ids: guests.map(g => g.participant_name) };
      });
      
      return { 
        ...trip, 
        participants, 
        rooms: roomsWithGuests,
        followers: JSON.parse(trip.followers || '[]')
      };
    });
    
    res.json(fullTrips);
  });

  app.post("/api/trips", (req, res) => {
    const { 
      user_id, destination, purpose, start_date, end_date, 
      city, hotel_check_in, hotel_check_out, notes,
      participants, rooms, followers 
    } = req.body;

    const transaction = db.transaction(() => {
      const bookingCode = generateBookingCode('BT');
      const tripResult = db.prepare(`
        INSERT INTO business_trips (booking_code, user_id, destination, purpose, start_date, end_date, city, hotel_check_in, hotel_check_out, notes, followers)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(bookingCode, user_id, destination, purpose, start_date, end_date, city, hotel_check_in, hotel_check_out, notes, JSON.stringify(followers || []));
      
      const tripId = tripResult.lastInsertRowid;

      if (participants && participants.length > 0) {
        const insertParticipant = db.prepare(`
          INSERT INTO trip_participants (trip_id, name, position, department, phone)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const p of participants) {
          insertParticipant.run(tripId, p.name, p.position, p.department, p.phone);
        }
      }

      if (rooms && rooms.length > 0) {
        const insertRoom = db.prepare(`
          INSERT INTO trip_rooms (trip_id, room_number, room_type)
          VALUES (?, ?, ?)
        `);
        const insertGuest = db.prepare(`
          INSERT INTO trip_room_guests (room_id, participant_name)
          VALUES (?, ?)
        `);

        for (const r of rooms) {
          const roomResult = insertRoom.run(tripId, r.room_number, r.room_type);
          const roomId = roomResult.lastInsertRowid;
          
          if (r.guest_ids && r.guest_ids.length > 0) {
            for (const guestName of r.guest_ids) {
              insertGuest.run(roomId, guestName);
            }
          }
        }
      }

      // Create notification for HR Manager
      const hrManager = db.prepare("SELECT id FROM users WHERE role = 'HR_MANAGER'").get() as any;
      if (hrManager) {
        const user = db.prepare("SELECT name FROM users WHERE id = ?").get(user_id) as any;
        db.prepare(`
          INSERT INTO notifications (user_id, message, type, related_id)
          VALUES (?, ?, 'TRIP_REQUEST', ?)
        `).run(hrManager.id, `Nhân viên ${user.name} vừa gửi yêu cầu đi công tác mới tại ${destination}.`, tripId);
      }

      return tripId;
    });

    try {
      const id = transaction();
      res.json({ id });
    } catch (error) {
      console.error("Trip creation error:", error);
      res.status(500).json({ error: "Failed to create business trip" });
    }
  });

  app.put("/api/trips/:id", (req, res) => {
    const { id } = req.params;
    const { 
      destination, purpose, start_date, end_date, 
      city, hotel_check_in, hotel_check_out, notes,
      participants, rooms, followers 
    } = req.body;

    const transaction = db.transaction(() => {
      // Check if trip is still pending
      const trip = db.prepare("SELECT status FROM business_trips WHERE id = ?").get(id) as any;
      if (!trip || trip.status !== 'PENDING') {
        throw new Error("Cannot edit a trip that is not pending");
      }

      db.prepare(`
        UPDATE business_trips 
        SET destination = ?, purpose = ?, start_date = ?, end_date = ?, city = ?, 
            hotel_check_in = ?, hotel_check_out = ?, notes = ?, followers = ?
        WHERE id = ?
      `).run(destination, purpose, start_date, end_date, city, hotel_check_in, hotel_check_out, notes, JSON.stringify(followers || []), id);
      
      // Clear and re-insert participants and rooms
      db.prepare("DELETE FROM trip_participants WHERE trip_id = ?").run(id);
      const tripRooms = db.prepare("SELECT id FROM trip_rooms WHERE trip_id = ?").all(id) as any[];
      for (const r of tripRooms) {
        db.prepare("DELETE FROM trip_room_guests WHERE room_id = ?").run(r.id);
      }
      db.prepare("DELETE FROM trip_rooms WHERE trip_id = ?").run(id);

      if (participants && participants.length > 0) {
        const insertParticipant = db.prepare(`
          INSERT INTO trip_participants (trip_id, name, position, department, phone)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const p of participants) {
          insertParticipant.run(id, p.name, p.position, p.department, p.phone);
        }
      }

      if (rooms && rooms.length > 0) {
        const insertRoom = db.prepare(`
          INSERT INTO trip_rooms (trip_id, room_number, room_type)
          VALUES (?, ?, ?)
        `);
        const insertGuest = db.prepare(`
          INSERT INTO trip_room_guests (room_id, participant_name)
          VALUES (?, ?)
        `);

        for (const r of rooms) {
          const roomResult = insertRoom.run(id, r.room_number, r.room_type);
          const roomId = roomResult.lastInsertRowid;
          
          if (r.guest_ids && r.guest_ids.length > 0) {
            for (const guestName of r.guest_ids) {
              insertGuest.run(roomId, guestName);
            }
          }
        }
      }
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Trip update error:", error);
      res.status(400).json({ error: error.message || "Failed to update business trip" });
    }
  });

  app.delete("/api/trips/:id", (req, res) => {
    const { id } = req.params;
    const transaction = db.transaction(() => {
      // Check if trip is still pending
      const trip = db.prepare("SELECT status FROM business_trips WHERE id = ?").get(id) as any;
      if (!trip || trip.status !== 'PENDING') {
        throw new Error("Cannot delete a trip that is not pending");
      }

      db.prepare("DELETE FROM trip_participants WHERE trip_id = ?").run(id);
      const tripRooms = db.prepare("SELECT id FROM trip_rooms WHERE trip_id = ?").all(id) as any[];
      for (const r of tripRooms) {
        db.prepare("DELETE FROM trip_room_guests WHERE room_id = ?").run(r.id);
      }
      db.prepare("DELETE FROM trip_rooms WHERE trip_id = ?").run(id);
      db.prepare("DELETE FROM business_trips WHERE id = ?").run(id);
      db.prepare("DELETE FROM notifications WHERE related_id = ? AND type = 'TRIP_REQUEST'").run(id);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Trip deletion error:", error);
      res.status(400).json({ error: error.message || "Failed to delete business trip" });
    }
  });

  app.post("/api/trips/:id/approve", (req, res) => {
    const { id } = req.params;
    const { hr_id, comment, hotel_name, hotel_location } = req.body;
    
    try {
      const hr = db.prepare("SELECT role FROM users WHERE id = ?").get(hr_id) as any;
      if (!hr || hr.role !== 'HR_MANAGER') {
        return res.status(403).json({ error: "Only HR Managers can approve trips" });
      }

      db.prepare(`
        UPDATE business_trips 
        SET status = 'APPROVED', hr_comment = ?, hotel_name = ?, hotel_location = ?, processed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(comment, hotel_name, hotel_location, id);

      const trip = db.prepare("SELECT user_id, destination FROM business_trips WHERE id = ?").get(id) as any;
      db.prepare(`
        INSERT INTO notifications (user_id, message, type, related_id)
        VALUES (?, ?, 'TRIP_APPROVED', ?)
      `).run(trip.user_id, `Yêu cầu công tác đi ${trip.destination} của bạn đã được phê duyệt.`, id);

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to approve trip" });
    }
  });

  app.post("/api/trips/:id/reject", (req, res) => {
    const { id } = req.params;
    const { hr_id, comment } = req.body;
    
    try {
      const hr = db.prepare("SELECT role FROM users WHERE id = ?").get(hr_id) as any;
      if (!hr || hr.role !== 'HR_MANAGER') {
        return res.status(403).json({ error: "Only HR Managers can reject trips" });
      }

      db.prepare(`
        UPDATE business_trips 
        SET status = 'REJECTED', hr_comment = ?, processed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(comment, id);

      const trip = db.prepare("SELECT user_id, destination FROM business_trips WHERE id = ?").get(id) as any;
      db.prepare(`
        INSERT INTO notifications (user_id, message, type, related_id)
        VALUES (?, ?, 'TRIP_REJECTED', ?)
      `).run(trip.user_id, `Yêu cầu công tác đi ${trip.destination} của bạn đã bị từ chối. Lý do: ${comment}`, id);

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to reject trip" });
    }
  });

  app.get("/api/notifications", (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: "User ID is required" });
    
    const notifications = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(user_id);
    
    res.json(notifications);
  });

  app.post("/api/notifications/:id/read", (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // Vehicles
  app.get("/api/vehicles", (req, res) => {
    const { user_id, type } = req.query;
    let query = `
      SELECT DISTINCT v.*, u.name as user_name 
      FROM vehicle_bookings v
      JOIN users u ON v.user_id = u.id
      LEFT JOIN vehicle_participants vp ON v.id = vp.vehicle_id
    `;
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (user_id) {
      conditions.push("(v.user_id = ? OR vp.user_id = ?)");
      params.push(user_id, user_id);
    }
    if (type) {
      conditions.push("v.type = ?");
      params.push(type);
    }
    
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    
    const vehicles = db.prepare(query).all(...params) as any[];
    
    // Get participants for each vehicle booking
    const vehiclesWithParticipants = vehicles.map(v => {
      const participants = db.prepare(`
        SELECT vp.user_id, u.name as user_name, vp.status
        FROM vehicle_participants vp
        JOIN users u ON vp.user_id = u.id
        WHERE vp.vehicle_id = ?
      `).all(v.id) as any[];

      const external = db.prepare(`
        SELECT name FROM vehicle_external_participants WHERE vehicle_id = ?
      `).all(v.id) as any[];
      
      return { 
        ...v, 
        invited_participants: participants,
        external_participants: external.map(e => e.name)
      };
    });

    res.json(vehiclesWithParticipants);
  });

  app.post("/api/vehicles", (req, res) => {
    const { user_id, pickup_location, destination, pickup_time, passengers, invited_user_ids, external_participants } = req.body;
    
    const transaction = db.transaction((bookingData, participants, external) => {
      const bookingCode = generateBookingCode('BC');
      const result = db.prepare(`
        INSERT INTO vehicle_bookings (booking_code, user_id, type, pickup_location, destination, pickup_time, passengers)
        VALUES (?, ?, 'DAILY', ?, ?, ?, ?)
      `).run(bookingCode, bookingData.user_id, bookingData.pickup_location, bookingData.destination, bookingData.pickup_time, bookingData.passengers);
      
      const vehicleId = result.lastInsertRowid;
      
      if (participants && participants.length > 0) {
        const insertParticipant = db.prepare(`
          INSERT INTO vehicle_participants (vehicle_id, user_id, status)
          VALUES (?, ?, 'PENDING')
        `);
        for (const uid of participants) {
          if (uid !== bookingData.user_id) {
            insertParticipant.run(vehicleId, uid);
          }
        }
      }

      if (external && external.length > 0) {
        const insertExternal = db.prepare(`
          INSERT INTO vehicle_external_participants (vehicle_id, name)
          VALUES (?, ?)
        `);
        for (const name of external) {
          if (name.trim()) {
            insertExternal.run(vehicleId, name.trim());
          }
        }
      }
      
      return vehicleId;
    });

    try {
      const id = transaction({ user_id, pickup_location, destination, pickup_time, passengers }, invited_user_ids, external_participants);
      res.json({ id });
    } catch (error) {
      console.error("Vehicle booking error:", error);
      res.status(500).json({ error: "Failed to create vehicle booking" });
    }
  });

  app.put("/api/vehicles/:id", (req, res) => {
    const { id } = req.params;
    const { 
      pickup_location, destination, pickup_time, passengers, 
      invited_user_ids, external_participants 
    } = req.body;

    const transaction = db.transaction(() => {
      const vehicle = db.prepare("SELECT status FROM vehicle_bookings WHERE id = ?").get(id) as any;
      if (!vehicle || vehicle.status !== 'PENDING') {
        throw new Error("Cannot edit a booking that is not pending");
      }

      db.prepare(`
        UPDATE vehicle_bookings 
        SET pickup_location = ?, destination = ?, pickup_time = ?, passengers = ?
        WHERE id = ?
      `).run(pickup_location, destination, pickup_time, passengers, id);

      db.prepare("DELETE FROM vehicle_participants WHERE vehicle_id = ?").run(id);
      db.prepare("DELETE FROM vehicle_external_participants WHERE vehicle_id = ?").run(id);

      if (invited_user_ids && Array.isArray(invited_user_ids)) {
        const insertParticipant = db.prepare("INSERT INTO vehicle_participants (vehicle_id, user_id, status) VALUES (?, ?, 'PENDING')");
        invited_user_ids.forEach(uid => insertParticipant.run(id, uid));
      }

      if (external_participants && Array.isArray(external_participants)) {
        const insertExternal = db.prepare("INSERT INTO vehicle_external_participants (vehicle_id, name) VALUES (?, ?)");
        external_participants.forEach(name => insertExternal.run(id, name));
      }
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Vehicle update error:", error);
      res.status(400).json({ error: error.message || "Failed to update vehicle booking" });
    }
  });

  app.delete("/api/vehicles/:id", (req, res) => {
    const { id } = req.params;
    const transaction = db.transaction(() => {
      const vehicle = db.prepare("SELECT status FROM vehicle_bookings WHERE id = ?").get(id) as any;
      if (!vehicle || vehicle.status !== 'PENDING') {
        throw new Error("Cannot delete a booking that is not pending");
      }

      db.prepare("DELETE FROM vehicle_participants WHERE vehicle_id = ?").run(id);
      db.prepare("DELETE FROM vehicle_external_participants WHERE vehicle_id = ?").run(id);
      db.prepare("DELETE FROM vehicle_bookings WHERE id = ?").run(id);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Vehicle deletion error:", error);
      res.status(400).json({ error: error.message || "Failed to delete vehicle booking" });
    }
  });

  app.post("/api/vehicles/:id/approve", (req, res) => {
    const { id } = req.params;
    const { hr_id, comment } = req.body;
    
    try {
      const hr = db.prepare("SELECT role FROM users WHERE id = ?").get(hr_id) as any;
      if (!hr || hr.role !== 'HR_MANAGER') {
        return res.status(403).json({ error: "Chỉ Khối HCTH-DVHS mới có quyền phê duyệt đặt xe" });
      }

      db.prepare(`
        UPDATE vehicle_bookings 
        SET status = 'APPROVED', hr_comment = ?, processed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(comment, id);

      const v = db.prepare("SELECT user_id, destination FROM vehicle_bookings WHERE id = ?").get(id) as any;
      db.prepare(`
        INSERT INTO notifications (user_id, message, type, related_id)
        VALUES (?, ?, 'VEHICLE_APPROVED', ?)
      `).run(v.user_id, `Yêu cầu đặt xe đi ${v.destination} của bạn đã được phê duyệt.`, id);

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to approve vehicle booking" });
    }
  });

  app.post("/api/vehicles/:id/reject", (req, res) => {
    const { id } = req.params;
    const { hr_id, comment } = req.body;
    
    try {
      const hr = db.prepare("SELECT role FROM users WHERE id = ?").get(hr_id) as any;
      if (!hr || hr.role !== 'HR_MANAGER') {
        return res.status(403).json({ error: "Chỉ Khối HCTH-DVHS mới có quyền từ chối đặt xe" });
      }

      db.prepare(`
        UPDATE vehicle_bookings 
        SET status = 'REJECTED', hr_comment = ?, processed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(comment, id);

      const v = db.prepare("SELECT user_id, destination FROM vehicle_bookings WHERE id = ?").get(id) as any;
      db.prepare(`
        INSERT INTO notifications (user_id, message, type, related_id)
        VALUES (?, ?, 'VEHICLE_REJECTED', ?)
      `).run(v.user_id, `Yêu cầu đặt xe đi ${v.destination} của bạn đã bị từ chối. Lý do: ${comment}`, id);

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to reject vehicle booking" });
    }
  });

  app.post("/api/suggest", (req, res) => {
    const { participants, location, start_time, end_time } = req.body;

    // Find rooms that fit capacity and location (if specified)
    // AND are NOT booked during the requested time
    let query = `
      SELECT * FROM rooms 
      WHERE capacity >= ?
    `;
    const params: any[] = [participants];

    if (location && location !== "Tất cả") {
      query += " AND location = ?";
      params.push(location);
    }

    query += `
      AND id NOT IN (
        SELECT room_id FROM bookings 
        WHERE (
          (start_time < ? AND end_time > ?) OR
          (start_time < ? AND end_time > ?) OR
          (start_time >= ? AND end_time <= ?)
        )
      )
      ORDER BY capacity ASC
      LIMIT 5
    `;
    params.push(end_time, start_time, start_time, start_time, start_time, end_time);

    const suggestions = db.prepare(query).all(...params);
    res.json(suggestions);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
