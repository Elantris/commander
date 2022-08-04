import { DateTime } from 'luxon'

const isDateValid: (date: string) => boolean = date =>
  /^\d{8}$/.test(date) && DateTime.fromFormat(date, 'yyyyMMdd').isValid

export default isDateValid
