import {Component, OnInit, TemplateRef, ViewChild, Output, EventEmitter}  from '@angular/core'
import {Router} from '@angular/router'
import {NgbDropdownConfig, NgbModal} from '@ng-bootstrap/ng-bootstrap';

import {TCAccount}                  from '../../classes/tc-account'
import { TCList }                   from '../../classes/tc-list'
import { TCSmartList }              from '../../classes/tc-smart-list'
import {TCAccountService}           from '../../services/tc-account.service'
import {TCAuthenticationService}    from '../../services/tc-authentication.service'
import { TCAppSettingsService }     from '../../services/tc-app-settings.service'
import { TCSyncService }             from '../../services/tc-sync.service'
import { Utils }                    from '../../tc-utils'

import { SettingsComponent }      from '../settings/settings.component'


const {version:appVersion} = require('../../../../package.json')

@Component({
    selector: 'navigation-bar',
    templateUrl: 'navigation-bar.component.html',
    styleUrls: ['navigation-bar.component.css'],
    providers: [NgbDropdownConfig]
})

export class NavigationBarComponent {
    @ViewChild("confirmationResultModalContent") confirmationResultModalTemplate: TemplateRef <Object>

    displayName : string = 'Welcome'
    confirmationEmail : string = null
    confirmationEmailResultTitle : string = null
    confirmationEmailResultMessage : string = null
    account : TCAccount = null

    appVersion : string = ''

    @Output() toggleSidebar: EventEmitter<boolean> = new EventEmitter<boolean>()

    constructor(
        private router: Router,
        private modalService: NgbModal,
        private accountService: TCAccountService,
        private authService: TCAuthenticationService,
        private settingsService : TCAppSettingsService,
        private syncService : TCSyncService
    ) {}

    ngOnInit() {
        this.appVersion = appVersion
        this.accountService.account.subscribe((account : TCAccount) => {
            this.account = account
            this.displayName = account.displayName()
            if (!account.emailVerified) {
                this.confirmationEmail = account.userName
            } else {
                this.confirmationEmail = null
            }
        })
    }

    resendEmailConfirmation(alertNotificationPopup) {
        alertNotificationPopup.close()

        this.accountService.resendVerificationEmail(this.account.userID).subscribe((result : boolean) => {
            if (result == true) {
                this.confirmationEmailResultTitle = "Check your email"
                this.confirmationEmailResultMessage = `We've sent you a new email (${this.confirmationEmail}). Follow the link in the email to confirm your email address.`
            } else {
                this.confirmationEmailResultTitle = "Please try again"
                this.confirmationEmailResultMessage = "There was a problem sending you a confirmation email. Please try again later."
            }
            this.modalService.open(this.confirmationResultModalTemplate)
        })
    }

    notImplemented() {
        this.modalService.open(`This is not yet implemented.`)
    }

    syncNow(){
        this.syncService.performSync().subscribe(response => {})
        return false
    }
    openSettingsModal() : SettingsComponent{
        const modalRef = this.modalService.open(SettingsComponent)
        const settingsComponent : SettingsComponent = modalRef.componentInstance as SettingsComponent

        return settingsComponent
    }
    showSettings(){
        const settingsComponent = this.openSettingsModal()
        settingsComponent.saveButtonActive = true
    }

    logout() {
        this.authService.logout(true)
        this.router.navigate(['/welcome/signin'])
    }

    clickToggleSidebar() {
        this.toggleSidebar.emit(true)
    }
}
