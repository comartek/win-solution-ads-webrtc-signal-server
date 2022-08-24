require('dotenv').config()
import 'reflect-metadata';

import {
   createExpressServer,
   RoutingControllersOptions
} from 'routing-controllers'
import Websocket from './modules/socket';
import { createServer } from 'http';

const port = process.env.APP_PORT || 5000;

const routingControllerOptions: RoutingControllersOptions = {
   routePrefix: 'v1',
   controllers: [`${__dirname}/modules/http/*.controller.*`],
   validation: true,
   classTransformer: true,
   cors: true,
   defaultErrorHandler: true
}


const app = createExpressServer(routingControllerOptions);

const httpServer = createServer(app);
const io = Websocket.getInstance(httpServer);

httpServer.listen(port, () => {
   console.log(`This is working in port ${port}`);
});
const db = new Map<string, string>()

io.on('connect', (socket)=>{
    // console.log("connect" ,socket.id);
    socket.on("pi-register", (deviceCode) =>{
        console.log("pi-register")
        db.set(deviceCode, socket.id)
    })
    
    socket.on("cms-register", (deviceCode) =>{
        db.set(deviceCode, socket.id)
    })

    socket.on('signal-offer', (data)=> {
        console.log("signal-offer")
       const socketId = db.get(data.deviceId)
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


