import { Component, Output, EventEmitter }  from '@angular/core'
import { NgbDateStruct }           from '@ng-bootstrap/ng-bootstrap'
import { CalendarService }         from '../../services/calendar.service'
import { TCAppSettingsService }    from '../../services/tc-app-settings.service'


@Component({
    selector: 'main-calendar',
    templateUrl: 'main-calendar.component.html',
    styleUrls: ['main-calendar.component.css']
})
export class MainCalendarComponent {

    calendar : NgbDateStruct = null
    selectedDates : string[] = []
    _showClearFilter : boolean = false
    timerForFilter : any
    firstDayOfWeek :number = 7

    overdueDates : string[] = [
        '2017-8-3',
        '2017-8-9',
        '2017-8-11',
        '2017-8-18',
        '2017-8-22',
        '2017-8-25',
        '2017-8-26',
        '2017-8-27',
        '2017-9-1',
        '2017-9-3',
        '2017-9-7',
        '2017-9-9',
    ]

    @Output() dateFilterShow : EventEmitter<boolean> = new EventEmitter<boolean>()

    set showClearFilter(state : boolean) {
        clearTimeout(this.timerForFilter)
        if(state && this.selectedDates.length) {
            this.timerForFilter = setTimeout(() => {
                this.dateFilterShow.emit(true)
                this._showClearFilter = true
            }, 2000)
            return
        } else {
            this.dateFilterShow.emit(false)
            this._showClearFilter = false
            this.calendarService.clearSelectedDates()
        }
    }

    constructor(
        private readonly calendarService : CalendarService,
        private appSettingsService: TCAppSettingsService

    ) {}
    ngOnInit() : void {
        this.calendarService.selectedDates.subscribe(dates => {
            this.selectedDates = dates.map(d => {
                return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
            })
        })
        this.firstDayOfWeek = parseInt(this.appSettingsService.calendarFirstDayDP)
    }

    selectDate(e : any, dateStruct : NgbDateStruct) {
        const date_str = dateStruct.year + '-' + dateStruct.month + '-' + dateStruct.day
        const date = new Date(date_str)

        if (e.shiftKey && !this.selectedDates.includes(date_str) && this.selectedDates.length > 0) {
            let startDate = new Date(this.selectedDates[this.selectedDates.length - 1])
            this.calendarService.selectDateRange(startDate, date)
        } else if (this.selectedDates.includes(date_str) && this.selectedDates.length == 1) {
            this.calendarService.clearSelectedDates()
        } else if (!e.ctrlKey) {
            this.calendarService.selectDate(date)
        } else if (e.ctrlKey) {
            this.calendarService.addDateToSelection(date)
        }
        this.showClearFilter = true
    }

    isSelected(dateStruct: NgbDateStruct) {
        const date_str = this.dateString(dateStruct)
        if (this.selectedDates.includes(date_str))
            return true
        return false
    }

    dateString(date: NgbDateStruct) {
        return date.year + '-' + date.month + '-' + date.day
    }

    hasTask(date : NgbDateStruct){
        //Not Implemented yet

        //for example - use static array
        return this.overdueDates.includes(this.dateString(date))
    }
    isCurrentDay(date: NgbDateStruct){
        let currentDate = new Date()
        return currentDate.getMonth() + 1 == date.month && currentDate.getDate() == date.day
    }
}
