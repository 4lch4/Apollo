import { logger } from '@4lch4/backpack'
import { Elysia, t } from 'elysia'
import { FindOptions, MongoClient, ObjectId } from 'mongodb'
import { Day } from '../lib'

// #region Constants
const SORT_CREATE_DATE_DESC: FindOptions = { sort: { createDate: -1 } }

const startOfToday = Day()
  .utc()
  .set('hour', 0)
  .set('minute', 0)
  .set('second', 0)
  .set('millisecond', 0)
  .tz('America/Chicago')
  .toDate()
// startOfToday.setHours(0, 0, 0, 0)
// Day().set('hour', 0).set('minute', 0).set('second', 0).set('millisecond', 0).tz('America/Chicago')

const endOfToday = Day()
  .utc()
  .set('hour', 23)
  .set('minute', 59)
  .set('second', 59)
  .set('millisecond', 999)
  .tz('America/Chicago')
  .toDate()

const queryForToday = {
  createDate: {
    $gte: startOfToday,
    $lte: endOfToday,
  },
}

const dbClient = await MongoClient.connect(process.env.MONGO_URL!)
// #endregion Constants

interface SmokeEntry {
  count: number
  createDate: Date
}

export class SmokesRoute {
  private static async getTodaysSmokes(countOnly: boolean = false) {
    let count = 0
    const smokes = await dbClient
      .db('stats')
      .collection('smokes')
      .find(queryForToday, SORT_CREATE_DATE_DESC)
      .toArray()

    for (const smoke of smokes) {
      count += Number(smoke.count)
      smoke.createDate = Day(smoke.createDate).utc().format('dddd, MMM. DD YYYY @ HH:mm:ss')
    }

    if (countOnly) return count
    return { count, smokes }
  }

  private static async getLatestSmokes() {
    let count = 0
    const smokes = await dbClient
      .db('stats')
      .collection('smokes')
      .find({}, SORT_CREATE_DATE_DESC)
      .toArray()

    for (const smoke of smokes) {
      count += Number(smoke.count)
    }

    return {
      count,
      latest: Day().utc(smokes[0].createDate).format('dddd, MMM. DD YYYY @ HH:mm:ss'),
    }
  }

  private static async addSmoke(body: { count?: number | string }) {
    const smoke = { count: Number(body.count) || 1, createDate: new Date() }

    const res = await dbClient.db('stats').collection('smokes').insertOne(smoke)

    logger.info(`[POST /smokes] ${JSON.stringify(res, null, 3)} smoke(s) inserted`)

    return { response: res, smoke }
  }

  public static build() {
    const smokesRoute = new Elysia()

    smokesRoute.get('/smokes/today', async () => this.getTodaysSmokes())
    smokesRoute.get('/smokes/today/count', async () => this.getTodaysSmokes(true))
    smokesRoute.get('/smokes/latest', async () => this.getLatestSmokes())

    smokesRoute.post('/smokes', async ({ body }) => this.addSmoke(body), {
      body: t.Object({ count: t.Optional(t.Union([t.Number(), t.String()])) }),
    })

    smokesRoute.get('/smokes/:id', async ({ params }) => {
      const res = await dbClient
        .db('stats')
        .collection('smokes')
        .findOne({ _id: new ObjectId(params.id) })

      return res
    })

    /** Means I decided to smoke a Cigarette. */
    type CigaretteSmokedEvent = 'cigarette-smoked'

    /** Means I decided to actively not smoke a Cigarette. */
    type CigaretteNotSmokedEvent = 'cigarette-not-smoked'

    // type HealthEventNames =

    type HealthEvent = {
      eventName: CigaretteSmokedEvent | CigaretteNotSmokedEvent
      eventValues: { [key: string]: string | number | boolean | Date }
      createDate: Date
    }

    smokesRoute.get('/smokes/fix', async () => {
      const currentSmokes = await dbClient
        .db('stats')
        .collection<SmokeEntry>('smokes')
        .find({})
        .toArray()
      let x = 0
      const healthEvents: HealthEvent[] = []

      for (const smoke of currentSmokes) {
        const event: HealthEvent = {
          eventName: 'cigarette-smoked',
          eventValues: { count: smoke.count },
          createDate: smoke.createDate,
        }

        if (x < 5) {
          console.log('Converting the following...')
          console.log(smoke)

          console.log('Into this...')
          console.log(event)
        }

        x++

        healthEvents.push(event)
      }
    })

    return smokesRoute
  }
}
