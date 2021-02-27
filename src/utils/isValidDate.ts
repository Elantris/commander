import moment from 'moment'

const isValidDate: (date: string) => boolean = date => date.length === 8 && moment(date, 'YYYYMMDD').isValid()

export default isValidDate
