import Day from 'dayjs'
import TZPlugin from 'dayjs/plugin/timezone'
import UTCPlugin from 'dayjs/plugin/utc'

Day.extend(UTCPlugin)
Day.extend(TZPlugin)

export { Day }
export default Day
