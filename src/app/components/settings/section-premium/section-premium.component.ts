import { Component, OnInit, ChangeDetectorRef, ViewChild }  from '@angular/core'

import { environment } from '../../../../environments/environment'
import { TCAccountService } from '../../../services/tc-account.service'
import { TCAccount } from '../../../classes/tc-account'
import { TCSubscriptionService } from '../../../services/tc-subscription.service'
import { TCSubscription, SubscriptionType, SubscriptionPurchaseHistoryItem } from '../../../classes/tc-subscription'
import { PaywallService } from '../../../services/paywall.service'
import { ContextMenuService, ContextMenuComponent } from 'angular2-contextmenu'


interface paymentHistory {
    saving  : boolean,
    sent    : boolean,
    history : SubscriptionPurchaseHistoryItem
}

@Component({
    selector: 'section-premium',
    templateUrl: 'section-premium.component.html',
    styleUrls: ['section-premium.component.css']

})
export class SettingsPremiumComponent implements OnInit {
    private account      : TCAccount
    subscription : TCSubscription

    loading : boolean = true
    showConfirmation : boolean = false
    readonly currentDate : any = new Date()

    readonly PaymentType = SubscriptionType
    @ViewChild('paymentMoreOptionsMenu') private paymentOptionsMenu : ContextMenuComponent

    get paymentSystemMessageSuffix() : string {
        return this.subscription.paymentSystem == 'apple_iap' ? ' via the App Store.' :
               this.subscription.paymentSystem == 'googleplay' ? ' via GooglePlay' :
               '.'
    }

    showPaymentHistory : boolean = false
    loadingPaymentHistory : boolean = false
    payments : paymentHistory[] = []

    constructor(
        private readonly accountService : TCAccountService,
        private readonly subscriptionService : TCSubscriptionService,
        private readonly paywallService : PaywallService,
        private readonly contextMenuService : ContextMenuService
    ) {}

    ngOnInit() {
        this.accountService.account.subscribe(account => {
            this.account = account
            this.update()
        })
        this.subscriptionService.subscription.subscribe(subscription => {
            this.subscription = subscription
            this.update()
        })
    }

    private update() {
        this.loading = this.account == null || this.subscription == null
    }

    private processingPayment : boolean = false
    private selectPayment(type : SubscriptionType) {
        if (this.processingPayment) return

        this.processingPayment = true
        this.paywallService.selectPayment(type).subscribe({
            complete : () => {
                this.processingPayment = false
                this.subscriptionService.getSubscription()
            }
        })
        // Maybe gets some observables, does some things.
        // Depends on what the API requires.
    }

    onContextMenu(event : any) {
        this.contextMenuService.show.next({
            contextMenu: this.paymentOptionsMenu,
            event: event,
            item: this.subscription
        });
        event.preventDefault()
        event.stopPropagation()
    }

    showPurchaseHistory() {
        this.showPaymentHistory = true
        this.loadingPaymentHistory = true
        this.subscriptionService.getPurchaseHistory().subscribe((history : SubscriptionPurchaseHistoryItem[]) => {
            this.loadingPaymentHistory = false
            this.payments = history.map((historyItem : SubscriptionPurchaseHistoryItem) => {
                    return {
                        saving : false,
                        sent   : false,
                        history : historyItem
                    }
                })

        })
    }

    hidePurchaseHistory() {
        this.showPaymentHistory = false
        this.loadingPaymentHistory = false
    }

    sendPaymentReceipt(payment : paymentHistory) {
        payment.saving = true
        payment.sent = false
        this.subscriptionService.sendPaymentReceipt(payment.history).subscribe(result => {
            payment.saving = false
            payment.sent = true
            setTimeout(() => {
                payment.sent = false
            }, 3000)
        })
    }

    showSubscriptionManagementHelp() {
        if (this.subscription.paymentSystem != 'apple_iap' && this.subscription.paymentSystem != 'googleplay') return
        
        const appleLink = 'https://support.apple.com/en-us/HT202039'
        const googleLink = 'https://support.google.com/payments/answer/6220303?hl=en'
        const link = this.subscription.paymentSystem == 'apple_iap' ? appleLink : googleLink
        
        window.open(link)
    }

    downgradeShowConfirmation() {
        this.showConfirmation = true
    }
    downgradeToFree() {
        this.subscriptionService.downgrade().subscribe(downgraded => {
            if (!downgraded) return
            this.subscriptionService.getSubscription()
            this.showConfirmation = false
        })
    }
}
