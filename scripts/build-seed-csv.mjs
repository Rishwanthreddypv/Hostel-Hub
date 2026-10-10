import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { stringifyCSV } from "../server/csv.js";

const out = resolve("seed-data");
if (
  existsSync(resolve(out, "manifest.json")) &&
  !process.argv.includes("--replace-generated")
)
  throw new Error(
    "CSV files already exist. Edit them directly, or explicitly use --replace-generated to regenerate the synthetic source.",
  );
mkdirSync(out, { recursive: true });
const reference = new Date().toISOString().slice(0, 10);
const stamp = (days, hour = 10) =>
  new Date(
    Date.parse(reference + "T00:00:00Z") + days * 86400000 + hour * 3600000,
  ).toISOString();
const day = (n) => stamp(n).slice(0, 10);
const names = [
  "Priya Raman",
  "Arjun Menon",
  "Kavitha Narayanan",
  "Rohan Deshmukh",
  "Nandini Rao",
  "Vikram Iyer",
  "Meera Shah",
  "Sanjay Reddy",
  "Ananya Krishnan",
  "Farhan Ahmed",
  "Rahul Sharma",
  "Sneha Patel",
  "Karthik Kumar",
  "Ayesha Khan",
  "Ravi Singh",
  "Pooja Joshi",
  "Amitabh Desai",
  "Siddharth Verma",
  "Neha Gupta",
  "Vijay Nair",
  "Anil Kapoor",
  "Sunita Williams",
  "Kamal Haasan",
  "Rajinikanth",
  "Shah Rukh Khan",
  "Amitabh Bachchan",
  "Sachin Tendulkar",
  "Virat Kohli",
  "MS Dhoni",
  "Rohit Sharma",
  "Ajay Devgn",
  "Alia Bhatt",
  "Deepika Padukone",
  "Ranveer Singh",
  "Akshay Kumar",
  "Kareena Kapoor",
  "Hrithik Roshan",
  "Salman Khan",
  "Katrina Kaif",
  "Ranbir Kapoor",
];
const brands = [
  "Aaram Living",
  "Nest & Neighbour",
  "Mango Tree Stays",
  "Sahyadri Student Homes",
  "Urban Courtyard",
  "Sukoon Residences",
  "Parkside Living",
  "Deccan House",
  "Campus Corner",
  "The Common Table",
  "Sunrise Stays",
  "Moonlight Residences",
  "Oasis Co-living",
  "Zenith Homes",
  "Harmony PG",
  "Breeze Hostel",
  "Crest View Living",
  "Pioneer Student Housing",
  "Elite Rooms",
  "Metro Hostels",
  "Star Hostels",
  "Galaxy Residences",
  "Universe Living",
  "Superstar Stays",
  "Champion Homes",
  "Legendary Accommodations",
  "Master PG",
  "King Co-living",
  "Captain's Quarters",
  "Hitman Hostels",
  "Royal Residences",
  "Grand Hostels",
  "Imperial Stays",
  "Majestic Living",
  "Noble PG",
  "Crown Co-living",
  "Regal Homes",
  "Palace Hostels",
  "Diamond Rooms",
  "Platinum PG",
];
const owners = names.map((name, i) => ({
  id: `csv-owner-${String(i + 1).padStart(2, "0")}`,
  name,
  email: `${name.toLowerCase().replaceAll(" ", ".")}@hostelhub.test`,
  phone: "",
  bio: `Founder of ${brands[i]}. We manage furnished homes for students and working professionals, with an on-site caretaker and scheduled housekeeping.`,
  status: "active",
  plan: ["Pro", "Advanced", "Basic"][i % 3],
  created_at: stamp(-500 + i * 7),
}));
const first = [
  "Aarav",
  "Diya",
  "Aditya",
  "Ishita",
  "Karthik",
  "Sneha",
  "Rahul",
  "Anjali",
  "Vivek",
  "Riya",
  "Surya",
  "Pooja",
  "Nikhil",
  "Keerthana",
  "Manoj",
  "Aditi",
  "Pranav",
  "Divya",
  "Varun",
  "Sanjana",
];
const last = [
  "Sharma",
  "Iyer",
  "Menon",
  "Reddy",
  "Patel",
  "Nair",
  "Rao",
  "Krishnan",
  "Joshi",
  "Das",
  "Kumar",
  "Pillai",
  "Shah",
  "Bose",
  "Kulkarni",
];
const guests = Array.from({ length: 60 }, (_, i) => ({
  id: `csv-guest-${String(i + 1).padStart(3, "0")}`,
  name: `${first[i % 20]} ${last[(i * 7 + Math.floor(i / 20)) % 15]}`,
  email: `resident.${String(i + 1).padStart(3, "0")}@hostelhub.test`,
  phone: "",
  bio: [
    "Postgraduate student looking for a quiet study environment.",
    "Software engineer relocating for a new role.",
    "Design student who enjoys cooking and weekend walks.",
    "Graduate trainee seeking an easy commute.",
    "Research scholar looking for reliable Wi-Fi and a calm home.",
  ][i % 5],
  status: i === 59 ? "suspended" : "active",
  plan: "Basic",
  created_at: stamp(-430 + i),
}));
const catalog = [
  [
    "Chennai",
    "Sholinganallur",
    "Aaram OMR House",
    12.8996,
    80.2279,
    "OMR technology corridor",
    7200,
  ],
  [
    "Chennai",
    "Navalur",
    "Mango Tree Women’s Residence",
    12.8446,
    80.2269,
    "Navalur colleges and offices",
    6400,
  ],
  [
    "Chennai",
    "Velachery",
    "Courtyard Velachery",
    12.975,
    80.2212,
    "Velachery station and Taramani offices",
    8100,
  ],
  [
    "Chennai",
    "Porur",
    "Sukoon Porur",
    13.0359,
    80.1576,
    "Porur business district",
    6700,
  ],
  [
    "Chennai",
    "Guindy",
    "Parkside Guindy",
    13.0067,
    80.2206,
    "Guindy industrial estate",
    8500,
  ],
  [
    "Bengaluru",
    "Koramangala",
    "Nest Koramangala",
    12.9345,
    77.6266,
    "Koramangala colleges and workplaces",
    11500,
  ],
  [
    "Bengaluru",
    "HSR Layout",
    "The Common Table HSR",
    12.9116,
    77.6389,
    "HSR Layout offices",
    10500,
  ],
  [
    "Bengaluru",
    "Whitefield",
    "Urban Courtyard Whitefield",
    12.9698,
    77.75,
    "Whitefield technology parks",
    9800,
  ],
  [
    "Bengaluru",
    "Electronic City",
    "Campus Corner E-City",
    12.8399,
    77.677,
    "Electronic City offices",
    7900,
  ],
  [
    "Bengaluru",
    "Marathahalli",
    "Parkside Marathahalli",
    12.9592,
    77.6974,
    "Outer Ring Road workplaces",
    9400,
  ],
  [
    "Hyderabad",
    "Gachibowli",
    "Deccan House Gachibowli",
    17.4401,
    78.3489,
    "Gachibowli offices and university area",
    8400,
  ],
  [
    "Hyderabad",
    "Madhapur",
    "Sukoon Madhapur",
    17.4483,
    78.3915,
    "HITEC City employment district",
    9100,
  ],
  [
    "Hyderabad",
    "Kondapur",
    "Mango Tree Kondapur",
    17.4622,
    78.3568,
    "Kondapur offices",
    7800,
  ],
  [
    "Hyderabad",
    "Kukatpally",
    "Nest Kukatpally",
    17.4948,
    78.3996,
    "Kukatpally colleges and metro corridor",
    6500,
  ],
  [
    "Hyderabad",
    "Manikonda",
    "Aaram Manikonda",
    17.4015,
    78.3725,
    "Manikonda neighbourhood offices",
    7200,
  ],
  [
    "Pune",
    "Hinjawadi",
    "Sahyadri Hinjawadi",
    18.5913,
    73.7389,
    "Hinjawadi technology parks",
    7600,
  ],
  [
    "Pune",
    "Kharadi",
    "Courtyard Kharadi",
    18.551,
    73.9348,
    "Kharadi business district",
    8800,
  ],
  [
    "Pune",
    "Viman Nagar",
    "Parkside Viman Nagar",
    18.5679,
    73.9143,
    "Viman Nagar colleges",
    9300,
  ],
  [
    "Pune",
    "Wakad",
    "Sahyadri Wakad",
    18.598,
    73.7636,
    "Wakad and Hinjawadi commute",
    6900,
  ],
  [
    "Pune",
    "Baner",
    "The Common Table Baner",
    18.559,
    73.7868,
    "Baner offices and cafes",
    10200,
  ],
  [
    "Coimbatore",
    "Peelamedu",
    "Campus Corner Peelamedu",
    11.022,
    77.004,
    "Peelamedu colleges",
    5500,
  ],
  [
    "Coimbatore",
    "Saravanampatti",
    "Aaram Saravanampatti",
    11.082,
    76.997,
    "Saravanampatti technology corridor",
    5800,
  ],
  [
    "Coimbatore",
    "Gandhipuram",
    "Nest Gandhipuram",
    11.018,
    76.967,
    "Gandhipuram transport connections",
    5200,
  ],
  [
    "Coimbatore",
    "Saibaba Colony",
    "Mango Tree Saibaba Colony",
    11.031,
    76.947,
    "Saibaba Colony neighbourhood",
    6400,
  ],
  [
    "Delhi",
    "Connaught Place",
    "Star Hostels CP",
    28.6304,
    77.2177,
    "CP Metro Station",
    8000,
  ],
  [
    "Delhi",
    "Hauz Khas",
    "Galaxy Residences Hauz Khas",
    28.5494,
    77.2001,
    "Hauz Khas Village",
    9000,
  ],
  [
    "Delhi",
    "Saket",
    "Universe Living Saket",
    28.5245,
    77.2066,
    "Saket Malls",
    8500,
  ],
  [
    "Mumbai",
    "Bandra",
    "Superstar Stays Bandra",
    19.0596,
    72.8295,
    "Bandra Kurla Complex",
    15000,
  ],
  [
    "Mumbai",
    "Andheri",
    "Champion Homes Andheri",
    19.1136,
    72.8697,
    "Andheri Station",
    12000,
  ],
  [
    "Mumbai",
    "Juhu",
    "Legendary Accommodations Juhu",
    19.1075,
    72.8263,
    "Juhu Beach",
    18000,
  ],
  [
    "Kolkata",
    "Salt Lake",
    "Master PG Salt Lake",
    22.5804,
    88.4143,
    "Salt Lake Sector V",
    7000,
  ],
  [
    "Kolkata",
    "New Town",
    "King Co-living New Town",
    22.5833,
    88.4608,
    "New Town IT Hub",
    6500,
  ],
  [
    "Chennai",
    "Adyar",
    "Captain's Quarters Adyar",
    13.0012,
    80.2565,
    "Adyar Bus Depot",
    8000,
  ],
  [
    "Chennai",
    "Besant Nagar",
    "Hitman Hostels Besant Nagar",
    13.0003,
    80.2736,
    "Elliot's Beach",
    9000,
  ],
  [
    "Ahmedabad",
    "Navrangpura",
    "Royal Residences Navrangpura",
    23.0366,
    72.5469,
    "Gujarat University area",
    7500,
  ],
  [
    "Ahmedabad",
    "Vastrapur",
    "Grand Hostels Vastrapur",
    23.0352,
    72.5298,
    "Vastrapur Lake",
    8200,
  ],
  [
    "Jaipur",
    "Malviya Nagar",
    "Imperial Stays Malviya Nagar",
    26.8530,
    75.8047,
    "Malviya Nagar industrial area",
    6000,
  ],
  [
    "Jaipur",
    "Mansarovar",
    "Majestic Living Mansarovar",
    26.8530,
    75.7628,
    "Mansarovar Metro",
    5500,
  ],
  [
    "Chandigarh",
    "Sector 17",
    "Noble PG Sector 17",
    30.7398,
    76.7827,
    "Sector 17 Plaza",
    9000,
  ],
  [
    "Chandigarh",
    "Sector 35",
    "Crown Co-living Sector 35",
    30.7259,
    76.7645,
    "Sector 35 Market",
    8500,
  ],
  [
    "Kochi",
    "Kakkanad",
    "Regal Homes Kakkanad",
    10.0166,
    76.3475,
    "Infopark Kochi",
    6500,
  ],
  [
    "Kochi",
    "Edappally",
    "Palace Hostels Edappally",
    10.0261,
    76.3125,
    "Lulu Mall",
    7000,
  ],
  [
    "Indore",
    "Vijay Nagar",
    "Diamond Rooms Vijay Nagar",
    22.7533,
    75.8937,
    "Vijay Nagar Square",
    5500,
  ],
  [
    "Indore",
    "Bhawarkua",
    "Platinum PG Bhawarkua",
    22.6958,
    75.8722,
    "Bhawarkua Student Area",
    5000,
  ],
];
const hostels = [],
  rooms = [],
  photos = [],
  amenities = [],
  documents = [];
