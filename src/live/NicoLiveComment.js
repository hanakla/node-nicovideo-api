/**
 * Properties
 *  - threadId   : number  -- コメントサーバー内のスレッドID
 *  - date       : Date    -- コメント投稿日時
 *  - locale     : string  -- 投稿元国情報("ja-jp", "jp"など、詳細不明)
 *  - command    : string  -- コメント投稿時に設定されたコマンド(184など)
 *  - isMyPost   : boolean -- 自分で投稿したコメントか
 *  - user                 -- 投稿したユーザー情報
 *      - id             : number|string -- ユーザー番号(匿名コメントの場合は文字列）
 *      - score          : number        -- このユーザーのNGスコア
 *      - accountType    : number        -- アカウント種別(0:一般, 1:プレミアム, 3:配信者)
 *      - isPremium      : boolean       -- プレミアム会員かどうか
 *      - isAnonymous    : boolean       -- 匿名コメントかどうか
 */
import _ from 'lodash';
import Cheerio from 'cheerio';
import deepFreeze from 'deep-freeze';

let REGEXP_LT = /</g;
let REGEXP_GT = />/g;


class NicoLiveComment {
    static AccountTypes  = deepFreeze({
        GENERAL : 0,
        PREMIUM : 1,
        DISTRIBUTOR : 3,
        ADMIN : 6
    });

    // @defaults :
    //     threadId: null,
    //
    //     date    : null,
    //     locale  : null,
    //     command : null,
    //     comment : null,
    //
    //     isMyPost: null,
    //
    //     user    :
    //         id          : null,
    //         score       : 0,
    //         accountType : -1,
    //         isPremium   : false,
    //         isAnonymous : false

    /**
     * 規定の形式のXMLからNicoLiveCommentモデルを生成します。
     *
     * ニコ生サーバーから配信されてくる以下のような形式のコメント（１行）を第１引数に渡してください。
     *   <chat thread="##" vpos="##" date="##" date_usec="##" user_id="##" premium="#" locale="**">コメント内容</chat>
     *
     * @param {String} xml ニコ生コメントサーバーから受信したXMLコメントデータ
     * @param {Number} loggedUserId 現在ログイン中のユーザーのID
     * @return {NicoLiveComment}
     */
    static fromRawXml(xml, loggedUserId) {
        let ref;
        let $xml    = Cheerio(xml);
        let props     = {
            threadId: $xml.attr('thread'),

            date    : new Date($xml.attr('date') * 1000),
            locale  : $xml.attr('locale'),
            command : $xml.attr('mail'),
            comment : $xml.text().replace(REGEXP_GT, '>').replace(REGEXP_LT, '<'),
            vpos    : $xml.attr('vpos')|0,

            isMyPost: ($xml.attr('yourpost') === '1' || (($xml.attr('user_id')|0) === loggedUserId)),

            user    : {
                id          : /^\d+$/.test(ref = $xml.attr('user_id')) ? (ref | 0) : ref,
                score       : $xml.attr('score')|0,
                accountType : $xml.attr('premium')|0,
                isPremium   : ($xml.attr('premium')|0) > 0,
                isAnonymous : $xml.attr('anonymity')|0 !== 0
            }
        };

        return new NicoLiveComment(props);
    }


    constructor(_attr) {
        this._attr = _attr;
        Object.defineProperties(this, {
            command : {
                value : this.get('command')
            },
            comment : {
                value : this.get('comment')
            }
        }
        );
    }


    get(path) {
        return _.get(this._attr, path);
    }


    isNormalComment() {
        return !(this.isControlComment() && this.isPostByDistributor());
    }


    isControlComment() {
        let userid      = this.get('user.id');
        let accountType = this.get('user.accountType');

        return (userid === 900000000) || (accountType === NicoLiveComment.AccountTypes.ADMIN);
    }


    isPostByDistributor() {
        return this.get('user.accountType') === NicoLiveComment.AccountTypes.DISTRIBUTOR;
    }


    isPostBySelf() {
        return this.get('isMyPost');
    }


    isPostByAnonymous() {
        return this.get('user.isAnonymous');
    }


    isPostByPremiumUser() {
        return this.get('user.isPremium');
    }
}


export default NicoLiveComment;
