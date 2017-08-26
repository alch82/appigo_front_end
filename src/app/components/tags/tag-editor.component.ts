import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core'
import { TCTag, TCTagAssignment } from '../../classes/tc-tag'
import { TCTagService } from '../../services/tc-tag.service'
import { TCTask } from '../../classes/tc-task'

@Component({
    selector : 'tag-editor',
    templateUrl : 'tag-editor.component.html',
    styleUrls: ['tag-editor.component.css']
})
export class TagEditorComponent {
    selectedTags : TCTag[] = []
    allTags : { tag : TCTag, count : number}[] =[]
    shouldSortAlphabetically : boolean = true
    inputText : string = ''

    private _task : TCTask
    @Input() set task(task : TCTask) {
        if (task) { this._task = task }
        else { return }

        let allTagSub = this.tagService.tagsForUser().first().subscribe(tags => {
            this.allTags = tags
            this.sortAlphabetically()

            this.tagService.tagsForTask(task).first().subscribe(tags => {
                this.selectedTags = tags
            })
        })
    }
    @Output() createdTag : EventEmitter<TCTag> = new EventEmitter<TCTag>()
    @Output() selectedTag : EventEmitter<TCTag> = new EventEmitter<TCTag>()
    @Output() deselectedTag : EventEmitter<TCTag> = new EventEmitter<TCTag>()
    @Output() deletedTag : EventEmitter<TCTag> = new EventEmitter<TCTag>()

    constructor(
        private tagService : TCTagService
    ) {}

    isTagSelected(tag : TCTag) : boolean {
        return this.selectedTags.filter(e => tag.tagid == e.tagid).length > 0
    }

    selectTag(tag : TCTag) {
        const allTag = this.allTags.find(t => t.tag.identifier == tag.identifier)

        if (this.isTagSelected(tag)) {
            this.tagService.removeTagAssignment(new TCTagAssignment(tag.tagid, this._task.identifier)).first().subscribe(result => {
                this.selectedTags = this.selectedTags.filter(e => tag.tagid != e.tagid )
                allTag.count -= 1
                this.deselectedTag.emit(tag)
            })
        }
        else {
            const sub = this.tagService.addTagAssignment(new TCTagAssignment(tag.tagid, this._task.identifier)).first().subscribe(result => {
                this.selectedTags.push(tag)
                allTag.count += 1
                this.selectedTag.emit(tag)
            })
        }
    }

    createTag() {
        const tag = new TCTag(undefined, this.inputText)
        
        this.tagService.create(tag).first().subscribe(result => {
            this.allTags.push( { tag : result, count : 0 })
            this.sortTypeSelected(this.shouldSortAlphabetically)
            this.selectTag(result)
            this.createdTag.emit(tag)
        })
        this.inputText = ''
    }

    deleteTag(tag : TCTag) {
        this.tagService.delete(tag).first().subscribe(result => {
            this.allTags = this.allTags.filter(t => t.tag.identifier != tag.identifier)
            this.deletedTag.emit(tag)
        })
    }

    sortTypeSelected(event : boolean) {
        event ? this.sortAlphabetically() : this.sortByCount()
        this.shouldSortAlphabetically = event
    }

    sortByCount() {
        this.allTags.sort((a, b) => b.count - a.count )
    }

    sortAlphabetically() {
        this.allTags.sort((a, b) => a.tag.name.toUpperCase().localeCompare(b.tag.name.toUpperCase()) )
    }
}