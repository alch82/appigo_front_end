import {Component, OnInit, OnDestroy, Input, Output, EventEmitter, HostListener }  from '@angular/core'

import { TCTaskService } from '../../services/tc-task.service'
import { TCTaskitoService } from '../../services/tc-taskito.service'
import { TaskCompletionService } from '../../services/task-completion.service'
import { TCListService } from '../../services/tc-list.service'
import { TCSmartListService } from '../../services/tc-smart-list.service'
import { TCUserSettingsService } from '../../services/tc-user-settings.service'
import { TCSyncService } from '../../services/tc-sync.service'
import { TaskEditService } from '../../services/task-edit.service'
import { CalendarService } from '../../services/calendar.service'

import { TCUserSettings } from '../../classes/tc-user-settings'
import { TCObject } from '../../classes/tc-object'
import { TCList } from '../../classes/tc-list'
import { TCSmartList } from '../../classes/tc-smart-list'
import { TCTask } from '../../classes/tc-task'
import { TCTaskito } from '../../classes/tc-taskito'

import { TaskPriority, TaskType, DefaultDueDate, TaskEditState } from '../../tc-utils'
import { TaskCreatedEvent, TaskitoCreatedEvent } from '../../tc-types'
import { DragulaService } from 'ng2-dragula'

import { 
    TaskSource, 
    ListTaskSource, 
    SmartListTaskSource
} from './task-source-modules'
import { TaskPager, PagerServices } from './task-pager'
import { TaskCell, TaskCellImpl } from './task-cell'
import { TaskCreationInformation } from './task-create.component'
import { Subscription } from 'rxjs'

interface TaskSectionDefinition {
    label : string,
    taskCells : TaskCell[]
}

interface SelectedTaskInformation {
    cell    : TaskCell,
    section : TaskSectionDefinition,
    parent? : TaskCell
}

@Component({
    selector: 'tasks',
    templateUrl: 'tasks.component.html',
    styleUrls: ['tasks.component.css',
        './../../../../node_modules/dragula/dist/dragula.css'
    ]
})
export class TasksComponent implements OnDestroy {
    sourceModule : TaskSource
    selectedTaskInformation : SelectedTaskInformation
    selectedDates : Date[] = []
    keyTracking    : boolean = true

    get taskCreationInformation() : TaskCreationInformation {
        const info = this.sourceModule ? this.sourceModule.taskCreationInformation : null
        if (!info) return null

        const selectedTask = this.selectedTaskInformation ? this.selectedTaskInformation.cell.task : null
        if (!selectedTask) return info

        if (selectedTask.isParent && this.selectedTaskInformation.cell.showSubtasks) {
            info.parentTask = selectedTask
            info.parentIsChecklist = selectedTask.isChecklist
        }

        if (selectedTask.isSubtask && !selectedTask.isChecklist) {
            info.parentTask = this.selectedTaskInformation.parent.task
            info.parentIsChecklist = info.parentTask.isChecklist
        }

        return info
    }

    readonly labelsForSections = {
        new         : 'New',
        overdue     : 'Overdue',
        today       : 'Today',
        tomorrow    : 'Tomorrow',
        nextSevenDays: 'Next Seven Days',
        future      : 'Future',
        noDueDate   : 'Someday',
        high        : 'High',
        medium      : 'Medium',
        low         : 'Low',
        none        : 'None',
        incomplete  : 'Incomplete',
        completed   : 'Completed',
        subtask     : ''
    }

    readonly sectionDefinitions = {
        newTask         : { label : this.labelsForSections.new,           taskCells : [] },
        noDueDate       : { label : this.labelsForSections.noDueDate,     taskCells : [] },
        overdue         : { label : this.labelsForSections.overdue,       taskCells : [] },
        dueToday        : { label : this.labelsForSections.today,         taskCells : [] },
        dueTomorrow     : { label : this.labelsForSections.tomorrow,      taskCells : [] },
        dueNextSevenDays: { label : this.labelsForSections.nextSevenDays, taskCells : [] },
        dueFuture       : { label : this.labelsForSections.future,        taskCells : [] },
        noPriority      : { label : this.labelsForSections.none,          taskCells : [] },
        lowPriority     : { label : this.labelsForSections.low,           taskCells : [] },
        mediumPriority  : { label : this.labelsForSections.medium,        taskCells : [] },
        highPriority    : { label : this.labelsForSections.high,          taskCells : [] },
        alphabetical    : { label : this.labelsForSections.incomplete,    taskCells : [] },
        completed       : { label : this.labelsForSections.completed,     taskCells : [] },
        subtask         : { label : this.labelsForSections.subtask,       taskCells : [] }
    }
    
