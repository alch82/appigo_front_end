import { Component, Input, Output, EventEmitter } from '@angular/core'
import { TCTask } from '../../../classes/tc-task'

@Component({
    selector: 'advanced-recurrence-every-x-period',
    templateUrl: 'advanced-recurrence-every-x-period.component.html',
    styleUrls: ['../../../../assets/css/task-editors.css']
})
export class AdvancedRecurrenceEveryXPeriodComponent {
    @Output() done : EventEmitter<string> = new EventEmitter<string>()

    readonly periods : string[] = [
        'Days',
        'Weeks',
        'Months',
        'Years',
    ]

    readonly values : number[] = []

    selectedPeriod : string = this.periods[0]
    selectedValue : number = 1

    constructor() {
        const count = 100
        for (let i = 1; i < count; i++) {
            this.values.push(i)
        }
    }

    // private selectPeriod(period : string) {
    //     this.selectedPeriod = period
    // }

    // private selectValue(value : number) {
    //     this.selectedValue = value
    // }

    removePressed() {
        this.done.emit(null)
    }

    savePressed() {
        this.done.emit(`Every ${this.selectedValue} ${this.selectedPeriod}`)
    }
}