import { Injectable } from '@angular/core'

import { TCTaskService } from '../../services/tc-task.service'
import { TCTaskitoService } from '../../services/tc-taskito.service'
import { TCList } from '../../classes/tc-list'
import { TCTask } from '../../classes/tc-task'
import { TCTaskito } from '../../classes/tc-taskito'
import { TCSmartList } from '../../classes/tc-smart-list'
import { TCObject } from '../../classes/tc-object'
import { TaskType } from '../../tc-utils'

import { Observable, Subject, Subscription } from 'rxjs'

abstract class TaskPageTrackingModule { 
    public readonly pagedTasksLoaded  : Observable<{ tasks : TCTask[], page : number }>
    protected _pagedTasksLoaded : Subject<{ tasks : TCTask[], page : number }> = new Subject<{ tasks : TCTask[], page : number }>()

    public readonly pagedTaskitosLoaded  : Observable<{ taskitos : TCTaskito[], page : number }>
    protected _pagedTaskitosLoaded : Subject<{ taskitos : TCTaskito[], page : number }> = new Subject<{ taskitos : TCTaskito[], page : number }>()

    protected _currentPage : number = 0
    protected _loadCompletedTasks : boolean = false

    public readonly pageSize = 20
    protected currentPageSize : number
    public get loadCompletedTasks() : boolean {
        return this._loadCompletedTasks
    }
    public get currentPage() : number { 
        return this._currentPage
    }

    constructor() {
        this.pagedTasksLoaded = this._pagedTasksLoaded
        this.pagedTaskitosLoaded = this._pagedTaskitosLoaded
        this.currentPageSize = this.pageSize
    }

    abstract getTasks() : void
    abstract getCompletedTasks() : void
    abstract createResetCopy() : TaskPageTrackingModule
    abstract get loadsTaskitos() : boolean

    protected procedeToLoadCompletedTasks(firstPageSize : number) {
        this._loadCompletedTasks = true
        this._currentPage = 0
        this.currentPageSize = firstPageSize
        this.nextPage()
    }

    protected setupTaskHandling(observable : Observable<TCTask[]>) {
        observable.first()
            .filter(tasks => tasks.length < this.pageSize)
            .subscribe(tasks => {
                this.procedeToLoadCompletedTasks(this.pageSize - tasks.length)
            })

        observable.first()
            .filter(tasks => tasks.length > 0)
            .subscribe(tasks => this.gotTasks(tasks))
    }

    protected setupCompletedTaskHandling(observable : Observable<TCTask[]>) {
        observable.first().subscribe(tasks => this.gotTasks(tasks))
    }

    protected gotTasks(tasks : TCTask[]) {
        this._pagedTasksLoaded.next({ tasks : tasks, page : this.currentPage })
    }

    public nextPage() {
        this.loadCompletedTasks ? this.getCompletedTasks() : this.getTasks()
        this._currentPage++
        this.currentPageSize = this.pageSize
    }
}

class ListTaskPageTrackingModule extends TaskPageTrackingModule{
    public readonly currentList : TCList
    get loadsTaskitos() : boolean { return false }

    constructor(
        private taskService : TCTaskService,
        list : TCList
    ) {
        super()
        this.currentList = list
    }

    getTasks() {
        this.setupTaskHandling(this.taskService.tasksForList(this.currentList, this.currentPage, this.currentPageSize))
    }

    getCompletedTasks() {
        this.setupCompletedTaskHandling(this.taskService.completedTasksForList(this.currentList, this.currentPage, this.currentPageSize))
    }

    createResetCopy() : ListTaskPageTrackingModule {
        return new ListTaskPageTrackingModule(this.taskService, this.currentList)
    }
}

class SmartListPageTrackingModule extends TaskPageTrackingModule {
    public readonly currentSmartList : TCSmartList
    get loadsTaskitos() : boolean { return false }

    constructor(
        private taskService : TCTaskService,
        smartList : TCSmartList
    ) {
        super()
        this.currentSmartList = smartList
    }

    getTasks() {
        this.setupTaskHandling(this.taskService.tasksForSmartList(this.currentSmartList, this.currentPage, this.currentPageSize))
    }

    getCompletedTasks() {
        this.setupCompletedTaskHandling(this.taskService.completedTasksForSmartList(this.currentSmartList, this.currentPage, this.currentPageSize))
    }

    createResetCopy() : SmartListPageTrackingModule {
        return new SmartListPageTrackingModule(this.taskService, this.currentSmartList)
    }
}

abstract class ParentTaskPageTrackingModule extends TaskPageTrackingModule {
    public readonly parentTask : TCTask
    get loadsTaskitos() : boolean { return false }

    constructor(
        parentTask : TCTask
    ) {
        super()
        this.parentTask = parentTask
    }
}

class ProjectTaskPageTrackingModule extends ParentTaskPageTrackingModule {
    constructor (
        private taskService : TCTaskService, 
        parentTask : TCTask
    ) {
        super(parentTask)
    }

    getTasks() {
        this.setupTaskHandling(this.taskService.subtasksForProject(this.parentTask, this.currentPage, this.currentPageSize))
    }

    getCompletedTasks() {
        this.setupCompletedTaskHandling(this.taskService.completedSubtasksForProject(this.parentTask, this.currentPage, this.currentPageSize))
    }

    createResetCopy() : ProjectTaskPageTrackingModule {
        return new ProjectTaskPageTrackingModule(this.taskService, this.parentTask)
    }
}

