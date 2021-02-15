import moment from 'moment'

const isValidDate: (date: string) => boolean = date => {
  if (date.length !== 8 || !moment(date, 'YYYYMMDD').isValid()) {
    return false
  }

  return true
}

export default isValidDate
