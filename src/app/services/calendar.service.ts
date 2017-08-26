import { Injectable } from '@angular/core'
import { TCTask } from '../classes/tc-task'
import { NgbDatepickerI18n } from '@ng-bootstrap/ng-bootstrap'
import { Observable, Subscription, ReplaySubject } from 'rxjs'
import * as moment from 'moment'


const I18N_VALUES = {
    'en': {
        weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
        monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    }
}

@Injectable()
export class I18n {
    language = 'en'
}

@Injectable()
export class TCDatepickerI18n extends NgbDatepickerI18n {

    constructor(private _i18n : I18n) {
        super()
    }

    getWeekdayShortName(weekday : number) : string {
        return I18N_VALUES[this._i18n.language].weekdays[weekday - 1]
    }
    getMonthShortName(month : number) : string {
        return I18N_VALUES[this._i18n.language].monthsShort[month - 1]
    }
    getMonthFullName(month : number) : string {
        return I18N_VALUES[this._i18n.language].months[month - 1]
    }
}


@Injectable()
export class CalendarService {
    private readonly _selectedDates : ReplaySubject<Date[]> = new ReplaySubject<Date[]>(1)
    get selectedDates() : Observable<Date[]> {
        return this._selectedDates
    }

    constructor() {
        this.clearSelectedDates()
    }

    // Selects a single specific date, removing any other selected dates
    selectDate(date : Date) {
        this._selectedDates.next([date])
    }

    // Selects a range of dates, removing any other selected dates
    selectDateRange(start : Date, end : Date) {
        this._selectedDates.next(this.interpolateDates(start, end))
    }

    // Add a date to the already selected dates
    addDateToSelection(date : Date) {
        this.selectedDates.first().subscribe(dates => {
            if (dates.find(d => 
                date.getFullYear() == d.getFullYear() &&
                date.getMonth() == d.getMonth() &&
                date.getDate() == d.getDate())
            ) return

            const newDates = dates.concat([date])
            this._selectedDates.next(newDates)
        })
    }

    // Add a range of dates to the already selected dates
    addDateRangeToSelection(start : Date, end : Date) {
        this.selectedDates.first().subscribe(dates => {
            const filteredDates = this.interpolateDates(start, end).filter(a => {
                return dates.find(b => 
                    a.getFullYear() == b.getFullYear() &&
                    a.getMonth() == b.getMonth() &&
                    a.getDate() == b.getDate()
                ) == null
            })
            const newDates = dates.concat(filteredDates)
            this._selectedDates.next(newDates)
        })
    }

    // Clear all selected dates
    clearSelectedDates() {
        this._selectedDates.next([])
    }

    private interpolateDates(start : Date, end : Date) : Date[] {
        if (start == end) return [new Date(start)]
        const begin  : Date = end > start ? start : end
        const finish : Date = end > start ? end   : start

        const dates : Date[] = [begin]

        let previous = begin
        while (
            previous.getFullYear() <= finish.getFullYear() && 
            previous.getMonth() <= finish.getMonth() && 
            previous.getDate() < finish.getDate()
        ) {
            const current = new Date(previous.getFullYear(), previous.getMonth(), previous.getDate() + 1)
            dates.push(current)
            previous = current
        }

        return dates
    }
}