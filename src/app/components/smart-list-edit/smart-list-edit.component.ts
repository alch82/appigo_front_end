import { Component, Output, Input, EventEmitter, OnInit }  from '@angular/core'
import { TCSmartListService } from '../../services/tc-smart-list.service'
import { TCSmartList } from '../../classes/tc-smart-list'
import { TCList } from '../../classes/tc-list'
import { SmartListFilterLabels } from '../../classes/tc-smart-list-filters'
import { Utils } from '../../tc-utils'
import { TCUserSettingsService } from '../../services/tc-user-settings.service'
import { TCUserSettings } from '../../classes/tc-user-settings'

import { SmartListCreateType } from '../smart-list-create/smart-list-create.component'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'


enum SmartListEditScreen {
    Main = 0,
    DefaultDueDate,
    SortType,
    AdditionalColors,
    SourceLists,
    DefaultList,
    Filters,
    CompletedTasksFilter,
    SmartListCreate,
    DeleteConfirmation,
    RestoreEverythingConfirmation
}

@Component({
    selector: 'smart-list-edit',
    templateUrl: 'smart-list-edit.component.html',
    styleUrls: ['../../../assets/css/list-editors.css', 'smart-list-edit.component.css']
})
export class SmartListEditComponent implements OnInit {
    showDuplicateButton : boolean = false
    sortOrder : number = 99
    showRestoreEverythingButton : boolean = false
    savingInProgress : boolean = false

    includedListsMessage : string = "All but 1 list"
    completedTasksMessage: string = "Active and completed"
    sortTypeMessage      : string = "Due date, Priority"
    defaultDueDateMessage: string = "Today"
    defaultListMessage   : string = "Inbox"
    colorMessage         : string = "#2196f3"

    SmartListEditScreen = SmartListEditScreen
    currentScreen : SmartListEditScreen = SmartListEditScreen.Main
    shownFilterKey: string = "none"

    set showSmartListCreate(show : boolean) {
        this.show(show ? SmartListEditScreen.SmartListCreate : SmartListEditScreen.Main)
    }

    bgColorMore  : string  = '#9e9e9e'
    createOnSave : boolean = false

    readonly dueDates = Utils.DueDateNames
    readonly sortTypes = Utils.SortTypeNames
    readonly mainColors = Utils.MainColors
    readonly completedTasksType = Utils.CompletedTasksType
    
    private settings : TCUserSettings

    _smartList : TCSmartList = new TCSmartList()
    @Input() set smartList(smartList: TCSmartList) {
        this._smartList = smartList.copy()
        this.determineColorMessage()
        this.determineIncludedListsMessage()
        this.updateCompletedMessage()

        if (this.settings) {
            this.determineDueDateMessage()
            this.determineSortTypeMessage()
        }

        this.showRestoreEverythingButton = this._smartList.isEverythingSmartList
    }
    @Input() set defaultListName(name : string) {
        this.defaultListMessage = name
    }

    @Output() updatedSmartList      : EventEmitter<any> = new EventEmitter<any>()
    @Output() canceledEditSmartList : EventEmitter<any> = new EventEmitter<any>()
    @Output() duplicatedSmartList   : EventEmitter<TCSmartList> = new EventEmitter<TCSmartList>()
    @Output() readyToCreate         : EventEmitter<TCSmartList> = new EventEmitter<TCSmartList>()
    
    constructor(
        public activeModal: NgbActiveModal,
        private readonly userSettingsService : TCUserSettingsService,
        private smartListService : TCSmartListService
    ) {}

    ngOnInit() {
        this.userSettingsService.settings.subscribe(settings => {
            this.settings = settings
            this.determineDueDateMessage()
            this.determineSortTypeMessage()
        })
    }

    private show(screen : SmartListEditScreen) {
        this.currentScreen = screen
        this.shownFilterKey = 'none'
    }

    private showFilterScreen(filterKey : string) {
        this.currentScreen = SmartListEditScreen.Filters
        this.shownFilterKey = filterKey
    }

    toggleShowListName() {
        this._smartList.showListForTasks = !this._smartList.showListForTasks
        console.log(`Show list name: ${this._smartList.showListForTasks}`)
    }

    toggleShowSubtasks() {
        this._smartList.showSubtasks = !this._smartList.showSubtasks
        console.log(`Show subtasks: ${this._smartList.showSubtasks}`)
    }

    toggleUseStartDates() {
        this._smartList.excludeStartDates = !this._smartList.excludeStartDates
        console.log(`Use start dates: ${!this._smartList.excludeStartDates}`)
    }

    removeFilter(key : string) {
        delete this._smartList.filter.filterGroups[0][key]
    }

    onFinishEdit() {
        this.activeModal.close()
    }

