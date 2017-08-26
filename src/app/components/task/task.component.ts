import { Component, Input, Output, EventEmitter, ViewChild, OnInit, OnDestroy }  from '@angular/core'
import { ContextMenuService, ContextMenuComponent } from 'angular2-contextmenu'
import { TCTaskService } from '../../services/tc-task.service'
import { TaskCompletionService, TaskCompletionState } from '../../services/task-completion.service'
import { TaskDeleteConfirmationComponent }    from '../../components/task/task-delete-confirmation/task-delete-confirmation.component'
import { TaskEditService } from '../../services/task-edit.service'
import { TCTask } from '../../classes/tc-task'
import { TaskType } from '../../tc-utils'
import { NgbModal }  from '@ng-bootstrap/ng-bootstrap'

import { Subscription } from 'rxjs'

@Component({
    selector: 'task-item',
    templateUrl: 'task.component.html',
    styleUrls: ['task.component.css']
})
export class TaskComponent implements OnInit, OnDestroy {
    @Input() task: TCTask

    @Output() taskSelected: EventEmitter<boolean> = new EventEmitter<boolean>()
    @Output() showEditorSelected: EventEmitter<TCTask> = new EventEmitter<TCTask>()
    @Output() taskCompleted : EventEmitter<TCTask> = new EventEmitter<TCTask>()
    @Output() taskUncompleted : EventEmitter<TCTask> = new EventEmitter<TCTask>()
    @Output() taskDeleted : EventEmitter<TCTask> = new EventEmitter<TCTask>()

    @ViewChild('circleBar') circleBar
    @ViewChild('taskMoreOptionsMenu') public taskMoreOptionsMenu: ContextMenuComponent
    @ViewChild('taskEl') taskEl

    TaskCompletionState = TaskCompletionState
    private _currentCompletionState : TaskCompletionState = TaskCompletionState.None
    get currentCompletionState() : TaskCompletionState {
        if (this.task.identifier == null) return TaskCompletionState.Creating
        return this.task.isCompleted ? TaskCompletionState.Complete : this._currentCompletionState
    }
    set currentCompletionState(state : TaskCompletionState) {
        this._currentCompletionState = state
    }

    @Input() subtaskCount : number = 0

    private countdownIntervalId : any
    private animationTimeoutId : any
    private globalTimeSubscription : Subscription

    private globalTimer : number = 0
    private innerCountdownTimer : number = 0 // 0s
    private currentCountdownProgress : number = 0 // 0%
    private readonly countdownTime  : number = 4 // 4s
    private readonly intervalStep : number = 100 // 100ms

    readonly circleRadius : number = 8
    readonly circleLine : number = 2 * Math.PI * this.circleRadius

    constructor(
        private taskService : TCTaskService,
        private taskCompletionService : TaskCompletionService,
        private readonly taskEditService : TaskEditService,
        private contextMenuService :  ContextMenuService,
        private modalService     : NgbModal
    )
    {}

    ngOnInit() {
        this.globalTimeSubscription = this.taskCompletionService.globalTime.subscribe(globalTime => {
            this.globalTimer = globalTime
            if (this.currentCountdownProgress > 0 &&
                this.currentCountdownProgress <= 100 &&
                this.globalTimer >= this.currentCountdownProgress && 
                !this.countdownIntervalId) {
                this.gracePeriodTimer()
            } 
        })
    }

    ngOnDestroy() {
        this.globalTimeSubscription.unsubscribe()
    }

    onContextMenu(event : any) {
        this.contextMenuService.show.next({
            contextMenu: this.taskMoreOptionsMenu,
            event: event,
            item: this.task,
        });
        event.preventDefault()
        event.stopPropagation()
    }

    changeToProject() {
        this.task.taskType = TaskType.Project
        this.updateTask()
    }

    changeToChecklist() {
        this.task.taskType = TaskType.Checklist
        this.updateTask()
    }

    changeToRegularTask() {
        this.task.taskType = TaskType.Normal
        this.updateTask()
    }

    private updateTask() {
        this.taskService.update(this.task).subscribe(task => {
            // this.task = task
        })
    }

    selectTask() {
        this.taskSelected.emit(true)
        if (this.taskEl) {
            this.taskEl.nativeElement.focus()
        }
    }

