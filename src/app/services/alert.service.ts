import { Injectable } from '@angular/core'
import { TCTaskNotification } from '../classes/tc-task-notification'
import { TCTaskNotificationService } from './tc-task-notification.service'
import { TCTask } from '../classes/tc-task'
import { TCTaskService } from './tc-task.service'
import { TCAuthenticationService } from './tc-authentication.service'
import { Observable, Subscription } from 'rxjs'

const secondsToMilliseconds = (seconds : number) : number => {
    return seconds * 1000
}

const hoursToMilliseconds = (hours : number) : number => {
    return secondsToMilliseconds(hours * 360)
}

const NOTIFCATION_DURATION : number = secondsToMilliseconds(6)
const ALERT_POLLING_TIME  : number = secondsToMilliseconds(5)
const SERVER_POLLING_TIME : number = hoursToMilliseconds(1)

const removePastNotifications = (notifications : TCTaskNotification[]) : TCTaskNotification[] => {
    const now = new Date()
    return notifications.filter(e => e.alertDate > now )
}

@Injectable()
export class AlertService {
    constructor(
        private readonly notificationService : TCTaskNotificationService,
        private readonly taskService : TCTaskService,
        private readonly authService : TCAuthenticationService
    ) {
        const addNewNotification = (notification : TCTaskNotification) => {
            const now = new Date()
            if (notification.alertDate > now) {
                this.futureNotifications.push(notification)
            }
        }

        this.notificationService.createdNotification.subscribe(notification => {
            addNewNotification(notification)
        })

        this.notificationService.updatedNotification.subscribe(notification => {
            const fromList = this.futureNotifications.find(e => e.identifier == notification.identifier)
            if (fromList) {
                fromList.triggerDate = new Date(notification.triggerDate)
                fromList.triggerOffset = notification.triggerOffset
                this.futureNotifications = removePastNotifications(this.futureNotifications)
            }
            else {
                addNewNotification(notification)
            }
        })
        
        this.notificationService.deletedNotification.subscribe(notification => {
            this.futureNotifications = this.futureNotifications.filter(e => e.identifier != notification.identifier)
        })

        this.authService.authStateChanged.subscribe(() => {
            if(this.authService.isLoggedOut()) {
                this.cancelAllAlerts(true)
            }
        })
    }

    private futureNotifications : TCTaskNotification[]
    private alertPollSubscription  : Subscription
    private serverPollSubscription : Subscription

    startAlerts() {
        this.cancelAllAlerts()
        this.loadAlerts()
        this.schedulServerPolling()
    }

    cancelAllAlerts(clear : boolean = false) {
        if (clear) this.futureNotifications = []
        if (this.alertPollSubscription) this.alertPollSubscription.unsubscribe()
        if (this.serverPollSubscription) this.serverPollSubscription.unsubscribe()
    }

    private loadAlerts() {
        this.notificationService.allNotifications().first().subscribe(notifications => {
            this.futureNotifications = removePastNotifications(notifications)
            this.scheduleNotifications(notifications)
        })
    }

    private schedulServerPolling() {
        this.serverPollSubscription = Observable.interval(SERVER_POLLING_TIME).subscribe(count => {
            this.startAlerts()
        })
    }

    private scheduleNotifications(notifications : TCTaskNotification[]) {
        this.alertPollSubscription = Observable.interval(ALERT_POLLING_TIME).subscribe(count => {
            const now = new Date()
            const notificationsToAlert = this.futureNotifications.filter(e => e.alertDate < now)
            this.futureNotifications = removePastNotifications(this.futureNotifications)

            for (let notification of notificationsToAlert) {
                this.taskService.taskForId(notification.taskId).first().subscribe(task => {
                   this.createNotificationAlert(notification, task)
                })
            }
        })
    }

    private createNotificationAlert(notification : TCTaskNotification, task : TCTask) {
         Notification.requestPermission().then((permission) => {
            if (permission != 'granted') return
            const n = new Notification(task.name, {
                icon : './assets/img/app-icon-256.png',
                body : `Due: ${task.dueDate.toString()}`
            })

            Observable.interval(NOTIFCATION_DURATION).first().subscribe(count => n.close())
        })
    }
}