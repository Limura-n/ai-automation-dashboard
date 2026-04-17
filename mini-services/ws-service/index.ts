import { Server } from 'socket.io'

const PORT = 3003

const io = new Server(PORT, {
  cors: {
    origin: '*',
  },
})

const statuses = ['completed', 'processing', 'queued', 'failed']
const types = ['image', 'video', 'vector']
const prompts = [
  'Sunset over mountains',
  'Abstract geometric art',
  'Corporate headshot',
  'Tropical beach scene',
  'Product photography',
  'Watercolor landscape',
  'Minimalist logo design',
  '3D character render',
  'Urban architecture',
  'Nature close-up',
]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomId() {
  return Math.random().toString(36).substring(2, 10)
}

// Emit random updates every 3-5 seconds
setInterval(() => {
  const update = {
    id: randomId(),
    type: randomItem(types),
    status: randomItem(statuses),
    prompt: randomItem(prompts),
    style: randomItem(['Photorealistic', '3D Render', 'Cinematic', 'Minimalist']),
    aiModel: randomItem(['Firefly 3.0', 'SD XL', 'DALL-E 3']),
    timestamp: new Date().toISOString(),
  }

  io.emit('task-update', update)
  io.emit('stats-refresh', { triggeredAt: new Date().toISOString() })
}, 3500)

// Periodic stats update
setInterval(() => {
  io.emit('stats-update', {
    processingNow: Math.floor(Math.random() * 5) + 18,
    queueSize: Math.floor(Math.random() * 10) + 40,
    todayGenerated: Math.floor(Math.random() * 20) + 140,
  })
}, 10000)

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`)
  
  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`)
  })
})

console.log(`[WS] WebSocket server running on port ${PORT}`)
