import { Component, Input, Output, EventEmitter} from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

import { TCList } from '../../../classes/tc-list'
import { TCListService } from '../../../services/tc-list.service'

@Component({
    selector : 'list-delete-confirmation',
    templateUrl : 'list-delete-confirmation.component.html',
    styleUrls : ['../../../../assets/css/list-editors.css', 'list-delete-confirmation.component.css']
})
export class ListDeleteConfirmationComponent {
    @Input() list : TCList

    @Output() deletePressed : EventEmitter<TCList> = new EventEmitter<TCList>()
    
    constructor(
        public activeModal: NgbActiveModal,
        private listService : TCListService
    ) {}

    cancel() {
        this.activeModal.close()
    }

    delete() {
        this.deletePressed.emit(this.list)
        this.activeModal.close()
    }
}