    // taskitos : TCTaskito[] = [] // We can just use a flat array, because the taskitos view has no sections.
    currentSections : TaskSectionDefinition[] = []

    readonly sortTypeSections : TaskSectionDefinition[][] = [
        [
            this.sectionDefinitions.overdue,
            this.sectionDefinitions.dueToday,
            this.sectionDefinitions.dueTomorrow,
            this.sectionDefinitions.dueNextSevenDays,
            this.sectionDefinitions.dueFuture,
            this.sectionDefinitions.noDueDate,
            this.sectionDefinitions.completed
        ],
        [
            this.sectionDefinitions.highPriority,
            this.sectionDefinitions.mediumPriority,
            this.sectionDefinitions.lowPriority,
            this.sectionDefinitions.noPriority,
            this.sectionDefinitions.completed
        ],
        [ 
            this.sectionDefinitions.alphabetical,
            this.sectionDefinitions.completed
        ],
        [ 
            this.sectionDefinitions.subtask,
            this.sectionDefinitions.completed
        ]
    ]

    readonly sortTaskSectionFunctions : ((task : TCTask) => TaskSectionDefinition)[] = [
        (task : TCTask) => {
            // Each of these dates is actually set to midnight of the next day, but 
            // it makes the logic fairly simple.
            const yesterday= new Date(new Date().setHours(0, 0, 0, 0))
            const today    = new Date(new Date().setHours(24, 0, 0, 0))
            const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
            const nextWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)

            if (task.isCompleted) return this.sectionDefinitions.completed
            if (!task.hasDueDate) return this.sectionDefinitions.noDueDate
            else if (task.dueDate >= nextWeek) return this.sectionDefinitions.dueFuture
            else if (task.dueDate >= tomorrow) return this.sectionDefinitions.dueNextSevenDays
            else if (task.dueDate >= today) return this.sectionDefinitions.dueTomorrow
            else if (task.dueDate >= yesterday) return this.sectionDefinitions.dueToday
            else if (task.dueDate < yesterday) return this.sectionDefinitions.overdue
            else return this.sectionDefinitions.noDueDate // Something weird happened, assume no due date
        },
        (task : TCTask) => {
            if (task.isCompleted) return this.sectionDefinitions.completed
            switch(task.priority){
                case TaskPriority.Low   : return this.sectionDefinitions.lowPriority
                case TaskPriority.Medium: return this.sectionDefinitions.mediumPriority
                case TaskPriority.High  : return this.sectionDefinitions.highPriority
                default : return this.sectionDefinitions.noPriority
            }
        },
        (task : TCTask) => {
            if (task.isCompleted) return this.sectionDefinitions.completed
            return this.sectionDefinitions.alphabetical
        },
        (task : TCTask) => {
            if (task.isCompleted) return this.sectionDefinitions.completed
            return this.sectionDefinitions.subtask
        }
    ]

    // In addition to being sorted into sections, the sections are also sorted.
    static readonly secondarySortFunctions : ((a : TaskCell, b : TaskCell) => number)[] = [
        (a : TaskCell, b : TaskCell) => {
            if (a.task.priority < b.task.priority) return -1
            else if(a.task.priority > b.task.priority ) return 1
            return 0
        },
        (a : TaskCell, b : TaskCell) => {
            if (a.task.dueDate < b.task.dueDate) return -1
            else if (a.task.dueDate > b.task.dueDate) return 1
            return 0
        },
        (a : TaskCell, b : TaskCell) => a.task.name.localeCompare(b.task.name),
        (a : TaskCell, b : TaskCell) => {
            /** SUBTASKS **/
            // Sort all completed tasks to be beneath all uncompleted tasks
            if (a.task.isCompleted && !b.task.isCompleted) return 1
            else if (!a.task.isCompleted && b.task.isCompleted) return -1
            
            if (a.task.isCompleted) {
                // If both completed, compare by completion date. Most recent come first.
                if (a.task.completionDate < b.task.completionDate) return 1
                else if (a.task.completionDate > b.task.completionDate) return -1
            }
            else {
                // If both uncompleted, compare by due date. Lowest due date comes first.
                if (a.task.dueDate < b.task.dueDate) return -1
                else if (a.task.dueDate > b.task.dueDate) return 1
            }

            // Lastly, sort alphabetically
            return a.task.name.localeCompare(b.task.name)
        }
    ]

    get numberOfTasks() : number{
        return this.currentSections.reduce((accum, current) =>  accum + current.taskCells.length, 0)
    }

    private createSubtaskPager(task : TCTask) : TaskPager {
        if (task.isProject) {
            return TaskPager.PagerForProject(task, { taskitoService: this.taskitoService, taskService: this.taskService })
        }
        if (task.isChecklist) {
            return TaskPager.PagerForChecklist(task, { taskitoService: this.taskitoService, taskService: this.taskService })
        }
        return null
    }

    private createCell(task: TCTask) : TaskCell {
        return new TaskCellImpl(
            task, 
            this.createSubtaskPager(task), 
            task.isParent ? this.taskService : null, 
            task.isProject ? this.taskitoService : null
        )
    }

    @Input() taskEditorIsOpen : boolean = false

    @HostListener('window:keydown', ['$event'])
    keyboardInput(event: KeyboardEvent) {
        if (!this.keyTracking) return

        if (event.keyCode == 13 && this.selectedTaskInformation) {
            this.taskEditService.editTask(this.selectedTaskInformation.cell.task)
        }
        if (this.selectedTaskInformation && !this.taskEditorIsOpen) {
            if (event.keyCode == 40) this.selectNextTask()
            if (event.keyCode == 38) this.selectPrevTask()
        }
    }

    constructor(
        private readonly listService : TCListService,
        private readonly taskService : TCTaskService,
        private readonly taskitoService : TCTaskitoService,
        private readonly smartListService : TCSmartListService,
        private readonly userSettingsService : TCUserSettingsService,
        private readonly syncService : TCSyncService,
        private readonly taskCompletionService : TaskCompletionService,
        private readonly calendarService : CalendarService,
        private readonly taskEditService : TaskEditService,
        private dragulaService: DragulaService
    ) {
        dragulaService.setOptions('calendar', {
            copy: true,
            accepts: function (el, target) {
                if (target.classList.contains('calendar-day')) {
                    return true
                }
                return false
            }
        })
        dragulaService.drop.subscribe((value) => {
            let [element, target] = value.slice(1)
            if (target && target.classList.contains('calendar-day')) {
                let id = element.dataset.id
                let sectionIndex = element.dataset.sectionIndex
                let date = new Date(target.dataset.date)
                const cell = this.getSectionFilteredBySelectedDates(this.currentSections[sectionIndex]).taskCells.find(t => t.task.identifier === id)
                const task = cell.task
                task.dueDate = date
                this.taskService.update(task).first().subscribe(change => {
                    this.removeTaskFromSection(task, this.currentSections[sectionIndex])
                    this.sortTaskIntoSection(cell)
                })
            }
        })
        dragulaService.over.subscribe((value) => {
            if (value[2]) {
                value[2].classList.add('hover')
            }
        })
        dragulaService.out.subscribe((value) => {
            if (value[2]) {
                value[2].classList.remove('hover')
            }
        })
    }

    ngOnDestroy() {
        this.dragulaService.destroy('calendar')
    }

    ngOnInit() : void {
        this.taskCompletionService.completedTasks.subscribe(result => {
            result.completedTasks.forEach(completedTask => {
                this.onTaskCompleted(completedTask)
            })

            result.repeatedTasks.forEach(repeatedTask => {
                this.onTaskRepeated(repeatedTask)
            })
        }) 

        // Have to do this to make sure that we keep our source list object up to date with the one
        // published by the lists service.
        this.listService.lists.map(pub => pub.lists).subscribe(lists => {
            if (!this.sourceModule) return

            const current = lists.find(list => this.sourceModule.source.identifier == list.identifier)
            if (!current) return
            if (current === this.sourceModule.source) return
            
            this.sourceModule = new ListTaskSource(
                current, 
                this.sourceModule.sortType,
                this.sourceModule.pager,
                this.listService, 
                this.userSettingsService
            )
            
            setupPager()
        })

        // And the same thing for the smart lists.
        this.smartListService.smartLists.map(pub => pub.smartLists).subscribe(smartLists => {
            if (!this.sourceModule) return

            const current = smartLists.find(list => this.sourceModule.source.identifier == list.identifier)
            if (!current) return
            if (current === this.sourceModule.source) return
            
            this.sourceModule = new SmartListTaskSource(
                current, 
                this.sourceModule.sortType,
                this.sourceModule.pager,
                this.smartListService, 
                this.userSettingsService
            )
            
            setupPager()
        })

        const isSameAsCurrentSource = (object : TCObject) : boolean => {
            return this.sourceModule && object.idEqual(this.sourceModule.source)
        }

        let taskSubscription : Subscription = null
        const setupPager = () => {
            if (taskSubscription) taskSubscription.unsubscribe()

            taskSubscription = this.sourceModule.pager.pagedTasksLoaded.subscribe((result : {page: number, tasks : TCTask[]}) => {
                result.tasks.forEach(task => {
                    this.sortTaskSectionFunctions[this.sourceModule.sortType](task).taskCells.push(this.createCell(task))
                })

                for (const section of this.currentSections) {
                    section.taskCells.sort(TasksComponent.secondarySortFunctions[this.sourceModule.sortType])
                }
            })
        }

        this.listService.selectedList
            .filter(list => !isSameAsCurrentSource(list) )
            .subscribe(list => {
                this.userSettingsService.settings.first().subscribe(settings => {
                    const sortType = list.sortType >= 0 ? list.sortType : settings.taskSortOrder
                    const pager = TaskPager.PagerForList(list, { taskService: this.taskService, taskitoService : this.taskitoService })
                    this.sourceModule = new ListTaskSource(
                        list, 
                        sortType, 
                        pager,
                        this.listService, 
                        this.userSettingsService
                    )
                    
                    setupPager()

                    this.resetTaskSections()
                })
            })
        this.listService.selectedList
            .filter(list => isSameAsCurrentSource(list) )
            .subscribe(list => this.reloadTasks())

        
        
        const setSmartListTaskSource = (smartList : TCSmartList) => {
            this.userSettingsService.settings.first().subscribe(settings => {
                const sortType = smartList.sortType >= 0 ? smartList.sortType : settings.taskSortOrder
                const pager = TaskPager.PagerForSmartList(smartList, { taskService: this.taskService, taskitoService : this.taskitoService })
                this.sourceModule = new SmartListTaskSource(
                    smartList, 
                    sortType, 
                    pager,
                    this.smartListService, 
                    this.userSettingsService
                )
                
                setupPager()

                this.resetTaskSections()
            })
        }

        this.smartListService.smartListSelected
            .filter(smartList => !isSameAsCurrentSource(smartList))
            .subscribe(smartList => setSmartListTaskSource(smartList))
        this.smartListService.smartListSelected
            .filter(smartList => isSameAsCurrentSource(smartList))
            .subscribe(smartList => this.reloadTasks())

        this.smartListService.smartListUpdated
            .subscribe(smartList => {
                setSmartListTaskSource(smartList)
                this.taskService.getTaskCounts()
            })

        this.taskEditService.editedTask
            .filter(info => info.state == TaskEditState.Finished)
            .subscribe(info => {
                this.taskService.update(info.task).first()
                    .filter(updated => this.sourceModule.shouldReloadOnTaskEdit)
                    .subscribe(updated => {
                        this.reloadTasks()
                    })
            })

        this.taskEditService.editedTask
            .filter(info => info.state == TaskEditState.Beginning && info.publisher != null)
            .subscribe(info => {
                info.publisher.taskDueDateChange
                    .filter(change => this.sourceModule.sortType == 0)
                    .subscribe(change => {
                        const taskClone = new TCTask(change.task.requestBody())
                        taskClone.dueDate = change.oldDate
                        const section = this.sortTaskSectionFunctions[this.sourceModule.sortType](taskClone)

                        const removedCell = this.removeTaskFromSection(change.task, section) 
                        const cell = removedCell ? removedCell : this.createCell(change.task)
                        cell.task = change.task
                        this.sortTaskIntoSection(cell)
                    })

                info.publisher.taskPriorityChange
                    .filter(change => this.sourceModule.sortType == 1)
                    .subscribe(change => {
                        const taskClone = new TCTask(change.task.requestBody())
                        taskClone.priority = change.oldPriority
                        const section = this.sortTaskSectionFunctions[this.sourceModule.sortType](taskClone)

                        const removedCell = this.removeTaskFromSection(change.task, section) 
                        const cell = removedCell ? removedCell : this.createCell(change.task)
                        cell.task = change.task
                        this.sortTaskIntoSection(cell)
                    })

                info.publisher.taskListChange
                    .subscribe(change => {
                        this.sourceModule.onTaskListChanged(this, change.task, change.newList)
                    })
                info.publisher.taskCompleted
                    .subscribe(completedTask => {
                        if (!this.sourceModule.shouldSortTask(completedTask)) return
                        this.onTaskCompleted(completedTask)
                    })
                info.publisher.taskUncompleted
                    .subscribe(uncompletedTask => {
                        this.onTaskUncompleted(uncompletedTask)
                    })
            })

        this.calendarService.selectedDates.subscribe(dates => this.selectedDates = dates)
        this.syncService.syncCompleted.subscribe(() => {
            this.reloadTasks()
        })
    }

    private reloadTasks() {
        this.sourceModule.pager.reset()
        this.resetTaskSections()
    }

    private resetTaskSections() {
        this.currentSections.forEach((section) => section.taskCells = [] )
        this.currentSections = this.sortTypeSections[this.sourceModule.sortType]

        this.sourceModule.pager.nextPage()
    }

    private taskIsInSelectedDates(task : TCTask) : boolean {
        if (this.selectedDates.length == 0) return true

        const matchDate = task.hasDueDate ? task.dueDate : task.isCompleted ? task.completionDate : null
        if (!matchDate) return false

        return this.selectedDates.find(d => 
            d.getFullYear() == matchDate.getFullYear() &&
            d.getMonth() == matchDate.getMonth() &&
            d.getDate() == matchDate.getDate()
        ) != null
    }

    private getSectionFilteredBySelectedDates(section : TaskSectionDefinition) : TaskSectionDefinition {
        return {
            label : section.label,
            taskCells : section.taskCells.filter(t => this.taskIsInSelectedDates(t.task))
        }
    }

    private findParentCellInSection(subtask: TCTask | TCTaskito, section: TaskSectionDefinition) : TaskCell {
        return section.taskCells.find(cell => cell.task.identifier == subtask.parentId)
    }

    private findParentCell(subtask: TCTask | TCTaskito) : TaskCell {
        return this.currentSections.reduce((accum : TaskCell, section : TaskSectionDefinition) : TaskCell => {
            if (accum) return accum
            return this.findParentCellInSection(subtask, section)
        }, null)
    }

    private removeSubtaskFromParent(parentCell: TaskCell, subtask: TCTask) : TaskCell {
        if (!parentCell.task.isProject) return null

        const index = parentCell.subtasks.findIndex(cell => cell.task.identifier == subtask.identifier)
        if ((index == undefined || index < 0)) return null

        const cell = parentCell.subtasks[index]
        parentCell.subtasks.splice(index, 1)

        return cell
    }

    public removeTaskFromAnySection(task : TCTask) : TaskCell {
        if (task.isSubtask) {
            return this.removeSubtaskFromParent(this.findParentCell(task), task)
        }

        let cell : TaskCell = null
        for (const section of this.currentSections) {
            const removed = this.removeTaskFromSection(task, section)
            if (removed) {
                cell = removed
                break
            }
        }
        return cell
    }

    public removeTaskFromSection(task : TCTask, section : TaskSectionDefinition) : TaskCell {
        if (task.isSubtask) {
            return this.removeSubtaskFromParent(this.findParentCellInSection(task, section), task)
        }

        const index = section.taskCells.findIndex(element => element.task.identifier == task.identifier)
        if ((index == undefined || index < 0)) return null
        
        const cell = section.taskCells[index]
        section.taskCells.splice(index, 1)
        return cell
    }

    public removeSelectedTaskFromSection() : TaskCell {
        return this.removeTaskFromSection(this.selectedTaskInformation.cell.task, this.selectedTaskInformation.section)
    }

    public sortTaskIntoSection(cell : TaskCell) : TaskSectionDefinition {
        const section = this.sortTaskSectionFunctions[this.sourceModule.sortType](cell.task)
        section.taskCells.push(cell)
        section.taskCells.sort(TasksComponent.secondarySortFunctions[this.sourceModule.sortType])
        return section
    }

    public resortSelectedTask() {
        if (!this.sourceModule.shouldSortTask(this.selectedTaskInformation.cell.task)) return
        const section = this.sortTaskIntoSection(this.selectedTaskInformation.cell)
        this.selectedTaskInformation.section = section
    }

    onNewTaskCreated(event : TaskCreatedEvent) {
        const resultMapFunction = createdTask => cell => {
            if (cell.task === event.task) {
                return this.createCell(createdTask)
            }
            return cell
        }

        if (this.selectedTaskInformation && event.task.isSubtask) {
            const selectedCell = this.selectedTaskInformation.cell
            const parentCell = 
                this.selectedTaskInformation.parent                     ? this.selectedTaskInformation.parent : 
                selectedCell.task.isParent && selectedCell.showSubtasks ? selectedCell : 
                null

            if (parentCell) {
                parentCell.addSubtask(event.task)
                event.taskSave.subscribe(createdTask => {
                    parentCell.subtasks = parentCell.subtasks.map(resultMapFunction(createdTask))
                    parentCell.getSubtaskCount()
                })
                return
            }
        }
        
        const newCell = this.createCell(event.task)
        this.sortTaskIntoSection(newCell)
        event.taskSave.subscribe(createdTask => {
            const section = this.sortTaskSectionFunctions[this.sourceModule.sortType](createdTask)
            section.taskCells = section.taskCells.map(resultMapFunction(createdTask))
        })
    }

    onNewTaskitoCreated(event : TaskitoCreatedEvent) {
        if (!this.selectedTaskInformation) {
            console.log('Tried to create a taskito without selecting a checklist')
            return // This should never happen
        }
            
        const parentCell = 
            this.selectedTaskInformation.cell.task.isChecklist ? this.selectedTaskInformation.cell   : 
            this.selectedTaskInformation.parent                ? this.selectedTaskInformation.parent : 
            null

        if (!parentCell) {
            console.log('Tried to create a taskito without selecting a checklist')
            return // This should never happen
        }

        parentCell.addTaskito(event.taskito)
        event.taskitoSave.subscribe(createdTaskito => {
            parentCell.taskitos = parentCell.taskitos.map(taskito => {
                if (taskito === event.taskito) return createdTaskito
                return taskito
            })
            parentCell.getSubtaskCount()
        })
    }

    onTaskitoDeleted(taskito : TCTaskito, parentCell : TaskCell) {
        parentCell.taskitos = parentCell.taskitos.filter(item => item.identifier != taskito.identifier)
        parentCell.getSubtaskCount()
    }

    private resortSubtask(subtask : TCTask) {
        const parentCell = this.findParentCell(subtask)
        this.removeSubtaskFromParent(parentCell, subtask)
        parentCell.addSubtask(subtask)
        parentCell.getSubtaskCount()
    }

    private onTaskCompleted(completedTask : TCTask) {
        if (completedTask.isSubtask) {
            this.resortSubtask(completedTask)
            return
        }

        if (!this.sourceModule.shouldSortTask(completedTask)) return
        const removedCell = this.removeTaskFromAnySection(completedTask)
        const cell = removedCell ? removedCell : this.createCell(completedTask)
        cell.task = completedTask
        this.sortTaskIntoSection(cell)
    }

    private onTaskRepeated(repeatedTask : TCTask) {
        if (repeatedTask.isSubtask) {
            this.resortSubtask(repeatedTask)
            return
        }

        const removedCell = this.removeTaskFromAnySection(repeatedTask)
        const cell = removedCell ? removedCell : this.createCell(repeatedTask)
        cell.task = repeatedTask
        this.sortTaskIntoSection(cell)
    }

    private onTaskUncompleted(uncompletedTask : TCTask) {
        if (uncompletedTask.isSubtask) {
            this.resortSubtask(uncompletedTask)
            return
        }

        if (!this.sourceModule.shouldSortTask(uncompletedTask)) return
        const removedCell = this.removeTaskFromSection(uncompletedTask, this.sectionDefinitions.completed) 
        const cell = removedCell ? removedCell : this.createCell(uncompletedTask)
        cell.task = uncompletedTask
        this.sortTaskIntoSection(cell)
    }

    private onTaskDeleted(task : TCTask, parentCell? : TaskCell){
        if (task.isSubtask) {
            this.removeSubtaskFromParent(parentCell, task)
            parentCell.getSubtaskCount()
        }
        else {
            this.removeTaskFromAnySection(task)
        }

        this.taskService.getTaskCounts()
    }

    public selectTask(info : SelectedTaskInformation) {
        if (info.cell.task.identifier == null) return
        if(this.selectedTaskInformation && this.selectedTaskInformation.cell.task.identifier === info.cell.task.identifier) {
            if(info.cell.showSubtasks){
                this.selectedTaskInformation = null
                info.cell.showSubtasks = false
                return
            }
        }

        this.selectedTaskInformation = info

        if (info.cell.task.isParent) {
            info.cell.showSubtasks = true
            info.cell.loadSubtasks()
            return
        }
    }

    public selectNextTask() {
        if (this.selectedTaskInformation && this.selectedTaskInformation.cell.task.isSubtask) {
            const parentCell = this.selectedTaskInformation.parent
            const index = parentCell.subtasks.findIndex(cell => {
                return cell.task.identifier == this.selectedTaskInformation.cell.task.identifier
            })

            if (index < 0 || index == parentCell.subtasks.length - 1) return
            
            this.selectedTaskInformation.cell = parentCell.subtasks[index + 1]
            return
        }

        const currentSection = this.selectedTaskInformation.section
        const index = this.selectionIndexInSection()

        if (index >= currentSection.taskCells.length - 1) {
            this.selectTaskInNextSection()
            return
        }

        this.selectedTaskInformation.cell = this.selectedTaskInformation.section.taskCells[index + 1]
    }

    private selectTaskInNextSection(index : number = -1){
        //if it first iteration - we need to get index of current section
        if (index === -1) {
            //get index of next section
            index = 1 + this.currentSections.findIndex(section => section.label === this.selectedTaskInformation.section.label)
        }
        if(index < -1 || index > this.currentSections.length - 1) return

        if (this.currentSections[index].taskCells.length === 0) {
            this.selectTaskInNextSection(++index)
            return
        }
        this.selectedTaskInformation = {
            cell: this.currentSections[index].taskCells[0],
            section: this.currentSections[index]
        }
    }

    public selectPrevTask() {
        if (this.selectedTaskInformation && this.selectedTaskInformation.cell.task.isSubtask) {
            const parentCell = this.selectedTaskInformation.parent
            const index = parentCell.subtasks.findIndex(cell => {
                return cell.task.identifier == this.selectedTaskInformation.cell.task.identifier
            })

            if (index == 0 || index > parentCell.subtasks.length - 1) return
            
            this.selectedTaskInformation.cell = parentCell.subtasks[index - 1]
            return
        }

        const index = this.selectionIndexInSection()

        if (index === 0) {
            this.selectTaskInPrevSection()
            return
        }
        this.selectedTaskInformation.cell = this.selectedTaskInformation.section.taskCells[index - 1]
    }

    private selectTaskInPrevSection(index : number = -1){
        //if it first iteration - we need to get index of current section
        if (index === -1) {
            index = this.currentSections.findIndex(section => section.label === this.selectedTaskInformation.section.label)
        }

        //return if in first section
        if(index <= 0) return

        //index of previous section
        index--

        if (this.currentSections[index].taskCells.length === 0) {
            this.selectTaskInPrevSection(index)
            return
        }
        this.selectedTaskInformation = {
            cell: this.currentSections[index].taskCells[this.currentSections[index].taskCells.length - 1],
            section: this.currentSections[index]
        }
    }

    private selectionIndexInSection() : number {
        const currentSection = this.selectedTaskInformation.section
        return currentSection.taskCells.findIndex(cell => {
            return cell.task.identifier == this.selectedTaskInformation.cell.task.identifier
        })
    }

    public didSelectShowEditor(info : SelectedTaskInformation) {
        if (info.cell.task.identifier == null) return
        this.selectedTaskInformation = info
    }

    public scrollReachedEnd() {
        if (!this.sourceModule) return
        this.sourceModule.pager.nextPage()
    }

    public loadCompletedTasks(){
        console.log('loadCompletedTasks() not implemented yet')
    }
}

