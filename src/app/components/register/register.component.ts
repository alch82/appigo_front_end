import {Component, OnInit, ViewChild} from '@angular/core'
import {Router, ActivatedRoute} from '@angular/router'

import { environment } from '../../../environments/environment'
import { TCAuthenticationService } from '../../services/tc-authentication.service'
import { TCUserSettingsService }   from '../../services/tc-user-settings.service'

@Component({
    selector: 'register-form',
    templateUrl: 'register.component.html'
})

export class RegisterComponent implements OnInit {
    model: any = {}
    loading = false
    error = ''

    private invitationId : string

    @ViewChild('focusRegister') viewChildRegister
    
    constructor(
        private router: Router,
        private route : ActivatedRoute,
        private authService: TCAuthenticationService,
        private userSettingsService : TCUserSettingsService
    ) {}

    ngOnInit() {
        this.route.params.first().subscribe(params => {
            this.invitationId = params.invitation
        })
        // Reset the login status. If this page is accessed with
        // a logged-in account, it won't be for long ...

        this.inputFocus()
    }
    inputFocus() {
        setTimeout(()=>{
            this.viewChildRegister.nativeElement.focus()
        }, 0)
    }

    register() {
        this.loading = true
        this.authService.createUser(this.model.username, this.model.password, this.model.firstname, this.model.lastname, true)
            .first()
            .subscribe(result => {
                if (!result) {
                    // TO-DO: Determine how to provide localized strings
                    this.error = result.error || 'Username or password is incorrect'
                    this.loading = false
                    return
                } 

                const navigationPath = this.invitationId ? `accept-invitation/${this.invitationId}` : `/`
                this.router.navigate([navigationPath])
                this.userSettingsService.updateTimeZone()
            },
            err => {
                this.error = err
                this.loading = false
            })
    }

    cancel() {		
        this.router.navigate(['/'])		
    }

}
