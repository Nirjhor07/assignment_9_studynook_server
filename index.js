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
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//jwt key set
const JWKS = createRemoteJWKSet(new URL(process.env.JWTKS_URL));

// Middleware to verify JWT token
const verifyJwt = async (req, res, next) => {
  const authHeader = req?.headers.authorization;
  // console.log("JWT token", authHeader);//get the token from the authorization header
  // const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  // console.log("Required token", requiredToken);
  console.log(token);
  // next(); // Proceed to the next middleware or route handler without verification

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload; // Attach payload to request object
    // console.log("JWT payload:", payload); // Log the payload for debugging
    req.userId = payload.id; // Assuming the payload contains an 'id' field for the user
    console.log("User ID from JWT:", req.userId); // Log the user ID for debugging
    return next(); // Safe continuation after successful verification
  } catch (error) {
    // console.error("JWT verification error:", error.message);
    return res.status(403).json({ message: "forbidden access" });
  }
};

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
    app.post("/rooms", verifyJwt, async (req, res) => {
      const room = req.body;
      const newRoom = {
        ...room,
        createdAt: new Date(),
      };
      const result = await roomsCollection.insertOne(newRoom);
      res.send(result);
    });

    // get user created rooms by id
    // Get all rooms created by a specific owner
    app.get("/my/rooms", verifyJwt, async (req, res) => {
      const userId = req.userId; // Get the user ID from the verified JWT
      // console.log("User ID from JWT:", userId); // Log the user ID for debugging
      const query = {};

      // Check if the frontend sent the userId in the query string
      if (req.query.userId) {
        // Query by the field name you used when creating the room
        query.roomOwnerId = userId;
      }
      console.log("Query for my rooms:", query); // Log the query for debugging

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
      const newBookedRoom = {
        ...bookedRoom,
        createdAt: new Date(),
      };
      const result = await bookedRoomsCollection.insertOne(newBookedRoom);
      res.send(result);
    });

    //get my bookings by user id
    app.get("/my/bookings", verifyJwt, async (req, res) => {
      const userId = req.userId; // Get the user ID from the verified JWT
      const query = {};
      if (req.query.userId) {
        query.bookingUserId = userId;
      }
      const bookings = await bookedRoomsCollection.find(query).toArray();
      res.send(bookings);
    });

    // api for status update when cancel booking
    app.patch("/booked/rooms/:id",verifyJwt, async (req, res) => {
      const userId = req.userId; // Get the user ID from the verified JWT
      const bookingId = req.params.id;
      const newStatus = req.body.status; // This will be "canceled"

      const result = await bookedRoomsCollection.updateOne(
        { _id: new ObjectId(bookingId) },
        { $set: { status: newStatus } }, // FIX: You must wrap it in an object for $set
      );

      res.send(result);
    });

    // api for get all rooms
    app.get("/rooms", async (req, res) => {
      const cursor = roomsCollection.find();
      const rooms = await cursor.toArray();
      res.send(rooms);
    });

    // api for get 6 rooms for home page & latest rooms
    app.get("/rooms/latest", async (req, res) => {
      const rooms = await roomsCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();

      res.send(rooms);
    });

    // put api for update room details
    app.put("/rooms/:id", verifyJwt, async (req, res) => {
      const roomId = req.params.id;
      const updatedRoom = req.body;

      const result = await roomsCollection.updateOne(
        { _id: new ObjectId(roomId) },
        { $set: updatedRoom },
      );

      res.send(result);
    });

    //api to deleted room by room id
    app.delete("/rooms/:id", verifyJwt, async (req, res) => {
      const roomId = req.params.id;
      // console.log("Deleting room with ID:", roomId);
      const result = await roomsCollection.deleteOne({
        _id: new ObjectId(roomId),
      });
      // console.log("Delete result:", result);
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
