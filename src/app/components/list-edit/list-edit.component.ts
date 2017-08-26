import { Component, Output, Input, EventEmitter, ViewChild, OnInit }  from '@angular/core'
import { TCList } from '../../classes/tc-list'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { Utils } from '../../tc-utils'
import { TCListService } from '../../services/tc-list.service'
import { TCListMembershipService } from '../../services/tc-list-membership.service'
import { TCAccountService } from '../../services/tc-account.service'
import { TCUserSettingsService } from '../../services/tc-user-settings.service'
import { TCUserSettings } from '../../classes/tc-user-settings'

@Component({
    selector: 'list-edit',
    templateUrl: 'list-edit.component.html',
    styleUrls: ['../../../assets/css/list-editors.css', 'list-edit.component.css']
})
export class ListEditComponent implements OnInit {
    public savingInProgress : boolean = false

    public sharingMessage        : string = 'Share this list...'
    public defaultDueDateMessage : string = "None"
    public sortTypeMessage       : string = "Due date, priority"

    public showEditSharing       : boolean = false
    public showEditNotifications : boolean = false
    public showEditDefaultDueDate: boolean = false
    public showEditSortType      : boolean = false
    public showChangeColor       : boolean = false
    public showChangeIcon        : boolean = false
    public bgColorMore           : string  = '#9e9e9e'

    public  isMainList            : boolean = false

    public readonly dueDates = Utils.DueDateNames
    public readonly sortTypes = Utils.SortTypeNames
    public readonly mainColors = Utils.MainColors
    
    private settings : TCUserSettings

    private _list : TCList
    @Input()
    set list(list: TCList) {
        this._list = list

        if (this.settings) {
            this.determineDueDateMessage()
            this.determineSortTypeMessage()
        }

        // Set the "more color" button to show the custom
        // color if it's not one of the main colors.
        if (this.mainColors.indexOf(this._list.color) == -1) {
            this.bgColorMore = this._list.color
        }
    }
    @Input() saveButtonActive: boolean = false

    @Output() listEditFormActivated:EventEmitter<boolean> = new EventEmitter<boolean>()
    @Output() updatedList:EventEmitter<any> = new EventEmitter<any>()

    @ViewChild('listName') viewChildInput;

    constructor(
        private readonly listService : TCListService,
        private readonly userSettingsService : TCUserSettingsService,
        private readonly listMembershipService : TCListMembershipService,
        private readonly accountService : TCAccountService,
        public activeModal : NgbActiveModal
    ) {}

    ngOnInit() {
        this.userSettingsService.settings.subscribe(settings => {
            this.settings = settings
            this.determineDueDateMessage()
            this.determineSortTypeMessage()
        })

        this.getListMemberInfo()
    }

    ngAfterViewInit() {
        // focus on input element
        if (this.viewChildInput) {
            this.viewChildInput.nativeElement.select()
        }
    }

    private getListMemberInfo() {
        if (!this.saveButtonActive || !this._list.identifier) return // Don't try to get members for newly created lists.
        this.accountService.account.first().subscribe(account => {
            this.listMembershipService.getMembersForList(this._list).first().subscribe(result => {
                const matchesAccount = (info) => info.account.userID == account.userID
                const notMe = result.filter(info => !matchesAccount(info))

                const shareCount = notMe.length
                this.sharingMessage = shareCount > 0 ? `Shared with ${shareCount} ${ shareCount > 1 ? 'people' : 'person' }`
                    : 'Share this list...'
            })
        })
    }

    updateListName(listName:string, saveList? : boolean) {
        if (listName.trim()) {
            this._list.name = listName.trim()
        }

        if (saveList) {
            this.done()
        }
    }

    showChangeColorSettings(show : boolean) {
        this.showChangeColor = show
        if (this.mainColors.indexOf(this._list.color) == -1) {
            this.bgColorMore = this._list.color
        }
    }

    updateColor(color:string) {
        if (color) {
            this._list.color = color
            console.log('List color changed: ' + color)
        }
        if (this.mainColors.indexOf(color) >= 0) {
            this.bgColorMore = '#9e9e9e'
        }
    }

    showSharingOptions(showSharing : boolean) {
        this.showEditSharing = showSharing
    }

    showNotificationSettings(show : boolean) {
        this.showEditNotifications = show
    }

    showDefaultDueDateSettings(show : boolean) {
        this.showEditDefaultDueDate = show
    }

    showSortTypeSettings(show : boolean) {
        this.showEditSortType = show
    }
    showChangeIconSettings(show : boolean) {
        this.showChangeIcon = show
    }

    done() {
        this.savingInProgress = true

        this.listService.update(this._list).first().subscribe((updatedList : TCList) => {
            this.updatedList.emit({list: this._list})
            this.savingInProgress = false
            this.activeModal.close()
        })
    }

    private determineDueDateMessage() {
        if (this._list.defaultDueDate == -1) {
            this.defaultDueDateMessage = this.dueDates[this.settings.defaultDueDate]
        }
        else {
            this.defaultDueDateMessage = this.dueDates[this._list.defaultDueDate]
        }
    }
    private determineSortTypeMessage() {
        if (this._list.sortType == -1) {
            this.sortTypeMessage = this.sortTypes[this.settings.taskSortOrder]
        }
        else {
            this.sortTypeMessage = this.sortTypes[this._list.sortType]
        }
    }
}
