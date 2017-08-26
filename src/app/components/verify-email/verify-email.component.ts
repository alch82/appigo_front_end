import { Component, OnInit, ViewEncapsulation }  from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { TCAccountService } from '../../services/tc-account.service'

@Component({
    selector: 'verify-email',
    templateUrl: 'verify-email.component.html',
    styleUrls: ['../landing/landing.component.css', 'verify-email.component.css'],
    encapsulation: ViewEncapsulation.None
})
export class VerifyEmailComponent implements OnInit {

    error:boolean = false
    resultMessage:string = ''
    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private account : TCAccountService
        ) {}

    ngOnInit() {
        this.route.params.subscribe(params => {
            const id = params['verificationid']
            this.account.verifyEmail(id).subscribe((response:any) => {
                if (response.success) {
                    this.resultMessage = `Your email address has been verified.`
                } else {
                    this.resultMessage = `Something went wrong. Please try to verify your email address again later.`
                }
                this.error = true
            }, err => {
                this.resultMessage = `Something went wrong. Please try to verify your email address again later.`
                if (err.message) {
                    this.resultMessage += err.message
                }
                this.error = true
            })
        })
    }
    navigateHome(){
        this.router.navigate(['/']);
    }
}