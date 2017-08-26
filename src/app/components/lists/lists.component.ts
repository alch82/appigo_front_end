import { Component, OnInit, OnDestroy, ViewChild, ViewContainerRef, Output, EventEmitter }  from '@angular/core'
import { Router } from '@angular/router'
import { ContextMenuService, ContextMenuComponent} from 'angular2-contextmenu'
import { DragulaService } from 'ng2-dragula';

import { TCListService, ListPublication } from '../../services/tc-list.service'
import { TCList } from '../../classes/tc-list'

import { TCTaskService } from '../../services/tc-task.service'

import { TCSmartListService } from '../../services/tc-smart-list.service'
import { TCSmartList } from '../../classes/tc-smart-list'

import { TCUserSettingsService } from '../../services/tc-user-settings.service'
import { TCUserSettings } from '../../classes/tc-user-settings'

import { TCAppSettingsService } from '../../services/tc-app-settings.service'

import { NgbModal, NgbModalRef }  from '@ng-bootstrap/ng-bootstrap'
import { ListEditComponent }      from '../list-edit/list-edit.component'
import { SmartListEditComponent } from '../smart-list-edit/smart-list-edit.component'
import { SmartListDeleteConfirmationComponent } from '../list-property-editors/smart-list-delete-confirmation/smart-list-delete-confirmation.component'
import { ListDeleteConfirmationComponent }      from '../list-property-editors/list-delete-confirmation/list-delete-confirmation.component'

import { TCErrorService, TCError }    from '../../services/tc-error.service'
import { ToastsManager } from 'ng2-toastr/ng2-toastr'

import { Utils, ListPublishInformation } from '../../tc-utils'

import { Subscription } from 'rxjs'

interface SmartListInfo {
    taskInfo : { count : number, overdue : number },
    smartList: TCSmartList
}

interface ListInfo {
    isSpacer : boolean,
    hidden : boolean,
    taskInfo : { count : number, overdue : number },
    list     : TCList
}

@Component({
    selector: 'lists',
    templateUrl: 'lists.component.html',
    styleUrls: [
        './../../../../node_modules/dragula/dist/dragula.css',
        'lists.component.css'
    ]
})
export class ListsComponent implements OnInit, OnDestroy {
    mainLists  : ListInfo[] = []
    smartLists : SmartListInfo[] = []
    userLists  : ListInfo[] = []

    listEditFormToggle     : boolean = false
    listCreationInProgress : boolean = false

    selectedList : TCList | TCSmartList = null

    private listSubscription : Subscription
    private smartListSubscription : Subscription
    private taskCountSubscription : Subscription

    @ViewChild('mainListMenu') public mainListMenu: ContextMenuComponent
    @ViewChild('smartListMenu') public smartListMenu: ContextMenuComponent
    @ViewChild('userListMenu') public userListMenu: ContextMenuComponent

    @Output() changeStateListsMenu : EventEmitter<boolean> = new EventEmitter<boolean>()

    constructor(
        private listService      : TCListService,
        private smartListService : TCSmartListService,
        private taskService      : TCTaskService,
        private settingsService  : TCUserSettingsService,
        private appSettingsService: TCAppSettingsService,
        private modalService     : NgbModal,
        private contextMenuService: ContextMenuService,
        private dragulaService   : DragulaService
    ) {
        dragulaService.setOptions('smartLists', {
            invalid: (el, handle) => el.classList.contains('no-drag'),
            accepts: function (el, target, source, sibling) {
                return sibling === null || !sibling.classList.contains('no-drag')
            }

        });
        dragulaService.dropModel.subscribe((value) => {
            let bagName = value[0]
            if (bagName == 'smartLists') {
                this.sortSmartListsOnDrop()
            } else if (bagName == 'userLists') {
                this.sortTaskLists();
            }
        });
    }
    
