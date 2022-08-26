require('dotenv').config()
import 'reflect-metadata';

import express from 'express'
import Websocket from './modules/socket';
import cors from 'cors'
import fs from 'fs'
import { createServer } from 'https';


const port = process.env.APP_PORT || 5000;

// const routingControllerOptions: RoutingControllersOptions = {
//    routePrefix: 'v1',
//    controllers: [`${__dirname}/modules/http/*.controller.*`],
//    validation: true,
//    classTransformer: true,
//    cors: true,
//    defaultErrorHandler: true
// }

// const key  = fs.readFileSync('cert/forward.dev.wincloud.comartek.com.key', 'utf8');
// const cert = fs.readFileSync('cert/forward.dev.wincloud.comartek.com.csr', 'utf8');
const ca = fs.readFileSync(process.env.CA_PATH)
const key = fs.readFileSync(process.env.KEY_PATH)
const cert = fs.readFileSync(process.env.CERT_PATH)
console.log(key);

const options = {
   key,
   cert,
   ca
}
const app = express();
app.use(cors())

app.get("/" ,(req, res) =>{
   res.send("heello")
})

const httpServer = createServer(options,app);
const io = Websocket.getInstance(httpServer);

httpServer.listen(port, () => {
   console.log(`This is working in port ${port}`);
});
const db = new Map<string, string>()
const cmsDB = new Map<string, string>()

io.on('connect', (socket)=>{
    // console.log("connect" ,socket.id);
    socket.on("pi-register", (deviceCode) =>{
        console.log("pi-register")
        db.set(deviceCode, socket.id)
    })
    const signalClose = () => {
      const piSocketId = cmsDB.get(socket.id)
      if(piSocketId){
         io.to(piSocketId).emit("cms-closed", socket.id)
         cmsDB.set(socket.id, undefined)
      }
   }
    
    socket.on("cms-closed", signalClose)
    socket.on("disconnect",signalClose )

    socket.on('signal-offer', (data)=> {
       const socketId = db.get(data.deviceId)
       cmsDB.set(socket.id, socketId)
       console.log("signal-offer to ", socketId)
       io.to(socketId).emit("offer-sdp", data.sdp, socket.id )
    })

    socket.on('signal-ice', (data)=> {
        console.log("signal-ice")
        const socketId = db.get(data.deviceId) 
        io.to(socketId).emit("ice-candidate", data.candidate)
     }) 
    
     socket.on('signal-answer', (data)=> {
        // const socketId = db.get(data.deviceId) 
        console.log("signal-answer")
        io.to(data.deviceId).emit("answer-sdp", data.sdp)
     })
     socket.on('signal-answer-ice', (data)=> {
        console.log("signal-answer-ice")
        //  const socketId = db.get(data.deviceId) 
         io.to(data.deviceId).emit("ice-candidate", data.candidate)
      }) 

})


