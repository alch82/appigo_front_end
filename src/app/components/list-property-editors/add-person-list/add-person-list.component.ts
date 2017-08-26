import { Component, OnInit, Input, Output, EventEmitter, ViewChild, ElementRef} from '@angular/core'

import { TCList } from '../../../classes/tc-list'
import { TCAccount } from '../../../classes/tc-account'
import { TCInvitation } from '../../../classes/tc-invitation'
import { TCAccountService } from '../../../services/tc-account.service'
import { TCInvitationService } from '../../../services/tc-invitation.service'
import { TCListMembershipService } from '../../../services/tc-list-membership.service'
import { ListMembershipType, Utils } from '../../../tc-utils'

@Component({
    selector : 'add-person-list',
    templateUrl : 'add-person-list.component.html',
    styleUrls : ['../../../../assets/css/list-editors.css', 'add-person-list.component.css']
})
export class ListEditAddPersonComponent {
    @Input() list : TCList
    @Output() done : EventEmitter<any> = new EventEmitter<any>()
    @Output() invited : EventEmitter<TCInvitation> = new EventEmitter<TCInvitation>()
    @ViewChild('inviteText') inviteText : ElementRef

    public sharedUsers : TCAccount[] = []
    public account : TCAccount
    public invitations : TCInvitation[]
    public errorMessage : string = null

    constructor(
        private readonly listMembershipService : TCListMembershipService,
        private readonly accountService : TCAccountService,
        private readonly invitationService : TCInvitationService
    ){}

    ngOnInit() {
        this.accountService.account.subscribe(account => {
            this.account = account
            this.listMembershipService.getAllSharedListMembers().subscribe(users => {
                const matchesAccount = (user) => user.userID == account.userID
                const notMe = users.filter(info => !matchesAccount(info))

                this.sharedUsers = notMe
            })

            this.invitationService.getInvitationsForList(this.list).first().subscribe(result => {
                this.invitations = result
                console.log(this.invitations)
            })
        })
    }

    isMe(user : TCAccount) : boolean {
        return this.account.userID == user.userID
    }

    selectUser(user : TCAccount) {
        this.inviteText.nativeElement.value = user.userName
    }

    invite() {
        this.errorMessage = null
        if (
            this.account.userName === this.inviteText.nativeElement.value ||
            this.invitations.filter(e => e.email == this.inviteText.nativeElement.value).length > 0 ||
            this.sharedUsers.filter(e => e.userName == this.inviteText.nativeElement.value).length > 0
        ) {
            this.errorMessage = 'This user was already invited'
            return false
        }

        if (!Utils.isValidEmail(this.inviteText.nativeElement.value)) {
            this.errorMessage = 'Please enter a valid email'
            return false
        }

        const invitation = new TCInvitation({
            userid : this.account.userID,
            listid : this.list.identifier,
            membership_type : ListMembershipType.Member,
            email : this.inviteText.nativeElement.value
        })

        this.invitationService.sendInvitation(invitation).subscribe((result : TCInvitation) => {
            this.invited.emit(result)
        }, err => {})
    }
}
