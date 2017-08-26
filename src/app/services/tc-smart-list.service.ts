import { Injectable }     from '@angular/core'
import { Http, Headers, RequestOptions, Response, URLSearchParams }  from '@angular/http'
import { AuthHttp } from 'angular2-jwt'
import { TCHttp } from  '../tc-http'
import { environment } from '../../environments/environment'
import { ListPublishInformation } from '../tc-utils'

import { Observable, Subject, ReplaySubject } from 'rxjs/Rx'
import 'rxjs/add/operator/map'

import { TCSmartList } from '../classes/tc-smart-list'
import { TCBaseService } from './tc-base.service'
import { TCErrorService } from './tc-error.service'
import { TCUserSettingsService } from './tc-user-settings.service'

export type SmartListPublication = {smartLists: TCSmartList[], info: ListPublishInformation[]}

@Injectable() 
export class TCSmartListService extends TCBaseService{
    public readonly didDeleteSmartList   : Observable<TCSmartList>
    private _didDeleteSmartList : Subject<TCSmartList>

    public readonly willDeleteSmartList   : Observable<TCSmartList>
    private _willDeleteSmartList : Subject<TCSmartList>

    public readonly smartListSelected : Observable<TCSmartList>
    private _smartListSelected : ReplaySubject<TCSmartList>

    public readonly smartListUpdated : Observable<TCSmartList>
    private _smartListUpdated : Subject<TCSmartList>

    private readonly _smartLists : ReplaySubject<SmartListPublication> = new ReplaySubject<SmartListPublication>(1)
    public get smartLists() : Observable<SmartListPublication> { 
        return this._smartLists
    }

    private smartListUrl: string
    private headers: Headers

    constructor(
        tcHttp: TCHttp,
        errService : TCErrorService,
        private readonly settingsService : TCUserSettingsService
    ) {
        super(tcHttp, errService)

        this._didDeleteSmartList = new Subject<TCSmartList>()
        this.didDeleteSmartList = this._didDeleteSmartList

        this._willDeleteSmartList = new Subject<TCSmartList>()
        this.willDeleteSmartList = this._willDeleteSmartList

        this._smartListSelected = new ReplaySubject<TCSmartList>(1)
        this.smartListSelected = this._smartListSelected

        this._smartListUpdated = new Subject<TCSmartList>()
        this.smartListUpdated = this._smartListUpdated

        this.headers = new Headers({
            'Content-Type' : 'application/json'
        })
        this.smartListUrl = `${environment.baseApiUrl}/smart-lists`
    }

    public selectSmartList(smartList : TCSmartList) {
        this._smartListSelected.next(smartList)
    }

    private publishSmartLists(smartLists : TCSmartList[], info : ListPublishInformation[] = [ListPublishInformation.None]) {
        const sorted = smartLists.sort((a, b) => a.sortOrder - b.sortOrder )
        this._smartLists.next({smartLists:  sorted, info: info})
    }

    getSmartLists() : Observable<TCSmartList[]>{
        let url = `${this.smartListUrl}`

        const result = this.settingsService.settings.flatMap(settings => {
            return this.tcHttp
                .get(url, { headers : this.headers })
                .share().first()
                .map(response => {
                    if(!response.ok) {
                        return Observable.throw(response.json() || 'Service error')   
                    }

                    return response.json().map((listData : any) => {
                        return new TCSmartList(listData).setCorrectInboxReferences(settings)
                    })
                })
                .catch((err) => this.handleError(err))
        }).first().share()

        result.subscribe((smartLists) => {
            this.publishSmartLists(smartLists)
        })

        return result
    }

    smartList(smartList : TCSmartList) : Observable<TCSmartList> {
        const url = `${this.smartListUrl}/${smartList.identifier}`
        const options = new RequestOptions({ headers : this.headers })

        return this.settingsService.settings.flatMap(settings => {
            return this.tcHttp
                .get(url, options)
                .share().first()
                .map(response => {
                    if(!response.ok) {
                        return Observable.throw(response.json() || 'Service error')
                    }
                    return new TCSmartList(response.json()).setCorrectInboxReferences(settings)
                })
                .catch((err) => this.handleError(err))
        }).first().share()
    }

    create(smartList : TCSmartList) : Observable<TCSmartList> {
        const url = `${this.smartListUrl}`
        const options = new RequestOptions({ headers : this.headers })

        const result = this.settingsService.settings.flatMap(settings => {
            const sanitizedBody = smartList.sanitizedRequestBody(settings)
            return this.tcHttp
                .post(url, JSON.stringify(sanitizedBody), options)
                .share().first()
                .map(response => {
                    if(!response.ok) {
                        return Observable.throw(response.json() || 'Service error')
                    }
                    return new TCSmartList(response.json()).setCorrectInboxReferences(settings)
                })
                .catch((err) => this.handleError(err))
        }).first().share()

        result.subscribe((created) => {
            this.smartLists.first().subscribe(pub => {
                const newArray = Array.from(pub.smartLists)
                newArray.push(created)
                this.publishSmartLists(newArray)
            })
        })

        return result
    }

    update(smartList : TCSmartList, info: ListPublishInformation[] = [ListPublishInformation.None]) : Observable<TCSmartList> {
        const url = `${this.smartListUrl}/${smartList.identifier}`
        const options = new RequestOptions({ headers : this.headers })
        const body = smartList.requestBody()

        const result = this.settingsService.settings.flatMap(settings =>{
            const sanitizedBody = smartList.sanitizedRequestBody(settings)
            return this.tcHttp
                .put(url, JSON.stringify(sanitizedBody), options)
                .share().first()
                .map(response => {
                    if(!response.ok) {
                        return Observable.throw(response.json() || 'Service error')
                    }
                    return new TCSmartList(response.json()).setCorrectInboxReferences(settings)
                })
                .catch((err) => this.handleError(err))
        }).first().share()

        result.subscribe(updated => {
            this._smartListUpdated.next(updated)

            this.smartLists.first().subscribe(pub => {
                const newArray = pub.smartLists.reduce((accum : TCSmartList[], current : TCSmartList) : TCSmartList[] => {
                    accum.push(current.identifier == updated.identifier ? updated : current)
                    return accum
                }, [])
                this.publishSmartLists(newArray, info)
            })
        })

        return result
    }

    delete(smartList : TCSmartList) : Observable<TCSmartList>{
        const url = `${this.smartListUrl}/${smartList.identifier}`
        const options = new RequestOptions({ headers : this.headers })

        // Update subject before the http call so that the UI
        // can remove the smart list without waiting for the network.
        this._willDeleteSmartList.next(smartList) 

        let result = this.tcHttp
            .delete(url, options)
            .share().first()
            .map(response => {
                let success = response.ok
                if(success) {
                    return new TCSmartList(response.json())
                }
                else {
                    return Observable.throw(response.json() || 'Service error')
                }
            })
            .catch((err) => this.handleError(err))

        result.toPromise<TCSmartList>().then((deleted : TCSmartList) => this._didDeleteSmartList.next(deleted))
        result.subscribe(deleted => {
            this.smartLists.first().subscribe(pub => {
                const newArray = pub.smartLists.filter((current : TCSmartList) => current.identifier != smartList.identifier )
                this.publishSmartLists(newArray)
            })
        })

        return result
    }
}
