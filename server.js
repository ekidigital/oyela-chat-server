import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import chatRoutes from './routes/chatRoutes.js';
import dotenv from 'dotenv';
import cors from 'cors';
import ChatMessage from './models/ChatMessage.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*', // Use environment variable for production
  },
});

// Connect to the database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/chat', chatRoutes);

app.get("/", (req, res) => {
  return res.status(200).json({ status: "success", message: "Api working" });
})

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Join the global room on connection
  socket.join('globalRoom');
  
  // Join a specific room
  socket.on('joinRoom', ({ roomId, userId }) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
    socket.emit('joinRoom', ({ roomId }));
    
  });
  
  socket.on('updateReadStatus', async ({roomId, userId}) => {

    try {
      // Fetch messages for the room
      const roomMessages = await ChatMessage.find({ roomId });

      // Update the readBy array for each message if the user hasn't read it yet
      const updatedMessages = await Promise.all(
        roomMessages.map(async (msg) => {
          if (!msg.readBy.includes(userId)) {
            msg.readBy.push(userId);
            await msg.save(); // Update message in the database
          }
          return msg;
        })
      );

      

      // Notify others in the room that this user has read the messages
      socket.emit('unreadMessagesUpdated', {
        userId,
        roomId,
      });
    } catch (error) {
      console.log(error)
    }

  })

  // Leave a specific room
  socket.on('leaveRoom', ({ roomId }) => {
    socket.leave(roomId);
    console.log(`Socket ${socket.id} left room ${roomId}`);
    socket.emit('leaveRoom', ({ roomId }));
  });

  // Sending messages
  socket.on('sendMessage', async ({ roomId, info, sender, message }) => {
    try {
      const chatMessage = new ChatMessage({ roomId, info, sender, message });
      await chatMessage.save();

      // // Check if the room exists and get the set of connected clients
      const room = io.sockets.adapter.rooms.get(roomId);

      if (room) {
        const clients = Array.from(room); // Get an array of socket IDs in the room

        if (clients.length > 0) {
          // console.log(`There are ${clients.length} users in the room:`, clients);

          // If you want to check if the current socket is in the room:
          const isUserInRoom = clients.includes(socket.id);
          if (isUserInRoom) {
            try {
              // Fetch messages for the room
              const roomMessages = await ChatMessage.find({ roomId });
        
              // Update the readBy array for each message if the user hasn't read it yet
              const updatedMessages = await Promise.all(
                roomMessages.map(async (msg) => {
                  if (!msg.readBy.includes(userId)) {
                    msg.readBy.push(userId);
                    await msg.save(); // Update message in the database
                  }
                  return msg;
                })
              );
        
              
        
              // Notify others in the room that this user has read the messages
              socket.emit('unreadMessagesUpdated', {
                userId,
                roomId,
              });
            } catch (error) {
              console.log(error)
            }
          } else {
            console.log(`User with socket ID ${socket.id} is not in the room.`);
          }
        }

      }

      // Emit the new message to the specific room
      io.to(roomId).emit('receiveMessage', {
        _id: chatMessage._id,
        text: message,
        createdAt: chatMessage.timestamp,
        user: { _id: sender },
        readBy: chatMessage.readBy,
      });

      io.to('globalRoom').emit('globalMessageUpdated', {
        roomId,
        message: chatMessage,
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  // Handle socket disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 8004;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