catalog.forEach(([city, area, name, latitude, longitude, nearby, base], i) => {
  const id = `csv-hostel-${String(i + 1).padStart(2, "0")}`,
    owner = owners[i % owners.length];
  const status =
    { 3: "pending", 8: "pending", 13: "draft", 18: "rejected" }[i] ||
    "approved";
  const gender = ["Co-living", "Girls", "Boys"][i % 3];
  hostels.push({
    id,
    owner_id: owner.id,
    name,
    city,
    area,
    address: `${21 + i * 3}, Fictional Residency Lane, ${area}, ${city} (illustrative address)`,
    description: `${name} is a ${gender === "Girls" ? "women’s" : gender === "Boys" ? "men’s" : "shared"} residence in ${area}, designed around an easy daily routine. Rooms include a bed, storage, study desk and fan. ${i % 2 ? "Shared lounges and a reading corner make it easy to settle in." : "A caretaker is available during the day, with security at the entrance overnight."} Housekeeping runs ${i % 2 ? "three times a week" : "on alternate days"}. ${i % 3 ? "Meals are prepared on site with a rotating weekly menu." : "Residents have access to a shared kitchen."} Quiet hours start at 10:30 pm. Visitors sign in at reception. Photos and addresses are illustrative.`,
    gender,
    deposit: Math.round((base * (i % 3 === 0 ? 1 : 0.5)) / 500) * 500,
    discount: i % 6 === 0 ? 5 : 0,
    latitude,
    longitude,
    nearby: `Convenient for the ${nearby}. Map pin is an approximate neighbourhood location.`,
    check_in: "12:00",
    check_out: "10:00",
    contact: "Not available in demo",
    refund_policy:
      "Full refund before move-in. On or after move-in, only the deposit is refundable. Monthly rent is due separately after the first month.",
    status,
    verification_note:
      status === "approved"
        ? "Sample documents reviewed for this fictional demonstration property."
        : status === "rejected"
          ? "Please replace the blurred sample address proof and confirm the room inventory."
          : "Awaiting review of sample ownership documents.",
    created_at: stamp(-400 + i * 4),
    min_stay_days: 30,
    food_charge: i % 3 ? 1800 + (i % 4) * 200 : 0,
    service_charge: i % 4 === 0 ? 400 : 0,
    tax_percent: 0,
  });
  for (let sharing = 1; sharing <= 4; sharing++)
    rooms.push({
      id: `${id}-r${sharing}`,
      hostel_id: id,
      name: [
        "",
        "Private studio",
        "Twin sharing",
        "Triple sharing",
        "Four sharing",
      ][sharing],
      sharing,
      rent: base + [0, 6500, 2500, 800, 0][sharing],
      capacity: sharing * (1 + ((i + sharing) % 3)),
      ac: sharing <= 2 && i % 3 !== 1 ? 1 : 0,
    });
  [
    `/images/room-${(i % 7) + 1}.jpg`,
    "/images/lounge.jpg",
    `/images/room-${((i + 3) % 7) + 1}.jpg`,
  ].forEach((path, j) =>
    photos.push({
      id: `${id}-photo-${j}`,
      hostel_id: id,
      path,
      caption:
        j === 1
          ? "Shared lounge (illustrative)"
          : "Furnished bedroom (illustrative)",
      position: j,
    }),
  );
  [
    "Wi-Fi",
    "Security",
    "Housekeeping",
    ...(i % 3 ? ["Food"] : ["Kitchen"]),
    ...(i % 2 ? ["Laundry", "Power backup"] : ["Parking"]),
    ...(i % 7 === 0 ? ["Gym"] : []),
  ].forEach((facility, j) =>
    amenities.push({ id: `${id}-amenity-${j}`, hostel_id: id, facility }),
  );
  if (status !== "draft")
    documents.push({
      id: `${id}-document`,
      hostel_id: id,
      owner_id: owner.id,
      name: `Sample property declaration — ${name}`,
      path: `seed-${id}.txt`,
      mime: "text/plain",
      created_at: stamp(-395 + i * 4),
    });
});
const bookings = [],
  payments = [],
  attempts = [],
  events = [],
  reviews = [],
  messages = [],
  notifications = [],
  complaints = [],
  audit = [],
  wishlist = [];
