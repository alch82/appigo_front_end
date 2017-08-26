import { Component, Input, Output, EventEmitter } from '@angular/core'
import { TCTaskito } from '../../classes/tc-taskito'
import { TCTask } from '../../classes/tc-task'
import { TCList } from '../../classes/tc-list'

import { TCTaskService } from '../../services/tc-task.service'
import { TCTaskitoService } from '../../services/tc-taskito.service'

import { TaskType, DefaultDueDate } from '../../tc-utils'
import { TaskCreatedEvent, TaskitoCreatedEvent } from '../../tc-types'

import { Observable } from 'rxjs'

export interface TaskCreationInformation {
    listId : string,
    parentIsChecklist : boolean,
    defaultDueDate : DefaultDueDate,
    parentTask? : TCTask
}

type TaskCreationFunction = (name: string) => void
interface TaskCreationModule {
    label : string
    creationFunction : TaskCreationFunction
    shouldShow : () => boolean
}
interface TaskCreationModuleCollecion {
    task : TaskCreationModule
    project : TaskCreationModule
    checklist : TaskCreationModule
    subtask : TaskCreationModule
    item : TaskCreationModule
}

const defaultDueDateToDate = (dueDate : DefaultDueDate) : Date => {
    const result = new Date()

    if (dueDate > 1) {
        result.setDate(result.getDate() + (dueDate - 1))
    }

    return dueDate > 0 ? result : null
}

const taskCreationInfoEqual = (a : TaskCreationInformation, b : TaskCreationInformation) : boolean => {
    // return false if either is null/undefined. Comparison is meaningless, so default to not equal
    if (!a || !b) return false

    const sameList : boolean = a.listId == b.listId
    const bothHaveParents : boolean = a.parentTask != null && b.parentTask != null
    const neitherHaveParents : boolean = a.parentTask == null && b.parentTask == null
    const parentsAreEqual : boolean = neitherHaveParents || (bothHaveParents && a.parentTask.idEqual(b.parentTask))

    return sameList && parentsAreEqual
}

@Component({
    selector: 'task-create',
    templateUrl: 'task-create.component.html',
    styleUrls: ['task-create.component.css']
})
export class TaskCreateComponent {
    private _creationInfo : TaskCreationInformation
    @Input() set creationInfo (info : TaskCreationInformation) {
        const oldCreationInfo = this._creationInfo
        this._creationInfo = info

        if (!taskCreationInfoEqual(oldCreationInfo, info)) 
        {
            if (this.shouldCreateTaskito) {
                this.taskCreationModule = this.creationModuleCollection.item
            }
            else if(this.shouldCreateSubtask) {
                this.taskCreationModule = this.creationModuleCollection.subtask
            }
            else {
                this.taskCreationModule = this.creationModuleCollection.task
            }
        }
    }
    @Output() taskCreated : EventEmitter<TaskCreatedEvent> = new EventEmitter<TaskCreatedEvent>()
    @Output() taskNameSelected : EventEmitter<boolean> = new EventEmitter<boolean>()
    @Output() taskitoCreated : EventEmitter<TaskitoCreatedEvent> = new EventEmitter<TaskitoCreatedEvent>()
    taskNameInput : string = ""

    TaskType = TaskType

    get shouldCreateTask() : boolean {
        return !this.shouldCreateSubtask && !this.shouldCreateTaskito
    }

    get shouldCreateTaskito() : boolean {
        return this._creationInfo && this._creationInfo.parentTask && this._creationInfo.parentIsChecklist
    }

    get shouldCreateSubtask() : boolean {
        return this._creationInfo && this._creationInfo.parentTask && !this._creationInfo.parentIsChecklist
    }

    get shouldShowCreateChecklistButton() : boolean {
        return (
            this.shouldShowCreateProjectButton || 
            (this._creationInfo && this._creationInfo.parentTask != null)
        ) && 
        !this.shouldCreateTaskito
    }

    get shouldShowCreateProjectButton() : boolean {
        return this._creationInfo && this._creationInfo.parentTask == null
    }

    readonly creationModules : TaskCreationModule[] = [
        {
            label : "Task",
            creationFunction : (name : string) => {
                this.createNewTask(name)
            },
            shouldShow : () => {
                return this.shouldCreateTask
            }
        },
        {
            label : "Subtask",
            creationFunction : (name : string) => {
                this.createNewTask(name)
            },
            shouldShow : () => {
                return this.shouldCreateSubtask
            }
        },
        {
            label : "Item",
            creationFunction : (name : string) => {
                this.createNewTaskito(name)
            },
            shouldShow : () => {
                return this.shouldCreateTaskito
            }
        },
        {
            label : "Project",
            creationFunction : (name : string) => {
                this.createNewTask(name, TaskType.Project)
            },
            shouldShow : () => {
                return this.shouldShowCreateProjectButton
            }
        },
        {
            label : "Checklist",
            creationFunction : (name : string) => {
                this.createNewTask(name, TaskType.Checklist)
            },
            shouldShow : () => {
                return this.shouldShowCreateChecklistButton
            }
        }
    ]

    readonly creationModuleCollection : TaskCreationModuleCollecion = {
        task : this.creationModules[0],
        subtask : this.creationModules[1],
        item : this.creationModules[2],
        project : this.creationModules[3],
        checklist : this.creationModules[4],
    }

    _taskCreationModule : TaskCreationModule
    set taskCreationModule(tcm : TaskCreationModule) {
        this._taskCreationModule = tcm
    }

    constructor(
        private readonly taskService : TCTaskService,
        private readonly taskitoService : TCTaskitoService,
    ) {}

    createNewTask(taskName : string, type : TaskType = TaskType.Normal) {
        if (!(taskName.trim().length > 0) || this._creationInfo == null) return
        
        const newTask = new TCTask()
        newTask.listId = this._creationInfo.listId
        newTask.name = taskName.trim()
        newTask.taskType = type

        if (this._creationInfo.parentTask) {
            newTask.parentId = this._creationInfo.parentTask.identifier
            newTask.dueDate = this._creationInfo.parentTask.dueDate
        }
        else if(this._creationInfo.defaultDueDate > 0) {
            newTask.dueDate = defaultDueDateToDate(this._creationInfo.defaultDueDate)
        }
        
        this.taskCreated.emit({
            task : newTask,
            taskSave : this.taskService.create(newTask).first()
        })

        this.taskNameInput = ""
    }

    createNewTaskito(taskitoName : string) {
        if (!(taskitoName.trim().length > 0) || this._creationInfo == null || this._creationInfo.parentTask == null) return

        const newTaskito = new TCTaskito()
        newTaskito.parentId = this._creationInfo.parentTask.identifier
        newTaskito.name = taskitoName.trim()
        newTaskito.sortOrder = 0

        this.taskitoCreated.emit({
            taskito : newTaskito,
            taskitoSave : this.taskitoService.create(newTaskito).first()
        })

        this.taskNameInput = ""
    }
}