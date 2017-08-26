import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnInit, AfterViewChecked, HostListener }  from '@angular/core'
import { NgbDateStruct, NgbTimeStruct } from '@ng-bootstrap/ng-bootstrap'

import { TCTask } from "../../classes/tc-task"
import { TCList } from "../../classes/tc-list"
import { TCAccount } from "../../classes/tc-account"
import { TCTaskNotification, OffsetTimes } from "../../classes/tc-task-notification"
import { TCComment } from '../../classes/tc-comment'
import { TCTag } from '../../classes/tc-tag'

import { TCTaskService, CompleteTasksResponse } from "../../services/tc-task.service"
import { TCListService } from "../../services/tc-list.service"
import { TCTaskNotificationService } from "../../services/tc-task-notification.service"
import { TCCommentService, CommentWithUser } from "../../services/tc-comment.service"
import { TCLocationService } from "../../services/tc-location.service"
import { TCAccountService } from '../../services/tc-account.service'
import { TCAppSettingsService }    from '../../services/tc-app-settings.service'
import { TCTagService } from '../../services/tc-tag.service'
import { TaskCompletionService } from '../../services/task-completion.service'
import { TaskEditService, EditedTaskUpdatePublisher } from '../../services/task-edit.service'
import { PaywallService } from '../../services/paywall.service'

import { TaskPriority, TaskRecurrenceType, RepeatFromType, AdvancedRecurrenceType, Utils, TaskEditState } from "../../tc-utils"
import { MouseEvent as MapMouseClick } from "@agm/core"
import { AsYouTypeFormatter, PhoneNumberUtil, PhoneNumberFormat } from 'google-libphonenumber'
import { Subscription, Observable } from 'rxjs'
import * as moment from 'moment'

enum ActionInputType {
    TextField,
    ContactSelect,
    LocationSelect,
    None
}

enum TaskCompletionState {
    Initial = 0,
    GracePeriod,
    Saving,
    Complete,
    Error,
    None
}

interface ActionInputModel {
    input : ActionInputType
    placeholder : string
    update : (text : string) => void
    completion : (actionInfo : string) => void
}

interface RecurrenceRow {
    label : string,
    type  : TaskRecurrenceType,
    advancedType? : AdvancedRecurrenceType
}

interface CommentRow {
    commentWithUser : CommentWithUser,
    updating : boolean
}

interface NotificationRow {
    notification : TCTaskNotification
}

@Component({
    selector: 'task-edit',
    templateUrl: 'task-edit.component.html',
    styleUrls: ['../../../assets/css/task-editors.css', 'task-edit.component.css']
})
export class TaskEditComponent implements OnInit {
    account : TCAccount

    @Input() taskEditorIsOpen : boolean = false

    openNoteEditor : boolean
    showComments   : boolean = false
    collapsedNavbar: boolean
    showListSelect : boolean = false
    showRecurrenceSelect : boolean = false
    showTagEditor : boolean = false
    showLocationAlertSelect : boolean = false

    private autocompleteSubscription : Subscription = null
    locationSearchInputRef : ElementRef
    @ViewChild('locationSearchInput') set locationSearchInput(ref : ElementRef) {
        if (!ref) return
        
        this.locationSearchInputRef = ref
        if (this.autocompleteSubscription) this.autocompleteSubscription.unsubscribe()
        this.autocompleteSubscription = this.locationService.registerForPlacesAutocomplete(ref).subscribe(result => {
            this.latitude = result.coords.lat
            this.longitude = result.coords.lng
            this.currentAddress = result.formattedAddress
        })
    }

    @ViewChild('taskCommentInput') taskCommentInput : ElementRef

    ActionInputType = ActionInputType
    actionTextInput : string = ''
    currentActionInput : ActionInputModel = {
        input : ActionInputType.None,
        placeholder : 'none',
        update : (text : string) => {},
        completion : (actionInfo : string) => {}
    }

    @ViewChild('circleBar') circleBar
    @ViewChild('taskNameInput') taskNameInput
    @ViewChild('dueDateDatePickerDrop') dueDateDatePickerDrop
    @ViewChild('startDateDatePickerDrop') startDateDatePickerDrop

    TaskCompletionState = TaskCompletionState
    private _currentCompletionState : TaskCompletionState = TaskCompletionState.None
    get currentCompletionState() : TaskCompletionState {
        return (this._task.isCompleted && this._currentCompletionState !== TaskCompletionState.Saving) ? TaskCompletionState.Complete : this._currentCompletionState
    }
    set currentCompletionState(state : TaskCompletionState) {
        this._currentCompletionState = state
    }

