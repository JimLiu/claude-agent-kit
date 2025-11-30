import "dotenv/config"
import { createServer } from './server'

const portEnv = process.env.PORT
const defaultPort = 5173
const port = Number(portEnv) || defaultPort

createServer()
  .then(({ httpServer }) => {
    httpServer.listen(port, () => {
      console.log(`Server started at http://localhost:${port}`)
    })
  })
  .catch((error) => {
    console.error('Failed to start server', error)
    process.exitCode = 1
  })