    saveSmartList() {
        this.savingInProgress = true

        if (this.createOnSave) {
            this._smartList.sortOrder = this.sortOrder
            this.smartListService.create(this._smartList).first().subscribe((savedList : TCSmartList) => {
                this.readyToCreate.emit(savedList)
                this.savingInProgress = false
                this.onFinishEdit()
            })
        } else {
            this.smartListService.update(this._smartList).first().subscribe((updatedList : TCSmartList) => {
                this.updatedSmartList.emit({ list: this._smartList })
                this.savingInProgress = false
                this.onFinishEdit()
            })
        }
    } 

    cancel() {
        this.canceledEditSmartList.emit({})
        this.onFinishEdit()
    }

    duplicateSmartList() {
        this.duplicatedSmartList.emit(this._smartList.duplicate())
        this.onFinishEdit()
    }


    private deleteSmartList() {
        // Trying something a little different. Calling the service directly, and letting
        // it publish information about the smart list being deleted.
        this.smartListService.delete(this._smartList)
        this.onFinishEdit()
    }

    private restoreEverythingSmartList() {
        this._smartList.color = Utils.MainColors[0]
        this._smartList.sortType = -1
        this._smartList.defaultDueDate = -1
        this._smartList.defaultList = ''
        this._smartList.excludedListIds = new Set<string>()
        this._smartList.filter = JSON.parse(Utils.SmartListFilter.Everything)
        if (this._smartList.filter.completedTasks) {
            this._smartList.completedTaskFilter = this._smartList.filter.completedTasks
        } else {
            this._smartList.completedTaskFilter = null
        }

        // TO-DO: Should probably add in some sort of spinner to the dialog to indicate
        // that work is being done.
        this.saveSmartList()
    }

    private createSmartListTypeSelected(type : SmartListCreateType) {
        if (this.savingInProgress) return
        
        if (type == SmartListCreateType.Custom) {
            this.show(SmartListEditScreen.Main)
            this.createOnSave = true

            /* Update background color for 'more colors' button after creating new Smart List */
            if (this._smartList.color !== this.bgColorMore && !this.mainColors.includes(this._smartList.color)) {
                this.bgColorMore = this._smartList.color
            }
        }
        else {
            this.savingInProgress = true

            this._smartList.sortOrder = this.sortOrder
            this.smartListService.create(this._smartList).first().subscribe((savedList : TCSmartList) => {
                this.readyToCreate.emit(savedList)
                this.savingInProgress = false
                this.onFinishEdit()
            })
        }
    }

    private determineDueDateMessage() {
        if (this._smartList.defaultDueDate == -1) {
            this.defaultDueDateMessage = this.dueDates[this.settings.defaultDueDate]
        }
        else {
            this.defaultDueDateMessage = this.dueDates[this._smartList.defaultDueDate]
        }
    }
    private determineSortTypeMessage() {
        if (this._smartList.sortType == -1) {
            this.sortTypeMessage = this.sortTypes[this.settings.taskSortOrder]
        }
        else {
            this.sortTypeMessage = this.sortTypes[this._smartList.sortType]
        }
    }
    private determineColorMessage() {
        this.colorMessage = this._smartList.color
        if (this.mainColors.includes(this._smartList.color)) {
            this.bgColorMore = '#9e9e9e'
        } else {
            this.bgColorMore = this._smartList.color
        }
    }
    private determineIncludedListsMessage() {
        if (this._smartList.excludedListIds.size == 0) {
            this.includedListsMessage = "All lists"
        }
        else {
            this.includedListsMessage = `All but ${this._smartList.excludedListIds.size} list`
            if (this._smartList.excludedListIds.size > 1) this.includedListsMessage += 's'
        }
    }
    private updateDefaultList(list : TCList) {
        this.defaultListMessage = list.name
    }
    private updateCompletedMessage() {
        this.completedTasksMessage = this.completedTasksType[this._smartList.completedTaskFilter.type]
    }
     private updateSmartListName(smartListName : string) {
        if (smartListName.trim()) {
            this._smartList.name = smartListName.trim()
        }
    }
    private updateColor(color : string) {
        if (color) {
            this._smartList.color = color
        }
        if (this.mainColors.includes(color)) {
            this.bgColorMore = '#9e9e9e'
        }
    }
    private getFilterLabel(key : string) : string {
        return SmartListFilterLabels[key]
    }
    private getFilterInformationLabel(key : string) : string {
        return "None"
    }

    private filterKeys() : string[] {
        if (this._smartList.filter && this._smartList.filter.filterGroups && this._smartList.filter.filterGroups.length > 0) {
            return Object.keys(this._smartList.filter.filterGroups[0])
        } else {
            return []
        }
    }
}