const reviewTexts = [
  "The study desk and reliable Wi-Fi made working from home easy. Housekeeping was regular, although evenings in the lounge could be busy.",
  "The caretaker helped with my early arrival. Food was simple and portions were good. More variety at breakfast would help.",
  "A convenient commute and a comfortable bed. Storage was sufficient for a semester; laundry takes a little planning on weekends.",
  "The shared kitchen was useful and the common areas were kept tidy. Water pressure was lower during the morning rush.",
  "I liked the quiet hours and the separate study corner. The room matched the description and the deposit terms were explained clearly.",
  "Friendly residents and a helpful on-site team. The room had good light. Parking was limited when everyone returned in the evening.",
];
function addEvent(b, actor, event, status, at, note = "") {
  events.push({
    id: `${b.id}-e${events.filter((e) => e.booking_id === b.id).length}`,
    booking_id: b.id,
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role || "user",
    event,
    status,
    note,
    created_at: at,
  });
}
const published = hostels.filter((h) => h.status === "approved");
for (let i = 0; i < published.length; i++)
  for (let j = 0; j < 12; j++) {
    const h = published[i],
      owner = { ...owners.find((o) => o.id === h.owner_id), role: "owner" },
      g = guests[(i * 3 + (j % 3)) % guests.length];
    const status =
      j < 6
        ? "completed"
        : j < 8
          ? "confirmed"
          : j === 8
            ? "confirmed"
            : j === 9
              ? "pending_owner"
              : j === 10
                ? "awaiting_payment"
                : [
                    "refund_pending",
                    "refunded",
                    "cancelled",
                    "rejected",
                    "expired",
                  ][i % 5];
    const start =
      j < 6
        ? -300 + j * 35
        : j < 8
          ? j === 6
            ? -10
            : -25
          : j === 8
            ? 3 + (i % 4)
            : j === 9
              ? 75
              : j === 10
                ? 115
                : 155;
    const created =
      j < 6 ? start - 12 : j < 8 ? start - 5 : j === 8 ? -3 : j <= 10 ? 0 : -4;
    const r = rooms.find(
      (r) => r.hostel_id === h.id && r.sharing === (j < 8 ? 3 : 2),
    );
    const quantity =
      j >= 6 && j < 8 ? Math.min(1 + (i % 2), Math.floor(r.capacity / 2)) : 1;
    const gross = r.rent * quantity,
      discount_amount = Math.round((gross * h.discount) / 100),
      rent = gross - discount_amount,
      food_charge = h.food_charge * quantity,
      service_charge = h.service_charge * quantity;
    const b = {
      id: `csv-booking-${String(i * 12 + j + 1).padStart(4, "0")}`,
      user_id: g.id,
      hostel_id: h.id,
      room_id: r.id,
      start_date: day(start),
      end_date: day(start + 30),
      status,
      rent,
      deposit: h.deposit * quantity,
      total: rent + h.deposit * quantity + food_charge + service_charge,
      refund_amount: ["refund_pending", "refunded"].includes(status)
        ? rent + h.deposit * quantity + food_charge + service_charge
        : 0,
      expires_at: j === 9 || j === 10 ? stamp(1, 8) : stamp(created + 1, 8),
      created_at: stamp(created, 0),
      flow_version: 2,
      quantity,
      monthly_rent: rent,
      food_charge,
      service_charge,
      discount_amount,
      tax_amount: 0,
      min_stay_days: 30,
      guest_note: [
        "I will arrive after my afternoon train.",
        "Please let me know the meal timings.",
        "I work early shifts and prefer a quiet room.",
        "I would like a desk near the window if available.",
      ][j % 4],
      approved_at: j === 9 || status === "rejected" ? "" : stamp(created, 1),
    };
    bookings.push(b);
    addEvent(b, g, "reserved", "pending_owner", b.created_at, b.guest_note);
    const paid = [
      "completed",
      "confirmed",
      "refund_pending",
      "refunded",
    ].includes(status);
    if (b.approved_at)
      addEvent(
        b,
        owner,
        "approve",
        "awaiting_payment",
        b.approved_at,
        "Your room request has been accepted. Please complete payment within 24 hours.",
      );
    if (paid || j === 10) {
      const method = ["upi", "card", "netbanking"][(i + j) % 3];
      if ((i + j) % 3 === 0 || j === 10) {
        attempts.push({
          id: `${b.id}-attempt-f`,
          booking_id: b.id,
          user_id: g.id,
          idempotency_key: `seed-failed-${b.id}`,
          method,
          outcome: "failure",
          status: "failed",
          amount: b.total,
          created_at: stamp(created, 2),
          ready_at: stamp(created, 2),
          completed_at: stamp(created, 2),
        });
        addEvent(
          b,
          g,
          "payment_failed",
          "awaiting_payment",
          stamp(created, 2),
          "The demo bank declined this attempt. No charge was recorded.",
        );
      }
      if (paid) {
        attempts.push({
          id: `${b.id}-attempt-p`,
          booking_id: b.id,
          user_id: g.id,
          idempotency_key: `seed-paid-${b.id}`,
          method,
          outcome: "success",
          status: "paid",
          amount: b.total,
          created_at: stamp(created, 3),
          ready_at: stamp(created, 3),
          completed_at: stamp(created, 3),
        });
        payments.push({
          id: `${b.id}-payment`,
          booking_id: b.id,
          user_id: g.id,
          kind: "booking",
          amount: b.total,
          status: status === "refunded" ? "refunded" : "paid",
          provider: "demo",
          reference: `HH-SAMPLE-${String(i * 12 + j + 1).padStart(6, "0")}`,
          created_at: stamp(created, 3),
          method,
          refunded_at: status === "refunded" ? stamp(created + 1, 6) : "",
        });
        addEvent(
          b,
          g,
          "payment_received",
          "confirmed",
          stamp(created, 3),
          "Demo payment received. No money transferred.",
        );
      }
    }
    if (status === "completed") {
      addEvent(b, owner, "complete", status, stamp(start + 30, 12));
      if (j < 5)
        reviews.push({
          id: `${b.id}-review`,
          user_id: g.id,
          hostel_id: h.id,
          booking_id: b.id,
          rating: [5, 4, 4, 3, 5, 4][(i + j) % 6],
          body: reviewTexts[(i + j) % 6],
          status: (i + j) % 17 === 0 ? "hidden" : "published",
          created_at: stamp(start + 31, 14),
        });
    }
    if (["cancelled", "refund_pending", "refunded"].includes(status))
      addEvent(
        b,
        g,
        "cancel",
        paid ? "refund_pending" : "cancelled",
        stamp(created, 5),
        "My joining date changed and I need to postpone relocation.",
      );
    if (status === "rejected")
      addEvent(
        b,
        owner,
        "reject",
        "rejected",
        stamp(created, 5),
        "The room is unavailable during planned maintenance. Please choose a later move-in date.",
      );
    if (status === "refunded")
      addEvent(
        b,
        { id: "admin-demo", name: "Hostel Hub Admin", role: "admin" },
        "refund",
        "refunded",
        stamp(created + 1, 6),
        "Demo refund recorded.",
      );
    notifications.push({
      id: `${b.id}-notice-g`,
      user_id: g.id,
      title:
        status === "confirmed"
          ? "Your stay is confirmed"
          : status === "pending_owner"
            ? "Your request was sent"
            : "Booking update",
      body: `${h.name}: ${status.replaceAll("_", " ")}. Open your booking for details.`,
      is_read: j < 9 ? 1 : 0,
      created_at: stamp(j < 6 ? start + 30 : created, j < 6 ? 13 : 5),
    });
    notifications.push({
      id: `${b.id}-notice-o`,
      user_id: owner.id,
      title: j === 9 ? "New booking request" : "Guest booking update",
      body: `${g.name} · ${h.name} · ${status.replaceAll("_", " ")}.`,
      is_read: j < 9 ? 1 : 0,
      created_at: stamp(j < 6 ? start + 30 : created, j < 6 ? 13 : 5),
    });
    if (j < 4) {
      messages.push({
        id: `${b.id}-msg-g`,
        sender_id: g.id,
        recipient_id: owner.id,
        hostel_id: h.id,
        body: [
          "Is dinner available if I arrive after 9 pm?",
          "Is there a place to keep a bicycle?",
          "Can you share the laundry collection days?",
          "Will the room have a study desk and wardrobe?",
        ][j],
        created_at: stamp(created - 1, 10),
      });
      messages.push({
        id: `${b.id}-msg-o`,
        sender_id: owner.id,
        recipient_id: g.id,
        hostel_id: h.id,
        body: [
          "Please let the caretaker know your arrival time. We can keep a meal aside until 9:30 pm.",
          "There is limited bicycle space near reception. Please bring your own lock.",
          "The collection days are Tuesday and Friday. The caretaker will explain the process at check-in.",
          "Yes, the furnished room includes a desk, chair and storage.",
        ][j],
        created_at: stamp(created - 1, 11),
      });
    }
    if (j === 5)
      complaints.push({
        id: `${b.id}-complaint`,
        user_id: g.id,
        booking_id: b.id,
        subject: [
          "Wi-Fi outage in the study area",
          "Clarification about deposit return",
          "Housekeeping schedule request",
          "Water supply during morning hours",
        ][i % 4],
        body: [
          "The connection has dropped twice this week during my evening class. Could the router be checked?",
          "Could you confirm the deposit amount and the expected processing date after move-out?",
          "Could the room cleaning visit be moved to the afternoon on weekdays?",
          "The water pressure was low this morning. Please share an update with the residents.",
        ][i % 4],
        status: i % 4 === 0 ? "open" : "resolved",
        resolution:
          i % 4 === 0
            ? ""
            : "The property team contacted the resident and confirmed the next steps. The request has been resolved.",
        created_at: stamp(start + 20, 9),
      });
  }
