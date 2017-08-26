import { 
  Http,
  Headers,
  Request, 
  Response, 
  RequestOptions, 
  RequestOptionsArgs 
} from '@angular/http'

import { Injectable, Provider } from '@angular/core'
import { AuthHttp, AuthConfig } from 'angular2-jwt'
import { Observable, Subject } from 'rxjs/Rx'

import { TCAuthenticationService } from './services/tc-authentication.service'

@Injectable()
export class TCHttp extends AuthHttp {
  constructor(
    private authService : TCAuthenticationService,
    options : AuthConfig, 
    http : Http, 
    optDefs?: RequestOptions
  ) {
    super(options, http, optDefs)
  }

  public request(url: string | Request, options?: RequestOptionsArgs): Observable<Response> {
    if(this.authService.tokenExpired()) {
        if (!this.authService.isLoggedOut()) {
            this.authService.logout()
        }
      return new Subject<Response>()
    }
    else if (this.authService.needsTokenRefresh()) {
      const headers = new Headers({ 'Content-Type' : 'application/json' })

      // Need an endpoint for this.
      // Maybe use get instead? Can't see a need for a post body.
      this.post(null, null, { headers : headers })
          .subscribe((response : Response) => {
            let token : string = response.json() && response.json().token
            if (token) {
              this.authService.saveToken(token)
            }
          })
    }

    return super.request(url, options)
  }
}

export const TC_HTTP_PROVIDERS: Provider[] = [
  {
    provide: TCHttp,
    deps: [Http, RequestOptions, TCAuthenticationService],
    useFactory: (http: Http, options: RequestOptions, authService: TCAuthenticationService) => {
      return new TCHttp(authService, new AuthConfig(), http, options);
    }
  }
]
