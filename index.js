const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");

/********************************************************** */
const http = require('http');
const socketIO = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: "*" } });
/********************************************************* */
app.use(cors({ origin: "*", optionsSuccessStatus: 200 }));
app.use(express.json());

app.get("/", (req, res) => {
    res.send(`Hello from the server`);
});

app.set("socketIO", io);


const socket_Joined_Room_Mapping = new Map();
const socket_Created_Room_Mapping = new Map();
const existingRooms = [];


// Socket.io communication 
io.on('connection', async (socket) => {
    console.log("USER CONNECTED : ", socket.id)
    // Handle new user connection
    socket.emit('Connection Established', socket.id)

    socket.on('joinRoom', (roomName) => {
        if (existingRooms.find(ele => ele == roomName)) {
            let alreadyInARoom = false;
            // Leave current room (if any)
            if (socket_Joined_Room_Mapping.has(socket.id)) {
                const currentRoom = socket_Joined_Room_Mapping.get(socket.id);
                socket.leave(currentRoom);
                socket_Joined_Room_Mapping.delete(socket.id);
                alreadyInARoom = true;
            }
            // Join the new room
            socket.join(roomName);
            socket_Joined_Room_Mapping.set(socket.id, roomName);
            //find room creator socket id 
            /******************************************************************* */
            let creatorSocketId = null;
            for (const [socketId, room] of socket_Created_Room_Mapping) {
                if (room === roomName) {
                    creatorSocketId = socketId;
                }
            }
            console.log(creatorSocketId, socket.id);
            /******************************************************************* */
            if (alreadyInARoom) {
                io.to(roomName).emit("handleUserJoined", { message: "One user can join only one room. Hence removing user from previous rooms and adding to the new one", value: { roomName, joineeSocketId: socket.id, creatorSocketId: creatorSocketId } });
            }
            else {
                io.to(roomName).emit("handleUserJoined", { message: "Joined Room Successfully", value: { roomName, joineeSocketId: socket.id, creatorSocketId: creatorSocketId } });
            }
        }
        else {
            socket.emit("message", { message: "Invalid Room Id", value: roomName });
        }
    });

    socket.on('createRoom', (roomName) => {
        socket_Created_Room_Mapping.set(socket.id, roomName);
        existingRooms.push(roomName);
        // Join the new room
        socket.join(roomName);
        socket.emit("message", { message: "Room created successfully", value: roomName });
    });


    socket.on('sendOffer', async (data) => {
        const { type, offer, candidate, answer, MemberId } = data;
        io.to(MemberId).emit("receiveOffer", { type, offer, candidate, answer, MemberId });
    })
    // Handle user disconnection
    socket.on('disconnect', async () => {
        console.log("User disconnected : ", socket.id);
        // Remove user from rooms he created  on disconnect
        if (socket_Created_Room_Mapping.has(socket.id)) {
            let roomName = socket_Created_Room_Mapping.get(socket.id);
            const indexToRemove = existingRooms.indexOf(roomName);
            if (indexToRemove != -1) existingRooms.splice(indexToRemove, 1);
            socket_Created_Room_Mapping.delete(socket.id);
            //send a message to room joinee that creator has left so reload your window
            //find room joinee socket id 
            /******************************************************************* */
            let joineeSocketId = null;
            for (const [socketId, room] of socket_Joined_Room_Mapping) {
                if (room === roomName) {
                    joineeSocketId = socketId;
                }
            }
            socket_Joined_Room_Mapping.delete(joineeSocketId);
            if(joineeSocketId)
                io.to(joineeSocketId).emit("creatorLeft");
        }

        // Remove user from rooms he joined  on disconnect
        if (socket_Joined_Room_Mapping.has(socket.id)) {
            const roomName = socket_Joined_Room_Mapping.get(socket.id);
            socket.leave(roomName);
            socket_Joined_Room_Mapping.delete(socket.id);
            //send a message to room creator that joined user has left and stop it's video showing
            //find room creator socket id 
            /******************************************************************* */
            let creatorSocketId = null;
            for (const [socketId, room] of socket_Created_Room_Mapping) {
                if (room === roomName) {
                    creatorSocketId = socketId;
                }
            }
            if(creatorSocketId)
                io.to(creatorSocketId).emit("joinedUserLeft");
            /******************************************************************* */
        }
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log(
        `App listening at http://localhost:${process.env.PORT || 3000}`
    );
});