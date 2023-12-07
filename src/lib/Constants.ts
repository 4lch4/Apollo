import { FindOptions } from 'mongodb'

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

export { SORT_CREATE_DATE_DESC, endOfToday, queryForToday, startOfToday }
