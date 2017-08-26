import { Injectable, OnInit }     from '@angular/core'
import { Headers, RequestOptions, Response }  from '@angular/http'
import { TCHttp } from '../tc-http'
import { environment } from '../../environments/environment'

import { Observable, Subject, ReplaySubject } from 'rxjs/Rx'
import 'rxjs/add/operator/map'
import * as moment from 'moment'
import 'moment-timezone'

import { TCBaseService } from './tc-base.service'
import { TCErrorService } from './tc-error.service'
import { TCListService } from './tc-list.service'
import { TCSmartListService } from './tc-smart-list.service'

@Injectable()
export class TCSyncService extends TCBaseService {
    private readonly syncUrl : string = `${environment.baseApiUrl}/sync`

    private headers : Headers

    private readonly _syncCompleted : Subject<any> = new Subject<any>()
    public get syncCompleted() : Subject<any> {
        return this._syncCompleted
    }

    constructor(
        public readonly tcHttp : TCHttp,
        public readonly errService : TCErrorService,
        private readonly listService : TCListService,
        private readonly smartListService : TCSmartListService,
    ) {
        super(tcHttp, errService)
        
        this.headers = new Headers({ 'Content-Type' : 'application/json' })
    }

    performSync() : Observable<any> {
        if (!environment.isElectron) {
            const result = new ReplaySubject(1)
            result.complete()
            return result
        }

        return this.tcHttp.post(this.syncUrl, null, { headers : this.headers })
            .share().first().do(() => {
                this.listService.getLists(false, false)
                this.smartListService.getSmartLists()
                this._syncCompleted.next()
            })
            .catch(err => this.handleError(err))
    }
}
