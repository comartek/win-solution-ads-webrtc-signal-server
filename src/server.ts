require("dotenv").config();
import "reflect-metadata";

import express from "express";
import Websocket from "./modules/socket";
import cors from "cors";
import fs from "fs";
import { createServer } from "http";
import { createClient } from "redis";

const redisCache = createClient();

const port = process.env.APP_PORT || 5000;
const cmsId = (id: string) => `SOCKET_${id}`;

// const ca = fs.readFileSync(process.env.CA_PATH)
// const key = fs.readFileSync(process.env.KEY_PATH)
// const cert = fs.readFileSync(process.env.CERT_PATH)
// console.log(key);

// const options = {
//    key,
//    cert,
//    ca
// }
const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("heello");
});

const httpServer = createServer(app);
// const httpServer = createServer(options,app);
const io = Websocket.getInstance(httpServer);

redisCache
  .connect()
  .then(() =>
    httpServer.listen(port, () =>
      console.log(`This is working in port ${port}.`)
    )
  );
// const db = new Map<string, string>()
// const cmsDB = new Map<string, string>()

io.on("connect", (socket) => {
  console.log("connect id || ", socket.id);
  socket.on("pi-register", (deviceCode) => {
    console.log("pi-register");
    redisCache.set(deviceCode, socket.id);
  });
  const signalClose = async () => {
    const piSocketId = await redisCache.get(cmsId(socket.id));
    if (piSocketId) {
      io.to(piSocketId).emit("cms-closed", socket.id);
      redisCache.del(cmsId(socket.id));
    }
  };

  socket.on("cms-closed", signalClose);
  socket.on("disconnect", signalClose);

  socket.on("signal-offer", async (data) => {
    const socketId = await redisCache.get(data.deviceId);
    if (!socketId) {
      // un register
      socket.emit("pi-not-ready");
      return;
    }
    await redisCache.set(cmsId(socket.id), socketId);
    console.log("signal-offer to ", socketId);
    io.to(socketId).emit("offer-sdp", data.sdp, socket.id);
  });

  socket.on("signal-ice", async (data) => {
    console.log("signal-ice");
    const socketId = await redisCache.get(data.deviceId);
    io.to(socketId).emit("signal-ice", data.candidate);
  });

  socket.on("signal-answer", (data) => {
    // const socketId = db.get(data.deviceId)
    console.log("signal-answer");
    io.to(data.deviceId).emit("answer-sdp", data.sdp);
  });
  socket.on("signal-answer-ice", (data) => {
    console.log("signal-answer-ice");
    //  const socketId = db.get(data.deviceId)
    io.to(data.deviceId).emit("ice-candidate", data.candidate);
  });
});
