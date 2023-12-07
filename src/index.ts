import { logger } from '@4lch4/backpack'
import { HealthCheckRoutes } from '@4lch4/backpack/elysia'
import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import { SmokesRoute } from './routes'

const app = new Elysia({ prefix: '/api/v1' })

app.use(HealthCheckRoutes())
app.use(SmokesRoute.build())

app.use(swagger({ path: '/docs' }))

app.listen(process.env.APP_PORT!)

logger.success(`Server listening on port ${app.server?.port}`)