    ngOnInit() : void {
        const findSelectedListFunction = (lists : any[]) => {
            this.settingsService.settings.first().subscribe(settings => {
                const selectedListID : string = this.appSettingsService.getSelectedListID()
                // No saved list id, or ID not found.
                // Set selected list to Everything smart list
                if (!selectedListID) {
                    this.selectedList = this.smartLists
                        .map((info : SmartListInfo) => info.smartList)
                        .find((list : TCSmartList) => list.isEverythingSmartList)
                    return
                }

                // Already found the selected list
                if (this.selectedList) return 
                this.selectedList = lists.find((list) => selectedListID == list.identifier)

                if(this.selectedList) this.selectList(this.selectedList)
            })
        }

        this.listSubscription = this.listService.lists.subscribe((pub : ListPublication) => {
            const listsDidReorder = pub.info.reduce((accum, info) => info == ListPublishInformation.Reordered || accum, false)
            if (listsDidReorder) return

            this.settingsService.settings.first().subscribe((settings) => {
                const mappedLists : ListInfo[] = pub.lists.map((list : TCList) => {
                    return { 
                        isSpacer : false,
                        hidden : settings.allListFilter.has(list.identifier),
                        taskInfo : {
                            count : 0,
                            overdue : 0
                        },
                        list : list
                    }
                })

                const inbox = mappedLists.find((info : any) => info.list.identifier == settings.userInbox || info.list.identifier == 'INBOX')
                this.mainLists = inbox ? [inbox] : []

                let someUserLists = mappedLists
                    .filter((info) => inbox && info.list.identifier != inbox.list.identifier )
                    .sort((a, b) => a.list.sortOrder - b.list.sortOrder )
                
                this.userLists = this.userListsWithSpacers(someUserLists)
                findSelectedListFunction(pub.lists)
            })

            this.taskService.getTaskCounts()
        })
        this.listService.getLists(false, false)
    
        this.smartListSubscription = this.smartListService.smartLists.subscribe(pub => {
            const listsDidReorder = pub.info.reduce((accum, info) => info == ListPublishInformation.Reordered || accum, false)
            if (listsDidReorder) return

            const mappedSmartLists : SmartListInfo[] = pub.smartLists.map((smartList : TCSmartList) => {
                return { 
                    taskInfo : {
                        count : 0,
                        overdue : 0
                    },
                    smartList : smartList
                }
            })
            this.smartLists = mappedSmartLists
            findSelectedListFunction(pub.smartLists)
            this.taskService.getTaskCounts()
        })
        this.smartListService.willDeleteSmartList.subscribe((deleted : TCSmartList) => this.smartListDeleted(deleted) )
        this.smartListService.getSmartLists()

        this.taskCountSubscription = this.taskService.taskCounts.subscribe(counts => {
            const listCountFunction = (list : ListInfo) => {
                const count = counts.listTaskCounts.find(e => !list.isSpacer && e.listid == list.list.identifier)
                if (count) {
                    list.taskInfo.count = count.active
                    list.taskInfo.overdue = count.overdue
                }
            }

            this.userLists.forEach(listCountFunction)
            this.mainLists.forEach(listCountFunction)

            this.smartLists.forEach((smartList : SmartListInfo) => {
                const count = counts.smartListTaskCounts.find(e => e.listid == smartList.smartList.identifier)
                if (count) {
                    smartList.taskInfo.count = count.active
                    smartList.taskInfo.overdue = count.overdue
                }
            })
        })

        this.taskService.getTaskCounts()
    }

    ngOnDestroy() {
        this.dragulaService.destroy('smartLists')
        this.dragulaService.destroy('userLists')

        this.listSubscription.unsubscribe()
        this.smartListSubscription.unsubscribe()
        this.taskCountSubscription.unsubscribe()
    }

    selectList(list : TCList | TCSmartList) {
        this.updateSelectedList(list)
        
        if (list instanceof TCList) {
            this.listService.selectList(list)
        }
        else {
            this.smartListService.selectSmartList(list)
        }

        if (window.innerWidth <= 767) {
            this.changeStateListsMenu.emit(false)
        }
        return false
    }

    private updateSelectedList(list : TCList | TCSmartList) {
        this.selectedList = list
        this.appSettingsService.setSelectedList(list)
    }

    private isSelectedList(list : TCSmartList | TCList) {
        if (!this.selectedList) return false
        return this.selectedList.identifier == list.identifier
    }
    
    private openSmartListEditorModal() : SmartListEditComponent {
        const modalRef = this.modalService.open(SmartListEditComponent, {backdrop: 'static'})
        const editComponent : SmartListEditComponent = modalRef.componentInstance as SmartListEditComponent

        return editComponent
    }

    private smartListDeleted(deleted : TCSmartList) {
        this.smartLists = this.smartLists.filter((smartListInfo : SmartListInfo) => {
            return smartListInfo.smartList.identifier != deleted.identifier 
        })
    }

