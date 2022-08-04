import { DateTime } from 'luxon'

const timeFormatter: (options?: { time?: number | null; format?: string }) => string = options =>
  DateTime.fromMillis(options?.time || Date.now()).toFormat(options?.format || 'yyyy-MM-dd HH:mm:ss')

export default timeFormatter
