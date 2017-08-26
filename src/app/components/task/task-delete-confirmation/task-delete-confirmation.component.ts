import { Component, Input, Output, EventEmitter} from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

import { TCTask } from '../../../classes/tc-task'
import { TCTaskito } from '../../../classes/tc-taskito'

import { TCTaskService } from '../../../services/tc-task.service'

@Component({
    selector : 'task-delete-confirmation',
    templateUrl : 'task-delete-confirmation.component.html',
    styleUrls : ['../../../../assets/css/modal.css', 'task-delete-confirmation.component.css']
})
export class TaskDeleteConfirmationComponent {
    @Input() task : TCTask | TCTaskito

    @Output() deletePressed : EventEmitter<TCTask|TCTaskito> = new EventEmitter<TCTask|TCTaskito>()
    
    constructor(
        public activeModal: NgbActiveModal
    ) {}

    cancel() {
        this.activeModal.close()
    }

    delete() {
        this.deletePressed.emit(this.task)
        this.activeModal.close()
    }
}
