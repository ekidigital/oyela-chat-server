import express from 'express';
import ChatMessage from '../models/ChatMessage.js';

const router = express.Router();


// Get all chat rooms with their latest message
router.get('/all-rooms/:userId', async (req, res) => {
  const { userId } = req.params; // Assuming you pass your user ID as a query parameter

  try {
    const rooms = await ChatMessage.aggregate([
      // Step 1: Sort by timestamp to get the latest messages first
      { $sort: { timestamp: -1 } },
      
      // Step 2: Filter rooms where the userId is part of the roomId string
      {
        $match: {
          roomId: { $regex: `.*${userId}.*`, $options: 'i' } // Regex to find userId within roomId string
        }
      },
      
      // Step 3: Group by roomId and get the latest message for each room
      {
        $group: {
          _id: "$roomId", // Group by roomId
          latestMessage: { $first: "$$ROOT" } // Get the latest message
        }
      },
      
      // Step 4: Lookup user details for the sender of the latest message
      {
        $lookup: {
          from: 'users', // Name of the users collection
          localField: 'latestMessage.info', // Field from ChatMessage
          foreignField: '_id', // Field from User collection
          as: 'senderDetails' // Field to store the user details
        }
      },
      
      // Step 5: Unwind senderDetails to flatten the array
      { $unwind: { path: '$senderDetails', preserveNullAndEmptyArrays: true } } // Preserve nulls if no matching user
    ]);
    
    if (!rooms.length) {
      console.log("No rooms found");
      return res.json({ message: "No rooms found" });
    }

    console.log("Rooms found:", rooms);
    res.json(rooms);
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});


// Get unread messages count for each room
router.get('/unread/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Aggregate unread messages grouped by roomId
    const unreadMessages = await ChatMessage.aggregate([
      {
        $match: {
          sendTo: mongoose.Types.ObjectId(userId), // Messages sent to the user
          readBy: { $ne: mongoose.Types.ObjectId(userId) }, // Exclude messages read by the user
        },
      },
      {
        $group: {
          _id: '$roomId', // Group by roomId
          unreadCount: { $sum: 1 }, // Count unread messages
        },
      },
    ]);

    res.status(200).json(unreadMessages);
  } catch (error) {
    console.error('Error fetching unread messages:', error);
    res.status(500).json({ error: 'Failed to fetch unread messages' });
  }
});

// routes/chatRoutes.js
router.post('/markAsRead', async (req, res) => {
  const { roomId, userId } = req.body;

  try {
    await ChatMessage.updateMany(
      { roomId: roomId, readBy: { $ne: mongoose.Types.ObjectId(userId) } },
      { $push: { readBy: userId } } // Mark as read
    );

    res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});



router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await ChatMessage.find({ roomId }).sort({ timestamp: -1 });
    res.json(messages);
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

export default router;