    editTaskSelected() {
        this.showEditorSelected.emit(this.task)
        this.taskEditService.editTask(this.task)
    }

    completeTask() {
        if(!this.task.isCompleted) {   
            if (this.currentCompletionState == TaskCompletionState.Saving) return

            this.currentCompletionState = this.currentCompletionState >= TaskCompletionState.Error ? 
                TaskCompletionState.Initial : TaskCompletionState.None

            if (this.currentCompletionState != TaskCompletionState.None) {
                // Set initial animation running
                this.currentCompletionState = TaskCompletionState.Initial

                // Start grace period animation after initial animation time interval
                this.taskCompletionService.beginCompletingTask({
                    task : this.task,
                    getCompletionProgression : () => this.currentCountdownProgress
                })
                this.animationTimeoutId = setTimeout(() => {
                    /*Start grace countdown*/
                    this.circleBar.nativeElement.style.strokeDasharray = this.circleLine
                    this.gracePeriodTimer()
                    this.currentCompletionState = TaskCompletionState.GracePeriod
                }, 400)
            } else {
                clearTimeout(this.animationTimeoutId)
                this.currentCompletionState = TaskCompletionState.None
                this.taskCompletionService.removeCompletingTask(this.task)
                this.resetCompleteTask()
            }
        } else {
            this.currentCompletionState = TaskCompletionState.Saving
            this.taskService.uncompleteTask(this.task).first().subscribe(uncompletedTasks => {
                if (!uncompletedTasks.completedTaskIDs.reduce((accum, curr) => accum || this.task.identifier == curr, false)) return

                this.task.completionDate = null
                this.currentCompletionState = TaskCompletionState.None
                this.taskUncompleted.emit(this.task)
            },
            error => {
                this.currentCompletionState = TaskCompletionState.Error
            })
        }
    }

    completeTaskSave() {
        this.currentCompletionState = TaskCompletionState.Saving

        this.taskCompletionService.completedTasks.first().subscribe(result => {
             this.currentCompletionState = TaskCompletionState.Complete
             this.taskCompleted.emit(this.task)
        },
        (error: Error) => {
            this.currentCompletionState = TaskCompletionState.Error
        })
        this.taskCompletionService.finishCompletingTask(this.task)
    }

    private gracePeriodTimer(){
        this.countdownIntervalId = setInterval(() => {
            /* Stop Interval in case if */
            if (!(this.taskCompletionService.runTimer || this.globalTimer > this.currentCountdownProgress)) {
                clearInterval(this.countdownIntervalId)
                this.countdownIntervalId = null
                return
            }

            // Millseconds to seconds
            this.innerCountdownTimer += this.intervalStep / 1000
            // Inner countdown timer as a percent of the total countdown time
            this.currentCountdownProgress = Math.floor(100 * (this.innerCountdownTimer / this.countdownTime))
            this.taskCompletionService.updateGlobalTimer(this.currentCountdownProgress)

            // Change percent back to decimal 0.## representation
            let progress = this.currentCountdownProgress / 100
            let dashoffset = this.circleLine * (1 - progress)
            this.circleBar.nativeElement.style.strokeDashoffset = dashoffset

            if (this.innerCountdownTimer >= this.countdownTime) {
                this.completeTaskSave()
                this.resetCompleteTask()
            }
        }, this.intervalStep)
    }

    private resetCompleteTask() {
        clearInterval(this.countdownIntervalId)
        this.countdownIntervalId = null

        this.innerCountdownTimer = 0
        this.currentCountdownProgress = 0

        this.circleBar.nativeElement.style.removeProperty('stroke-dashoffset')
        this.circleBar.nativeElement.style.removeProperty('stroke-dasharray')
    }

    private showDeleteTaskConfirmationModal() {
        const modalRef = this.modalService.open(TaskDeleteConfirmationComponent)
        const deleteComponent : TaskDeleteConfirmationComponent = modalRef.componentInstance

        deleteComponent.task = this.task
        deleteComponent.deletePressed.subscribe(task => {
            this.deleteTask()
        })

        return false
    }

    private deleteTask() {
        this.taskService.delete(this.task).subscribe(task => {
            this.taskDeleted.emit(this.task)
        })
    }
}