    countdownIntervalId : any
    animationTimeoutId : any

    private innerCountdownTimer : number = 0 // 0s
    private currentCountdownProgress : number = 0 // 0%
    private readonly countdownTime  : number = 4 // 4s
    private readonly intervalStep : number = 100 // 100ms

    private readonly circleRadius : number = 8
    private readonly circleLine : number = 2 * Math.PI * this.circleRadius

    @HostListener('window:keydown', ['$event'])
    keyboardInput(event: KeyboardEvent) {
        if (this.taskEditorIsOpen && event.keyCode == 27 && this._task.identifier) {
            this.finishEditTask()
        }
    }

    actionInputModels = {
        contact: { input : ActionInputType.ContactSelect, placeholder : 'Contact', update : (text : string) => {}, completion : (info) => { /* Null op until contact stuff is worked out */ } },
        location: { 
            input : ActionInputType.LocationSelect, 
            placeholder : 'Search for location', 
            update : (text : string) => {}, 
            completion : (info) => { this.searchForAddress(info) } },
        phone: { 
            input : ActionInputType.TextField,
            placeholder : 'Phone Number', 
            update : (text : string ) => {
                const formatter = new AsYouTypeFormatter('US')
                let result = ''
                let count = 0
                for (const character of text) {
                    if (isNaN(parseFloat(character))) {
                        continue
                    }
                    
                    count++
                    result = formatter.inputDigit(character)
                    if (count >= 11) break
                }
                this.actionTextInput = result
            }, 
            completion : (info) => { 
                this._task.taskTypePhoneNumber = this.actionTextInput 
                this.currentActionInput = this.actionInputModels.none
                this.actionTextInput = ''
                this.saveTaskUpdate()
            } 
        },
        url: { 
            input : ActionInputType.TextField, 
            placeholder : 'URL', 
            update : (text : string) => {
                this.actionTextInput = text
            }, 
            completion : (info) => { 
                this._task.taskTypeURL = info
                this.currentActionInput = this.actionInputModels.none
                this.actionTextInput = ''
                this.saveTaskUpdate()
            } 
        },
        none: { input : ActionInputType.None, placeholder : 'none', update : () => {}, completion : (actionInfo : string) => {} }
    }

    recurrenceRows : RecurrenceRow[] = [
        { label : "None",            type : TaskRecurrenceType.None         },
        { label : "Every Day",       type : TaskRecurrenceType.Daily        },
        { label : "Every Week",      type : TaskRecurrenceType.Weekly       },
        { label : "Every Two Weeks", type : TaskRecurrenceType.Biweekly     },
        { label : "Every Month",     type : TaskRecurrenceType.Monthly      },
        { label : "Quarterly",       type : TaskRecurrenceType.Quarterly    },
        { label : "Semiannually",    type : TaskRecurrenceType.Semiannually },
        { label : "Every Year",      type : TaskRecurrenceType.Yearly       },
        { label : "Every X days", type : TaskRecurrenceType.Advanced, advancedType : AdvancedRecurrenceType.EveryXDaysWeeksMonths },
        { label : "The X day of each month", type : TaskRecurrenceType.Advanced, advancedType : AdvancedRecurrenceType.TheXOfEachMonth },
        { label : "On days of the week", type : TaskRecurrenceType.Advanced, advancedType : AdvancedRecurrenceType.EveryMonTueEtc }
    ]
    readonly AdvancedRecurrenceType = AdvancedRecurrenceType
    showAdvancedRecurrence : AdvancedRecurrenceType = AdvancedRecurrenceType.Unknown
    TaskRecurrenceType = TaskRecurrenceType

