import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const imagePrompts = [
  "Golden sunset over mountain lake with reflections",
  "Corporate team meeting in modern office",
  "Abstract geometric pattern with vibrant colors",
  "Fresh vegetables arranged on wooden table",
  "Aerial view of tropical island paradise",
  "Minimalist workspace with laptop and coffee",
  "Autumn forest path with falling leaves",
  "Futuristic city skyline at twilight",
  "Macro photography of water droplets on petal",
  "Café interior with warm ambient lighting",
  "Dramatic storm clouds over ocean",
  "Bloom of cherry blossoms in spring garden",
  "Modern architecture with glass facades",
  "Wild horse galloping through meadow",
  "Vintage camera collection on dark background",
  "Northern lights over snowy landscape",
  "Street food market at night with neon signs",
  "Coral reef ecosystem underwater photography",
  "Industrial loft interior design concept",
  "Serene Japanese zen garden with raked sand",
  "Chocolate desserts on marble surface",
  "Open road through desert landscape",
  "Graffiti art on urban brick wall",
  "Sailboats racing in turquoise waters",
  "Cozy reading nook with bookshelves",
  "Geometric tile patterns in Moroccan palace",
  "Wildlife photography - lion pride at sunrise",
  "Artisan bread bakery interior",
  "Neon-lit Tokyo street at midnight",
  "Fresh herbs in terra cotta pots",
]

const videoPrompts = [
  "Timelapse of clouds moving over mountain peaks",
  "Slow motion splash of coffee being poured",
  "Drone flyover of autumn forest canopy",
  "Abstract particle flow animation",
  "Ocean waves crashing on rocky shore",
  "Time-lapse of flower blooming in garden",
  "Aerial footage of modern city at night",
  "Slow motion ink drop in water",
  "Panoramic sweep of mountain valley at sunrise",
  "Abstract light trails in motion",
  "Close-up of rain falling on leaf surface",
  "Smooth camera movement through forest path",
  "Underwater footage of sea turtles swimming",
  "Steam rising from hot food close-up",
  "Abstract fluid dynamics color animation",
  "City traffic time-lapse from above",
  "Dance performance with dramatic lighting",
  "Aurora borealis real-time footage",
  "Cooking scene with sizzling sounds implied",
  "Fireworks display over city skyline",
]

const vectorPrompts = [
  "Flat design illustration of startup office",
  "Minimalist logo concept for tech company",
  "Isometric cityscape with buildings",
  "Infographic elements - charts and graphs",
  "Abstract decorative background pattern",
  "Icon set for mobile application UI",
  "Geometric animal silhouette collection",
  "World map with dot matrix style",
  "Hand-drawn botanical illustration",
  "Corporate organizational chart template",
  "Social media post template layout",
  "Decorative mandala design elements",
  "Tech circuit board pattern design",
  "Fashion illustration flat sketch",
  "Food delivery app UI elements",
  "Music festival poster vector art",
  "Real estate property illustration",
  "Educational infographic diagram",
  "Sports equipment icon collection",
  "Wedding invitation decorative frame",
]

const styles = ["Photorealistic", "3D Render", "Watercolor", "Minimalist", "Cinematic", "Flat Design", "Artistic", "Digital Art", "Anime Style", "Pop Art"]
const aiModels = ["Adobe Firefly 3.0", "Stable Diffusion XL", "DALL-E 3", "Midjourney v6", "Imagen 3"]
const resolutions = ["1024x1024", "1920x1080", "2048x2048", "3840x2160", "768x1344", "1344x768"]
const durations = ["5s", "10s", "15s", "30s", "60s"]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomDate(daysAgo: number): Date {
  const now = new Date()
  const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
  return new Date(past.getTime() + Math.random() * 24 * 60 * 60 * 1000)
}

function weightedStatus(): string {
  const r = Math.random()
  if (r < 0.55) return "completed"
  if (r < 0.75) return "processing"
  if (r < 0.88) return "queued"
  return "failed"
}

