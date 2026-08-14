// adding google dns to resolve dns issues
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
require("dotenv").config();
const app = express();
const port = process.env.PORT;

const cors = require("cors");
// Middleware
app.use(cors());
// Parse JSON bodies
app.use(express.json());
// Parse URL-encoded bodies
app.get("/", (req, res) => {
  res.send("Hello World!");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    //my collections
    const db = client.db(process.env.MONGO_DB_NAME);
    // collections for api
    const roomsCollection = db.collection("rooms");
    //booked rooms collection
    const bookedRoomsCollection = db.collection("bookedRooms");

    //post api for rooms
    app.post("/rooms", async (req, res) => {
      const room = req.body;
      const result = await roomsCollection.insertOne(room);
      res.send(result);
    });

    // get user created rooms by id
    // Get all rooms created by a specific owner
    app.get("/my/rooms", async (req, res) => {
      const query = {};

      // Check if the frontend sent the userId in the query string
      if (req.query.userId) {
        // Query by the field name you used when creating the room
        query.roomOwnerId = req.query.userId;
      }

      // Use find().toArray() to get ALL matching rooms
      const rooms = await roomsCollection.find(query).toArray();

      res.send(rooms);
    });

    //get rooms by id
    app.get("/details/room/:id", async (req, res) => {
      const roomId = req.params.id;
      const room = await roomsCollection.findOne({ _id: new ObjectId(roomId) });
      res.send(room);
    });

    //post api for booked rooms
    app.post("/booked/rooms", async (req, res) => {
      const bookedRoom = req.body;
      const result = await bookedRoomsCollection.insertOne(bookedRoom);
      res.send(result);
    });

    //get my bookings by user id
    app.get("/my/bookings", async (req, res) => {
      const query = {};
      if (req.query.userId) {
        query.bookingUserId = req.query.userId;
      }
      const bookings = await bookedRoomsCollection.find(query).toArray();
      res.send(bookings);
    });

    // api for status update when cancel booking
    app.patch("/booked/rooms/:id", async (req, res) => {
      const bookingId = req.params.id;
      const newStatus = req.body.status; // This will be "canceled"

      const result = await bookedRoomsCollection.updateOne(
        { _id: new ObjectId(bookingId) },
        { $set: { status: newStatus } }, // FIX: You must wrap it in an object for $set
      );

      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