    _task        : TCTask = new TCTask()
    listForTask  : TCList = new TCList()
    notificationRows   : NotificationRow[] = []
    commentRows        : CommentRow[] = []
    taskTags           : TCTag[] = []
    dueDateModel       : NgbDateStruct
    startDateModel     : NgbDateStruct
    completedDateModel : NgbDateStruct
    taskEditPublisher  : EditedTaskUpdatePublisher
    taskOriginName     : string
    TaskPriority = TaskPriority
    notificationSubscription : Subscription
    notificationEditorID : string = null
    set task(task : TCTask) {
        if (task) {
            this._task = task
            this.taskOriginName = this._task.name
            this.openNoteEditor = false
            this.collapsedNavbar = false
            this.showComments = false
            this.showListSelect = false
            this.showRecurrenceSelect = false
            this.showTagEditor = false
            this.showLocationAlertSelect = false
            this.currentActionInput = this.actionInputModels.none
            this._currentCompletionState = this.completionService.taskIsBeingCompleted(this._task) ? TaskCompletionState.Saving : TaskCompletionState.None

            if (this.notificationSubscription) this.notificationSubscription.unsubscribe()
            this.notificationSubscription = this.notificationService.currentTaskNotifications.subscribe(notifications => {
            
                this.notificationRows = notifications.map(notification => {
                    return { notification : notification, updating: false }
                })

                const baseNotification = notifications.find(notification => notification.triggerOffset == 0)
                if (notifications.length > 0 && baseNotification != null) {
                    this._task.dueDate = new Date(baseNotification.triggerDate)
                    this._task.dueDateHasTime = true
                }
                else if (this._task.hasDueDate) {
                    this._task.dueDate.setHours(0)
                    this._task.dueDate.setMinutes(0)
                    this._task.dueDateHasTime = false
                }
            })
            this.notificationService.notificationsForTask(task)

            this.listService.lists.take(1).subscribe(pub => {
                this.listForTask = pub.lists.find(list => this._task.listId == list.identifier)
            })
            
            this.commentService.commentsForTask(task).first().subscribe(comments => {
                this.commentRows = comments.map((e) : CommentRow => { return { commentWithUser : e, updating : false } } )
            })

            this.taskTags = []
            this.tagService.tagsForTask(this._task).first().subscribe(tags => {
                this.taskTags = tags
            })

            const now = new Date()
            this.dueDateModel       = this.dateToDateStruct(task.hasDueDate ? task.dueDate : now)
            this.startDateModel     = this.dateToDateStruct(task.hasStartDate ? task.startDate : now)
            this.completedDateModel = this.dateToDateStruct(task.isCompleted ? task.completionDate : now)

            this.repeatFrom = task.getRepeatFromType()
        }
    }

    readonly defaultTaskName : string = 'New Task'

    firstDayOfWeek :number = 7

    assigned:string

    constructor(
        private readonly taskService : TCTaskService,
        private readonly listService : TCListService,
        private readonly notificationService : TCTaskNotificationService,
        private readonly commentService : TCCommentService,
        private readonly locationService: TCLocationService,
        private readonly accountService : TCAccountService,
        private readonly completionService : TaskCompletionService,
        private readonly taskEditService : TaskEditService,
        private readonly paywallService : PaywallService,
        private readonly tagService : TCTagService,
        private appSettingsService: TCAppSettingsService
    ) {
        this.openNoteEditor = false
        this.collapsedNavbar = true

        this.assigned = ''

        this.firstDayOfWeek = parseInt(this.appSettingsService.calendarFirstDayDP)
    }

    ngOnInit() {
        this.accountService.account.take(1).subscribe(account => {
            this.account = account
        })
        this.locationService.currentPosition.first().subscribe(position => {
            this.latitude = position.lat
            this.longitude = position.lng
        })
        
        this.taskEditService.editedTask
            .filter(info => info.state == TaskEditState.Beginning)
            .subscribe(info => {
                this.task = info.task
                this.taskEditPublisher = info.publisher
            })

        this.taskService.taskDeleted.subscribe(task => {
            if (task.idEqual(this._task)) {
                this.finishEditTask()
            }
        })
    }

    removeActionData() {
        this._task.removeTaskTypeData()
        this.saveTaskUpdate()
    }

    saveTaskUpdate() : Observable<TCTask> {
        const obs = this.taskService.update(this._task).first()
        obs.subscribe(result => {
            this.taskOriginName = this._task.name
        })
        return obs
    }

    finishEditTask() {
        this.taskEditService.finishEditTask(this._task)
    }

    updateTaskName(name : string) {
        if (name && name.trim().length > 0) {
            if (this._task.taskType > 0) {
                this._task.name = Utils.capitalizeWord(name.trim())
            } else {
                this._task.name = Utils.capitalizeSentence(name.trim())
            }
        }
    }

    saveTaskName(name : string) {
        if (this.taskNameInput) {
            this.taskNameInput.nativeElement.blur()
        }
        if(name.trim() === this.taskOriginName) return
        this.updateTaskName(name.trim())
        this.saveTaskUpdate()
    }

