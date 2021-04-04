import moment from 'moment'

const isValidDate: (date: string) => boolean = date => /^\d{8}$/.test(date) && moment(date, 'YYYYMMDD').isValid()

export default isValidDate
