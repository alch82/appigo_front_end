import { Injectable } from '@angular/core'
import { TCTaskService } from './tc-task.service'
import { TCTask } from '../classes/tc-task'
import { TCList } from '../classes/tc-list'
import { Observable, Subject, ReplaySubject } from 'rxjs'
import { TaskEditState, TaskPriority } from '../tc-utils'

export type TaskEditEvent = {task : TCTask, state : TaskEditState, publisher : EditedTaskUpdatePublisher}

@Injectable()
export class TaskEditService {
    private readonly _editedTask : Subject<TaskEditEvent>
    public get editedTask() : Observable<TaskEditEvent> {
        return this._editedTask
    }

    constructor(
        private readonly taskService : TCTaskService
    ) {
        this._editedTask = new Subject<TaskEditEvent>()
    }

    editTask(task : TCTask) {
        this._editedTask.next({task : task, state : TaskEditState.Beginning, publisher : new EditedTaskUpdatePublisher()})
    }

    finishEditTask(task : TCTask) {
        this._editedTask.next({task : task, state : TaskEditState.Finished, publisher : null})
    }    
}

export type DueDateUpdate = {task : TCTask, oldDate : Date, newDate : Date}
export type PriorityUpdate = {task : TCTask, oldPriority : TaskPriority, newPriority : TaskPriority}
export type TaskListChangeUpdate = {task : TCTask, newList : TCList}

export class EditedTaskUpdatePublisher {
    private readonly _taskDueDateChange : Subject<DueDateUpdate>
    public get taskDueDateChange() : Observable<DueDateUpdate> {
        return this._taskDueDateChange
    }

    private readonly _taskPriorityChange : Subject<PriorityUpdate>
    public get taskPriorityChange() : Observable<PriorityUpdate> {
        return this._taskPriorityChange
    }

    private readonly _taskListChange : Subject<TaskListChangeUpdate>
    public get taskListChange() : Observable<TaskListChangeUpdate> {
        return this._taskListChange
    }

    private readonly _taskCompleted : Subject<TCTask>
    public get taskCompleted() : Observable<TCTask> {
        return this._taskCompleted
    }

    private readonly _taskUncompleted : Subject<TCTask>
    public get taskUncompleted() : Observable<TCTask> {
        return this._taskUncompleted
    }

    constructor() {
        this._taskDueDateChange = new Subject<DueDateUpdate>()
        this._taskPriorityChange = new Subject<PriorityUpdate>()
        this._taskListChange = new Subject<TaskListChangeUpdate>()
        this._taskCompleted = new Subject<TCTask>()
        this._taskUncompleted = new Subject<TCTask>()
    }

    dueDateUpdated(update : DueDateUpdate) {
        this._taskDueDateChange.next(update)
    }

    priorityUpdated(update : PriorityUpdate) {
        this._taskPriorityChange.next(update)
    }

    changedList(update : TaskListChangeUpdate) {
        this._taskListChange.next(update)
    }

    completedTask(task : TCTask) {
        if (task && task.isCompleted) {
            this._taskCompleted.next(task)
        }
    }

    uncompletedTask(task : TCTask) {
        if(task && !task.isCompleted) {
            this._taskUncompleted.next(task)
        }
    }
}