    createSmartList(smartList : TCSmartList, completion? : (savedList : TCSmartList) => void) {
        smartList.sortOrder = this.smartLists.length > 0 ? this.smartLists[this.smartLists.length - 1].smartList.sortOrder + 1 : 0
        let displayedList = {
            taskInfo : {
                count  : 0,
                overdue: 0
            },
            smartList: smartList
        }
        this.smartLists.push(displayedList)
        
        this.smartListService.create(smartList).subscribe((savedList : TCSmartList) => {
            const mapped = this.smartLists.map((listInfo) => {
                if (listInfo === displayedList) {
                    return {
                        taskInfo : displayedList.taskInfo,
                        smartList: savedList
                    }
                }
                return listInfo
            })
            this.smartLists = mapped
            if (completion) completion(savedList)
            this.taskService.getTaskCounts()
        })
    }

    addSmartList() {
        this.settingsService.settings.first().subscribe((settings : TCUserSettings) => {
            const smartList = new TCSmartList()
            smartList.defaultList = settings.userInbox
            const editComponent = this.openSmartListEditorModal()
            const sortOrder = this.smartLists.length > 0 ? this.smartLists[this.smartLists.length - 1].smartList.sortOrder + 1 : 0
            editComponent.smartList = smartList
            editComponent.showSmartListCreate = true
            editComponent.showDuplicateButton = false
            editComponent.defaultListName = this.mainLists[0].list.name
            editComponent.sortOrder = sortOrder
            
            editComponent.updatedSmartList.subscribe((updateEvent : any) => {
                this.updateSmartList(updateEvent)
            })
        })

        return false // To prevent <a> from navigating away
    }

    editSmartList(smartList : TCSmartList, listIndex : number) {

        const mapFunction = (listInfo : any) : TCList => listInfo.list
        const allLists : TCList[] = this.userLists.map(mapFunction).concat(this.mainLists.map(mapFunction))
        let defaultList : TCList= allLists.find((list) => list ? list.identifier == smartList.defaultList : false)
        if (!defaultList) {
            defaultList = this.mainLists.map(mapFunction)[0]
            smartList.defaultList = defaultList.identifier
        }

        const editComponent = this.openSmartListEditorModal()
        editComponent.smartList = smartList;
        editComponent.showDuplicateButton = true
        editComponent.defaultListName = defaultList.name

        editComponent.updatedSmartList.subscribe((updateEvent : any) => {
            // this.updateSmartList(updateEvent)
            // this.updateSelectedList(updateEvent.list)
        })
        editComponent.duplicatedSmartList.subscribe((duplicatedList : TCSmartList) => {
            this.createSmartList(duplicatedList)
        })
    }

    deleteConfirmationSmartList(smartList : TCSmartList) {
        const modalRef = this.modalService.open(SmartListDeleteConfirmationComponent)
        const deleteComponent : SmartListDeleteConfirmationComponent = modalRef.componentInstance

        deleteComponent.smartList = smartList
        deleteComponent.inSmartListEditor = false

        return false
    }

    private openListEditorModal() : ListEditComponent {
        const modalRef = this.modalService.open(ListEditComponent, {backdrop: 'static'})
        const editComponent : ListEditComponent = modalRef.componentInstance as ListEditComponent

        return editComponent
    }

    addList() {
        // Create a new list with no constructor parameters. An identifier and timestamp will be assigned by the backend.
        const list = new TCList()
        let lastSortOrder = this.lastSortOrder()
        list.sortOrder = lastSortOrder + 1
        list.color = Utils.randomListColor()

        const editComponent = this.openListEditorModal()
        editComponent.list = list;
        editComponent.updatedList.subscribe((updateEvent : any) => {
            this.updateList(updateEvent)
        })

        let displayedList = {
            isSpacer : false,
            hidden : false,
            taskInfo : {
                count  : 0,
                overdue: 0
            },
            list : list
        }
        this.userLists.push(displayedList)

        this.settingsService.settings.first().subscribe(settings => {
            list.emailNotifications = Object.assign({}, settings.emailNotificationDefaults)
        })
        
        this.listService.create(list).first().subscribe((savedList : TCList) => {
            const mapped = this.userLists.map((listInfo) => {
                if (listInfo === displayedList) {
                    return {
                        isSpacer : false,
                        hidden : false,
                        taskInfo : displayedList.taskInfo,
                        list     : savedList
                    }
                }
                return listInfo
            })
            this.userLists = mapped

            // Change the saved list to have any edits that were made since the
            // add request was made.
            savedList.color = list.color
            savedList.iconName = list.iconName
            savedList.name = list.name

            // Swap the saved list in for the list being edited.
            editComponent.list = savedList
            editComponent.saveButtonActive = true
        })

        return false // To prevent <a> from navigating away
    }