    checkEmptyTaskName(name : string){
        if (name.trim().length === 0) {
            this._task.name = this.defaultTaskName
        }
    }
    selectTaskName(){
        if (this.taskNameInput) {
            this.taskNameInput.nativeElement.select()
        }
    }

    starredTask() {
        this._task.starred = !this._task.starred
        this.saveTaskUpdate()
    }

    dateStructToDate(dateStruct : NgbDateStruct) : Date {
        // NgbDateStruct uses a 1 based system for months, ES Date uses a 0 based system.
        return new Date(dateStruct.year, dateStruct.month - 1, dateStruct.day)
    }

    dateToDateStruct(date : Date) : NgbDateStruct {
        return {
            year : date.getFullYear(),
            month: date.getMonth() + 1,
            day  : date.getDate()
        }
    }

    updateDueDate(model : NgbDateStruct) {
        this.dueDateModel = model
        const newDate = this.dateStructToDate(this.dueDateModel)
        const oldDate = this._task.dueDate
        
        const baseNotificationRow = this.notificationRows.find(row => row.notification.triggerOffset == 0)
        const baseNotification = baseNotificationRow ? baseNotificationRow.notification : null
        if (baseNotification) {
            newDate.setHours(baseNotification.triggerDate.getHours())
            newDate.setMinutes(baseNotification.triggerDate.getMinutes())
            
            for (const row of this.notificationRows) {
                const notification = row.notification

                notification.triggerDate = new Date(newDate)
                this.notificationService.update(notification).first().subscribe(result => {})
            }
        }

        this._task.dueDate = newDate

        this.taskEditPublisher.dueDateUpdated({ task: this._task, oldDate : oldDate, newDate : newDate })
        this.saveTaskUpdate()
        this.dueDateDatePickerDrop.close()
    }

    removeDueDate() {
        const oldDate = this._task.dueDate
        this.dueDateModel = this.dateToDateStruct(new Date())
        this._task.dueDate = null
        this._task.startDate = null
        this.taskEditPublisher.dueDateUpdated({ task : this._task, oldDate : oldDate, newDate : null })
        this.saveTaskUpdate()

        if (this.notificationRows.length > 0) {
            const mainNotification = this.notificationRows.find( row => row.notification.triggerOffset == 0 ).notification
            this.removeNotification(mainNotification)
        }
    }

    isInvalidStartDate = (model : NgbDateStruct) : boolean => {
        const date = this.dateStructToDate(model)
        return date > this._task.dueDate
    }

    updateStartDate(model: NgbDateStruct) {
        this.startDateModel = model
        this._task.startDate = this.dateStructToDate(this.startDateModel)
        this.saveTaskUpdate()
        this.startDateDatePickerDrop.close();
    }

    removeStartDate() {
        this.startDateModel = this.dateToDateStruct(new Date())
        this._task.startDate = null
        this.saveTaskUpdate()
    }

    completeTask() {
        if (this.currentCompletionState == TaskCompletionState.Saving) return

        this.currentCompletionState = this.currentCompletionState >= TaskCompletionState.Error ?
            TaskCompletionState.Initial : TaskCompletionState.None

        if (this.currentCompletionState != TaskCompletionState.None) {
            this.currentCompletionState = TaskCompletionState.Initial

            this.animationTimeoutId = setTimeout(() => {
                this.completeTaskSave()
                this.resetCompleteTask()
            }, 400)
        } else {
            clearTimeout(this.animationTimeoutId)
            this.currentCompletionState = TaskCompletionState.None
            this.resetCompleteTask()
        }
    }
    
    completeTaskSave(){
        this.currentCompletionState = TaskCompletionState.Saving

        this.taskService.completeTask(this._task).first().subscribe((completedTasks : CompleteTasksResponse) => {
            if (!completedTasks.completedTaskIDs.reduce((accum, curr) => accum || this._task.identifier == curr, false)) return

            const completionDate = new Date()
            this.completedDateModel = this.dateToDateStruct(completionDate)
            this._task.completionDate = completionDate
            this.taskEditPublisher.completedTask(this._task)
            this.currentCompletionState = TaskCompletionState.None
        })
    }

    resetCompleteTask() {
        clearInterval(this.countdownIntervalId)
        this.countdownIntervalId = null

        this.innerCountdownTimer = 0
        this.currentCountdownProgress = 0

        this.circleBar.nativeElement.style.removeProperty('stroke-dashoffset')
        this.circleBar.nativeElement.style.removeProperty('stroke-dasharray')
    }

