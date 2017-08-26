import { TCTask } from '../../classes/tc-task'
import { TCTaskito } from '../../classes/tc-taskito'
import { TaskPager } from './task-pager'
import { TasksComponent } from './tasks.component'
import { TCTaskService } from '../../services/tc-task.service'
import { TCTaskitoService } from '../../services/tc-taskito.service'

export interface TaskCell {
    task : TCTask,
    subtasks : TaskCell[],
    taskitos : TCTaskito[],
    showSubtasks : boolean,
    subtaskCount : number,
    loadSubtasks() : void,
    reloadSubtasks() : void,
    sortSubtasks() : void,
    addSubtask(task : TCTask) : void,
    addTaskito(tasito : TCTaskito) : void,
    getSubtaskCount() : void
}

export class TaskCellImpl implements TaskCell {
    subtasks : TaskCell[] = []
    taskitos : TCTaskito[] = []
    private _subtaskCount : number = 0
    get subtaskCount() : number {
        return this._subtaskCount
    }

    private _showSubtasks = false
    // Defensive programming: avoid allowing non-projects to set or return true.
    get showSubtasks() : boolean {
        return (this.task.isProject || this.task.isChecklist) && this._showSubtasks
    }
    set showSubtasks(val : boolean) {
        this._showSubtasks = val && (this.task.isProject || this.task.isChecklist)
    }

    private createSubtaskChecklistCell(task : TCTask) : TaskCell {
        if (!task.isChecklist) return null
        const pager = TaskPager.PagerForChecklist(task, {taskitoService : this.taskitoService, taskService: this.taskService})

        return new TaskCellImpl(task, pager, this.taskService)
    }

    constructor(
        public task : TCTask,
        private pager : TaskPager = null,
        private taskService : TCTaskService = null,
        private taskitoService : TCTaskitoService = null
    ) {
        if (this.task.isProject || this.task.isChecklist) this.getSubtaskCount()
        if (!pager) return

        this.pager.pagedTasksLoaded.subscribe(result => {
            // Add results to subtasks
            this.subtasks = this.subtasks.concat(result.tasks.map(t => {
                if (t.isChecklist) {
                    return this.createSubtaskChecklistCell(t)
                }
                return new TaskCellImpl(t)
            }))

            this.sortSubtasks()

            // Go until all the subtasks are retrieved.
            // If there is no next page, this will be a no-op.
            this.pager.nextPage()
        })

        this.pager.pagedTaskitosLoaded.subscribe(result => {
            this.taskitos = this.taskitos.concat(result.taskitos)
            this.pager.nextPage()
        })
    }

    loadSubtasks() {
        if (!this.task.isParent) return
        this.pager.nextPage()
    }

    reloadSubtasks() {
        if (!this.task.isProject) return

        this.subtasks = []
        this.pager.reset()
        this.loadSubtasks()
    }

    sortSubtasks() {
        const sortFunc = TasksComponent.secondarySortFunctions[3]
        this.subtasks.sort(sortFunc)
    }

    addSubtask(task : TCTask) {
        const newCell : TaskCell = ((task : TCTask) : TaskCell => {
            if (task.isChecklist) {
                return this.createSubtaskChecklistCell(task)
            }
            return new TaskCellImpl(task)
        })(task)

        this.subtasks.push(newCell)
        this.sortSubtasks()
    }

    addTaskito(taskito : TCTaskito) {
        this.taskitos.push(taskito)
    }

    getSubtaskCount() {
        if ((!this.task.isProject && !this.task.isChecklist) || !this.taskService) return

        this.taskService.getSubtaskCount(this.task).first().subscribe(result => {
            this._subtaskCount = result.count
        })
    }
}