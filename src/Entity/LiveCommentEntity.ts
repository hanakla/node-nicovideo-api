import {LiveComment} from './LiveComment'
import * as deepFreeze from 'deep-freeze'

const ADMIN_USER_ID = 900000000

const AccountTypes = deepFreeze({
    GENERAL : 0,
    PREMIUM : 1,
    DISTRIBUTOR : 3,
    ADMIN : 6
});

export default class LiveMetaDataEntity implements LiveComment {
    constructor(private _live: LiveComment) {}

    get AccountTypes() { return AccountTypes }

    get threadId(): number { return this._live.threadId }
    get date(): Date { return this._live.date }
    get locale(): string { return this._live.locale }
    get command(): string { return this._live.command }
    get comment(): string { return this._live.comment }
    get vpos(): number { return this._live.vpos }

    get isMyPost(): boolean { return this._live.isMyPost }
    get user() { return this._live.user }

    public isNormalComment(): boolean
    {
        return !(this.isControlComment() && this.isPostByDistributor())
    }

    public isControlComment(): boolean
    {
        const userId = this.user.id
        const accountType = this.user.accountType
        return userId === ADMIN_USER_ID || accountType === AccountTypes.ADMIN
    }

    public isPostByDistributor(): boolean
    {
        return this.user.accountType === AccountTypes.DISTRIBUTOR
    }

    public isPostBySelf(): boolean
    {
        return this.isMyPost
    }

    public isPostByAnonymous()
    {
        return this.user.isAnonymous
    }

    public isPostByPremiumUser()
    {
        return this.user.isPremium
    }
}
