import { logger } from '@4lch4/backpack'
import { HealthCheckRoutes } from '@4lch4/backpack/elysia'
import Day from 'dayjs'
import TZPlugin from 'dayjs/plugin/timezone'
import UTCPlugin from 'dayjs/plugin/utc'
import { Elysia, t } from 'elysia'
import { FindOptions, MongoClient } from 'mongodb'
import PQueue from 'p-queue'

Day.extend(UTCPlugin)
Day.extend(TZPlugin)

const client = await MongoClient.connect(process.env.MONGO_URL!)

const app = new Elysia({ prefix: '/api/v1' })

app.use(HealthCheckRoutes())

app.get('/smokes/latest', async () => {
  const res = await client
    .db('stats')
    .collection('smokes')
    .find({}, { sort: { createDate: -1 }, limit: 1 })
    .toArray()

  const utcDate = Day.utc(res[0].createDate)
  const cstDate = utcDate.tz('America/Chicago').format('dddd, MMM. DD YYYY @ HH:mm:ss CST')

  logger.debug(`[GET /smokes/latest] ${utcDate.toString()}`)
  logger.debug(`[GET /smokes/latest] ${cstDate}`)

  return `${cstDate} (${utcDate.toString()}).`
})

const SORT_CREATE_DATE_DESC: FindOptions = { sort: { createDate: -1 } }

const startOfToday = new Date()
startOfToday.setHours(0, 0, 0, 0)

const endOfToday = new Date()
endOfToday.setHours(23, 59, 59, 999)

const queryForToday = {
  createDate: {
    $gte: startOfToday,
    $lte: endOfToday,
  },
}

// Use this query in your MongoDB find() method
// db.collection.find(query);

app.get('/smokes/today', async () => {
  let count = 0
  const smokes = await client
    .db('stats')
    .collection('smokes')
    .find(queryForToday, SORT_CREATE_DATE_DESC)
    .toArray()

  for (const smoke of smokes) {
    count += Number(smoke.count)
  }

  return smokes
})

app.get('/smokes/today/count', async () => {
  let count = 0
  const smokes = await client
    .db('stats')
    .collection('smokes')
    .find(queryForToday, SORT_CREATE_DATE_DESC)
    .toArray()

  for (const smoke of smokes) {
    count += Number(smoke.count)
  }

  return count
})

app.get('/smokes/latest', async () => {
  let count = 0
  const smokes = await client
    .db('stats')
    .collection('smokes')
    .find({}, SORT_CREATE_DATE_DESC)
    .toArray()

  for (const smoke of smokes) {
    count += Number(smoke.count)
  }

  return { count, latest: Day().utc(smokes[0].createDate).format('dddd, MMM. DD YYYY @ HH:mm:ss') }
})

app.get('/smokes/today', async () => {
  let count = 0
  const smokes = await client
    .db('stats')
    .collection('smokes')
    .find(queryForToday, SORT_CREATE_DATE_DESC)
    .toArray()

  for (const smoke of smokes) {
    count += Number(smoke.count)
    smoke.createDate = Day().utc(smoke.createDate).format('dddd, MMM. DD YYYY @ HH:mm:ss')
  }

  return { count, smokes }
})

app.post(
  '/smokes',
  async ({ body }) => {
    const smoke = { count: body.count || 1, createDate: new Date() }

    const res = await client.db('stats').collection('smokes').insertOne(smoke)

    logger.info(`[POST /smokes] ${JSON.stringify(res, null, 3)} smoke(s) inserted`)

    return { response: res, smoke }
  },
  {
    body: t.Object({ count: t.Optional(t.Union([t.Number(), t.String()])) }),
  },
)

app.get('/smokes/fix', async () => {
  return new Promise(async (resolve, reject) => {
    try {
      const smokes = await client.db('stats').collection('smokes').find().toArray()
      const queue = new PQueue({ concurrency: 16 })

      for (const smoke of smokes) {
        // const updateRes = await client
        //   .db('stats')
        //   .collection('smokes')
        //   .updateOne(
        //     { _id: smoke._id },
        //     { $set: { count: Number(smoke.count), createDate: new Date(smoke.createDate) } },
        //   )
        queue.add(async () => {
          const updateRes = await client
            .db('stats')
            .collection('smokes')
            .updateOne(
              { _id: smoke._id },
              {
                $set: { count: Number(smoke.count), createDate: new Date(smoke.createDate) },
                $unset: {
                  tempDate: '',
                },
              },
            )

          logger.info(
            `[GET /smokes/fix#queue] ${JSON.stringify(updateRes, null, 3)} smoke(s) updated`,
          )
        })
      }

      queue.on('idle', () => {
        logger.info(`[GET /smokes/fix] smokes finished updating.`)
        resolve(true)
      })
      // client.db('stats').collection('smokes').updateMany({}, { $set: { count: 1 } })
    } catch (err) {
      reject(err)
    }
  })
})

app.listen(process.env.APP_PORT!)

logger.success(`Server listening on port ${app.server?.port}`)
