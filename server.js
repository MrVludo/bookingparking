const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const csvParser = require("csv-parser");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const CSV_FILE = "booking_data.csv";

// --- Middleware ---
app.use(express.json());
app.use(express.static(__dirname)); // serve index.html and static files

// --- Load bookings ---
function loadBookings() {
  return new Promise((resolve, reject) => {
    const bookings = {};
    if (!fs.existsSync(CSV_FILE)) {
      return resolve(bookings);
    }

    fs.createReadStream(CSV_FILE)
      .pipe(csvParser({ headers: ["date", "person"] }))
      .on("data", (row) => {
        bookings[row.date] = row.person;
      })
      .on("end", () => resolve(bookings))
      .on("error", (err) => reject(err));
  });
}

// --- Save bookings ---
async function saveBookings(bookings) {
  const csvWriter = createCsvWriter({
    path: CSV_FILE,
    header: [
      { id: "date", title: "date" },
      { id: "person", title: "person" },
    ],
  });

  const records = Object.entries(bookings).map(([date, person]) => ({ date, person }));
  await csvWriter.writeRecords(records);
}

// --- Routes ---
app.get("/bookings", async (req, res) => {
  const bookings = await loadBookings();
  res.json(bookings);
});

// Serve index.html by default
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// --- Socket.IO ---
io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("update_bookings", async (data) => {
    await saveBookings(data);
    io.emit("bookings_updated", data); // broadcast to all clients
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

// --- Start server ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
