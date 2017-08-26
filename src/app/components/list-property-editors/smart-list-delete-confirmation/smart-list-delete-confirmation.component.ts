import { Component, Input, Output, EventEmitter} from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

import { TCSmartList } from '../../../classes/tc-smart-list'
import { TCSmartListService } from '../../../services/tc-smart-list.service'


@Component({
    selector : 'smart-list-delete-confirmation',
    templateUrl : 'smart-list-delete-confirmation.component.html',
    styleUrls : ['../../../../assets/css/list-editors.css', 'smart-list-delete-confirmation.component.css']
})
export class SmartListDeleteConfirmationComponent {
    @Input() smartList : TCSmartList

    @Output() done   : EventEmitter<any> = new EventEmitter<any>()
    
    inSmartListEditor : boolean = true
    
    constructor(
        public activeModal: NgbActiveModal,
        private smartListService : TCSmartListService
    ) {}

    cancel() {
        if (this.inSmartListEditor) {
            this.done.emit()
        } else {
            this.activeModal.close()
        }
    }

    delete() {
        this.smartListService.delete(this.smartList)
        this.activeModal.close()
    }
}