    editList(list : TCList) : ListEditComponent {
        const editComponent = this.openListEditorModal()
        editComponent.list = list;
        editComponent.saveButtonActive = true
        if(this.mainLists[0].list.identifier === list.identifier){
            editComponent.isMainList = true
        }
        editComponent.updatedList.subscribe((updateEvent : any) => {
            // this.updateList(updateEvent)
        })

        return editComponent
    }

    shareList(list : TCList) {
        const component = this.editList(list)
        component.showEditSharing = true
    }

    showDeleteListConfirmationModal(listInfo : ListInfo) {
        const modalRef = this.modalService.open(ListDeleteConfirmationComponent)
        const deleteComponent : ListDeleteConfirmationComponent = modalRef.componentInstance

        deleteComponent.list = listInfo.list
        deleteComponent.deletePressed.subscribe(list => {
            this.deleteTaskList(list)
        })

        return false
    }

    updateList(updateEvent:any):void {
        const mapped = this.userLists.map((listInfo) => {
            if (listInfo.list && listInfo.list.identifier == updateEvent.list.identifier) {
                return {
                    isSpacer : false,
                    hidden : listInfo.hidden,
                    taskInfo : listInfo.taskInfo,
                    list     : updateEvent.list
                }
            }
            return listInfo
        })

        this.userLists = mapped
    }

    updateSmartList(updateEvent : any) : void {
        const mapped = this.smartLists.map((listInfo) => {
            if (listInfo.smartList.identifier == updateEvent.list.identifier) {
                return {
                    isSpacer : false,
                    taskInfo : listInfo.taskInfo,
                    smartList: updateEvent.list
                }
            }
            return listInfo
        })

        this.smartLists = mapped
    }

    sortSmartLists(movedSmartList : TCSmartList, movedIndex : number) {
        const smartLists : TCSmartList[] = this.smartLists.map((smartListInfo) => smartListInfo.smartList)

        movedSmartList.sortOrder = 0
        let previousList = smartLists[movedIndex - 1]
        let nextList = smartLists[movedIndex + 1]
        
        if (movedIndex == 0) {
            movedSmartList.sortType = movedIndex
        }
        else if (previousList && (nextList.sortOrder - previousList.sortOrder) == 1) {
            movedSmartList.sortOrder = previousList.sortOrder + 1
        }
        else if(nextList) {
            movedSmartList.sortOrder = nextList.sortOrder
        }

        smartLists.forEach((list : TCSmartList, index : number) => {
            if (index > movedIndex && index > 0) {
                list.sortOrder = smartLists[index - 1].sortOrder + 1
            }
        })

        for (let smartList of smartLists) {
            this.smartListService.update(smartList).subscribe((updatedList : TCSmartList) => {
                smartList = updatedList
            })
        }
    }

    sortSmartListsOnDrop(){
        const smartLists : TCSmartList[] = this.smartLists.map((smartListInfo) => smartListInfo.smartList)

        smartLists.forEach((smartList : TCSmartList, index : number) => {
            // Only change if needed (to preserve network activity)
            let newSortOrder = index + 1 // 1-based index
            if (smartList.sortOrder != newSortOrder) {
                smartList.sortOrder = newSortOrder
                this.smartListService.update(smartList, [ListPublishInformation.Reordered]).subscribe((updatedList : TCSmartList) => {
                    smartList = updatedList
                })
            }
        })
    }

    sortTaskLists() {
        // Go through the lists and trim out spacers from the beginning
        // or end of the list. Also trim out spacers that are next to each
        // other.
        let prevListInfo : ListInfo = null
        const finalIndex = this.userLists.length - 1

        let newLists = this.userLists.filter((listInfo : ListInfo, index : number, lists : ListInfo[]) : boolean => {
            if (index == 0 && listInfo.isSpacer) {
                return false
            }

            if (prevListInfo && prevListInfo.isSpacer && listInfo.isSpacer) {
                prevListInfo = null // Null this out so at least one spacer stays
                return false
            }

            if (index == finalIndex && listInfo.isSpacer) {
                return false
            }

            prevListInfo = listInfo

            return true
        })

        // Replace the user lists with the newly-filtered lists
        this.userLists = newLists

        // We don't know the original location of the movedListInfo, so
        // we actually have to save _every_ list. Conveniently, we can
        // use the index of each list position in this.userLists as the
        // sort order (starting with a sort order value of 1)
        this.userLists.forEach((listInfo : ListInfo, index : number) => {
            const newSortOrder = index + 1 // 1-based index
            if (listInfo.isSpacer || listInfo.list.sortOrder == newSortOrder) return
            
            listInfo.list.sortOrder = newSortOrder
            this.listService.update(listInfo.list, [ListPublishInformation.Reordered]).first().subscribe((updatedList : TCList) => {
                listInfo.list = updatedList
            })
        })
    }