owners.forEach((o, i) => {
  notifications.push({
    id: `${o.id}-welcome`,
    user_id: o.id,
    title: "Your portfolio is ready",
    body: "Review your properties, upcoming arrivals and pending booking requests.",
    is_read: 0,
    created_at: stamp(-1, 9),
  });
});
for (let i = 0; i < 60; i++)
  wishlist.push({ user_id: guests[i].id, hostel_id: hostels[i % 20].id });
for (const e of events.filter((e) =>
  ["approve", "reject", "refund", "complete"].includes(e.event),
))
  audit.push({
    id: e.id + "-audit",
    actor_id: e.actor_id,
    action: "booking." + e.event,
    target_id: e.booking_id,
    detail: e.note,
    created_at: e.created_at,
  });
const datasets = {
  owners,
  guests,
  hostels,
  rooms,
  hostel_photos: photos,
  hostel_amenities: amenities,
  documents,
  bookings,
  payment_attempts: attempts,
  payments,
  booking_events: events,
  reviews,
  messages,
  notifications,
  complaints,
  audit_log: audit,
  wishlist,
};
for (const [name, rows] of Object.entries(datasets))
  writeFileSync(resolve(out, name + ".csv"), stringifyCSV(rows), "utf8");
writeFileSync(
  resolve(out, "manifest.json"),
  JSON.stringify(
    {
      version: 2,
      reference_date: reference,
      synthetic: true,
      description:
        "Fictional people and properties. Approximate neighbourhood coordinates; illustrative photos. Amounts are integer INR.",
      counts: Object.fromEntries(
        Object.entries(datasets).map(([k, v]) => [k, v.length]),
      ),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    {
      directory: out,
      counts: Object.fromEntries(
        Object.entries(datasets).map(([k, v]) => [k, v.length]),
      ),
    },
    null,
    2,
  ),
);
