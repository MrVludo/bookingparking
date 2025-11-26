require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { createClient } = require("redis");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ---------- CONNECT TO REDIS ----------
const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().then(() => console.log("Redis Connected ✓"))
.catch(err => console.error("Redis connection failed ❗", err));

// ---------- GET BOOKINGS FROM REDIS ----------
async function loadBookings() {
  let data = await redis.get("bookings");
  return data ? JSON.parse(data) : {};
}

// ---------- SAVE BOOKINGS ----------
async function saveBookings(bookings) {
  await redis.set("bookings", JSON.stringify(bookings));
}

// ---------- MIDDLEWARE ----------
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // index.html must be inside /public

// ---------- ROUTES ----------
app.get("/bookings", async (req, res) => {
  const bookings = await loadBookings();
  res.json(bookings);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------- SOCKET.IO ----------
io.on("connection", async (socket) => {
  console.log("User connected");

  socket.emit("bookings_updated", await loadBookings());

  socket.on("update_bookings", async (data) => {
    await saveBookings(data);
    io.emit("bookings_updated", data);
  });

  socket.on("disconnect", () => console.log("User disconnected"));
});

// ---------- RUN SERVER ----------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server live on ${PORT}`);
});