    uncompleteTask() {
        this.currentCompletionState = TaskCompletionState.Saving

        this.taskService.uncompleteTask(this._task).first().subscribe((uncompletedTasks : CompleteTasksResponse) => {
            if (!uncompletedTasks.completedTaskIDs.reduce((accum, curr) => accum || this._task.identifier == curr, false)) return

            this.completedDateModel = this.dateToDateStruct(new Date())
            this._task.completionDate = null
            this.taskEditPublisher.uncompletedTask(this._task)
            this.currentCompletionState = TaskCompletionState.None
        })
    }

    updatePriority(priority : TaskPriority) {
        const oldPriority = this._task.priority
        this._task.priority = priority
        this.taskEditPublisher.priorityUpdated({ task : this._task, oldPriority : oldPriority, newPriority : this._task.priority })
        this.saveTaskUpdate()
    }

    updateNote(text:string) {        
        this._task.note = text
    }

    creatingNotification = false
    addNotification() {
        this.notificationEditorID = null

        let now = new Date()
        let date = this._task.dueDate ? this._task.dueDate : new Date()
        date.setHours(now.getHours() + 1)
        let triggerOffset = 0

        if (this.notificationRows.length > 0) {
            const baseNotification = this.notificationRows.find(row => row.notification.triggerOffset == 0).notification
            triggerOffset = OffsetTimes.minute * 15
            date = baseNotification.triggerDate
        }

        const newNotification = new TCTaskNotification({ 
            taskid        : this._task.identifier,
            sound_name    : 'bell', 
            triggerdate   : Math.floor(date.getTime() / 1000),
            triggeroffset : triggerOffset
        })

        this.creatingNotification = true
        this.notificationService.create(newNotification).first().subscribe(response => {
            this.creatingNotification = false
        })
    }

    updateBaseNotificationTime(notification : TCTaskNotification, time : NgbTimeStruct) {
        notification.triggerDate.setHours(time.hour)
        notification.triggerDate.setMinutes(time.minute)
        notification.triggerDate.setSeconds(0)

        for (const row of this.notificationRows) {
            const n = row.notification

            n.triggerDate = new Date(notification.triggerDate)
            this.notificationService.update(n).first().subscribe(result => {})
        }
    }

    removeNotification(notification : TCTaskNotification) {
        if (notification.triggerOffset == 0) {
            for (const row of this.notificationRows) {
                const notification = row.notification

                this.notificationService.delete(notification).first().subscribe(result => {})
            }
        }
        else {
            this.notificationService.delete(notification)
        }
    }

    openNotificationEditor(identifier : string){
        this.notificationEditorID = identifier
    }

    onOffsetPicked(notification: TCTaskNotification) {
        setTimeout(() => {
            this.notificationEditorID = null
        }, 0)
    }

    taskListMembershipChange(list : TCList) {
        this.taskEditPublisher.changedList({ task : this._task, newList : list })
        this.listForTask = list
        this.saveTaskUpdate()
    }

    removeComment(commentRow : CommentRow) {
        const comment = commentRow.commentWithUser.comment
        commentRow.updating = true
        this.commentService.delete(comment).first().subscribe(res => {
            this.commentRows = this.commentRows.filter(element => comment.identifier != element.commentWithUser.comment.identifier)
        })
    }

    commentInputModel : string = ''

    addComment(text : string) {
        if (!text || !(text.length > 0)) return

        const commentText = new String(text)
        this.accountService.account.first().subscribe(account => {
            const comment = new TCComment({
                itemid : this._task.identifier,
                userid : account.userID,
                text : commentText,
                item_name : this._task.name
            })
            
            const row = { commentWithUser : { comment : comment, user : account }, updating : true }
            this.commentRows.push(row)
            this.commentService.create(comment).first().subscribe(res => {
                this.commentRows = this.commentRows.map((e : CommentRow) : CommentRow => {
                    if (e === row) {
                        return { commentWithUser: { comment : res, user : account }, updating : false }
                    }
                    return e
                })
            })
        })  

        this.commentInputModel = ''      
    }

    latitude  : number= 0
    longitude : number = 0
    currentAddress : string = ''
    mapZoomLevel = 8

