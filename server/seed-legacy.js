import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createDatabase } from "./db.js";
import { pathToFileURL } from "node:url";
export const now = () => new Date().toISOString();
export async function seed(db) {
  if (await db.get("SELECT id FROM users LIMIT 1")) return;
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seed is disabled in production");
  const password = await bcrypt.hash("HostelHub@123", 12);
  for (const [id, name, email, role] of [
    ["user-demo", "Aarav Sharma", "user@hostelhub.test", "user"],
    ["owner-demo", "Priya Raman", "owner@hostelhub.test", "owner"],
    ["admin-demo", "Hostel Hub Admin", "admin@hostelhub.test", "admin"],
  ])
    await db.run(
      "INSERT INTO users (id,name,email,password,role,phone,bio,created_at) VALUES (?,?,?,?,?,?,?,?)",
      [id, name, email, password, role, "9000000000", "Demo account", now()],
    );
  const homes = [
    [
      "The Greenhouse",
      "Chennai",
      "Sholinganallur",
      "Co-living",
      6500,
      12.8996,
      80.2279,
      "photo-1522708323590-d24dbb6b0267",
      "A little room to grow. A lot of room to belong. Bright shared spaces, quiet study corners and home-style meals near the OMR tech corridor.",
      ["Wi-Fi", "Food", "Laundry", "Security", "Parking", "Power backup"],
      "SSN College · 12 km, SIPCOT IT Park · 4 km",
    ],
    [
      "Olive House",
      "Chennai",
      "Navalur",
      "Girls",
      7800,
      12.8446,
      80.2269,
      "photo-1611892440504-42a792e24d32",
      "A calm, welcoming home with airy rooms, attentive on-site staff and a community of students and young professionals.",
      ["Wi-Fi", "Food", "Security", "Laundry"],
      "SSN College · 5 km, The Marina Mall · 2 km",
    ],
    [
      "The Common Room",
      "Bengaluru",
      "Koramangala",
      "Co-living",
      10500,
      12.9345,
      77.6266,
      "photo-1555854877-bab0e564b8d5",
      "Meet your people in a thoughtfully designed home, with coworking corners, communal dinners and an easy city commute.",
      ["Wi-Fi", "Security", "Parking", "Gym", "Power backup"],
      "Christ University · 3 km, Forum Mall · 1 km",
    ],
    [
      "Cedar Student Living",
      "Chennai",
      "Kelambakkam",
      "Boys",
      5500,
      12.7878,
      80.2194,
      "photo-1540518614846-7eded433c457",
      "Simple comforts for your next chapter. Affordable beds, reliable Wi-Fi and fresh daily meals close to campus.",
      ["Wi-Fi", "Food", "Parking", "Security"],
      "SSN College · 3 km, Hindustan University · 2 km",
    ],
    [
      "Juniper Residency",
      "Hyderabad",
      "Gachibowli",
      "Girls",
      8200,
      17.4401,
      78.3489,
      "photo-1566665797739-1674de7a421a",
      "Space to settle in, with cosy rooms, a rooftop lounge and everything you need for a comfortable everyday routine.",
      ["Wi-Fi", "Food", "Laundry", "Security", "Gym"],
      "University of Hyderabad · 4 km, DLF Cyber City · 2 km",
    ],
    [
      "Sunday House",
      "Bengaluru",
      "HSR Layout",
      "Boys",
      9000,
      12.9116,
      77.6389,
      "photo-1560448204-e02f11c3d0e2",
      "Your easy-going city base with spacious rooms, a shared kitchen and a sunny terrace for slow weekends.",
      ["Wi-Fi", "Parking", "Laundry", "Security"],
      "Sector 7 offices · 1 km, Silk Board · 2 km",
    ],
    [
      "Maple House",
      "Chennai",
      "Thoraipakkam",
      "Co-living",
      7200,
      12.9416,
      80.2362,
      "photo-1505693416388-ac5ce068fe85",
      "A fresh new home awaiting document review. This sample listing demonstrates the admin verification queue.",
      ["Wi-Fi", "Food", "Security"],
      "OMR offices · 2 km",
    ],
  ];
  for (let i = 0; i < homes.length; i++) {
    const [name, city, area, gender, rent, lat, lng, photo, desc, fac, nearby] =
      homes[i];
    const id = `hostel-${i + 1}`;
    await db.run(
      "INSERT INTO hostels (id,owner_id,name,city,area,address,description,gender,facilities,photos,deposit,discount,latitude,longitude,nearby,check_in,check_out,contact,refund_policy,status,verification_note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        "owner-demo",
        name,
        city,
        area,
        `${12 + i * 7}, Sample Avenue, ${area}, ${city}`,
        desc,
        gender,
        JSON.stringify(fac),
        JSON.stringify([
          `/images/room-${i + 1}.jpg`,
          "/images/lounge.jpg",
          "/images/room-2.jpg",
        ]),
        3000,
        i === 0 ? 5 : 0,
        lat,
        lng,
        nearby,
        "12:00",
        "10:00",
        "9000000000",
        "Full refund before move-in. After move-in, the deposit is refundable; rent is non-refundable.",
        i === 6 ? "pending" : "approved",
        i === 6
          ? "Awaiting owner documents"
          : "Seeded demonstration listing; not a real verification.",
        now(),
      ],
    );
    for (const [sharing, extra, capacity] of [
      [3, 0, 6],
      [2, 2000, 4],
      [1, 5500, 2],
    ])
      await db.run(
        "INSERT INTO rooms (id,hostel_id,name,sharing,rent,capacity,ac) VALUES (?,?,?,?,?,?,?)",
        [
          `${id}-room-${sharing}`,
          id,
          `${sharing === 1 ? "Private" : sharing === 2 ? "Twin" : "Triple"} room`,
          sharing,
          rent + extra,
          capacity,
          sharing === 1 ? 1 : 0,
        ],
      );
  }
  await db.run(
    "INSERT INTO bookings (id,user_id,hostel_id,room_id,start_date,end_date,status,rent,deposit,total,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      "booking-demo",
      "user-demo",
      "hostel-1",
      "hostel-1-room-2",
      "2026-01-01",
      "2026-02-01",
      "completed",
      8500,
      3000,
      11500,
      now(),
      now(),
    ],
  );
  await db.run(
    "INSERT INTO payments (id,booking_id,user_id,kind,amount,status,provider,reference,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [
      randomUUID(),
      "booking-demo",
      "user-demo",
      "booking",
      11500,
      "paid",
      "demo",
      "demo-seed",
      now(),
    ],
  );
  await db.run(
    "INSERT INTO notifications (id,user_id,title,body,created_at) VALUES (?,?,?,?,?)",
    [
      randomUUID(),
      "user-demo",
      "Welcome to your next chapter",
      "Explore sample homes, save your favourites and try a demo booking. No real money is charged.",
      now(),
    ],
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const db = await createDatabase();
  await seed(db);
  await db.close();
  console.log(
    "Demo data ready. Accounts: user@hostelhub.test, owner@hostelhub.test, admin@hostelhub.test. Password: HostelHub@123",
  );
}
