import { TaskCreationInformation } from './task-create.component'
import { TasksComponent } from './tasks.component'

import { TCObject } from '../../classes/tc-object'
import { TCList } from '../../classes/tc-list'
import { TCSmartList } from '../../classes/tc-smart-list'
import { TCTask } from '../../classes/tc-task'
import { TCTaskito } from '../../classes/tc-taskito'
import { TCUserSettings } from '../../classes/tc-user-settings'
import { TaskPriority, TaskType, DefaultDueDate, TaskEditState } from '../../tc-utils'

import { TCTaskService } from '../../services/tc-task.service'
import { TCListService } from '../../services/tc-list.service'
import { TCSmartListService } from '../../services/tc-smart-list.service'
import { TCUserSettingsService } from '../../services/tc-user-settings.service'

import { TaskPager } from './task-pager'
import { Subscription } from 'rxjs'

export abstract class TaskSource {
    public abstract get taskCreationInformation() : TaskCreationInformation
    public abstract get isParentTask() : boolean
    public get isChecklist() : boolean {
        return false
    }

    public get shouldReloadOnTaskEdit() : boolean {
        return false
    }

    public readonly pager : TaskPager

    protected settings : TCUserSettings

    constructor(
        public readonly source : TCObject,
        public readonly sortType : number,
        private userSettingsService : TCUserSettingsService
    ) {
        this.userSettingsService.settings.subscribe(settings => {
            this.settings = settings
        })
    }

    abstract onTaskListChanged(component : TasksComponent, task : TCTask, list : TCList) 
    abstract shouldSortTask(task : TCTask) : boolean
    abstract selectTaskSource() : void
}

export class ListTaskSource extends TaskSource {
    get taskCreationInformation() : TaskCreationInformation {
        const sourceDueDate = this.source.identifier == this.settings.userInbox ? this.settings.defaultDueDate : this.source.defaultDueDate
        return {
            listId : this.source.identifier,
            parentIsChecklist : false,
            defaultDueDate : this.source.defaultDueDate >= 0 ? sourceDueDate : this.settings.defaultDueDate
        }
    }

    get isParentTask() : boolean {
        return false
    }

    constructor(
        public readonly source : TCList,
        sortType : number,
        public readonly pager : TaskPager,
        private readonly listService : TCListService,
        private readonly userSettings : TCUserSettingsService
    ) {
        super(source, sortType, userSettings)
    }

    onTaskListChanged(component : TasksComponent, task : TCTask, list : TCList) {
        component.removeSelectedTaskFromSection()
        if (this.source.identifier == list.identifier) {
            component.resortSelectedTask()
        }
    }

    shouldSortTask(task : TCTask) : boolean {
        return task.listId == this.source.identifier
    }

    selectTaskSource() : void {
        this.listService.selectList(this.source)
    }
}

export class SmartListTaskSource extends TaskSource {
    get taskCreationInformation() : TaskCreationInformation {
        return {
            listId : this.source.defaultList,
            parentIsChecklist : false,
            defaultDueDate : this.source.defaultDueDate >= 0 ? this.source.defaultDueDate : this.settings.defaultDueDate
        }
    }

    get isParentTask() : boolean {
        return false
    }

    get shouldReloadOnTaskEdit() : boolean {
        return true
    }

    constructor(
        public readonly source : TCSmartList, 
        sortType : number,
        public readonly pager : TaskPager,
        private readonly smartListService : TCSmartListService,
        private readonly userSettings : TCUserSettingsService
    ) {
        super(source, sortType, userSettings)
    }

    onTaskListChanged(component : TasksComponent, task : TCTask, list : TCList) {
        // Do nothing, on task changed, the smart list is reloaded. This is
        // the only way to get the modified task into the proper place in a smart
        // list without implementing all the smart list logic client side.
    }

    shouldSortTask(task : TCTask) : boolean {
        return false
    }

    selectTaskSource() : void {
        this.smartListService.selectSmartList(this.source)
    }
}

export class TaskParentTaskSource extends TaskSource {
    get taskCreationInformation() : TaskCreationInformation {
        return {
            listId : this.source.listId,
            parentIsChecklist : this.isChecklist,
            defaultDueDate : DefaultDueDate.None,
            parentTask : this.source
        }
    }

    get isParentTask() : boolean {
        return true
    }

    constructor(
        public readonly source : TCTask,
        public readonly pager : TaskPager,
        private readonly taskService : TCTaskService,
        private readonly userSettings : TCUserSettingsService
    ) {
        super(source, 3, userSettings)
    }

    onTaskListChanged(component : TasksComponent, task : TCTask, list : TCList) {
        // do nothing, subtasks can't change task list
    }

    shouldSortTask(task : TCTask) : boolean {
        return task.parentId == this.source.identifier
    }

    selectTaskSource() : void {
        this.taskService.selectTask(this.source)
    }
}

export class ChecklistParentTaskSource extends TaskParentTaskSource {
    public get isChecklist() : boolean {
        return true
    }
}