    private lastSortOrder() {
        let lastUserList = this.userLists.reverse().find((listInfo : ListInfo) => !(listInfo.isSpacer))
        return lastUserList ? lastUserList.list.sortOrder : 0
    }

    private userListsWithSpacers(lists : ListInfo[]) : ListInfo[] {
        if (!lists) return []

        let prevListInfo : ListInfo
        let prevSpacedListInfo : ListInfo

        return lists.reduce((accumulator : ListInfo[], currentList : ListInfo, index : number) : ListInfo[] => {
            if (index != 0) {
                const sortOrderDifference = currentList.list.sortOrder - prevListInfo.list.sortOrder

                if (sortOrderDifference > 1 && prevSpacedListInfo.isSpacer == false) {
                    accumulator.push({
                        isSpacer: true,
                        hidden: false,
                        taskInfo: null,
                        list: null
                    })
                }
            }

            accumulator.push(currentList)

            prevListInfo = currentList
            prevSpacedListInfo = currentList

            return accumulator
        }, [])
    }

    // I don't quite understand why the next line is needed, but the
    // angular2-contextmenu says it needs to be so.
    public canAddSpacerAboveListBound = this.canAddSpacerAboveList.bind(this)
    public canAddSpacerAboveList(listInfo : ListInfo) : boolean {
        if (!listInfo) return false
        if (listInfo.isSpacer) return false
        let listIndex = this.userLists.indexOf(listInfo)
        if (listIndex <= 0) {
            return false
        }

        let previousList = this.userLists[listIndex - 1]
        if (previousList.isSpacer) return false

        return true
    }

    public canDeleteSmartListBound = this.canDeleteSmartList.bind(this)
    public canDeleteSmartList(listInfo : SmartListInfo) : boolean {
        if (!listInfo) return false
        let smartList : TCSmartList = listInfo.smartList

        // We gotta figure out a better way to know that this is
        // the "Everything" list. But, right now, this is pretty much
        // the only thing we have (the special icon name).
        if (smartList.isEverythingSmartList) {
            return false
        }
        
        return true
    }

    deleteTaskList(list : TCList) {
        if (!list) return

        this.listService.delete(list).subscribe((deleted : TCList) => {
            const onlyLists = this.userLists.filter((l : ListInfo) =>  !l.isSpacer && l.list.identifier != deleted.identifier )
            this.userLists  = this.userListsWithSpacers(onlyLists)
            if (this.selectedList.identifier == list.identifier) {
                this.selectList(this.mainLists[0].list)
            }
        })
    }

    addSpacerAboveList(listInfo: ListInfo) {
        let listIndex = this.userLists.indexOf(listInfo)
        if (listIndex <= 0) {
            // Invalid situation or list not found
            return
        }

        this.userLists.splice(listIndex, 0, {
            isSpacer: true,
            hidden: false,
            taskInfo: null,
            list: null
        })

        this.userLists.forEach((listInfo : ListInfo, index : number) => {
            if (listInfo.isSpacer == false) {
                // Only change if needed (to preserve network activity)
                let newSortOrder = index + 1 // 1-based index
                if (listInfo.list.sortOrder != newSortOrder) {
                    listInfo.list.sortOrder = newSortOrder
                    this.listService.update(listInfo.list).subscribe((updatedList : TCList) => {
                        listInfo.list = updatedList
                    })
                }
            }
        })
    }

    deleteSpacer(listInfo : ListInfo) {
        let listIndex = this.userLists.indexOf(listInfo)
        if (listIndex <= 0) {
            // Invalid situation or list info not found
            return
        }

        // Delete the spacer from the UI
        this.userLists.splice(listIndex, 1) // Deletes 1 item at the specified index
        
        this.userLists.forEach((listInfo : ListInfo, index : number) => {
            if (listInfo.isSpacer == false) {
                // Only change if needed (to preserve network activity)
                let newSortOrder = index + 1 // 1-based index
                if (listInfo.list.sortOrder != newSortOrder) {
                    listInfo.list.sortOrder = newSortOrder
                    this.listService.update(listInfo.list).subscribe((updatedList : TCList) => {
                        listInfo.list = updatedList
                    })
                }
            }
        })
    }

    showMessage(message: string) {
        console.log(message)
    }
    public onContextMenu(event : MouseEvent, list : any, menu : string): void {
        this.contextMenuService.show.next({
            contextMenu: this[menu],
            event: event,
            item: list,
        })
        event.preventDefault()
        event.stopPropagation()
    }
}