class ChecklistTaskPageTrackingModule extends ParentTaskPageTrackingModule {
    get loadsTaskitos() : boolean { return true }

    constructor (
        private taskitoService : TCTaskitoService,
        parentTask : TCTask
    ) {
        super(parentTask)
    }

    getTasks() {}

    getCompletedTasks() {}

    nextPage() {
        this.taskitoService.itemsForChecklist(this.parentTask, this.currentPage)
            .first()
            .subscribe(taskitos => {
                this._currentPage++
                this._pagedTaskitosLoaded.next({ taskitos : taskitos, page : this.currentPage })
            })
    }

    createResetCopy() : ChecklistTaskPageTrackingModule {
        return new ChecklistTaskPageTrackingModule(this.taskitoService, this.parentTask)
    }
}

export interface PagerServices {
    taskService : TCTaskService,
    taskitoService : TCTaskitoService
}

export class TaskPager {
    private taskPageTracker : TaskPageTrackingModule
    
    private _hasNextPage : boolean = true
    public get hasNextPage() : boolean {
        return this._hasNextPage
    }
    public set hasNextPage(hasNext : boolean) {
        this._hasNextPage = hasNext
        this.determineNextPageFunction()
    }

    public get showLoadMoreCompletedTasksButton() : boolean {
        return this.taskPageTracker && this.taskPageTracker.loadCompletedTasks && this.hasNextPage
    }

    public get pagedTasksLoaded() : Observable<{ tasks : TCTask[], page : number }> {
        return this._pagedTasksLoaded
    }
    private _pagedTasksLoaded = new Subject<{ tasks : TCTask[], page : number }>()

    public get pagedTaskitosLoaded() : Observable<{ taskitos : TCTaskito[], page : number }> {
        return this._pagedTaskitosLoaded
    }
    private _pagedTaskitosLoaded = new Subject<{ taskitos : TCTaskito[], page : number }>()

    private pagedTasksLoadedSub : Subscription

    private constructor(
        private taskService : TCTaskService,
        private taskitoService : TCTaskitoService
    ) {
        Object.freeze(this.NextPageFunctions)
    }

    public static PagerForList(list : TCList, services : PagerServices) : TaskPager {
        const pager = new TaskPager(services.taskService, services.taskitoService)
        pager.setCurrentList(list)
        return pager
    }

    public static PagerForSmartList(smartList : TCSmartList, services : PagerServices) : TaskPager {
        const pager = new TaskPager(services.taskService, services.taskitoService)
        pager.setCurrentSmartList(smartList)
        return pager
    }

    public static PagerForProject(project : TCTask, services : PagerServices) : TaskPager {
        if (!project.isProject) return null

        const pager = new TaskPager(services.taskService, services.taskitoService)
        pager.setCurrentProject(project)
        return pager
    }

    public static PagerForChecklist(checklist : TCTask, services : PagerServices) : TaskPager {
        if (!checklist.isChecklist) return null

        const pager = new TaskPager(services.taskService, services.taskitoService)
        pager.setCurrentChecklist(checklist)
        return pager
    }

    public reset() {
        this.taskPageTracker = this.taskPageTracker.createResetCopy()
        this.setupPageSubscription(this.taskPageTracker.loadsTaskitos)
    }

    public nextPage() {
        this.nextPageFunction()
    }

    private readonly NextPageFunctions = {
        loadNextPage : () => {
            if (!this.hasNextPage || this.taskPageTracker == null || this.pagedTasksLoaded == null) return
            this.nextPageFunction = this.NextPageFunctions.doNothing
            this.taskPageTracker.nextPage()
        },
        doNothing : () => {}
    }
    private nextPageFunction : () => void = this.NextPageFunctions.loadNextPage
    
    // Set the pager to start loading the given list.
    private setCurrentList(list : TCList) {
        this.taskPageTracker = new ListTaskPageTrackingModule(this.taskService, list)
        this.setupPageSubscription()
    }

    // Set the pager to start loading the given smart list.
    private setCurrentSmartList(smartList : TCSmartList) {
        this.taskPageTracker = new SmartListPageTrackingModule(this.taskService, smartList)
        this.setupPageSubscription()
    }

    // Set the pager to start loading the given project.
    private setCurrentProject(parentTask : TCTask) {
        this.taskPageTracker = new ProjectTaskPageTrackingModule(this.taskService, parentTask)
        this.setupPageSubscription()
    }

    // Set the pager to start loading the given checklist.
    private setCurrentChecklist(parentTask : TCTask) {
        this.taskPageTracker = new ChecklistTaskPageTrackingModule(this.taskitoService, parentTask)
        this.setupPageSubscription(true)
    }

    private determineNextPageFunction() {
        this.nextPageFunction = this.hasNextPage ? this.NextPageFunctions.loadNextPage : this.NextPageFunctions.doNothing
    }

    private setupPageSubscription(forTaskitos : boolean = false) {
        this.hasNextPage = true

        if (this.pagedTasksLoadedSub) this.pagedTasksLoadedSub.unsubscribe()

        if (forTaskitos) {
            this.pagedTasksLoadedSub = this.taskPageTracker.pagedTaskitosLoaded.subscribe(result => {
                this.hasNextPage = result.taskitos.length > 0 
                this._pagedTaskitosLoaded.next(result)
            })
            return
        }

        this.pagedTasksLoadedSub = this.taskPageTracker.pagedTasksLoaded.subscribe(result => {
            this.hasNextPage = result.tasks.length > 0 
            this._pagedTasksLoaded.next(result)
        })
    }
}