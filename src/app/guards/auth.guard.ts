import {Injectable} from '@angular/core'
import {Router, CanActivate} from '@angular/router'
import { tokenNotExpired } from 'angular2-jwt'
import { TCAuthenticationService } from '../services/tc-authentication.service'

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private router: Router,
        private auth  : TCAuthenticationService
    ) {}

    canActivate() {
        if (this.auth.needsTokenRefresh()) {
            if (this.auth.tokenExpired()) {
                this.auth.logout()
                return false
            }

            // TO-DO: We may want to inspect the JWT to check on the expiration
            // date and automatically log in again if the token has expired. If
            // the auto re-login fails, we'll want to make sure to figure out a
            // way to let the user know.
            console.log('Need to refresh token')
        }

        return true
    }
}
