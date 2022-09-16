require("dotenv").config();
import "reflect-metadata";

import express from "express";
import Websocket from "./modules/socket";
import cors from "cors";
import fs from "fs";
import { createServer } from "http";
import { createClient } from "redis";
import { ExpressPeerServer } from "peer";

const redisCache = createClient();

const port = Number(process.env.APP_PORT) || 5000;

// peerServer.listen(() => {
//   console.log("asd");
// });

// const cmsId = (id: string) => `SOCKET_${id}`;
const piId = (id: string) => `SOCKET_PI_${id}`;
const devicePairingUser = (id: string) => `CALL_PAIRING_USER_${id}`;
const devicePairingSocketId = (id: string) => `CALL_PAIRING_SOCKET_ID_${id}`;

const app = express();
const server = createServer(app);
const peerServer = ExpressPeerServer(server, {
  proxied: true,
});
app.use(cors());
app.use("/peerjs", peerServer);
app.get("/", (req, res) => {
  res.send("heello");
});
const io = Websocket.getInstance(server);

redisCache
  .connect()
  .then(() =>
    server.listen(port, () => console.log(`This is working in port ${port}.`))
  );

io.on("connect", (socket) => {
  console.log("connect id || ", socket.id);

  socket.on("pi-register", (deviceCode) => {
    console.log("pi-register");
    redisCache.set(deviceCode, socket.id);
    redisCache.set(piId(socket.id), deviceCode);
  });

  socket.on("cms-waiting-call", async ({ pi, cms }) => {
    const piSocketId = await redisCache.get(pi);
    // pi-device will start making call to cms on this event
    io.to(piSocketId).emit("cms-waiting-call", cms);
  });

  socket.on("call-request", async (data) => {
    const { deviceId, user } = data;
    console.log("data ", data);
    const piSocketId = await redisCache.get(deviceId);
    if (!piSocketId) {
      // un register
      socket.emit("pi-not-register", deviceId);
      return;
    }
    const pairer = await redisCache.get(devicePairingUser(deviceId));
    console.log(" pairer ", pairer);

    if (pairer) {
      socket.emit("error-pi-busy", pairer);
    } else {
      socket.emit("call-request-allowed", deviceId); // emit for cms
      redisCache.set(devicePairingUser(deviceId), user);
      redisCache.set(devicePairingSocketId(socket.id), deviceId);
    }
    /* else {
      // start nego process
      socket.emit("call-request-allowed", deviceId); // emit for cms
      io.to(piSocketId).emit("start-nego", socket.id); // emit for pi device
      redisCache.set(devicePairingUser(deviceId), user);
      redisCache.set(devicePairingSocketId(socket.id), deviceId);
    }
    */
  });

  const signalClose = async () => {
    console.log("closed ", socket.id);
    const [deviceId, piDeviceId] = await Promise.all([
      // redisCache.get(cmsId(socket.id)),
      redisCache.get(devicePairingSocketId(socket.id)),
      redisCache.get(piId(socket.id)),
    ]);
    // console.log("closed pi ", piSocketId);
    // if (piSocketId) {
    //   console.log("cms closed");
    //   io.to(piSocketId).emit("cms-closed", socket.id);
    //   redisCache.del(cmsId(socket.id));
    // }

    console.log("device pi ", deviceId);
    // when end call
    if (deviceId) {
      redisCache.del(devicePairingUser(deviceId));
      redisCache.del(devicePairingSocketId(socket.id));
      const piSocketId = await redisCache.get(deviceId);
      io.to(piSocketId).emit("cms-closed", socket.id);
    }
    // when pi-device disconnect
    if (piDeviceId) {
      console.log("pi disconnect", piDeviceId);
      redisCache.del(piId(socket.id));
      redisCache.del(piDeviceId);
    }
  };
  socket.on("cms-closed", signalClose);
  socket.on("disconnect", signalClose);
  /*
  socket.on("signal-offer", async (data) => {
    const socketId = await redisCache.get(data.deviceId);
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
  */
});