    mapClick(event : MapMouseClick) {
        this.latitude = event.coords.lat
        this.longitude = event.coords.lng

        this.locationService.getAddressFromMapCoords(this.latitude, this.longitude).first().subscribe(address => {
            this.currentAddress = address
        })
    }

    searchForAddress(address : string) {
        this.locationService.getMapCoordsFromAddress(address).first().subscribe((info : { coords : any, formattedAddress : string }) => {
            this.mapZoomLevel = 16
            this.latitude = info.coords.lat
            this.longitude = info.coords.lng
            this.currentAddress = info.formattedAddress
        })
    }

    mapOKClicked() {
        this._task.taskTypeLocation = this.currentAddress
        this.currentActionInput = this.actionInputModels.none
        this.saveTaskUpdate()
    }

    RepeatFromType = RepeatFromType
    repeatFrom : RepeatFromType = RepeatFromType.DueDate

    recurrenceRowSelected(recurrenceRow : RecurrenceRow) {
        this._task.determineRecurrenceType(recurrenceRow.type, this.repeatFrom)
        this.showRecurrenceSelect = recurrenceRow.type == TaskRecurrenceType.Advanced

        if (recurrenceRow.type == TaskRecurrenceType.Advanced) {
            this.showAdvancedRecurrence = recurrenceRow.advancedType
            return
        }
        this.saveTaskUpdate()
    }

    selectRepeatFromType(repeatFrom : RepeatFromType) {
        this.repeatFrom = repeatFrom
        const recurrenceValue = this._task.recurrenceType > 100 ? this._task.recurrenceType - 100 : this._task.recurrenceType
        this._task.determineRecurrenceType(recurrenceValue, this.repeatFrom)
        this.saveTaskUpdate()
    }

    onAdvancedRecurrenceStringReceived(recurrence : string) {
        if (!recurrence) this._task.recurrenceType = TaskRecurrenceType.None
        this._task.advancedRecurrenceType = recurrence
        this.showAdvancedRecurrence = AdvancedRecurrenceType.Unknown
        this.showRecurrenceSelect = false
        this.saveTaskUpdate()
    }

    determineRecurrenceRowMessage() : string {
        const recurrenceValue = this._task.recurrenceType > 100 ? this._task.recurrenceType - 100 : this._task.recurrenceType
        if (recurrenceValue == TaskRecurrenceType.Advanced) {
            return this._task.advancedRecurrenceType
        }
        return this.recurrenceRows.find( val => val.type == recurrenceValue ).label
    }
    
    openComments() {
        this.showComments = !this.showComments;
        if (this.showComments) {
            this.taskCommentInput.nativeElement.focus()
        }
    }

    removeLocationAlertInformation() {
        this._task.locationAlert = ''
        this.saveTaskUpdate()
    }

    toggleLocationAlert() {
        this.showLocationAlertSelect = !this.showLocationAlertSelect
        if (!this.showLocationAlertSelect) {
            return // select screen closed
        }

        this.showLocationAlertSelect = false // Hide it until we check with paywall
        this.paywallService.paywallCheck('Premium accounts can set location alerts on tasks', () => {
            this.showLocationAlertSelect = true // Paywall check passed
        })
    }

    onTagSelected(tag : TCTag) {
        this.taskTags.push(tag)
    }

    onTagDeselected(tag : TCTag) {
        this.taskTags = this.taskTags.filter(t => t.identifier != tag.identifier)
    }

    chooseDate(dayOffset : number = 0){
        let date = moment()
        if (dayOffset > 0) date.add(dayOffset, 'days')
        return this.dateToDateStruct(date.toDate())
    }
    isEqualsDates(firstDate: NgbDateStruct, secondDate: NgbDateStruct) {
        if (JSON.stringify(firstDate) === JSON.stringify(secondDate))
            return true
        return false
    }

    getDueDateInputValue() {
        if(!this._task.identifier) return
        return moment(this.dateStructToDate(this.dueDateModel)).format('l')
    }

    getStartDateInputValue() {
        if(!this._task.identifier) return
        return moment(this.dateStructToDate(this.startDateModel)).format('l')
    }

    updateDueDateViaField(dateString : string) {
        let date = moment(dateString)
        if (date.isValid()) {
            this.updateDueDate(this.dateToDateStruct(date.toDate()))
        }
    }

    updateStartDateViaField(dateString : string) {
        let date = moment(dateString)
        if (date.isValid()) {
            this.updateStartDate(this.dateToDateStruct(date.toDate()))
        }
    }
}