async function main() {
  console.log("Seeding database...")

  // Clear existing data
  await db.generationTask.deleteMany()
  await db.dailyStat.deleteMany()

  // Generate tasks
  const tasks: any[] = []
  const imageCount = randomInt(28, 35)
  const videoCount = randomInt(10, 16)
  const vectorCount = randomInt(8, 14)

  for (let i = 0; i < imageCount; i++) {
    const status = weightedStatus()
    const createdAt = randomDate(14)
    tasks.push({
      type: "image",
      status,
      prompt: randomItem(imagePrompts),
      style: randomItem(styles),
      resolution: randomItem(resolutions.slice(0, 4)),
      fileSize: status === "completed" ? randomInt(500000, 8000000) : null,
      aiModel: randomItem(aiModels.slice(0, 3)),
      createdAt,
      updatedAt: createdAt,
      completedAt: status === "completed" ? new Date(createdAt.getTime() + randomInt(60000, 300000)) : null,
      errorMessage: status === "failed" ? randomItem(["Generation timeout", "NSFW content detected", "Insufficient detail in prompt", "Model overload", "Invalid style parameter"]) : null,
      priority: randomInt(1, 10),
    })
  }

  for (let i = 0; i < videoCount; i++) {
    const status = weightedStatus()
    const createdAt = randomDate(14)
    tasks.push({
      type: "video",
      status,
      prompt: randomItem(videoPrompts),
      style: randomItem(styles),
      resolution: randomItem(["1920x1080", "3840x2160", "1080x1920"]),
      duration: randomItem(durations),
      fileSize: status === "completed" ? randomInt(5000000, 50000000) : null,
      aiModel: randomItem(aiModels.slice(0, 2)),
      createdAt,
      updatedAt: createdAt,
      completedAt: status === "completed" ? new Date(createdAt.getTime() + randomInt(120000, 600000)) : null,
      errorMessage: status === "failed" ? randomItem(["Video encoding failed", "Frame rate mismatch", "Memory limit exceeded"]) : null,
      priority: randomInt(1, 10),
    })
  }

  for (let i = 0; i < vectorCount; i++) {
    const status = weightedStatus()
    const createdAt = randomDate(14)
    tasks.push({
      type: "vector",
      status,
      prompt: randomItem(vectorPrompts),
      style: randomItem(["Flat Design", "Minimalist", "Line Art", "Geometric"]),
      resolution: null,
      fileSize: status === "completed" ? randomInt(50000, 2000000) : null,
      aiModel: randomItem(aiModels.slice(2, 5)),
      createdAt,
      updatedAt: createdAt,
      completedAt: status === "completed" ? new Date(createdAt.getTime() + randomInt(30000, 120000)) : null,
      errorMessage: status === "failed" ? randomItem(["SVG export error", "Complexity limit exceeded"]) : null,
      priority: randomInt(1, 10),
    })
  }

  // Insert in batches
  for (let i = 0; i < tasks.length; i += 10) {
    await db.generationTask.createMany({ data: tasks.slice(i, i + 10) })
  }

  // Generate daily stats for last 14 days
  const types = ["image", "video", "vector"]
  for (let d = 13; d >= 0; d--) {
    const date = new Date()
    date.setDate(date.getDate() - d)
    const dateStr = date.toISOString().split("T")[0]

    for (const type of types) {
      const total = type === "image" ? randomInt(60, 120) : type === "video" ? randomInt(20, 50) : randomInt(15, 40)
      const failed = randomInt(1, Math.floor(total * 0.08))
      const completed = total - failed - randomInt(2, 8)
      await db.dailyStat.create({
        data: {
          date: dateStr,
          type,
          total,
          completed,
          failed,
          avgTime: type === "video" ? Math.round((20 + Math.random() * 40) * 10) / 10 : Math.round((5 + Math.random() * 20) * 10) / 10,
        },
      })
    }
  }

  console.log(`Seeded ${tasks.length} tasks and 42 daily stats`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
